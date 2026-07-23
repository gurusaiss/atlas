"""Semantic chunking at function/class boundaries for RAG embedding.

Fixed-character chunking splits mid-function and destroys the context an LLM
needs to reason about a code unit. Chunking at AST boundaries keeps every
chunk a complete, self-describing unit (one function, one class header, or
one logical block of a large function).
"""

from dataclasses import dataclass, field

from app.parser.ast_parser import FileParseResult

MAX_CHUNK_TOKENS = 512
OVERLAP_TOKENS = 50
# Rough heuristic: ~4 characters per token for source code (no tokenizer call needed pre-embedding).
CHARS_PER_TOKEN = 4
MAX_CHUNK_CHARS = MAX_CHUNK_TOKENS * CHARS_PER_TOKEN
OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN


@dataclass
class CodeChunk:
    file_path: str
    chunk_index: int
    content: str
    chunk_type: str  # function, class, module, block
    start_line: int
    end_line: int
    symbol_name: str | None
    language: str
    estimated_tokens: int = field(init=False)

    def __post_init__(self):
        self.estimated_tokens = max(1, len(self.content) // CHARS_PER_TOKEN)


def _split_large_block(text: str, start_line: int) -> list[tuple[str, int, int]]:
    """Split an oversized function body at line boundaries with a small overlap."""
    lines = text.splitlines()
    chunks: list[tuple[str, int, int]] = []

    i = 0
    lines_per_chunk = max(1, MAX_CHUNK_CHARS // max(1, (len(text) // max(1, len(lines)))))
    overlap_lines = max(1, OVERLAP_CHARS // max(1, (len(text) // max(1, len(lines)))))

    while i < len(lines):
        block_lines = lines[i : i + lines_per_chunk]
        block_text = "\n".join(block_lines)
        chunks.append((block_text, start_line + i, start_line + i + len(block_lines) - 1))
        if i + lines_per_chunk >= len(lines):
            break
        i += lines_per_chunk - overlap_lines

    return chunks


def chunk_file(parse_result: FileParseResult, source_text: str = "") -> list[CodeChunk]:
    chunks: list[CodeChunk] = []
    index = 0

    for cls in parse_result.classes:
        header_end = min(cls.start_line + 5, cls.end_line)
        chunks.append(
            CodeChunk(
                file_path=parse_result.file_path,
                chunk_index=index,
                content=f"class {cls.name}({', '.join(cls.parent_classes)}):",
                chunk_type="class",
                start_line=cls.start_line,
                end_line=header_end,
                symbol_name=cls.name,
                language=parse_result.language,
            )
        )
        index += 1

    for fn in parse_result.functions:
        if len(fn.body_text) <= MAX_CHUNK_CHARS:
            chunks.append(
                CodeChunk(
                    file_path=parse_result.file_path,
                    chunk_index=index,
                    content=fn.body_text,
                    chunk_type="function",
                    start_line=fn.start_line,
                    end_line=fn.end_line,
                    symbol_name=fn.name,
                    language=parse_result.language,
                )
            )
            index += 1
        else:
            for block_text, block_start, block_end in _split_large_block(fn.body_text, fn.start_line):
                chunks.append(
                    CodeChunk(
                        file_path=parse_result.file_path,
                        chunk_index=index,
                        content=block_text,
                        chunk_type="block",
                        start_line=block_start,
                        end_line=block_end,
                        symbol_name=fn.name,
                        language=parse_result.language,
                    )
                )
                index += 1

    if not chunks and source_text:
        # No functions/classes found (e.g. a config or script file) -- chunk the whole module.
        for block_text, block_start, block_end in _split_large_block(source_text, 1):
            chunks.append(
                CodeChunk(
                    file_path=parse_result.file_path,
                    chunk_index=index,
                    content=block_text,
                    chunk_type="module",
                    start_line=block_start,
                    end_line=block_end,
                    symbol_name=None,
                    language=parse_result.language,
                )
            )
            index += 1

    return chunks
