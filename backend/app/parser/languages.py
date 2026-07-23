"""tree-sitter language + parser registry.

Chosen because tree-sitter is the same incremental parser used by GitHub
Copilot, VS Code, and Neovim -- it tolerates malformed/incomplete code, which
real legacy codebases frequently are.
"""

from functools import lru_cache

import tree_sitter_java as tsjava
import tree_sitter_javascript as tsjavascript
import tree_sitter_python as tspython
from tree_sitter import Language, Parser

EXTENSION_LANGUAGE_MAP = {
    ".py": "python",
    ".java": "java",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
}

_LANGUAGE_MODULES = {
    "python": tspython,
    "java": tsjava,
    "javascript": tsjavascript,
}


@lru_cache(maxsize=None)
def get_language(name: str) -> Language:
    if name not in _LANGUAGE_MODULES:
        raise ValueError(f"Unsupported language: {name}")
    module = _LANGUAGE_MODULES[name]
    return Language(module.language(), name)


@lru_cache(maxsize=None)
def get_parser(name: str) -> Parser:
    parser = Parser()
    parser.set_language(get_language(name))
    return parser


def detect_language(file_path: str) -> str | None:
    for ext, language in EXTENSION_LANGUAGE_MAP.items():
        if file_path.endswith(ext):
            return language
    return None
