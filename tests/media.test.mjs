import assert from 'node:assert/strict';
import test from 'node:test';
import { progressiveMedia } from '../src/media.ts';

test('keeps the source query, removes the local fragment and identifies the CDN', () => {
  assert.deepEqual(progressiveMedia('https://cdn.test:8443/video.MP4?token=example#t=4'), {
    url: 'https://cdn.test:8443/video.MP4?token=example',
    host: 'cdn.test:8443',
    filename: 'video.mp4',
  });
});

test('accepts the four progressive formats', () => {
  for (const suffix of ['mp4', 'webm', 'm4a', 'mp3']) {
    assert.equal(progressiveMedia(`http://127.0.0.1/media.${suffix}`)?.filename, `media.${suffix}`);
  }
});

test('rejects ambiguous, privileged or unsupported URLs', () => {
  for (const url of [
    'file:///C:/media.mp4',
    'blob:https://site.test/media.mp4',
    'javascript:media.mp4',
    'https://user:secret@site.test/media.mp4',
    'https://site.test/master.m3u8?name=video.mp4',
    'https://site.test/%FF.mp4',
  ]) {
    assert.equal(progressiveMedia(url), undefined, url);
  }
});

test('suggests a bounded portable filename even for hostile path components', () => {
  assert.equal(progressiveMedia('https://site.test/a%2Fb%5Cc%E2%80%AE.mp4')?.filename, 'a_b_c_.mp4');
  assert.equal(progressiveMedia('https://site.test/COM%C2%B9.test.mp4')?.filename, 'media.mp4');
  assert.equal(progressiveMedia('https://site.test/%20.mp4')?.filename, 'media.mp4');
  const longName = progressiveMedia(`https://site.test/${'🎥'.repeat(300)}.mp4`)?.filename;
  assert.ok(Buffer.byteLength(longName) <= 255);
});
