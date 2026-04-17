from __future__ import annotations

from pathlib import Path
from shutil import copy2, rmtree


REQUIRED_MANIFESTS = (
    "chunks.jsonl",
    "faq.jsonl",
    "eval.jsonl",
    "ingest-report.json",
)


def main() -> None:
    backend_root = Path(__file__).resolve().parent
    project_root = backend_root.parent
    source_dir = project_root / "knowledge" / "generated" / "manifests"
    target_dir = backend_root / "knowledge" / "generated" / "manifests"

    missing = [name for name in REQUIRED_MANIFESTS if not (source_dir / name).exists()]
    if missing:
        missing_list = ", ".join(missing)
        raise SystemExit(
            "Missing generated knowledge manifests: "
            f"{missing_list}. Run ./scripts/ingest.sh --local-only before deploying."
        )

    if target_dir.exists():
        rmtree(target_dir)
    target_dir.mkdir(parents=True, exist_ok=True)

    copied_count = 0
    for path in sorted(source_dir.iterdir()):
        if not path.is_file():
            continue
        copy2(path, target_dir / path.name)
        copied_count += 1

    print(f"Copied {copied_count} knowledge manifest files to {target_dir}")


if __name__ == "__main__":
    main()
