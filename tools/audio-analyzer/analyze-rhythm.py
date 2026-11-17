#!/usr/bin/env python3
"""Generate private, reproducible rhythm candidates without editing annotations.

Frequency bands and HPSS components are signal features, not instrument stems.
Times refer to the original audio zero; no video FPS or offset is assumed.
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
from scipy.ndimage import gaussian_filter1d, uniform_filter1d
from scipy.signal import find_peaks

ROOT = Path(__file__).resolve().parents[2]
BANDS = {"low": (35, 180), "mid": (180, 2000), "high": (2000, 10000)}
NAMES = {"beat": "节拍基准", "low": "低频起音", "mid": "中频起音", "high": "高频起音", "break": "断点与突变", "accent": "动作重点初筛"}
COLORS = {"beat": "#63757d", "low": "#956644", "mid": "#3b7771", "high": "#69709b", "break": "#ad483c", "accent": "#873c33"}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def normalized(values):
    scale = float(np.percentile(values, 95))
    return np.clip(values / max(scale, 1e-10), 0, 1)


def detect_attacks(power, sr, hop):
    # Positive log spectral flux; centered STFT gives ~50 ms timing uncertainty.
    floor = max(float(np.max(power)) * 1e-7, 1e-12)
    log_power = np.log1p(power / floor)
    flux = np.mean(np.maximum(np.diff(log_power, axis=1, prepend=log_power[:, :1]), 0), axis=0)
    flux = gaussian_filter1d(flux, 0.6)
    level = np.sqrt(np.sum(power, axis=0))
    flux[level < np.percentile(level, 90) * 0.06] = 0
    scale = max(float(np.percentile(flux, 95)), 1e-10)
    peaks, _ = find_peaks(flux, distance=round(0.16 * sr / hop), prominence=scale * 0.18, height=scale * 0.22)
    return flux, peaks, normalized(flux)


def event(prefix, index, time, sr, **extra):
    return {"id": f"RC_{prefix}_{index:04d}", "time_sec": round(float(time), 6),
            "original_sample_index": round(float(time) * sr), "source": "auto",
            "status": "candidate", **extra}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--focus-end", type=float, default=55.168)
    parser.add_argument("--output", default="local/analysis/rhythm-v1")
    args = parser.parse_args()
    if not np.isfinite(args.focus_end) or args.focus_end <= 0:
        parser.error("--focus-end must be positive and finite")
    audio = ROOT / "public/private/audio/try-me.flac"
    output = (ROOT / args.output).resolve()
    private_root = (ROOT / "local/analysis").resolve()
    if not output.is_relative_to(private_root) or output == private_root:
        parser.error("--output must be a new directory inside local/analysis")
    # Versioned output is immutable: reruns cannot erase manually reviewed results.
    if output.exists():
        raise FileExistsError(f"Move/archive existing analysis explicitly before rerunning: {output}")
    source_hash = sha(audio)
    timeline = ROOT / "annotations/try-me.timeline.json"
    source_project = json.loads(timeline.read_text(encoding="utf-8-sig"))
    snapshot_hash = sha(timeline)
    samples, original_sr = sf.read(audio, dtype="float32", always_2d=True)
    duration = len(samples) / original_sr
    print("Decoding and resampling in memory; original FLAC unchanged", flush=True)
    sr, hop, fft = 22050, 220, 2048
    mono = librosa.resample(samples.mean(axis=1), orig_sr=original_sr, target_sr=sr)
    spectrum = librosa.stft(mono, n_fft=fft, hop_length=hop, center=True)
    power = np.abs(spectrum) ** 2
    times = librosa.frames_to_time(np.arange(power.shape[1]), sr=sr, hop_length=hop)
    print("Separating harmonic/percussive features (not instrument stems)", flush=True)
    harmonic, percussive = librosa.decompose.hpss(spectrum, kernel_size=31, margin=2)
    freqs = librosa.fft_frequencies(sr=sr, n_fft=fft)
    band_energy, band_flux, tracks = {}, {}, {}
    for key, (lo, hi) in BANDS.items():
        band = power[(freqs >= lo) & (freqs < hi)]
        band_energy[key] = np.sqrt(np.sum(band, axis=0))
        flux, peaks, strength = detect_attacks(band, sr, hop)
        band_flux[key] = flux
        tracks[key] = [event(key.upper(), i, times[p], original_sr, strength=round(float(strength[p]), 4))
                       for i, p in enumerate(peaks, 1) if times[p] < duration]
    percussive_power = np.abs(percussive) ** 2
    onset, _, _ = detect_attacks(percussive_power, sr, hop)
    tempo, beats = librosa.beat.beat_track(onset_envelope=onset, sr=sr, hop_length=hop, trim=False)
    beat_times = times[beats]
    tracks["beat"] = [event("BEAT", i, t, original_sr) for i, t in enumerate(beat_times, 1) if t < duration]
    interval = np.diff(beat_times)
    # Compare adjacent 250 ms windows: energy and normalized spectrum both matter.
    width = round(0.25 * sr / hop)
    all_energy = np.sqrt(power.sum(axis=0))
    features = np.vstack([band_energy[k] for k in BANDS])
    smoothed = uniform_filter1d(features, size=width, axis=1, mode="nearest")
    before = np.roll(smoothed, width // 2, axis=1)
    after = np.roll(smoothed, -width // 2, axis=1)
    before_level = np.linalg.norm(before, axis=0)
    after_level = np.linalg.norm(after, axis=0)
    energy_delta = 20 * np.log10((after_level + 1e-6) / (before_level + 1e-6))
    cosine = np.sum(before * after, axis=0) / np.maximum(before_level * after_level, 1e-10)
    novelty = np.clip(1 - cosine, 0, 1)
    score = gaussian_filter1d(np.abs(energy_delta) / 12 + novelty * 3, 4)
    score[:width * 2] = score[-width * 2:] = 0
    peaks, _ = find_peaks(score, distance=round(2 * sr / hop), prominence=0.12,
                         height=max(float(np.percentile(score, 93)), 0.3))
    tracks["break"] = [event("CHANGE", i, times[p], original_sr,
        score=round(float(score[p]), 4), energy_delta_db=round(float(energy_delta[p]), 2),
        spectral_change=round(float(novelty[p]), 4),
        reason="能量上升" if energy_delta[p] > 3 else "能量下降" if energy_delta[p] < -3 else "频段比例变化")
        for i, p in enumerate(peaks, 1) if times[p] < duration]

    def walk(nodes):
        for node in nodes:
            if node["kind"] == "group":
                yield from walk(node["children"])
            else:
                yield node

    # Carry explicit human-labelled bass boundaries as references, never rediscover them by fiat.
    references = []
    for track in walk(source_project["nodes"]):
        for item in track["items"]:
            if "有bass" in item["text"].lower():
                references.append({"id": item["id"], "time_sec": item["startSec"],
                                   "source": "human_annotation", "label": item["text"]})
    # A review shortlist, not a claim about musical structure: protect human anchors,
    # then choose the strongest remaining change in each 10-second window, >=4s apart.
    selected = [dict(r, reason="人工标注的 bass 进入", status="human_reference") for r in references]
    for bucket in range(int(np.ceil(duration / 10))):
        candidates = sorted((e for e in tracks["break"] if bucket * 10 <= e["time_sec"] < (bucket + 1) * 10),
                            key=lambda e: e["score"], reverse=True)
        for ev in candidates:
            if all(abs(ev["time_sec"] - s["time_sec"]) >= 4 for s in selected):
                selected.append(dict(ev))
                break
    tracks["accent"] = [dict(e, id=f"RC_ACCENT_{i:04d}") for i, e in enumerate(sorted(selected, key=lambda e: e["time_sec"]), 1)]
    curves = {key: normalized(gaussian_filter1d(value, 3)) for key, value in band_energy.items()}
    curves["harmonic_low"] = normalized(gaussian_filter1d(np.sqrt(np.sum(
        np.abs(harmonic[(freqs >= 35) & (freqs < 180)]) ** 2, axis=0)), 3))
    curves["percussive"] = normalized(gaussian_filter1d(np.sqrt(percussive_power.sum(axis=0)), 2))
    curves["mix"] = normalized(gaussian_filter1d(all_energy, 3))
    step = 5  # ~50 ms display/control envelopes; original attack timing retained separately.
    envelope = {"times_sec": np.round(times[::step], 6).tolist(),
                **{k: np.round(v[::step], 4).tolist() for k, v in curves.items()}}
    focus_end = min(args.focus_end, duration)
    group = {"kind": "group", "id": "grp_rhythm_candidates_v1", "name": "节奏候选 v1 · 待试听（前55秒）",
             "comments": [{"role": "agent", "text":
                 "全组为自动候选，不是人工确认。低/中/高频不是乐器分轨；重拍与小节第一拍尚未判断。"
                 "环境元素参考连续频段活动和起音；Clawd 只挑选断点做动作。原始数据及参数：local/analysis/rhythm-v1/analysis.json。"
                 f"音源 SHA-256：{source_hash}；原音源零点秒数；无帧率或片头偏移。"}], "children": []}
    for key in NAMES:
        items = []
        for ev in tracks[key]:
            if ev["time_sec"] >= focus_end:
                continue
            label = f"候选 · {NAMES[key]}"
            if key in BANDS:
                label += f" · 强度 {ev['strength']:.2f}"
            if key == "break":
                label += f" · {ev['reason']} {ev['energy_delta_db']:+.1f} dB"
            if key == "accent":
                label = ("人工参考" if ev["source"] == "human_annotation" else "初筛候选") + f" · {ev['reason']}"
            items.append({"id": ev["id"], "startSec": ev["time_sec"], "text": label})
        group["children"].append({"kind": "timeline", "id": f"trk_rc_{key}_v1",
            "name": NAMES[key] + " · 候选", "color": COLORS[key], "items": items,
            "comments": [{"role": "agent", "text":
                "机器估计，需听原混音复核；起音约 ±50ms、突变约 ±250ms；强度按各轨全曲第95百分位归一，不能跨轨比较音量。"
                + (f"频段 {BANDS[key][0]}–{BANDS[key][1]} Hz；可能混合多种乐器和人声。" if key in BANDS else
                   "节拍不是小节第一拍，存在半速/倍速与相位歧义。" if key == "beat" else
                   "每10秒至多选一个机器突变，与已有初筛点至少间隔4秒；保留人工 bass 分界。只是减少复核数量，不判断乐句或强拍。" if key == "accent" else
                   "相邻250ms窗口的能量/频段比例变化，不等于乐句边界，也不保证是停顿。")}]})
    result = {"schema_version": 1, "source": "auto", "status": "candidate", "confirmed": False,
        "generated_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "audio": {"path": audio.relative_to(ROOT).as_posix(), "sha256": source_hash,
            "original_sr": original_sr, "channels": samples.shape[1], "samples": len(samples), "duration_sec": duration},
        "annotation_snapshot_sha256": snapshot_hash,
        "tools": {"python": platform.python_version(), "numpy": np.__version__, "librosa": librosa.__version__,
                  "scipy": scipy.__version__, "soundfile": sf.__version__},
        "parameters": {"sr": sr, "hop_length": hop, "n_fft": fft, "center": True,
            "bands_hz": BANDS, "hpss_kernel": 31, "hpss_margin": 2, "attack_min_gap_sec": 0.16,
            "attack_prominence_p95": 0.18, "attack_height_p95": 0.22, "attack_energy_gate_p90": 0.06,
            "change_window_sec": 0.25, "change_min_gap_sec": 2, "change_threshold_percentile": 93,
            "change_prominence": 0.12, "change_height_floor": 0.3,
            "accent_bucket_sec": 10, "accent_min_gap_sec": 4,
            "focus_end_sec": focus_end, "curve_step_sec": hop * step / sr},
        "timing_note": "Audio sample zero; seconds and original sample indices. Feature frames are not video frames. Attack uncertainty ~50ms; change windows ~250ms. No downbeat or instrument identification.",
        "estimated_tempo_bpm_candidate": float(np.asarray(tempo).reshape(-1)[0]),
        "beat_interval_median_sec": float(np.median(interval)) if len(interval) else None,
        "beat_interval_std_sec": float(np.std(interval)) if len(interval) else None,
        "human_references": references, "tracks": tracks, "envelopes": envelope}
    assert sha(audio) == source_hash, "Input changed during analysis"
    output.mkdir(parents=True)
    (output / "analysis.json").write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
    (output / "candidate-group.json").write_text(json.dumps(group, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    template = (Path(__file__).with_name("rhythm-review.html")).read_text(encoding="utf-8")
    (output / "review.html").write_text(template.replace("__ANALYSIS_DATA__", json.dumps(result, ensure_ascii=False).replace("<", "\\u003c")), encoding="utf-8")
    report = ["# 节奏候选分析 v1", "", f"音源 SHA-256：`{source_hash}`。全曲 {duration:.6f}s；工作台候选覆盖 [0, {focus_end})。",
        "", "全部机器结果待试听；频段与 HPSS 都不等于乐器分离，不做确定 bass/鼓/旋律识别，不判断小节第一拍。",
        f"节拍速度估计 {result['estimated_tempo_bpm_candidate']:.3f} BPM，存在半速/倍速与相位歧义。", "",
        "| 轨道 | 全曲候选 | 前段候选 |", "|---|---:|---:|"]
    report += [f"| {NAMES[k]} | {len(tracks[k])} | {sum(e['time_sec'] < focus_end for e in tracks[k])} |" for k in NAMES]
    report += ["", "## 前段断点（按时间排序，需试听筛选）", ""]
    report += [f"- {e['time_sec']:.3f}s：{e['reason']}，窗口能量差 {e['energy_delta_db']:+.2f}dB；评分 {e['score']:.3f}。" for e in tracks["break"] if e["time_sec"] < focus_end]
    report += ["", "## 人工参考", ""]
    report += [f"- {r['id']} {r['time_sec']:.3f}s：{r['label']}，来自当前用户标注，未由机器覆盖。" for r in references]
    report += ["", "## 使用与复核", "", "- 打开同目录 review.html，点击轨迹定位原 FLAC；可循环片段，观察环境脉冲与稀疏断点提示。",
        "- 低频适合地面/大块形变，中频适合几何/线条，高频适合细小短促变化；均为视觉候选映射。",
        "- 连续曲线归一到各轨全曲95百分位并限幅，不能比较不同轨音量。环境可加小幅度、平滑与上限。",
        "- Clawd 不跟随全部起音；只在试听后选定的少量断点、首次进入和停顿做动作，动作峰值对齐声音。",
        "- review.html 只做诊断，无正式动画接入；不是已通过的音画同步验收。",
        "- 自动分析重跑不会改写主时间线。候选组只首次追加；再次分析需使用新版本目录和 ID，保留人工修订。"]
    (output / "report.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "tempo_candidate": result["estimated_tempo_bpm_candidate"],
                      "counts": {k: len(v) for k, v in tracks.items()}, "focus_counts": {t["name"]: len(t["items"]) for t in group["children"]}}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
