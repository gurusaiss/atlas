"""Renders an Atlas report's markdown + findings into a downloadable PDF via reportlab."""

import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

SEVERITY_COLORS = {
    "critical": colors.HexColor("#ef4444"),
    "high": colors.HexColor("#f97316"),
    "medium": colors.HexColor("#f59e0b"),
    "low": colors.HexColor("#3b82f6"),
    "info": colors.HexColor("#6b7280"),
}


def _markdown_to_paragraphs(markdown_text: str, styles) -> list:
    """Minimal markdown rendering: headings and paragraphs only (no tables/links).

    A full markdown-to-PDF pipeline is out of scope here -- this covers what the
    Documentation Agent actually produces (headings + prose + code fences).
    """
    elements = []
    in_code_block = False
    code_lines: list[str] = []

    for line in markdown_text.splitlines():
        if line.strip().startswith("```"):
            if in_code_block:
                code_text = "<br/>".join(code_line.replace(" ", "&nbsp;") for code_line in code_lines)
                elements.append(Paragraph(code_text, styles["Code"]))
                code_lines = []
            in_code_block = not in_code_block
            continue
        if in_code_block:
            code_lines.append(line)
            continue

        stripped = line.strip()
        if not stripped:
            elements.append(Spacer(1, 6))
        elif stripped.startswith("### "):
            elements.append(Paragraph(stripped[4:], styles["Heading3"]))
        elif stripped.startswith("## "):
            elements.append(Paragraph(stripped[3:], styles["Heading2"]))
        elif stripped.startswith("# "):
            elements.append(Paragraph(stripped[2:], styles["Heading1"]))
        else:
            elements.append(Paragraph(stripped, styles["BodyText"]))

    return elements


def generate_report_pdf(title: str, markdown_content: str, findings: list[dict]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.75 * inch, bottomMargin=0.75 * inch)

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(name="Code", fontName="Courier", fontSize=8, leading=10, backColor=colors.HexColor("#f3f4f6"))
    )

    elements = [Paragraph(title, styles["Title"]), Spacer(1, 12)]
    elements.extend(_markdown_to_paragraphs(markdown_content or "_No documentation generated._", styles))

    if findings:
        elements.append(Spacer(1, 20))
        elements.append(Paragraph("Security Findings", styles["Heading1"]))
        elements.append(Spacer(1, 8))

        table_data = [["Severity", "Category", "File", "Line", "Title"]]
        for f in findings:
            table_data.append(
                [
                    (f.get("severity") or "").upper(),
                    f.get("owasp_category") or f.get("category") or "",
                    f.get("file_path") or "",
                    str(f.get("line_start") or ""),
                    (f.get("title") or "")[:60],
                ]
            )

        table = Table(table_data, colWidths=[0.7 * inch, 0.8 * inch, 1.8 * inch, 0.5 * inch, 2.7 * inch])
        style_commands = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]
        for row_idx, f in enumerate(findings, start=1):
            severity_color = SEVERITY_COLORS.get((f.get("severity") or "").lower())
            if severity_color:
                style_commands.append(("TEXTCOLOR", (0, row_idx), (0, row_idx), severity_color))
        table.setStyle(TableStyle(style_commands))
        elements.append(table)

    doc.build(elements)
    return buffer.getvalue()
