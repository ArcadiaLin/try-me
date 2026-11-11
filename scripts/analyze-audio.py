#!/usr/bin/env python3
"""Reproducible baseline audio analysis for Kero Kero Bonito - Try Me.

Reads the local private FLAC file without modifying or transcoding it, verifies
short-segment decoding, and writes candidate analysis artifacts (duration,
waveform envelope, candidate beats, candidate onsets, and energy curve) under
`local/analysis/`.

All generated items are marked as automatic candidates (`source="auto"`,
`status="candidate"`) and never overwrite human annotations in
`local/annotations/`.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import platform
import sys
from pathlib import Path
from typing import Any

import librosa
import numpy as np
import scipy
import soundfile as sf

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_AUDIO_REL_PATH = Path("public/private/audio/try-me.flac")
DEFAULT_OUTPUT_REL_DIR = Path("local/analysis")


def compute_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_short_segment(audio_path: Path, duration_sec: float = 5.0) -> dict[str, Any]:
    """Read a short slice from the start of the FLAC file to verify decoding."""
    info = sf.info(str(audio_path))
    frames_to_read = min(info.frames, int(round(duration_sec * info.samplerate)))
    data, sr = sf.read(
        str(audio_path),
        start=0,
        stop=frames_to_read,
        dtype="float32",
        always_2d=True,
    )
    peak_abs = float(np.max(np.abs(data))) if data.size else 0.0
    rms = float(np.sqrt(np.mean(np.square(data)))) if data.size else 0.0
    return {
        "verified": True,
        "requested_duration_sec": duration_sec,
        "read_frames": int(data.shape[0]),
        "read_duration_sec": round(float(data.shape[0]) / float(sr), 6),
        "samplerate": int(sr),
        "channels": int(data.shape[1]),
        "peak_abs": round(peak_abs, 6),
        "rms": round(rms, 6),
    }


def compute_waveform_envelope(
    mono: np.ndarray,
    sr: int,
    bins_per_sec: int = 50,
) -> dict[str, Any]:
    """Compute min/max/rms waveform envelope bins indexed by sample and seconds."""
    samples_per_bin = max(1, int(round(sr / bins_per_sec)))
    total_samples = int(mono.shape[0])
    num_bins = int(math.ceil(total_samples / samples_per_bin))

    bins: list[dict[str, Any]] = []
    for idx in range(num_bins):
        start_sample = idx * samples_per_bin
        end_sample = min(total_samples, (idx + 1) * samples_per_bin)
        segment = mono[start_sample:end_sample]
        if segment.size == 0:
            continue
        bins.append(
            {
                "bin_index": idx,
                "start_sample": int(start_sample),
                "end_sample": int(end_sample),
                "start_sec": round(start_sample / sr, 6),
                "end_sec": round(end_sample / sr, 6),
                "min": round(float(np.min(segment)), 5),
                "max": round(float(np.max(segment)), 5),
                "rms": round(float(np.sqrt(np.mean(np.square(segment)))), 5),
            }
        )

    return {
        "bins_per_sec": bins_per_sec,
        "samples_per_bin": samples_per_bin,
        "bin_count": len(bins),
        "bins": bins,
    }


def build_svg_overview(
    duration_sec: float,
    envelope_bins: list[dict[str, Any]],
    beat_times: list[float],
    energy_events: list[dict[str, Any]],
) -> str:
    """Create a lightweight standalone SVG overview chart without extra GUI libraries."""
    width = 1200
    height = 320
    pad_left = 48
    pad_right = 24
    pad_top = 28
    pad_bottom = 36
    plot_w = width - pad_left - pad_right
    plot_h = height - pad_top - pad_bottom
    mid_y = pad_top + plot_h / 2.0

    def x_for_sec(t: float) -> float:
        if duration_sec <= 0:
            return float(pad_left)
        return pad_left + (t / duration_sec) * plot_w

    # Downsample bins to at most ~600 columns for compact SVG
    step = max(1, len(envelope_bins) // 600)
    sampled = envelope_bins[::step]

    top_points: list[str] = []
    bottom_points: list[str] = []
    rms_points: list[str] = []
    for item in sampled:
        t_mid = 0.5 * (item["start_sec"] + item["end_sec"])
        x = x_for_sec(t_mid)
        y_max = mid_y - float(item["max"]) * (plot_h * 0.45)
        y_min = mid_y - float(item["min"]) * (plot_h * 0.45)
        y_rms = (pad_top + plot_h) - float(item["rms"]) * (plot_h * 0.85)
        top_points.append(f"{x:.1f},{y_max:.1f}")
        bottom_points.append(f"{x:.1f},{y_min:.1f}")
        rms_points.append(f"{x:.1f},{y_rms:.1f}")

    polygon_pts = " ".join(top_points + list(reversed(bottom_points)))
    rms_pts = " ".join(rms_points)

    beat_lines = []
    for bt in beat_times:
        bx = x_for_sec(bt)
        beat_lines.append(
            f'<line x1="{bx:.1f}" y1="{pad_top}" x2="{bx:.1f}" y2="{pad_top + plot_h}" '
            f'stroke="#f59e0b" stroke-opacity="0.18" stroke-width="1" />'
        )

    energy_markers = []
    for ev in energy_events:
        ex = x_for_sec(float(ev["time_sec"]))
        energy_markers.append(
            f'<line x1="{ex:.1f}" y1="{pad_top}" x2="{ex:.1f}" y2="{pad_top + plot_h}" '
            f'stroke="#ef4444" stroke-opacity="0.65" stroke-dasharray="3,3" stroke-width="1.2" />'
        )

    ticks = []
    tick_step = 15
    t_val = 0
    while t_val <= int(math.ceil(duration_sec)):
        tx = x_for_sec(float(t_val))
        ticks.append(
            f'<line x1="{tx:.1f}" y1="{pad_top + plot_h}" x2="{tx:.1f}" y2="{pad_top + plot_h + 5}" stroke="#64748b" />'
            f'<text x="{tx:.1f}" y="{height - 10}" fill="#94a3b8" font-size="11" text-anchor="middle" font-family="monospace">{t_val}s</text>'
        )
        t_val += tick_step

    return "\n".join(
        [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">',
            '  <rect width="100%" height="100%" fill="#0f172a" />',
            f'  <text x="{pad_left}" y="18" fill="#e2e8f0" font-size="12" font-family="monospace">'
            f"Try Me - Candidate Waveform, RMS Energy &amp; Candidate Beats (Unconfirmed)</text>",
            f'  <rect x="{pad_left}" y="{pad_top}" width="{plot_w}" height="{plot_h}" fill="#1e293b" stroke="#334155" />',
            "  " + "\n  ".join(beat_lines),
            f'  <polygon points="{polygon_pts}" fill="#38bdf8" fill-opacity="0.35" />',
            f'  <polyline points="{rms_pts}" fill="none" stroke="#22c55e" stroke-width="1.5" />',
            "  " + "\n  ".join(energy_markers),
            "  " + "\n  ".join(ticks),
            "</svg>",
        ]
    )


def run_analysis(
    audio_rel_path: Path,
    output_rel_dir: Path,
    hop_length: int = 512,
    frame_length: int = 2048,
    envelope_bins_per_sec: int = 50,
    verify_only: bool = False,
) -> int:
    audio_path = (REPO_ROOT / audio_rel_path).resolve()
    output_dir = (REPO_ROOT / output_rel_dir).resolve()

    if not audio_path.exists():
        print(f"Error: audio file not found at {audio_rel_path.as_posix()}", file=sys.stderr)
        return 1

    print(f"[1/4] Verifying short-segment FLAC read: {audio_rel_path.as_posix()}")
    short_check = verify_short_segment(audio_path, duration_sec=5.0)
    print(
        f"      Verified {short_check['read_frames']} frames "
        f"({short_check['read_duration_sec']}s @ {short_check['samplerate']} Hz, "
        f"{short_check['channels']} ch, peak={short_check['peak_abs']}, rms={short_check['rms']})"
    )

    if verify_only:
        return 0

    print("[2/4] Computing SHA-256 and reading full audio stream (without modifying source)...")
    sha256_hex = compute_sha256(audio_path)
    sf_info = sf.info(str(audio_path))
    samples, sr = sf.read(str(audio_path), dtype="float32", always_2d=True)
    total_samples = int(samples.shape[0])
    channels = int(samples.shape[1])
    duration_sec = float(total_samples) / float(sr)

    # Convert to mono in memory for signal analysis; original FLAC on disk is untouched.
    mono = np.mean(samples, axis=1, dtype=np.float32)
    overall_peak = float(np.max(np.abs(samples)))
    overall_rms = float(np.sqrt(np.mean(np.square(mono))))

    print(
        f"[3/4] Running librosa candidate analysis (sr={sr} Hz, hop_length={hop_length}, "
        f"frame_length={frame_length})..."
    )
    onset_env = librosa.onset.onset_strength(y=mono, sr=sr, hop_length=hop_length)
    tempo_est, beat_frames = librosa.beat.beat_track(
        onset_envelope=onset_env,
        sr=sr,
        hop_length=hop_length,
        units="frames",
    )
    tempo_scalar = float(np.asarray(tempo_est).reshape(-1)[0])
    beat_frames_arr = np.asarray(beat_frames, dtype=int)
    beat_samples = librosa.frames_to_samples(beat_frames_arr, hop_length=hop_length)
    beat_times = beat_samples / float(sr)

    # Local inter-beat interval (IBI) statistics to check tempo stability without assuming constant BPM
    if beat_times.size >= 2:
        ibis = np.diff(beat_times)
        instantaneous_bpm = 60.0 / np.maximum(ibis, 1e-6)
        ibi_summary = {
            "interval_count": int(ibis.size),
            "median_ibi_sec": round(float(np.median(ibis)), 6),
            "mean_ibi_sec": round(float(np.mean(ibis)), 6),
            "std_ibi_sec": round(float(np.std(ibis)), 6),
            "median_instantaneous_bpm": round(float(np.median(instantaneous_bpm)), 2),
            "p10_instantaneous_bpm": round(float(np.percentile(instantaneous_bpm, 10)), 2),
            "p90_instantaneous_bpm": round(float(np.percentile(instantaneous_bpm, 90)), 2),
        }
    else:
        ibi_summary = {}

    onset_frames = librosa.onset.onset_detect(
        onset_envelope=onset_env,
        sr=sr,
        hop_length=hop_length,
        backtrack=False,
        units="frames",
    )
    onset_bt_frames = librosa.onset.onset_backtrack(onset_frames, onset_env)
    onset_samples = librosa.frames_to_samples(onset_frames, hop_length=hop_length)
    onset_bt_samples = librosa.frames_to_samples(onset_bt_frames, hop_length=hop_length)
    onset_times = onset_samples / float(sr)
    onset_bt_times = onset_bt_samples / float(sr)

    rms_curve = librosa.feature.rms(
        y=mono, frame_length=frame_length, hop_length=hop_length
    )[0]
    centroid_curve = librosa.feature.spectral_centroid(
        y=mono, sr=sr, n_fft=frame_length, hop_length=hop_length
    )[0]

    # Detect candidate macro energy change points from smoothed RMS derivative
    smooth_win = max(3, int(round(0.5 * sr / hop_length)))
    if smooth_win % 2 == 0:
        smooth_win += 1
    kernel = np.ones(smooth_win, dtype=np.float32) / float(smooth_win)
    rms_smooth = np.convolve(rms_curve, kernel, mode="same")
    rms_diff = np.abs(np.diff(rms_smooth, prepend=rms_smooth[0]))
    diff_thresh = float(np.mean(rms_diff) + 2.0 * np.std(rms_diff))
    min_sep_frames = max(1, int(round(2.0 * sr / hop_length)))

    energy_shift_frames: list[int] = []
    for idx in range(1, len(rms_diff) - 1):
        if rms_diff[idx] >= diff_thresh and rms_diff[idx] >= rms_diff[idx - 1] and rms_diff[idx] >= rms_diff[idx + 1]:
            if not energy_shift_frames or (idx - energy_shift_frames[-1]) >= min_sep_frames:
                energy_shift_frames.append(idx)
            elif rms_diff[idx] > rms_diff[energy_shift_frames[-1]]:
                energy_shift_frames[-1] = idx

    envelope_data = compute_waveform_envelope(
        mono=mono, sr=sr, bins_per_sec=envelope_bins_per_sec
    )

    generated_at = dt.datetime.now(dt.timezone.utc).isoformat()
    provenance = {
        "schema_version": "0.1.0",
        "generated_at_utc": generated_at,
        "source": "auto",
        "status": "candidate",
        "confirmed": False,
        "entrypoint": "scripts/analyze-audio.py",
        "command_hint": "uv run python scripts/analyze-audio.py",
        "input_audio": {
            "asset_id": "A001",
            "path": audio_rel_path.as_posix(),
            "sha256": sha256_hex,
            "size_bytes": int(audio_path.stat().st_size),
            "format": sf_info.format,
            "subtype": sf_info.subtype,
            "samplerate": int(sr),
            "channels": channels,
            "total_samples": total_samples,
            "duration_sec": round(duration_sec, 6),
            "duration_hms": f"{int(duration_sec // 60):02d}:{duration_sec % 60:06.3f}",
            "peak_abs": round(overall_peak, 6),
            "mono_rms": round(overall_rms, 6),
        },
        "tool_versions": {
            "python": platform.python_version(),
            "librosa": librosa.__version__,
            "numpy": np.__version__,
            "scipy": scipy.__version__,
            "soundfile": sf.__version__,
        },
        "parameters": {
            "analysis_sr": int(sr),
            "mono_mix": "mean_channels_in_memory",
            "frame_length": frame_length,
            "hop_length": hop_length,
            "feature_frame_sec": round(hop_length / float(sr), 8),
            "envelope_bins_per_sec": envelope_bins_per_sec,
            "energy_shift_min_separation_sec": 2.0,
            "video_fps": None,
            "audio_offset_seconds": None,
        },
        "unit_note": (
            "All times are relative to audio sample 0 in seconds and sample indices. "
            "Audio feature frames use hop_length/samplerate and must not be confused with Remotion video frames."
        ),
    }

    beat_candidates = []
    for idx, (frame_idx, sample_idx, time_sec) in enumerate(
        zip(beat_frames_arr.tolist(), beat_samples.tolist(), beat_times.tolist()),
        start=1,
    ):
        strength = float(onset_env[min(frame_idx, len(onset_env) - 1)]) if onset_env.size else 0.0
        beat_candidates.append(
            {
                "id": f"C_BEAT_{idx:04d}",
                "kind": "beat",
                "source": "auto",
                "status": "candidate",
                "confirmed": False,
                "time_sec": round(float(time_sec), 6),
                "sample_index": int(sample_idx),
                "feature_frame": int(frame_idx),
                "onset_strength": round(strength, 5),
                "note": "Candidate beat from librosa.beat.beat_track; not guaranteed to be bar downbeat.",
                "linked_shots": [],
            }
        )

    onset_candidates = []
    for idx, (f_idx, bt_f_idx, s_idx, bt_s_idx, t_sec, bt_t_sec) in enumerate(
        zip(
            onset_frames.tolist(),
            onset_bt_frames.tolist(),
            onset_samples.tolist(),
            onset_bt_samples.tolist(),
            onset_times.tolist(),
            onset_bt_times.tolist(),
        ),
        start=1,
    ):
        strength = float(onset_env[min(f_idx, len(onset_env) - 1)]) if onset_env.size else 0.0
        onset_candidates.append(
            {
                "id": f"C_ONSET_{idx:04d}",
                "kind": "onset",
                "source": "auto",
                "status": "candidate",
                "confirmed": False,
                "time_sec": round(float(t_sec), 6),
                "backtracked_time_sec": round(float(bt_t_sec), 6),
                "sample_index": int(s_idx),
                "backtracked_sample_index": int(bt_s_idx),
                "feature_frame": int(f_idx),
                "backtracked_feature_frame": int(bt_f_idx),
                "onset_strength": round(strength, 5),
                "note": "Candidate onset peak; requires listening verification.",
                "linked_shots": [],
            }
        )

    energy_candidates = []
    for idx, f_idx in enumerate(energy_shift_frames, start=1):
        s_idx = int(f_idx * hop_length)
        t_sec = float(s_idx) / float(sr)
        energy_candidates.append(
            {
                "id": f"C_ENERGY_{idx:04d}",
                "kind": "energy_shift",
                "source": "auto",
                "status": "candidate",
                "confirmed": False,
                "time_sec": round(t_sec, 6),
                "sample_index": s_idx,
                "feature_frame": int(f_idx),
                "rms": round(float(rms_curve[min(f_idx, len(rms_curve) - 1)]), 5),
                "rms_delta": round(float(rms_diff[min(f_idx, len(rms_diff) - 1)]), 5),
                "note": "Candidate macro energy transition; not an automatic section boundary.",
                "linked_shots": [],
            }
        )

    # Downsample frame-level energy curves to ~20 Hz for compact inspection while keeping exact sample/time mapping
    curve_stride = max(1, int(round((sr / hop_length) / 20.0)))
    energy_frames = []
    num_feature_frames = min(len(rms_curve), len(centroid_curve), len(onset_env))
    for f_idx in range(0, num_feature_frames, curve_stride):
        s_idx = int(f_idx * hop_length)
        energy_frames.append(
            {
                "feature_frame": int(f_idx),
                "sample_index": s_idx,
                "time_sec": round(s_idx / float(sr), 6),
                "rms": round(float(rms_curve[f_idx]), 5),
                "onset_strength": round(float(onset_env[f_idx]), 5),
                "spectral_centroid_hz": round(float(centroid_curve[f_idx]), 2),
            }
        )

    output_dir.mkdir(parents=True, exist_ok=True)
    outputs = {
        "summary": (output_rel_dir / "summary.json").as_posix(),
        "waveform": (output_rel_dir / "waveform.json").as_posix(),
        "beats": (output_rel_dir / "beats.json").as_posix(),
        "onsets": (output_rel_dir / "onsets.json").as_posix(),
        "energy": (output_rel_dir / "energy.json").as_posix(),
        "overview_svg": (output_rel_dir / "overview.svg").as_posix(),
    }

    summary_payload = {
        **provenance,
        "short_segment_verification": short_check,
        "candidate_summary": {
            "estimated_global_tempo_bpm_candidate": round(tempo_scalar, 2),
            "inter_beat_interval_summary": ibi_summary,
            "beat_candidate_count": len(beat_candidates),
            "onset_candidate_count": len(onset_candidates),
            "energy_shift_candidate_count": len(energy_candidates),
            "waveform_bin_count": envelope_data["bin_count"],
        },
        "outputs": outputs,
    }

    print(f"[4/4] Writing candidate analysis files to {output_rel_dir.as_posix()}/ ...")
    (output_dir / "summary.json").write_text(
        json.dumps(summary_payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (output_dir / "waveform.json").write_text(
        json.dumps({**provenance, **envelope_data}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (output_dir / "beats.json").write_text(
        json.dumps(
            {
                **provenance,
                "estimated_global_tempo_bpm_candidate": round(tempo_scalar, 2),
                "inter_beat_interval_summary": ibi_summary,
                "candidates": beat_candidates,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    (output_dir / "onsets.json").write_text(
        json.dumps(
            {
                **provenance,
                "candidates": onset_candidates,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    (output_dir / "energy.json").write_text(
        json.dumps(
            {
                **provenance,
                "curve_stride_feature_frames": curve_stride,
                "shift_candidates": energy_candidates,
                "frames": energy_frames,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    svg_text = build_svg_overview(
        duration_sec=duration_sec,
        envelope_bins=envelope_data["bins"],
        beat_times=beat_times.tolist(),
        energy_events=energy_candidates,
    )
    (output_dir / "overview.svg").write_text(svg_text + "\n", encoding="utf-8")

    print(
        f"Done. Duration={duration_sec:.3f}s ({provenance['input_audio']['duration_hms']}), "
        f"candidate tempo={tempo_scalar:.2f} BPM, "
        f"beats={len(beat_candidates)}, onsets={len(onset_candidates)}, "
        f"energy_shifts={len(energy_candidates)}."
    )
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run reproducible candidate audio analysis on the local FLAC file."
    )
    parser.add_argument(
        "--audio",
        type=Path,
        default=DEFAULT_AUDIO_REL_PATH,
        help="Path to the input audio file relative to repository root.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_REL_DIR,
        help="Directory for candidate analysis outputs relative to repository root.",
    )
    parser.add_argument(
        "--hop-length",
        type=int,
        default=512,
        help="Hop length in audio samples for feature extraction.",
    )
    parser.add_argument(
        "--frame-length",
        type=int,
        default=2048,
        help="Frame length in audio samples for windowed features.",
    )
    parser.add_argument(
        "--envelope-bins-per-sec",
        type=int,
        default=50,
        help="Number of min/max/rms waveform envelope bins per second.",
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Only run the short-segment FLAC decoding check without writing analysis files.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    raise SystemExit(
        run_analysis(
            audio_rel_path=args.audio,
            output_rel_dir=args.output_dir,
            hop_length=args.hop_length,
            frame_length=args.frame_length,
            envelope_bins_per_sec=args.envelope_bins_per_sec,
            verify_only=args.verify_only,
        )
    )
