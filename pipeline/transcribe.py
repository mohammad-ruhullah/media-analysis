"""Transcription via the Groq cloud Whisper API, with chunking for long audio."""
from __future__ import annotations

import math
import subprocess
from pathlib import Path

import requests

from config import cfg

GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions"

# Groq has a per-file size cap; keep chunks comfortably small.
CHUNK_SECONDS = 600


def _duration(path: Path) -> float:
    p = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True,
    )
    try:
        return float(p.stdout.strip())
    except ValueError:
        return 0.0


def _extract_chunk(audio: Path, start: float, length: float, out: Path) -> Path:
    p = subprocess.run(
        ["ffmpeg", "-y", "-ss", str(start), "-t", str(length), "-i", str(audio),
         "-ar", "16000", "-ac", "1", "-c:a", "flac", str(out)],
        capture_output=True, text=True,
    )
    if p.returncode != 0:
        raise RuntimeError(f"ffmpeg chunk failed: {p.stderr.strip()[:400]}")
    return out


def _transcribe_chunk(chunk: Path, language: str | None) -> dict:
    if not cfg.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not set")
    data = {
        "model": cfg.groq_whisper_model,
        "response_format": "verbose_json",
        "timestamp_granularities[]": "segment",
    }
    if language:
        data["language"] = language
    with open(chunk, "rb") as fh:
        resp = requests.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {cfg.groq_api_key}"},
            data=data,
            files={"file": (chunk.name, fh, "audio/flac")},
            timeout=600,
        )
    if resp.status_code != 200:
        raise RuntimeError(f"Groq {resp.status_code}: {resp.text[:400]}")
    return resp.json()


def transcribe(audio_wav: Path, work_dir: Path, language: str | None = None) -> tuple[str, list[dict]]:
    duration = _duration(audio_wav)
    work_dir.mkdir(parents=True, exist_ok=True)

    segments: list[dict] = []
    detected_lang = language or ""
    n_chunks = max(1, math.ceil(duration / CHUNK_SECONDS))

    for i in range(n_chunks):
        start = i * CHUNK_SECONDS
        length = min(CHUNK_SECONDS, duration - start) if duration else CHUNK_SECONDS
        chunk = work_dir / f"chunk_{i:04d}.flac"
        _extract_chunk(audio_wav, start, length, chunk)

        result = _transcribe_chunk(chunk, language)
        detected_lang = detected_lang or result.get("language", "")
        for seg in result.get("segments", []):
            segments.append({
                "start": round(seg["start"] + start, 2),
                "end": round(seg["end"] + start, 2),
                "text": (seg.get("text") or "").strip(),
            })
        chunk.unlink(missing_ok=True)

    return detected_lang, segments