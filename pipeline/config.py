"""Pipeline configuration, read from environment."""
import os


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


class Config:
    database_url: str = os.getenv("DATABASE_URL_UNPOOLED") or os.getenv("DATABASE_URL", "")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_whisper_model: str = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")

    r2_account_id: str = os.getenv("R2_ACCOUNT_ID", "")
    r2_access_key: str = os.getenv("R2_ACCESS_KEY_ID", "")
    r2_secret_key: str = os.getenv("R2_SECRET_ACCESS_KEY", "")
    r2_bucket: str = os.getenv("R2_BUCKET", "media-analysis")
    r2_endpoint: str = os.getenv("R2_ENDPOINT", "")
    r2_public_base: str = os.getenv("R2_PUBLIC_BASE_URL", "")

    poll_batch_size: int = _int("POLL_BATCH_SIZE", 3)
    whisper_max_seconds: int = _int("WHISPER_MAX_SECONDS_PER_VIDEO", 14400)
    scene_min_len_seconds: int = _int("SCENE_MIN_LEN_SECONDS", 2)
    keyframe_height: int = _int("KEYFRAME_HEIGHT", 480)

    work_dir: str = os.getenv("PIPELINE_WORK_DIR", "pipeline/out")

    @classmethod
    def validate(cls) -> list[str]:
        missing = []
        if not cls.database_url:
            missing.append("DATABASE_URL")
        if not cls.groq_api_key:
            missing.append("GROQ_API_KEY")
        return missing


cfg = Config()