# express-system

个人表达学习系统：统一内容层 + 静态学习站。

**学习闭环**：情绪与真实 → 练嘴热身 → 场景开口 → 通用技巧回补。

| 模块 | 目录 | 内容源 |
|------|------|--------|
| 情绪与真实 | `content/01-emotion/` | 原创原则 + 播客出处卡 |
| 练嘴热身 | `content/02-warmup/` | 原创协议 + 绕口令/贯口/顺口溜 |
| 按场景练 | `content/03-scenes/` | audio-workshop 手册拆分 + video-notes 职场/即兴 |
| 通用技巧 | `content/04-techniques/` | host-express 主线 + 说服/氛围专栏结构化卡 |

旧仓（video-notes / audio-workshop）继续做生产工厂；本仓消费结构化导出。

## 结构

```
express_system/
├── content/           # 结构化学习内容（真相源）
├── schemas/           # JSON Schema
├── scripts/           # 导入 / 校验 / 渲染
└── docs/              # GitHub Pages 学习站
```

## 快速开始

```bash
# 从旁路源仓导入（需本机存在 audio-workshop / video-notes）
python3 scripts/import-from-audio-guides.py
python3 scripts/import-from-video-notes.py

# 校验内容
python3 scripts/validate-content.py

# 渲染静态站
node scripts/render-site.mjs
```

本地预览：`cd docs && python3 -m http.server 8766`

## GitHub Pages

- 仓库：https://github.com/czh55/express_system
- 站点：https://czh55.github.io/express_system/（Settings → Pages：`main` / `/docs`）

每张卡含 `id`、`module`、`purpose`、`sources[]`。详见 `schemas/card.schema.json`。
