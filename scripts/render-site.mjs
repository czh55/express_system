#!/usr/bin/env node
/**
 * Render express-system content → docs/ static learning site.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");
const DOCS = path.join(ROOT, "docs");

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let inUl = false;
  let inOl = false;
  let inTable = false;
  let inCode = false;
  let codeBuf = [];

  const closeLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };
  const closeTable = () => {
    if (inTable) {
      out.push("</tbody></table>");
      inTable = false;
    }
  };

  const inline = (t) =>
    esc(t)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  for (let raw of lines) {
    if (raw.startsWith("```")) {
      if (inCode) {
        out.push(`<pre class="code"><code>${esc(codeBuf.join("\n"))}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        closeLists();
        closeTable();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(raw);
      continue;
    }

    if (/^\|/.test(raw)) {
      closeLists();
      const cells = raw
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      if (/^\|?\s*-+/.test(raw.replace(/\|/g, "|"))) {
        continue;
      }
      if (!inTable) {
        out.push("<table><thead><tr>" + cells.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>");
        inTable = true;
      } else {
        out.push("<tr>" + cells.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>");
      }
      continue;
    } else {
      closeTable();
    }

    if (/^### /.test(raw)) {
      closeLists();
      out.push(`<h3>${inline(raw.slice(4))}</h3>`);
      continue;
    }
    if (/^## /.test(raw)) {
      closeLists();
      out.push(`<h2>${inline(raw.slice(3))}</h2>`);
      continue;
    }
    if (/^# /.test(raw)) {
      closeLists();
      out.push(`<h1>${inline(raw.slice(2))}</h1>`);
      continue;
    }
    if (/^> /.test(raw)) {
      closeLists();
      out.push(`<blockquote>${inline(raw.slice(2))}</blockquote>`);
      continue;
    }
    if (/^- /.test(raw)) {
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inline(raw.slice(2))}</li>`);
      continue;
    }
    if (/^\d+\. /.test(raw)) {
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        out.push("<ol>");
        inOl = true;
      }
      out.push(`<li>${inline(raw.replace(/^\d+\. /, ""))}</li>`);
      continue;
    }
    if (!raw.trim()) {
      closeLists();
      continue;
    }
    closeLists();
    out.push(`<p>${inline(raw)}</p>`);
  }
  closeLists();
  closeTable();
  if (inCode) {
    out.push(`<pre class="code"><code>${esc(codeBuf.join("\n"))}</code></pre>`);
  }
  return out.join("\n");
}

const CSS = `
:root {
  --bg: #0c1222;
  --surface: rgba(255,255,255,0.045);
  --border: rgba(255,255,255,0.1);
  --text: #e8eef7;
  --muted: #93a4bd;
  --accent: #f0a36a;
  --accent2: #7eb6ff;
  --accent3: #6ed3a1;
  --warn: #e8b86d;
  --font-display: "Iowan Old Style", "Palatino Linotype", Palatino, "Songti SC", serif;
  --font-body: "Avenir Next", "PingFang SC", "Helvetica Neue", sans-serif;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; scroll-padding-top: 72px; }
body {
  font-family: var(--font-body);
  background:
    radial-gradient(900px 500px at 12% -10%, rgba(240,163,106,0.14), transparent 55%),
    radial-gradient(700px 420px at 90% 0%, rgba(126,182,255,0.10), transparent 50%),
    var(--bg);
  color: var(--text);
  min-height: 100vh;
  line-height: 1.65;
}
a { color: var(--accent2); text-decoration: none; }
a:hover { text-decoration: underline; }
.wrap { max-width: 980px; margin: 0 auto; padding: 28px 20px 80px; }
nav.top {
  display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center;
  padding: 14px 0 22px; border-bottom: 1px solid var(--border); margin-bottom: 28px;
}
nav.top .brand {
  font-family: var(--font-display);
  font-size: 1.15rem; font-weight: 700; color: var(--text); margin-right: auto;
}
nav.top a { color: var(--muted); font-size: 0.9rem; }
nav.top a.active { color: var(--accent); }
.hero h1 {
  font-family: var(--font-display);
  font-size: clamp(1.9rem, 4.5vw, 2.7rem);
  letter-spacing: -0.02em; line-height: 1.15; margin-bottom: 12px;
}
.hero p { color: var(--muted); max-width: 42rem; }
.grid4 {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 28px 0;
}
@media (max-width: 820px) { .grid4 { grid-template-columns: 1fr 1fr; } }
@media (max-width: 480px) { .grid4 { grid-template-columns: 1fr; } }
.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 14px; padding: 18px 16px; display: block; color: inherit;
}
a.card:hover { border-color: rgba(240,163,106,0.45); text-decoration: none; }
.card .kicker { font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); font-weight: 700; }
.card h2, .card h3 { font-size: 1.1rem; margin: 8px 0 6px; font-family: var(--font-display); }
.card p { color: var(--muted); font-size: 0.88rem; }
.path {
  background: linear-gradient(135deg, rgba(240,163,106,0.12), rgba(126,182,255,0.08));
  border: 1px solid var(--border); border-radius: 16px; padding: 22px 20px; margin-top: 8px;
}
.path h2 { font-family: var(--font-display); font-size: 1.35rem; margin-bottom: 8px; }
.path ol { margin: 12px 0 0 1.2rem; color: var(--muted); }
.path li { margin: 8px 0; }
.path strong { color: var(--text); }
.search {
  width: 100%; margin: 8px 0 18px; padding: 12px 14px; border-radius: 10px;
  border: 1px solid var(--border); background: rgba(0,0,0,0.25); color: var(--text);
  font-size: 1rem;
}
.meta { color: var(--muted); font-size: 0.85rem; margin-bottom: 16px; }
.tag {
  display: inline-block; font-size: 0.72rem; padding: 2px 8px; border-radius: 999px;
  background: rgba(126,182,255,0.12); color: var(--accent2); margin: 0 4px 4px 0;
}
.tag.purpose { background: rgba(240,163,106,0.15); color: var(--accent); }
.practice {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 14px; padding: 18px; margin: 14px 0;
}
.practice h3 { font-family: var(--font-display); font-size: 1.15rem; margin-bottom: 8px; }
.quote {
  border-left: 3px solid var(--accent);
  padding: 8px 12px; margin: 10px 0; color: var(--text);
  background: rgba(0,0,0,0.2); border-radius: 0 8px 8px 0;
}
.row { margin: 8px 0; color: var(--muted); font-size: 0.92rem; }
.row b { color: var(--text); }
.group-title {
  font-family: var(--font-display); font-size: 1.25rem;
  margin: 28px 0 10px; padding-top: 8px; border-top: 1px solid var(--border);
}
.prose h1, .prose h2, .prose h3 { font-family: var(--font-display); margin: 1.2em 0 0.5em; }
.prose p, .prose li { color: var(--muted); margin: 0.55em 0; }
.prose strong { color: var(--text); }
.prose blockquote {
  border-left: 3px solid var(--accent); padding: 8px 14px; margin: 14px 0;
  color: var(--text); background: rgba(0,0,0,0.2); border-radius: 0 8px 8px 0;
}
.prose table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 0.9rem; }
.prose th, .prose td { text-align: left; padding: 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
.prose th { color: var(--muted); }
.prose code, .code code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85em;
}
.prose pre.code, pre.code {
  background: rgba(0,0,0,0.35); border: 1px solid var(--border);
  border-radius: 10px; padding: 12px 14px; overflow-x: auto; margin: 12px 0;
  color: #d7e3f4;
}
.scene-nav { display: flex; flex-wrap: wrap; gap: 10px; margin: 16px 0 8px; }
.scene-nav a {
  border: 1px solid var(--border); border-radius: 999px; padding: 6px 12px;
  color: var(--muted); font-size: 0.85rem;
}
.scene-nav a.active { color: var(--accent); border-color: rgba(240,163,106,0.5); }
footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--border); color: var(--muted); font-size: 0.82rem; }
details.drill {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 12px 14px; margin: 10px 0;
}
details.drill summary { cursor: pointer; color: var(--accent); font-weight: 600; }
`;

const NAV = [
  ["index.html", "首页", "home"],
  ["emotion/index.html", "情绪", "emotion"],
  ["warmup/index.html", "热身", "warmup"],
  ["scenes/index.html", "场景", "scenes"],
  ["techniques/index.html", "技巧", "techniques"],
];

function navHref(active, key) {
  const target = NAV.find((x) => x[2] === key)[0];
  if (active === "home") return key === "home" ? "index.html" : target;
  if (active === "scenes-detail") {
    return key === "home" ? "../index.html" : key === "scenes" ? "index.html" : `../${target}`;
  }
  if (key === active) return "index.html";
  if (key === "home") return "../index.html";
  return `../${target}`;
}

function layout({ title, active, body, base = "" }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · express-system</title>
<link rel="stylesheet" href="${base}assets/site.css">
</head>
<body>
<div class="wrap">
<nav class="top">
  <a class="brand" href="${navHref(active, "home")}">express-system</a>
  ${NAV.map(([, label, key]) => {
    const isActive = key === active || (active === "scenes-detail" && key === "scenes");
    return `<a class="${isActive ? "active" : ""}" href="${navHref(active, key)}">${label}</a>`;
  }).join("\n  ")}
</nav>
${body}
<footer>语料提炼自 video-notes / audio-workshop · 热身协议为原创 · 本站做结构化练习壳</footer>
</div>
</body>
</html>`;
}

function searchScript(sel = ".practice[data-search]") {
  return `<script>
(function(){
  var box = document.getElementById('q');
  if (!box) return;
  box.addEventListener('input', function(){
    var q = box.value.trim().toLowerCase();
    document.querySelectorAll('${sel}').forEach(function(el){
      var hay = el.getAttribute('data-search') || '';
      el.style.display = (!q || hay.indexOf(q) !== -1) ? '' : 'none';
    });
  });
})();
</script>`;
}

function write(file, html) {
  const full = path.join(DOCS, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, html, "utf8");
}

function cardHtml(c, idPrefix = "") {
  const hay = [c.title, c.badge, c.quote, c.how, c.dont, c.script, c.summary, c.group, ...(c.tags || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const sources = (c.sources || [])
    .map((s) =>
      s.href
        ? `<a href="${esc(s.href)}" target="_blank" rel="noopener">${esc(s.label || s.href)}</a>`
        : esc(s.label || "")
    )
    .filter(Boolean)
    .join(" · ");
  return `<article class="practice" id="${esc(idPrefix + c.id)}" data-search="${esc(hay)}">
  <div><span class="tag purpose">${esc(c.purpose || "")}</span>${c.group ? `<span class="tag">${esc(c.group)}</span>` : ""}${(c.tags || []).slice(0, 2).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
  <h3>${esc(c.title)}</h3>
  ${c.quote ? `<div class="quote">${esc(c.quote)}</div>` : ""}
  ${c.summary && c.summary !== c.quote ? `<div class="row">${esc(c.summary)}</div>` : ""}
  ${c.how ? `<div class="row"><b>怎么用</b> · ${esc(c.how)}</div>` : ""}
  ${c.dont ? `<div class="row"><b>别做</b> · ${esc(c.dont)}</div>` : ""}
  ${c.script ? `<div class="row"><b>口令</b> · ${esc(c.script)}</div>` : ""}
  ${sources ? `<div class="row"><b>出处</b> · ${sources}</div>` : ""}
</article>`;
}

function groupCards(cards) {
  const map = new Map();
  for (const c of cards) {
    const g = c.group || "未分组";
    if (!map.has(g)) map.set(g, []);
    map.get(g).push(c);
  }
  return map;
}

function renderCardSections(cards) {
  const groups = groupCards(cards);
  return [...groups.entries()]
    .map(([g, items]) => {
      return `<h2 class="group-title">${esc(g)} <span class="meta">(${items.length})</span></h2>
${items.map((c) => cardHtml(c)).join("\n")}`;
    })
    .join("\n");
}

function loadCards() {
  const emotion = readJson(path.join(CONTENT, "01-emotion/cards.json"));
  const scenes = {};
  for (const s of ["small-talk", "workplace", "conflict", "improv"]) {
    const p = path.join(CONTENT, `03-scenes/${s}/cards.json`);
    scenes[s] = fs.existsSync(p) ? readJson(p) : [];
  }
  const techniques = {
    host: readJson(path.join(CONTENT, "04-techniques/host-express.json")),
    persuasion: readJson(path.join(CONTENT, "04-techniques/persuasion.json")),
    atmosphere: readJson(path.join(CONTENT, "04-techniques/atmosphere.json")),
  };
  return { emotion, scenes, techniques };
}

function renderHome(catalog, all) {
  const counts = {
    emotion: all.emotion.length,
    scenes: Object.values(all.scenes).reduce((n, a) => n + a.length, 0),
    techniques:
      all.techniques.host.length + all.techniques.persuasion.length + all.techniques.atmosphere.length,
  };
  const body = `
<header class="hero">
  <h1>${esc(catalog.title)}</h1>
  <p>${esc(catalog.subtitle)}。控情绪 → 热嘴脑 → 按场景开口 → 用通用技巧回补结构与氛围。</p>
</header>
<section class="grid4">
  <a class="card" href="emotion/index.html"><div class="kicker">Module 01</div><h2>情绪与真实</h2><p>${counts.emotion} 张底座卡 · 原则文</p></a>
  <a class="card" href="warmup/index.html"><div class="kicker">Module 02</div><h2>练嘴热身</h2><p>3 / 5 / 8 分钟协议 · 绕口令贯口顺口溜</p></a>
  <a class="card" href="scenes/index.html"><div class="kicker">Module 03</div><h2>按场景练</h2><p>${counts.scenes} 张场景卡 · 四类开口场</p></a>
  <a class="card" href="techniques/index.html"><div class="kicker">Module 04</div><h2>通用技巧</h2><p>${counts.techniques} 张技巧卡 · 结构/说服/氛围</p></a>
</section>
<section class="path">
  <h2>推荐学习路径</h2>
  <ol>
    ${(catalog.learning_path || []).map((x) => `<li>${esc(x)}</li>`).join("\n    ")}
  </ol>
</section>
<section style="margin-top:28px">
  <h2 class="group-title">场景快捷入口</h2>
  <div class="scene-nav">
    <a href="scenes/small-talk.html">日常 Small Talk</a>
    <a href="scenes/workplace.html">职场话术</a>
    <a href="scenes/conflict.html">处理冲突</a>
    <a href="scenes/improv.html">即兴表达</a>
  </div>
</section>`;
  write("index.html", layout({ title: "首页", active: "home", body, base: "" }));
}

function renderEmotion(cards) {
  const principles = mdToHtml(readText(path.join(CONTENT, "01-emotion/PRINCIPLES.md")));
  const body = `
<header class="hero"><h1>情绪与真实</h1><p>开口前的底座：情绪、真相 gap、工具观。</p></header>
<div class="prose">${principles}</div>
<h2 class="group-title">出处练习卡</h2>
<input class="search" id="q" type="search" placeholder="搜索卡片…" autocomplete="off">
${renderCardSections(cards)}
${searchScript()}`;
  write("emotion/index.html", layout({ title: "情绪与真实", active: "emotion", body, base: "../" }));
}

function renderWarmup() {
  const protocol = mdToHtml(readText(path.join(CONTENT, "02-warmup/PROTOCOL.md")));
  const drills = [
    ["绕口令", "02-warmup/drills/绕口令.md"],
    ["贯口", "02-warmup/drills/贯口.md"],
    ["顺口溜", "02-warmup/drills/顺口溜.md"],
  ]
    .map(([title, rel]) => {
      const html = mdToHtml(readText(path.join(CONTENT, rel)));
      return `<details class="drill"><summary>${esc(title)}材料包</summary><div class="prose">${html}</div></details>`;
    })
    .join("\n");
  const body = `
<header class="hero"><h1>练嘴热身</h1><p>久不说话后的启动协议。先热嘴，再热脑，最后才说事。</p></header>
<div class="prose">${protocol}</div>
<h2 class="group-title">材料包</h2>
${drills}`;
  write("warmup/index.html", layout({ title: "练嘴热身", active: "warmup", body, base: "../" }));
}

function renderScenesIndex(scenes) {
  const labels = {
    "small-talk": "日常 Small Talk",
    workplace: "职场话术",
    conflict: "处理冲突",
    improv: "即兴表达",
  };
  const body = `
<header class="hero"><h1>按场景练</h1><p>选马上要进的场，抽 2–3 张卡开口。每张卡都带 purpose。</p></header>
<section class="grid4">
  ${Object.entries(labels)
    .map(
      ([id, title]) =>
        `<a class="card" href="${id}.html"><div class="kicker">${esc(id)}</div><h2>${esc(title)}</h2><p>${scenes[id].length} 张卡</p></a>`
    )
    .join("\n  ")}
</section>`;
  write("scenes/index.html", layout({ title: "按场景练", active: "scenes", body, base: "../" }));
}

function renderScenePage(sceneId, title, cards) {
  const nav = ["small-talk", "workplace", "conflict", "improv"]
    .map((id) => {
      const label = { "small-talk": "Small Talk", workplace: "职场", conflict: "冲突", improv: "即兴" }[id];
      return `<a class="${id === sceneId ? "active" : ""}" href="${id}.html">${label}</a>`;
    })
    .join("");
  const body = `
<header class="hero"><h1>${esc(title)}</h1><p>${cards.length} 张可练卡片</p></header>
<div class="scene-nav">${nav}<a href="index.html">全部场景</a></div>
<input class="search" id="q" type="search" placeholder="搜索本场景…" autocomplete="off">
${renderCardSections(cards)}
${searchScript()}`;
  write(
    `scenes/${sceneId}.html`,
    layout({ title, active: "scenes-detail", body, base: "../" })
  );
}

function renderTechniques(tech) {
  const all = [...tech.host, ...tech.persuasion, ...tech.atmosphere];
  const body = `
<header class="hero"><h1>通用技巧</h1><p>跨场景可复用：结构训练、说服武器、谈话氛围。被场景卡引用，不替代场景练习。</p></header>
<p class="meta">共 ${all.length} 张 · host-express ${tech.host.length} · 说服 ${tech.persuasion.length} · 氛围 ${tech.atmosphere.length}</p>
<input class="search" id="q" type="search" placeholder="搜索技巧 / 原句 / 分组…" autocomplete="off">
<h2 class="group-title">表达系统主线</h2>
${tech.host.map((c) => cardHtml(c)).join("\n")}
<h2 class="group-title">说服话术</h2>
${renderCardSections(tech.persuasion)}
<h2 class="group-title">谈话氛围</h2>
${renderCardSections(tech.atmosphere)}
${searchScript()}`;
  write("techniques/index.html", layout({ title: "通用技巧", active: "techniques", body, base: "../" }));
}

function writeSearchIndex(catalog, all) {
  const rows = [];
  const push = (c) => {
    rows.push({
      id: c.id,
      title: c.title,
      module: c.module,
      scene: c.scene,
      purpose: c.purpose,
      quote: c.quote,
      group: c.group,
      href:
        c.module === "emotion"
          ? `emotion/index.html#${c.id}`
          : c.module === "scenes"
            ? `scenes/${c.scene}.html#${c.id}`
            : `techniques/index.html#${c.id}`,
    });
  };
  all.emotion.forEach(push);
  Object.values(all.scenes).flat().forEach(push);
  all.techniques.host.forEach(push);
  all.techniques.persuasion.forEach(push);
  all.techniques.atmosphere.forEach(push);
  write(
    "index.json",
    JSON.stringify({ generated: new Date().toISOString().slice(0, 10), catalog, count: rows.length, items: rows }, null, 2)
  );
}

function main() {
  fs.mkdirSync(path.join(DOCS, "assets"), { recursive: true });
  fs.writeFileSync(path.join(DOCS, "assets/site.css"), CSS, "utf8");

  const catalog = readJson(path.join(CONTENT, "catalog.json"));
  const all = loadCards();

  renderHome(catalog, all);
  renderEmotion(all.emotion);
  renderWarmup();
  renderScenesIndex(all.scenes);
  renderScenePage("small-talk", "日常 Small Talk", all.scenes["small-talk"]);
  renderScenePage("workplace", "职场话术", all.scenes.workplace);
  renderScenePage("conflict", "处理冲突", all.scenes.conflict);
  renderScenePage("improv", "即兴表达", all.scenes.improv);
  renderTechniques(all.techniques);
  writeSearchIndex(catalog, all);

  const total =
    all.emotion.length +
    Object.values(all.scenes).reduce((n, a) => n + a.length, 0) +
    all.techniques.host.length +
    all.techniques.persuasion.length +
    all.techniques.atmosphere.length;
  console.log(`rendered docs/ · cards=${total}`);
}

main();
