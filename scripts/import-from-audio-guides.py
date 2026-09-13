#!/usr/bin/env python3
"""Parse audio-workshop expression guide HTML → content cards JSON."""

from __future__ import annotations

import json
import re
import sys
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIO_DOCS = Path.home() / "Projects" / "audio-workshop" / "docs"
OUT_SCENES = ROOT / "content" / "03-scenes"
OUT_TECH = ROOT / "content" / "04-techniques"

PURPOSE_HINTS = [
    (re.compile(r"面试|简历|汇报|领导|职场|谈钱|报价|合作|5W1H|条件"), "利益推动"),
    (re.compile(r"冲突|维权|拒绝|边界|索赔|算了|面恶"), "利益推动"),
    (re.compile(r"家庭|父母|情绪|比惨|抱持|共情|倾听|示弱"), "情绪承接"),
    (re.compile(r"闲聊|赞美|破冰|社交|前辈|身体|故事|尴尬|幽默|氛围"), "关系维护"),
    (re.compile(r"说服|定义|类比|推演|提问|数字|可信"), "利益推动"),
    (re.compile(r"结构|三句|逻辑|安检"), "结构训练"),
]


def strip_tags(s: str) -> str:
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    return unescape(re.sub(r"\s+", " ", s)).strip()


def guess_purpose(text: str, default: str = "信息对齐") -> str:
    for pat, purpose in PURPOSE_HINTS:
        if pat.search(text):
            return purpose
    return default


def extract_cards(html: str) -> list[dict]:
    """Split on card divs; tolerant of nested detail rows."""
    parts = re.split(r'<div class="card">', html)[1:]
    cards = []
    for part in parts:
        # end at next major sibling boundary is already split; take until last detail closes roughly
        block = part
        badge_m = re.search(r'class="tech-badge"[^>]*>(.*?)</span>', block, re.S)
        idx_m = re.search(r'class="card-index"[^>]*>(.*?)</span>', block, re.S)
        quote_m = re.search(r'class="quote"[^>]*>(.*?)</div>', block, re.S)
        source_m = re.search(r'class="source"[^>]*>(.*?)</span>', block, re.S)
        how_m = re.search(
            r'class="detail-tag[^"]*"[^>]*>怎么用</span>\s*<[^>]+>(.*?)</(?:div|span)>',
            block,
            re.S,
        )
        if not how_m:
            how_m = re.search(
                r'>(?:怎么用|复用|句式)</span>\s*<[^>]*class="detail-text"[^>]*>(.*?)</(?:div|span)>',
                block,
                re.S,
            )
        if not how_m:
            how_m = re.search(
                r'class="detail-text"[^>]*>(.*?)</(?:div|span)>',
                block,
                re.S,
            )
        dont_m = re.search(
            r'class="detail-tag[^"]*"[^>]*>别做</span>\s*<[^>]+>(.*?)</(?:div|span)>',
            block,
            re.S,
        )
        script_m = re.search(r'class="script"[^>]*>\s*(?:<b>.*?</b>)?(.*?)</div>', block, re.S)

        badge = strip_tags(badge_m.group(1)) if badge_m else ""
        if not badge and not quote_m:
            continue
        quote = strip_tags(quote_m.group(1)) if quote_m else ""
        source_html = source_m.group(1) if source_m else ""
        source_label = strip_tags(source_html)
        href_m = re.search(r'href="([^"]+)"', source_html)
        href = href_m.group(1) if href_m else ""
        if href and not href.startswith("http"):
            href = f"https://czh55.github.io/audio-workshop/{href}"

        how = strip_tags(how_m.group(1)) if how_m else ""
        dont = strip_tags(dont_m.group(1)) if dont_m else ""
        script = strip_tags(script_m.group(1)) if script_m else ""
        index = strip_tags(idx_m.group(1)) if idx_m else f"{len(cards)+1:02d}"

        cards.append(
            {
                "index": index,
                "badge": badge,
                "title": badge or quote[:24],
                "quote": quote,
                "how": how,
                "dont": dont,
                "script": script,
                "source_label": source_label,
                "source_href": href,
            }
        )
    return cards


def section_of_handbook(html: str, card_index: int) -> str:
    """Map handbook card index to scene via section order in file."""
    # Find section id before each card-index
    positions = []
    for m in re.finditer(r'id="(mindset|social|field|career|family|silence)"', html):
        positions.append((m.start(), m.group(1)))
    card_pos = []
    for m in re.finditer(r'class="card-index"[^>]*>\s*(\d+)\s*<', html):
        card_pos.append((m.start(), int(m.group(1))))
    mapping = {
        "mindset": ("emotion-skip", None),  # skip — already in 01-emotion
        "social": ("scenes", "small-talk"),
        "field": ("scenes", "conflict"),
        "career": ("scenes", "workplace"),
        "family": ("scenes", "conflict"),
        "silence": ("emotion-skip", None),
    }
    # For each card find latest section before it
    result_scene = {}
    for pos, idx in card_pos:
        sec = "social"
        for spos, sid in positions:
            if spos < pos:
                sec = sid
            else:
                break
        result_scene[idx] = mapping.get(sec, ("scenes", "small-talk"))
    return result_scene.get(card_index, ("scenes", "small-talk"))


def write_json(path: Path, data: list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {path.relative_to(ROOT)} ({len(data)} cards)")


def import_handbook() -> None:
    path = AUDIO_DOCS / "表达技巧手册-站内播客的开口方法.html"
    html = path.read_text(encoding="utf-8")
    raw = extract_cards(html)
    # build section map
    card_pos = [(m.start(), int(m.group(1))) for m in re.finditer(r'class="card-index"[^>]*>\s*(\d+)\s*<', html)]
    positions = [(m.start(), m.group(1)) for m in re.finditer(r'id="(mindset|social|field|career|family|silence)"', html)]
    sec_map = {}
    for pos, idx in card_pos:
        sec = "social"
        for spos, sid in positions:
            if spos < pos:
                sec = sid
            else:
                break
        sec_map[idx] = sec

    by_scene: dict[str, list] = {"small-talk": [], "workplace": [], "conflict": [], "improv": []}
    for c in raw:
        idx = int(re.sub(r"\D", "", c["index"]) or "0")
        sec = sec_map.get(idx, "social")
        if sec in ("mindset", "silence"):
            continue  # covered by emotion module
        scene = {
            "social": "small-talk",
            "field": "conflict",
            "career": "workplace",
            "family": "conflict",
        }.get(sec, "small-talk")
        blob = " ".join([c["title"], c["quote"], c["how"], c["badge"]])
        card = {
            "id": f"hb-{idx:02d}",
            "module": "scenes",
            "scene": scene,
            "group": sec,
            "title": c["title"],
            "badge": c["badge"],
            "quote": c["quote"],
            "how": c["how"],
            "dont": c["dont"],
            "script": c["script"],
            "purpose": guess_purpose(blob, "关系维护" if scene == "small-talk" else "利益推动"),
            "sources": (
                [{"label": c["source_label"], "href": c["source_href"], "repo": "audio-workshop"}]
                if c["source_label"]
                else []
            ),
            "tags": ["表达技巧手册", scene],
        }
        by_scene[scene].append(card)

    for scene, cards in by_scene.items():
        if cards:
            write_json(OUT_SCENES / scene / "cards.json", cards)


def import_tech_guide(filename: str, group_prefix: str, out_name: str, default_purpose: str) -> None:
    path = AUDIO_DOCS / filename
    html = path.read_text(encoding="utf-8")
    # capture section titles for group
    sections = [(m.start(), strip_tags(m.group(1))) for m in re.finditer(r"<h2[^>]*>(.*?)</h2>", html, re.S)]
    raw = extract_cards(html)
    # approximate card positions
    card_pos = [m.start() for m in re.finditer(r'class="card-index"', html)]
    cards = []
    for i, c in enumerate(raw):
        group = group_prefix
        if i < len(card_pos):
            pos = card_pos[i]
            for spos, title in sections:
                if spos < pos and not title.startswith("专题") and "带走" not in title:
                    group = re.sub(r"^[一二三四五六七八九十、.\d\s]+", "", title)[:40]
        idx = i + 1  # global order — HTML card-index restarts per section
        blob = " ".join([c["title"], c["quote"], c["how"], group])
        cards.append(
            {
                "id": f"{out_name}-{idx:03d}",
                "module": "techniques",
                "scene": None,
                "group": group,
                "title": c["title"],
                "badge": c["badge"],
                "quote": c["quote"],
                "how": c["how"],
                "dont": c["dont"],
                "script": c["script"],
                "purpose": guess_purpose(blob, default_purpose),
                "sources": (
                    [{"label": c["source_label"], "href": c["source_href"], "repo": "audio-workshop"}]
                    if c["source_label"]
                    else []
                ),
                "tags": [group_prefix, out_name],
            }
        )
    write_json(OUT_TECH / f"{out_name}.json", cards)


def import_conflict_guide() -> None:
    path = AUDIO_DOCS / "有理说不赢-I人冲突与索赔手册.html"
    html = path.read_text(encoding="utf-8")
    sections = [(m.start(), strip_tags(m.group(1))) for m in re.finditer(r"<h2[^>]*>(.*?)</h2>", html, re.S)]
    raw = extract_cards(html)
    card_pos = [m.start() for m in re.finditer(r'class="card-index"', html)]
    existing_path = OUT_SCENES / "conflict" / "cards.json"
    existing = []
    if existing_path.exists():
        existing = json.loads(existing_path.read_text(encoding="utf-8"))
    # drop previous claim imports so re-runs stay idempotent
    cards = [c for c in existing if not str(c.get("id", "")).startswith("conflict-claim-")]
    for i, c in enumerate(raw):
        group = "冲突索赔"
        if i < len(card_pos):
            pos = card_pos[i]
            for spos, title in sections:
                if spos < pos:
                    group = re.sub(r"^[一二三四五六七八九十、.\d\s]+", "", title)[:40]
        idx = i + 1
        blob = " ".join([c["title"], c["quote"], c["how"]])
        cards.append(
            {
                "id": f"conflict-claim-{idx:03d}",
                "module": "scenes",
                "scene": "conflict",
                "group": group,
                "title": c["title"],
                "badge": c["badge"],
                "quote": c["quote"],
                "how": c["how"],
                "dont": c["dont"],
                "script": c["script"],
                "purpose": guess_purpose(blob, "利益推动"),
                "sources": (
                    [{"label": c["source_label"], "href": c["source_href"], "repo": "audio-workshop"}]
                    if c["source_label"]
                    else []
                ),
                "tags": ["有理说不赢", "conflict"],
            }
        )
    write_json(existing_path, cards)


def main() -> int:
    if not AUDIO_DOCS.is_dir():
        print(f"missing audio-workshop docs: {AUDIO_DOCS}", file=sys.stderr)
        return 1
    import_handbook()
    import_tech_guide(
        "说服话术-从播客中学到的表达武器.html",
        "说服话术",
        "persuasion",
        "利益推动",
    )
    import_tech_guide(
        "谈话氛围控制-从播客中学到的对话调频.html",
        "谈话氛围",
        "atmosphere",
        "关系维护",
    )
    import_conflict_guide()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
