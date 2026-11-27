// Same-origin navigation request to obtain the publication's server-rendered
// metadata after an SPA transition. Cookies stay with Instagram's own origin.
export async function instagramSnapshot(postId: string, pageUrl: string) {
  if (location.href !== pageUrl || location.protocol !== 'https:' ||
      !/^(?:www\.)?instagram\.com$/.test(location.hostname) ||
      !/^[\w-]{1,64}$/.test(postId)) return {status:'invalid-target',html:''};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(location.origin + '/p/' + postId + '/', {
      credentials:'same-origin', redirect:'error', cache:'no-store',
      headers:{Accept:'text/html'},
      referrerPolicy:'no-referrer', signal:controller.signal,
    });
    if (!response.ok) return {status:'http-' + response.status,html:''};
    if (!response.headers.get('content-type')?.includes('text/html') || !response.body) {
      return {status:'invalid-content',html:''};
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let size = 0;
    let html = '';
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 3_000_000) return {status:'size-limit',html:''};
      html += decoder.decode(value,{stream:true});
    }
    if (location.href !== pageUrl) return {status:'navigation-changed',html:''};
    html += decoder.decode();
    // Transfer only the inert metadata that the post parser can use.
    const metadata = (html.match(
      /<script\b[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>[\s\S]*?<\/script\s*>|<meta\b[^>]*>|<link\b[^>]*>/gi,
    ) ?? []).filter(part => {
      if (/^<script/i.test(part)) return part.includes(postId);
      if (/^<link/i.test(part)) return /\brel=["']canonical["']/i.test(part);
      return /\bproperty=["']og:(?:url|video(?::(?:type|url|secure_url))?)["']/i.test(part)
        || /\bname=["']twitter:player:stream["']/i.test(part);
    }).join('');
    return {status:metadata ? 'ok' : 'metadata-empty',html:metadata};
  } catch {
    return {status:'request-failed',html:''};
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
