// TTS engine "edge": Microsoft Edge neural voices via node-edge-tts (free, no key). One engine = one file exporting
// render({ text, voice, rate, pitch, out }) → writes an mp3 at `out`. gen-shuoshu-audio.mjs picks the engine from each role's
// voice config ({ engine: 'edge', voice, rate, pitch }); to swap engines add tools/shuoshu/tts/<name>.mjs with the same export.
import { createRequire } from 'node:module';
const require = createRequire(process.env.TTS_MODULES_DIR || process.env.HOME + '/dev/openclaw/tools/tts/');
const { EdgeTTS } = require('node-edge-tts');
export async function render({ text, voice, rate, pitch, out }) {
  const tts = new EdgeTTS({ voice, lang: 'zh-CN', rate, pitch, outputFormat: 'audio-24khz-48kbitrate-mono-mp3', timeout: 30000 });
  await tts.ttsPromise(text, out);
}
export const concurrency = 6;
