"""Multi-language AST extraction built on tree-sitter.

Walks the concrete syntax tree once per file and pulls out everything the
metrics calculator, call-graph builder, and chunker need: functions, classes,
imports, and call sites. Python and Java are fully supported (the two primary
languages); JavaScript parsing uses the same walker with a reduced node map.
"""

from dataclasses import dataclass, field

from app.parser.languages import detect_language, get_parser

# Node type names differ per grammar. Mapping them here keeps the walker
# language-agnostic instead of branching everywhere on `language == "python"`.
NODE_MAP = {
    "python": {
        "function": {"function_definition"},
        "class": {"class_definition"},
        "import": {"import_statement", "import_from_statement"},
        "call": {"call"},
        "decorated": {"decorated_definition"},
        "async_keyword": "async",
    },
    "java": {
        "function": {"method_declaration", "constructor_declaration"},
        "class": {"class_declaration", "interface_declaration"},
        "import": {"import_declaration"},
        "call": {"method_invocation"},
        "decorated": set(),
        "async_keyword": None,
    },
    "javascript": {
        "function": {"function_declaration", "method_definition", "arrow_function"},
        "class": {"class_declaration"},
        "import": {"import_statement"},
        "call": {"call_expression"},
        "decorated": set(),
        "async_keyword": "async",
    },
}


@dataclass
class FunctionInfo:
    name: str
    start_line: int
    end_line: int
    parameters: list[str] = field(default_factory=list)
    is_method: bool = False
    parent_class: str | None = None
    is_async: bool = False
    decorators: list[str] = field(default_factory=list)
    docstring: str | None = None
    call_sites_inside: list[str] = field(default_factory=list)
    body_text: str = ""


@dataclass
class ClassInfo:
    name: str
    start_line: int
    end_line: int
    methods: list[str] = field(default_factory=list)
    attributes: list[str] = field(default_factory=list)
    parent_classes: list[str] = field(default_factory=list)
    docstring: str | None = None


@dataclass
class ImportInfo:
    module: str
    imported_names: list[str]
    line_number: int
    is_external: bool = True


@dataclass
class CallSite:
    caller_function: str | None
    callee_name: str
    line_number: int


@dataclass
class FileParseResult:
    file_path: str
    language: str
    total_loc: int
    blank_lines: int
    comment_lines: int
    code_lines: int
    functions: list[FunctionInfo] = field(default_factory=list)
    classes: list[ClassInfo] = field(default_factory=list)
    imports: list[ImportInfo] = field(default_factory=list)
    call_sites: list[CallSite] = field(default_factory=list)
    parse_error: str | None = None


def _text(node, source: bytes) -> str:
    return source[node.start_byte : node.end_byte].decode("utf-8", errors="replace")


def _child_by_field(node, field_name: str):
    return node.child_by_field_name(field_name)


def _count_line_types(source_text: str, language: str) -> tuple[int, int, int]:
    comment_prefix = "//" if language in ("java", "javascript") else "#"
    blank = comment = code = 0
    for raw_line in source_text.splitlines():
        line = raw_line.strip()
        if not line:
            blank += 1
        elif line.startswith(comment_prefix) or line.startswith("/*") or line.startswith("*"):
            comment += 1
        else:
            code += 1
    return blank, comment, code


def _extract_python_params(params_node, source: bytes) -> list[str]:
    names = []
    for child in params_node.children:
        if child.type == "identifier":
            names.append(_text(child, source))
        elif child.type in ("default_parameter", "typed_parameter", "typed_default_parameter"):
            name_node = child.child_by_field_name("name") or (child.children[0] if child.children else None)
            if name_node is not None:
                names.append(_text(name_node, source))
    return names


def _extract_java_params(params_node, source: bytes) -> list[str]:
    names = []
    for child in params_node.children:
        if child.type == "formal_parameter":
            name_node = child.child_by_field_name("name")
            if name_node is not None:
                names.append(_text(name_node, source))
    return names


def _extract_decorators(node, source: bytes, language: str) -> tuple[list[str], object]:
    """If wrapped in a `decorated_definition`, return (decorator names, inner def node)."""
    if language != "python" or node.parent is None or node.parent.type != "decorated_definition":
        return [], node
    decorated = node.parent
    decorators = [
        _text(c, source).lstrip("@").split("(")[0].strip()
        for c in decorated.children
        if c.type == "decorator"
    ]
    return decorators, node


def _parse_import(node, source: bytes, language: str) -> tuple[str, list[str]]:
    if language == "python":
        if node.type == "import_from_statement":
            saw_import_kw = False
            module = ""
            names: list[str] = []
            for child in node.children:
                if child.type == "import":
                    saw_import_kw = True
                    continue
                if child.type in ("dotted_name", "relative_import") and not saw_import_kw:
                    module = _text(child, source)
                elif child.type in ("dotted_name", "aliased_import") and saw_import_kw:
                    names.append(_text(child, source).split(" as ")[0])
            return module or "<relative>", names

        names = [
            _text(child, source).split(" as ")[0]
            for child in node.children
            if child.type in ("dotted_name", "aliased_import")
        ]
        return (names[0] if names else "<unknown>"), names

    if language == "java":
        text = _text(node, source).replace("import", "").replace(";", "").strip()
        parts = text.split(".")
        return parts[0], [text]

    text = _text(node, source)
    return text.strip(), []


def _find_enclosing_function(node) -> str | None:
    current = node.parent
    while current is not None:
        if current.type in ("function_definition", "method_declaration", "constructor_declaration"):
            name_node = current.child_by_field_name("name")
            if name_node is not None:
                return name_node.text.decode("utf-8", errors="replace")
        current = current.parent
    return None


def _walk(node, source: bytes, language: str, result: FileParseResult, class_stack: list[str]) -> None:
    node_map = NODE_MAP[language]

    if node.type in node_map["class"]:
        name_node = _child_by_field(node, "name")
        name = _text(name_node, source) if name_node else "<anonymous>"
        parents: list[str] = []

        if language == "python":
            superclasses = _child_by_field(node, "superclasses")
            if superclasses is not None:
                parents = [
                    _text(c, source) for c in superclasses.children if c.type == "identifier"
                ]
        elif language == "java":
            superclass = _child_by_field(node, "superclass")
            if superclass is not None:
                parents = [_text(superclass, source).replace("extends", "").strip()]
            interfaces = _child_by_field(node, "interfaces")
            if interfaces is not None:
                parents.append(_text(interfaces, source).replace("implements", "").strip())

        class_info = ClassInfo(
            name=name,
            start_line=node.start_point[0] + 1,
            end_line=node.end_point[0] + 1,
            parent_classes=[p for p in parents if p],
        )
        result.classes.append(class_info)
        class_stack = class_stack + [name]

    elif node.type in node_map["function"]:
        decorators, def_node = _extract_decorators(node, source, language)
        name_node = _child_by_field(def_node, "name")
        name = _text(name_node, source) if name_node is not None else "<anonymous>"

        params_node = _child_by_field(def_node, "parameters")
        if params_node is None:
            params_node = _child_by_field(def_node, "formal_parameters" if language == "java" else "parameters")

        if params_node is not None:
            parameters = (
                _extract_java_params(params_node, source)
                if language == "java"
                else _extract_python_params(params_node, source)
            )
        else:
            parameters = []

        is_async = False
        if node_map["async_keyword"]:
            is_async = any(
                c.type == node_map["async_keyword"] for c in node.children
            ) or _text(node, source).lstrip().startswith("async ")

        function_info = FunctionInfo(
            name=name,
            start_line=node.start_point[0] + 1,
            end_line=node.end_point[0] + 1,
            parameters=parameters,
            is_method=len(class_stack) > 0,
            parent_class=class_stack[-1] if class_stack else None,
            is_async=is_async,
            decorators=decorators,
            body_text=_text(node, source),
        )
        result.functions.append(function_info)
        if class_stack:
            for cls in result.classes:
                if cls.name == class_stack[-1] and cls.end_line >= function_info.end_line:
                    cls.methods.append(name)
                    break

    elif node.type in node_map["import"]:
        module, imported_names = _parse_import(node, source, language)
        result.imports.append(
            ImportInfo(
                module=module,
                imported_names=imported_names,
                line_number=node.start_point[0] + 1,
                is_external=True,
            )
        )

    elif node.type in node_map["call"]:
        callee_node = _child_by_field(node, "function") or _child_by_field(node, "name")
        callee_name = _text(callee_node, source) if callee_node is not None else "<unknown>"
        callee_name = callee_name.split("(")[0].strip()
        if "." in callee_name:
            callee_name = callee_name.rsplit(".", 1)[-1]

        caller = _find_enclosing_function(node)
        result.call_sites.append(
            CallSite(caller_function=caller, callee_name=callee_name, line_number=node.start_point[0] + 1)
        )
        if caller is not None:
            for fn in result.functions:
                if fn.name == caller and fn.start_line <= node.start_point[0] + 1 <= fn.end_line:
                    fn.call_sites_inside.append(callee_name)
                    break

    for child in node.children:
        _walk(child, source, language, result, class_stack)


def parse_file(file_path: str, source_text: str, language: str | None = None) -> FileParseResult:
    """Parse a single source file and extract functions, classes, imports, and calls."""
    resolved_language = language or detect_language(file_path)
    if resolved_language is None or resolved_language not in NODE_MAP:
        return FileParseResult(
            file_path=file_path,
            language=resolved_language or "unknown",
            total_loc=len(source_text.splitlines()),
            blank_lines=0,
            comment_lines=0,
            code_lines=0,
            parse_error=f"Unsupported language for {file_path}",
        )

    blank, comment, code = _count_line_types(source_text, resolved_language)
    result = FileParseResult(
        file_path=file_path,
        language=resolved_language,
        total_loc=len(source_text.splitlines()),
        blank_lines=blank,
        comment_lines=comment,
        code_lines=code,
    )

    try:
        parser = get_parser(resolved_language)
        source_bytes = source_text.encode("utf-8")
        tree = parser.parse(source_bytes)
        _walk(tree.root_node, source_bytes, resolved_language, result, class_stack=[])
    except Exception as exc:  # tree-sitter tolerates malformed code; this catches our own bugs
        result.parse_error = str(exc)

    return result
