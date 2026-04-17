from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any, Iterable


HAN_RE = re.compile(r"[\u4e00-\u9fff]+")
WORD_RE = re.compile(r"[a-zA-Z0-9]+")
METADATA_LINE_RE = re.compile(
    r"^\s*-\s*(source_path|material|damage_type|risk_level|source_id|title):\s*.*$",
    re.I,
)
HEADING_RE = re.compile(r"^\s*#{1,6}\s+(.+?)\s*$")
ORDERED_LINE_RE = re.compile(r"^\s*\d+[.)]\s+")
BULLET_LINE_RE = re.compile(r"^\s*[-*]\s+")
SENTENCE_SPLIT_RE = re.compile(r"(?<=[。！？；;])\s*")
STEP_SKIP_KEYWORDS = ("风险", "注意", "送修", "工具", "参考", "适用判断", "所需工具")
STEP_ACTION_KEYWORDS = (
    "先",
    "再",
    "然后",
    "接着",
    "最后",
    "确认",
    "准备",
    "清理",
    "擦拭",
    "处理",
    "修补",
    "涂抹",
    "涂开",
    "放在",
    "等待",
    "静置",
    "风干",
    "补充",
    "观察",
    "恢复",
    "打磨",
    "打底",
    "薄涂",
    "干透",
    "轻拭",
    "刷除",
    "覆盖",
    "梳理",
)


def slugify(value: str) -> str:
    lowered = value.strip().lower()
    lowered = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "-", lowered)
    lowered = re.sub(r"-{2,}", "-", lowered)
    return lowered.strip("-") or "item"


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def md5_file(path: Path) -> str:
    digest = hashlib.md5()
    with path.open("rb") as file_handle:
        for chunk in iter(lambda: file_handle.read(1024 * 64), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, payload: Any) -> None:
    ensure_parent(path)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_jsonl(path: Path, items: Iterable[dict[str, Any]]) -> None:
    ensure_parent(path)
    lines = [json.dumps(item, ensure_ascii=False) for item in items]
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    result: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            result.append(json.loads(line))
    return result


def clean_text(raw: str) -> str:
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def _strip_metadata_lines(value: str) -> str:
    lines = []
    for line in value.splitlines():
        if METADATA_LINE_RE.match(line.strip()):
            continue
        lines.append(line.rstrip())
    return "\n".join(lines)


def _dedupe_repeated_heading(value: str) -> str:
    lines = value.splitlines()
    first_heading_index = next((index for index, line in enumerate(lines) if line.strip()), None)
    if first_heading_index is None:
        return value

    second_heading_index = None
    for index in range(first_heading_index + 1, len(lines)):
        if lines[index].strip():
            second_heading_index = index
            break

    if second_heading_index is None:
        return value

    first_match = HEADING_RE.match(lines[first_heading_index].strip())
    second_match = HEADING_RE.match(lines[second_heading_index].strip())
    if not first_match or not second_match:
        return value

    if first_match.group(1).strip() != second_match.group(1).strip():
        return value

    del lines[second_heading_index]
    return "\n".join(lines)


def _strip_matching_title_heading(value: str, title: str | None) -> str:
    if not title:
        return value

    lines = value.splitlines()
    for index, line in enumerate(lines):
        if not line.strip():
            continue
        match = HEADING_RE.match(line.strip())
        if match and match.group(1).strip() == title.strip():
            del lines[index]
            break
        return value

    return "\n".join(lines)


def clean_runtime_markdown(value: str, title: str | None = None, strip_title: bool = False) -> str:
    text = clean_text(value)
    text = re.sub(r"^【([^】]+)】\s*", r"### \1\n", text, flags=re.M)
    text = _strip_metadata_lines(text)
    text = _dedupe_repeated_heading(text)
    if strip_title:
        text = _strip_matching_title_heading(text, title)
    return clean_text(text)


def markdown_to_plain_text(value: str, title: str | None = None, strip_title: bool = False) -> str:
    compact = clean_runtime_markdown(value, title=title, strip_title=strip_title)
    compact = re.sub(r"^#{1,6}\s*", "", compact, flags=re.M)
    compact = re.sub(r"^\s*[-*]\s+", "", compact, flags=re.M)
    compact = re.sub(r"^\s*\d+[.)]\s+", "", compact, flags=re.M)
    compact = re.sub(r"\[(.*?)\]\((.*?)\)", r"\1", compact)
    compact = compact.replace("**", "").replace("`", "")
    compact = re.sub(r"\s+", " ", compact).strip()
    return compact


def excerpt_text(value: str, limit: int = 180, title: str | None = None, strip_title: bool = False) -> str:
    compact = markdown_to_plain_text(value, title=title, strip_title=strip_title)
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1] + "…"


def build_step_markdown(value: str, max_steps: int = 5) -> str:
    text = clean_runtime_markdown(value)
    blocks = [block.strip() for block in re.split(r"\n{2,}", text) if block.strip()]
    current_heading = ""
    candidate_blocks: list[str] = []
    fallback_blocks: list[str] = []

    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if not lines:
            continue

        if len(lines) == 1:
            heading_match = HEADING_RE.match(lines[0])
            if heading_match:
                current_heading = heading_match.group(1).strip()
                continue

        plain_block = markdown_to_plain_text(block)
        if not plain_block:
            continue

        if current_heading:
            if any(keyword in current_heading for keyword in STEP_SKIP_KEYWORDS):
                continue
            candidate_blocks.append(plain_block)
        else:
            fallback_blocks.append(plain_block)

    source_blocks = candidate_blocks or fallback_blocks
    sentences: list[str] = []

    for block in source_blocks:
        normalized_block = block.replace("；", "。")
        for sentence in SENTENCE_SPLIT_RE.split(normalized_block):
            cleaned_sentence = sentence.strip(" \n\t-")
            if len(cleaned_sentence) < 8:
                continue
            if any(marker in cleaned_sentence for marker in ("source_path:", "material:", "damage_type:", "risk_level:")):
                continue
            if any(marker in cleaned_sentence for marker in ("所需工具", "适用判断", "操作逻辑", "关键注意事项", "参考来源")):
                continue
            cleaned_sentence = cleaned_sentence.rstrip("。！？；;")
            if cleaned_sentence and cleaned_sentence not in sentences:
                sentences.append(cleaned_sentence)
            if len(sentences) >= max_steps:
                break
        if len(sentences) >= max_steps:
            break

    if not sentences:
        fallback = markdown_to_plain_text(text)
        for sentence in SENTENCE_SPLIT_RE.split(fallback):
            cleaned_sentence = sentence.strip(" \n\t-").rstrip("。！？；;")
            if len(cleaned_sentence) >= 8 and cleaned_sentence not in sentences:
                sentences.append(cleaned_sentence)
            if len(sentences) >= max_steps:
                break

    actionable_sentences = [
        sentence
        for sentence in sentences
        if any(keyword in sentence for keyword in STEP_ACTION_KEYWORDS)
        or re.match(r"^(保持|使用|将|用|先|再|然后|最后)", sentence)
    ]
    if len(actionable_sentences) >= 2:
        sentences = actionable_sentences

    if not sentences:
        return "1. 先确认材质、部位和受损范围，再在不显眼处小范围测试。"

    return "\n".join(f"{index}. {sentence}。" for index, sentence in enumerate(sentences, start=1))


def tokenize_search_text(value: str) -> list[str]:
    lowered = value.lower()
    tokens = WORD_RE.findall(lowered)
    for group in HAN_RE.findall(lowered):
        tokens.extend(group[index : index + 2] for index in range(max(1, len(group) - 1)))
        if len(group) == 1:
            tokens.append(group)
    return [token for token in tokens if token]


def chunked_paragraphs(text: str, target_size: int = 680) -> list[str]:
    paragraphs = [paragraph.strip() for paragraph in text.split("\n\n") if paragraph.strip()]
    chunks: list[str] = []
    current: list[str] = []
    current_length = 0
    for paragraph in paragraphs:
        if current and current_length + len(paragraph) > target_size:
            chunks.append("\n\n".join(current))
            current = [paragraph]
            current_length = len(paragraph)
        else:
            current.append(paragraph)
            current_length += len(paragraph)
    if current:
        chunks.append("\n\n".join(current))
    return chunks


def unique_by_key(items: Iterable[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    seen: set[str] = set()
    unique_items: list[dict[str, Any]] = []
    for item in items:
        marker = str(item.get(key, "")).strip().lower()
        if not marker or marker in seen:
            continue
        seen.add(marker)
        unique_items.append(item)
    return unique_items
