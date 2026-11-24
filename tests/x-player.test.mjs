import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mountedXVariants, publicXVariants, validatedXVariants } from '../src/x-player.ts';

const href = 'https://x.com/example/status/123';
const videoUrl = 'https://video.twimg.com/ext_tw_video/456/pu/vid/640x360/clip.mp4?tag=7';

test('finds a mounted blob player without embedded JSON, excluding adjacent posts', t => {
  globalThis.location = new URL('https://x.com/home');
  function player(id, url) {
    const link = { pathname: '/example/status/' + id };
    const article = { querySelector: () => ({ closest: () => link }) };
    return {
      currentSrc: 'blob:https://x.com/local', poster: '', closest: () => article,
      __reactFiber$test: { return: { memoizedProps: { video: { variants: [{ src: url }] } } } },
    };
  }
  globalThis.document = { querySelectorAll: () => [player('123', videoUrl), player('321', videoUrl.replace('clip', 'other'))] };
  t.after(() => { delete globalThis.location; delete globalThis.document; });
  assert.deepEqual(mountedXVariants('123', location.href), [videoUrl]);
  assert.deepEqual(mountedXVariants('123', href), []);
});

test('validates player results again outside the page world', () => {
  assert.deepEqual(validatedXVariants([
    17, videoUrl.replace('twimg.com', 'twimg.com.example'), videoUrl + '&range=1', videoUrl.replace('vid/', 'segments/'), videoUrl,
  ]), [{ url: videoUrl, quality: '360p' }]);
});

test('public embed takes videos from the requested post and ignores quotes, GIFs and playlists', async t => {
  const media = { type: 'video', video_info: { variants: [
    { content_type: 'video/mp4', url: videoUrl },
    { content_type: 'application/x-mpegURL', url: videoUrl.replace('.mp4', '.m3u8') },
  ] } };
  const other = { video_info: { variants: [{ content_type: 'video/mp4', url: videoUrl.replace('clip', 'reply') }] } };
  let id = '123';
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    assert.equal(url, 'https://cdn.syndication.twimg.com/tweet-result?id=123&token=0');
    assert.equal(opts.credentials, 'omit');
    assert.equal(opts.redirect, 'error');
    assert.equal(opts.referrerPolicy, 'no-referrer');
    return Response.json({ id_str: id, mediaDetails: [media, { type: 'animated_gif', ...other }],
      quoted_tweet: { mediaDetails: [{ type: 'video', ...other }] } });
  });
  assert.deepEqual(await publicXVariants('123'), [{ url: videoUrl, quality: '360p' }]);
  id = '321';
  assert.deepEqual(await publicXVariants('123'), []);
});
