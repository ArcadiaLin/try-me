"""Signal-level checks; no real annotations or audio writes."""
import importlib.util
from pathlib import Path
import unittest

import librosa
import numpy as np

spec = importlib.util.spec_from_file_location("rhythm", Path(__file__).with_name("analyze-rhythm.py"))
rhythm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rhythm)


class SignalChecks(unittest.TestCase):
    def test_silence_has_no_attacks_or_nan(self):
        flux, peaks, strength = rhythm.detect_attacks(np.zeros((20, 300)), 22050, 220)
        self.assertEqual(len(peaks), 0)
        self.assertTrue(np.isfinite(flux).all() and np.isfinite(strength).all())
        self.assertFalse(strength.any())

    def test_low_and_high_bursts_remain_distinguishable(self):
        sr, hop = 22050, 220
        t = np.arange(sr * 3) / sr
        low = np.sin(2 * np.pi * 80 * t) * ((t >= .5) & (t < 1.1))
        high = np.sin(2 * np.pi * 5000 * t) * ((t >= 1.7) & (t < 2.2))
        power = np.abs(librosa.stft(low + high, n_fft=2048, hop_length=hop)) ** 2
        freq = librosa.fft_frequencies(sr=sr, n_fft=2048)
        for key, expected in (("low", .5), ("high", 1.7)):
            lo, hi = rhythm.BANDS[key]
            _, peaks, _ = rhythm.detect_attacks(power[(freq >= lo) & (freq < hi)], sr, hop)
            times = peaks * hop / sr
            self.assertTrue(np.any(np.abs(times - expected) < .06), (key, times))
        low_energy = power[(freq >= 35) & (freq < 180)].sum(axis=0)
        high_energy = power[(freq >= 2000) & (freq < 10000)].sum(axis=0)
        frames = np.arange(power.shape[1]) * hop / sr
        self.assertGreater(low_energy[(frames > .6) & (frames < 1)].mean(), low_energy[(frames > 1.8) & (frames < 2.1)].mean() * 100)
        self.assertGreater(high_energy[(frames > 1.8) & (frames < 2.1)].mean(), high_energy[(frames > .6) & (frames < 1)].mean() * 100)

    def test_event_uses_original_audio_sample_rate(self):
        ev = rhythm.event("TEST", 1, 9.512, 44100)
        self.assertEqual(ev["original_sample_index"], 419479)
        self.assertEqual(ev["status"], "candidate")


if __name__ == "__main__":
    unittest.main()
