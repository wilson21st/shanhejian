// Generator for data/realms.json (581–763). Run: cd tools/realms-gen && npm i && node gen.mjs (needs polygon-clipping).
// Layers: {realm,status,of,from,to,geom,prio,label,fuzz,overlay,clip}. For every elementary interval, non-overlay layers
// are cut by higher-priority non-overlay layers; overlay layers are cut only by higher-priority overlays (the map
// draws overlays on top with destination-out, so the base stays whole). Consecutive intervals with identical
// geometry merge into one piece.
import pc from 'polygon-clipping';
import { writeFileSync, readFileSync } from 'node:fs';

const R = r => [r.concat([r[0]])];                    // ring -> Polygon
const U = (...g) => pc.union(...g);
const I = (a, b) => pc.intersection(a, b);
const D = (a, ...b) => pc.difference(a, ...b);
const BOX = R([[72, 18], [142, 18], [142, 52], [72, 52]]);
const lonLT = x => R([[50, 0], [x, 0], [x, 60], [50, 60]]);
const lonGT = x => R([[x, 0], [160, 0], [160, 60], [x, 60]]);

// ───────── geography (lon, lat) ─────────
const T_CORE = R([[93.2,40.6],[95.8,40.9],[97.5,40.5],[99.5,40.0],[100.8,39.6],[102.5,39.2],[103.6,39.0],[104.5,39.4],[105.8,39.8],[106.6,40.4],[107.5,41.0],[108.5,41.2],[110.0,41.0],[111.3,40.8],[112.5,40.7],[113.8,41.0],[114.8,41.2],[116.0,41.4],[117.5,41.5],[119.3,42.0],[120.6,42.4],[121.8,42.4],[122.7,41.9],[122.4,41.3],[122.1,40.8],[121.7,40.6],[121.1,40.0],[120.8,38.6],[121.6,38.2],[123.0,37.6],[123.0,36.8],[121.4,35.2],[121.0,34.0],[121.8,32.8],[122.5,31.5],[122.6,30.0],[122.0,28.5],[121.0,27.0],[120.3,26.0],[119.7,25.0],[118.9,24.0],[117.6,23.0],[116.2,22.3],[114.3,21.8],[113.0,21.2],[111.6,20.3],[111.6,18.0],[105.6,18.0],[104.8,18.8],[104.2,19.6],[103.9,20.6],[103.6,21.6],[103.9,22.6],[103.0,22.6],[102.3,23.3],[101.9,24.4],[101.6,25.6],[101.6,26.6],[101.4,27.6],[101.9,28.6],[102.3,29.4],[102.4,30.3],[102.7,31.0],[102.9,31.8],[103.3,32.6],[103.5,33.6],[102.8,34.3],[102.2,34.9],[101.6,35.6],[101.1,36.0],[100.8,36.6],[101.2,37.3],[100.0,38.3],[98.8,38.8],[97.4,39.2],[95.6,39.4],[94.0,39.5],[93.2,39.8]]);

// south: 陈 / 后梁 / 交州 / 爨
const CHEN = I(R([[112.0,30.1],[112.9,29.85],[113.3,29.6],[114.0,30.2],[114.4,30.55],[115.2,30.0],[116.0,29.8],[117.0,30.55],[117.8,31.05],[118.5,31.5],[118.8,32.1],[119.4,32.25],[120.3,32.0],[121.0,31.9],[125,31.6],[125,18],[107.3,18],[107.9,21.6],[107.2,22.6],[107.0,23.5],[108.3,24.6],[109.0,25.6],[109.3,26.6],[109.5,27.8],[110.4,28.8],[111.3,29.6]]), T_CORE);
const HOULIANG = R([[111.2,30.6],[111.6,31.2],[112.4,31.3],[112.9,30.6],[112.9,29.95],[112.0,30.1],[111.4,30.2]]);
const JIAOZHI = I(R([[107.9,21.6],[107.3,18.0],[103,18],[103,23.2],[105,23.2],[106.6,22.9],[107.2,22.6]]), T_CORE);
const YUNNAN_E = R([[101.6,26.6],[101.6,25.6],[101.9,24.4],[102.3,23.3],[103.0,22.6],[103.9,22.6],[104.4,23.2],[104.8,24.4],[104.7,25.8],[104.2,26.8],[103.2,27.3],[102.2,27.1]]);
const LIUZHAO = R([[99.0,24.6],[100.4,24.2],[101.6,24.6],[101.6,26.6],[101.0,27.5],[99.8,27.6],[99.2,26.6],[98.9,25.6]]);
const NANZHAO_738 = R([[97.8,24.8],[98.4,23.6],[99.6,22.6],[100.8,22.8],[101.6,23.6],[101.9,24.4],[101.6,25.6],[101.6,26.6],[101.0,27.5],[99.8,27.6],[99.0,27.0],[98.4,26.0]]);
const NANZHAO_748 = U(NANZHAO_738, YUNNAN_E);
const NANZHAO_752 = U(NANZHAO_748, R([[97.8,24.8],[98.0,23.2],[99.0,21.6],[100.8,21.4],[101.8,22.2],[103.0,22.6],[102.3,23.3],[101.6,24.0],[99.6,24.0]]));
const XIZHOU = R([[101.4,27.6],[101.9,28.6],[102.4,28.9],[103.0,28.2],[102.8,27.2],[102.2,27.1],[101.6,26.6]]);
const NANZHAO_757 = U(NANZHAO_752, XIZHOU);

// west & plateau
const TUYUHUN = R([[89.0,37.6],[90.5,38.6],[92.5,39.4],[94.5,39.5],[97,39.2],[100,38.4],[101.5,37.5],[102.2,36.5],[102.6,35.6],[103.0,34.5],[102.5,33.5],[100.5,33.3],[98.5,33.5],[95.5,34.2],[92.5,35.3],[90,36.2],[88.6,36.8]]);
const SQ = R([[84.0,37.3],[84.5,38.8],[87.0,39.8],[89.5,40.2],[91.5,39.8],[91.0,38.6],[88.0,37.2],[85.5,36.8]]); // 鄯善·且末
const TUY_E = I(TUYUHUN, lonGT(97)), TUY_W = I(TUYUHUN, lonLT(97));
const XIYU = R([[73.5,36.8],[73.8,39.6],[75.5,40.6],[78.0,41.5],[80.5,42.0],[83.0,42.4],[85.5,42.6],[87.5,42.8],[88.5,42.3],[91.0,41.6],[92.6,41.4],[93.0,40.6],[92.6,39.6],[89.5,38.6],[88.0,37.5],[85.0,36.6],[81.0,36.4],[78.0,36.6],[76.0,36.4],[74.5,36.4]]);
const TIBET = R([[74.5,34.5],[75.0,36.8],[80,36.6],[88,37.6],[93,36.5],[98,35.0],[101,34.6],[103.6,33.5],[103.4,32.4],[102.6,30.8],[102.4,28.6],[101.6,27.4],[100.3,27.6],[98.6,27.6],[97.0,28.2],[95.0,28.3],[93.0,27.9],[91.0,27.8],[89.0,27.3],[88.0,27.6],[86.0,27.9],[84.0,28.4],[82.0,29.6],[80.5,30.0],[78.5,31.0],[77.5,32.5],[76.0,33.5]]);
const ZZ = I(TIBET, lonLT(86));
const SUBI = I(TIBET, R([[86,31.3],[86,40],[96.5,40],[96.5,31.3]]));
const YARLUNG = I(TIBET, R([[86,25],[86,31.3],[95.5,31.3],[95.5,25]]));
const DANGXIANG = R([[99.5,33.0],[100.4,34.4],[101.6,34.9],[102.6,34.6],[103.3,33.6],[103.0,32.4],[101.4,31.7],[99.8,32.0]]);
const GAOCHANG = R([[87.6,42.6],[90.2,43.4],[92.6,42.2],[92.4,41.2],[89.6,41.4],[87.8,41.8]]);
const YIZHOU = R([[92.6,42.2],[95.6,42.4],[96.4,41.2],[94,40.5],[92.4,41.2]]);
const TINGZHOU = R([[87.6,43.6],[88.4,44.6],[90.8,44.4],[91.0,43.4],[89.2,43.2]]);
const TAOMIN = R([[101.2,34.6],[103.4,34.2],[104.2,35.6],[102.8,36.8],[101.2,36.4]]);

// steppe
const TUJUE_E = R([[92.5,47],[94.5,43.5],[95.5,41.5],[94.5,40.0],[100,39.3],[106,39.6],[110,40.5],[116,41.2],[118,41.6],[121.5,44.5],[120.5,47.5],[119,50],[116,52],[93.5,52]]);
const TUJUE_W = R([[72,38.0],[72,52],[93.5,52],[92.5,47],[94.5,43.5],[95.5,41.5],[94.5,40.0],[90,38],[80,36.5],[74,36.5]]);
const GOBI_S = R([[85,30],[85,44.2],[92,44.2],[96,43.5],[105,44.5],[115,45],[125,44.5],[125,30]]);
const MONAN = I(TUJUE_E, GOBI_S), MOBEI = D(TUJUE_E, GOBI_S);
const W_WEST = I(TUJUE_W, lonLT(85)), W_EAST = D(TUJUE_W, lonLT(85));
const KHITAN = R([[116.4,42.0],[117.5,41.5],[119.3,42.0],[120.6,42.4],[121.8,42.4],[122.7,41.9],[123.2,42.8],[123.6,43.6],[123.0,45.0],[121.5,45.4],[119.6,45.0],[117.8,44.0],[116.6,43.0]]);
const YINGZHOU = R([[119.4,41.0],[121.3,41.0],[121.8,42.4],[120.6,42.4],[119.3,42.0]]);
const SHIWEI = R([[116,52],[119,50],[120.5,47.5],[121.5,44.5],[123.0,45.0],[123.5,47.0],[125.0,49.5],[126.5,52]]);
const MOHE = R([[123.0,45.0],[124.6,44.3],[125.8,45.0],[127.2,44.8],[128.5,44.0],[129.8,43.2],[130.6,42.3],[131.5,41.5],[133,42],[136,43.5],[139.5,47.5],[141.6,52],[126.5,52],[125.0,49.5],[123.5,47.0]]);

// Korea, Bohai, Japan
const GOGURYEO = R([[122.1,40.8],[122.4,41.3],[122.7,41.9],[123.2,42.8],[123.8,43.6],[124.6,44.3],[125.8,45.0],[127.2,44.8],[128.5,44.0],[129.8,43.2],[130.6,42.3],[131.5,41.5],[129.6,39.4],[128.9,38.4],[128.3,38.3],[127.5,38.0],[126.9,37.9],[126.5,37.75],[125.5,37.4],[124.0,37.6],[121.6,38.0],[120.6,38.6],[121.0,40.2]]);
const SILLA = R([[126.0,37.6],[126.5,37.75],[126.9,37.9],[127.5,38.0],[128.3,38.3],[128.9,38.4],[129.8,38.4],[129.8,35.4],[129.2,34.9],[128.0,34.4],[127.9,34.8],[127.7,35.4],[127.8,36.0],[127.6,36.5],[127.3,36.9],[126.8,37.0],[126.0,37.2]]);
const BAEKJE = R([[126.8,37.0],[127.3,36.9],[127.6,36.5],[127.8,36.0],[127.7,35.4],[127.9,34.8],[128.0,34.4],[127.2,33.0],[125.9,33.0],[125.2,34.2],[125.0,35.5],[125.3,36.8],[126.0,37.2]]);
const TAEDONG_S = R([[124.0,37.6],[125.5,37.4],[126.0,37.6],[126.5,37.75],[126.9,37.9],[127.5,38.0],[128.3,38.3],[128.9,38.4],[129.8,38.4],[129.0,39.3],[128.5,39.3],[127.4,39.2],[126.6,39.1],[125.8,38.95],[125.0,38.7],[124.2,38.6]]);
const KOG_SOUTH = R([[124.0,37.6],[124.2,39.6],[125.5,39.8],[126.8,39.9],[128.2,40.1],[129.6,39.4],[129.8,38.4],[128.9,38.4],[128.3,38.3],[127.5,38.0],[126.9,37.9],[126.5,37.75],[126.0,37.6],[125.5,37.4]]);
const SILLA_676 = U(SILLA, BAEKJE, TAEDONG_S);
const BOHAI_698 = R([[126.5,42.0],[127.0,44.0],[128.5,45.0],[130.5,44.6],[131.2,43.0],[130.6,42.3],[129.5,41.6],[128.0,41.6]]);
const BOHAI_719 = R([[125.8,40.8],[124.8,42.5],[125.4,44.2],[126.6,45.6],[128.5,46.8],[131.0,47.0],[133.5,45.5],[135.0,43.6],[132.5,42.6],[130.6,42.3],[129.6,41.0],[128.4,39.9],[127.5,39.4],[126.8,40.4]]);
const JAPAN_TAIL = [[141.6,36.0],[140.6,34.6],[138.6,34.0],[136.0,33.0],[133.5,32.4],[132.0,31.2],[131.2,30.6],[130.0,30.6],[129.2,32.0],[128.6,33.0]];
const JAPAN_A = R([[128.9,34.8],[130.2,35.0],[133.0,36.0],[136.5,37.8],[139.4,38.4],[140.6,37.9],[141.8,37.9], ...JAPAN_TAIL]);
const JAPAN_B = R([[128.9,34.8],[130.2,35.0],[133.0,36.0],[136.5,37.8],[139.4,39.0],[139.8,40.0],[140.6,39.6],[141.3,38.6],[141.9,38.4], ...JAPAN_TAIL]);

// civil war 617–624
const LI_617A = R([[111.0,36.8],[111.4,38.6],[113.2,38.5],[113.7,37.2],[112.8,36.2],[111.4,36.0]]);
const LI_617B = R([[110.0,34.6],[109.5,35.4],[110.6,37.4],[111.2,38.6],[113.2,38.5],[113.8,37.2],[113.2,35.5],[112.0,35.0],[110.6,34.6]]);
const LI_618 = R([[106.2,32.6],[106.6,34.4],[107.0,35.6],[108.0,36.3],[109.5,36.6],[110.6,37.4],[111.2,38.6],[113.2,38.5],[113.8,37.2],[113.2,35.5],[112.0,35.0],[110.8,34.3],[110.6,33.0],[109.6,32.4],[107.0,32.4]]);
const SHANXI_N = R([[111.0,38.6],[111.3,40.4],[112.5,40.7],[114.2,40.6],[114.2,39.0],[113.2,38.5]]);
const SHANXI_NC = R([[110.6,36.0],[110.6,37.4],[111.0,38.6],[111.3,40.4],[112.5,40.7],[114.2,40.6],[114.2,39.0],[113.8,37.2],[113.2,35.8],[111.6,35.6]]);
const LONGXI = R([[102.8,36.4],[103.6,37.0],[104.8,36.8],[105.8,36.2],[106.6,35.4],[106.4,34.4],[105.2,34.0],[103.6,34.2],[102.6,35.0]]);
const HEXI_LG = I(R([[92,42],[104.6,42],[104.6,37.4],[103.6,37.0],[102.8,36.4],[101.6,36.0],[100.5,36.2],[92,36]]), T_CORE);
const HEBEI_C = R([[114.4,36.4],[114.2,38.0],[115.4,39.0],[117.2,38.8],[117.8,38.0],[116.8,37.0],[115.8,36.3]]);
const HEBEI_ALL = R([[113.6,35.3],[113.8,37.3],[114.3,38.8],[115.2,39.4],[116.6,39.3],[117.6,39.3],[118.8,38.6],[118.5,37.6],[117.4,36.8],[116.4,36.0],[115.2,35.4],[114.4,35.1]]);
const HENAN_E = R([[113.2,34.3],[113.6,35.4],[114.4,35.6],[115.4,35.4],[116.2,34.6],[117.0,34.3],[116.6,33.3],[115.0,33.4],[113.6,33.6]]);
const SHANDONG = I(R([[115.4,35.4],[116.4,36.0],[117.4,36.8],[118.5,37.6],[119.5,37.5],[121.0,37.8],[123.0,37.4],[121.4,35.2],[119.4,34.6],[118.2,34.3],[117.0,34.3],[116.2,34.6]]), T_CORE);
const LUOYANG = R([[110.6,34.0],[110.6,34.8],[111.3,34.95],[112.6,35.1],[113.6,35.4],[113.2,34.3],[113.6,33.6],[113.0,33.3],[111.8,33.4]]);
const XIAO = I(R([[109.6,31.2],[111.3,31.4],[112.8,31.3],[114.0,30.8],[114.6,30.3],[116.0,29.8],[114.5,28.0],[113.8,26.5],[113.6,24.8],[113.6,21.8],[112.5,18],[103,18],[103.6,22.8],[104.6,23.0],[106.2,23.6],[107.0,24.8],[108.6,26.0],[109.0,28.0],[109.6,29.8]]), T_CORE);
const LIN = I(R([[116.0,29.8],[117.5,29.6],[118.2,28.4],[117.6,27.0],[116.6,25.6],[116.6,24.6],[117.4,23.6],[117.6,23.0],[113.6,21.8],[113.6,24.8],[113.8,26.5],[114.5,28.0]]), T_CORE);
const DU_617 = R([[115.6,31.2],[116.0,32.6],[117.5,33.2],[118.8,32.8],[119.0,32.2],[118.6,31.4],[117.8,31.05],[117.0,30.55],[116.2,30.3]]);
const JIANGDU = R([[118.9,32.0],[118.9,33.2],[120.8,33.4],[121.0,31.9],[119.4,32.25]]);
const JIANGDONG = I(R([[118.6,31.4],[119.0,32.2],[118.9,33.2],[120.8,33.4],[122.5,32.0],[122.6,27.5],[120.6,25.4],[118.6,23.4],[117.6,23.0],[117.4,23.6],[116.6,24.6],[116.6,25.6],[117.6,27.0],[118.2,28.4],[117.5,29.6],[117.0,30.55],[117.8,31.05]]), T_CORE);
const SONG = I(R([[117.0,30.55],[117.8,31.05],[118.6,31.4],[118.8,32.1],[119.4,32.25],[121.0,31.9],[122.5,31.6],[122.6,27.5],[120.6,26.5],[119.0,27.0],[118.2,28.4],[117.5,29.6]]), T_CORE);
const YUYANG = R([[117.0,39.7],[117.2,40.9],[118.8,41.2],[119.6,40.2],[118.8,39.4]]);
const LIANG_SD = R([[107.2,37.5],[110.4,37.3],[111,39],[109.8,40.3],[107.6,39.9],[106.8,38.6]]);

// 安史之乱 755–763 and 吐蕃 763
const HEBEI_YAN = I(R([[113.4,35.0],[113.7,36.5],[113.8,37.6],[113.5,38.6],[112.6,39.3],[112.2,40.8],[115.0,41.6],[117.5,41.6],[119.3,42.0],[121.0,42.4],[121.8,42.4],[122.7,41.9],[122.4,41.3],[122.1,40.8],[121.0,40.0],[119.0,39.0],[118.6,38.0],[117.8,37.4],[116.6,36.2],[115.6,35.6],[114.8,35.2]]), T_CORE);
const HEBEI_CONT = R([[113.7,36.6],[113.8,38.4],[115.4,39.0],[117.8,38.4],[117.6,37.2],[116.4,36.3],[114.8,36.4]]);
const HENAN_YAN = R([[110.5,34.3],[110.5,34.9],[111.3,34.95],[112.6,35.1],[113.4,35.0],[114.8,35.2],[115.6,35.6],[115.6,34.9],[115.1,34.3],[114.0,33.6],[112.6,33.4],[111.3,33.7]]);
const HENAN_CONT = U(R([[115.6,35.6],[116.6,36.2],[117.4,35.3],[117.3,33.9],[116.0,33.2],[114.6,33.2],[114.0,33.6],[115.1,34.3],[115.6,34.9]]), R([[111.3,33.7],[112.6,33.4],[113.2,32.6],[112.4,32.0],[111.2,32.6]]));
const GUANZHONG = R([[107.4,34.0],[107.6,34.9],[108.6,35.2],[109.6,35.4],[110.5,34.9],[110.5,34.3],[110.0,33.8],[108.4,33.7]]);
const YE = R([[113.4,35.0],[113.7,36.6],[114.8,37.0],[115.6,36.4],[115.6,35.6],[114.8,35.2]]);
const HENAN_YAN2 = R([[111.6,33.9],[111.6,34.8],[112.6,35.1],[113.4,35.0],[114.8,35.2],[115.6,35.6],[116.2,34.6],[115.4,33.6],[113.6,33.4],[112.4,33.4]]);
const LONGYOU = I(R([[100.5,37.6],[102.6,37.1],[103.6,36.9],[104.6,36.6],[105.6,35.6],[106.3,34.8],[106.0,33.6],[104.6,33.0],[103.6,33.2],[102.2,34.2],[100.6,35.4]]), T_CORE);
const HEXI = I(T_CORE, R([[92,36],[104.4,36],[104.4,42],[92,42]]));
const HEHUANG = R([[100.6,37.4],[102.2,36.9],[103.2,35.7],[102.8,34.6],[101.6,35.2],[100.6,35.8]]);

// ───────── layers ─────────
const L = [];
const add = (realm, status, from, to, geom, o = {}) => L.push({ realm, status, from, to, geom, ...o });
const S = '581-01-01', E = '764-01-01';
const SUI0 = '581-03-04', CHEN_END = '589-02-10';

// China proper (base, non-overlay, prio 80)
add('zhou', 'core', S, SUI0, T_CORE, { prio: 80, fuzz: 2, label: ['北　周', 109.5, 35.6] });
add('sui', 'core', SUI0, CHEN_END, T_CORE, { prio: 80, fuzz: 2, label: ['大　隋', 109.5, 35.6] });
add('sui', 'core', CHEN_END, '617-03-01', T_CORE, { prio: 80, fuzz: 2, label: ['大　隋', 112, 31] });
add('sui', 'core', '617-03-01', '617-12-01', T_CORE, { prio: 80, fuzz: 2, label: ['隋', 109.2, 33.6] });
add('sui', 'core', '617-12-01', '618-06-18', T_CORE, { prio: 80, fuzz: 2, label: ['隋', 112.6, 32.4] });
add('tang', 'core', '618-06-18', '621-11-01', T_CORE, { prio: 80, fuzz: 2, label: ['大　唐', 107.6, 31.6] });
add('tang', 'core', '621-11-01', '624-04-01', T_CORE, { prio: 80, fuzz: 2, label: ['大　唐', 111, 31.2] });
add('tang', 'core', '624-04-01', E, T_CORE, { prio: 80, fuzz: 2, label: ['大　唐', 112, 31] });

// southern dynasties, 交州, 爨 (overlays on the base)
add('chen', 'core', S, CHEN_END, CHEN, { prio: 85, fuzz: 3, overlay: 1, label: ['陈', 114.5, 26.5] });
add('houliang', 'vassal', S, SUI0, HOULIANG, { of: 'zhou', prio: 86, fuzz: 2, overlay: 1, label: ['后梁（西梁）', 112.0, 30.7] });
add('houliang', 'vassal', SUI0, '587-09-01', HOULIANG, { of: 'sui', prio: 86, fuzz: 2, overlay: 1, label: ['后梁（西梁） · 附隋', 112.0, 30.7] });
add('jiaozhi', 'vassal', S, CHEN_END, JIAOZHI, { of: 'chen', prio: 86, fuzz: 5, overlay: 1, label: ['交州 · 李佛子', 105.6, 21.0] });
add('jiaozhi', 'vassal', CHEN_END, '602-06-01', JIAOZHI, { of: 'sui', prio: 86, fuzz: 5, overlay: 1, label: ['交州 · 李佛子附隋', 105.6, 21.0] });
add('zhou', 'jimi', S, SUI0, YUNNAN_E, { prio: 85, fuzz: 6, overlay: 1, label: ['南宁 · 爨氏', 103.2, 25.2] });
add('sui', 'jimi', SUI0, '618-06-18', YUNNAN_E, { prio: 85, fuzz: 6, overlay: 1, label: ['南宁州 · 爨氏羁縻', 103.2, 25.2] });
add('tang', 'jimi', '618-06-18', '748-01-01', YUNNAN_E, { prio: 85, fuzz: 6, overlay: 1, label: ['南宁 · 爨氏羁縻', 103.2, 25.2] });

// 隋 609 west
add('sui', 'core', '609-07-01', '617-01-01', TUY_E, { prio: 62, fuzz: 4, label: ['西海郡', 99.6, 36.4] });
add('tuyuhun', 'core', '609-07-01', '617-01-01', TUY_W, { prio: 62, fuzz: 8, label: ['吐谷浑', 93.5, 37.0] });
add('sui', 'jimi', '609-07-01', '617-01-01', SQ, { prio: 65, fuzz: 6, label: ['鄯善 · 且末郡', 86.8, 38.6] });
add('sui', 'core', '610-01-01', '617-01-01', YIZHOU, { prio: 100, fuzz: 3, overlay: 1, label: ['伊吾郡', 94.4, 41.8] });

// civil war 617–624 (overlays)
const cw = (realm, status, from, to, geom, label, o = {}) => add(realm, status, from, to, I(geom, T_CORE), { prio: 90, fuzz: 5, overlay: 1, label, ...o });
cw('tang', 'core', '617-07-15', '617-10-01', LI_617A, ['李渊 · 太原起兵', 112.3, 37.4], { fuzz: 3 });
cw('tang', 'core', '617-10-01', '617-12-01', LI_617B, ['李渊 · 渡河', 111.6, 36.6], { fuzz: 3 });
cw('tang', 'core', '617-12-01', '618-06-18', LI_618, ['唐王李渊（奉恭帝）', 109.0, 35.4], { fuzz: 3 });
cw('dingyang', 'vassal', '617-03-01', '619-06-01', SHANXI_N, ['刘武周 · 附突厥', 112.6, 39.7], { of: 'tujue_e', prio: 91 });
cw('dingyang', 'vassal', '619-06-01', '620-05-01', SHANXI_NC, ['刘武周 · 陷太原', 112.3, 38.2], { of: 'tujue_e', prio: 91 });
cw('liang', 'vassal', '617-03-01', '628-05-01', LIANG_SD, ['梁师都', 108.9, 38.6], { of: 'tujue_e', prio: 92, fuzz: 2 });
cw('qin', 'core', '617-05-01', '618-12-01', LONGXI, ['薛举 · 秦', 104.6, 35.4], { prio: 91 });
cw('liang_l', 'core', '617-08-01', '619-06-01', HEXI_LG, ['李轨 · 凉', 100.5, 38.9], { prio: 89 });
cw('xia', 'core', '617-02-01', '619-03-01', HEBEI_C, ['窦建德 · 夏', 116.0, 37.8]);
cw('xia', 'core', '619-03-01', '621-06-01', HEBEI_ALL, ['窦建德 · 夏', 116.0, 37.6], { prio: 91 });
cw('heita', 'contested', '621-08-01', '623-02-01', HEBEI_ALL, ['刘黑闼 · 河北反复', 116.0, 37.6], { of: ['tang', 'heita'], prio: 91 });
cw('wei', 'core', '617-02-01', '617-07-01', HENAN_E, ['李密 · 瓦岗', 114.8, 34.6]);
cw('wei', 'core', '617-07-01', '618-11-01', U(HENAN_E, SHANDONG), ['李密 · 瓦岗', 114.8, 34.6]);
cw('xu', 'core', '618-11-01', '623-03-01', SHANDONG, ['徐圆朗 · 山东', 118.0, 36.0]);
cw('sui', 'core', '618-06-18', '618-11-01', LUOYANG, ['隋 · 皇泰主（洛阳）', 112.0, 34.3], { prio: 92 });
cw('sui', 'core', '618-11-01', '619-05-01', U(LUOYANG, HENAN_E), ['隋 · 皇泰主（王世充）', 112.6, 34.3], { prio: 92 });
cw('zheng', 'core', '619-05-01', '621-06-01', U(LUOYANG, HENAN_E), ['王世充 · 郑', 112.6, 34.3], { prio: 90 });
cw('xiao', 'core', '617-11-01', '621-11-01', XIAO, ['萧铣 · 梁', 111.5, 27.0]);
cw('lin', 'core', '617-01-01', '622-11-01', LIN, ['林士弘 · 楚', 115.6, 26.8]);
cw('du', 'core', '617-01-01', '619-10-01', DU_617, ['杜伏威 · 江淮', 117.4, 32.0]);
cw('du', 'vassal', '619-10-01', '621-11-01', DU_617, ['杜伏威 · 附唐', 117.4, 32.0], { of: 'tang' });
cw('sui', 'core', '617-03-01', '618-04-11', JIANGDU, ['江都 · 炀帝', 119.8, 32.8], { prio: 95, fuzz: 3 });
cw('jiangdong', 'core', '617-12-01', '621-11-01', JIANGDONG, ['沈法兴 · 李子通', 119.8, 29.0]);
cw('du', 'vassal', '621-11-01', '623-09-01', U(DU_617, JIANGDONG), ['杜伏威 · 附唐', 118.6, 30.6], { of: 'tang' });
cw('song', 'core', '623-09-01', '624-04-01', SONG, ['辅公祏 · 宋', 119.8, 29.6]);
cw('gao', 'vassal', '618-03-01', '624-03-01', YUYANG, ['高开道 · 附突厥', 118.2, 40.4], { of: 'tujue_e', prio: 92 });
cw('tang', 'contested', '619-01-01', '635-06-01', TAOMIN, ['洮岷 · 唐与吐谷浑相争', 102.6, 35.4], { of: ['tang', 'tuyuhun'], prio: 88 });

// 安史之乱
const AN = '755-12-16', LUO_FALL = '756-01-18', CHA_FALL = '756-07-20', CHA_BACK = '757-11-13', LUO_BACK = '757-12-03';
cw('yan', 'core', AN, '757-01-29', HEBEI_YAN, ['大燕 · 安禄山', 116.4, 39.2], { fuzz: 4 });
cw('yan', 'core', '757-01-29', LUO_BACK, HEBEI_YAN, ['燕 · 安庆绪', 116.4, 39.2], { fuzz: 4 });
cw('tang', 'contested', LUO_FALL, '756-07-15', HEBEI_CONT, ['河北 · 颜真卿与郭李', 115.6, 37.6], { of: ['tang', 'yan'], prio: 93 });
cw('yan', 'core', LUO_FALL, LUO_BACK, HENAN_YAN, ['燕 · 陷洛阳', 112.6, 34.4], { fuzz: 4 });
cw('tang', 'contested', LUO_FALL, LUO_BACK, HENAN_CONT, ['睢阳 · 南阳 · 唐军坚守', 116.2, 34.0], { of: ['tang', 'yan'], prio: 93 });
cw('yan', 'core', CHA_FALL, CHA_BACK, GUANZHONG, ['燕 · 陷长安', 108.8, 34.6], { fuzz: 4 });
cw('yan', 'core', LUO_BACK, '759-04-18', YE, ['燕 · 安庆绪（邺）', 114.5, 36.1], { fuzz: 4, prio: 93 });
cw('yan', 'vassal', LUO_BACK, '758-07-01', HEBEI_YAN, ['史思明 · 范阳（名义降唐）', 116.4, 39.2], { of: 'tang' });
cw('yan', 'core', '758-07-01', '761-04-18', HEBEI_YAN, ['燕 · 史思明', 116.4, 39.2], { fuzz: 4 });
cw('yan', 'core', '761-04-18', '763-02-17', HEBEI_YAN, ['燕 · 史朝义', 116.4, 39.2], { fuzz: 4 });
cw('yan', 'core', '759-10-15', '762-11-20', HENAN_YAN2, ['燕 · 复陷洛阳', 113.2, 34.4], { fuzz: 4 });
cw('fanzhen', 'vassal', '763-02-17', E, HEBEI_YAN, ['河朔三镇 · 名义归唐', 116.4, 39.2], { of: 'tang' });
cw('tang', 'contested', '757-01-01', '763-08-01', HEHUANG, ['河湟 · 吐蕃蚕食', 101.8, 36.0], { of: ['tang', 'tubo'], prio: 91 });
cw('tubo', 'core', '763-08-01', E, LONGYOU, ['陇右 · 陷吐蕃', 103.8, 35.4], { prio: 92, fuzz: 5 });
cw('tang', 'contested', '763-08-01', E, HEXI, ['河西 · 孤悬', 99.0, 39.4], { of: ['tang', 'tubo'], prio: 91, fuzz: 6 });
cw('tang', 'contested', '763-11-18', '763-12-03', GUANZHONG, ['长安 · 吐蕃入寇', 108.8, 34.6], { of: ['tang', 'tubo'], prio: 94 });
cw('tang', 'contested', '696-06-01', '717-01-01', YINGZHOU, ['营州 · 契丹之乱', 120.5, 41.6], { of: ['tang', 'khitan'], prio: 93 });

// 南诏 taking Tang land (overlay, above the base)
add('nanzhao', 'vassal', '748-01-01', '750-12-01', NANZHAO_748, { of: 'tang', prio: 88, fuzz: 4, overlay: 1, label: ['南诏 · 并二爨', 101.0, 25.0] });
add('nanzhao', 'core', '750-12-01', '752-01-01', NANZHAO_748, { prio: 88, fuzz: 4, overlay: 1, label: ['南　诏', 101.0, 25.0] });
add('nanzhao', 'vassal', '752-01-01', '757-01-01', NANZHAO_752, { of: 'tubo', prio: 88, fuzz: 4, overlay: 1, label: ['南诏 · 附吐蕃', 101.0, 25.0] });
add('nanzhao', 'vassal', '757-01-01', E, NANZHAO_757, { of: 'tubo', prio: 88, fuzz: 4, overlay: 1, label: ['南诏 · 附吐蕃', 101.0, 25.0] });
add('nanzhao', 'core', S, '664-01-01', LIUZHAO, { prio: 60, fuzz: 6, label: ['六　诏', 100.3, 25.8] });
add('nanzhao', 'jimi', '664-01-01', '680-01-01', LIUZHAO, { of: 'tang', prio: 60, fuzz: 6, label: ['六诏 · 姚州羁縻', 100.3, 25.8] });
add('nanzhao', 'contested', '680-01-01', '738-01-01', LIUZHAO, { of: ['tang', 'tubo'], prio: 60, fuzz: 6, label: ['六诏 · 依违唐蕃', 100.3, 25.8] });
add('nanzhao', 'vassal', '738-01-01', '748-01-01', NANZHAO_738, { of: 'tang', prio: 60, fuzz: 5, label: ['南诏 · 附唐', 100.2, 25.2] });

// 西域 oases and Tang towns in the west
add('gaochang', 'vassal', S, '583-06-01', GAOCHANG, { of: 'tujue', prio: 100, fuzz: 2, overlay: 1, label: ['高昌', 89.6, 42.6] });
add('gaochang', 'vassal', '583-06-01', '640-09-01', GAOCHANG, { of: 'tujue_w', prio: 100, fuzz: 2, overlay: 1, label: ['高昌', 89.6, 42.6] });
add('tang', 'core', '640-09-01', E, GAOCHANG, { prio: 100, fuzz: 2, overlay: 1, label: ['西州', 89.6, 42.6] });
add('tang', 'core', '630-10-01', E, YIZHOU, { prio: 100, fuzz: 2, overlay: 1, label: ['伊州', 94.4, 41.8] });
add('tang', 'core', '640-09-01', '702-01-01', TINGZHOU, { prio: 100, fuzz: 3, overlay: 1, label: ['庭州', 89.2, 43.9] });
add('tang', 'core', '702-01-01', E, TINGZHOU, { prio: 100, fuzz: 3, overlay: 1, label: ['北庭', 89.2, 43.9] });
const XY = [80.5, 39.6];
add('xiyu', 'vassal', S, '583-06-01', XIYU, { of: 'tujue', prio: 55, fuzz: 6, label: ['西域诸国 · 附突厥', ...XY] });
add('xiyu', 'vassal', '583-06-01', '648-12-01', XIYU, { of: 'tujue_w', prio: 55, fuzz: 6, label: ['西域诸国 · 附西突厥', ...XY] });
add('tang', 'jimi', '648-12-01', '651-07-01', XIYU, { prio: 55, fuzz: 6, label: ['安西四镇 · 唐羁縻', ...XY] });
add('xiyu', 'contested', '651-07-01', '658-03-01', XIYU, { of: ['tang', 'tujue_w'], prio: 55, fuzz: 6, label: ['西域 · 阿史那贺鲁之乱', ...XY] });
add('tang', 'jimi', '658-03-01', '670-05-01', XIYU, { prio: 55, fuzz: 6, label: ['安西四镇 · 唐羁縻', ...XY] });
add('xiyu', 'contested', '670-05-01', '692-11-01', XIYU, { of: ['tang', 'tubo'], prio: 55, fuzz: 6, label: ['安西四镇 · 唐蕃相争', ...XY] });
add('tang', 'jimi', '692-11-01', E, XIYU, { prio: 55, fuzz: 6, label: ['安西四镇 · 唐羁縻', ...XY] });

// 吐谷浑, 党项, the plateau
add('tuyuhun', 'core', S, '609-07-01', U(TUYUHUN, SQ), { prio: 60, fuzz: 5, label: ['吐谷浑', 97, 36.6] });
add('tuyuhun', 'core', '617-01-01', '635-06-01', TUYUHUN, { prio: 60, fuzz: 5, label: ['吐谷浑', 97, 36.6] });
add('tuyuhun', 'vassal', '635-06-01', '663-06-01', TUYUHUN, { of: 'tang', prio: 60, fuzz: 5, label: ['吐谷浑 · 附唐', 97, 36.6] });
add('tubo', 'core', '663-06-01', E, TUYUHUN, { prio: 60, fuzz: 6, label: ['青　海', 97, 36.6] });
add('dangxiang', 'core', S, '631-01-01', DANGXIANG, { prio: 61, fuzz: 6, label: ['党项', 101.2, 33.4] });
add('dangxiang', 'jimi', '631-01-01', '670-08-01', DANGXIANG, { of: 'tang', prio: 61, fuzz: 6, label: ['党项 · 唐羁縻州', 101.2, 33.4] });
add('zhangzhung', 'core', S, '634-01-01', ZZ, { prio: 53, fuzz: 8, label: ['羊　同', 79.6, 33.6] });
add('zhangzhung', 'vassal', '634-01-01', '644-01-01', ZZ, { of: 'tubo', prio: 53, fuzz: 8, label: ['羊同 · 附吐蕃', 81.0, 32.6] });
add('subi', 'core', S, '608-01-01', SUBI, { prio: 52, fuzz: 8, label: ['苏毗', 90.5, 33.6] });
add('tubo', 'core', S, '608-01-01', YARLUNG, { prio: 51, fuzz: 7, label: ['悉补野', 91.0, 29.6], lp: 79 });
add('tubo', 'core', '608-01-01', '638-01-01', U(YARLUNG, SUBI), { prio: 51, fuzz: 7, label: ['吐　蕃', 91.0, 30.4], lp: 79 });
add('qiang', 'core', S, '638-01-01', TIBET, { prio: 50, fuzz: 8, label: ['诸　羌', 98.8, 30.2] });
add('tubo', 'core', '638-01-01', E, TIBET, { prio: 50, fuzz: 7, label: ['吐　蕃', 88, 31.5], lp: 79 });

// steppe
add('tujue', 'core', S, '583-06-01', U(TUJUE_E, TUJUE_W), { prio: 40, fuzz: 8, label: ['突　厥', 100, 46.5] });
add('tujue_e', 'core', '583-06-01', '599-11-01', TUJUE_E, { prio: 40, fuzz: 7, label: ['东突厥', 109, 45.5] });
add('tujue_e', 'vassal', '599-11-01', '615-09-01', TUJUE_E, { of: 'sui', prio: 40, fuzz: 7, label: ['东突厥 · 启民附隋', 109, 45.5] });
add('tujue_e', 'core', '615-09-01', '628-01-01', TUJUE_E, { prio: 40, fuzz: 7, label: ['东突厥', 109, 45.5] });
add('tujue_e', 'core', '628-01-01', '630-04-01', MONAN, { prio: 40, fuzz: 7, label: ['东突厥', 110, 42.6] });
add('xueyantuo', 'core', '628-01-01', '646-07-01', MOBEI, { prio: 40, fuzz: 8, label: ['薛延陀', 106, 47.5] });
add('tang', 'jimi', '630-04-01', '682-01-01', MONAN, { prio: 40, fuzz: 7, label: ['漠南 · 唐羁縻（单于）', 110, 42.6] });
add('tang', 'jimi', '646-07-01', '687-01-01', MOBEI, { prio: 40, fuzz: 8, label: ['漠北 · 安北都护府羁縻', 106, 47.5] });
add('houtujue', 'core', '682-01-01', '687-01-01', MONAN, { prio: 40, fuzz: 7, label: ['后突厥', 110, 42.6] });
add('houtujue', 'core', '687-01-01', '744-09-01', TUJUE_E, { prio: 40, fuzz: 7, label: ['后突厥', 107, 46] });
add('huihe', 'core', '744-09-01', E, TUJUE_E, { prio: 40, fuzz: 7, label: ['回　纥', 104, 47] });
add('tujue_w', 'core', '583-06-01', '657-12-01', TUJUE_W, { prio: 40, fuzz: 8, label: ['西突厥', 80, 46] });
add('tang', 'jimi', '657-12-01', '699-01-01', TUJUE_W, { prio: 40, fuzz: 8, label: ['濛池 · 昆陵 · 唐羁縻', 82, 46] });
add('tuqishi', 'core', '699-01-01', '739-01-01', W_WEST, { prio: 40, fuzz: 8, label: ['突骑施', 77.5, 45] });
add('tuqishi', 'contested', '739-01-01', E, W_WEST, { of: ['tang', 'tuqishi'], prio: 40, fuzz: 8, label: ['七河 · 突骑施内乱', 77.5, 45] });
add('tang', 'jimi', '699-01-01', '702-01-01', W_EAST, { prio: 40, fuzz: 8, label: ['西突厥故地 · 唐羁縻', 88, 47.5] });
add('tang', 'jimi', '702-01-01', E, W_EAST, { prio: 40, fuzz: 8, label: ['北庭都护府 · 羁縻', 88, 47.5] });
add('shiwei', 'core', S, E, SHIWEI, { prio: 38, fuzz: 9, label: ['室韦', 122, 48.5] });
add('mohe', 'core', S, E, MOHE, { prio: 39, fuzz: 9, label: ['靺鞨', 131, 47.5] });

// 契丹·奚
const KL = [119.8, 43.4];
add('khitan', 'contested', S, '583-06-01', KHITAN, { of: ['tujue', 'goguryeo'], prio: 69, fuzz: 6, label: ['契丹·奚 · 附突厥', ...KL] });
add('khitan', 'contested', '583-06-01', '628-01-01', KHITAN, { of: ['tujue_e', 'goguryeo'], prio: 69, fuzz: 6, label: ['契丹·奚 · 附突厥', ...KL] });
add('khitan', 'contested', '628-01-01', '648-12-01', KHITAN, { of: ['tang', 'goguryeo'], prio: 69, fuzz: 6, label: ['契丹·奚 · 附唐', ...KL] });
add('khitan', 'jimi', '648-12-01', '696-06-01', KHITAN, { of: 'tang', prio: 69, fuzz: 6, label: ['松漠 · 饶乐都督府', ...KL] });
add('khitan', 'vassal', '696-06-01', '716-01-01', KHITAN, { of: 'houtujue', prio: 69, fuzz: 6, label: ['契丹·奚 · 附后突厥', ...KL] });
add('khitan', 'jimi', '716-01-01', '730-06-01', KHITAN, { of: 'tang', prio: 69, fuzz: 6, label: ['松漠 · 饶乐都督府', ...KL] });
add('khitan', 'contested', '730-06-01', '735-01-01', KHITAN, { of: ['tang', 'houtujue'], prio: 69, fuzz: 6, label: ['契丹·奚 · 可突于之乱', ...KL] });
add('khitan', 'jimi', '735-01-01', '745-06-01', KHITAN, { of: 'tang', prio: 69, fuzz: 6, label: ['松漠 · 饶乐都督府', ...KL] });
add('khitan', 'core', '745-06-01', E, KHITAN, { prio: 69, fuzz: 6, label: ['契丹·奚', ...KL] });

// Korea, 渤海, Japan
add('goguryeo', 'core', S, '668-10-01', GOGURYEO, { prio: 70, fuzz: 3, label: ['高句丽', 126, 41.6] });
add('silla', 'core', S, '676-12-01', SILLA, { prio: 71, fuzz: 2, label: ['新罗', 128.6, 36.6] });
add('baekje', 'core', S, '660-08-01', BAEKJE, { prio: 71, fuzz: 2, label: ['百济', 126.8, 36.0] });
add('baekje', 'contested', '660-08-01', '663-10-01', BAEKJE, { of: ['tang', 'baekje'], prio: 71, fuzz: 3, label: ['百济故地 · 复国军', 126.8, 36.0] });
add('tang', 'jimi', '663-10-01', '670-08-01', BAEKJE, { prio: 71, fuzz: 3, label: ['熊津都督府', 126.8, 36.0] });
add('silla', 'contested', '670-08-01', '676-12-01', BAEKJE, { of: ['tang', 'silla'], prio: 71, fuzz: 3, label: ['百济故地 · 罗唐战争', 126.8, 36.0] });
add('tang', 'jimi', '668-10-01', '676-03-01', GOGURYEO, { prio: 70, fuzz: 4, label: ['安东都护府（平壤）', 125.6, 41.0] });
add('tang', 'jimi', '676-03-01', '714-01-01', GOGURYEO, { prio: 70, fuzz: 6, label: ['安东都护府（辽东）', 123.6, 41.6] });
add('tang', 'jimi', '714-01-01', '761-01-01', GOGURYEO, { prio: 70, fuzz: 7, label: ['安东 · 羁縻名存', 123.6, 41.6] });
add('silla', 'contested', '670-08-01', '676-12-01', KOG_SOUTH, { of: ['tang', 'silla'], prio: 71, fuzz: 4, label: ['高句丽故地 · 复国与罗唐战争', 126.6, 38.9] });
add('silla', 'core', '676-12-01', E, SILLA_676, { prio: 71, fuzz: 3, label: ['新　罗', 128.0, 36.4] });
add('bohai', 'core', '698-07-01', '713-01-01', BOHAI_698, { prio: 72, fuzz: 5, label: ['震　国', 128.8, 43.4] });
add('bohai', 'core', '713-01-01', '719-01-01', BOHAI_698, { prio: 72, fuzz: 5, label: ['渤海', 128.8, 43.4] });
add('bohai', 'core', '719-01-01', E, BOHAI_719, { prio: 72, fuzz: 5, label: ['渤　海', 129.0, 43.8] });
add('wa', 'core', S, '701-01-01', JAPAN_A, { prio: 75, fuzz: 3, label: ['倭', 134.5, 34.6] });
add('wa', 'core', '701-01-01', '724-01-01', JAPAN_A, { prio: 75, fuzz: 3, label: ['日本', 134.5, 34.6] });
add('wa', 'core', '724-01-01', E, JAPAN_B, { prio: 75, fuzz: 3, label: ['日本', 134.5, 34.6] });

const realms = {
  zhou: ['北周', '#8f5f5f'], sui: ['隋', '#c0662e'], chen: ['陈', '#3f8a6e'], houliang: ['后梁（西梁）', '#8a7a4a'], jiaozhi: ['交州李氏', '#6a8a5a'],
  tang: ['大唐', '#b23a2c'], tujue: ['突厥', '#45708c'], tujue_e: ['东突厥', '#3d6b8a'], tujue_w: ['西突厥', '#6a5a8c'], xueyantuo: ['薛延陀', '#3f7d8c'],
  houtujue: ['后突厥', '#2f5f80'], huihe: ['回纥', '#4f7f5a'], tuqishi: ['突骑施', '#7a5a9a'],
  tuyuhun: ['吐谷浑', '#8a6f2a'], tubo: ['吐蕃', '#7a4a68'], subi: ['苏毗', '#8a5a80'], zhangzhung: ['羊同（象雄）', '#5a4a7a'], qiang: ['诸羌', '#7a7a5a'], dangxiang: ['党项', '#9a7a4a'],
  gaochang: ['高昌', '#9a5a3a'], xiyu: ['西域诸国', '#a08a5a'], nanzhao: ['南诏（六诏）', '#8a4a3a'],
  liang: ['梁师都', '#5d6b7a'], goguryeo: ['高句丽', '#2f7a6a'], silla: ['新罗', '#a06a2a'], baekje: ['百济', '#7a8a3a'], khitan: ['契丹·奚', '#6f7f4a'],
  bohai: ['渤海', '#2f6a8a'], mohe: ['靺鞨', '#4a6a5a'], shiwei: ['室韦', '#5a7a6a'], wa: ['倭 · 日本', '#a04a6a'],
  dingyang: ['刘武周', '#4a5a6a'], qin: ['薛举（秦）', '#8a6a5a'], liang_l: ['李轨（凉）', '#7a6a3a'], xia: ['窦建德（夏）', '#5a7a3a'], wei: ['李密（瓦岗）', '#9a7a2a'],
  zheng: ['王世充（郑）', '#6a4a3a'], xiao: ['萧铣（梁）', '#2f7a7a'], lin: ['林士弘（楚）', '#7a8a2a'], du: ['杜伏威', '#5a6aa0'], jiangdong: ['沈法兴·李子通', '#4a8a8a'],
  heita: ['刘黑闼', '#6a6a3a'], song: ['辅公祏（宋）', '#5a4a8a'], xu: ['徐圆朗', '#8a7a6a'], gao: ['高开道', '#6a7a8a'],
  yan: ['燕（安史）', '#3e3e6e'], fanzhen: ['河朔藩镇', '#8a5a5a'],
};

// ───────── compute ─────────
const dn = d => d.split('-').map(Number).reduce((a, v, i) => a + v * [1e4, 100, 1][i], 0);
const dates = [...new Set(L.flatMap(l => [l.from, l.to]))].sort((a, b) => dn(a) - dn(b));
const area = r => { let s = 0; for (let i = 0; i < r.length; i++) { const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length]; s += x1 * y2 - x2 * y1 } return s / 2 };
const round = r => { const o = []; for (const [x, y] of r) { const p = [Math.round(x * 10) / 10, Math.round(y * 10) / 10]; const q = o[o.length - 1]; if (!q || q[0] !== p[0] || q[1] !== p[1]) o.push(p) } const f = o[0], l = o[o.length - 1]; if (o.length > 1 && f[0] === l[0] && f[1] === l[1]) o.pop(); return o };
const warn = [];
function rings(mp, tag) { // MultiPolygon -> outer rings (rounded, big enough), largest first
  const out = [];
  for (const poly of mp) {
    const r = round(poly[0]); if (r.length < 3 || Math.abs(area(r)) < 0.3) continue;
    for (const h of poly.slice(1)) if (Math.abs(area(h)) > 0.3) warn.push(`hole ${tag} ${Math.abs(area(h)).toFixed(1)}`);
    out.push(r);
  }
  return out.sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)));
}
for (const l of L) { l.g = I(l.clip ? I(l.geom, l.clip) : l.geom, BOX); l.runs = [] }
for (let k = 0; k < dates.length - 1; k++) {
  const d = dates[k], n = dn(d), nx = dates[k + 1];
  const act = L.filter(l => dn(l.from) <= n && n < dn(l.to)).sort((a, b) => b.prio - a.prio);
  for (const ov of [false, true]) {
    let cov = null;
    for (const l of act.filter(l => !!l.overlay === ov)) {
      let g = cov ? D(l.g, cov) : l.g;
      cov = cov ? U(cov, l.g) : l.g;
      const rs = rings(g, `${l.realm} ${d}`), key = JSON.stringify(rs), last = l.runs[l.runs.length - 1];
      if (last && last.key === key && last.to === d) last.to = nx; else l.runs.push({ from: d, to: nx, key, rs });
    }
  }
}
function inside([x, y], r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c } return c }
function pole(r) { // grid search for the interior point farthest from the edge
  const xs = r.map(p => p[0]), ys = r.map(p => p[1]); let best = null, bd = -1;
  const segd = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy) };
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += .2) for (let y = Math.min(...ys); y <= Math.max(...ys); y += .2) {
    const p = [x, y]; if (!inside(p, r)) continue; let m = 1e9; for (let i = 0; i < r.length; i++) m = Math.min(m, segd(p, r[i], r[(i + 1) % r.length])); if (m > bd) { bd = m; best = p }
  }
  return best && best.map(v => Math.round(v * 10) / 10);
}
const pieces = [];
// non-overlays first, most important label first (the map hides colliding labels in file order); overlays bottom-up
const ord = l => l.overlay ? 1000 + l.prio : -(l.lp ?? l.prio);
for (const l of [...L].sort((a, b) => ord(a) - ord(b) || dn(a.from) - dn(b.from))) for (const run of l.runs) {
  if (!run.rs.length) continue;
  let li = run.rs.findIndex(r => inside(l.label.slice(1), r)), lab = l.label;
  if (li < 0) { li = 0; const p = pole(run.rs[0]); lab = [l.label[0], ...p]; warn.push(`label moved ${l.label[0]} ${run.from} -> ${p}`) }
  run.rs.forEach((r, i) => {
    const p = { realm: l.realm, from: run.from };
    if (run.to !== E) p.to = run.to;
    p.status = l.status; if (l.of) p.of = l.of; p.fuzz = l.fuzz; if (l.overlay) p.overlay = true;
    if (i === li) p.label = lab;
    p.poly = r; pieces.push(p);
  });
}
const out = {
  note: '疆域 581–763 (隋 to the end of 安史之乱), approximate and hand-drawn in lon/lat for orientation, not surveyed boundaries; shapes follow the standard atlases (谭其骧《中国历史地图集》 隋/唐 sheets) only loosely. Each piece is valid for dates from <= d < to (YYYY-MM-DD; to omitted = still standing). status: core = direct rule, vassal = 附庸 (hatched in the patron\'s colour), jimi = 羁縻 (hatched), contested = 争议地带 (two-colour stripes). fuzz = how uncertain the edge is, in map cells (bigger = softer). overlay pieces are painted over the realm beneath (enclaves, rebels, 安史 燕) rather than cut out of it. Generated by a script from layered regions; neighbouring pieces share edges.',
  realms: Object.fromEntries(Object.entries(realms).map(([k, [name, color]]) => [k, { name, color }])),
  pieces,
};
// compact JSON: one piece per line
const js = '{\n "note": ' + JSON.stringify(out.note) + ',\n "realms": {\n' + Object.entries(out.realms).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n },\n "pieces": [\n' + pieces.map(p => '  ' + JSON.stringify(p)).join(',\n') + '\n ]\n}\n';
writeFileSync(process.argv[2] || '/tmp/realms-gen/realms.json', js);
console.log(pieces.length, 'pieces', js.length, 'bytes', pieces.filter(p => p.label).length, 'labels');
for (const w of warn) console.log('WARN', w);
const used = new Set(pieces.flatMap(p => [p.realm, ...[].concat(p.of || [])])); for (const k in realms) if (!used.has(k)) console.log('unused realm', k);
for (const k of used) if (!realms[k]) console.log('MISSING realm', k);
