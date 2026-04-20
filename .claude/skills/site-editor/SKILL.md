# SKILL: agelocked-site-editor

適用任務：修改 Astro 元件、更新 slug、新增 redirects、調整設定、修 bug、改版面

---

## 強制前置動作

### Step 1 — 確認修改範圍
詢問（若使用者未說清楚）：
- 修改的是哪個檔案 / 哪個頁面 / 哪個功能？
- 預期的結果是什麼？

### Step 2 — 讀取相關檔案再動手
**禁止在沒有讀取現有檔案內容的情況下直接輸出修改。**
先用 Read 工具讀取目標檔案，確認現有結構後再執行 str_replace。

---

## 專案技術規格

| 項目 | 規格 |
|---|---|
| 框架 | Astro（Static Site Generation） |
| 部署 | Cloudflare Pages |
| 內容目錄 | `src/content/blog/` |
| 頁面目錄 | `src/pages/` |
| 元件目錄 | `src/components/` |
| Redirect 檔 | `public/_redirects` |
| GA4 | G-9JPQ34N5BN |

---

## Slug 操作規則

**新增 slug 時：**
- 全英文 kebab-case，禁止中文字元
- 在 frontmatter 明確宣告 `slug:` 欄位（不依賴檔名自動生成）

**修改現有 slug 時（必須同步更新 _redirects）：**
```
# public/_redirects 格式
/old-slug  /new-slug  301
```
範例：
```
/biological-age-gap  /youthspan-biological-age  301
```

**301 重定向原則：**
- 每次改 slug 都要新增一條 redirect
- 舊路徑永遠不能 404（影響 SEO 和 Search Console 表現）

---

## 頁面修改流程

```
1. Read 目標檔案
2. 確認現有結構
3. str_replace 精準修改（不重寫整個檔案，除非必要）
4. 確認 frontmatter / import / export 完整性
5. 若涉及路由，確認 _redirects 是否需要同步更新
```

---

## Astro 注意事項

- Content Collections 的 schema 在 `src/content/config.ts`，新增 frontmatter 欄位前先確認
- `astro.config.mjs` 修改前備份現有設定
- 圖片放 `public/`，引用用絕對路徑 `/images/xxx.jpg`
- MDX 檔案可使用元件，`.md` 不行

---

## GA4 / Analytics

- GA4 ID：G-9JPQ34N5BN
- 追蹤碼已整合，不要重複注入
- 若需要追蹤自訂事件，在元件層用 `gtag()` 注入

---

## 禁止事項

- 禁止直接覆寫整個大型檔案（用 str_replace 精準修改）
- 禁止修改 slug 但不更新 `_redirects`
- 禁止在沒讀取現有檔案的情況下猜測結構
- 禁止移除現有的 GA4 追蹤碼
