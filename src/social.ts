export type Post = { site: 'X' | 'Instagram' | 'Facebook'; id: string };

export function socialPost(href: string): Post | undefined {
  let url: URL;
  try { url = new URL(href); } catch { return; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return;
  const host = url.hostname.replace(/^(?:www|mobile|m)\./, '');
  const path = url.pathname;
  if (host === 'x.com' || host === 'twitter.com') {
    const id = /^\/(?:[\w]+|i\/web)\/status\/(\d+)(?:\/|$)/.exec(path)?.[1];
    if (id) return { site: 'X', id };
  }
  if (host === 'instagram.com') {
    const id = /^\/(?:[\w.]+\/)?(?:reel|reels|p|tv)\/([\w-]+)\/?$/.exec(path)?.[1];
    if (id) return { site: 'Instagram', id };
  }
  if (host === 'facebook.com') {
    const id = /^\/(?:reel|(?:[^/]+\/)?videos(?:\/[^/]+)?)\/(\d+)\/?$/.exec(path)?.[1]
      ?? (/^\/(?:watch\/?|video\.php)$/.test(path) ? url.searchParams.get('v') : null);
    if (id && /^\d+$/.test(id)) return { site: 'Facebook', id };
  }
}

// executeScript serializes this function. Keep its helpers inside the isolated world.
export function scanSocialPost(post: Post, pageUrl: string, html?: string | null, selectionToken?: string | null) {
  const sources = new Map<string, {quality:string;mediaKey?:string}>();
  const result = () => [...sources].map(([url, source]) => ({ url, ...source }));
  if (selectionToken && !/^[\da-f-]{36}$/.test(selectionToken)) return result();
  const players = selectionToken && /^[\da-f-]{36}$/.test(selectionToken)
    ? document.querySelectorAll('[data-snagly-selected="' + selectionToken + '"]')
    : document.querySelectorAll('video,audio');
  if (location.href !== pageUrl || [...players].some(
    el => (el as HTMLMediaElement).mediaKeys,
  )) return result();
  if (html && (post.site !== 'Instagram' || html.length > 3_000_000)) return result();
  const root = html ? new DOMParser().parseFromString(
    (html.match(/<script\b[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>[\s\S]*?<\/script\s*>|<meta\b[^>]*>|<link\b[^>]*>/gi) ?? []).join(''),
    'text/html',
  ) : document;

  function add(value: unknown, quality = '', mediaKey?: string) {
    if (typeof value !== 'string' || value.length > 16384 || sources.size >= 60) return;
    let url: URL;
    try { url = new URL(value); } catch { return; }
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return;
    const host = url.hostname;
    const allowed = post.site === 'X' ? host === 'video.twimg.com'
      : /(?:^|\.)fbcdn\.net$/.test(host) || (post.site === 'Instagram' && /(?:^|\.)cdninstagram\.com$/.test(host));
    const name = url.pathname.split('/').pop() ?? '';
    if (!allowed || !name || (name.includes('.') && !/\.mp4$/i.test(name))) return;
    if (['bytestart', 'byteend', 'range'].some(key => url.searchParams.has(key))) return;
    url.hash = '';
    const previous = sources.get(url.href);
    if (!previous || quality) {
      const identity = mediaKey ?? previous?.mediaKey;
      sources.set(url.href, {quality,...(identity && {mediaKey:identity})});
    }
  }

  type Fields = Record<string, unknown>;
  const object = (v: unknown): v is Fields => typeof v === 'object' && v !== null;
  const list = (v: unknown): Fields[] => Array.isArray(v) ? v.slice(0, 100).filter(object) : [];
  const height = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 16384 ? v + 'p' : '';
  function readInstagram(media: Fields, fallback: string) {
    if (media.is_drm_protected === true || media.is_live_stream === true) return;
    const id = media.pk ?? media.id;
    const identity = typeof id === 'string' || typeof id === 'number' ? String(id).slice(0,128) : fallback;
    const mediaKey = 'Instagram:' + post.id + ':' + identity;
    for (const version of list(media.video_versions)) add(version.url, height(version.height), mediaKey);
    add(media.video_url, '', mediaKey);
  }
  const selectedMediaId = post.site === 'X' && selectionToken
    ? /\/(?:ext_tw_video_thumb|amplify_video_thumb)\/(\d+)\//.exec(
      (players[0] as HTMLVideoElement | undefined)?.poster ?? '',
    )?.[1] : undefined;
  function readObject(node: Fields) {
    if (post.site === 'X') {
      const target = node.rest_id === post.id || node.id_str === post.id;
      if (!target && !selectedMediaId) return;
      const tweet = object(node.legacy) ? node.legacy : node;
      if (tweet.is_drm_protected === true || tweet.is_live_stream === true) return;
      const entities = tweet.extended_entities;
      if (object(entities)) for (const media of list(entities.media)) {
        if (media.is_drm_protected === true || media.is_live_stream === true || !object(media.video_info)) continue;
        for (const variant of list(media.video_info.variants)) {
          if (variant.content_type !== 'video/mp4' || typeof variant.url !== 'string') continue;
          const identity = /^https:\/\/video\.twimg\.com\/(?:ext_tw_video|amplify_video|dm_video)\/(\d+)\//.exec(variant.url)?.[1];
          if (selectedMediaId && identity !== selectedMediaId) continue;
          const size = /\/(\d{1,5})x(\d{1,5})\//.exec(variant.url);
          add(variant.url, height(Number(size?.[2])));
        }
      }
    }
    if (post.site === 'Instagram' && (node.shortcode === post.id || node.code === post.id)) {
      readInstagram(node, 'main');
      for (const [index,child] of list(node.carousel_media).entries()) readInstagram(child, 'carousel-' + index);
      if (object(node.edge_sidecar_to_children)) for (const [index,edge] of list(node.edge_sidecar_to_children.edges).entries()) {
        if (object(edge.node)) readInstagram(edge.node, 'edge-' + index);
      }
    }
    if (post.site === 'Facebook' && (node.id === post.id || node.video_id === post.id)) {
      const legacy = object(node.videoDeliveryLegacyFields) ? node.videoDeliveryLegacyFields : node;
      if (legacy.is_drm_protected === true || legacy.is_live_stream === true) return;
      const mediaKey = 'Facebook:' + post.id;
      add(legacy.browser_native_hd_url ?? legacy.playable_url_quality_hd, 'HD',mediaKey);
      add(legacy.browser_native_sd_url ?? legacy.playable_url, 'SD',mediaKey);
      const fragment = node.videoDeliveryResponseFragment;
      if (object(fragment) && object(fragment.videoDeliveryResponseResult)) {
        for (const format of list(fragment.videoDeliveryResponseResult.progressive_urls)) add(format.progressive_url,'',mediaKey);
      }
    }
  }

  // Bound parsing time on long feeds. Inspect inert JSON, never executable script text.
  let remaining = 3_000_000;
  let visited = 0;
  function walk(v: unknown, depth: number) {
    if (++visited > 35000 || depth > 64 || !object(v)) return;
    if (v.is_drm_protected === true || v.is_live_stream === true) return;
    readObject(v);
    for (const key in v) {
      if (visited >= 35000) break;
      walk(v[key], depth + 1);
    }
  }
  for (const script of root.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]')) {
    const raw = script.firstChild?.nodeValue;
    if (!raw || raw.length > remaining || raw.length > 1_500_000) continue;
    remaining -= raw.length;
    if (!raw.includes(post.id) && !(selectedMediaId && raw.includes(selectedMediaId))) continue;
    let root: unknown;
    try { root = JSON.parse(raw); } catch { continue; }
    walk(root, 0);
    if (visited >= 35000) break;
  }

  const canonical = root.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content
    || root.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  let canonicalMatches = false;
  if (canonical) {
    try {
      const path = new URL(canonical, location.href);
      const current = new URL(pageUrl);
      const parts = path.pathname.split('/').filter(Boolean);
      const canonicalId = post.site === 'X' ? parts[parts.indexOf('status') + 1]
        : (post.site === 'Facebook' && path.searchParams.get('v')) || parts.at(-1);
      canonicalMatches = path.origin === current.origin && canonicalId === post.id;
      if (canonicalMatches) {
        const mp4 = root.querySelector<HTMLMetaElement>('meta[property="og:video:type"]')?.content === 'video/mp4';
        for (const tag of root.querySelectorAll<HTMLMetaElement>('meta[property="og:video"],meta[property="og:video:url"],meta[property="og:video:secure_url"],meta[name="twitter:player:stream"]')) {
          if (mp4 || /\.mp4(?:[?#]|$)/i.test(tag.content)) add(tag.content);
        }
      }
    } catch { /* Malformed page metadata. */ }
  }

  // A blob player on X may have fetched a full MP4. Match the poster's media ID
  // to the current post before considering resource timing entries.
  if (post.site === 'X') {
    const ids = new Set<string>();
    const videos = document.querySelectorAll<HTMLVideoElement>('video');
    for (const video of videos) {
      if (selectionToken && !video.matches('[data-snagly-selected="' + selectionToken + '"]')) continue;
      const article = video.closest('article');
      const timestamp = article?.querySelector('time')?.closest('a');
      if (!selectedMediaId && (article ? timestamp?.pathname.split('/status/')[1]?.split('/')[0] !== post.id
        : !(canonicalMatches && videos.length === 1 && !document.querySelector('article')))) continue;
      const id = /\/(?:ext_tw_video_thumb|amplify_video_thumb)\/(\d+)\//.exec(video.poster)?.[1];
      if (id) ids.add(id);
    }
    if (ids.size) for (const resource of performance.getEntriesByType('resource')) {
      const match = /^https:\/\/video\.twimg\.com\/(?:ext_tw_video|amplify_video)\/(\d+)\/(?:pu\/)?vid\/(?:avc1\/)?\d+x(\d+)\/[^/?#]+\.mp4(?:[?#]|$)/i.exec(resource.name);
      if (match?.[1] && ids.has(match[1])) add(resource.name, height(Number(match[2])));
    }
    // Server-rendered X posts may expose MP4 variants as literals in hydration
    // data. Match only full media URLs associated with the visible poster.
    let budget = 2_000_000;
    if (ids.size) for (const script of document.querySelectorAll('script[data-tsr-stream-part]')) {
      const text = script.firstChild?.nodeValue;
      if (!text || text.length > budget) continue;
      budget -= text.length;
      const urls = text.matchAll(/https:\/\/video\.twimg\.com\/(?:ext_tw_video|amplify_video)\/(\d+)\/(?:pu\/)?vid\/(?:avc1\/)?\d+x(\d+)\/[\w.-]+\.mp4(?:\?[^\s"'\\<>]*)?/g);
      for (const match of urls) {
        if (match[1] && ids.has(match[1])) add(match[0], height(Number(match[2])));
      }
    }
  }
  return result();
}
