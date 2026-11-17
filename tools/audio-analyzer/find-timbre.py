#!/usr/bin/env python3
"""Search the original mix using human reference regions; never edit annotations.

Similarity and HPSS are not instrument recognition or isolated instrument stems.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import json
import platform
from pathlib import Path

import librosa
import numpy as np
import scipy
import soundfile as sf
from scipy.ndimage import uniform_filter1d
from scipy.signal import find_peaks

ROOT = Path(__file__).resolve().parents[2]


def unit(x):
    return x / np.maximum(np.linalg.norm(x, axis=0, keepdims=True), 1e-8)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='local/analysis/timbre-v1')
    args = parser.parse_args()
    output = (ROOT / args.output).resolve()
    if not output.is_relative_to(ROOT / 'local/analysis') or output.exists():
        parser.error('Output must be a new directory inside local/analysis')
    annotation = ROOT / 'annotations/try-me.timeline.json'
    raw = annotation.read_bytes()
    project = json.loads(raw)

    def tracks(nodes):
        for node in nodes:
            if node['kind'] == 'timeline':
                yield node
            else:
                yield from tracks(node.get('children', []))

    track = next(t for t in tracks(project['nodes']) if t['id'] == 'trk_01')
    refs = [e for e in track['items'] if e['id'] in ('E001', 'E002')]
    if len(refs) != 2 or any(e['endSec'] <= e['startSec'] for e in refs):
        parser.error('Expected two positive reference regions E001 and E002')
    audio = (ROOT / project['audio']).resolve()
    if not audio.is_relative_to(ROOT / 'public/private'):
        parser.error('Expected private local audio')
    info = sf.info(audio)
    print('Loading original audio; calculating mix and HPSS features', flush=True)
    sr, hop, n_fft = 22050, 441, 2048
    y, _ = librosa.load(audio, sr=sr, mono=True)
    magnitude = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=hop))
    harmonic, _ = librosa.decompose.hpss(magnitude, margin=2)
    banks = {}
    for name, spec in [('mix', magnitude), ('harmonic', harmonic)]:
        mel = librosa.feature.melspectrogram(S=spec**2, sr=sr, n_fft=n_fft,
                                            n_mels=64, fmin=180, fmax=8000)
        logmel = librosa.power_to_db(mel, ref=np.max)
        # Remove overall level. Whitening downweights ubiquitous accompaniment.
        logmel -= logmel.mean(axis=0, keepdims=True)
        mfcc = librosa.feature.mfcc(S=logmel, n_mfcc=16)[1:]
        for label, values in [('mel', logmel), ('mfcc', mfcc)]:
            mean = np.median(values, axis=1, keepdims=True)
            scale = np.maximum(np.std(values, axis=1, keepdims=True), 1)
            banks[f'{name}_{label}'] = (values - mean) / scale
    times = librosa.frames_to_time(np.arange(magnitude.shape[1]), sr=sr, hop_length=hop)
    scores = []
    details = []
    curves = {}
    for ref in refs:
        duration = ref['endSec'] - ref['startSec']
        width = max(1, round(duration * sr / hop))
        inside = (times >= ref['startSec']) & (times < ref['endSec'])
        nearby = (times >= ref['startSec'] - 3) & (times < ref['endSec'] + 3)
        for other in refs:
            nearby &= ~((times >= other['startSec'] - .15) & (times <= other['endSec'] + .15))
        per_bank = []
        for name, values in banks.items():
            pooled = uniform_filter1d(values, width, axis=1, mode='nearest')
            query = values[:, inside].mean(axis=1)
            cosine = unit(query[:, None]).T @ unit(pooled)
            # Contrast against nearby non-reference frames to reduce background matches.
            direction = query - values[:, nearby].mean(axis=1)
            contrast = unit(direction[:, None]).T @ unit(pooled)
            def percentile(curve):
                return np.searchsorted(np.sort(curve.ravel()), curve.ravel()) / curve.size
            curve = .75 * percentile(cosine) + .25 * percentile(contrast)
            per_bank.append(curve)
            curves[f"{ref['id']}_{name}"] = curve
        score = np.mean(per_bank, axis=0)
        scores.append(score)
        other = next(r for r in refs if r['id'] != ref['id'])
        mask = (times >= other['startSec']) & (times <= other['endSec'])
        details.append({'query': ref['id'], 'other_reference': other['id'],
                        'best_other_reference_score': float(score[mask].max()),
                        'fraction_of_all_windows_scoring_higher': float(np.mean(score > score[mask].max())),
                        'best_other_reference_time': float(times[np.flatnonzero(mask)[np.argmax(score[mask])]])})
    # Max pools queries to allow either articulation; preserve both scores for inspection.
    combined = np.max(scores, axis=0)
    peaks, _ = find_peaks(combined, distance=round(.65 * sr / hop), prominence=.01)
    candidates = []
    for index in sorted(peaks, key=lambda i: combined[i], reverse=True):
        center = float(times[index])
        query_index = int(np.argmax([s[index] for s in scores]))
        ref = refs[query_index]
        duration = ref['endSec'] - ref['startSec']
        start, end = max(0, center - duration / 2), min(info.duration, center + duration / 2)
        if any(start < r['endSec'] + .3 and end > r['startSec'] - .3 for r in refs):
            continue
        if any(abs(center - c['centerSec']) < 1.2 for c in candidates):
            continue
        candidates.append({'id': f'TC_{len(candidates) + 1:03d}', 'status': 'candidate',
                           'startSec': round(start, 3), 'endSec': round(end, 3),
                           'centerSec': round(center, 3), 'score': round(float(combined[index]), 4),
                           'reference': ref['id'], 'reference_scores': [round(float(s[index]), 4) for s in scores],
                           'original_sample_index': round(center * info.samplerate)})
        if len(candidates) >= 24:
            break
    report = {'created_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
              'audio': project['audio'], 'audio_sha256': hashlib.sha256(audio.read_bytes()).hexdigest(),
              'annotation_sha256': hashlib.sha256(raw).hexdigest(),
              'source_sample_rate': info.samplerate, 'duration_sec': info.duration,
              'versions': {'python': platform.python_version(), 'librosa': librosa.__version__,
                           'numpy': np.__version__, 'scipy': scipy.__version__, 'soundfile': sf.__version__},
              'parameters': {'sr': sr, 'hop_length': hop, 'n_fft': n_fft, 'n_mels': 64,
                             'fmin': 180, 'fmax': 8000, 'hpss_margin': 2, 'mfcc': '1:16',
                             'contrast_context_sec': 3, 'cosine_weight': .75, 'contrast_weight': .25,
                             'minimum_candidate_center_distance_sec': 1.2},
              'method': 'Mean-window whitened mel/MFCC cosine plus local contrast; four-bank percentile mean; max over queries.',
              'limitations': ['Scores are retrieval rankings, not probabilities.',
                             'Mixed voice, pitch, chords and accompaniment can cause false matches.',
                             'HPSS harmonic component is not an accordion stem.',
                             'Candidate boundaries are query-duration search windows, not detected instrument onset/offset.',
                             'No listening verification; unmarked regions are not verified negatives.'],
              'references': refs, 'cross_reference_checks': details, 'candidates': candidates}
    rows = []
    for e in refs + candidates:
        a, b = e['startSec'], e['endSec']
        label = html.escape(e['id'])
        score = str(e.get('score', 'reference'))
        rows.append(f'<tr><td>{label}</td><td>{a:.3f}–{b:.3f}</td><td>{score}</td>'
                    f'<td><button data-a="{max(0,a-.5):.3f}" data-b="{min(info.duration,b+.5):.3f}">试听（前后各0.5s）</button></td></tr>')
    page = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>音色检索候选</title>
<style>body{font:16px system-ui;max-width:900px;margin:32px auto;padding:0 16px;color:#243b40}td,th{padding:8px;text-align:left;border-bottom:1px solid #ccc}button{padding:7px}audio{width:100%;position:sticky;top:0}</style>
<h1>类手风琴音色：候选试听</h1><p>参考 E001 / E002 来自人工标注。其余均为机器检索窗口，尚未试听确认；分数用于排序，不是识别概率。HPSS 并非乐器分轨。试听始终使用原 FLAC。</p><p><strong>可靠性限制：</strong>两个参考互相检索的排名仍不够靠前，可能匹配了背景伴奏或人声；本页只用于缩短人工试听范围，不能确认同一音色。</p>
<audio controls src="../../../public/private/audio/try-me.flac"></audio><p id="status" role="status"></p>
<table><thead><tr><th>ID</th><th>秒数</th><th>排序分数</th><th>操作</th></tr></thead><tbody>ROWS</tbody></table>
<script>const audio=document.querySelector('audio');let stopAt=null;
document.querySelectorAll('button').forEach(b=>b.onclick=async()=>{audio.pause();stopAt=Number(b.dataset.b);audio.currentTime=Number(b.dataset.a);try{await audio.play();document.querySelector('#status').textContent='正在试听 '+b.closest('tr').cells[0].textContent;}catch(e){document.querySelector('#status').textContent=e.message;}});
audio.addEventListener('timeupdate',()=>{if(stopAt!==null&&audio.currentTime>=stopAt){audio.pause();stopAt=null;}});
</script></html>'''.replace('ROWS', '\n'.join(rows))
    output.mkdir(parents=True)
    (output / 'analysis.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (output / 'review.html').write_text(page, encoding='utf-8')
    lines = ['# 类手风琴音色：机器检索候选', '',
             f"音源 SHA-256：`{report['audio_sha256']}`。所有时间以原音源零点为准。", '',
             '参考：E001 36.405–36.837s；E002 39.667–40.532s。未修改人工主时间线。', '',
             '方法：原混音与 HPSS 谐波成分的 mel / MFCC 窗口相似度，加附近背景对比。无需模型、上传或新依赖。', '',
             '局限：没有试听确认；混音中的人声、和弦、音高可能造成误检。分数不是概率，区间是搜索窗口，不是音色起止边界。', '',
             '## 已知样本互检', '']
    for check in details:
        lines.append(f"- {check['query']} → {check['other_reference']}：对方区间内最佳窗口之外，仍有 "
                     f"{check['fraction_of_all_windows_scoring_higher']:.1%} 的全曲窗口得分更高。")
    lines += ['', '互检较弱，当前候选只能帮助人工筛查，不能作为可靠检出或缺席判断。', '',
              '## 候选（按检索分数排序）', '', '| ID | 搜索窗口（秒） | 参考 | 排序分数 |', '|---|---|---|---|']
    for c in candidates:
        lines.append(f"| {c['id']} | {c['startSec']:.3f}–{c['endSec']:.3f} | {c['reference']} | {c['score']:.4f} |")
    lines += ['', '打开同目录 review.html 对照原音试听；analysis.json 保存参数、工具版本和哈希，scores.npz 保存全曲分数曲线。', '']
    (output / 'report.md').write_text('\n'.join(lines), encoding='utf-8')
    np.savez_compressed(output / 'scores.npz', times=times, combined=combined, **curves)
    print(json.dumps({'cross_reference_checks': details, 'top_candidates': candidates[:12], 'output': str(output)}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
