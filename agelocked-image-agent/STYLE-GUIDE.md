# AGELOCKED 雙軌視覺規格

版本：2026-10-25。依站主偏好的 109 張補圖建立；以下名稱為製作溝通用的描述，不是官方流派認證。

## 兩種畫面，共用一個品牌

| 樣式 | 英文描述 | 用途 | 視覺特點 |
|---|---|---|---|
| 溫潤紙感健康編輯插畫 | Warm Textured Editorial Health Illustration | 人物、生活情境、食物原料、器官結構與科學概念 | 柔和有機輪廓、自然比例、淡紙感、克制陰影、溫暖留白 |
| 極簡編輯式資訊圖解 | Minimal Editorial Infographics | 比較、流程、單位、紀錄表與核准數據圖表 | 清楚層級、少量線性圖示、圓角區塊、精確繁中標籤、容易校對 |

米白底 `#FAF7F2`；深青綠 `#1F5C5C`、青綠 `#2E8B8B`、鼠尾草綠 `#8FB9A8`、琥珀金 `#E0A43A`。警示橘紅 `#E8613C` 只在內容確實需要警示時使用。字體優先 Noto Sans TC。

插畫和圖解不是同一種筆觸；一致性來自配色、留白、標籤與內容表達。同一篇文章的人物、線條、陰影應保持一致。避免讓插畫只剩裝飾，也避免用重複文字卡湊圖片數。

## 已核准的參考圖

`style_references/editorial-20261025/` 包含三張插畫、兩張資訊圖解，均來自本次核准補圖。這些是風格參考，不是科學數據來源，也不是每張任務的內容原圖。

- `warm-consultation.webp`：人物與生活情境。
- `warm-ingredients.webp`：原料、植物與自然質感。
- `warm-science.webp`：科學概念的柔和插畫。
- `diagram-comparison.webp`：比較資訊與標籤層級。
- `diagram-worksheet.webp`：紀錄表與步驟資訊。

## 文字與輸出

- 封面：完整文章標題，大字，最多兩行；不添加其他口號。
- 內文：不加文章式大標題。分子名稱、科學標籤、必要解釋、單位、座標軸、圖例與來源必須保留，不能留空白框。
- 封面 2400×1260；內文 2400×1350。網站最終檔使用 WebP，最大寬度 2400、品質 85，保留原始 PNG／編輯來源。
- 不強制拉伸；產品瓶身、瓶蓋、包裝和標籤比例保持正確，去背後自然融入背景，不保留白色矩形外框。
- 原圖不覆蓋。新版本先暫存、看圖審核，再整合正式網站。

## 原 221 張如何改版

保留 Excel 原任務 ID、檔名與原始狀態。四種任務依內容分流：

1. A 封面：優先紙感插畫，保留主題與完整標題規則。
2. B 內文：人物、器官與結構用插畫；流程、比較、單位、表格用資訊圖解。照原構圖重畫的任務仍須保留構圖與元素；缺原圖就停下。
3. C 科學圖表：從已核准的原始資料用本機程式重繪，換色、字體與版面不等於重造數據。未確認資料維持待審，不呼叫生成模型補點。
4. D 產品：保留已核對官方來源或明確核准的卡通產品素材。現有 Provider 只生成背景，再程式合成產品；不讓模型杜撰包裝。
5. 重用任務：等來源新版核准後再重用，不額外重生。

已合併文章、移除的版位及圖片庫資產，需先核對現行網站，不因改風格而恢復舊文章或硬插已刪除的圖。

## 程式怎麼使用

`config/style_profiles.yaml` 是新樣式的設定來源。`src/style_profiles.py` 根據任務類型、檔名與明確指定的 `visual_kind`／`style_profile` 選擇樣式；`prompt_builder.py` 會套用規格，素材驗證器會選對參考圖。樣式設定的雜湊加入付費核准指紋，換風格不會沿用過期的 API 費用核准。

```powershell
python style_tools.py --inspect
python style_tools.py --plan-legacy
python run.py --dry-run
```

前兩個指令只讀取規格或建立 221 張改版對照，不呼叫 API、不更動原任務完成狀態、不產生新圖。對照表在 `outputs/reports/style-migration-20261025/review.html`，完整提示詞預覽在同目錄 `plan.json`。

可明確指定 `style_profile: warm_editorial` 或 `minimal_infographic`；未知名稱會報錯。`visual_kind` 支援 scene、anatomy、ingredients、mechanism，以及 workflow、comparison、worksheet、units、infographic。

實際製作仍優先由 Codex 使用內建產圖，或用可編輯圖解／資料繪圖工具產生；Python 不能假裝自己能直接使用 Codex 訂閱產圖。既有 API Adapter、預算上限、dry-run 與成本核准限制保留，不因加入風格而自動改成付費生成。
