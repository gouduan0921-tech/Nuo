#!/usr/bin/env python3
"""将《糯酿》项目 Markdown 文档构建为单文件离线阅读器。"""

from __future__ import annotations

import html
import json
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs"
OUTPUT = ROOT / "糯酿文档.html"
FIRST_DOCUMENT = "00_文档地图.md"
LAST_DOCUMENT = "27_开发计划.md"
DOCUMENT_RE = re.compile(r"^(\d{2})_.+\.md$", re.IGNORECASE)


def discover_documents() -> list[Path]:
    """读取 00—28 范围内现有文档，并按两位数字前缀排序。"""
    documents: list[tuple[int, str, Path]] = []
    for path in DOCS_DIR.glob("*.md"):
        match = DOCUMENT_RE.match(path.name)
        if match and 0 <= int(match.group(1)) <= 28:
            documents.append((int(match.group(1)), path.name.casefold(), path))
    documents.sort(key=lambda item: (item[0], item[1]))
    paths = [item[2] for item in documents]

    names = {path.name for path in paths}
    missing_bounds = [
        name for name in (FIRST_DOCUMENT, LAST_DOCUMENT) if name not in names
    ]
    if missing_bounds:
        raise FileNotFoundError(
            "缺少阅读器边界文档：" + "、".join(missing_bounds)
        )
    return paths


DOCUMENTS = discover_documents()
DOCUMENT_BY_NAME = {path.name.casefold(): path for path in DOCUMENTS}
DOCUMENT_BY_STEM = {path.stem.casefold(): path for path in DOCUMENTS}
LOCAL_LINK_COUNT = 0


def plain_title(markdown: str, fallback: str) -> str:
    for line in markdown.splitlines():
        match = re.match(r"^\s*#{1,6}\s+(.+?)\s*#*\s*$", line)
        if match:
            title = re.sub(r"[`*_~]", "", match.group(1))
            return title.strip() or fallback
    return fallback


def local_markdown_target(raw_url: str) -> str | None:
    """把指向本次已嵌入 Markdown 的链接转换为章节 hash。"""
    global LOCAL_LINK_COUNT

    url = html.unescape(raw_url.strip())
    if url.startswith("<") and url.endswith(">"):
        url = url[1:-1].strip()
    split = urlsplit(url)
    if split.scheme or split.netloc:
        return None

    decoded_path = unquote(split.path).replace("\\", "/")
    if not decoded_path.lower().endswith(".md"):
        return None

    filename = Path(decoded_path).name.casefold()
    target = DOCUMENT_BY_NAME.get(filename)
    if target is None:
        target = DOCUMENT_BY_STEM.get(Path(filename).stem.casefold())
    if target is None:
        return None

    LOCAL_LINK_COUNT += 1
    return "#" + target.stem


def render_inline(source: str) -> str:
    """渲染安全的行内 Markdown：代码、链接、粗体与删除线。"""
    tokens: list[str] = []

    def hold(fragment: str) -> str:
        tokens.append(fragment)
        return f"\x00TOKEN{len(tokens) - 1}\x00"

    def code_replace(match: re.Match[str]) -> str:
        return hold("<code>" + html.escape(match.group(1)) + "</code>")

    source = re.sub(r"`([^`\n]+)`", code_replace, source)

    def link_replace(match: re.Match[str]) -> str:
        label = html.escape(match.group(1), quote=False)
        label = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", label)
        raw_url = match.group(2).strip()
        local_target = local_markdown_target(raw_url)
        href = local_target if local_target is not None else html.unescape(raw_url)
        if local_target is None:
            # 阅读器位于项目根目录，非章节链接仍需从原 Markdown 目录重定位。
            parts = urlsplit(href)
            if parts.path and not parts.scheme and not parts.netloc:
                resolved = (DOCS_DIR / unquote(parts.path)).resolve()
                try:
                    relocated = resolved.relative_to(ROOT).as_posix()
                except ValueError:
                    pass
                else:
                    href = parts._replace(path=relocated).geturl()
        href_escaped = html.escape(href, quote=True)
        if local_target is not None:
            return hold(f'<a href="{href_escaped}">{label}</a>')
        return hold(
            f'<a href="{href_escaped}" target="_blank" '
            f'rel="noopener noreferrer">{label}<span class="external-mark" '
            f'aria-hidden="true">↗</span></a>'
        )

    source = re.sub(r"\[([^\]\n]+)\]\(([^)\n]+)\)", link_replace, source)
    rendered = html.escape(source, quote=False)
    rendered = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", rendered)
    rendered = re.sub(r"__(.+?)__", r"<strong>\1</strong>", rendered)
    rendered = re.sub(r"~~(.+?)~~", r"<del>\1</del>", rendered)

    for index, token in enumerate(tokens):
        rendered = rendered.replace(f"\x00TOKEN{index}\x00", token)
    return rendered


def split_table_row(line: str) -> list[str]:
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|") and not line.endswith(r"\|"):
        line = line[:-1]
    cells = re.split(r"(?<!\\)\|", line)
    return [cell.replace(r"\|", "|").strip() for cell in cells]


def is_table_separator(line: str) -> bool:
    cells = split_table_row(line)
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells)


def is_block_start(lines: list[str], index: int) -> bool:
    line = lines[index]
    stripped = line.strip()
    if not stripped:
        return True
    if re.match(r"^\s{0,3}(#{1,6})\s+", line):
        return True
    if re.match(r"^\s{0,3}(```+|~~~+)", line):
        return True
    if re.match(r"^\s{0,3}>\s?", line):
        return True
    if re.match(r"^\s{0,3}(?:[-+*]|\d+[.)])\s+", line):
        return True
    if re.match(r"^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$", line):
        return True
    return (
        index + 1 < len(lines)
        and "|" in line
        and is_table_separator(lines[index + 1])
    )


def render_markdown(markdown: str) -> str:
    """使用标准库渲染项目文档所需的 Markdown 子集。"""
    lines = markdown.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    output: list[str] = []
    index = 0

    while index < len(lines):
        line = lines[index]
        if not line.strip():
            index += 1
            continue

        fence_match = re.match(r"^\s{0,3}(```+|~~~+)\s*([^\s`]*)?.*$", line)
        if fence_match:
            marker = fence_match.group(1)
            language = (fence_match.group(2) or "").strip().lower()
            code_lines: list[str] = []
            index += 1
            while index < len(lines) and not re.match(
                rf"^\s{{0,3}}{re.escape(marker[0])}{{{len(marker)},}}\s*$",
                lines[index],
            ):
                code_lines.append(lines[index])
                index += 1
            if index < len(lines):
                index += 1
            language_class = (
                f' class="language-{html.escape(language, quote=True)}"'
                if language
                else ""
            )
            label = (
                '<div class="code-label">Mermaid 图表源码（离线可读）</div>'
                if language == "mermaid"
                else (
                    f'<div class="code-label">{html.escape(language.upper())}</div>'
                    if language
                    else ""
                )
            )
            output.append(
                '<div class="code-wrap">'
                + label
                + f"<pre><code{language_class}>"
                + html.escape("\n".join(code_lines))
                + "</code></pre></div>"
            )
            continue

        heading_match = re.match(
            r"^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$", line
        )
        if heading_match:
            level = min(len(heading_match.group(1)) + 1, 6)
            output.append(
                f"<h{level}>{render_inline(heading_match.group(2))}</h{level}>"
            )
            index += 1
            continue

        if re.match(r"^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$", line):
            output.append("<hr>")
            index += 1
            continue

        if (
            index + 1 < len(lines)
            and "|" in line
            and is_table_separator(lines[index + 1])
        ):
            headers = split_table_row(line)
            index += 2
            rows: list[list[str]] = []
            while index < len(lines) and "|" in lines[index] and lines[index].strip():
                rows.append(split_table_row(lines[index]))
                index += 1
            column_count = len(headers)
            table = [
                '<div class="table-wrap" tabindex="0" '
                'aria-label="可横向滚动的表格"><table><thead><tr>'
            ]
            table.extend(f"<th scope=\"col\">{render_inline(cell)}</th>" for cell in headers)
            table.append("</tr></thead><tbody>")
            for row in rows:
                normalized = (row + [""] * column_count)[:column_count]
                table.append(
                    "<tr>"
                    + "".join(f"<td>{render_inline(cell)}</td>" for cell in normalized)
                    + "</tr>"
                )
            table.append("</tbody></table></div>")
            output.append("".join(table))
            continue

        if re.match(r"^\s{0,3}>\s?", line):
            quote_lines: list[str] = []
            while index < len(lines) and re.match(r"^\s{0,3}>\s?", lines[index]):
                quote_lines.append(
                    re.sub(r"^\s{0,3}>\s?", "", lines[index], count=1)
                )
                index += 1
            output.append(
                "<blockquote>" + render_markdown("\n".join(quote_lines)) + "</blockquote>"
            )
            continue

        list_match = re.match(r"^\s{0,3}([-+*]|\d+[.)])\s+(.+)$", line)
        if list_match:
            ordered = list_match.group(1)[0].isdigit()
            tag = "ol" if ordered else "ul"
            items: list[str] = []
            while index < len(lines):
                item_match = re.match(
                    r"^\s{0,3}([-+*]|\d+[.)])\s+(.+)$", lines[index]
                )
                if not item_match or item_match.group(1)[0].isdigit() != ordered:
                    break
                item_text = item_match.group(2).strip()
                index += 1
                continuations: list[str] = []
                while (
                    index < len(lines)
                    and re.match(r"^\s{2,}\S", lines[index])
                    and not re.match(
                        r"^\s{0,3}([-+*]|\d+[.)])\s+", lines[index]
                    )
                ):
                    continuations.append(lines[index].strip())
                    index += 1
                if continuations:
                    item_text += " " + " ".join(continuations)
                items.append("<li>" + render_inline(item_text) + "</li>")
            output.append(f"<{tag}>" + "".join(items) + f"</{tag}>")
            continue

        paragraph_lines = [line.strip()]
        index += 1
        while index < len(lines) and not is_block_start(lines, index):
            paragraph_lines.append(lines[index].strip())
            index += 1
        paragraph = " ".join(part for part in paragraph_lines if part)
        output.append("<p>" + render_inline(paragraph) + "</p>")

    return "\n".join(output)


document_data: list[dict[str, str]] = []
for document in DOCUMENTS:
    markdown = document.read_text(encoding="utf-8")
    document_data.append(
        {
            "id": document.stem,
            "number": document.name[:2],
            "title": plain_title(markdown, document.stem),
            "html": render_markdown(markdown),
        }
    )

navigation = "".join(
    (
        f'<a class="nav-link" href="#{html.escape(item["id"], quote=True)}">'
        f'<span class="nav-number">{item["number"]}</span>'
        f'<span>{html.escape(item["title"])}</span></a>'
    )
    for item in document_data
)

sections = "".join(
    (
        f'<section id="{html.escape(item["id"], quote=True)}" class="chapter" '
        f'data-title="{html.escape(item["title"], quote=True)}" tabindex="-1">'
        f'<div class="chapter-kicker">文档 {item["number"]}</div>'
        f'{item["html"]}</section>'
    )
    for item in document_data
)

HTML_TEMPLATE = r"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="theme-color" content="#1a3344">
  <title>糯酿 · 设计文档</title>
  <style>
    :root {
      --forest-950: #142833;
      --forest-900: #1a3344;
      --forest-800: #24485c;
      --forest-700: #2f6278;
      --forest-600: #4d7c90;
      --leaf-300: #b7c9c4;
      --leaf-100: #e4eeea;
      --fiber-50: #fbf6ee;
      --fiber-100: #f6efe4;
      --fiber-200: #eadcc6;
      --fiber-300: #d7b48a;
      --ink: #243038;
      --muted: #667178;
      --accent: #a85a32;
      --sidebar: 316px;
      --shadow: 0 18px 48px rgba(28, 53, 38, .11);
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--ink);
      background:
        radial-gradient(circle at 78% 8%, rgba(169, 195, 156, .3), transparent 25rem),
        repeating-linear-gradient(105deg, rgba(94, 73, 37, .025) 0 1px, transparent 1px 8px),
        var(--fiber-100);
      font: 16px/1.85 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
        "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    }
    a { color: var(--forest-700); text-underline-offset: .22em; }
    a:hover { color: var(--forest-900); }
    button, input { font: inherit; }
    button:focus-visible, input:focus-visible, a:focus-visible, [tabindex]:focus-visible {
      outline: 3px solid #e6b96d;
      outline-offset: 3px;
    }
    .skip-link {
      position: fixed;
      z-index: 100;
      top: 10px;
      left: 12px;
      padding: 8px 12px;
      color: #fff;
      background: var(--forest-950);
      border-radius: 6px;
      transform: translateY(-150%);
    }
    .skip-link:focus { transform: translateY(0); }
    .sidebar {
      position: fixed;
      z-index: 20;
      inset: 0 auto 0 0;
      width: var(--sidebar);
      display: flex;
      flex-direction: column;
      color: #f8f4e8;
      background:
        linear-gradient(155deg, rgba(255,255,255,.055), transparent 28%),
        repeating-linear-gradient(35deg, rgba(244,236,217,.025) 0 1px, transparent 1px 10px),
        var(--forest-900);
      border-right: 1px solid rgba(255,255,255,.1);
      box-shadow: 8px 0 28px rgba(18, 39, 27, .1);
    }
    .brand-block { padding: 28px 24px 18px; }
    .brand-mark {
      display: flex;
      align-items: center;
      gap: 13px;
    }
    .brand-icon {
      width: 50px;
      height: 50px;
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      border: 1px solid rgba(244,236,217,.52);
      border-radius: 50% 42% 50% 38%;
      background:
        repeating-linear-gradient(45deg, rgba(35,75,54,.22) 0 2px, transparent 2px 7px),
        var(--fiber-200);
      color: var(--forest-900);
      font-size: 23px;
      font-weight: 800;
      transform: rotate(-4deg);
    }
    .brand-name {
      margin: 0;
      font-size: 31px;
      line-height: 1;
      letter-spacing: .15em;
      font-weight: 800;
    }
    .brand-subtitle {
      margin: 8px 0 0;
      color: rgba(248,244,232,.7);
      font-size: 12px;
      letter-spacing: .06em;
      line-height: 1.4;
    }
    .search-box { padding: 0 20px 12px; }
    .search-box label {
      display: block;
      margin-bottom: 7px;
      color: rgba(248,244,232,.72);
      font-size: 12px;
    }
    #search {
      width: 100%;
      min-height: 44px;
      padding: 10px 12px 10px 38px;
      color: var(--ink);
      border: 1px solid rgba(255,255,255,.22);
      border-radius: 9px;
      background:
        linear-gradient(90deg, transparent 0 34px, rgba(35,75,54,.12) 34px 35px, transparent 35px),
        #fffdf7;
    }
    .search-field { position: relative; }
    .search-field::before {
      content: "⌕";
      position: absolute;
      z-index: 1;
      left: 12px;
      top: 4px;
      color: var(--forest-700);
      font-size: 23px;
      pointer-events: none;
    }
    #search-status {
      min-height: 25px;
      margin: 7px 2px 0;
      color: var(--leaf-300);
      font-size: 12px;
    }
    .chapter-nav {
      min-height: 0;
      padding: 4px 12px 30px;
      overflow-y: auto;
      scrollbar-color: rgba(244,236,217,.28) transparent;
    }
    .nav-link {
      display: grid;
      grid-template-columns: 36px 1fr;
      gap: 7px;
      align-items: start;
      padding: 10px 10px;
      color: rgba(255,255,255,.78);
      border-left: 2px solid transparent;
      border-radius: 7px;
      text-decoration: none;
      font-size: 13px;
      line-height: 1.45;
    }
    .nav-link[hidden] { display: none; }
    .nav-link:hover { color: #fff; background: rgba(255,255,255,.07); }
    .nav-link.active {
      color: #fff;
      border-left-color: var(--fiber-300);
      background: rgba(255,255,255,.11);
    }
    .nav-number {
      color: var(--fiber-300);
      font: 700 11px/1.8 ui-monospace, SFMono-Regular, Menlo, monospace;
      letter-spacing: .08em;
    }
    .mobile-bar { display: none; }
    .page {
      width: calc(100% - var(--sidebar));
      margin-left: var(--sidebar);
      padding: 44px clamp(24px, 6vw, 88px) 80px;
    }
    .page-inner { max-width: 1180px; margin: 0 auto; }
    .hero {
      position: relative;
      isolation: isolate;
      min-height: 245px;
      padding: 42px clamp(28px, 5vw, 62px);
      overflow: hidden;
      color: #fffdf5;
      border-radius: 20px;
      background:
        linear-gradient(112deg, rgba(23,51,38,.98), rgba(45,92,63,.94)),
        var(--forest-900);
      box-shadow: var(--shadow);
    }
    .hero::before, .hero::after {
      content: "";
      position: absolute;
      z-index: -1;
      border: 1px solid rgba(244,236,217,.23);
      border-radius: 45% 55% 38% 62%;
      transform: rotate(-18deg);
    }
    .hero::before { width: 330px; height: 150px; right: -60px; top: -35px; }
    .hero::after { width: 250px; height: 105px; right: 45px; bottom: -65px; }
    .eyebrow {
      color: var(--fiber-300);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .22em;
      text-transform: uppercase;
    }
    .hero h1 {
      margin: 12px 0 10px;
      font-size: clamp(38px, 5vw, 66px);
      line-height: 1.08;
      letter-spacing: .08em;
    }
    .hero p { max-width: 680px; margin: 0; color: rgba(255,255,255,.77); }
    .hero-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }
    .pill {
      padding: 5px 11px;
      border: 1px solid rgba(244,236,217,.25);
      border-radius: 999px;
      color: var(--fiber-100);
      background: rgba(255,255,255,.065);
      font-size: 12px;
    }
    .toolbar {
      position: sticky;
      z-index: 10;
      top: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
      margin: 20px 0;
      padding: 10px;
      border: 1px solid rgba(210,189,149,.48);
      border-radius: 12px;
      background: rgba(251,248,238,.9);
      box-shadow: 0 8px 24px rgba(43,63,48,.08);
      backdrop-filter: blur(12px);
    }
    .toolbar button, .mobile-nav-button {
      min-height: 42px;
      padding: 8px 14px;
      color: var(--forest-900);
      border: 1px solid var(--fiber-300);
      border-radius: 8px;
      background: #fffdf7;
      cursor: pointer;
    }
    .toolbar button:hover:not(:disabled), .mobile-nav-button:hover {
      background: var(--leaf-100);
      border-color: var(--forest-600);
    }
    .toolbar button:disabled { cursor: not-allowed; opacity: .45; }
    .toolbar .print-button { margin-left: auto; }
    .chapter {
      display: none;
      padding: clamp(28px, 5vw, 58px);
      overflow: hidden;
      border: 1px solid rgba(210,189,149,.5);
      border-radius: 18px;
      background: rgba(255,253,247,.94);
      box-shadow: var(--shadow);
    }
    .chapter.active { display: block; }
    .show-all .chapter { display: block; margin-bottom: 24px; }
    .chapter-kicker {
      margin-bottom: 8px;
      color: var(--accent);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .2em;
      text-transform: uppercase;
    }
    .chapter h2 {
      margin: 0 0 28px;
      color: var(--forest-950);
      font-size: clamp(28px, 4vw, 43px);
      line-height: 1.3;
      letter-spacing: -.015em;
    }
    .chapter h3 {
      margin: 42px 0 15px;
      padding-bottom: 9px;
      color: var(--forest-900);
      border-bottom: 1px solid var(--fiber-200);
      font-size: 23px;
      line-height: 1.45;
    }
    .chapter h4 { margin: 30px 0 10px; color: var(--forest-800); font-size: 19px; }
    .chapter h5, .chapter h6 { margin: 24px 0 8px; color: var(--forest-700); }
    .chapter p { margin: 13px 0; }
    .chapter ul, .chapter ol { padding-left: 1.5em; }
    .chapter li { margin: 5px 0; padding-left: .2em; }
    .chapter li::marker { color: var(--forest-600); font-weight: 700; }
    .chapter blockquote {
      margin: 20px 0;
      padding: 13px 20px;
      color: #45584a;
      border-left: 4px solid var(--leaf-300);
      background: linear-gradient(90deg, var(--leaf-100), rgba(228,236,220,.25));
      border-radius: 0 9px 9px 0;
    }
    .chapter blockquote p:first-child { margin-top: 0; }
    .chapter blockquote p:last-child { margin-bottom: 0; }
    hr { margin: 34px 0; border: 0; border-top: 1px solid var(--fiber-200); }
    code {
      padding: .12em .38em;
      color: #254934;
      border: 1px solid rgba(74,124,89,.16);
      border-radius: 4px;
      background: #edf2e8;
      font: .88em/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      overflow-wrap: anywhere;
    }
    .code-wrap {
      max-width: 100%;
      margin: 20px 0;
      overflow: hidden;
      border: 1px solid #c9d6c5;
      border-radius: 10px;
      background: #e9efe5;
    }
    .code-label {
      padding: 7px 14px;
      color: var(--forest-700);
      border-bottom: 1px solid #c9d6c5;
      background: #dfe9da;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .08em;
    }
    pre {
      max-width: 100%;
      margin: 0;
      padding: 18px;
      overflow-x: auto;
      color: #20392b;
      scrollbar-color: var(--forest-600) #dfe9da;
    }
    pre code {
      padding: 0;
      white-space: pre;
      border: 0;
      background: transparent;
      overflow-wrap: normal;
    }
    .table-wrap {
      width: 100%;
      margin: 20px 0;
      overflow-x: auto;
      border: 1px solid #d9d4c5;
      border-radius: 10px;
      background: #fff;
      scrollbar-color: var(--forest-600) var(--fiber-100);
    }
    table { width: 100%; min-width: 620px; border-collapse: collapse; font-size: 13px; line-height: 1.6; }
    th, td {
      padding: 10px 12px;
      border-right: 1px solid #e1ddd0;
      border-bottom: 1px solid #e1ddd0;
      text-align: left;
      vertical-align: top;
    }
    th:last-child, td:last-child { border-right: 0; }
    tr:last-child td { border-bottom: 0; }
    th {
      color: var(--forest-900);
      background: #e7ede1;
      font-weight: 750;
      white-space: nowrap;
    }
    tbody tr:nth-child(even) { background: #fbf9f1; }
    .external-mark { margin-left: .2em; font-size: .75em; text-decoration: none; }
    #no-results {
      display: none;
      padding: 56px 24px;
      border: 1px dashed var(--fiber-300);
      border-radius: 16px;
      color: var(--muted);
      background: rgba(255,253,247,.72);
      text-align: center;
    }
    #no-results strong { display: block; color: var(--forest-900); font-size: 21px; }
    footer {
      margin: 28px 4px 0;
      color: var(--muted);
      font-size: 12px;
      text-align: center;
    }
    .nav-scrim { display: none; }
    @media (max-width: 920px) {
      body { padding-top: 58px; }
      .mobile-bar {
        position: fixed;
        z-index: 30;
        inset: 0 0 auto;
        height: 58px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 14px;
        color: #fff;
        background: var(--forest-900);
        box-shadow: 0 3px 18px rgba(23,51,38,.2);
      }
      .mobile-bar strong { letter-spacing: .12em; }
      .mobile-nav-button { min-height: 38px; padding: 5px 12px; }
      .sidebar {
        z-index: 40;
        width: min(86vw, 340px);
        transform: translateX(-105%);
        transition: transform .2s ease;
      }
      .nav-open .sidebar { transform: translateX(0); }
      .nav-scrim {
        position: fixed;
        z-index: 35;
        inset: 0;
        background: rgba(10,25,16,.48);
      }
      .nav-open .nav-scrim { display: block; }
      .page { width: 100%; margin-left: 0; padding: 22px 14px 60px; }
      .hero { min-height: 220px; padding: 34px 24px; border-radius: 14px; }
      .toolbar { top: 58px; }
      .chapter { padding: 28px 20px; border-radius: 14px; }
    }
    @media (max-width: 560px) {
      body { font-size: 15px; }
      .hero h1 { font-size: 38px; }
      .toolbar { gap: 7px; }
      .toolbar button { flex: 1 1 calc(50% - 7px); padding-inline: 8px; }
      .toolbar .print-button { margin-left: 0; }
      .chapter h3 { font-size: 20px; }
      table { min-width: 560px; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; }
    }
    @media print {
      @page { margin: 16mm; }
      body { padding: 0; color: #111; background: #fff; font-size: 11pt; }
      .sidebar, .mobile-bar, .nav-scrim, .toolbar, footer { display: none !important; }
      .page { width: auto; margin: 0; padding: 0; }
      .hero {
        min-height: 0;
        margin-bottom: 18mm;
        padding: 18mm 14mm;
        color: #111;
        border: 1px solid #999;
        box-shadow: none;
        background: #fff;
      }
      .hero p, .eyebrow { color: #333; }
      .pill { color: #111; border-color: #999; background: #fff; }
      .chapter, .show-all .chapter {
        display: block !important;
        margin: 0;
        padding: 0;
        overflow: visible;
        border: 0;
        border-radius: 0;
        box-shadow: none;
        break-before: page;
      }
      .chapter h2 { margin-top: 0; }
      .table-wrap, .code-wrap { overflow: visible; break-inside: avoid; }
      table { min-width: 0; font-size: 8pt; }
      pre { overflow: visible; white-space: pre-wrap; }
      pre code { white-space: pre-wrap; }
      a { color: inherit; text-decoration: none; }
      .external-mark { display: none; }
    }
  </style>
</head>
<body>
  <a class="skip-link" href="#reader">跳到正文</a>
  <div class="mobile-bar">
    <strong>糯酿 · 设计文档</strong>
    <button class="mobile-nav-button" id="mobile-nav-button" type="button"
      aria-controls="sidebar" aria-expanded="false">章节</button>
  </div>
  <div class="nav-scrim" id="nav-scrim" aria-hidden="true"></div>
  <aside class="sidebar" id="sidebar" aria-label="文档章节">
    <div class="brand-block">
      <div class="brand-mark">
        <div class="brand-icon" aria-hidden="true">糯</div>
        <div>
          <div class="brand-name">糯酿</div>
          <p class="brand-subtitle">从糯米到一坛酒</p>
        </div>
      </div>
    </div>
    <div class="search-box">
      <label for="search">中文全文搜索</label>
      <div class="search-field">
        <input id="search" type="search" autocomplete="off"
          placeholder="输入关键词…" aria-describedby="search-status">
      </div>
      <div id="search-status" role="status" aria-live="polite"></div>
    </div>
    <nav class="chapter-nav" aria-label="章节导航">__NAVIGATION__</nav>
  </aside>
  <main class="page" id="reader">
    <div class="page-inner">
      <header class="hero">
        <div class="eyebrow">NUOBREW · DESIGN HANDBOOK</div>
        <h1>从一粒糯米，到一坛酒。</h1>
        <p>《糯酿》设计文档离线阅读器。查阅水田与酿造、经营氛围、技术架构、验收标准和开发计划。</p>
        <div class="hero-meta">
          <span class="pill">单文件离线阅读</span>
          <span class="pill">全文搜索</span>
          <span class="pill">__DOCUMENT_COUNT__ 个章节</span>
          <span class="pill">适合打印与另存 PDF</span>
        </div>
      </header>
      <div class="toolbar" aria-label="阅读工具">
        <button id="previous" type="button" aria-label="上一章节">← 上一章</button>
        <button id="next" type="button" aria-label="下一章节">下一章 →</button>
        <button id="show-all" type="button" aria-pressed="false">展开全文</button>
        <button class="print-button" id="print" type="button">打印 / 另存 PDF</button>
      </div>
      <div id="chapters">__SECTIONS__</div>
      <div id="no-results" role="status">
        <strong>没有找到匹配内容</strong>
        请尝试更短的关键词，或清空搜索后浏览全部章节。
      </div>
      <footer>本页由 <code>tools/build_docs_viewer.py</code> 生成；所有正文、样式与脚本均已嵌入，可完全离线阅读。</footer>
    </div>
  </main>
  <script>
    (() => {
      "use strict";
      const body = document.body;
      const chapters = [...document.querySelectorAll(".chapter")];
      const links = [...document.querySelectorAll(".nav-link")];
      const search = document.getElementById("search");
      const searchStatus = document.getElementById("search-status");
      const noResults = document.getElementById("no-results");
      const previousButton = document.getElementById("previous");
      const nextButton = document.getElementById("next");
      const showAllButton = document.getElementById("show-all");
      const mobileNavButton = document.getElementById("mobile-nav-button");
      const navScrim = document.getElementById("nav-scrim");
      let showAll = false;
      let visibleChapter = chapters[0];

      const decodeHash = () => {
        try { return decodeURIComponent(location.hash.slice(1)); }
        catch (_) { return ""; }
      };

      const chapterForId = (id) => chapters.find((chapter) => chapter.id === id);
      const linkForChapter = (chapter) =>
        links.find((link) => decodeURIComponent(link.hash.slice(1)) === chapter.id);

      function closeMobileNav() {
        body.classList.remove("nav-open");
        mobileNavButton.setAttribute("aria-expanded", "false");
      }

      function updateNavigation(chapter) {
        visibleChapter = chapter || chapters[0];
        links.forEach((link) => {
          const active = link === linkForChapter(visibleChapter);
          link.classList.toggle("active", active);
          if (active) link.setAttribute("aria-current", "page");
          else link.removeAttribute("aria-current");
        });
        const index = chapters.indexOf(visibleChapter);
        previousButton.disabled = showAll || index <= 0;
        nextButton.disabled = showAll || index < 0 || index >= chapters.length - 1;
      }

      function selectChapter({ focus = false, scroll = false } = {}) {
        showAll = false;
        body.classList.remove("show-all");
        showAllButton.textContent = "展开全文";
        showAllButton.setAttribute("aria-pressed", "false");
        const selected = chapterForId(decodeHash()) || chapters[0];
        chapters.forEach((chapter) => chapter.classList.toggle("active", chapter === selected));
        updateNavigation(selected);
        if (scroll) window.scrollTo({ top: 0, behavior: "auto" });
        if (focus) selected.focus({ preventScroll: true });
      }

      function navigateBy(offset) {
        const current = chapters.indexOf(visibleChapter);
        const target = chapters[current + offset];
        if (!target) return;
        search.value = "";
        filterChapters();
        location.hash = target.id;
      }

      function filterChapters() {
        const query = search.value.trim().toLocaleLowerCase("zh-CN");
        if (!query) {
          links.forEach((link) => { link.hidden = false; });
          searchStatus.textContent = "";
          noResults.style.display = "none";
          if (showAll) {
            chapters.forEach((chapter) => chapter.classList.remove("active"));
            updateNavigation(visibleChapter);
          } else {
            selectChapter();
          }
          return;
        }

        showAll = false;
        body.classList.remove("show-all");
        showAllButton.textContent = "展开全文";
        showAllButton.setAttribute("aria-pressed", "false");
        const matches = [];
        chapters.forEach((chapter, index) => {
          const haystack = `${chapter.dataset.title} ${chapter.textContent}`
            .toLocaleLowerCase("zh-CN");
          const matched = haystack.includes(query);
          links[index].hidden = !matched;
          chapter.classList.toggle("active", false);
          if (matched) matches.push(chapter);
        });
        searchStatus.textContent = matches.length
          ? `找到 ${matches.length} 个相关章节`
          : "没有匹配章节";
        noResults.style.display = matches.length ? "none" : "block";
        if (matches[0]) {
          matches[0].classList.add("active");
          updateNavigation(matches[0]);
        } else {
          links.forEach((link) => {
            link.classList.remove("active");
            link.removeAttribute("aria-current");
          });
          previousButton.disabled = true;
          nextButton.disabled = true;
        }
      }

      window.addEventListener("hashchange", () => {
        search.value = "";
        links.forEach((link) => { link.hidden = false; });
        searchStatus.textContent = "";
        noResults.style.display = "none";
        selectChapter({ focus: true, scroll: true });
        closeMobileNav();
      });

      document.addEventListener("click", (event) => {
        const anchor = event.target.closest('a[href^="#"]');
        if (!anchor) return;
        const id = decodeURIComponent(anchor.hash.slice(1));
        if (!chapterForId(id)) return;
        event.preventDefault();
        search.value = "";
        if (decodeHash() === id) {
          filterChapters();
          selectChapter({ focus: true, scroll: true });
        } else {
          location.hash = id;
        }
      });

      search.addEventListener("input", filterChapters);
      previousButton.addEventListener("click", () => navigateBy(-1));
      nextButton.addEventListener("click", () => navigateBy(1));
      document.getElementById("print").addEventListener("click", () => window.print());
      showAllButton.addEventListener("click", () => {
        search.value = "";
        links.forEach((link) => { link.hidden = false; });
        searchStatus.textContent = "";
        noResults.style.display = "none";
        showAll = !showAll;
        body.classList.toggle("show-all", showAll);
        showAllButton.textContent = showAll ? "按章节阅读" : "展开全文";
        showAllButton.setAttribute("aria-pressed", String(showAll));
        if (showAll) {
          chapters.forEach((chapter) => chapter.classList.remove("active"));
          updateNavigation(visibleChapter);
          window.scrollTo({ top: 0, behavior: "auto" });
        } else {
          selectChapter({ scroll: true });
        }
      });

      mobileNavButton.addEventListener("click", () => {
        const open = body.classList.toggle("nav-open");
        mobileNavButton.setAttribute("aria-expanded", String(open));
        if (open) search.focus();
      });
      navScrim.addEventListener("click", closeMobileNav);

      document.addEventListener("keydown", (event) => {
        const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
        if (event.key === "/" && !typing) {
          event.preventDefault();
          search.focus();
        } else if (event.key === "Escape") {
          if (search.value) {
            search.value = "";
            filterChapters();
            search.focus();
          }
          closeMobileNav();
        } else if (event.altKey && event.key === "ArrowLeft") {
          event.preventDefault();
          navigateBy(-1);
        } else if (event.altKey && event.key === "ArrowRight") {
          event.preventDefault();
          navigateBy(1);
        }
      });

      selectChapter();
    })();
  </script>
</body>
</html>
"""

page = (
    HTML_TEMPLATE.replace("__NAVIGATION__", navigation)
    .replace("__SECTIONS__", sections)
    .replace("__DOCUMENT_COUNT__", str(len(document_data)))
)
OUTPUT.write_text(page, encoding="utf-8")

summary = {
    "documents": len(document_data),
    "document_order": [path.name for path in DOCUMENTS],
    "local_markdown_links_converted": LOCAL_LINK_COUNT,
    "output": OUTPUT.name,
    "bytes": OUTPUT.stat().st_size,
    "offline": True,
}
print(json.dumps(summary, ensure_ascii=False, separators=(",", ":")))
