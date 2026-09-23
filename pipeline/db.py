"""Neon Postgres access for the pipeline."""
from __future__ import annotations

import json
from typing import Any

import psycopg2
import psycopg2.extras

from config import cfg


def connect():
    if not cfg.database_url:
        raise RuntimeError("DATABASE_URL is not set")
    conn = psycopg2.connect(cfg.database_url, sslmode="require")
    conn.autocommit = False
    return conn


def claim_pending(conn, limit: int) -> list[dict[str, Any]]:
    """Atomically claim up to `limit` videos that have a YouTube link and are
    waiting for analysis. Uses SELECT ... FOR UPDATE SKIP LOCKED."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, code, youtube_url
            FROM videos
            WHERE analysis_state = 'pending'
              AND youtube_url IS NOT NULL
              AND youtube_url <> ''
            ORDER BY created_at ASC
            LIMIT %s
            FOR UPDATE SKIP LOCKED
            """,
            (limit,),
        )
        rows = cur.fetchall()
        if rows:
            ids = [r["id"] for r in rows]
            cur.execute(
                """UPDATE videos
                   SET analysis_state = 'processing',
                       analysis_started_at = now(),
                       analysis_error = NULL
                   WHERE id = ANY(%s)""",
                (ids,),
            )
    conn.commit()
    return [dict(r) for r in rows]


def reset_stuck(conn) -> None:
    """Release rows left 'processing' by a crashed/timed-out run."""
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE videos
               SET analysis_state = 'pending'
               WHERE analysis_state = 'processing'
                 AND analysis_started_at < now() - interval '3 hours'"""
        )
    conn.commit()


def save_transcript(conn, video_id: str, language: str, model: str, segments: list[dict]) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM transcripts WHERE video_id = %s", (video_id,))
        cur.execute(
            """INSERT INTO transcripts (video_id, language, model, segments)
               VALUES (%s, %s, %s, %s)""",
            (video_id, language, model, json.dumps(segments)),
        )
    conn.commit()


def save_scenes(conn, video_id: str, scenes: list[dict]) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM scenes WHERE video_id = %s", (video_id,))
        for s in scenes:
            cur.execute(
                """INSERT INTO scenes (video_id, scene_index, start_seconds, end_seconds, keyframe_url)
                   VALUES (%s, %s, %s, %s, %s)""",
                (video_id, s["index"], s["start"], s["end"], s.get("keyframe_url")),
            )
    conn.commit()


def save_ai_notes(conn, video_id: str, notes: list[dict]) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM notes WHERE video_id = %s AND source = 'ai_draft'",
            (video_id,),
        )
        for n in notes:
            cur.execute(
                """INSERT INTO notes
                   (video_id, start_seconds, end_seconds, title, caption, hashtags, hook, reason, score, source, status)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'ai_draft', 'draft')""",
                (
                    video_id,
                    n.get("start_seconds", 0),
                    n.get("end_seconds", 0),
                    n.get("title", "")[:500],
                    n.get("caption", ""),
                    n.get("hashtags", []),
                    n.get("hook", ""),
                    n.get("reason", ""),
                    n.get("score"),
                ),
            )
    conn.commit()


def mark_done(conn, video_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE videos
               SET analysis_state = 'done', analysis_finished_at = now()
               WHERE id = %s""",
            (video_id,),
        )
        cur.execute(
            "INSERT INTO activity_log (video_id, action, detail) VALUES (%s, %s, %s)",
            (video_id, "analysis_completed", json.dumps({})),
        )
    conn.commit()


def mark_error(conn, video_id: str, message: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE videos
               SET analysis_state = 'error', analysis_error = %s, analysis_finished_at = now()
               WHERE id = %s""",
            (message[:2000], video_id),
        )
    conn.commit()