from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any, Iterable


HAN_RE = re.compile(r"[\u4e00-\u9fff]+")
WORD_RE = re.compile(r"[a-zA-Z0-9]+")


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


def excerpt_text(value: str, limit: int = 180) -> str:
    compact = re.sub(r"\s+", " ", value).strip()
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1] + "…"


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
