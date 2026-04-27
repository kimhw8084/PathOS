import copy
import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any


PROFILE_VERSION = 1
ROOT_DIR = Path(__file__).resolve().parents[2]
CONFIG_DIR = Path(os.getenv("PATHOS_CONFIG_DIR", ROOT_DIR / "config"))
BASE_CONFIG_PATH = CONFIG_DIR / "base.json"
PROFILE_DIR = CONFIG_DIR / "profiles"


def _load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise ValueError(f"Configuration file {path} must contain a JSON object")
    return payload


def _deep_merge(base: dict[str, Any], overlay: dict[str, Any]) -> dict[str, Any]:
    merged = copy.deepcopy(base)
    for key, value in overlay.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = copy.deepcopy(value)
    return merged


def _set_path(payload: dict[str, Any], path: tuple[str, ...], value: Any) -> None:
    cursor = payload
    for segment in path[:-1]:
        existing = cursor.get(segment)
        if not isinstance(existing, dict):
            existing = {}
            cursor[segment] = existing
        cursor = existing
    cursor[path[-1]] = value


def _apply_env_overrides(config: dict[str, Any]) -> dict[str, Any]:
    overridden = copy.deepcopy(config)
    mapping: dict[str, tuple[str, ...]] = {
        "PATHOS_APP_NAME": ("app", "name"),
        "PATHOS_SHORT_NAME": ("app", "short_name"),
        "PATHOS_APP_DESCRIPTION": ("app", "description"),
        "PATHOS_ORG_NAME": ("organization", "name"),
        "PATHOS_AUTH_MODE": ("organization", "auth_mode"),
        "PATHOS_ACTIVE_MEMBER_EMAIL": ("organization", "active_member_email"),
        "HOST": ("network", "backend", "host"),
        "PORT": ("network", "backend", "port"),
        "ALLOWED_ORIGINS": ("network", "backend", "allowed_origins"),
        "VITE_HOST": ("network", "frontend", "host"),
        "VITE_PORT": ("network", "frontend", "port"),
        "VITE_API_URL": ("network", "frontend", "api_url"),
        "DATABASE_URL": ("database", "url"),
        "SQLITE_BUSY_TIMEOUT": ("database", "sqlite_busy_timeout"),
        "PATHOS_UPLOAD_DIR": ("storage", "upload_dir"),
        "PATHOS_NOTIFICATION_PROVIDER": ("integrations", "notifications", "provider"),
        "PATHOS_STORAGE_PROVIDER": ("integrations", "storage", "provider"),
        "PATHOS_AUTH_PROVIDER": ("integrations", "auth", "provider"),
    }
    for env_key, path in mapping.items():
        raw = os.getenv(env_key)
        if raw is None or raw == "":
            continue
        if path[-1] in {"port", "sqlite_busy_timeout"}:
            try:
                value: Any = int(raw)
            except ValueError:
                value = raw
        elif path[-1] == "allowed_origins":
            value = [item.strip() for item in raw.split(",") if item.strip()]
        else:
            value = raw
        _set_path(overridden, path, value)
    return overridden


def _profile_name() -> str:
    return os.getenv("PATHOS_PROFILE", "").strip()


@lru_cache(maxsize=1)
def get_profile_config() -> dict[str, Any]:
    if not BASE_CONFIG_PATH.exists():
        raise FileNotFoundError(f"Missing base configuration at {BASE_CONFIG_PATH}")
    config = _load_json(BASE_CONFIG_PATH)
    selected_profile = _profile_name()
    warnings: list[str] = []
    if selected_profile:
      profile_path = PROFILE_DIR / f"{selected_profile}.json"
      if profile_path.exists():
          config = _deep_merge(config, _load_json(profile_path))
      else:
          warnings.append(f"Profile `{selected_profile}` not found. Falling back to base configuration.")
    config = _apply_env_overrides(config)
    profile_version = int(config.get("profile_version") or 0)
    if profile_version < PROFILE_VERSION:
        warnings.append(
            f"Profile version {profile_version} is older than supported version {PROFILE_VERSION}. Missing keys were backfilled from base defaults."
        )
    config["profile_version"] = PROFILE_VERSION
    config["_meta"] = {
        "selected_profile": selected_profile or "base",
        "config_dir": str(CONFIG_DIR),
        "warnings": warnings,
    }
    return config


def config_value(*path: str, default: Any = None) -> Any:
    cursor: Any = get_profile_config()
    for segment in path:
        if not isinstance(cursor, dict):
            return default
        cursor = cursor.get(segment)
        if cursor is None:
            return default
    return cursor


def get_upload_dir() -> Path:
    path = Path(config_value("storage", "upload_dir", default="backend/uploads"))
    return path if path.is_absolute() else ROOT_DIR / path
