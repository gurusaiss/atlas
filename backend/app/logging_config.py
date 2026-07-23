"""Structured JSON logging setup, per Part J.

Called once at app startup. Every log record is emitted as a single JSON line
with a consistent {timestamp, level, service, message, ...extra} shape.
"""

import logging

from pythonjsonlogger import jsonlogger


def configure_logging(service_name: str = "atlas-backend", level: int = logging.INFO) -> None:
    handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        rename_fields={"asctime": "timestamp", "levelname": "level", "name": "logger"},
        static_fields={"service": service_name},
    )
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(level)

    # Quiet noisy third-party loggers down to WARNING so JSON logs stay signal-heavy.
    for noisy_logger in ("uvicorn.access", "httpx", "chromadb", "sentence_transformers"):
        logging.getLogger(noisy_logger).setLevel(logging.WARNING)
