#!/usr/bin/env python3
"""Validate express-system content cards + catalog."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content"
ALLOWED_MODULES = {"emotion", "warmup", "scenes", "techniques"}
ALLOWED_SCENES = {"small-talk", "workplace", "conflict", "improv", None}
ALLOWED_PURPOSE = {
    "信息对齐",
    "关系维护",
    "利益推动",
    "情绪承接",
    "结构训练",
    "开口启动",
}


def load_all_cards() -> list[dict]:
    cards = []
    paths = []
    paths.append(CONTENT / "01-emotion" / "cards.json")
    for scene in ("small-talk", "workplace", "conflict", "improv"):
        paths.append(CONTENT / "03-scenes" / scene / "cards.json")
    for name in ("host-express.json", "persuasion.json", "atmosphere.json"):
        paths.append(CONTENT / "04-techniques" / name)
    for p in paths:
        if not p.exists():
            print(f"WARN missing {p.relative_to(ROOT)}")
            continue
        data = json.loads(p.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            raise SystemExit(f"{p} must be a JSON array")
        for c in data:
            c["_path"] = str(p.relative_to(ROOT))
            cards.append(c)
    return cards


def main() -> int:
    errors = []
    catalog = json.loads((CONTENT / "catalog.json").read_text(encoding="utf-8"))
    if not catalog.get("modules"):
        errors.append("catalog.modules empty")

    # warmup docs
    for rel in (
        "02-warmup/PROTOCOL.md",
        "02-warmup/drills/绕口令.md",
        "02-warmup/drills/贯口.md",
        "02-warmup/drills/顺口溜.md",
        "01-emotion/PRINCIPLES.md",
    ):
        if not (CONTENT / rel).exists():
            errors.append(f"missing {rel}")

    cards = load_all_cards()
    ids = {}
    for c in cards:
        cid = c.get("id")
        if not cid:
            errors.append(f"missing id in {c.get('_path')}")
            continue
        if cid in ids:
            errors.append(f"duplicate id {cid}: {ids[cid]} vs {c['_path']}")
        ids[cid] = c["_path"]
        if c.get("module") not in ALLOWED_MODULES:
            errors.append(f"{cid}: bad module {c.get('module')}")
        scene = c.get("scene", None)
        if scene not in ALLOWED_SCENES:
            errors.append(f"{cid}: bad scene {scene}")
        if c.get("purpose") not in ALLOWED_PURPOSE:
            errors.append(f"{cid}: bad purpose {c.get('purpose')}")
        if not c.get("title"):
            errors.append(f"{cid}: missing title")

    print(f"cards={len(cards)} unique_ids={len(ids)}")
    if errors:
        print("FAILED:")
        for e in errors[:50]:
            print(" -", e)
        if len(errors) > 50:
            print(f" ... +{len(errors)-50} more")
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
