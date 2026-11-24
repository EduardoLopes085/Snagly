import { Mp3Encoder } from '@breezystack/lamejs';

self.onmessage = ({data}: MessageEvent<{channels:Float32Array[];bitrate:number;sampleRate:number}>) => {
  try {
    const channels = data.channels.map(channel => Int16Array.from(channel, value => Math.round(Math.max(-1,Math.min(1,value))*32767)));
    const left = channels[0];
    if (!left) throw new Error('Missing audio');
    const encoder = new Mp3Encoder(channels.length,data.sampleRate,data.bitrate);
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    for (let offset=0;offset<left.length;offset+=1152) {
      const encoded = encoder.encodeBuffer(left.subarray(offset,offset+1152),channels[1]?.subarray(offset,offset+1152));
      if (encoded.length) chunks.push(new Uint8Array(encoded));
      if (offset % (1152*100) === 0) self.postMessage({progress:Math.round(offset/left.length*100)});
    }
    chunks.push(new Uint8Array(encoder.flush()));
    self.postMessage({blob:new Blob(chunks,{type:'audio/mpeg'})});
  } catch { self.postMessage({error:'N?o foi poss?vel codificar o áudio em MP3.'}); }
};
