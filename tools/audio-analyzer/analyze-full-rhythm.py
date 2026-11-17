#!/usr/bin/env python3
"""Export whole-song interlocking percussion/clap point candidates for review.

No pretrained model or upload. A grid assists alignment but never generates a hit
without a detected transient. HPSS and pattern-based overlaps are not source stems.
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
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks

ROOT = Path(__file__).resolve().parents[2]
GROUP = 'grp_full_rhythm_v1'
COLORS = {'drums': '#69709b', 'detail': '#63757d', 'clap': '#956644',
          'overlap': '#ad483c', 'near': '#ad754b'}


def walk(nodes):
    for node in nodes:
        yield node
        yield from walk(node.get('children', []))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', default='out/full-rhythm-before.json')
    parser.add_argument('--output', default='local/analysis/full-rhythm-v1')
    args = parser.parse_args()
    output = (ROOT / args.output).resolve()
    private = (ROOT / 'local/analysis').resolve()
    if output == private or not output.is_relative_to(private) or output.exists():
        parser.error('Output must be a new directory within local/analysis')
    snapshot = json.loads((ROOT / args.snapshot).read_text(encoding='utf8'))
    raw = (ROOT / 'annotations/try-me.timeline.json').read_bytes()
    if hashlib.sha256(raw).hexdigest() != snapshot['revision']:
        parser.error('Snapshot is stale; reread before analysis')
    project = snapshot['project']
    all_nodes = list(walk(project['nodes']))
    if any(n['id'] == GROUP for n in all_nodes):
        parser.error('Do not overwrite an existing reviewed candidate group')
    source = next(n for n in all_nodes if n['id'] == 'trk_claps_v1')
    original = json.loads((ROOT / 'local/analysis/claps-v1/analysis.json').read_text(encoding='utf8'))
    audio = (ROOT / project['audio']).resolve()
    if not audio.is_relative_to(ROOT / 'public/private'):
        parser.error('Expected private local audio')
    audio_hash = hashlib.sha256(audio.read_bytes()).hexdigest()
    if audio_hash != original['audio_sha256']:
        parser.error('Audio changed; old template scores cannot be reused')
    info = sf.info(audio)
    sr, hop, fft = 22050, 110, 2048
    step = original['parameters']['grid_step_sec']
    origin = (original['parameters']['grid_phase_sec'] - step * 4) % (step * 32)
    print('Decoding full original mix and extracting percussion evidence', flush=True)
    y, _ = librosa.load(audio, sr=sr, mono=True)
    spectrum = librosa.stft(y, n_fft=fft, hop_length=hop)
    _, percussion = librosa.decompose.hpss(spectrum, margin=3)
    power, full_power = abs(percussion)**2, abs(spectrum)**2
    frequencies = librosa.fft_frequencies(sr=sr, n_fft=fft)
    curves, detected = {}, []
    for band_name, lo, hi in [('low', 40, 200), ('mid', 200, 2000), ('high', 2000, 10000)]:
        mask = (frequencies >= lo) & (frequencies < hi)
        band = power[mask]
        log = np.log1p(band / max(float(band.max()) * 1e-5, 1e-12))
        flux = gaussian_filter1d(np.maximum(np.diff(log, axis=1, prepend=log[:, :1]), 0).mean(axis=0), .7)
        level = np.sqrt(band.sum(axis=0))
        fraction = band.sum(axis=0) / np.maximum(full_power[mask].sum(axis=0), 1e-12)
        flux_scale, level_scale = max(float(np.percentile(flux, 95)), 1e-8), max(float(np.percentile(level, 95)), 1e-8)
        peaks, _ = find_peaks(flux, distance=round(.10 * sr / hop),
                             prominence=flux_scale * .15, height=flux_scale * .18)
        peaks = peaks[level[peaks] > level_scale * .04]
        curves[band_name] = {'flux': flux / flux_scale, 'level': level / level_scale, 'fraction': fraction}
        if band_name in ('mid', 'high'):
            for i in peaks:
                time = float(i * hop / sr)
                grid = round((time - origin) / step)
                snapped = origin + grid * step
                if 0 <= snapped < info.duration and abs(time - snapped) <= .040:
                    detected.append((grid, int(i), band_name))
    # Collapse frequency detections to one point per physical grid cell.
    cells = {}
    for grid, index, band in detected:
        quality = float(curves[band]['flux'][index])
        if grid not in cells or quality > cells[grid][2]:
            cells[grid] = (index, band, quality)
    main_hits, detail_hits = [], []
    for grid, (index, band, quality) in sorted(cells.items()):
        mid, high = curves['mid'], curves['high']
        m, h = float(mid['flux'][index]), float(high['flux'][index])
        fraction = max(float(mid['fraction'][index]), float(high['fraction'][index]))
        is_main_slot = grid % 8 == 0 or grid % 32 == 26
        evidence = {'grid_index': grid, 'raw_sec': float(index * hop / sr),
                    'sec': round(float(origin + grid * step), 3), 'band': band,
                    'mid_flux': m, 'high_flux': h, 'percussive_fraction': fraction,
                    'basis': 'audio_onset_and_pattern' if is_main_slot else 'audio_onset'}
        if is_main_slot and m >= .35 and fraction >= .06:
            main_hits.append(evidence)
        elif grid % 8 != 4 and (m >= .33 or h >= .45) and fraction >= .05:
            detail_hits.append(evidence)
    # Keep human-reviewed drum points as anchors, including pickups outside the main motif.
    for event in source['items']:
        if event.get('color') != COLORS['drums']:
            continue
        target = detail_hits
        if any(abs(hit['sec'] - event['startSec']) <= .040 for hit in main_hits + detail_hits):
            continue
        target.append({'sec': event['startSec'], 'raw_sec': event['startSec'], 'source_id': event['id'],
                       'basis': 'source_annotation', 'grid_index': round((event['startSec'] - origin) / step)})
    detail_hits.sort(key=lambda e: e['sec'])

    print('Comparing source clap candidates with human drum/Bass counterexamples', flush=True)
    old = np.load(ROOT / 'local/analysis/claps-v1/scores.npz')
    times = old['times']
    # Re-evaluate the existing mixed-axis points using low/mid/high spectral context.
    mel = librosa.feature.melspectrogram(S=abs(spectrum)**2, sr=sr, n_fft=fft,
                                        n_mels=64, fmin=45, fmax=10000)
    def patch(time):
        index = round(time * sr / hop) - 2
        baseline = np.sqrt(mel[:, max(0, index-12):max(1, index-4)]).mean(axis=1, keepdims=True)
        residual = np.maximum(np.sqrt(mel[:, max(0, index):index+24]) - baseline, 0)
        residual = np.pad(residual, ((0, 0), (0, 24-residual.shape[1])))
        vector = residual.reshape(64, 6, 4).mean(axis=2).ravel()
        return vector / max(float(np.linalg.norm(vector)), 1e-8)
    evidence_by_id = {e['id']: e for e in original['evidence']}
    human_refs = {}
    for e in source['items']:
        text = ' '.join(c['text'] for c in e.get('comments', []) if c['role'] == 'human')
        if not text.strip():
            continue
        kind = 'bass' if 'bass' in text.lower() else 'drums' if '鼓组' in text else 'clap'
        human_refs.setdefault(kind, []).append((e['id'], patch(evidence_by_id.get(e['id'], {}).get('raw_sec', e['startSec']))))
    claps, exclusions = [], []
    for e in source['items']:
        if e.get('color') in (COLORS['drums'], '#2b7a78'):
            exclusions.append({'id': e['id'], 'reason': 'previously_classified_drum_or_bass'})
            continue
        raw_time = evidence_by_id.get(e['id'], {}).get('raw_sec', e['startSec'])
        vector = patch(raw_time)
        scores = {kind: max(float(vector @ v) for _, v in refs) for kind, refs in human_refs.items()}
        # Human confirmations always outrank a classifier, including the six second hits.
        reviewed = any(c['role'] == 'human' and c['text'].strip() for c in e.get('comments', []))
        reviewed |= any('人工确认' in c['text'] for c in e.get('comments', []))
        if not reviewed and scores.get('drums', 0) >= .93 and scores.get('clap', 0) < .6:
            exclusions.append({'id': e['id'], 'reason': 'near_identical_human_drum_reference', 'scores': scores})
            continue
        if not reviewed and scores.get('bass', 0) >= .97 and scores.get('clap', 0) < .86:
            exclusions.append({'id': e['id'], 'reason': 'near_identical_human_bass_reference', 'scores': scores})
            continue
        claps.append({'sec': e['startSec'], 'raw_sec': raw_time, 'source_id': e['id'],
                      'text': e['text'] if reviewed else e['text'] + ' · 候选', 'reviewed': reviewed,
                      'scores': scores, 'basis': 'source_annotation'})
    # Recover strong regular clap-template matches below the old mixed-spectrum cutoff.
    for i, time in enumerate(times):
        regular_grid = round((time - original['parameters']['grid_phase_sec']) / (8*step))
        snapped = original['parameters']['grid_phase_sec'] + regular_grid * 8*step
        if not 0 <= snapped < info.duration or abs(time - snapped) > .035:
            continue
        if float(old['waveform'][i, :8].max()) < .75 or float(old['spectral'][i, :8].max()) < .45:
            continue
        if any(abs(e['startSec'] - snapped) < .080 for e in source['items']):
            continue
        claps.append({'sec': round(float(snapped), 3), 'raw_sec': float(time), 'text': '鼓掌 · 补检候选',
                      'basis': 'strong_waveform_and_regular_slot',
                      'waveform_correlation': float(old['waveform'][i, :8].max()),
                      'spectral_similarity': float(old['spectral'][i, :8].max()), 'reviewed': False})
    claps.sort(key=lambda e: e['sec'])

    def points(hits, prefix, default_text, color):
        result = []
        for number, hit in enumerate(hits, 1):
            hit['id'] = f'{prefix}_{number:04d}'
            comment = (f"【全曲节奏对照｜候选】依据{hit['basis']}；原始起音 {hit['raw_sec']:.6f}s，"
                       f"标注 {hit['sec']:.3f}s。")
            if hit.get('source_id'):
                comment += f"参考原轴 {hit['source_id']}，原备注仍保留在原轴。"
            if 'grid_index' in hit:
                comment += f" 轮内格点 {hit['grid_index']%32}/32；HPSS不等于乐器分轨。"
            result.append({'id': hit['id'], 'startSec': hit['sec'], 'text': hit.get('text', default_text),
                           'color': color, 'comments': [{'role': 'agent', 'text': comment}]})
        return result
    main_points = points(main_hits, 'FR_MAIN', '嗒 · 主节奏候选', COLORS['drums'])
    detail_points = points(detail_hits, 'FR_DETAIL', '嗒 · 弱拍/加花候选', COLORS['detail'])
    clap_points = points(claps, 'FR_CLAP', '鼓掌 · 候选', COLORS['clap'])
    overlaps, overlap_points = [], []
    drum_hits = main_hits + detail_hits
    for clap in claps:
        nearby = [d for d in drum_hits if abs(d['raw_sec']-clap['raw_sec']) <= .160]
        if not nearby:
            continue
        drum = min(nearby, key=lambda d: abs(d['raw_sec']-clap['raw_sec']))
        delta = (drum['raw_sec']-clap['raw_sec'])*1000
        kind = 'overlap' if abs(delta) <= 40 else 'near'
        overlap = {'id': f'FR_PAIR_{len(overlaps)+1:04d}', 'sec': clap['sec'], 'kind': kind,
                   'clap_id': clap['id'], 'drum_id': drum['id'], 'delta_ms': delta,
                   'clap_raw_sec': clap['raw_sec'], 'drum_raw_sec': drum['raw_sec']}
        overlaps.append(overlap)
        overlap_points.append({'id': overlap['id'], 'startSec': clap['sec'], 'color': COLORS[kind],
                               'text': '鼓组＋鼓掌 · 重合候选' if kind == 'overlap' else '鼓组／鼓掌 · 紧邻候选',
                               'comments': [{'role': 'agent', 'text':
                                  f"【规律/起音对照，待试听】鼓组候选 {drum['id']} 起音{drum['raw_sec']:.6f}s；"
                                  f"鼓掌 {clap['id']} 起音{clap['raw_sec']:.6f}s，鼓组减鼓掌 {delta:+.1f}ms。"
                                  '红色表示检测时间差不超过40ms，暖色表示40–160ms紧邻；不是已分离的双源证明。鼓掌成分可能影响HPSS检测，须试听。'}]})

    tracks = [
        {'kind': 'timeline', 'id': 'trk_full_drums_main_v1', 'name': '鼓组 · 主节奏候选', 'color': COLORS['drums'], 'items': main_points},
        {'kind': 'timeline', 'id': 'trk_full_drums_detail_v1', 'name': '鼓组 · 弱拍与加花候选', 'color': COLORS['detail'], 'items': detail_points},
        {'kind': 'timeline', 'id': 'trk_full_claps_v1', 'name': '鼓掌 · 全曲对照', 'color': COLORS['clap'], 'items': clap_points},
        {'kind': 'timeline', 'id': 'trk_full_overlap_v1', 'name': '重合与紧邻 · 待试听', 'color': COLORS['overlap'], 'items': overlap_points},
    ]
    warning = ('全曲本地候选对照：主节奏结合107BPM附近共同网格与实际起音，弱拍保留更多打击瞬态；'
               '鼓掌继承原轴并排除人类鼓组/Bass反例，补回强波形漏选。重合轨仅按独立候选轨的起音接近程度配对，'
               'HPSS可能包含鼓掌本身，不能确认两个独立乐器同时起音；不同段落不按前奏周期盲补。原轴不修改。')
    operations = [{'op': 'addGroup', 'afterId': project['nodes'][0]['id'], 'node': {
        'kind': 'group', 'id': GROUP, 'name': '全曲鼓组 × 鼓掌 · 待试听', 'children': [],
        'comments': [{'role': 'agent', 'text': warning}]}}]
    for track in tracks:
        track['comments'] = [{'role': 'agent', 'text': warning}]
        operations.append({'op': 'addTrack', 'parentId': GROUP, 'node': track})
    counts = {t['id']: len(t['items']) for t in tracks}
    report = {'created_utc': dt.datetime.now(dt.timezone.utc).isoformat(), 'status': 'candidate',
              'audio_sha256': audio_hash, 'annotation_revision': snapshot['revision'],
              'source_sample_rate': info.samplerate, 'duration_sec': info.duration,
              'parameters': {'sr': sr, 'hop': hop, 'fft': fft, 'hpss_margin': 3,
                             'grid_step_sec': step, 'origin_sec': origin, 'max_snap_sec': .040,
                             'main_phase_rule': 'n%8==0 or n%32==26', 'overlap_ms': 40, 'near_ms': 160},
              'versions': {'python': platform.python_version(), 'librosa': librosa.__version__,
                           'numpy': np.__version__, 'scipy': scipy.__version__, 'soundfile': sf.__version__},
              'counts': counts, 'main_evidence': main_hits, 'detail_evidence': detail_hits,
              'clap_evidence': claps, 'excluded_source_claps': exclusions, 'pairs': overlaps,
              'limits': [warning, '未运行预训练模型、未人工试听本轮全曲新候选；候选不是完整乐器谱。']}
    output.mkdir(parents=True)
    (output/'analysis.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    (output/'plan.json').write_text(json.dumps({'baseRevision': snapshot['revision'], 'operations': operations}, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    np.savez_compressed(output/'curves.npz', **{name+'_'+k: v for name, values in curves.items() for k,v in values.items()})
    print(json.dumps({'counts': counts, 'overlaps': sum(e['kind']=='overlap' for e in overlaps),
                      'near_pairs': sum(e['kind']=='near' for e in overlaps),
                      'excluded_old_candidates': len(exclusions), 'output': str(output)}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
