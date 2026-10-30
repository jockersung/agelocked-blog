// 健康島的導覽路線。island = 這一站在地圖上的站 id（src/data/island-map.ts），jason = 島主到站時說的話。
// 站卡的文章清單直接用地圖上那一站的文章。
// 站的標題、提問、文章清單沿用 src/data/men-slow-aging.ts 的主題（pillar），改主題內容不用改這裡。
export type RouteStation = { pillar?: string; id?: string; name?: string; hook?: string; island: string; jason: string; audio: string };
export type Route = { id: string; name: string; intro: string; stations: RouteStation[] };

export const ROUTES: Route[] = [
  {
    id: 'men',
    name: '男性慢老',
    intro: '跟著島主 Jason 走 6 站：從你在意的變化開始，最後換成自己的數據。',
    stations: [
      { pillar: 'body', island: 'body', jason: "嗨，我是健康島島主 Jason，我來帶你前進第一站來看身材！在意發狂的小肚肚嗎？還看不見腳趾？打球還喘吁吁，一下子就沒力？一起看看可以從哪裡開始。", audio: "/audio/island-guide/jason-station-01-body-20261027.mp3" },
      { pillar: 'face', island: 'face', jason: "我是島主 Jason，繼續往第二站來看臉蛋！明明有睡，怎麼看起來還是累？以前滿臉紅光，現在卻眼角下垂、八字深？小心一臉衰樣，漏財！一起從作息、清潔和日常保養，看看可以從哪裡開始。", audio: "/audio/island-guide/jason-station-02-face-20261027.mp3" },
      { pillar: 'sexual-health', island: 'sexual-health', jason: "我是島主 Jason，歡迎來到第三站來看性健康！人說四十歲的男人不能只剩一張嘴！白天把工作做好，晚上也能保住往日風采，看看可以從哪裡開始。", audio: "/audio/island-guide/jason-station-03-sexual-health-20261027.mp3" },
      { pillar: 'hair', island: 'hair', jason: "我是島主 Jason，第四站來看頭頂！髮際線往後退，白頭髮卻一直往前衝？先別急著叫理髮院幫你留瀏海來蓋、剪髮吹蓬鬆！或是買染髮劑染黑、弄假髮！一起看看掉髮、白髮和頭皮照顧，有哪些事值得先弄清楚。", audio: "/audio/island-guide/jason-station-04-hair-20261027.mp3" },
      { pillar: 'heart', island: 'heart', jason: "我是島主 Jason，第五站來顧底盤——心血管！身材、臉蛋想維持得久，血壓、血脂也值得你花點心思。哪怕萬一心一緊，唰起來，錢還沒花就葛屁！我的人生還沒玩夠就結束！這一站從吃什麼、怎麼動，到哪些數字該留意，一起整理清楚。", audio: "/audio/island-guide/jason-station-05-heart-20261027-v2.mp3" },
      { id: 'check', name: '健檢站', hook: '報告沒有紅字，接下來就不用管了嗎？', island: 'checkup', jason: "我是島主 Jason，我們到最後一站——健檢站！雖然報告沒有紅字，數字還沒超標，但是我離超標有多遠？把健檢數字和日常變化放在一起，才能整理出值得問醫師的問題。還沒頭緒？先做一分鐘身體警報評估吧！", audio: "/audio/island-guide/jason-station-06-checkup-20261027.mp3" },
    ],
  },
];
