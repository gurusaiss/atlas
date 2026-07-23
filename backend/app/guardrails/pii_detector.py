"""Presidio-based PII detection/redaction for text headed into or out of an LLM.

Legacy codebases routinely contain real customer data in fixtures, comments,
or seed scripts. Anything that looks like an email, phone number, SSN, credit
card, or API key/secret gets redacted before the prompt leaves the process.
"""

import re
from dataclasses import dataclass
from functools import lru_cache

# Fast regex pre-filter for secrets Presidio's default recognizers don't cover well.
SECRET_PATTERNS = {
    "API_KEY": re.compile(r"\b(?:sk|pk|api|key)[-_][A-Za-z0-9_-]{10,}\b", re.IGNORECASE),
    "AWS_KEY": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "GENERIC_SECRET": re.compile(r"(?i)(password|secret|token)\s*[:=]\s*['\"][^'\"]{6,}['\"]"),
}

# Regex fallback for common PII, used when Presidio's NLP-based recognizers are
# unavailable (e.g. no spaCy model installed) so PII scanning is never a total no-op.
FALLBACK_PII_PATTERNS = {
    "EMAIL_ADDRESS": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    "PHONE_NUMBER": re.compile(r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"),
    "US_SSN": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "CREDIT_CARD": re.compile(r"\b(?:\d[ -]*?){13,16}\b"),
}

# Presidio's URL recognizer treats any bare "word.ext" token as a candidate URL --
# in a codebase-analysis product, that's overwhelmingly a source file reference
# ("app.py", "ghost.py", "UserService.java"), not a real URL. Every other agent
# output in Atlas is *about* source code, so this false-positive class is common
# enough to actively corrupt legitimate JSON/text content. Filter URL matches that
# look like bare source filenames rather than disabling URL detection entirely
# (a real "http://evil.example/x" pasted into a code comment should still be caught).
SOURCE_FILE_EXTENSIONS = (
    ".py", ".java", ".js", ".jsx", ".ts", ".tsx", ".go", ".rb", ".php", ".c", ".cpp",
    ".h", ".hpp", ".cs", ".rs", ".yaml", ".yml", ".json", ".toml", ".md", ".txt",
    ".sql", ".html", ".css", ".sh", ".xml", ".gradle", ".kt", ".swift",
)
_BARE_SOURCE_FILENAME_RE = re.compile(
    r"^[A-Za-z0-9_/.\\-]+(" + "|".join(re.escape(ext) for ext in SOURCE_FILE_EXTENSIONS) + r")$"
)


def _looks_like_source_filename(text: str) -> bool:
    return bool(_BARE_SOURCE_FILENAME_RE.match(text.strip())) and "://" not in text


def _redact_fallback_pii(text: str) -> tuple[str, list[str]]:
    found = []
    redacted = text
    for label, pattern in FALLBACK_PII_PATTERNS.items():
        if pattern.search(redacted):
            found.append(label)
            redacted = pattern.sub(f"[REDACTED_{label}]", redacted)
    return redacted, found


@dataclass
class PIIScanResult:
    has_pii: bool
    entity_types: list[str]
    redacted_text: str
    original_length: int
    processed_length: int


# Explicitly pinned to the small (~12MB) spaCy model, pre-installed at Docker build
# time (see Dockerfile). Presidio's default ("en_core_web_lg", ~400MB) will silently
# auto-download over the network on first use if not already present -- a multi-minute
# surprise mid-demo. Never let that happen implicitly.
SPACY_MODEL_NAME = "en_core_web_sm"


@lru_cache(maxsize=1)
def _get_presidio_analyzer():
    from presidio_analyzer import AnalyzerEngine
    from presidio_analyzer.nlp_engine import NlpEngineProvider

    nlp_configuration = {
        "nlp_engine_name": "spacy",
        "models": [{"lang_code": "en", "model_name": SPACY_MODEL_NAME}],
    }
    provider = NlpEngineProvider(nlp_configuration=nlp_configuration)
    return AnalyzerEngine(nlp_engine=provider.create_engine())


@lru_cache(maxsize=1)
def _get_presidio_anonymizer():
    from presidio_anonymizer import AnonymizerEngine

    return AnonymizerEngine()


def _redact_secrets(text: str) -> tuple[str, list[str]]:
    found = []
    redacted = text
    for label, pattern in SECRET_PATTERNS.items():
        if pattern.search(redacted):
            found.append(label)
            redacted = pattern.sub(f"[REDACTED_{label}]", redacted)
    return redacted, found


def scan_and_redact(text: str, language: str = "en") -> PIIScanResult:
    original_length = len(text)
    redacted, secret_labels = _redact_secrets(text)

    try:
        analyzer = _get_presidio_analyzer()
        anonymizer = _get_presidio_anonymizer()
        results = analyzer.analyze(text=redacted, language=language)
        results = [
            r
            for r in results
            if not (r.entity_type == "URL" and _looks_like_source_filename(redacted[r.start : r.end]))
        ]
        if results:
            anonymized = anonymizer.anonymize(text=redacted, analyzer_results=results)
            redacted = anonymized.text
            entity_types = sorted({r.entity_type for r in results}) + secret_labels
        else:
            entity_types = secret_labels
    except Exception:
        # Presidio's spaCy model may not be installed in constrained environments;
        # fall back to regex-based PII detection so this check is never a total no-op.
        redacted, fallback_labels = _redact_fallback_pii(redacted)
        entity_types = secret_labels + fallback_labels

    return PIIScanResult(
        has_pii=bool(entity_types),
        entity_types=entity_types,
        redacted_text=redacted,
        original_length=original_length,
        processed_length=len(redacted),
    )
