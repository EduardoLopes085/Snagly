// Executed on demand in the page world, where the mounted player owns its props.
// Return only candidate URLs. The extension revalidates them in its own context.
export function mountedXVariants(postId: string, pageUrl: string) {
  const found = new Set<string>();
  if (location.href !== pageUrl || !/^\d+$/.test(postId)) return [];
  type Fields = Record<string, unknown>;
  const fields = (v: unknown): v is Fields => typeof v === 'object' && v !== null;
  const videos = document.querySelectorAll('video');
  const pagePost = /\/status\/(\d+)(?:\/|$)/.exec(location.pathname)?.[1];
  for (const video of videos) {
    if (video.mediaKeys) continue;
    const article = video.closest('article');
    const link = article?.querySelector('time')?.closest('a');
    const owner = link && /\/status\/(\d+)(?:\/|$)/.exec(link.pathname)?.[1];
    if (owner !== postId) continue;
    const posterId = /\/(?:ext_tw_video_thumb|amplify_video_thumb)\/(\d+)\//.exec(video.poster)?.[1];
    const fiberKey = Object.keys(video).find(key => key.startsWith('__reactFiber$'));
    if (!fiberKey) continue;
    let fiber: unknown = Reflect.get(video, fiberKey);
    for (let level = 0; level < 32 && fields(fiber); level++, fiber = fiber.return) {
      if (article && fiber.stateNode === article) break;
      const props = fiber.memoizedProps;
      if (!fields(props)) continue;
      for (const media of [props, props.video, props.videoConfig, props.videoInfo, props.video_info, props.mediaEntity]) {
        if (!fields(media)) continue;
        const info = fields(media.video_info) ? media.video_info : media;
        if (!Array.isArray(info.variants)) continue;
        for (const variant of info.variants.slice(0, 32)) {
          if (!fields(variant)) continue;
          const url = variant.url ?? variant.src;
          if (typeof url !== 'string' || url.length > 16384) continue;
          const match = /^https:\/\/video\.twimg\.com\/(?:ext_tw_video|amplify_video)\/(\d+)\/(?:pu\/)?vid\/(?:avc1\/)?\d+x\d+\/[\w.-]+\.mp4(?:\?|$)/i.exec(url);
          if (match && (!posterId || posterId === match[1]) && found.size < 32) found.add(url);
        }
      }
    }
  }
  return [...found];
}

// MAIN-world return values are page-controlled. Only full progressive X media
// may become a download candidate, even if the page modifies built-in functions.
export function validatedXVariants(value: unknown) {
  const variants = [];
  if (!Array.isArray(value)) return [];
  for (const raw of value.slice(0, 32)) {
    if (typeof raw !== 'string' || raw.length > 16384) continue;
    let url: URL;
    try { url = new URL(raw); } catch { continue; }
    if (url.origin !== 'https://video.twimg.com' || url.username || url.password ||
        ['range', 'bytestart', 'byteend'].some(key => url.searchParams.has(key))) continue;
    const size = /^\/(?:ext_tw_video|amplify_video)\/\d+\/(?:pu\/)?vid\/(?:avc1\/)?\d+x(\d+)\/[\w.-]+\.mp4$/i.exec(url.pathname);
    if (size) variants.push({ url: url.href, quality: size[1] + 'p' });
  }
  return variants;
}


export const xPublicOrigin = 'https://cdn.syndication.twimg.com/*';

// Called from the popup with the optional permission for X's public embed service.
export async function publicXVariants(postId: string) {
  if (!/^\d{1,20}$/.test(postId)) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://cdn.syndication.twimg.com/tweet-result?id=' + postId + '&token=0', {
      credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal,
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json') || !response.body) return [];
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let json = '';
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 512_000) return [];
      json += decoder.decode(value, { stream: true });
    }
    const tweet = JSON.parse(json + decoder.decode());
    if (tweet?.id_str !== postId || !Array.isArray(tweet.mediaDetails)) return [];
    const urls: unknown[] = [];
    for (const media of tweet.mediaDetails.slice(0, 4)) {
      if (media?.type !== 'video' || !Array.isArray(media.video_info?.variants)) continue;
      for (const variant of media.video_info.variants.slice(0, 8)) {
        if (variant?.content_type === 'video/mp4') urls.push(variant.url);
      }
    }
    return validatedXVariants(urls);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
