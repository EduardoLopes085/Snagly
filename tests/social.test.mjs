import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scanSocialPost, socialPost } from '../src/social.ts';
import { publicFacebookPlayer } from '../src/facebook-player.ts';

function scan(t, href, { data = [], canonical, metas = [], poster, stream, protectedMedia = false }) {
  const video = { mediaKeys: protectedMedia ? {} : null, poster, closest: () => null };
  const elements = new Map([
    ['video,audio', [video]], ['video', poster ? [video] : []],
    ['script[type="application/json"],script[type="application/ld+json"]', data.map(v => ({ firstChild: { nodeValue: JSON.stringify(v) } }))],
    ['script[data-tsr-stream-part]', stream ? [{ firstChild: { nodeValue: stream } }] : []],
  ]);
  t.after(() => { delete globalThis.document; delete globalThis.location; });
  globalThis.location = { href };
  globalThis.document = {
    querySelectorAll: sel => elements.get(sel) ?? (sel.startsWith('meta') ? metas.map(content => ({ content })) : []),
    querySelector: sel => sel.includes('og:url') ? { content: canonical } : sel.includes('og:video:type') ? { content: 'video/mp4' } : null,
  };
  return scanSocialPost(socialPost(href), href);
}

test('routes recognized post permalinks, including legacy and mobile links', () => {
  for (const [url, expected] of [
    ['https://twitter.com/a/status/123/video/1', { site: 'X', id: '123' }],
    ['https://x.com/i/web/status/123', { site: 'X', id: '123' }],
    ['https://www.instagram.com/owner/reel/A-b_1/', { site: 'Instagram', id: 'A-b_1' }],
    ['https://m.facebook.com/watch/?v=123', { site: 'Facebook', id: '123' }],
    ['https://www.facebook.com/user/videos/title/123/', { site: 'Facebook', id: '123' }],
    ['https://www.facebook.com/reel/123', { site: 'Facebook', id: '123' }],
    ['https://x.com.evil.test/user/status/123', undefined],
    ['https://www.instagram.com/explore/', undefined],
  ]) assert.deepEqual(socialPost(url), expected);
});

test('X selects MP4 variants from the target tweet', t => {
  const url = 'https://video.twimg.com/ext_tw_video/50/pu/vid/1280x720/ab.mp4?tag=1';
  const tweet = (id, variants) => ({ rest_id: id, legacy: { extended_entities: { media: [{ video_info: { variants } }] } } });
  assert.deepEqual(scan(t, 'https://x.com/demo/status/123', { data: [
    tweet('123', [{ content_type: 'video/mp4', url }, { content_type: 'application/x-mpegURL', url: url + '.m3u8' }]),
    tweet('234', [{ content_type: 'video/mp4', url: url.replace('ab.mp4', 'other.mp4') }]),
  ] }), [{ url, quality: '720p' }]);
});

test('Instagram aliases and tracking parameters preserve the public post identity', () => {
  for (const path of [
    '/reel/Sample_123/?gwpx=opaque',
    '/reel/Sample_123/?dmpr=opaque',
    '/reels/Sample_123/',
    '/p/Sample_123/',
    '/reel/Sample_123/?evlk=opaque',
  ]) {
    assert.deepEqual(socialPost('https://www.instagram.com'+path),{site:'Instagram',id:'Sample_123'});
  }
});

test('Instagram deduplicates repeated progressive URLs without inventing a resolution', t => {
  const url='https://scontent.cdninstagram.com/clip.mp4?sig=test';
  const variants=[101,102,103].map(type=>({type,url}));
  assert.deepEqual(scan(t,'https://www.instagram.com/reel/Sample/',{
    data:[{__typename:'XIGMedia',pk:'42',code:'Sample',original_height:576,video_versions:variants}],
  }),[{url,quality:'',mediaKey:'Instagram:Sample:42'}]);
});

test('Instagram ignores protected carousel records while preserving other items', t => {
  const url='https://scontent.cdninstagram.com/allowed.mp4';
  assert.deepEqual(scan(t,'https://www.instagram.com/p/Sample/',{
    data:[{code:'Sample',carousel_media:[
      {pk:'blocked',is_drm_protected:true,video_url:'https://scontent.cdninstagram.com/blocked.mp4'},
      {pk:'allowed',video_url:url},
    ]}],
  }),[{url,quality:'',mediaKey:'Instagram:Sample:allowed'}]);
});

test('X associates server-rendered MP4 variants with the poster on the post', t => {
  const href = 'https://x.com/demo/status/123';
  const url = 'https://video.twimg.com/ext_tw_video/456/pu/vid/640x360/abc.mp4';
  assert.deepEqual(scan(t, href, { canonical: href, poster: 'https://pbs.twimg.com/ext_tw_video_thumb/456/img/a.jpg',
    stream: JSON.stringify([url, url.replace('/456/', '/123/')]),
  }), [{ url, quality: '360p' }]);
});

test('Instagram recognizes canonical reel aliases, signed sources and carousel videos', t => {
  const url = 'https://scontent.cdninstagram.com/v/opaque?sig=a%2Bb';
  const other = 'https://scontent.fbcdn.net/v/clip.mp4';
  assert.deepEqual(scan(t, 'https://www.instagram.com/p/Code123/', {
    canonical: 'https://www.instagram.com/demo/reel/Code123/',
    data: [{ code: 'Code123', carousel_media: [{ video_versions: [{ height: 1080, url }] }] }],
    metas: [url, other, url.replace('cdninstagram.com', 'cdninstagram.com.evil.test')],
  }), [{ url, quality: '1080p', mediaKey:'Instagram:Code123:carousel-0' }, { url: other, quality: '' }]);
});

test('Facebook finds direct and nested delivery records while ignoring ranges and unrelated items', t => {
  const url = 'https://video.fbcdn.net/clip.mp4';
  assert.deepEqual(scan(t, 'https://www.facebook.com/watch/?v=123', { data: [
    { id: '123', videoDeliveryLegacyFields: { browser_native_hd_url: url, browser_native_sd_url: url + '?bytestart=0' } },
    { id: '123', videoDeliveryResponseFragment: { videoDeliveryResponseResult: { progressive_urls: [{ progressive_url: url + '?q=2' }] } } },
    { id: '124', playable_url: url + '?v=124' },
  ] }), [{ url, quality: 'HD', mediaKey:'Facebook:123' }, { url: url + '?q=2', quality: '',mediaKey:'Facebook:123' }]);
});

test('protected players suppress supplemental metadata', t => {
  const href = 'https://www.facebook.com/reel/123';
  assert.deepEqual(scan(t, href, { protectedMedia: true, canonical: href, metas: ['https://video.fbcdn.net/clip.mp4'] }), []);
});

test('Facebook public player sends only the ID and accepts matching progressive records', async t => {
  const page = 'https://www.facebook.com/reel/123/?tracking=private';
  globalThis.location = new URL(page);
  t.after(() => { delete globalThis.location; });
  const good = 'https://video.fbcdn.net/file.mp4?tag=hd';
  const config = { video_id: '123', title: 'A } and " in a string', videoData: [
    { video_id: '123', hd_src: 'invalid URL' },
    { video_id: '123', hd_src: good, sd_src: 'https://video.fbcdn.net.evil.test/file.mp4' },
    { video_id: '124', sd_src: good + 'other' },
    { video_id: '123', is_live_stream: true, sd_src: good + 'live' },
  ] };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.origin + url.pathname, 'https://www.facebook.com/plugins/video.php');
    assert.equal(url.searchParams.get('href'), 'https://www.facebook.com/watch/?v=123');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    return new Response('["VideoConfig"],[' + JSON.stringify(config) + ']', { headers: { 'Content-Type': 'text/html' } });
  });
  assert.deepEqual(await publicFacebookPlayer('123', page), [{ url: good, quality: 'HD' }]);
});
