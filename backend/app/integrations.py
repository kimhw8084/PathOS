from dataclasses import dataclass
from typing import Any

from .config import config_value


@dataclass
class IntegrationAdapter:
    provider: str
    config: dict[str, Any]


class AuthAdapter(IntegrationAdapter):
    pass


class StorageAdapter(IntegrationAdapter):
    pass


class NotificationAdapter(IntegrationAdapter):
    pass


def load_integration_registry() -> dict[str, IntegrationAdapter]:
    auth = AuthAdapter(
        provider=str(config_value("integrations", "auth", "provider", default="local")),
        config=dict(config_value("integrations", "auth", default={})),
    )
    storage = StorageAdapter(
        provider=str(config_value("integrations", "storage", "provider", default="local_uploads")),
        config=dict(config_value("integrations", "storage", default={})),
    )
    notifications = NotificationAdapter(
        provider=str(config_value("integrations", "notifications", "provider", default="in_app")),
        config=dict(config_value("integrations", "notifications", default={})),
    )
    return {
        "auth": auth,
        "storage": storage,
        "notifications": notifications,
    }
