import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mountedInstagramVariants, validatedInstagramVariants } from '../src/instagram-player.ts';
import { instagramSnapshot } from '../src/instagram-snapshot.ts';

test('Instagram metadata fallback requests only the target post on the current Instagram origin', async t => {
  globalThis.location = new URL('https://www.instagram.com/direct/t/thread/');
  t.after(() => { delete globalThis.location; });
  let status = 200;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url,'https://www.instagram.com/p/Code123/');
    assert.equal(options.credentials,'same-origin');
    assert.equal(options.redirect,'error');
    assert.equal(options.cache,'no-store');
    return new Response('<meta property="og:url" content="/p/Code123/">', {
      status,headers:{'content-type':'text/html'},
    });
  });
  const snapshot = await instagramSnapshot('Code123',location.href);
  assert.equal(snapshot.status,'ok');
  assert.ok(snapshot.html.includes('Code123'));
  status = 429;
  assert.deepEqual(await instagramSnapshot('Code123',location.href),{status:'http-429',html:''});
  assert.deepEqual(await instagramSnapshot('../private',location.href),{status:'invalid-target',html:''});
  assert.deepEqual(await instagramSnapshot('Code123','https://www.instagram.com/'),{status:'invalid-target',html:''});
});

test('Instagram reads pending player props after SPA navigation without hydration JSON', t => {
  const href = 'https://www.instagram.com/reel/CurrentCode/';
  const url = 'https://scontent.cdninstagram.com/v/opaque?sig=abc';
  const media = { video_versions: [{url,height:720}] };
  const video = {
    tagName:'VIDEO', mediaKeys:null, currentSrc:'blob:https://www.instagram.com/player',
    closest:() => null, querySelector:() => null,
    getBoundingClientRect:() => ({width:300,height:180,top:0,left:0,bottom:180,right:300}),
    __reactFiber$test:{return:{pendingProps:{media}}},
  };
  globalThis.location = new URL(href);
  globalThis.innerWidth = 1000;
  globalThis.innerHeight = 800;
  globalThis.document = {body:{},querySelectorAll:() => [video]};
  t.after(() => {
    delete globalThis.location;
    delete globalThis.document;
    delete globalThis.innerWidth;
    delete globalThis.innerHeight;
  });
  assert.deepEqual(validatedInstagramVariants(mountedInstagramVariants(href,'CurrentCode')),
    [{url,quality:'720p'}]);
  media.code = 'AnotherCode';
  assert.deepEqual(validatedInstagramVariants(mountedInstagramVariants(href,'CurrentCode')),[]);
  video.mediaKeys = {};
  assert.deepEqual(mountedInstagramVariants(href,'CurrentCode'),[]);
});

test('Instagram snapshot transfers target JSON and sharing metadata while dropping scripts and unrelated records', async t => {
  globalThis.location = new URL('https://www.instagram.com/reel/Target/');
  t.after(() => { delete globalThis.location; });
  t.mock.method(globalThis,'fetch',async () => new Response(
    '<script>window.executable=true</script>'+
    '<link rel="stylesheet" href="https://example.com/style.css">'+
    '<link rel="canonical" href="https://www.instagram.com/reel/Target/">'+
    '<meta property="og:url" content="https://www.instagram.com/reel/Target/">'+
    '<script type="application/json">{"code":"Other"}</script>'+
    '<script type="application/json">{"code":"Target","video_url":"https://video.fbcdn.net/clip.mp4"}</script>',
    {headers:{'content-type':'text/html'}},
  ));
  const result=await instagramSnapshot('Target',location.href);
  assert.equal(result.status,'ok');
  assert.ok(result.html.includes('"code":"Target"'));
  assert.ok(result.html.includes('canonical'));
  assert.ok(!result.html.includes('"code":"Other"'));
  assert.ok(!result.html.includes('executable'));
  assert.ok(!result.html.includes('stylesheet'));
});

test('Instagram accepts signed opaque media URLs and rejects foreign hosts and partial streams', () => {
  const url = 'https://scontent.cdninstagram.com/v/opaque?sig=a%2Bb';
  assert.deepEqual(validatedInstagramVariants([
    {url,quality:'720p'},
    {url,quality:'720p'},
    {url:url.replace('cdninstagram.com','cdninstagram.com.evil.test')},
    {url:url+'&bytestart=0'},
    {url:'blob:https://www.instagram.com/player'},
    {url:'https://video.fbcdn.net/clip.mpd'},
    {url:'https://video.fbcdn.net/clip.mp4',quality:'<script>'},
  ]), [{url,quality:'720p'}, {url:'https://video.fbcdn.net/clip.mp4',quality:''}]);
});

test('Facebook player results keep quality labels and reject Instagram hosts and partial URLs', () => {
  assert.deepEqual(validatedInstagramVariants([
    {url:'https://video.fbcdn.net/clip.mp4',quality:'HD'},
    {url:'https://scontent.cdninstagram.com/clip.mp4',quality:'720p'},
    {url:'https://video.fbcdn.net/clip.mp4?bytestart=0',quality:'SD'},
    {url:'https://user:secret@video.fbcdn.net/clip.mp4'},
  ],'Facebook'),[{url:'https://video.fbcdn.net/clip.mp4',quality:'HD'}]);
});
