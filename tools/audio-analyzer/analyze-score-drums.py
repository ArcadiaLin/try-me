#!/usr/bin/env python3
"""Local score-constrained drum candidates; write a batch plan, never the timeline.

The user's score supplies beat phase and admissible slots. Waveform correlations
and cached, source-verified HPSS flux supply evidence, not separated instruments.
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
from scipy.ndimage import maximum_filter1d
from scipy.signal import butter, fftconvolve, find_peaks, sosfiltfilt

ROOT = Path(__file__).resolve().parents[2]
GROUP = 'grp_score_drums_v2'
LABELS = {'kick': '底鼓', 'snare': '军鼓', 'clap': '鼓掌', 'hat': '踩镲／镲片'}
COLORS = {'kick': '#356b75', 'snare': '#69709b', 'clap': '#956644', 'hat': '#63757d'}
# Time anchors are readings of the supplied opening score and existing references.
# The two pickup snares are user-confirmed. Other template identities are candidates.
REFS = {'snare': [.248, .388], 'kick': [.528, 1.509, 1.65],
        'hat': [.808, 1.369], 'clap': [1.089, 3.332, 4.173, 54.920, 56.041, 58.004],
        'kick_broad': [.528, 1.509, 1.65]}
BANDS = {'snare': (350, 9000), 'kick': (40, 220),
         'hat': (4500, 10000), 'clap': (2000, 10000), 'kick_broad': (40, 1500)}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def walk(nodes):
    for node in nodes:
        yield node
        yield from walk(node.get('children', []))


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    output = (ROOT/args.output).resolve()
    private = (ROOT/'local/analysis').resolve()
    if output == private or not output.is_relative_to(private) or output.exists():
        parser.error('Output must be a new directory within local/analysis')
    snapshot = json.loads((ROOT/args.snapshot).read_text(encoding='utf8'))
    if sha(ROOT/'annotations/try-me.timeline.json') != snapshot['revision']:
        parser.error('Stale snapshot; reread and compare before rebuilding')
    project = snapshot['project']
    nodes = {n['id']: n for n in walk(project['nodes'])}
    if GROUP in nodes:
        parser.error('Refusing to overwrite an existing reviewed v2 group')
    audio = (ROOT/project['audio']).resolve()
    if not audio.is_relative_to((ROOT/'public/private').resolve()):
        parser.error('Expected private project audio')
    cache = ROOT/'local/analysis/full-rhythm-v1'
    previous = json.loads((cache/'analysis.json').read_text(encoding='utf8'))
    audio_hash = sha(audio)
    if audio_hash != previous['audio_sha256']:
        parser.error('Cached curves belong to another source')
    sr, hop = previous['parameters']['sr'], previous['parameters']['hop']
    step, origin = previous['parameters']['grid_step_sec'], previous['parameters']['origin_sec']
    info = sf.info(audio)
    curves = dict(np.load(cache/'curves.npz'))
    assert all(len(v) == 1+int(info.duration*sr)//hop for v in curves.values())
    print('Matching opening-score/reference waveforms against the full original mix', flush=True)
    y, _ = librosa.load(audio, sr=sr, mono=True)
    grids = np.arange(-2, int((info.duration-origin)/step)+1)
    times = origin+grids*step
    scores = {}
    for kind, anchors in REFS.items():
        filtered = sosfiltfilt(butter(4, BANDS[kind], fs=sr, btype='bandpass', output='sos'), y).astype('float32')
        length = round(sr*(.14 if kind.startswith('kick') else .105))
        energy = fftconvolve(filtered**2, np.ones(length, dtype='float32'), mode='valid')
        bank = []
        for time in anchors:
            start = round((time-.012)*sr)
            query = filtered[start:start+length].copy()
            query -= query.mean()
            correlation = abs(fftconvolve(filtered, query[::-1], mode='valid'))
            correlation /= np.sqrt(np.maximum(energy, 1e-12)*max(float(query@query), 1e-12))
            correlation = maximum_filter1d(correlation, size=round(.07*sr))
            indices = np.clip(np.round((times-.012)*sr).astype(int), 0, len(correlation)-1)
            bank.append(correlation[indices])
        scores[kind] = np.array(bank).T
    peaks = {band: find_peaks(curves[band+'_flux'], distance=round(.07*sr/hop),
                             height=.18, prominence=.12)[0] for band in ('low', 'mid', 'high')}
    mixed = nodes['trk_claps_v1']['items']
    pickups = [next(e for e in mixed if e['id']==event_id) for event_id in ('CLAP_0001', 'CLAP_0002')]
    if any(abs(e['startSec']-time)>.001 for e,time in zip(pickups, REFS['snare'])):
        parser.error('Pickup references changed; review the score anchors before analysis')
    human_bass = [e for e in mixed if any(c['role']=='human' and 'bass' in c['text'].lower()
                                        for c in e.get('comments', []))]
    old_claps = nodes['trk_full_claps_v1']['items']
    # Human declarations and prior explicit confirmations outrank an acoustic score.
    confirmed_claps = [e for e in mixed if e.get('color') not in ('#69709b', '#2b7a78')
                       and any((c['role']=='human' and c['text'].strip()) or '人工确认' in c['text']
                               for c in e.get('comments', []))]
    hits = {kind: [] for kind in LABELS}
    rejected, conflicts = [], []
    for i, grid in enumerate(grids):
        time = float(times[i])
        wave = {kind: float(values[i].max()) for kind, values in scores.items()}
        nearby = {}
        for band, indices in peaks.items():
            indices = indices[abs(indices*hop/sr-time) <= .04]
            if len(indices):
                index = int(max(indices, key=lambda j: curves[band+'_flux'][j]))
                nearby[band] = {'raw_sec': index*hop/sr, 'flux': float(curves[band+'_flux'][index]),
                                'fraction': float(curves[band+'_fraction'][index])}
        bass = [e['id'] for e in human_bass if abs(e['startSec']-time)<.05]
        old = [e for e in old_claps if abs(e['startSec']-time)<.04]
        confirmed = [e for e in confirmed_claps if abs(e['startSec']-time)<.04]
        for kind in LABELS:
            pickup = kind=='snare' and grid in (-2, -1)
            legal = (grid>=0 and (kind!='snare' or grid%4!=2)
                     and (kind!='clap' or grid%2==0)) or pickup
            if not legal:
                if kind=='clap' and confirmed:
                    conflicts.append({'grid': int(grid), 'source_ids': [e['id'] for e in confirmed]})
                continue
            band = {'kick': 'low', 'snare': 'mid', 'hat': 'high', 'clap': 'high'}[kind]
            evidence = nearby.get(band)
            strength = evidence['flux'] if evidence else 0
            if kind=='kick':
                # A low-frequency sine/Bass alone also correlates with a kick tail.
                # Require the SAME kick reference in the broader attack band too.
                joint = (scores['kick'][i]>=.65) & (scores['kick_broad'][i]>=.74)
                motif = grid%16 in (0,7,8)
                masked = (scores['kick'][i]>=.60) & (scores['kick_broad'][i]>=.45)
                accept = (strength>=.65 and wave['snare']<.25 and
                          ((motif and bool(masked.any())) or (strength>=.90 and bool(joint.any()))))
            elif kind=='snare':
                accept = wave[kind]>=.30 and strength>=.30
            elif kind=='hat':
                accept = wave[kind]>=.62 and strength>=.25
            else:
                accept = strength>=.25 and (wave[kind]>=.65 or (bool(old) and wave[kind]>=.55))
            if bass:
                accept = False
            if confirmed and kind=='clap':
                accept = True
            if pickup:
                accept = True
            if not accept:
                rejected.append({'grid': int(grid), 'kind': kind, 'wave': wave[kind],
                                 'flux': strength, 'human_bass': bass})
                continue
            # Stable human time is preserved for the pickup and confirmed clap anchors.
            anchor = next((e for e in pickups if pickup and abs(e['startSec']-time)<.04), None)
            if kind=='clap' and confirmed:
                anchor = confirmed[0]
            sec = anchor['startSec'] if anchor else round(time, 6)
            source = ([anchor['id']] if anchor else []) + [e['id'] for e in old if kind=='clap']
            hit = {'grid': int(grid), 'sec': sec, 'wave': wave[kind], 'all_wave': wave,
                   'onset': evidence, 'source_ids': sorted(set(source)),
                   'status': 'user_confirmed' if pickup or (kind=='clap' and confirmed) else 'candidate',
                   'template_sec': REFS[kind][int(np.argmax(scores[kind][i]))]}
            hits[kind].append(hit)
    assert not conflicts, f'Human clap/grid conflicts require review: {conflicts}'
    rules = ('用户2026-11-19鼓谱/听辨规则：四分音符为一拍；军鼓不在&，鼓掌不在e/a；'
             '开头两声军鼓为明确确认的引子例外；其余位置允许重合，有波形/起音才新增。'
             '原始音源零点秒数，沿用实测约107BPM网格，0.528038s作为首个完整4/4小节候选起点。'
             '每格独立分析，允许第4小节等局部变奏；不强制重复。')
    warning = ('音色相关与HPSS频段均非乐器分离；踩镲/吊镲暂不细分，低频可能混入Bass。'
               '军鼓与鼓掌同时匹配仅作重合候选，共享采样可导致双计；全曲逐点听辨待确认。')
    operations = [{'op': 'addGroup', 'afterId': project['nodes'][0]['id'], 'node': {
        'kind': 'group', 'id': GROUP, 'name': '全曲鼓组 · 鼓谱修订 v2 · 待试听', 'children': [],
        'comments': [{'role': 'agent', 'text': rules+' '+warning}]}}]
    for kind, events in hits.items():
        items = []
        for index, hit in enumerate(events, 1):
            hit['id'] = f'SD2_{kind.upper()}_{index:04d}'
            g = hit['grid']
            location = f'完整小节{g//16+1}，第{g%16//4+1}拍'+('正拍','e','反拍&','a')[g%4] if g>=0 else '引子'
            note = (f'【{hit["status"]}｜鼓谱约束+原混音波形】{location}；网格{g}；'
                    f'模板{hit["template_sec"]:.3f}s，相关{hit["wave"]:.3f}（非概率）。')
            if hit['onset']:
                note += f' HPSS起音{hit["onset"]["raw_sec"]:.6f}s，归一通量{hit["onset"]["flux"]:.3f}。'
            if hit['source_ids']:
                note += ' 既有参考：'+', '.join(hit['source_ids'])+'；原ID和备注保留。'
            items.append({'id': hit['id'], 'startSec': hit['sec'],
                          'text': LABELS[kind]+(' · 引子（用户确认）' if g<0 else
                                               ' · 人工参考' if hit['status']=='user_confirmed' else ' · 候选'),
                          'comments': [{'role': 'agent', 'text': note}]})
        operations.append({'op': 'addTrack', 'parentId': GROUP, 'node': {
            'kind': 'timeline', 'id': f'trk_score_{kind}_v2', 'name': LABELS[kind]+' · 鼓谱修订',
            'color': COLORS[kind], 'items': items, 'comments': [{'role': 'agent', 'text': rules+' '+warning}]}})
    snare_by_grid = {e['grid']: e for e in hits['snare']}
    pairs = [dict(clap=e['id'], snare=snare_by_grid[e['grid']]['id'], grid=e['grid'], sec=e['sec'])
             for e in hits['clap'] if e['grid'] in snare_by_grid]
    operations.append({'op': 'addTrack', 'parentId': GROUP, 'node': {
        'kind': 'timeline', 'id': 'trk_score_overlap_v2', 'name': '军鼓＋鼓掌 · 重合候选',
        'color': '#ad483c', 'items': [
            {'id': f'SD2_PAIR_{i:04d}', 'startSec': e['sec'], 'text': '军鼓＋鼓掌 · 重合候选',
             'comments': [{'role': 'agent', 'text': f'{e["snare"]} / {e["clap"]}；'+warning}]}
            for i,e in enumerate(pairs,1)]}})
    # Mark old automatic views as history without deleting or rewriting reviewed items.
    for track in nodes['grp_full_rhythm_v1']['children']:
        operations.append({'op': 'updateTrack', 'trackId': track['id'],
                           'patch': {'name': '旧v1参考 · '+track['name']}})
    operations.append({'op': 'appendComment', 'nodeId': 'grp_full_rhythm_v1', 'comment': {
        'role': 'agent', 'text': '2026-11-19：本组为旧混合起音结果；当前按鼓谱修订请看 '+GROUP+'。保留旧事件与全部人类备注供追溯。'}})
    for i,e in enumerate(pickups,1):
        operations.extend([
            {'op': 'updateEvent', 'trackId': 'trk_claps_v1', 'eventId': e['id'],
             'patch': {'text': f'军鼓 · 引子第{i}声'}},
            {'op': 'appendComment', 'trackId': 'trk_claps_v1', 'eventId': e['id'],
             'comment': {'role': 'human', 'text': '一开始是两声军鼓'}}])
    output.mkdir(parents=True)
    report = {'created_utc': dt.datetime.now(dt.timezone.utc).isoformat(), 'audio_sha256': audio_hash,
              'annotation_revision': snapshot['revision'], 'duration_sec': info.duration,
              'source_sample_rate': info.samplerate, 'rules': rules, 'limits': warning,
              'parameters': {'sr': sr, 'hop': hop, 'step': step, 'origin': origin, 'max_snap_sec': .04,
                             'references': REFS, 'bands': BANDS, 'wave_lag_sec': .035,
                             'thresholds': {'kick_low_wave': .65, 'kick_broad_wave': .74,
                                            'kick_flux': .65, 'kick_weak_flux': .90,
                                            'kick_score_slots': [0,7,8], 'kick_masked_low_wave': .60,
                                            'kick_masked_broad_wave': .45,
                                            'snare_wave': .30, 'snare_flux': .30,
                                            'hat_wave': .62, 'hat_flux': .25,
                                            'clap_wave': .65, 'clap_old_wave': .55, 'clap_flux': .25}},
              'versions': {'python': platform.python_version(), 'librosa': librosa.__version__,
                           'numpy': np.__version__, 'scipy': scipy.__version__, 'soundfile': sf.__version__},
              'inputs': {'cache_report_sha256': sha(cache/'analysis.json'),
                         'cache_curves_sha256': sha(cache/'curves.npz'), 'script_sha256': sha(Path(__file__))},
              'counts': {kind: len(events) for kind,events in hits.items()}, 'pairs': pairs,
              'hits': hits, 'rejected': rejected, 'human_rule_conflicts': conflicts}
    dump(output/'analysis.json', report)
    dump(output/'plan.json', {'baseRevision': snapshot['revision'], 'operations': operations})
    np.savez_compressed(output/'wave-scores.npz', grids=grids, times=times, **scores)
    print(json.dumps({'counts': report['counts'], 'pairs': len(pairs), 'output': str(output)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
