// 健康島的導覽路線。island = 這一站在地圖上的站 id（src/data/island-map.ts），jason = 島主到站時說的話。
// 站卡的文章清單直接用地圖上那一站的文章。
// 站的標題、提問、文章清單沿用 src/data/men-slow-aging.ts 的主題（pillar），改主題內容不用改這裡。
export type RouteStation = { pillar?: string; id?: string; name?: string; island: string; jason: string };
export type Route = { id: string; name: string; intro: string; stations: RouteStation[] };

export const ROUTES: Route[] = [
  {
    id: 'men',
    name: '男性慢老',
    intro: '跟著島主 Jason 走 6 站：從你在意的變化開始，最後換成自己的數據。',
    stations: [
      { pillar: 'body', island: 'body', jason: '嗨，我是健康島島主 Jason！第一站先看最多人在意的：肚子和腰圍。' },
      { pillar: 'face', island: 'face', jason: '明明有睡，照片裡還是顯累？這一站聊男人的臉。' },
      { pillar: 'sexual-health', island: 'sexual-health', jason: '這一站比較私密，但很多人都在偷偷擔心：以前不用想的反應。' },
      { pillar: 'hair', island: 'hair', jason: '白髮和髮際線，是鏡子裡最早出現的年紀。' },
      { pillar: 'heart', island: 'heart', jason: '想把狀態維持十年以上，心血管才是真正的底盤。' },
      { id: 'check', name: '健檢站', island: 'checkup', jason: '最後一站：把你在意的變化，換成自己的數據。' },
    ],
  },
];
