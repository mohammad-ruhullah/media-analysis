"""YouTube download helpers via the yt-dlp CLI."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path


def _run(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, text=True)


def metadata(url: str) -> dict:
    p = _run(["yt-dlp", "--dump-json", "--no-warnings", "--no-download", url])
    if p.returncode != 0:
        raise RuntimeError(f"yt-dlp metadata failed: {p.stderr.strip()[:500]}")
    return json.loads(p.stdout)


def download_audio_wav(url: str, out_wav: Path) -> Path:
    """Download bestaudio and convert to 16 kHz mono WAV for Whisper."""
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    tmp = out_wav.with_suffix("")
    p = _run([
        "yt-dlp",
        "-f", "bestaudio/best",
        "-x", "--audio-format", "wav",
        "--postprocessor-args", "ffmpeg:-ar 16000 -ac 1",
        "--no-playlist", "--no-warnings",
        "-o", str(tmp) + ".%(ext)s",
        url,
    ])
    if p.returncode != 0:
        raise RuntimeError(f"yt-dlp audio failed: {p.stderr.strip()[:500]}")
    if not out_wav.exists():
        candidates = list(out_wav.parent.glob(out_wav.stem + "*.wav"))
        if not candidates:
            raise RuntimeError("audio file was not produced")
        candidates[0].replace(out_wav)
    return out_wav


def download_video_lowres(url: str, out_mp4: Path, max_height: int = 480) -> Path:
    """Download a small video copy for scene detection / keyframes."""
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    fmt = (
        f"bestvideo[height<={max_height}][ext=mp4]+bestaudio[ext=m4a]/"
        f"best[height<={max_height}]/best"
    )
    p = _run([
        "yt-dlp",
        "-f", fmt,
        "--merge-output-format", "mp4",
        "--no-playlist", "--no-warnings",
        "-o", str(out_mp4),
        url,
    ])
    if p.returncode != 0:
        raise RuntimeError(f"yt-dlp video failed: {p.stderr.strip()[:500]}")
    return out_mp4