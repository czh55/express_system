#!/usr/bin/env python3
"""Import curated video-notes expression entries → scene / technique cards."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VN_INDEX = Path.home() / "Projects" / "video-notes" / "docs" / "index.json"
VN_DOCS = Path.home() / "Projects" / "video-notes" / "docs"
OUT_SCENES = ROOT / "content" / "03-scenes"
OUT_TECH = ROOT / "content" / "04-techniques"

# slug → (module, scene|None, group, purpose)
WHITELIST = {
    "host-express-system-intro": ("techniques", None, "表达系统", "结构训练"),
    "host-express-day2-logic": ("techniques", None, "表达系统", "结构训练"),
    "host-express-day3-ai": ("techniques", None, "表达系统", "结构训练"),
    "host-speak-visual-sense": ("techniques", None, "具体化", "结构训练"),
    "high-eq-no-filler-words": ("techniques", None, "承接语", "结构训练"),
    "self-intro-story-framework": ("scenes", "workplace", "面试", "利益推动"),
    "competency-interview-answer": ("scenes", "workplace", "面试", "利益推动"),
    "interview-biggest-weakness": ("scenes", "workplace", "面试", "利益推动"),
    "interview-question-differentiation": ("scenes", "workplace", "面试", "关系维护"),
    "hr-interview-rules": ("scenes", "workplace", "面试", "利益推动"),
    "salary-negotiation-five-steps": ("scenes", "workplace", "谈薪", "利益推动"),
    "task-restate-confirm": ("scenes", "workplace", "向上管理", "信息对齐"),
    "leader-confidence-answer": ("scenes", "workplace", "向上管理", "利益推动"),
    "ppt-capture-attention": ("scenes", "workplace", "汇报", "利益推动"),
    "bad-data-highlights": ("scenes", "workplace", "汇报", "利益推动"),
    "workplace-speech-stance-interest": ("scenes", "workplace", "公开表达", "利益推动"),
    "teach-face-saving": ("scenes", "workplace", "反馈", "关系维护"),
    "quick-respond-conversation": ("scenes", "improv", "接话", "关系维护"),
    "prove-expert-sales": ("scenes", "improv", "即兴专业度", "利益推动"),
    "7FNwup3V9Db": ("scenes", "improv", "演讲开场", "利益推动"),
}


def strip_html(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).strip()


def load_svg_bullets(slug: str) -> tuple[str, list[str]]:
    svg = VN_DOCS / f"{slug}-理性分析.svg"
    if not svg.exists():
        return "", []
    t = svg.read_text(encoding="utf-8", errors="ignore")
    summ_m = re.search(r'class="summary-line">(.*?)</div>', t, re.S)
    summary = strip_html(summ_m.group(1)) if summ_m else ""
    # conclusion list items
    bullets = []
    for m in re.finditer(r"<li>(.*?)</li>", t, re.S):
        text = strip_html(m.group(1))
        if text and len(text) < 120:
            bullets.append(text)
        if len(bullets) >= 6:
            break
    return summary, bullets


def main() -> int:
    if not VN_INDEX.exists():
        print(f"missing video-notes index: {VN_INDEX}", file=sys.stderr)
        return 1
    index = json.loads(VN_INDEX.read_text(encoding="utf-8"))
    by_slug = {item.get("slug"): item for item in index if item.get("slug")}

    buckets: dict[str, list] = {
        "techniques": [],
        "workplace": [],
        "improv": [],
        "small-talk": [],
        "conflict": [],
    }

    for slug, (module, scene, group, purpose) in WHITELIST.items():
        item = by_slug.get(slug)
        title = (item or {}).get("title") or slug
        summary = (item or {}).get("summary") or ""
        svg_sum, bullets = load_svg_bullets(slug)
        if svg_sum:
            summary = svg_sum
        how = "；".join(bullets[:3]) if bullets else summary
        quote = bullets[0] if bullets else (summary[:80] + ("…" if len(summary) > 80 else ""))
        html_name = (item or {}).get("html") or f"{slug}-图文实录.html"
        href = f"https://czh55.github.io/video-notes/{html_name}"
        card = {
            "id": f"vn-{slug}",
            "module": module,
            "scene": scene,
            "group": group,
            "title": title,
            "badge": group,
            "quote": quote,
            "how": how,
            "dont": "",
            "script": "",
            "summary": summary,
            "purpose": purpose,
            "sources": [{"label": title, "href": href, "repo": "video-notes"}],
            "tags": ["video-notes", group],
        }
        if module == "techniques":
            buckets["techniques"].append(card)
        else:
            buckets[scene or "workplace"].append(card)

    # merge techniques
    tech_path = OUT_TECH / "host-express.json"
    tech_path.parent.mkdir(parents=True, exist_ok=True)
    tech_path.write_text(
        json.dumps(buckets["techniques"], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {tech_path.relative_to(ROOT)} ({len(buckets['techniques'])})")

    for scene in ("workplace", "improv", "small-talk", "conflict"):
        path = OUT_SCENES / scene / "cards.json"
        existing = []
        if path.exists():
            existing = json.loads(path.read_text(encoding="utf-8"))
        # replace previous vn-* entries
        existing = [c for c in existing if not str(c.get("id", "")).startswith("vn-")]
        merged = existing + buckets[scene]
        if not merged:
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {path.relative_to(ROOT)} ({len(merged)} total, +{len(buckets[scene])} vn)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
