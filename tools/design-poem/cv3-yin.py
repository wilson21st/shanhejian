# 吟诗 v2: the poem lines through CosyVoice3 (Fun-CosyVoice3-0.5B, Apache-2.0) instruct mode, one mood per poem, N takes per line.
# Voice prompt = tools/voice-spike/prompt_narr.wav (a stock Edge 云健 clip, so no real person is cloned).
# Writes takes to /tmp/cv3yin/<poem>-<line>-<take>.wav and a timing log; pick-cv3.mjs chooses the take (ASR + duration).
#   cd tools/voice-spike && .venv/bin/python ../design-poem/cv3-yin.py [takes=2] [poem ...]
import sys, time, resource, json, os
HERE = os.path.dirname(os.path.abspath(__file__)); VS = os.path.join(HERE, '..', 'voice-spike')
os.chdir(VS); sys.path.insert(0, 'CosyVoice'); sys.path.insert(0, 'CosyVoice/third_party/Matcha-TTS')
import torch, torchaudio
torch.set_num_threads(4)
from cosyvoice.cli.cosyvoice import AutoModel
OUT = '/tmp/cv3yin/'; os.makedirs(OUT, exist_ok=True)
LOG = os.path.join(os.environ.get('HS_WORK', '/tmp/hs-work'), 'cv3-times.jsonl'); os.makedirs(os.path.dirname(LOG), exist_ok=True)
args = sys.argv[1:]; TAKES = int(args[0]) if args and args[0].isdigit() else 2; ONLY = [a for a in args if not a.isdigit()]
# the line text as read (polyphones swapped: 还→环, 胜→升), with caesura comma and full stop
POEMS = {
  'baidi': ('请用古诗朗诵的方式，带着轻快、喜悦、如释重负的心情，舒展地吟诵这句诗。',
            ['朝辞白帝，彩云间。', '千里江陵，一日环。', '两岸猿声，啼不尽。', '轻舟已过，万重山。']),
  'chunwang': ('请用古诗朗诵的方式，带着沉痛、悲伤的心情，低沉而缓慢地吟诵这句诗。',
            ['国破，山河在。', '城春，草木深。', '感时，花溅泪。', '恨别，鸟惊心。', '烽火，连三月。', '家书，抵万金。', '白头，搔更短。', '浑欲，不升簪。']),
  'huanghelou': ('请用古诗朗诵的方式，带着惆怅、怀念、悠远的心情，缓慢地吟诵这句诗。',
            ['昔人已乘，黄鹤去。', '此地空余，黄鹤楼。', '黄鹤一去，不复返。', '白云千载，空悠悠。', '晴川历历，汉阳树。', '芳草萋萋，鹦鹉洲。', '日暮乡关，何处是？', '烟波江上，使人愁。']),
}
rss = lambda: resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e9
t0 = time.time(); m = AutoModel(model_dir='CosyVoice/pretrained_models/Fun-CosyVoice3-0.5B'); load = time.time() - t0
print(f'load {load:.1f}s peak {rss():.2f}GB', flush=True)
with open(LOG, 'a') as f: f.write(json.dumps(dict(event='load', secs=round(load, 1))) + '\n')
S, E = 'You are a helpful assistant. ', '<|endofprompt|>'
for pid, (ins, lines) in POEMS.items():
    if ONLY and pid not in ONLY: continue
    for i, text in enumerate(lines):
        for k in range(TAKES):
            dst = f'{OUT}{pid}-{i}-{k}.wav'
            if os.path.exists(dst): continue
            t = time.time()
            torch.manual_seed(1000 * i + 17 * k + len(pid))
            it = m.inference_instruct2(text, S + ins + E, 'prompt_narr.wav', stream=False)
            wav = torch.cat([j['tts_speech'] for j in it], dim=1)
            torchaudio.save(dst, wav, m.sample_rate)
            rec = dict(poem=pid, line=i, take=k, secs=round(time.time() - t, 1), audio=round(wav.shape[1] / m.sample_rate, 2), peakGB=round(rss(), 2))
            print(rec, flush=True)
            with open(LOG, 'a') as f: f.write(json.dumps(rec) + '\n')
