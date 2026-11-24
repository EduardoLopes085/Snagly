import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  closeSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync,
  renameSync, truncateSync, writeFileSync, writeSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

if (process.argv[2] === 'stage') stage(process.argv[3], process.argv[4] === 'crash');
else verify();

function stage(root, crash) {
  const journal = join(root, 'checkpoint.json');
  const partial = join(root, 'partial.ts');
  const checkpoint = JSON.parse(readFileSync(journal, 'utf8'));
  truncateSync(partial, checkpoint.offset);
  const segments = readFileSync(join(root, 'index.m3u8'), 'utf8').trim()
    .split(/\r?\n/).filter(line => /^segment-\d+\.ts$/.test(line));
  assert.ok(segments.length >= 4);
  const file = openSync(partial, 'r+');
  try {
    for (let index = checkpoint.next; index < segments.length; index++) {
      const bytes = readFileSync(join(root, segments[index]));
      if (crash && index === 2) {
        const half = bytes.subarray(0, Math.floor(bytes.length / 2));
        assert.equal(writeSync(file, half, 0, half.length, checkpoint.offset), half.length);
        fsyncSync(file);
        process.exit(42);
      }
      assert.equal(writeSync(file, bytes, 0, bytes.length, checkpoint.offset), bytes.length);
      fsyncSync(file);
      checkpoint.offset += bytes.length;
      checkpoint.next = index + 1;
      writeFileSync(journal + '.new', JSON.stringify(checkpoint), { flush: true });
      renameSync(journal + '.new', journal);
    }
  } finally {
    closeSync(file);
  }
}

function verify() {
  mkdirSync('.output', { recursive: true });
  const root = mkdtempSync(resolve('.output', 'hls-recovery-'));
  const hls = join(root, 'index.m3u8');
  execFileSync('ffmpeg', [
    '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=160x90:r=24:d=8',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=8',
    '-c:v', 'libx264', '-g', '48', '-sc_threshold', '0', '-c:a', 'aac',
    '-f', 'hls', '-hls_time', '2', '-hls_playlist_type', 'vod',
    '-hls_segment_filename', join(root, 'segment-%d.ts'), hls,
  ]);
  const init = () => {
    writeFileSync(join(root, 'partial.ts'), '');
    writeFileSync(join(root, 'checkpoint.json'), JSON.stringify({ offset: 0, next: 0 }));
  };
  const makeMp4 = output => execFileSync('ffmpeg', [
    '-v', 'error', '-i', join(root, 'partial.ts'), '-map', '0:v', '-map', '0:a',
    '-c', 'copy', '-bsf:a', 'aac_adtstoasc', '-movflags', '+frag_keyframe+delay_moov', join(root, output),
  ]);
  init();
  stage(root, false);
  makeMp4('control.mp4');
  init();
  const interrupted = spawnSync(process.execPath, [process.argv[1], 'stage', root, 'crash']);
  assert.equal(interrupted.status, 42);
  const confirmed = JSON.parse(readFileSync(join(root, 'checkpoint.json'), 'utf8'));
  assert.equal(confirmed.next, 2);
  assert.ok(readFileSync(join(root, 'partial.ts')).length > confirmed.offset);
  execFileSync(process.execPath, [process.argv[1], 'stage', root]);
  makeMp4('resumed.mp4');
  assert.ok(readFileSync(join(root, 'control.mp4')).equals(readFileSync(join(root, 'resumed.mp4'))));
  execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-i', join(root, 'resumed.mp4'), '-f', 'null', '-']);
  console.log('HLS recovery probe: process interrupted mid-write, truncated to checkpoint, remuxed after restart, output byte-identical and decodable');
}
