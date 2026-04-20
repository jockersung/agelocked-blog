# AGELOCKED Blog — Claude Code 總入口

## 專案簡介

- 網站：agelocked.com
- 技術棧：Astro + Cloudflare Pages
- GitHub：jockersung/agelocked-blog
- GA4：G-9JPQ34N5BN
- 目標受眾定位：「把健康排最後的你」

## 內容漏斗架構

| 分類 | 屬性 | 目標篇數 | CTA 類型 |
|---|---|---|---|
| ①身體訊號解讀 | 上漏斗 | 10 篇 | 軟退出 |
| ②慢性發炎科學 | 中漏斗 | 12 篇 | 軟退出 |
| ③精準健康工具 | 中下漏斗 | 16 篇 | 硬退出 |
| ④介入與調校 | 下漏斗 | 7 篇 | 硬退出 |

**軟退出：** LINE @fer7932k + 【身體警報訊號自我評估清單】
**硬退出：** Prysm iO 掃描預約 or 直接諮詢

## Lead Magnet

【身體警報訊號自我評估清單】
LINE：@fer7932k
URL：https://line.me/ti/p/@fer7932k

## Skills

任務開始前，依任務類型載入對應 SKILL：

- **文章撰寫、起草、修改內容：** 讀取 `.claude/skills/article-writer/SKILL.md`
- **技術修改（元件、slug、redirects、Astro 設定）：** 讀取 `.claude/skills/site-editor/SKILL.md`
- **內容策略（漏斗規劃、缺口分析、文章排程）：** 讀取 `.claude/skills/content-strategist/SKILL.md`

## 禁止事項（全域）

- 禁止出現「科技人」「菁英」「百萬年薪」等舊版 TA 語言
- 禁止 slug 使用中文字元
- 禁止單篇出現多個不同 CTA
- 禁止引用無 DOI 的科學數據
