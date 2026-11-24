// Executed on demand in Facebook's tab. The popup supplies the current post ID.
export async function publicFacebookPlayer(id: string, pageUrl: string) {
  if (!/^\d+$/.test(id) || location.href !== pageUrl || location.protocol !== 'https:'
    || !/^(?:(?:www|m|mobile)\.)?facebook\.com$/.test(location.hostname)) return [];
  const endpoint = new URL('/plugins/video.php', location.origin);
  endpoint.searchParams.set('href', 'https://www.facebook.com/watch/?v=' + id);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const sources: { url: string; quality: string }[] = [];
  try {
    const response = await fetch(endpoint, {
      credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
      mode: 'same-origin', cache: 'no-store', signal: controller.signal,
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html') || !response.body) return [];
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = '';
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_500_000) return [];
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
    if (location.href !== pageUrl) return [];

    // Read just the JSON object passed to the public player's VideoConfig.
    // Delimit nested objects, accounting for quoted braces and escaped quotes.
    const marker = /\[\s*"VideoConfig"\s*\]\s*,\s*\[\s*(?=\{)/g;
    while (marker.exec(html)) {
      const start = marker.lastIndex;
      let depth = 0;
      let quoted = false;
      let end = start;
      for (; end < html.length; end++) {
        const ch = html[end];
        if (quoted && ch === '\\') { end++; continue; }
        if (ch === '"') quoted = !quoted;
        if (quoted) continue;
        if (ch === '{') depth++;
        if (ch === '}' && --depth === 0) break;
      }
      marker.lastIndex = end + 1;
      let config;
      try { config = JSON.parse(html.slice(start, end + 1)); } catch { continue; }
      if (config?.video_id !== id || !Array.isArray(config.videoData)) continue;
      for (const media of config.videoData.slice(0, 16)) {
        if (media?.video_id !== id || media.is_live_stream || media.is_hls || media.is_drm_protected) continue;
        for (const [quality, value] of [['HD', media.hd_src], ['SD', media.sd_src]] as const) {
          if (typeof value !== 'string' || value.length > 16384) continue;
          let url: URL;
          try { url = new URL(value); } catch { continue; }
          if (url.protocol === 'https:' && !url.username && !url.password && !url.port &&
            /(?:^|\.)fbcdn\.net$/.test(url.hostname) && /\.mp4$/i.test(url.pathname) &&
            !['bytestart', 'byteend', 'range'].some(key => url.searchParams.has(key))) {
            sources.push({ quality, url: url.href });
            if (sources.length === 60) return sources;
          }
        }
      }
    }
    return sources;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
