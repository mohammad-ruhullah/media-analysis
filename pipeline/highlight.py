"""Highlight drafting with Google Gemini (free tier)."""
from __future__ import annotations

import json
import re

import requests

from config import cfg


def _fmt(seconds: float) -> str:
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


PROMPT = """You are helping a social-media editor find the most publishable moments
in a documentary. Below is a timestamped transcript. Identify 8 to 15 segments
that would work as short vertical social clips (30-90 seconds each).

For each segment return a JSON object with:
- "start_seconds": number (start time)
- "end_seconds": number (end time, keep 30-90s long)
- "title": short punchy clip title
- "caption": 1-2 sentence social caption
- "hashtags": array of 3-6 hashtags (with #)
- "hook": the opening line / hook that grabs attention
- "reason": why this moment is compelling
- "score": number 1-10 (publishability)

Return ONLY a JSON array of these objects, no prose.

TRANSCRIPT:
"""


def _build_transcript(segments: list[dict], max_chars: int = 400_000) -> str:
    lines = []
    total = 0
    for seg in segments:
        line = f"[{_fmt(seg['start'])}] {seg['text']}"
        total += len(line) + 1
        if total > max_chars:
            lines.append("... (transcript truncated)")
            break
        lines.append(line)
    return "\n".join(lines)


def _parse_json(text: str) -> list[dict]:
    text = text.strip()
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass
    match = re.search(r"\[.*\]", text, re.S)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return []
    return []


def draft(segments: list[dict]) -> list[dict]:
    if not cfg.gemini_api_key or not segments:
        return []

    prompt = PROMPT + _build_transcript(segments)
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{cfg.gemini_model}:generateContent"
    )
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.4,
        },
    }
    resp = requests.post(
        url,
        headers={"x-goog-api-key": cfg.gemini_api_key, "Content-Type": "application/json"},
        json=body,
        timeout=300,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Gemini {resp.status_code}: {resp.text[:400]}")

    data = resp.json()
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        return []

    notes = []
    for item in _parse_json(text):
        try:
            notes.append({
                "start_seconds": float(item.get("start_seconds", 0)),
                "end_seconds": float(item.get("end_seconds", 0)),
                "title": str(item.get("title", ""))[:500],
                "caption": str(item.get("caption", "")),
                "hashtags": [str(h) for h in item.get("hashtags", [])][:10],
                "hook": str(item.get("hook", "")),
                "reason": str(item.get("reason", "")),
                "score": float(item.get("score", 0)) if item.get("score") is not None else None,
            })
        except (TypeError, ValueError):
            continue
    notes.sort(key=lambda n: n.get("score") or 0, reverse=True)
    return notes