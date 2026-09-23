"""Scene detection + keyframe extraction with PySceneDetect, keyframes -> R2."""
from __future__ import annotations

import csv
import subprocess
from pathlib import Path
from urllib.parse import quote

from config import cfg
from storage import upload_file


def _run_scenedetect(video: Path, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    p = subprocess.run(
        [
            "scenedetect",
            "-i", str(video),
            "-o", str(out_dir),
            "detect-adaptive",
            "list-scenes",
            "save-images",
            "--image-height", str(cfg.keyframe_height),
            "--num-images", "1",
        ],
        capture_output=True, text=True,
    )
    if p.returncode != 0:
        raise RuntimeError(f"scenedetect failed: {p.stderr.strip()[:400]}")
    csvs = list(out_dir.glob("*Scenes.csv"))
    if not csvs:
        # No cuts found: treat the whole video as one scene.
        return None
    return csvs[0]


def _parse_csv(csv_path: Path) -> list[dict]:
    scenes = []
    with open(csv_path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for i, row in enumerate(reader, start=1):
            try:
                start = float(row.get("Start Time (seconds)") or row.get("Start Time (seconds)".strip()))
                end = float(row.get("End Time (seconds)"))
            except (TypeError, ValueError):
                continue
            scenes.append({"index": i, "start": round(start, 2), "end": round(end, 2)})
    return scenes


def detect(video: Path, work_dir: Path, video_id: str) -> list[dict]:
    out_dir = work_dir / "scenes"
    csv_path = _run_scenedetect(video, out_dir)
    if csv_path is None:
        return []

    scenes = _parse_csv(csv_path)

    # Map generated keyframe images (Scene-001.jpg ...) to scenes.
    images = sorted(out_dir.glob("*Scene-*.jpg"))
    for scene, img in zip(scenes, images):
        key = f"keyframes/{video_id}/{img.name}"
        try:
            scene["keyframe_url"] = upload_file(img, key)
        except Exception as exc:  # storage failure must not kill the job
            scene["keyframe_url"] = None
            print(f"  keyframe upload failed: {exc}")

    return scenes