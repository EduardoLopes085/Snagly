// Serialized into MAIN on demand. Inspect the clicked player, never the whole
// React application. Returned values are validated again by the extension.
export function mountedMetaVariants(
  pageUrl: string,
  postId?: string | null,
  token?: string | null,
  site: 'Instagram' | 'Facebook' = 'Instagram',
) {
  const platformHost = site === 'Instagram' ? 'instagram.com' : 'facebook.com';
  if (location.href !== pageUrl || location.hostname.replace(/^(?:www|m|mobile)\./, '') !== platformHost) return [];
  const shortcode = (href: string) => site === 'Instagram'
    ? /\/(?:p|reels?|tv)\/([\w-]+)(?:\/|$)/.exec(href)?.[1]
    : /\/(?:reel|(?:[^/]+\/)?videos(?:\/[^/]+)?)\/(\d+)(?:\/|$)/.exec(href)?.[1]
      ?? (/[?&]v=(\d+)/.exec(href)?.[1]);
  const marked = token && /^[\da-f-]{36}$/.test(token)
    ? document.querySelector<HTMLElement>('[data-snagly-selected="' + token + '"]')
      ?? document.querySelector<HTMLElement>('[data-snagly-context="' + token + '"]') : null;
  if (token && !marked) return [];
  const videos = [...document.querySelectorAll('video')];
  let selected: HTMLElement | undefined = marked ?? undefined;
  if (!selected && postId) {
    selected = videos.find(video => [...(video.closest('article')?.querySelectorAll<HTMLAnchorElement>('a[href]') ?? [])]
      .some(link => shortcode(link.pathname) === postId));
  }
  if (!selected) {
    const dialogVideos = videos.filter(video => video.closest('[role="dialog"]'));
    const visible = (dialogVideos.length ? dialogVideos : videos).filter(video => {
      const box = video.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight &&
        box.right > 0 && box.left < innerWidth;
    });
    const playing = visible.filter(video => !video.paused && !video.ended);
    const candidates = playing.length ? playing : visible;
    if (candidates.length === 1) selected = candidates[0];
  }
  if (!selected) return [];
  const sharedLink = selected.closest<HTMLAnchorElement>('a[href]');
  const linkOnly = !!sharedLink && !!shortcode(sharedLink.pathname) && !sharedLink.querySelector('video');
  let container = selected;
  // Controls and overlays often receive the right click instead of the video.
  for (let level = 0; !linkOnly && level < 6 && !container.querySelector('video') &&
      container.tagName !== 'VIDEO' && container.parentElement; level++) {
    if (container.matches('article,[role="dialog"]')) break;
    container = container.parentElement;
  }
  const scopedVideos = container.tagName === 'VIDEO' ? [container as HTMLVideoElement]
    : [...container.querySelectorAll('video')];
  if (scopedVideos.some(video => video.mediaKeys)) return [];
  const variants: {url:string;quality:string}[] = [];
  const add = (url: unknown, height?: unknown) => {
    if (typeof url !== 'string' || url.length > 16384 || variants.length >= 32) return;
    let parsed: URL;
    try { parsed = new URL(url); } catch { return; }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port ||
        !/(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(parsed.hostname) ||
        (site === 'Facebook' && !/(^|\.)fbcdn\.net$/.test(parsed.hostname)) ||
        /\.(?:m3u8|mpd|m4s|ts|jpg|jpeg|png|webp)$/i.test(parsed.pathname) ||
        ['bytestart','byteend','range'].some(key => parsed.searchParams.has(key))) return;
    const quality = typeof height === 'number' && height > 0 && height <= 16384 ? height + 'p'
      : height === 'HD' || height === 'SD' ? height : '';
    variants.push({url, quality});
  };
  // Direct URLs are associated only with this selected player.
  for (const video of scopedVideos) add(video.currentSrc || video.src, video.videoHeight);
  type Fields = Record<string, unknown>;
  const object = (value: unknown): value is Fields => typeof value === 'object' && value !== null;
  let visited = 0;
  const seen = [new WeakSet<object>(), new WeakSet<object>()];
  const walk = (value: unknown, depth: number, matched: boolean) => {
    if (++visited > 6000 || depth > 12 || !object(value)) return;
    if (value.is_drm_protected === true || value.is_live_stream === true) return;
    const code = site === 'Instagram' ? value.code ?? value.shortcode : value.video_id;
    if (typeof code === 'string') {
      if (postId && code !== postId) return;
      matched = true;
    }
    const visitedObjects = seen[matched ? 1 : 0]!;
    if (visitedObjects.has(value)) return;
    visitedObjects.add(value);
    if (matched) {
      add(value.video_url);
      add(value.videoUrl);
      add(value.progressive_url);
      add(value.browser_native_hd_url, 'HD');
      add(value.browser_native_sd_url, 'SD');
      add(value.playable_url, 'SD');
      add(value.playable_url_quality_hd, 'HD');
      add(value.hd_src, 'HD');
      add(value.sd_src, 'SD');
      if (value.content_type === 'video/mp4' || value.mimeType === 'video/mp4') add(value.src ?? value.url);
      if (Array.isArray(value.video_versions)) {
        for (const version of value.video_versions.slice(0, 16)) {
          if (object(version)) add(version.url, version.height);
        }
      }
    }
    for (const key of Object.keys(value).slice(0, 100)) {
      if (['children','ref','owner','_owner','return','stateNode','carousel_media','edge_sidecar_to_children'].includes(key)) continue;
      walk(value[key], depth + 1, matched);
    }
  };
  const roots = scopedVideos.length ? scopedVideos : [selected];
  const boundary = selected.closest('[role="row"],article,[role="article"]') ?? selected.closest('[role="dialog"]');
  const selectedPlayer = scopedVideos.length === 1 && (
    !!marked || !postId || shortcode(location.pathname + location.search) === postId ||
    !!scopedVideos[0]?.closest('article')?.querySelector('a[href*="/' + postId + '/"]')
  );
  for (const root of roots) {
    let reactNode = root;
    for (let level = 0; level < 5; level++) {
      if (Object.keys(reactNode).some(key => key.startsWith('__reactProps$') || key.startsWith('__reactFiber$'))) break;
      const parent = reactNode.parentElement;
      if (!parent || parent === document.body || reactNode === boundary || parent.querySelectorAll('video').length > 1) break;
      reactNode = parent;
    }
    const initialCount = variants.length;
    const propsKey = Object.keys(reactNode).find(key => key.startsWith('__reactProps$'));
    if (propsKey) walk(Reflect.get(reactNode, propsKey), 0, selectedPlayer);
    if (variants.length > initialCount) continue;
    const key = Object.keys(reactNode).find(key => key.startsWith('__reactFiber$'));
    if (!key) continue;
    let fiber: unknown = Reflect.get(reactNode, key);
    for (let level = 0; level < 24 && object(fiber) && visited <= 6000; level++, fiber = fiber.return) {
      if (fiber.stateNode === document.body) break;
      const node = fiber.stateNode;
      if (node && node instanceof HTMLElement && node !== root && node.querySelectorAll('video').length > 1) break;
      const previousCount = variants.length;
      walk(fiber.memoizedProps, 0, selectedPlayer);
      walk(fiber.pendingProps, 0, selectedPlayer);
      if (variants.length > previousCount) break;
      if (fiber.stateNode === boundary) break;
    }
  }
  return variants;
}

export function validatedInstagramVariants(value: unknown, site: 'Instagram' | 'Facebook' = 'Instagram') {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: {url:string;quality:string;mediaKey?:string}[] = [];
  for (const item of value.slice(0,32)) {
    if (!item || typeof item.url !== 'string' || item.url.length > 16384) continue;
    let url: URL;
    try { url = new URL(item.url); } catch { continue; }
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !/(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(url.hostname) ||
        (site === 'Facebook' && !/(^|\.)fbcdn\.net$/.test(url.hostname)) ||
        /\.(?:m3u8|mpd|m4s|ts|jpg|jpeg|png|webp)(?:$|\/)/i.test(url.pathname) ||
        ['bytestart','byteend','range'].some(key => url.searchParams.has(key))) continue;
    url.hash = '';
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    const mediaKey = typeof item.mediaKey === 'string' && /^(?:Instagram|Facebook):[\w:./-]{1,200}$/.test(item.mediaKey) ? item.mediaKey : undefined;
    result.push({
      url:url.href,
      quality:typeof item.quality === 'string' && /^(?:\d{1,5}p|HD|SD)$/.test(item.quality) ? item.quality : '',
      ...(mediaKey && {mediaKey}),
    });
  }
  return result;
}

export { mountedMetaVariants as mountedInstagramVariants };
