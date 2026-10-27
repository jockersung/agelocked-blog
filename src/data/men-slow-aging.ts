// 「男性慢老」專區（/men）的主題設定。
// 文章標題、摘要、網址與「第幾步」都在 build 時從文章本身讀取，這裡只放：主題分類、引言、IG 式提問。
//
// 規則：
// - 這一頁只放知識型文章。內文提到產品（R2、ageLOC、LifePak…）的文章不放進來，
//   避免同一頁同時出現性健康與產品，被整體解讀成產品效果（食品廣告認定準則第 3 條）。
// - 性健康主題的結論永遠是：記錄、生活調整、必要時就醫，而不是產品。
export type Pillar = {
  id: string;
  name: string;
  hook: string;      // 讀者心裡的那句話
  concern: string;   // 他在意的變化
  intro: string;
  slugs: string[];
  doctorNote?: string;
  upcoming?: string[]; // 規劃中的題目（只當作預告，不是承諾日期）
};

// 順序 = 健康島「男性慢老」導覽路線的站序：身材 → 臉蛋 → 性健康 → 禿頭、白髮 → 心血管 → 健檢站
export const MEN_PILLARS: Pillar[] = [
  {
    id: 'body',
    name: '身材',
    hook: '體重差不多，為什麼以前的衣服穿起來不同了？',
    concern: '腰圍、肚子、肌肉與穿衣感',
    intro: '體重沒變，腰圍卻變了，通常代表脂肪的位置和肌肉量在改變。從腰圍、荷爾蒙到粒線體，看懂中年體態為什麼變。',
    slugs: ['visceral-fat-metabolic-signal', 'visceral-fat-three-cycles', 'mitochondria-energy-after-40', 'glp1-aging-gene-expression', 'glp1-clinical-guide-tirzepatide'],
  },
  {
    id: 'face',
    name: '臉蛋',
    hook: '明明有睡，照片裡的自己為什麼總顯得累？',
    concern: '疲態、膚況、日常整理',
    intro: '別人第一眼看到的年紀，大多來自臉。疲態、膚色和膚況，跟睡眠、壓力與日曬都有關係。',
    slugs: ['aging-quantified-bryan-johnson-blueprint'],
    upcoming: ['男人的皮膚，老得比你想的早：日曬是第一名', '洗臉、保濕、防曬：男人保養的基本三件事', '為什麼睡不好，會直接寫在臉上？'],
  },
  {
    id: 'sexual-health',
    name: '性健康',
    hook: '以前不必想的反應，現在開始讓你在意了嗎？',
    concern: '晨勃、硬度、性慾、親密自信',
    intro: '晨勃變少、硬度不同、中途變軟，很多男人只會偷偷擔心。先分清楚是累、沒慾望，還是勃起本身有變化，再決定下一步。',
    slugs: ['male-fatigue-after-40', 'sleep-quality-testosterone'],
    doctorNote: '勃起變化反覆發生、或已經造成困擾，請帶著紀錄和泌尿科醫師討論。勃起問題有時是血管健康的早期提醒，值得認真看待。',
    upcoming: ['晨勃少了，代表什麼、不代表什麼？', '性慾、勃起、維持：三件常被混在一起的事', '看泌尿科前，可以先整理哪些紀錄？'],
  },
  {
    id: 'hair',
    name: '禿頭、白髮',
    hook: '最讓你有年紀感的，是白髮，還是髮量？',
    concern: '白髮、髮量、看起來顯老',
    intro: '白髮和髮際線後退，是男人最早在鏡子裡看到的變化。它們各自有不同的原因，也各自有能做和不能做的事。',
    slugs: ['white-hair-stem-cells', 'hairline-recession-warning'],
    upcoming: ['頭髮需要的營養，從餐桌開始'],
  },
  {
    id: 'heart',
    name: '心血管',
    hook: '想維持狀態，健檢報告有哪些問題值得問？',
    concern: '健檢數字、活動能力、長期健康',
    intro: '心血管和代謝決定你十年後還能不能自在地爬山、跑跳、陪家人。報告沒紅字，不代表沒有值得多看的數字。',
    slugs: ['normal-checkup-still-tired', 'checkup-five-numbers', 'lpa-genetic-risk', 'hs-crp-low-grade-inflammation', 'hypertension-glymphatic-dementia', 'apob-vs-ldl'],
    upcoming: ['爬兩層樓就喘，是年紀還是訊號？', '為什麼有些心臟科醫師自己也吃 statin？LDL 要降到多低才夠'],
  },
];
