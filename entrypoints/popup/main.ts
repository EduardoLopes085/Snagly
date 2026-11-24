import { browser } from 'wxt/browser';
import { progressiveMedia } from '../../src/media';
import { scanSocialPost, socialPost } from '../../src/social';
import { publicFacebookPlayer } from '../../src/facebook-player';
import { mountedXVariants, publicXVariants, validatedXVariants, xPublicOrigin } from '../../src/x-player';
import { mountedInstagramVariants, validatedInstagramVariants } from '../../src/instagram-player';
import { instagramSnapshot } from '../../src/instagram-snapshot';

const list = document.querySelector<HTMLUListElement>('#media')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const refresh = document.querySelector<HTMLButtonElement>('#refresh')!;
const publicPlayer = document.querySelector<HTMLButtonElement>('#public-player')!;
const closeAfterStart = document.querySelector<HTMLInputElement>('#close-after-start')!;
const diagnostics = document.querySelector<HTMLDetailsElement>('#diagnostics')!;
const diagnosticText = document.querySelector<HTMLPreElement>('#diagnostic-text')!;
let lookupSite: 'X' | 'Facebook' | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
const rights = document.querySelector<HTMLParagraphElement>('#rights')!;
const params = new URLSearchParams(location.search);
const sourceTab = Number(params.get('tab'));
const chosenPost = params.get('post');
if (params.has('tab')) document.body.classList.add('window');
const message = browser.i18n.getMessage.bind(browser.i18n);
document.documentElement.lang = browser.i18n.getUILanguage();
refresh.textContent = message('refresh');
rights.textContent = message('rights');

// Runs once in the browser's isolated world when the popup requests a scan.
function scanDocument(preferredId?: string | null, contextToken?: string | null) {
  const direct: { url: string; owner?: string }[] = [];
  let protectedMedia = false;
  let streaming = false;
  const isX = /^(?:(?:www|mobile|m)\.)?(?:x|twitter)\.com$/.test(location.hostname);
  const visiblePosts = new Set<string>();
  const playingPosts = new Set<string>();

  const elements = document.querySelectorAll<HTMLMediaElement>('video, audio');
  for (const media of elements) {
    if (media.mediaKeys) {
      protectedMedia = true;
      continue;
    }

    let owner: string | undefined;
    if (isX && media.tagName === 'VIDEO') {
      const link = media.closest('article')?.querySelector('time')?.closest('a');
      if (link?.origin === location.origin) {
        owner = /\/status\/(\d+)(?:\/|$)/.exec(link.pathname)?.[1];
        const bounds = media.getBoundingClientRect();
        if (owner && bounds.width && bounds.height && bounds.bottom > 0 && bounds.top < innerHeight &&
            bounds.right > 0 && bounds.left < innerWidth) {
          const permalink = link.origin + link.pathname;
          visiblePosts.add(permalink);
          if (!media.paused && !media.ended) playingPosts.add(permalink);
        }
      }
    }

    const source = media.currentSrc || media.src;
    if (!source) continue;
    if (source.startsWith('blob:') || /\.(m3u8|mpd)(?:[?#]|$)/i.test(source)) {
      streaming = true;
      continue;
    }
    if (direct.length < 100 && source.length <= 16384) direct.push({ url: source, owner });
  }

  const posts = playingPosts.size ? playingPosts : visiblePosts;
  const activePost = posts.size === 1 ? [...posts][0] : undefined;
  const pageId = preferredId ?? /\/status\/(\d+)(?:\/|$)/.exec(location.pathname)?.[1];
  const selectedId = pageId ?? (activePost && /\/status\/(\d+)/.exec(activePost)?.[1]);
  const urls = direct.filter(item => !isX || (selectedId && item.owner === selectedId)).map(item => item.url);
  const posters = [...document.querySelectorAll('video[poster]')].map(video => (video as HTMLVideoElement).poster).filter(url => url.startsWith('https://'));
  let instagramPost: string | undefined;
  const instagram = /(^|\.)instagram\.com$/.test(location.hostname);
  if (instagram) {
    const marked = contextToken && /^[\da-f-]{36}$/.test(contextToken)
      ? document.querySelector('[data-snagly-context="' + contextToken + '"]') : null;
    const scopes = marked ? [marked.closest('article') ?? marked.closest('[role="dialog"]') ?? marked]
      : [...document.querySelectorAll('video')].filter(video => {
        const box = video.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0;
      }).map(video => video.closest('article') ?? video.closest('[role="dialog"]'));
    const links = new Set<string>();
    for (const scope of scopes) {
      for (const link of scope?.querySelectorAll<HTMLAnchorElement>('a[href]') ?? []) {
        if (link.origin === location.origin && /\/(?:p|reels?|tv)\/[\w-]+\//.test(link.pathname)) links.add(link.href);
      }
    }
    if (links.size === 1) instagramPost = [...links][0];
  }
  const playerInfo = [...document.querySelectorAll('video')].slice(0,8).map(video => ({
    source: (video.currentSrc || video.src).startsWith('blob:') ? 'blob' : video.currentSrc || video.src ? 'url' : 'empty',
    readyState: video.readyState,
    react: Object.keys(video).some(key => key.startsWith('__reactFiber$') || key.startsWith('__reactProps$')),
  }));
  return { pageUrl: location.href, instagramPost, playerInfo, posters, urls, protectedMedia, streaming, isX, activePost };
}

async function scan(
  checkPublicPlayer = false,
  attempt = 0,
  previousSnapshot?: { key: string; status: string },
) {
  clearTimeout(retryTimer);
  retryTimer = undefined;
  diagnostics.hidden = true;
  releasePreviews();
  list.replaceChildren();
  publicPlayer.hidden = true;
  lookupSite = undefined;
  status.textContent = message('scanning');
  refresh.disabled = true;
  try {
    const tab = params.has('tab') ? await browser.tabs.get(sourceTab) : (await browser.tabs.query({ active: true, currentWindow: true }))[0];
    if (tab?.id === undefined) throw new Error();

    const [injection] = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: scanDocument, args: [socialPost(chosenPost ?? tab.url ?? '')?.id ?? null, params.get('target')],
    });
    const result = injection?.result;
    if (!result) throw new Error();

    const pageUrl = result.pageUrl;
    const pagePost = socialPost(chosenPost ?? '') ?? socialPost(pageUrl) ?? socialPost(result.instagramPost ?? '');
    const permalink = pagePost ? tab.url : result.activePost;
    const instagram = /^https:\/\/(?:www\.)?instagram\.com\//.test(pageUrl);
    const post = pagePost ?? socialPost(permalink ?? '') ?? (instagram ? {site:'Instagram' as const,id:'video'} : undefined);
    let social: ReturnType<typeof scanSocialPost> = [];
    let snapshot = previousSnapshot;
    let snapshotStatus = snapshot?.status ?? 'not-requested';
    let mountedStatus = 'not-requested';
    if (post && !result.protectedMedia) {
      const target = { tabId: tab.id };
      const [metadata] = await browser.scripting.executeScript({
        target, func: scanSocialPost, args: [post, pageUrl],
      }).catch(() => []);
      social = metadata?.result ?? [];
      if (post.site === 'Instagram') {
        const [player] = await browser.scripting.executeScript({
          target, world:'MAIN', func:mountedInstagramVariants,
          args:[pageUrl, post.id === 'video' ? null : post.id, params.get('target')],
        }).catch(() => []);
        mountedStatus = player ? 'returned' : 'injection-failed';
        const mounted = validatedInstagramVariants(player?.result);
        if (mounted.length) social = mounted;
        const snapshotKey = pageUrl + '|' + post.id;
        if (!social.length && post.id !== 'video' && snapshot?.key !== snapshotKey) {
          const [response] = await browser.scripting.executeScript({
            target, func:instagramSnapshot, args:[post.id,pageUrl],
          }).catch(() => []);
          snapshotStatus = response?.result?.status ?? 'injection-failed';
          snapshot = {key:snapshotKey,status:snapshotStatus};
          if (response?.result?.html) {
            const [metadata] = await browser.scripting.executeScript({
              target, func:scanSocialPost, args:[post,pageUrl,response.result.html],
            }).catch(() => []);
            social = validatedInstagramVariants(metadata?.result);
          }
        }
      }
      if (post.site === 'X' && !social.length) {
        const [player] = await browser.scripting.executeScript({
          target, world: 'MAIN', func: mountedXVariants, args: [post.id, pageUrl],
        }).catch(() => []);
        social = validatedXVariants(player?.result);
        if (!social.length && !result.urls.some(url => progressiveMedia(url)) &&
            await browser.permissions.contains({ origins: [xPublicOrigin] })) {
          social = await publicXVariants(post.id);
        }
      }
      if (post.site === 'Facebook' && !social.length && checkPublicPlayer) {
        const [player] = await browser.scripting.executeScript({
          target, func: publicFacebookPlayer, args: [post.id, pageUrl],
        }).catch(() => []);
        social = player?.result ?? [];
      }
    }
    const choicesForDisplay: Choice[] = [];
    let count = 0;
    const seen = new Set<string>();
    const choices = social.length ? social : (instagram ? [] : result.urls.map(url => ({ url, quality: '' })));
    for (const { url, quality } of choices) {
      const candidate = progressiveMedia(url) ?? (post && social.length
        ? { url, filename: post.site + '-' + post.id + '.mp4', host: new URL(url).host } : undefined);
      if (!candidate || seen.has(candidate.url)) continue;
      seen.add(candidate.url);
      choicesForDisplay.push({ ...candidate, quality });
      count++;
    }

    const groups = groupChoices(choicesForDisplay);
    for (const group of groups) addDownload(group, result.posters);
    if (instagram && !count && !result.protectedMedia && attempt < 3) {
      status.textContent = message('scanning');
      retryTimer = setTimeout(() => void scan(checkPublicPlayer, attempt + 1, snapshot), [500, 1000, 2000][attempt]);
      return;
    }
    const notices = [count ? '' : message('empty')];
    if (!count && result.isX && !post) notices.push(message('openTweet'));
    if (post?.site === 'Instagram' && count) notices.push(message('instagramAudio'));
    if (result.protectedMedia) notices.push(message('protectedMedia'));
    if (result.streaming && !social.length && !instagram) notices.push(message('streaming'));
    if ((post?.site === 'Facebook' || post?.site === 'X') && !count && !result.protectedMedia) {
      lookupSite = post.site;
      publicPlayer.textContent = message(post.site === 'X' ? 'xPublicPost' : 'facebookPlayer');
      publicPlayer.hidden = checkPublicPlayer;
      if (checkPublicPlayer) notices.push(message(post.site === 'X' ? 'xPublicEmpty' : 'facebookPlayerEmpty'));
    }
    status.textContent = notices.filter(Boolean).join(' ');
    if (instagram && !count) {
      diagnostics.hidden = false;
      diagnosticText.textContent = JSON.stringify({
        version:browser.runtime.getManifest().version,
        postIdentified:post?.id !== 'video',
        clickedTarget:params.has('target'),
        attempt:attempt + 1,
        players:result.playerInfo,
        playerRead:mountedStatus,
        publicationRequest:snapshotStatus,
      },null,2);
    }
  } catch {
    status.textContent = message('unavailable');
  } finally {
    refresh.disabled = retryTimer !== undefined;
  }
}

type Choice = NonNullable<ReturnType<typeof progressiveMedia>> & { quality: string };

function releasePreviews() {
  for (const preview of list.querySelectorAll('video')) {
    preview.pause();
    preview.removeAttribute('src');
    preview.removeAttribute('poster');
    preview.load();
  }
}

window.addEventListener('pagehide', () => {
  clearTimeout(retryTimer);
  retryTimer = undefined;
  releasePreviews();
});

async function startDownload(url: string, filename: string) {
  const source = await browser.tabs.get(sourceTab).catch(() => undefined);
  if (source) {
    await browser.windows.update(source.windowId, { focused: true });
  }
  const result = await browser.runtime.sendMessage({
    type: 'snagly-download',
    url,
    filename,
  });
  if (!Number.isInteger(result?.id)) {
    throw new Error('O navegador não conseguiu iniciar o download.');
  }
  if (closeAfterStart.checked) {
    releasePreviews();
    window.close();
  }
}

// A data URL lets the native download own the MP3 independently of this window.
// No object URL or completion listener needs to keep the conversion page alive.
function audioDownloadUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Falha ao preparar o arquivo MP3.'));
    reader.readAsDataURL(blob);
  });
}

function groupChoices(choices: Choice[]) {
  const groups = new Map<string, Choice[]>();
  for (const choice of choices) {
    const url = new URL(choice.url);
    const mediaId = /\/(?:ext_tw_video|amplify_video)\/(\d+)\//.exec(url.pathname)?.[1];
    const key = mediaId ? 'x-' + mediaId : url.origin + url.pathname;
    const group = groups.get(key) ?? [];
    if (!group.some(item => item.quality === choice.quality && (choice.quality || item.url === choice.url))) group.push(choice);
    groups.set(key, group);
  }
  return [...groups.values()].map(group => group.sort((a,b) => parseInt(b.quality || '0') - parseInt(a.quality || '0')));
}

function addDownload(choices: Choice[], posters: string[]) {
  const candidate = choices[0];
  if (!candidate) return;
  const item = document.createElement('li');
  const preview = document.createElement('video');
  const mediaId = /\/(?:ext_tw_video|amplify_video)\/(\d+)\//.exec(candidate.url)?.[1];
  const poster = posters.find(url => mediaId && url.includes('/' + mediaId + '/'));
  if (poster) preview.poster = poster;
  preview.controls = true;
  preview.muted = true;
  preview.preload = 'metadata';
  preview.playsInline = true;
  preview.src = choices[choices.length - 1]!.url;
  const panel = document.createElement('div');
  panel.className = 'options';
  const title = document.createElement('h2');
  title.textContent = 'Vídeo ' + (list.children.length + 1);
  const origin = document.createElement('small');
  origin.textContent = candidate.host;
  const videoLabel = document.createElement('label');
  videoLabel.textContent = 'Vídeo · MP4';
  const resolution = document.createElement('select');
  resolution.append(new Option('Escolha a resolução para baixar', ''));
  for (const [index, choice] of choices.entries()) resolution.append(new Option(choice.quality || 'Original', String(index)));
  videoLabel.append(resolution);
  const audioLabel = document.createElement('label');
  audioLabel.textContent = 'Áudio · MP3';
  const audio = document.createElement('select');
  audio.append(new Option('Escolha a qualidade para converter', ''));
  for (const rate of [128,192,320]) {
    for (const sampleRate of [44100,48000]) {
      audio.append(new Option(rate + ' kbps · ' + (sampleRate / 1000).toLocaleString('pt-BR') + ' kHz', rate + '-' + sampleRate));
    }
  }
  audioLabel.append(audio);
  const feedback = document.createElement('p');
  feedback.className = 'feedback';
  feedback.setAttribute('role','status');
  resolution.addEventListener('change', async () => {
    if (!resolution.value) return;
    const choice = choices[Number(resolution.value)];
    if (!choice) return;
    resolution.disabled = true;
    try {
      await startDownload(choice.url, choice.filename);
      feedback.textContent = message('started');
    } catch { feedback.textContent = message('failed'); }
    finally { resolution.disabled = false; resolution.value = ''; }
  });
  audio.addEventListener('change', async () => {
    if (!audio.value) return;
    const [bitrate, sampleRate] = audio.value.split('-').map(Number);
    const origin = new URL(candidate.url).origin + '/*';
    // Keep the permission request in the select's user gesture.
    const granted = await browser.permissions.request({origins:[origin]}).catch(() => false);
    if (!granted) { feedback.textContent = 'Permita acesso ao arquivo para converter o áudio.'; audio.value = ''; return; }
    audio.disabled = true;
    resolution.disabled = true;
    refresh.disabled = true;
    releasePreviews();
    feedback.textContent = 'Convertendo áudio localmente… mantenha esta janela aberta.';
    try {
      const { convertMp3 } = await import('../../src/audio');
      const blob = await convertMp3(candidate.url, bitrate!, sampleRate!, progress => { feedback.textContent = progress; });
      await startDownload(await audioDownloadUrl(blob), candidate.filename.replace(/\.[^.]+$/,'.mp3'));
      feedback.textContent = message('started');
    } catch (error) { feedback.textContent = error instanceof Error ? error.message : 'Falha ao converter o áudio.'; }
    finally { audio.disabled = false; resolution.disabled = false; refresh.disabled = false; audio.value = ''; }
  });
  panel.append(title,origin,videoLabel,audioLabel,feedback);
  item.append(preview,panel);
  list.append(item);
}

refresh.addEventListener('click', () => void scan());
publicPlayer.addEventListener('click', async () => {
  if (lookupSite === 'X') {
    const granted = await browser.permissions.request({ origins: [xPublicOrigin] }).catch(() => false);
    if (!granted) {
      status.textContent = message('xPublicPermission');
      return;
    }
  }
  await scan(true);
});
if (params.has('tab')) {
  void scan();
} else {
  void browser.tabs.query({active:true,currentWindow:true}).then(async ([tab]) => {
    if (tab?.id === undefined) return;
    await browser.windows.create({
      url:browser.runtime.getURL('/popup.html')+'?tab='+tab.id,
      type:'popup',width:960,height:680,
    });
    window.close();
  }).catch(() => { status.textContent = message('unavailable'); });
}
