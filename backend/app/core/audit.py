from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.models import AuditLog
import json

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

def prepare_state(state):
    if state is None:
        return None
    # Use the encoder to serialize and then back to dict to ensure compatibility with JSON column
    return json.loads(json.dumps(state, cls=DateTimeEncoder))

async def log_audit(
    db: AsyncSession,
    action_type: str,
    table_name: str,
    record_id: int,
    previous_state: dict = None,
    new_state: dict = None,
    user_id: str = "system_user",
    description: str = None
):
    """
    Creates an audit log entry.
    """
    audit_entry = AuditLog(
        action_type=action_type,
        table_name=table_name,
        record_id=record_id,
        previous_state=prepare_state(previous_state),
        new_state=prepare_state(new_state),
        user_id=user_id,
        description=description
    )
    db.add(audit_entry)
    # We don't commit here, we assume the caller will commit as part of the transaction
