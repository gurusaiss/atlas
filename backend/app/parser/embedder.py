"""Embeds code chunks into a per-repository ChromaDB collection.

Primary embedding model is Google's text-embedding-004 (free tier, 768-dim).
If no Gemini key is configured (or a call fails), falls back to a local
sentence-transformers model so embedding never blocks on an external API.
Never re-embeds a chunk that already has a chroma_id -- embeddings are the
most expensive/rate-limited step in the pipeline, so this cache is permanent
(unlike the 24h LLM response cache).
"""

import logging
import uuid
from functools import lru_cache

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config import get_settings
from app.parser.chunker import CodeChunk

logger = logging.getLogger("atlas.embedder")
settings = get_settings()

GEMINI_EMBEDDING_MODEL = "models/text-embedding-004"
FALLBACK_MODEL_NAME = "all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def _get_chroma_client() -> chromadb.ClientAPI:
    return chromadb.PersistentClient(
        path=settings.chroma_persist_dir, settings=ChromaSettings(anonymized_telemetry=False)
    )


def get_repository_collection(repository_id: str):
    client = _get_chroma_client()
    return client.get_or_create_collection(
        name=f"repo_{repository_id}", metadata={"hnsw:space": "cosine"}
    )


@lru_cache(maxsize=1)
def _get_fallback_model():
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(FALLBACK_MODEL_NAME)


def _embed_with_gemini(texts: list[str]) -> list[list[float]] | None:
    if not settings.gemini_api_key:
        return None
    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)
        result = genai.embed_content(model=GEMINI_EMBEDDING_MODEL, content=texts)
        embeddings = result["embedding"]
        # A single string input returns one vector; a list input returns a list of vectors.
        return embeddings if isinstance(embeddings[0], list) else [embeddings]
    except Exception as exc:
        logger.warning("Gemini embedding call failed, falling back to local model: %s", exc)
        return None


def _embed_with_fallback(texts: list[str]) -> list[list[float]]:
    model = _get_fallback_model()
    vectors = model.encode(texts)
    return [[float(x) for x in v] for v in vectors]


def embed_texts(texts: list[str]) -> tuple[list[list[float]], str]:
    """Returns (vectors, model_used)."""
    if not texts:
        return [], "none"

    gemini_result = _embed_with_gemini(texts)
    if gemini_result is not None:
        return gemini_result, GEMINI_EMBEDDING_MODEL

    return _embed_with_fallback(texts), FALLBACK_MODEL_NAME


def embed_chunks(
    repository_id: str, job_id: str, chunks: list[CodeChunk], already_embedded_chroma_ids: set[str] | None = None
) -> dict[int, str]:
    """Embed and store chunks that don't already have a chroma_id.

    Returns a mapping of chunk_index -> chroma_id for every chunk passed in
    (including previously-embedded ones, unchanged).
    """
    already_embedded_chroma_ids = already_embedded_chroma_ids or set()
    collection = get_repository_collection(repository_id)

    pending = [c for c in chunks if c.chunk_index not in already_embedded_chroma_ids]
    result_map: dict[int, str] = {}

    if not pending:
        return result_map

    vectors, model_used = embed_texts([c.content for c in pending])

    ids = [str(uuid.uuid4()) for _ in pending]
    metadatas = [
        {
            "file_path": c.file_path,
            "start_line": c.start_line,
            "end_line": c.end_line,
            "symbol_name": c.symbol_name or "",
            "language": c.language,
            "chunk_type": c.chunk_type,
            "job_id": job_id,
        }
        for c in pending
    ]

    collection.add(
        ids=ids,
        embeddings=vectors,
        documents=[c.content for c in pending],
        metadatas=metadatas,
    )

    logger.info("Embedded %d chunks for repository %s using %s", len(pending), repository_id, model_used)

    for chunk, chroma_id in zip(pending, ids):
        result_map[chunk.chunk_index] = chroma_id

    return result_map


def query_similar_chunks(repository_id: str, query_text: str, top_k: int = 5) -> list[dict]:
    """RAG retrieval: return the top-k most similar chunks for a query (used by the Documentation Agent)."""
    collection = get_repository_collection(repository_id)
    vectors, _ = embed_texts([query_text])
    if not vectors:
        return []

    results = collection.query(query_embeddings=vectors, n_results=top_k)
    hits = []
    for doc, meta, dist in zip(
        results["documents"][0], results["metadatas"][0], results["distances"][0]
    ):
        hits.append({"content": doc, "metadata": meta, "distance": dist})
    return hits
