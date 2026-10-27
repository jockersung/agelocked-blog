# AGELOCKED Blog — Claude Code 總入口

## 專案簡介

- 網站：agelocked.com
- 技術棧：Astro + Cloudflare Pages
- GitHub：jockersung/agelocked-blog
- GA4：G-9JPQ34N5BN
- 目標受眾定位：「把健康排最後的你」

## 文章分類：男性慢老六站

讀者看到的分類（frontmatter `category`）只有六個，對應健康島地圖由北往南的六站與六都：

| # | category | 地圖位置 | 英文代號（/category/、/knowledge/?cat=） |
|---|---|---|---|
| 1 | 身材 | 台北 | body |
| 2 | 臉蛋 | 新北 | face |
| 3 | 性健康 | 桃園 | sexual-health |
| 4 | 禿頭、白髮 | 台中 | hair |
| 5 | 心血管 | 台南 | heart |
| 6 | 健檢站 | 高雄 | checkup |

- 定義在 `src/utils/categories.ts`；地圖的子主題與「先看這篇」在 `src/data/island-map.ts`
- 性健康站不放產品介紹文章；產品文章 frontmatter 加 `product: true`，知識庫與地圖會標示「產品介紹」
- 知識庫 `/knowledge/`（地圖上的澎湖）：全部文章＋語音版，可依六站篩選

## 內容漏斗架構（內部用：文章資料夾）

漏斗層級不再是讀者看到的分類，改由文章所在的資料夾決定，同時是文章網址的前綴（`/blog/<資料夾>/<slug>/`，已凍結，不可改）：

| 資料夾 | 漏斗 | CTA 類型 |
|---|---|---|
| body-signals | 上漏斗 | 軟退出 |
| chronic-inflammation | 中漏斗 | 軟退出 |
| precision-health-tools | 中下漏斗 | 硬退出 |
| intervention-optimization | 下漏斗 | 硬退出 |

**軟退出：** LINE @fer7932k + 【身體警報訊號自我評估清單】
**硬退出：** Prysm iO 掃描預約 or 直接諮詢

## Lead Magnet

【身體警報訊號自我評估清單】
LINE：@fer7932k
URL：https://line.me/ti/p/@fer7932k

## Skills

任務開始前，依任務類型載入對應 SKILL：

- **文章撰寫、起草、修改內容：** 讀取 `.claude/skills/article-writer/SKILL.md`；交稿前必跑其中的「交稿前必查清單」
- **配圖、封面、產品圖、圖片提示語：** 讀取專案根目錄的 `IMAGE-STYLE.md`
- **技術修改（元件、slug、redirects、Astro 設定）：** 讀取 `.claude/skills/site-editor/SKILL.md`
- **內容策略（漏斗規劃、缺口分析、文章排程）：** 讀取 `.claude/skills/content-strategist/SKILL.md`

## 禁止事項（全域）

- 禁止出現「科技人」「菁英」「百萬年薪」等舊版 TA 語言
- 禁止 slug 使用中文字元
- 禁止單篇出現多個不同 CTA（CTA 由版面自動加上，內文不另寫；用 frontmatter 的 ctaType／ctaBridge 控制）
- 禁止引用無 DOI 的科學數據（例外見 article-writer SKILL「引用規範」：政府統計、廠商技術文件等可附官方網址引用）
