# AGELOCKED 圖片生產系統

Windows 本機 Python CLI。Excel 是任務數量、類型、批次與輸出檔名的依據。
預設完全離線。圖片 API 尚未實測，只有 Mock HTTP 與 Mock Provider 測試。

## 2026-10-19 封面預覽更新

使用者已改選 **Codex 內建產圖**，使用方案額度，這批不啟用獨立 API。
內建工具由 Codex 在對話中呼叫，不是 Python 以訂閱登入資訊呼叫 API。
本機程式使用 `python -m src.register_builtin <manifest.json>` 接收實際生成的圖片、保留版本、轉檔及更新狀態。
內建工具未揭露實際模型名稱或精確 token／credits，用量不可當成已知零；獨立 API 呼叫數為 0。

封面新規則：**完整文章標題、大字、最多兩行**。標題由 Markdown frontmatter 讀取，不以縮寫或資料夾名稱代替。
提示詞保留插畫的無額外文字要求，但封面明確允許完整標題。長標題調整字級、保留全文，不加到三行。
產圖後的文字與行數仍須視覺核對，不能將生成成功當成人工核可。
原有 10 張無字初稿維持原檔，另登記為 GENERATED。新一批 10 張為 REVIEW_REQUIRED，未整合或部署網站。

## 安裝與離線檢查

在此資料夾用 PowerShell 執行：

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe run.py --inspect
.\.venv\Scripts\python.exe run.py --dry-run
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

直接使用已安裝相依套件的 `python run.py` 亦可。第一次執行會複製根目錄既有 Excel、手冊到 inputs，並安全解壓原有 ZIP 到 inputs/unpacked，原檔保留。
網站圖片只讀取、計算 SHA-256 與檢查可讀性，不複製數百 MB 原圖。
`inputs/source_images/` 可放外部補充素材，或以 manifest 映射到任務 ID。

## 操作介面

```powershell
python run.py --inspect
python run.py --dry-run
python run.py --batch 1 --limit 3
python run.py --batch 1
python run.py --slug hearing-loss-dementia-signal
python run.py --resume
python run.py --report
python run.py --package
```

`--inspect`、`--dry-run`、`--report`、`--package` 都不呼叫 API。
`--limit` 是篩選之後最多新增的可生成任務數量；`--task-ids 1,2,4` 可精確選取。
`--resume` 跳過已生成、待審、已核可及已完成任務，既存 raw 可繼續後製。
`--force` 才會將舊輸出移到 outputs/history 後重做，但仍須通過全部付費與素材檢查。
不同任務以序號隔離輸出，目錄內保留 Excel 的繁體中文檔名。

## 素材與既有初稿

目前未假設 10 張 ChatGPT 初稿存在。請將實際圖片放入 `inputs/existing_images/`，再建立 `manifest.json`：

```json
{"1": {"file": "inputs/existing_images/draft-01.png", "mapped_by": "人工確認者"}}
```

必須人工看圖比對任務，不能只靠檔名推測。盤點會將這些圖設為 GENERATED，離線模式不會付費重生。
可在 `DRY_RUN=false` 時用對應 task-ids 進行本機尺寸處理，再人工審核。
如要在缺少那 10 張圖的情況下繼續新生成，必須先由使用者明確釐清，然後才修改 settings.yaml 的 `existing_drafts_resolved`。

錨點放入 inputs/anchors 並在 styles.yaml 的 general_anchors / product_anchors 列出相對路徑。
系統沒有預設已內建 ChatGPT 專案中的錨點。缺錨點會 BLOCKED。

缺原圖的重畫任務可建立 `inputs/source_images/manifest.json`：

```json
{"123": "inputs/source_images/original.png"}
```

產品圖片必須是有真實來源的透明 PNG，`inputs/product_photos/manifest.json`：

```json
{"10": {"file": "inputs/product_photos/official.png", "official_source": "官方素材來源網址", "verified_by": "人工確認者"}}
```

官方去背產品照以程式等比例縮放、合成到右側空白區；不傳給生成模型重畫包裝。
近似包裝、只有舊網站拼貼圖或缺少官方來源都不能取代正式素材。

## 科學圖表

`inputs/chart_data/NNN.json`（NNN 是三位任務序號），範例只描述 schema，不提供虛構數據：

```json
{
  "confirmed_by": "數據核對者", "source": "論文 DOI 或網址、表格位置",
  "title": "確認後的圖名", "x_label": "橫軸", "y_label": "縱軸", "unit": "單位",
  "labels": [], "series": [], "kind": "line"
}
```

series 每組包含 name 與等長的 values；有誤差線才增加 errors 和頂層 error_definition。
空值、非有限數字、長度不符或未確認來源會停止繪製。支援 line / bar，複雜圖表須另建忠實的 renderer。
實際 NotoSansTC-Regular.ttf 放入 inputs/fonts。程式不自動 OCR、補數字或推測顯著性。

## API、成本與明確核准

已實作 OpenAI `/v1/images/generations` 與 multipart `/v1/images/edits`，可接收 base64 PNG、儲存原圖、處理為網站尺寸。
Provider 透過 Protocol / factory 與流程分離。替換供應商時需新增 adapter、價格及測試，不能只更改未驗證的模型字串。
目前唯一啟用的模型是已查核參數與估價的 `gpt-image-2`，medium、1536x1024、opaque PNG。
官方同時提供 GPT Image 2.5 Sunburst / Flare；本次不在未核價的情況切換模型。

依官方圖片生成指南，選定設定的純輸出約 US$0.041/張。
另以每張 US$0.005–0.15 的文字及參考圖片輸入費作規劃假設，因此預估 US$0.046–0.191/張。
這個範圍不是官方套餐價格，也不是保證上限。參考圖片與實際 token 數可改變金額，重生另計。
200 筆潛在 API 任務約 US$9.20–38.20；17 張 C 與 4 張沿用圖不呼叫生成 API。
單張預留 US$0.25、預設總額 US$10。帳戶 API 帳單與 Codex 訂閱分開。

**目前禁止呼叫付費 API。取得使用者對首批三張及費用的明確同意後，才可由操作者執行以下步驟：**

1. 補齊錨點，釐清既有初稿，執行 inspect，確認指定三筆 READY。
2. 在本機設定 OPENAI_API_KEY 環境變數，或複製 `.env.example` 到 `.env` 後僅在本機填入。
3. 記錄具體核准範圍：`python run.py --approve-cost --task-ids 1,2,4 --limit 3 --reviewed-by 核准者`。
4. 設定 `DRY_RUN=false`，執行 `python run.py --batch 1 --task-ids 1,2,4 --limit 3`。
5. 人工檢查三張結果，確認文字、科學、主題、包裝、留白與技術 QA 後：`python run.py --approve --task-ids 1,2,4 --reviewed-by 審核者`。
6. 三張都已核可後才能 `python run.py --trial-passed --reviewed-by 審核者`；更大批次仍須另記錄 approve-cost。

核准綁定任務、prompt、參考圖 SHA-256、模型、尺寸、品質、單次預留與預算。
調高預算、更換模型／素材後必須重新核准。
狀態每次更新以暫存檔 + replace 寫入；OS 檔案鎖防止兩個 CLI 同時生成。
最多兩個請求並行，只有明確的暫時性 429／503 才退避重試，上限三次，遵守 Retry-After。
timeout、網路中斷、未知 5xx 不盲目重試。未知計費會凍結後續請求，需人工對照 request ID / 帳戶用量，釐清 ledger 後才能續跑。
有 usage 時紀錄依 token 費率推算的費用，未提供 usage 就保留預留額，不宣稱實際費用為零。
本機估價與預留並非服務端硬性帳單上限；已在途請求仍可能完成。

## 品質與網站整合

技術 QA 檢查可開啟性、尺寸／比例、空白、背景角落與過多暗色像素。
OCR、語意、構圖裁切、疾病暗示及產品包裝完整性沒有自動驗證器，報表明列 NOT_AUTOMATICALLY_VERIFIED，必須人工檢查。
尺寸處理採 Lanczos 等比例縮放＋米白留白，不強制拉伸或裁切。
PNG、WebP、原始 API 圖、失敗輸出及原因都保留。

`python run.py --integrate-preview --task-ids 1,2,4` 只輸出 patch 和對應新檔案計畫。
只允許 APPROVED 圖片，核對核可檔案 SHA-256。新網站檔名加 `-agelocked-NNN.webp`，舊圖片不覆寫、不刪除。
同一原圖同時供封面與內文使用時，分別更新 heroImage 或內文引用，避免誤改另一個位置。
不改 slug、文章文字或無關 frontmatter；不支援的 Markdown 引用方式停止並回報。
新九篇文章的 Markdown 留在 ZIP 解壓區，不自動發佈文章。

目前不套用任何網站整合。未來使用者審查 patch 並明確允許後才可 `--integrate --confirm-site-changes`。
套用時重新核對文章 hash，先備份文章，再寫入新名稱圖片並更新引用。故障時可從 outputs/backups 回復文章；不會刪原圖。
正式整合後才標記 COMPLETED。`--package` 僅打包 COMPLETED 的 PNG、WebP 與 SHA-256 清單，未完成批次 ZIP 只有 manifest。
目前網站 package.json 沒有 images:webp 指令，因此沒有呼叫手冊中的刪 PNG 轉檔腳本。
Phase 6 的任務 Excel 回寫尚待實際圖片核可與整合階段；目前以本機 tasks JSON / UTF-8 CSV 記錄進度，來源 Excel 不修改。

## 報表與 Git

outputs/reports 包含全任務、缺素材 CSV、圖片 SHA-256 盤點、同檔重複群、既有初稿檢查與 summary。
outputs/batches 每批包含 manifest.csv、blocked.csv、cost_report.csv、review.html、completed.zip。
HTML 可直接從本機開啟；無圖時明確顯示「尚無新圖」。不嵌入第三方遠端程式或送出審核資料。
產生紀錄、輸入素材、Excel、ZIP、outputs、.env、虛擬環境都由本資料夾 .gitignore 排除。
程式不執行 git add、commit、push、merge 或部署。

## 官方 API 查核（2026-10-19）

- [Images 指南、模型、尺寸與輸出估價](https://developers.openai.com/api/docs/guides/image-generation)
- [GPT Image 2 模型與快照](https://developers.openai.com/api/docs/models/gpt-image-2)
- [Images generate](https://developers.openai.com/api/reference/resources/images/methods/generate)
- [Images edit：最多 16 張參考圖、PNG/JPEG/WebP](https://developers.openai.com/api/reference/resources/images/methods/edit)
- [官方價格表](https://developers.openai.com/api/docs/pricing)
- [Rate limits 與 Retry-After](https://developers.openai.com/api/docs/guides/rate-limits)

API 自訂尺寸須 16 的倍數，且受像素與邊長限制；指定網站 2400×1260／2400×1350 不符合所有限制，因此用 1536×1024 再本機補齊。
gpt-image-2 不傳 input_fidelity。各帳戶的 RPM/IPM/TPM 和模型存取權取決於服務等級及帳戶限制，沒有在離線階段假設可用配額。
