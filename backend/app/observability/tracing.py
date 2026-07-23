"""OpenTelemetry tracing setup, per Part J.

Instruments FastAPI (request spans) automatically; agents/LLM client add
child spans explicitly via `tracer.start_as_current_span(...)` at their own
call sites. Exports via OTLP if OTEL_EXPORTER_OTLP_ENDPOINT is configured
(e.g. Grafana Cloud Tempo); otherwise spans are created but not exported,
which is a safe no-op for local development.
"""

import logging

from opentelemetry import trace
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

from app.config import get_settings

logger = logging.getLogger("atlas.tracing")
settings = get_settings()

_configured = False


def configure_tracing(app, service_name: str = "atlas-backend") -> None:
    global _configured
    if _configured:
        return

    resource = Resource(attributes={SERVICE_NAME: service_name})
    provider = TracerProvider(resource=resource)

    if settings.otel_exporter_otlp_endpoint:
        try:
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

            exporter = OTLPSpanExporter(endpoint=settings.otel_exporter_otlp_endpoint)
            provider.add_span_processor(BatchSpanProcessor(exporter))
            logger.info("OTLP tracing exporter configured: %s", settings.otel_exporter_otlp_endpoint)
        except Exception:
            logger.exception("Failed to configure OTLP exporter; falling back to console exporter")
            provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
    elif settings.debug:
        # In local dev with no OTLP endpoint configured, spans print to console so
        # tracing code paths are still exercised without requiring Grafana Cloud.
        provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))

    trace.set_tracer_provider(provider)

    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

    FastAPIInstrumentor.instrument_app(app)
    _configured = True


def get_tracer(name: str):
    return trace.get_tracer(name)
