import { browser } from 'wxt/browser';
import { progressiveMedia } from '../../src/media';
import { scanSocialPost } from '../../src/social';
import { publicFacebookPlayer } from '../../src/facebook-player';
import { mountedXVariants, publicXVariants, validatedXVariants, xPublicOrigin } from '../../src/x-player';
import { mountedMetaVariants, validatedInstagramVariants } from '../../src/instagram-player';
import { instagramSnapshot } from '../../src/instagram-snapshot';
import { resolveMediaTarget } from '../../src/target';

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
const selectionToken = crypto.randomUUID();
let scanGeneration = 0;
if (params.has('tab')) document.body.classList.add('window');
const message = browser.i18n.getMessage.bind(browser.i18n);
document.documentElement.lang = browser.i18n.getUILanguage();
refresh.textContent = message('refresh');
rights.textContent = message('rights');

async function scan(
  checkPublicPlayer = false,
  attempt = 0,
  previousSnapshot?: { key: string; status: string },
) {
  const generation = ++scanGeneration;
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
      func: resolveMediaTarget, args: [chosenPost, params.get('target'), selectionToken],
    });
    const result = injection?.result;
    if (!result) throw new Error();

    if (result.ambiguous) {
      status.textContent = message('ambiguousMedia');
      return;
    }
    const pageUrl = result.pageUrl;
    const instagram = result.site === 'Instagram';
    const post = result.site ? {site:result.site,id:result.post?.id ?? 'video'} : undefined;
    const target = {tabId:tab.id};
    let social: ReturnType<typeof scanSocialPost> = [];
    let selectedPlayerSources = false;
    let snapshot = previousSnapshot;
    let snapshotStatus = snapshot?.status ?? 'not-requested';
    let mountedStatus = 'not-requested';
    if (post && !result.protectedMedia) {
      // Prefer the selected player before parsing potentially large page JSON.
      const playerTask = !result.selectionToken ? Promise.resolve([]) : post.site === 'X'
        ? browser.scripting.executeScript({
          target,world:'MAIN',func:mountedXVariants,
          args:[post.id === 'video' ? null : post.id,pageUrl,result.selectionToken],
        }).catch(() => [])
        : browser.scripting.executeScript({
          target,world:'MAIN',func:mountedMetaVariants,
          args:[pageUrl,post.id === 'video' ? null : post.id,result.selectionToken,post.site],
        }).catch(() => []);
      const [player] = await playerTask;
      mountedStatus = player ? 'returned' : 'no-player-result';
      const mounted = post.site === 'X' ? validatedXVariants(player?.result)
        : validatedInstagramVariants(player?.result,post.site);
      const direct = post.site === 'X' ? validatedXVariants(result.urls)
        : validatedInstagramVariants(result.urls.map(url => ({url})),post.site);
      social = mounted.length ? mounted : direct;
      selectedPlayerSources = mounted.length > 0 || direct.length > 0;
      if (!social.length && post.id !== 'video') {
        const [metadata] = await browser.scripting.executeScript({
          target,func:scanSocialPost,args:[post,pageUrl,null,result.selectionToken],
        }).catch(() => []);
        social = metadata?.result ?? [];
      }
      // Server-rendered metadata may contain several videos of a single tweet.
      const posterId = /\/(?:ext_tw_video_thumb|amplify_video_thumb)\/(\d+)\//.exec(result.posters[0] ?? '')?.[1];
      if (post.site === 'X' && posterId) social = social.filter(item => item.url.includes('/'+posterId+'/'));
      const snapshotKey = pageUrl + '|' + post.id;
      if (instagram && !social.length && post.id !== 'video' && snapshot?.key !== snapshotKey) {
        const [response] = await browser.scripting.executeScript({
          target,func:instagramSnapshot,args:[post.id,pageUrl],
        }).catch(() => []);
        snapshotStatus = response?.result?.status ?? 'injection-failed';
        snapshot = {key:snapshotKey,status:snapshotStatus};
        if (response?.result?.html) {
          const [metadata] = await browser.scripting.executeScript({
            target,func:scanSocialPost,args:[post,pageUrl,response.result.html,result.selectionToken],
          }).catch(() => []);
          social = validatedInstagramVariants(metadata?.result);
        }
      }
      if (post.site === 'X' && !social.length && post.id !== 'video' &&
          await browser.permissions.contains({origins:[xPublicOrigin]}) && snapshot?.key !== snapshotKey) {
        social = await publicXVariants(post.id,posterId);
        snapshot = {key:snapshotKey,status:social.length ? 'ok' : 'empty'};
        if (posterId) social = social.filter(item => item.url.includes('/'+posterId+'/'));
      }
      if (post.site === 'Facebook' && !social.length && checkPublicPlayer && post.id !== 'video' &&
          snapshot?.key !== snapshotKey) {
        const [player] = await browser.scripting.executeScript({
          target,func:publicFacebookPlayer,args:[post.id,pageUrl],
        }).catch(() => []);
        social = validatedInstagramVariants(player?.result,'Facebook')
          .map(choice => ({...choice,mediaKey:'Facebook:'+post.id}));
        snapshot = {key:snapshotKey,status:social.length ? 'ok' : 'empty'};
      }
    }
    const [current] = await browser.scripting.executeScript({
      target,
      func:(token: string | null) => {
        const player = token && document.querySelector<HTMLVideoElement>('[data-snagly-selected="' + token + '"]');
        return {pageUrl:location.href,selected:!!player,poster:player ? player.poster : ''};
      },
      args:[result.selectionToken],
    });
    if (generation !== scanGeneration) return;
    if (current?.result?.pageUrl !== pageUrl) {
      status.textContent = message('pageChanged');
      return;
    }
    if (result.selectionToken && ((!current.result.selected && !result.post) ||
        (result.posters[0] && current.result.poster && current.result.poster !== result.posters[0]))) {
      status.textContent = message('playerChanged');
      return;
    }
    const choicesForDisplay: Choice[] = [];
    let count = 0;
    const seen = new Set<string>();
    const choices: {url:string;quality:string;mediaKey?:string}[] = social.length ? social
      : (result.site ? [] : result.urls.map(url => ({ url, quality: '' })));
    for (const { url, quality, mediaKey } of choices) {
      const candidate = progressiveMedia(url) ?? (post && social.length
        ? { url, filename: post.site + '-' + post.id + '.mp4', host: new URL(url).host } : undefined);
      if (!candidate || seen.has(candidate.url)) continue;
      seen.add(candidate.url);
      choicesForDisplay.push({ ...candidate, quality, mediaKey:selectedPlayerSources ? selectionToken : mediaKey });
      count++;
    }

    const groups = groupChoices(choicesForDisplay);
    for (const group of groups) addDownload(group, result.posters);
    if (result.site && !count && !result.protectedMedia && attempt < 3) {
      status.textContent = message('scanning');
      retryTimer = setTimeout(() => void scan(checkPublicPlayer, attempt + 1, snapshot), [500, 1000, 2000][attempt]);
      return;
    }
    const notices = [count || result.protectedMedia ? '' : message('empty')];
    if (!count && result.site === 'X' && !result.post) notices.push(message('openTweet'));
    if (post?.site === 'Instagram' && count) notices.push(message('instagramAudio'));
    if (result.protectedMedia) notices.push(message('protectedMedia'));
    if (result.streaming && !social.length && !instagram) notices.push(message('streaming'));
    if ((post?.site === 'Facebook' || post?.site === 'X') && post.id !== 'video' && !count && !result.protectedMedia) {
      lookupSite = post.site;
      publicPlayer.textContent = message(post.site === 'X' ? 'xPublicPost' : 'facebookPlayer');
      publicPlayer.hidden = checkPublicPlayer;
      if (checkPublicPlayer) notices.push(message(post.site === 'X' ? 'xPublicEmpty' : 'facebookPlayerEmpty'));
    }
    status.textContent = notices.filter(Boolean).join(' ');
    if (result.site && !count) {
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
    if (generation === scanGeneration) status.textContent = message('unavailable');
  } finally {
    if (generation === scanGeneration) refresh.disabled = retryTimer !== undefined;
  }
}

type Choice = NonNullable<ReturnType<typeof progressiveMedia>> & { quality: string; mediaKey?: string };

function releasePreviews() {
  for (const preview of list.querySelectorAll('video')) {
    preview.pause();
    preview.removeAttribute('src');
    preview.removeAttribute('poster');
    preview.load();
  }
}

window.addEventListener('pagehide', () => {
  scanGeneration++;
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
    const key = choice.mediaKey ?? (mediaId ? 'x-' + mediaId : url.origin + url.pathname);
    const group = groups.get(key) ?? [];
    if (!group.some(item => item.quality === choice.quality && (choice.quality || item.url === choice.url))) group.push(choice);
    groups.set(key, group);
  }
  const rank = (quality: string) => quality === 'HD' ? 720 : quality === 'SD' ? 360 : parseInt(quality || '0');
  return [...groups.values()].map(group => group.sort((a,b) => rank(b.quality) - rank(a.quality)));
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
  preview.addEventListener('loadedmetadata', () => {
    const index = choices.findIndex(choice => choice.url === preview.src);
    const choice = choices[index];
    const option = resolution.options[index + 1];
    if (choice && option && !choice.quality && preview.videoHeight > 0) {
      choice.quality = preview.videoHeight + 'p';
      option.textContent = choice.quality;
    }
  }, {once:true});
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
