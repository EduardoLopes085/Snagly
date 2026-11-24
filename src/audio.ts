import EncoderWorker from './mp3-worker?worker';

export async function convertMp3(url: string, bitrate: number, sampleRate: number, progress: (text: string) => void) {
  const response = await fetch(url, {credentials:'omit', redirect:'error', signal:AbortSignal.timeout(60000)});
  if (!response.ok || !response.body) throw new Error('O servidor não permitiu obter o áudio.');
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const {value,done} = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 64 * 1024 * 1024) throw new Error('Conversão local limitada a arquivos de 64 MB.');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const context = new AudioContext();
  let decoded: AudioBuffer;
  try {
    const input = await new Blob(chunks).arrayBuffer();
    chunks.length = 0;
    decoded = await context.decodeAudioData(input);
  }
  catch { throw new Error('O navegador não conseguiu decodificar a faixa de áudio deste vídeo.'); }
  finally { await context.close(); }
  if (decoded.duration > 600) throw new Error('Conversão local limitada a 10 minutos para controlar o uso de memória.');
  const renderer = new OfflineAudioContext(Math.min(2,decoded.numberOfChannels),Math.ceil(decoded.duration*sampleRate),sampleRate);
  const source = renderer.createBufferSource();
  source.buffer = decoded;
  source.connect(renderer.destination);
  source.start();
  const pcm = await renderer.startRendering();
  source.disconnect();
  source.buffer = null;
  const channels = Array.from({length:pcm.numberOfChannels},(_,index)=>pcm.getChannelData(index).slice());
  const worker = new EncoderWorker();
  try {
    return await new Promise<Blob>((resolve,reject) => {
      worker.onmessage = ({data}) => {
        if (data.error) reject(new Error(data.error));
        else if (data.blob) resolve(data.blob);
        else progress('Convertendo áudio… ' + data.progress + '%');
      };
      worker.onerror = () => reject(new Error('Falha no codificador MP3.'));
      worker.postMessage({channels,bitrate,sampleRate},channels.map(channel=>channel.buffer));
    });
  } finally { worker.terminate(); }
}
