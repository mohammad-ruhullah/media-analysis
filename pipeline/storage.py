"""Cloudflare R2 storage (S3-compatible) for keyframes."""
from __future__ import annotations

from pathlib import Path

import boto3

from config import cfg

_client = None


def client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=cfg.r2_endpoint or None,
            aws_access_key_id=cfg.r2_access_key,
            aws_secret_access_key=cfg.r2_secret_key,
            region_name="auto",
        )
    return _client


def upload_file(local: Path, key: str, content_type: str = "image/jpeg") -> str:
    c = client()
    c.upload_file(
        str(local), cfg.r2_bucket, key,
        ExtraArgs={"ContentType": content_type},
    )
    if cfg.r2_public_base:
        return f"{cfg.r2_public_base.rstrip('/')}/{key}"
    # Fall back to a long-lived presigned URL.
    return c.generate_presigned_url(
        "get_object",
        Params={"Bucket": cfg.r2_bucket, "Key": key},
        ExpiresIn=7 * 24 * 3600,
    )