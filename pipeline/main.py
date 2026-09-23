"""Pipeline entry point.

Runs one batch: claims pending YouTube-linked videos from Neon, downloads them
from YouTube, transcribes (Groq), detects scenes (PySceneDetect), drafts
highlights (Gemini), and writes results back to Neon.

Usage:  python pipeline/main.py
"""
from __future__ import annotations

import shutil
import sys
import traceback
from pathlib import Path

import db
import highlight
import scenes as scenedetect_mod
import youtube
from config import cfg
from transcribe import transcribe


def process_one(conn, row: dict) -> None:
    video_id = str(row["id"])
    code = row["code"]
    url = row["youtube_url"]
    print(f"\n=== [{code}] {url}")

    work = Path(cfg.work_dir) / video_id
    if work.exists():
        shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True, exist_ok=True)

    try:
        print("  fetching metadata…")
        meta = youtube.metadata(url)
        print(f"    title: {meta.get('title')}  dur: {meta.get('duration')}s")

        print("  downloading audio…")
        audio = youtube.download_audio_wav(url, work / "audio.wav")

        print("  transcribing (Groq)…")
        language, segments = transcribe(audio, work / "chunks")
        print(f"    {len(segments)} segments, lang={language}")
        db.save_transcript(conn, video_id, language, cfg.groq_whisper_model, segments)

        print("  downloading low-res video…")
        video = youtube.download_video_lowres(url, work / "video.mp4")

        print("  detecting scenes…")
        scene_list = scenedetect_mod.detect(video, work, video_id)
        print(f"    {len(scene_list)} scenes")
        db.save_scenes(conn, video_id, scene_list)

        print("  drafting highlights (Gemini)…")
        notes = highlight.draft(segments)
        print(f"    {len(notes)} draft notes")
        if notes:
            db.save_ai_notes(conn, video_id, notes)

        db.mark_done(conn, video_id)
        print("  done.")
    except Exception as exc:  # noqa: BLE001
        traceback.print_exc()
        db.mark_error(conn, video_id, f"{type(exc).__name__}: {exc}")
        print(f"  FAILED: {exc}")
    finally:
        shutil.rmtree(work, ignore_errors=True)


def main() -> int:
    missing = cfg.validate()
    if missing:
        print("Missing required env:", ", ".join(missing))
        return 1

    conn = db.connect()
    try:
        db.reset_stuck(conn)
        batch = db.claim_pending(conn, cfg.poll_batch_size)
        print(f"Claimed {len(batch)} video(s) for analysis.")
        for row in batch:
            process_one(conn, row)
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())