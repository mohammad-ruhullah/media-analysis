# Worker

Reserved for a long-running orchestrator (queue + retries + scheduled dispatch) if the
GitHub Actions polling approach is later replaced by an always-on worker.

The current design is fully serverless: `.github/workflows/pipeline.yml` polls Neon on a
schedule and runs `pipeline/main.py`. No worker process is required.

The Mode-A rough-cut can also be dispatched here or from a GitHub Actions
`workflow_dispatch`; the editor UI currently generates ready-to-run `yt-dlp` + `ffmpeg`
commands, which works with zero extra infrastructure.