"""Server-Sent Events helper: formats a dict as one SSE `data:` frame."""

import json


def sse_event(event_type: str, data: dict) -> str:
    payload = {"type": event_type, **data}
    return f"data: {json.dumps(payload)}\n\n"
