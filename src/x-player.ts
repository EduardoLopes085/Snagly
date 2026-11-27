// Executed on demand in the page world, where the mounted player owns its props.
// Return only candidate URLs. The extension revalidates them in its own context.
export function mountedXVariants(postId: string | null, pageUrl: string, token?: string | null) {
  const found = new Set<string>();
  if (location.href !== pageUrl || (postId !== null && !/^\d+$/.test(postId)) ||
      !/^(?:(?:www|mobile|m)\.)?(?:x|twitter)\.com$/.test(location.hostname)) return [];
  type Fields = Record<string, unknown>;
  const fields = (v: unknown): v is Fields => typeof v === 'object' && v !== null;
  const marked = token && /^[\da-f-]{36}$/.test(token)
    ? document.querySelector<HTMLVideoElement>('video[data-snagly-selected="' + token + '"]') : null;
  if (token && !marked) return [];
  const videos = marked ? [marked] : document.querySelectorAll('video');
  for (const video of videos) {
    if (video.mediaKeys) continue;
    const article = video.closest('article');
    const link = article?.querySelector('time')?.closest('a');
    const owner = link && /\/status\/(\d+)(?:\/|$)/.exec(link.pathname)?.[1];
    if (!marked && owner !== postId) continue;
    const posterId = /\/(?:ext_tw_video_thumb|amplify_video_thumb)\/(\d+)\//.exec(video.poster)?.[1];
    let reactNode: HTMLElement = video;
    for (let level = 0; level < 5 && !Object.keys(reactNode).some(key => key.startsWith('__reactFiber$') || key.startsWith('__reactProps$')); level++) {
      const parent = reactNode.parentElement;
      if (!parent || parent === document.body || reactNode === article || parent.querySelectorAll('video').length > 1) break;
      reactNode = parent;
    }
    const fiberKey = Object.keys(reactNode).find(key => key.startsWith('__reactFiber$'));
    const propsKey = Object.keys(reactNode).find(key => key.startsWith('__reactProps$'));
    if (!fiberKey && !propsKey) continue;
    let fiber: unknown = fiberKey ? Reflect.get(reactNode, fiberKey)
      : { memoizedProps: Reflect.get(reactNode, propsKey!) };
    for (let level = 0; level < 32 && fields(fiber); level++, fiber = fiber.return) {
      if (article && fiber.stateNode === article) break;
      const initialCount = found.size;
      for (const props of [fiber.memoizedProps, fiber.pendingProps]) {
        if (!fields(props)) continue;
        const queue: {value: unknown; depth: number}[] = [{value:props,depth:0}];
        const seen = new WeakSet<object>();
        for (let index = 0; index < queue.length && index < 128; index++) {
          const {value:media,depth} = queue[index]!;
          if (!fields(media) || seen.has(media) || media.is_drm_protected === true || media.is_live_stream === true) continue;
          seen.add(media);
          if (depth < 10) {
            const keys = ['video','media','videoData','videoConfig','videoInfo','video_info','mediaEntity','tweet','legacy','extended_entities','mediaDetails'];
            if (posterId) keys.push('quoted_status_result','result','quoted_status','quoted_tweet');
            const children = Array.isArray(media) ? media.slice(0, 8) : keys.map(key => media[key]);
            for (const value of children) if (fields(value) && queue.length < 128) queue.push({value,depth:depth+1});
          }
          const info = fields(media.video_info) ? media.video_info : media;
          if (!Array.isArray(info.variants)) continue;
          for (const variant of info.variants.slice(0, 32)) {
            if (!fields(variant)) continue;
            const url = variant.url ?? variant.src;
            if (typeof url !== 'string' || url.length > 16384) continue;
            const match = /^https:\/\/video\.twimg\.com\/(?:ext_tw_video|amplify_video|dm_video)\/(\d+)\/(?:pu\/)?vid\/(?:avc1\/)?\d+x\d+\/[\w.-]+\.mp4(?:\?|$)/i.exec(url);
            if (match && (!posterId || posterId === match[1]) && found.size < 32) found.add(url);
          }
        }
      }
      if (found.size > initialCount) break;
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
    const size = /^\/(?:ext_tw_video|amplify_video|dm_video)\/\d+\/(?:pu\/)?vid\/(?:avc1\/)?\d+x(\d+)\/[\w.-]+\.mp4$/i.exec(url.pathname);
    if (size) variants.push({ url: url.href, quality: size[1] + 'p' });
  }
  return variants;
}


export const xPublicOrigin = 'https://cdn.syndication.twimg.com/*';

// Called from the popup with the optional permission for X's public embed service.
export async function publicXVariants(postId: string, mediaId?: string) {
  if (!/^\d{1,20}$/.test(postId) || (mediaId !== undefined && !/^\d{1,20}$/.test(mediaId))) return [];
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
    if (tweet?.id_str !== postId) return [];
    // Follow only explicit quote relationships, never replies or arbitrary JSON.
    // With a selected poster, its media ID must match even inside a quote.
    let current = tweet;
    for (let depth = 0; current && depth < 3; depth++, current = current.quoted_tweet) {
      if (depth && !/^\d{1,20}$/.test(current.id_str ?? '')) break;
      if (current.is_drm_protected === true || current.is_live_stream === true) break;
      const urls: unknown[] = [];
      for (const media of (Array.isArray(current.mediaDetails) ? current.mediaDetails.slice(0, 4) : [])) {
        if (media?.type !== 'video' || media.is_drm_protected === true || !Array.isArray(media.video_info?.variants)) continue;
        for (const variant of media.video_info.variants.slice(0, 8)) {
          if (variant?.content_type === 'video/mp4') urls.push(variant.url);
        }
      }
      const variants = validatedXVariants(urls).filter(variant => !mediaId ||
        new URL(variant.url).pathname.split('/')[2] === mediaId);
      if (variants.length) return variants;
      if (!mediaId && Array.isArray(current.mediaDetails) && current.mediaDetails.some(
        (media: {type?:string} | null) => media?.type === 'video' || media?.type === 'animated_gif',
      )) return [];
    }
    return [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
