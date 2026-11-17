#!/usr/bin/env python3
"""Find reference-like clap attacks, estimate their clock, and export point candidates.

Runs locally with existing dependencies. Never changes the original audio or annotations.
The beat subdivision assists timing; it never creates events without acoustic evidence.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import platform
from pathlib import Path

import librosa
import numpy as np
import scipy
import soundfile as sf
from scipy.ndimage import gaussian_filter1d, maximum_filter1d
from scipy.optimize import least_squares
from scipy.signal import butter, fftconvolve, find_peaks, sosfiltfilt

ROOT = Path(__file__).resolve().parents[2]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def walk(nodes):
    for node in nodes:
        yield node
        yield from walk(node.get('children', []))


def attack_patch(mel, index):
    """120ms mel amplitude residual, pooled into six 20ms bins."""
    start = index - 2
    baseline = np.sqrt(mel[:, max(0, start - 12):max(1, start - 4)]).mean(axis=1, keepdims=True)
    patch = np.maximum(np.sqrt(mel[:, max(0, start):start + 24]) - baseline, 0)
    patch = np.pad(patch, ((0, 0), (0, 24 - patch.shape[1])))
    return patch.reshape(48, 6, 4).mean(axis=2).ravel()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='local/analysis/claps-v1')
    args = parser.parse_args()
    output = (ROOT / args.output).resolve()
    private_root = (ROOT / 'local/analysis').resolve()
    if output == private_root or not output.is_relative_to(private_root) or output.exists():
        parser.error('Output must be a new directory within local/analysis')
    raw = (ROOT / 'annotations/try-me.timeline.json').read_bytes()
    project = json.loads(raw)
    refs = [e for n in walk(project['nodes']) for e in n.get('items', []) if '鼓掌音' in e['text']]
    if len(refs) != 8 or sum('两声' in r['text'] for r in refs) != 1:
        parser.error('Expected current seven single-clap references and one double-clap region')
    audio = (ROOT / project['audio']).resolve()
    if not audio.is_relative_to(ROOT / 'public/private'):
        parser.error('Expected private project audio')
    info = sf.info(audio)
    sr, hop, fft = 22050, 110, 2048
    print('Extracting full-song attacks and reference templates', flush=True)
    y, _ = librosa.load(audio, sr=sr, mono=True)
    magnitude = abs(librosa.stft(y, n_fft=fft, hop_length=hop))
    mel = librosa.feature.melspectrogram(S=magnitude**2, sr=sr, n_fft=fft,
                                        n_mels=48, fmin=400, fmax=10000)
    logmel = np.log1p(mel / (mel.max() * 1e-5))
    flux = gaussian_filter1d(np.maximum(np.diff(logmel, axis=1, prepend=logmel[:, :1]), 0).mean(axis=0), .8)
    peaks, _ = find_peaks(flux, distance=round(.11 * sr / hop),
                          prominence=np.percentile(flux, 95) * .12)
    times = peaks * hop / sr
    reference_hits = []
    for ref in refs:
        available = np.flatnonzero((times >= ref['startSec'] - .06) & (times < ref['endSec'] - .02))
        count = 2 if '两声' in ref['text'] else 1
        if len(available) < count:
            raise ValueError(f"Not enough attacks in reference {ref['id']}")
        chosen = sorted(sorted(available, key=lambda i: flux[peaks[i]], reverse=True)[:count])
        # Explicitly exclude the human-described drum-overlap example from the template bank.
        overlap = any('重合' in c['text'] for c in ref.get('comments', []))
        for i in chosen:
            reference_hits.append({'reference_id': ref['id'], 'peak_index': int(i),
                                   'raw_sec': float(times[i]), 'use_as_template': not overlap,
                                   'variant': 'double_lower' if count == 2 and i == chosen[0] else 'regular'})
    ref_indices = [r['peak_index'] for r in reference_hits]
    X = np.array([attack_patch(mel, i) for i in peaks])
    X /= np.maximum(np.linalg.norm(X, axis=1, keepdims=True), 1e-8)
    spectral = X @ X[ref_indices].T

    # Matching the actual noise sample is much more selective than timbre similarity alone.
    # Keep the lower-pitched first hit of the double as a separate template.
    filtered = sosfiltfilt(butter(4, [3000, 10000], fs=sr, btype='bandpass', output='sos'), y).astype('float32')
    length = round(sr * .12)
    energy = fftconvolve(filtered**2, np.ones(length, dtype='float32'), mode='valid')
    waveform = []
    for ref in reference_hits:
        start = round((ref['raw_sec'] - .025) * sr)
        query = filtered[start:start + length].copy()
        query -= query.mean()
        corr = abs(fftconvolve(filtered, query[::-1], mode='valid'))
        corr /= np.sqrt(np.maximum(energy, 1e-10) * np.sum(query**2))
        corr = maximum_filter1d(corr, size=round(.06 * sr))
        indices = np.clip(np.round((times - .025) * sr).astype(int), 0, len(corr) - 1)
        waveform.append(corr[indices])
    waveform = np.array(waveform).T
    regular = [j for j, r in enumerate(reference_hits) if r['use_as_template'] and r['variant'] == 'regular']
    lower = [j for j, r in enumerate(reference_hits) if r['variant'] == 'double_lower']
    # Both scores must agree with the SAME reference, rather than unrelated maxima.
    regular_pass = (waveform[:, regular] >= .55) & (spectral[:, regular] >= .58)
    lower_pass = (waveform[:, lower] >= .35) & (spectral[:, lower] >= .75)
    accepted = regular_pass.any(axis=1) | lower_pass.any(axis=1)

    # Infer the two-beat period from the single references (robust to the double fill).
    single = [r for r in reference_hits if r['variant'] == 'regular']
    initial = np.median(np.diff([r['raw_sec'] for r in single]))
    ref_times = np.array([r['raw_sec'] for r in reference_hits])
    ref_steps = np.round((ref_times - ref_times[0]) / (initial / 4))
    coarse_step, phase = np.polyfit(ref_steps, ref_times, 1)
    period = coarse_step * 4
    strong = accepted & (waveform[:, regular].max(axis=1) >= .65)
    strong &= abs((times - phase) / period - np.round((times - phase) / period)) * period < .04
    beat_indices = np.round((times[strong] - phase) / period)
    fit = least_squares(lambda c: c[0] + c[1] * beat_indices - times[strong], [phase, period],
                        loss='soft_l1', f_scale=.005)
    phase, period = fit.x
    step = period / 8  # Sixteenth note if period is the recurring two-quarter backbeat.
    snapped = phase + np.round((times - phase) / step) * step
    shifts = snapped - times
    on_grid = abs(shifts) <= .035
    selected = np.flatnonzero(accepted & on_grid & (snapped >= 0) & (snapped < info.duration))
    # Only one physical point per grid cell, keep the strongest acoustic match.
    unique = {}
    for i in selected:
        key = round((snapped[i] - phase) / step)
        quality = max(float(waveform[i, regular].max()), float(waveform[i, lower].max()))
        if key not in unique or quality > unique[key][1]:
            unique[key] = (i, quality)
    events, evidence = [], []
    for number, (i, _) in enumerate(sorted(unique.values(), key=lambda pair: snapped[pair[0]]), 1):
        matches = [j for j in regular if waveform[i, j] >= .55 and spectral[i, j] >= .58]
        matches += [j for j in lower if waveform[i, j] >= .35 and spectral[i, j] >= .75]
        best = max(matches, key=lambda j: waveform[i, j])
        ref = reference_hits[best]
        variant = ref['variant']
        time = round(float(snapped[i]), 6)
        event_id = f'CLAP_{number:04d}'
        events.append({'id': event_id, 'startSec': time,
                       'text': '鼓掌（低音变体·待复核）' if variant == 'double_lower' else '鼓掌',
                       'comments': [{'role': 'agent', 'text':
                           f"【参考驱动自动标注，待试听复核】参考 {ref['reference_id']}；检测起音 {times[i]:.6f}s，"
                           f"吸附 {shifts[i]*1000:+.1f}ms；波形相关 {waveform[i,best]:.3f}，"
                           f"瞬态频谱相似度 {spectral[i,best]:.3f}（均非概率）。单点代表一次鼓掌起音。"}]})
        evidence.append({'id': event_id, 'raw_sec': float(times[i]), 'snapped_sec': time,
                         'shift_ms': float(shifts[i] * 1000), 'variant': variant,
                         'reference_id': ref['reference_id'],
                         'waveform_correlation': float(waveform[i,best]),
                         'spectral_similarity': float(spectral[i,best]),
                         'original_sample_index': round(float(times[i]) * info.samplerate)})
    reference_checks = []
    for j, ref in enumerate(reference_hits):
        i = ref['peak_index']
        others = [k for k in regular + lower if reference_hits[k]['reference_id'] != ref['reference_id']]
        nearest = min(events, key=lambda e: abs(e['startSec'] - ref['raw_sec']))
        reference_checks.append({**ref, 'nearest_event_id': nearest['id'],
                                 'nearest_event_distance_sec': abs(nearest['startSec'] - ref['raw_sec']),
                                 'leave_region_out_waveform': float(waveform[i,others].max()),
                                 'included': bool(accepted[i] and on_grid[i])})
    if not all(c['included'] and c['nearest_event_distance_sec'] < .035 for c in reference_checks):
        raise ValueError('A human reference hit was missed; do not export the track')
    color = '#956644'
    track = {'kind': 'timeline', 'id': 'trk_claps_v1', 'name': '鼓掌 · 全曲点轴', 'color': color,
             'comments': [{'role': 'agent', 'text':
                 f"【自动定位·待试听复核】依据用户7个单声与1个双声区间提取9次起音，全曲匹配同类瞬态及高频波形。"
                 f"独立标出每次鼓掌，双声拆成两个点；不填补没有匹配证据的节拍。"
                 f"全曲拟合常规间隔 {period:.6f}s，细分网格 {step:.6f}s，最多吸附35ms；"
                 f"只定位相似声音，不确认小节第一拍或整曲乐器谱。共 {len(events)} 点；"
                 f"低音变体单独注明，原参考区间保留。分析：{output.relative_to(ROOT).as_posix()}/analysis.json。"}],
             'items': events}
    params = {'analysis_sr': sr, 'hop': hop, 'fft': fft, 'mel_bands': 48, 'mel_hz': [400,10000],
              'minimum_attack_distance_sec': .11, 'attack_prominence_p95_fraction': .12,
              'waveform_hz': [3000,10000], 'waveform_query_duration_sec': .12,
              'waveform_lag_search_sec': .03, 'regular_waveform_threshold': .55,
              'regular_spectral_threshold': .58, 'lower_waveform_threshold': .35,
              'lower_spectral_threshold': .75, 'max_snap_sec': .035,
              'grid_period_sec': float(period), 'grid_phase_sec': float(phase),
              'grid_step_sec': float(step), 'quarter_note_bpm_interpretation': float(120 / period),
              'grid_fit_strong_attacks': int(strong.sum())}
    report = {'status': 'candidate', 'created_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
              'audio': project['audio'], 'audio_sha256': sha(audio.read_bytes()),
              'annotation_sha256': sha(raw), 'source_sample_rate': info.samplerate,
              'duration_sec': info.duration, 'parameters': params, 'references': refs,
              'reference_checks': reference_checks, 'evidence': evidence,
              'versions': {'python': platform.python_version(), 'librosa': librosa.__version__,
                           'numpy': np.__version__, 'scipy': scipy.__version__, 'soundfile': sf.__version__},
              'counts': {'all_attacks': len(peaks), 'acoustic_matches': int(accepted.sum()),
                         'off_grid_matches': int((accepted & ~on_grid).sum()), 'points': len(events),
                         'lower_variant_points': sum(e['variant']=='double_lower' for e in evidence)},
              'limits': ['Mixed drums/hats may share sample content; false matches and misses remain possible.',
                         'The double lower template has only one labeled example; cross validation cannot establish its recall.',
                         'No listening verification, no claim of exhaustive ground truth.',
                         'Grid is inferred from these references and strong matches, not confirmed bar downbeats.']}
    output.mkdir(parents=True)
    (output / 'analysis.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    (output / 'candidate-track.json').write_text(json.dumps(track, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    np.savez_compressed(output / 'scores.npz', times=times, waveform=waveform, spectral=spectral,
                        accepted=accepted, snapped=snapped, flux=flux)
    print(json.dumps({'counts': report['counts'], 'grid': params,
                      'reference_checks': reference_checks}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
