// 健康島（/map）設定檔
// ─────────────────────────────────────────────
// 文章標題、摘要、分類、內文連結都在 build 時從 content collection 自動讀取，這裡只放「地圖怎麼排」。
// 新文章發佈後：
//   - 不改這個檔，它也會出現在地圖上：系統依分類自動放到同一步、文章最少的島（每島最多 7 篇）
//   - 想指定放哪座島、取短名或換建物模型，就在該島 items 加一行 { slug, name, model }
// model 可用：house hall classroom clinic lab bed watch scanner book clock globe battery farm court stage dna chart tube kiosk
// q, r 是六角座標（台灣輪廓已排好，一般不需要動）

export type MapItem = { slug?: string; page?: { id: string; title: string; url: string; tier: number }; name: string; model: string; facts?: string[] };
export type MapIsland = { id: string; name: string; q: number; r: number; tier: number; landmark: string; color: string; pattern: 'brick' | 'speckle' | 'stripe'; tree: string; carry: string; role: string; summary: string; items: MapItem[] };

export const STEPS = [null, {"short": "察覺", "name": "察覺訊號", "what": "認出身體正在發出的警訊，知道這些小問題值得在意。"}, {"short": "原因", "name": "找出原因", "what": "搞懂訊號背後的機制，多半指向同一件事：慢性低度發炎。"}, {"short": "量測", "name": "量測確認", "what": "用血液、穿戴裝置、皮膚掃描的數據，看自己實際在哪裡。"}, {"short": "調整", "name": "開始調整", "what": "依數據決定先改哪一件事，並用 90 天追蹤成效。"}] as const;

export const ISLANDS: MapIsland[] = [
  {"id": "body", "name": "身體訊號", "q": 5, "r": -5, "tier": 1, "landmark": "bell", "color": "#f2b5c6", "pattern": "brick", "tree": "cherry", "carry": "chat", "role": "office", "summary": "健檢沒紅字卻一直累、腰圍悄悄變大、牙齦出血。這些「不是大病」的訊號，是一切的起點。", "items": [{"slug": "normal-checkup-still-tired", "name": "正常卻疲倦", "model": "clinic", "facts": ["首頁推薦必讀 3 篇之 1"]}, {"slug": "three-signs-chronic-inflammation", "name": "三件事同時出現", "model": "chart", "facts": ["3 件事同時出現", "首頁推薦必讀 3 篇之 1"]}, {"slug": "checkup-five-numbers", "name": "健檢 5 個數字", "model": "tube", "facts": ["5 個值得多看的數字"]}, {"slug": "visceral-fat-metabolic-signal", "name": "腰圍訊號", "model": "chart", "facts": ["腰圍每年多 3 公分"]}, {"slug": "gum-bleeding-brain-inflammation", "name": "牙齦出血", "model": "house"}, {"slug": "white-hair-stem-cells", "name": "白髮與幹細胞", "model": "lab"}, {"slug": "hairline-recession-warning", "name": "髮際線警告", "model": "kiosk"}]},
  {"id": "brain", "name": "大腦與壓力", "q": 5, "r": -6, "tier": 1, "landmark": "brain", "color": "#b49ad0", "pattern": "speckle", "tree": "willow", "carry": "moon", "role": "parent", "summary": "壓力、聽力、發炎，都在悄悄改寫大腦。好消息是，有些人 80 歲記憶力仍然很好。", "items": [{"slug": "478-breathing-sleep-vagus-nerve", "name": "4-7-8 呼吸", "model": "stage", "facts": ["19 秒的呼吸公式"]}, {"slug": "stress-mitochondria-bdnf-depression", "name": "壓力與大腦蛋白", "model": "lab"}, {"slug": "hearing-loss-dementia-signal", "name": "聽力與失智", "model": "house"}, {"slug": "hearing-loss-supplement-strategy", "name": "聽力保養策略", "model": "farm", "facts": ["聽力損失 30% 才感覺到", "6 種補充策略"]}, {"slug": "super-agers-neurogenesis-healthspan", "name": "超級老人", "model": "globe", "facts": ["同樣 80 歲"]}, {"slug": "neurogenesis-inflammaging-cognitive-resilience", "name": "發炎與大腦", "model": "dna"}]},
  {"id": "men", "name": "男性 40+", "q": 3, "r": -5, "tier": 1, "landmark": "mars", "color": "#7fa6c9", "pattern": "stripe", "tree": "conifer", "carry": "report", "role": "coach", "summary": "40 歲之後的疲勞和 20 歲不一樣。睡眠、睪固酮與細胞老化，是同一條線。", "items": [{"slug": "male-fatigue-after-40", "name": "40 歲後的疲勞", "model": "hall", "facts": ["40 歲之後"]}, {"slug": "sleep-quality-testosterone", "name": "睡眠與睪固酮", "model": "bed", "facts": ["40 歲之後"]}, {"slug": "testosterone-cell-aging-40", "name": "睪丸細胞老化", "model": "lab", "facts": ["40 歲"]}, {"slug": "maca-arginine-vs-ageloc-r2", "name": "瑪卡配方盲點", "model": "kiosk"}, {"slug": "ageloc-r2-cellular-renewal", "name": "ageLOC R2", "model": "clock", "facts": ["40 歲看起來像 32 歲"]}]},
  {"id": "inflam", "name": "慢性發炎", "q": 2, "r": -4, "tier": 2, "landmark": "flame", "color": "#e9a27c", "pattern": "brick", "tree": "round", "carry": "book", "role": "researcher", "summary": "把散落的小問題連起來看：它們常指向同一個根本原因，慢性低度發炎。", "items": [{"slug": "anti-inflammation-anti-aging", "name": "抗發炎即抗老", "model": "hall", "facts": ["2000 年就確立的科學", "首頁推薦必讀 3 篇之 1"]}, {"slug": "inflammation-three-clues", "name": "一把火三處煙", "model": "globe", "facts": ["3 個地方找線索"]}, {"slug": "hs-crp-low-grade-inflammation", "name": "hs-CRP 看小火", "model": "tube"}, {"slug": "cell-reserve-chronic-depletion", "name": "細胞儲備耗損", "model": "battery"}, {"slug": "free-radical-two-faces", "name": "自由基兩張臉", "model": "house"}, {"slug": "polyphenol-nrf2-antioxidant-myth", "name": "多酚像重訓", "model": "court"}]},
  {"id": "blood", "name": "血液數據", "q": -2, "r": 0, "tier": 3, "landmark": "drop", "color": "#e38c8c", "pattern": "speckle", "tree": "conifer", "carry": "tube", "role": "elder", "summary": "三維數據之一。把你已經有的健檢報告，讀出生活型態的線索。", "items": [{"slug": "apob-vs-ldl", "name": "ApoB vs LDL", "model": "clinic"}, {"slug": "lpa-genetic-risk", "name": "Lp(a)", "model": "tube", "facts": ["一輩子驗 1 次就夠"]}, {"slug": "three-clues-cross-reading", "name": "三數字交叉讀", "model": "globe", "facts": ["3 個數字一起看", "6 種常見組合"]}, {"slug": "functional-medicine-execution-gap", "name": "檢測之後呢", "model": "house"}, {"slug": "tracking-rhythm", "name": "身體追蹤節奏", "model": "clock", "facts": ["日、月、年 3 種節奏"]}]},
  {"id": "sleep", "name": "睡眠修復", "q": 4, "r": -4, "tier": 2, "landmark": "moon", "color": "#7fb2d4", "pattern": "stripe", "tree": "conifer", "carry": "moon", "role": "student", "summary": "睡眠是大腦的夜班清潔時間。睡得夠不夠之外，還要看睡得好不好。", "items": [{"slug": "sleep-glymphatic-brain-detox", "name": "大腦夜間清洗", "model": "bed"}, {"slug": "sleep-duration-biological-aging", "name": "最佳睡眠時數", "model": "clock"}, {"slug": "hypertension-glymphatic-dementia", "name": "血壓與記憶", "model": "chart", "facts": ["決定你 80 歲的記憶力"]}, {"slug": "aging-quantified-bryan-johnson-blueprint", "name": "睡前心率", "model": "watch", "facts": ["睡滿 8 小時還是累"]}, {"slug": "mynd360-sleep-brain-shutdown", "name": "MYND360", "model": "house", "facts": ["睡前 1 小時", "3 個成分"]}]},
  {"id": "metab", "name": "代謝粒線體", "q": 1, "r": -3, "tier": 2, "landmark": "mito", "color": "#c7d36f", "pattern": "speckle", "tree": "palm", "carry": "dna", "role": "researcher", "summary": "疲倦的源頭常在細胞裡。粒線體效率和荷爾蒙，決定你一天能撐多久。", "items": [{"slug": "mitochondria-energy-after-40", "name": "發電廠壞了", "model": "battery", "facts": ["40 歲睡 8 小時還是空"]}, {"slug": "igf1-mitochondria-dna-longevity", "name": "IGF-1 與粒線體", "model": "dna"}, {"slug": "visceral-fat-three-cycles", "name": "荷爾蒙陷阱", "model": "chart", "facts": ["3 大荷爾蒙陷阱"]}, {"slug": "visceral-fat-polyphenol-mechanism", "name": "腰部脂肪多酚", "model": "farm", "facts": ["3 種多酚"]}, {"slug": "ageloc-meta-clinical-protocol", "name": "ageLOC Meta", "model": "lab", "facts": ["3 條代謝路徑"]}, {"slug": "nuskin-coq10-bioavailability", "name": "CoQ10 劑型", "model": "kiosk"}]},
  {"id": "glp1", "name": "GLP-1", "q": 0, "r": -2, "tier": 2, "landmark": "pen", "color": "#8fc1a9", "pattern": "brick", "tree": "fruit", "carry": "tube", "role": "traveler", "summary": "瘦瘦針不只讓人變瘦。它和老化基因、個人體質之間的關係，正在被重新理解。", "items": [{"slug": "glp1-aging-gene-expression", "name": "老化基因表現", "model": "lab"}, {"slug": "glp1-gene-aging-reversal", "name": "器官一起變年輕", "model": "globe"}, {"slug": "glp1-genetics-response-variation", "name": "基因決定反應", "model": "chart"}, {"slug": "glp1-clinical-guide-tirzepatide", "name": "打針前須知", "model": "clinic"}]},
  {"id": "wear", "name": "穿戴裝置", "q": -3, "r": 1, "tier": 3, "landmark": "bigwatch", "color": "#58a6a6", "pattern": "stripe", "tree": "round", "carry": "watch", "role": "commuter", "summary": "三維數據之二。手錶與手環記下的，是壓力負荷與恢復品質。", "items": [{"slug": "hrv-recovery-guide", "name": "HRV 修好了嗎", "model": "watch"}, {"slug": "wearable-choose-guide", "name": "穿戴怎麼選", "model": "kiosk", "facts": ["2 種排名"]}, {"slug": "apple-watch-sleep-vs-root-cause", "name": "手錶與睡眠", "model": "bed"}]},
  {"id": "prysm", "name": "Prysm iO", "q": -3, "r": 2, "tier": 3, "landmark": "prysm", "color": "#9cc27a", "pattern": "speckle", "tree": "cherry", "carry": "scan", "role": "researcher", "summary": "三維數據之三。光學掃描皮膚類胡蘿蔔素，補上血液看不到的面向。", "items": [{"slug": "prysm-io-15sec", "name": "15 秒抗氧化水位", "model": "scanner", "facts": ["15 秒看見抗氧化水位"]}, {"slug": "prysm-io-score-guide", "name": "分數全解析", "model": "chart", "facts": ["6 色分數"]}, {"slug": "carotenoid-rrs-science", "name": "從抽血到掃描", "model": "lab", "facts": ["15 秒掃描", "20 年才解決"]}, {"slug": "antioxidant-scanner-comparison", "name": "三機大對決", "model": "watch", "facts": ["3 台機器比較"]}, {"slug": "carotenoid-cell-absorption", "name": "蔬菜吃夠嗎", "model": "farm"}]},
  {"id": "longevity", "name": "長壽科學", "q": -1, "r": -1, "tier": 2, "landmark": "hourglass", "color": "#f0c3a0", "pattern": "stripe", "tree": "willow", "carry": "seed", "role": "nutrition", "summary": "從熱量限制到抗老藥物，長壽研究很真實，也有很多需要先搞懂的事。", "items": [{"slug": "caloric-restriction-longevity-science", "name": "熱量限制科學", "model": "book", "facts": ["從 1930 年代到今天"]}, {"slug": "caloric-restriction-mimetics-science", "name": "熱量限制模擬物", "model": "farm"}, {"slug": "longevity-drugs-science", "name": "抗老藥物", "model": "tube", "facts": ["3 類藥物"]}, {"slug": "nmn-anti-aging-review", "name": "NMN", "model": "lab"}, {"slug": "fasting-mimicking-diet-5days", "name": "每月 5 天斷食", "model": "clock", "facts": ["每月 5 天"]}, {"slug": "longevity-55-percent-genetics", "name": "壽命一半靠基因", "model": "dna", "facts": ["2026《科學》研究"]}, {"slug": "emperor-longevity-modern-science", "name": "秦始皇的長生", "model": "stage", "facts": ["2,000 多年前"]}]},
  {"id": "epi", "name": "生理年齡", "q": -3, "r": 3, "tier": 3, "landmark": "helix", "color": "#d9b26a", "pattern": "brick", "tree": "fruit", "carry": "dna", "role": "student", "summary": "生理年齡會動。老化時鐘讓「變老」第一次可以被量、被比較。", "items": [{"slug": "epigenetic-dysregulation-2026-nature-review", "name": "細胞忘了自己", "model": "hall"}, {"slug": "telomere-aging-clock", "name": "端粒計時器", "model": "clock"}, {"slug": "biological-age-measurement", "name": "你的身體幾歲", "model": "chart", "facts": ["2026 版"]}, {"slug": "aging-speed-measurement-methods", "name": "測老化速度", "model": "tube", "facts": ["3 種方法"]}, {"slug": "multivitamin-lifepak-slow-aging-clock", "name": "維生素與時鐘", "model": "kiosk", "facts": ["2026 哈佛研究"]}, {"slug": "healthspan-vs-lifespan", "name": "健康餘命", "model": "house", "facts": ["活到 85 歲", "20 年在診所"]}, {"slug": "demon-slayer-aging-blood", "name": "鬼滅與老血", "model": "book"}]},
  {"id": "supp", "name": "保健品識讀", "q": -3, "r": 4, "tier": 3, "landmark": "bottle", "color": "#e38fb0", "pattern": "speckle", "tree": "round", "carry": "book", "role": "nutrition", "summary": "有感沒感、認證真假、話術套路。選保健品之前，先學會看懂它。", "items": [{"slug": "supplement-one-thing-to-check", "name": "只看一件事", "model": "house", "facts": ["只看 1 件事"]}, {"slug": "supplement-bioavailability-gap", "name": "有感沒感", "model": "chart"}, {"slug": "sgs-report-vs-efficacy", "name": "SGS 報告", "model": "book", "facts": ["2 件事"]}, {"slug": "fda-certification-myth", "name": "FDA 認證", "model": "clinic"}, {"slug": "supplement-myths-debunked", "name": "以形補形", "model": "kiosk"}, {"slug": "supplement-marketing-tactics", "name": "保健品話術", "model": "stage"}, {"slug": "supplement-import-guide", "name": "出國帶保健品", "model": "globe"}]},
  {"id": "act", "name": "評估與介入", "q": -3, "r": 5, "tier": 4, "landmark": "clipboard", "color": "#6f7fb5", "pattern": "brick", "tree": "palm", "carry": "report", "role": "coach", "summary": "三份數據匯流的地方。先做評估，再由數據決定從哪一件事開始調整。", "items": [{"page": {"id": "page-assessment", "title": "還沒有健檢數據？先做 1 分鐘身體警報評估", "url": "/assessment", "tier": 4}, "name": "1 分鐘身體警報評估", "model": "clinic", "facts": ["約 1 分鐘完成"]}, {"page": {"id": "page-prescan", "title": "有健檢數據，直接填資料表，三份數據交叉比對", "url": "/prescan", "tier": 4}, "name": "帶健檢數據來", "model": "house", "facts": ["3 份數據交叉比對", "90 天生活調整建議"]}, {"slug": "ageloc-youthspan-longevity-genes", "name": "ageLOC Youthspan", "model": "dna"}, {"slug": "lifepak-foundation-nutrition", "name": "LifePak 打地基", "model": "farm"}, {"slug": "biological-age-gap-youthspan", "name": "40 看起來 35", "model": "clock", "facts": ["40 歲看起來 35 或 50"]}, {"slug": "nuskin-pharmaceutical-standard", "name": "製藥標準", "model": "lab"}]}
];

// 不放文章的陸地格：西部平原與中央山脈
export const LAND = [
  {"q": 4, "r": -5, "kind": "plain"},
  {"q": 3, "r": -4, "kind": "plain"},
  {"q": 2, "r": -3, "kind": "plain"},
  {"q": 1, "r": -2, "kind": "plain"},
  {"q": 0, "r": -1, "kind": "plain"},
  {"q": -1, "r": 0, "kind": "plain"},
  {"q": -2, "r": 1, "kind": "plain"},
  {"q": -2, "r": 2, "kind": "plain"},
  {"q": -2, "r": 3, "kind": "plain"},
  {"q": 3, "r": -3, "h": 1.25, "name": "雪山", "snow": true},
  {"q": 4, "r": -3, "h": 0.8},
  {"q": 2, "r": -2, "h": 1},
  {"q": 3, "r": -2, "h": 0.75},
  {"q": 1, "r": -1, "h": 1.15, "name": "中央山脈"},
  {"q": 2, "r": -1, "h": 0.85},
  {"q": 0, "r": 0, "h": 1.75, "name": "玉山", "snow": true},
  {"q": 1, "r": 0, "h": 0.85},
  {"q": -1, "r": 1, "h": 1.2},
  {"q": 0, "r": 1, "h": 1},
  {"q": 1, "r": 1, "h": 0.7},
  {"q": -1, "r": 2, "h": 1.05},
  {"q": 0, "r": 2, "h": 0.75},
  {"q": -1, "r": 3, "h": 0.9},
  {"q": -2, "r": 4, "h": 0.65}
];

// 一天中各時段亮起的文章（slug）
export const DAY_CYCLE = [
  {"from": 0, "to": 300, "name": "深夜修復", "items": ["sleep-glymphatic-brain-detox", "telomere-aging-clock", "cell-reserve-chronic-depletion"]},
  {"from": 300, "to": 540, "name": "清晨起床", "items": ["hrv-recovery-guide", "aging-quantified-bryan-johnson-blueprint", "sleep-duration-biological-aging"]},
  {"from": 540, "to": 720, "name": "上午工作", "items": ["normal-checkup-still-tired", "checkup-five-numbers", "supplement-one-thing-to-check"]},
  {"from": 720, "to": 900, "name": "午後腦霧", "items": ["mitochondria-energy-after-40", "male-fatigue-after-40", "three-signs-chronic-inflammation"]},
  {"from": 900, "to": 1080, "name": "下午撐住", "items": ["stress-mitochondria-bdnf-depression", "prysm-io-15sec", "page-assessment"]},
  {"from": 1080, "to": 1260, "name": "傍晚運動", "items": ["polyphenol-nrf2-antioxidant-myth", "visceral-fat-three-cycles", "fasting-mimicking-diet-5days"]},
  {"from": 1260, "to": 1440, "name": "夜晚放鬆", "items": ["478-breathing-sleep-vagus-nerve", "mynd360-sleep-brain-shutdown", "hypertension-glymphatic-dementia"]}
];

// 同一對島之間至少幾條內文連結，才畫成流動線
export const FLOW_MIN = 2;

// 新文章自動上島時，依分類使用的預設建物模型
export const DEFAULT_MODEL: Record<number, string> = { 1: 'house', 2: 'book', 3: 'chart', 4: 'lab' };
