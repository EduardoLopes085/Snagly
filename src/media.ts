const mediaExtensions = /\.(mp4|webm|m4a|mp3)$/i;
const nonPortable = /[<>:"/\\|?*\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/gu;
const reservedDevice = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i;

export function progressiveMedia(source: string) {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return;
  }

  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return;

  const pathName = url.pathname.split('/').pop() ?? '';
  let name: string;
  try {
    name = decodeURIComponent(pathName);
  } catch {
    return;
  }

  const extension = mediaExtensions.exec(name)?.[0].toLowerCase();
  if (!extension) return;

  let stem = name.slice(0, -extension.length)
    .replace(nonPortable, '_')
    .replace(/^[.\s]+|[.\s]+$/gu, '');
  stem = Array.from(stem).slice(0, 55).join('').replace(/[.\s]+$/gu, '');
  if (!stem || reservedDevice.test(stem)) stem = 'media';

  url.hash = '';
  return { url: url.href, host: url.host, filename: stem + extension };
}
