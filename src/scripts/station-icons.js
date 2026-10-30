// 健康島六站名牌：主題卡通 icon（左）＋六都地標小圖（城市名旁）
// 主題 icon 32x32、地標 18x18，純 SVG，不需外部圖檔。

const s = (vb, body) => `<svg viewBox="0 0 ${vb} ${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
const INK = '#1F2A30';

// 主題 icon：圓底＋卡通圖形
export const TOPIC_ICONS = {
  // 身材：圓肚子＋腰圍皮尺
  body: s(32, `<circle cx="16" cy="16" r="15" fill="#FBE3D3"/>
    <ellipse cx="16" cy="18" rx="9" ry="8.5" fill="#F4B48C" stroke="${INK}" stroke-width="1.4"/>
    <circle cx="16" cy="19" r="1" fill="${INK}"/>
    <path d="M6.6 16.5 Q16 21 25.4 16.5" fill="none" stroke="#E0A43A" stroke-width="3" stroke-linecap="round"/>
    <g stroke="#fff" stroke-width=".9"><line x1="10" y1="17.7" x2="10" y2="19.2"/><line x1="13" y1="18.6" x2="13" y2="20"/><line x1="19" y1="18.6" x2="19" y2="20"/><line x1="22" y1="17.7" x2="22" y2="19.2"/></g>`),
  // 臉蛋：笑臉＋閃亮
  face: s(32, `<circle cx="16" cy="16" r="15" fill="#FCE4EC"/>
    <circle cx="15" cy="17" r="9" fill="#F9D5B8" stroke="${INK}" stroke-width="1.4"/>
    <path d="M7.5 14 Q10 7.5 16.5 8 Q22 8.5 23 13 Q18 10.5 12 12 Z" fill="${INK}"/>
    <circle cx="12" cy="17" r="1.1" fill="${INK}"/><circle cx="18" cy="17" r="1.1" fill="${INK}"/>
    <path d="M12.5 20.5 Q15 22.5 17.5 20.5" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>
    <circle cx="10.3" cy="19.6" r="1.3" fill="#F2A3B4" opacity=".8"/><circle cx="19.7" cy="19.6" r="1.3" fill="#F2A3B4" opacity=".8"/>
    <path d="M25.5 6 l.9 2.1 2.1.9 -2.1.9 -.9 2.1 -.9-2.1 -2.1-.9 2.1-.9z" fill="#E0A43A"/>`),
  // 性健康：兩顆心＋小閃電
  'sexual-health': s(32, `<circle cx="16" cy="16" r="15" fill="#E3EDF6"/>
    <path d="M9 12.5 C9 9 13.5 8.5 14.5 11.5 C15.5 8.5 20 9 20 12.5 C20 16.5 14.5 19 14.5 21 C14.5 19 9 16.5 9 12.5 Z" fill="#7FA6C9" stroke="${INK}" stroke-width="1.2"/>
    <path d="M14.5 16 C14.5 13 18.3 12.6 19.1 15.1 C19.9 12.6 23.7 13 23.7 16 C23.7 19.3 19.1 21.4 19.1 23 C19.1 21.4 14.5 19.3 14.5 16 Z" fill="#E0A43A" stroke="${INK}" stroke-width="1.2"/>
    <path d="M24.5 6.5 l-2.2 3.6 h2 l-1.6 3.2" fill="none" stroke="#E8613C" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`),
  // 禿頭、白髮：頭頂髮絲（黑白相間）＋梳子
  hair: s(32, `<circle cx="16" cy="16" r="15" fill="#EEE6F6"/>
    <path d="M7 22 Q7 10 16 10 Q25 10 25 22 Z" fill="#F9D5B8" stroke="${INK}" stroke-width="1.4"/>
    <path d="M10 13.5 Q11 9 13 8.5" stroke="${INK}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M14 11 Q15 7 17 7" stroke="#B9B9C3" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M18.5 11 Q19.5 7.5 21.5 8" stroke="${INK}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M21.5 13 Q23 10 24.5 10.5" stroke="#B9B9C3" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <rect x="6" y="23" width="20" height="3.2" rx="1.2" fill="#B49AD0" stroke="${INK}" stroke-width="1.1"/>
    <g stroke="${INK}" stroke-width=".9">${[9, 12, 15, 18, 21, 24].map((x) => `<line x1="${x}" y1="26.2" x2="${x}" y2="28"/>`).join('')}</g>`),
  // 心血管：紅心＋心電圖
  heart: s(32, `<circle cx="16" cy="16" r="15" fill="#FBE4E4"/>
    <path d="M6.5 13 C6.5 7.5 13.5 6.5 16 11 C18.5 6.5 25.5 7.5 25.5 13 C25.5 19.5 16 24 16 27 C16 24 6.5 19.5 6.5 13 Z" fill="#E38C8C" stroke="${INK}" stroke-width="1.4"/>
    <polyline points="8.5,15 12,15 13.5,12 15.5,19 17.5,13.5 19,15 23.5,15" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>`),
  // 健檢站：報告板＋勾勾
  checkup: s(32, `<circle cx="16" cy="16" r="15" fill="#E6E9F5"/>
    <rect x="8.5" y="7.5" width="15" height="19" rx="2.2" fill="#fff" stroke="${INK}" stroke-width="1.4"/>
    <rect x="12.5" y="5.5" width="7" height="4" rx="1.2" fill="#6F7FB5" stroke="${INK}" stroke-width="1.1"/>
    <path d="M11 14.5 l1.6 1.6 3-3" fill="none" stroke="#2E8B8B" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="17" y1="14.5" x2="21" y2="14.5" stroke="#B8C2D6" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M11 20 l1.6 1.6 3-3" fill="none" stroke="#2E8B8B" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="17" y1="20" x2="21" y2="20" stroke="#B8C2D6" stroke-width="1.4" stroke-linecap="round"/>`),
};

// 六都地標小圖
export const LANDMARK_ICONS = {
  // 台北 101：一節一節往上的塔
  body: { name: '101', svg: s(18, `<rect x="7.3" y="13" width="3.4" height="4" fill="#5F8FA8"/>
    ${[0, 1, 2, 3].map((k) => `<path d="M${6.3 + k * 0} ${12.6 - k * 2.4} h5.4 l-.7 2.2 h-4 z" fill="#7FB3C9" stroke="${INK}" stroke-width=".6"/>`).join('')}
    <rect x="8.2" y="2.4" width="1.6" height="3.2" fill="#7FB3C9" stroke="${INK}" stroke-width=".5"/><line x1="9" y1=".6" x2="9" y2="2.4" stroke="${INK}" stroke-width=".7"/>`) },
  // 新北 淡水漁人碼頭：情人橋（白色斜張橋）＋海浪
  face: { name: '淡水漁人碼頭', svg: s(18, `<path d="M1 14 Q5 9.5 9 9.5 Q13 9.5 17 14" fill="none" stroke="${INK}" stroke-width="1.1"/>
    <line x1="9" y1="3" x2="9" y2="11" stroke="${INK}" stroke-width="1.1"/>
    <g stroke="#8FB9A8" stroke-width=".6"><line x1="9" y1="4" x2="4" y2="11.2"/><line x1="9" y1="4" x2="14" y2="11.2"/><line x1="9" y1="6" x2="6" y2="10.2"/><line x1="9" y1="6" x2="12" y2="10.2"/></g>
    <path d="M1 16 q2-1.4 4 0 t4 0 t4 0 t4 0" fill="none" stroke="#5FA7C9" stroke-width="1.1" stroke-linecap="round"/>`) },
  // 桃園 大溪老街：巴洛克牌樓立面
  'sexual-health': { name: '大溪老街', svg: s(18, `<path d="M2 16 V7 Q2 4.5 4.5 4.5 Q6 2.2 9 2.2 Q12 2.2 13.5 4.5 Q16 4.5 16 7 V16 Z" fill="#E8C9A6" stroke="${INK}" stroke-width=".8"/>
    <path d="M5 16 V11 Q5 8.6 7 8.6 Q9 8.6 9 11 V16" fill="#9C6B4A"/><path d="M10.5 16 V11.5 Q10.5 9.6 12.2 9.6 Q14 9.6 14 11.5 V16" fill="#9C6B4A"/>
    <circle cx="9" cy="5" r="1" fill="#E38C8C"/>`) },
  // 台中 國家歌劇院：曲面牆上的大洞
  hair: { name: '國家歌劇院', svg: s(18, `<rect x="1.5" y="4" width="15" height="12" rx="1.5" fill="#F3F1EC" stroke="${INK}" stroke-width=".8"/>
    <path d="M3 16 V11 Q3 7 6 7 Q8.5 7 8.5 11 V16" fill="#C9D9E0" stroke="${INK}" stroke-width=".6"/>
    <path d="M9.5 16 V9.5 Q9.5 6 12.5 6 Q15 6 15 9.5 V16" fill="#C9D9E0" stroke="${INK}" stroke-width=".6"/>`) },
  // 台南 赤崁樓：紅牆燕尾屋頂
  heart: { name: '赤崁樓', svg: s(18, `<path d="M1 8.5 Q4 7.4 5 5.2 L13 5.2 Q14 7.4 17 8.5 Z" fill="#6B4A3A"/>
    <rect x="3.5" y="8.5" width="11" height="3" fill="#C8483A"/>
    <path d="M2 12 Q5 11 6 9.6 L12 9.6 Q13 11 16 12 Z" fill="#6B4A3A"/>
    <rect x="4.5" y="12" width="9" height="4" fill="#C8483A"/><rect x="7.8" y="13" width="2.4" height="3" fill="#F3D9A6"/>
    <path d="M1 8.5 l-.6-1.2 M17 8.5 l.6-1.2" stroke="#6B4A3A" stroke-width=".8"/>`) },
  // 高雄 85 大樓：兩柱往上合成一棟（高字形）
  checkup: { name: '85 大樓', svg: s(18, `<rect x="4" y="9" width="3.2" height="8" fill="#7FA6C9" stroke="${INK}" stroke-width=".6"/>
    <rect x="10.8" y="9" width="3.2" height="8" fill="#7FA6C9" stroke="${INK}" stroke-width=".6"/>
    <path d="M4 9 L7.2 9 L7.2 6.5 L10.8 6.5 L10.8 9 L14 9 L12.5 4 L5.5 4 Z" fill="#9DBCD8" stroke="${INK}" stroke-width=".6"/>
    <rect x="7.6" y="1.4" width="2.8" height="2.8" fill="#9DBCD8" stroke="${INK}" stroke-width=".6"/><line x1="9" y1="0" x2="9" y2="1.4" stroke="${INK}" stroke-width=".6"/>`) },
};

export function stationLabelHTML(s) {
  const topic = TOPIC_ICONS[s.id];
  const lm = LANDMARK_ICONS[s.id];
  const num = s.station || s.i + 1;
  const icon = topic ? `<i class="ti">${topic}<b>${num}</b></i>` : `<b>${num}</b>`;
  const city = s.city
    ? `<small>${s.city}${lm ? `<em class="lmi" title="${lm.name}">${lm.svg}</em><span class="lmn">${lm.name}</span>` : ''}</small>`
    : '';
  return `${icon}<span>${s.stationName || s.name}${city}</span>`;
}
