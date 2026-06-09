import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import gsap from 'gsap';

type FlowState = 'home' | 'wake' | 'confirm' | 'loading' | 'result' | 'editor';

type MemoryItem = {
  id: string;
  src: string;
  title: string;
  memory?: string;
  author?: string;
  date?: string;
  tags: string[];
  mood: string;
  era: string;
  type: string;
  defaultPosition: { x: number; y: number; rotation: number };
  depth: number;
  createdAt: number;
};

type HomeLayer = 'past' | 'recent' | 'saved' | 'transition';

type PhotoNode = {
  id: string;
  kind: 'old' | 'modern' | 'fence';
  src: string;
  title: string;
  memory: string;
  author: string;
  date: string;
  drawingDataUrl?: string;
  editParams?: EditParams;
  position: { x: number; y: number; rotation: number };
  organicPosition: { x: number; y: number; rotation: number };
  width?: number;
  depth: number;
  baseOpacity: number;
  breathPhase: number;
  entryDelay: number;
  windPhase: number;
  createdAt: number;
  expiresAt: number;
  state: 'visible' | 'fading' | 'revealing';
  homeLayer: HomeLayer;
  homeZ?: number;
  isUserSaved?: boolean;
  savedRank?: number;
};

type EditParams = {
  fade: number;
  dream: number;
  worn: number;
};

type SavedMemory = {
  id: string;
  src: string;
  editedSrc?: string;
  keyword: string;
  note: string;
  signature: string;
  drawingDataUrl: string;
  editParams: EditParams;
  createdAt: number;
};

type KeywordOrigin = {
  x: number;
  y: number;
};

type KeywordLayout = {
  id: string;
  text: string;
  x: number;
  y: number;
  scale: number;
  blur: number;
  opacity: number;
  driftX: number;
  driftY: number;
  driftDuration: number;
  leaveDelay: number;
  enterDelay: number;
  state: 'entering' | 'leaving';
};

const LEGACY_STORAGE_KEY = 'memory-final-fragment';
const STORAGE_KEY = 'memory-final-fragments';
const MAX_SAVED_MEMORIES = 30;
const UI = {
  title: '/assets/backgrounds/logo.webp',
  wakeNormal: '/assets/buttons/wake_button_normal.webp',
  wakeHover: '/assets/buttons/wake_button_hover.webp',
  paper: '/assets/backgrounds/paper2.webp',
  fence: '/assets/barrier/围挡/Group 38.webp',
};
const GLOBAL_MUSIC_SRC = '/assets/audio/global-theme.mp3';
const GLOBAL_MUSIC_VOLUME = 0.35;
const DEFAULT_MODERN_IMAGES = ['/assets/new-city/25cd8e17-4eff-4db8-a83c-9e9f1a6cc820.webp', '/assets/new-city/7cfa6337-dfd2-429f-be06-ae37f2dce37f.webp'];
const HOME_MAX_PHOTO_COUNT = 18;
const DEFAULT_PHOTO_ASPECT_RATIO = 1.42;
const LOADING_TOTAL_MS = 10_000;
const LOADING_FREEFORM_MS = 8_000;
const LOADING_REVEAL_MS = 2_000;
const LOADING_COMPLETE_CROSSFADE_MS = 850;
const EDITOR_HOME_RETURN_MS = 1_180;
const MAX_CANVAS_DPR = 1.5;
const LOW_CANVAS_DPR = 1;
const RESULT_IMAGE_CANVAS_WIDTH = 480;
const LOADING_PARTICLES = {
  low: 900,
  medium: 2400,
  high: 4200,
};
const LOADING_MEMORY_TILES = [
  { x: 2, y: 5, w: 14, r: -3.1, blur: 3.4, opacity: 0.17 },
  { x: 19, y: 2, w: 10, r: 1.2, blur: 4.2, opacity: 0.13 },
  { x: 45, y: 6, w: 12, r: -1, blur: 4.8, opacity: 0.11 },
  { x: 74, y: 8, w: 13, r: 2.4, blur: 3.6, opacity: 0.15 },
  { x: 90, y: 25, w: 10, r: -1.6, blur: 5.2, opacity: 0.12 },
  { x: 5, y: 58, w: 11, r: 1.8, blur: 4.6, opacity: 0.13 },
  { x: 22, y: 76, w: 14, r: -2.4, blur: 3.9, opacity: 0.15 },
  { x: 61, y: 70, w: 15, r: 1.3, blur: 4.5, opacity: 0.12 },
  { x: 86, y: 72, w: 12, r: 2.1, blur: 3.8, opacity: 0.16 },
];
const RESULT_TEXTURE_PARTICLES = {
  low: 90,
  medium: 160,
  high: 260,
};
const CITY_UPDATE_MIN_MS = 68_000;
const CITY_UPDATE_MAX_MS = 112_000;
const HOME_INITIAL_CAMERA_DEPTH = -4200;
const HOME_CAMERA_MIN_Z = -4200;
const HOME_CAMERA_MAX_Z = 24800;
const HOME_CAMERA_EASE = 0.16;
const HOME_WHEEL_SPEED = 1.35;
const HOME_FOCAL_LENGTH = 4300;
const HOME_MIN_FOCAL_DISTANCE = 880;
const HOME_NEAR_HIDE_Z = -4050;
const HOME_CLEAR_NEAR = -3050;
const HOME_COLUMN_OFFSETS = [-0.92, -0.62, -0.34, -0.1, 0.14, 0.38, 0.66, 0.94];
const HOME_VERTICAL_OFFSETS = [-42, -18, 20, 44, -30, 8, 32, -8];
const HOME_ROW_X_OFFSETS = [0, 150, -140];
const HOME_ROW_Y_OFFSETS = [-70, 220, -230];
const HOME_TUNNEL_ORIGIN = { x: 50, y: 58 };
const WAKE_SCATTER_SLOTS = [
  { x: 8, y: 13 },
  { x: 21, y: 9 },
  { x: 39, y: 12 },
  { x: 61, y: 10 },
  { x: 79, y: 13 },
  { x: 92, y: 20 },
  { x: 6, y: 33 },
  { x: 18, y: 39 },
  { x: 33, y: 34 },
  { x: 68, y: 35 },
  { x: 83, y: 38 },
  { x: 94, y: 47 },
  { x: 9, y: 60 },
  { x: 24, y: 67 },
  { x: 38, y: 61 },
  { x: 62, y: 63 },
  { x: 76, y: 68 },
  { x: 91, y: 62 },
  { x: 13, y: 83 },
  { x: 28, y: 89 },
  { x: 45, y: 82 },
  { x: 57, y: 89 },
  { x: 72, y: 83 },
  { x: 86, y: 88 },
  { x: 50, y: 73 },
];
const HOME_NEAR_FADE_START = -3150;
const HOME_CLEAR_FAR = 1550;
const HOME_FAR_BLUR_START = 5200;
const HOME_FAR_FADE_START = 9000;
const HOME_FAR_HIDE_Z = 26000;
const HOME_MAX_PROJECT_SCALE = 5.05;
const HOME_MIN_PROJECT_SCALE = 0.055;
const SAVED_HOME_SLOTS = [
  { x: 57, y: 58, rotation: -2 },
  { x: 43, y: 57, rotation: 1.6 },
  { x: 62, y: 48, rotation: -1.4 },
  { x: 38, y: 66, rotation: -3.2 },
  { x: 66, y: 66, rotation: 2.6 },
  { x: 48, y: 72, rotation: 1.1 },
  { x: 58, y: 73, rotation: -2.5 },
  { x: 34, y: 48, rotation: 2.2 },
  { x: 70, y: 54, rotation: -2.1 },
  { x: 45, y: 42, rotation: -1.1 },
  { x: 58, y: 40, rotation: 1.4 },
  { x: 42, y: 75, rotation: 0.8 },
] as const;
const MEMORY_COPY = [
  {
    title: '房间门上的珠帘',
    memory: '记得小时候住的那套房子里，我的房间门上有一张很漂亮的门帘，特别是太阳打下来的时候，亮晶晶的。可惜搬家的时候被留在了那里。',
    author: 'by 卡其比巴卜',
    date: '2026.5.30',
  },
  {
    title: '雨后的巷子',
    memory: '雨停以后，路面会把楼房和天空一起映出来。那时候觉得这条巷子很长，后来才发现它短得像一段没有保存好的视频。',
    author: 'by 匿名上传',
    date: '2026.5.18',
  },
  {
    title: '放学路上的门',
    memory: '那扇门总是半开着，里面有一点潮湿的木头味。现在门已经拆掉，只剩下我记得它开合时很轻的声音。',
    author: 'by memory_27',
    date: '2026.5.21',
  },
  {
    title: '旧店门口',
    memory: '店招换过很多次，但门口那块地砖一直没有换。每次经过都会下意识看一眼，好像它还替我保管着某个下午。',
    author: 'by 小陈',
    date: '2026.5.24',
  },
  {
    title: '树边的长椅',
    memory: '树影落在椅背上的时候，风会从很低的地方穿过去。后来路修宽了，长椅还在记忆里慢慢褪色。',
    author: 'by 匿名上传',
    date: '2026.5.27',
  },
  {
    title: '校门口杂货铺',
    memory: '放学铃响以后，大家都会挤到那盏小灯下面买冰棍。现在店面换了颜色，但那种甜味还停在路口。',
    author: 'by 小林',
    date: '2026.5.22',
  },
];
const KEYWORDS = [
  '录像厅门口',
  '小卖部冰柜',
  '老式冰棍箱',
  '搪瓷杯里的水',
  'BP机的声音',
  '黑白电视雪花',
  '磁带倒带声',
  '铁皮文具盒',
  '塑料凉鞋',
  '红白游戏机',
  '玻璃弹珠',
  '旧书包',
  '跳房子的粉笔格',
  '楼下公用电话',
  '公交月票夹',
  '校门口杂货铺',
  '树边的长椅',
  '公园里的石凳',
  '水泥楼梯',
  '雨后的巷子',
  '雨中街灯',
  '旧铁门',
  '阳台的晾衣杆',
  '老式风扇',
  '红色脸盆',
  '墙上的涂鸦',
  '榕树下的石凳',
  '巷口修鞋摊',
  '街边肠粉店',
  '旧医院门口',
  '龙华老招牌',
  '收音机午后',
  '黄昏的窗帘',
  '门帘上的珠子',
  '放学路上的糖纸',
  '井盖上的落叶',
  '铅笔屑和作业本',
  '蓝色塑料凳',
  '楼下晾衣服',
  '厨房水槽',
  '旧城河边栏杆',
  '夜里的旧楼',
  '旧屋饭桌',
  '校园走廊',
  '黄昏操场',
  '旧教室桌椅',
  '拆迁前的空地',
];
const KEYWORD_MATCHES = normalizeKeywordMap({
  录像厅门口: 'memory-108',
  小卖部冰柜: 'memory-81',
  老式冰棍箱: 'memory-58',
  搪瓷杯里的水: 'memory-97',
  BP机的声音: 'memory-97',
  黑白电视雪花: 'memory-33',
  磁带倒带声: 'memory-97',
  铁皮文具盒: 'memory-80',
  塑料凉鞋: 'memory-98',
  红白游戏机: 'memory-108',
  玻璃弹珠: 'memory-29',
  旧书包: 'memory-79',
  跳房子的粉笔格: 'memory-30',
  楼下公用电话: 'memory-40',
  公交月票夹: 'memory-35',
  校门口杂货铺: 'memory-101',
  树边的长椅: 'memory-67',
  公园里的石凳: 'memory-91',
  水泥楼梯: 'memory-28',
  雨后的巷子: 'memory-69',
  雨中街灯: 'memory-73',
  旧铁门: 'memory-64',
  阳台的晾衣杆: 'memory-96',
  老风扇: 'memory-68',
  老式风扇: 'memory-68',
  红色脸盆: 'memory-27',
  墙上的涂鸦: 'memory-95',
  榕树下的石凳: 'memory-91',
  巷口修鞋摊: 'memory-76',
  街边肠粉店: 'memory-65',
  旧医院门口: 'memory-56',
  龙华老招牌: 'memory-50',
  收音机午后: 'memory-97',
  黄昏的窗帘: 'memory-39',
  门帘上的珠子: 'memory-85',
  放学路上的糖纸: 'memory-25',
  井盖上的落叶: 'memory-49',
  铅笔屑和作业本: 'memory-51',
  蓝色塑料凳: 'memory-66',
  楼下晾衣服: 'memory-96',
  厨房水槽: 'memory-74',
  旧城河边栏杆: 'memory-87',
  夜里的旧楼: 'memory-92',
  旧屋饭桌: 'memory-93',
  校园走廊: 'memory-99',
  黄昏操场: 'memory-100',
  旧教室桌椅: 'memory-109',
  拆迁前的空地: 'memory-111',
});
const PAPER_BACKDROP_MEMORY_IDS = new Set(['memory-58', 'memory-62', 'memory-66', 'memory-83', 'memory-84']);
const KEYWORD_ALIASES = [
  ['蓝色塑料凳', '蓝色凳子', '蓝凳子', '塑料凳子', '小板凳', '小凳子', '凳子', '板凳'],
  ['老式冰棍箱', '冰棍箱', '冰柜', '雪糕柜', '冷饮箱', '冰箱', '雪糕'],
  ['小卖部冰柜', '小卖部', '士多店', '杂货铺', '百货店', '百货', '白活', '零食店', '汽水', '冷饮'],
  ['街边肠粉店', '肠粉', '肠粉店', '早餐店', '早饭', '早餐'],
  ['校门口杂货铺', '校门口', '学校门口', '文具店', '零食铺'],
  ['旧书包文具盒', '旧书包', '书包', '文具盒', '铁皮文具盒', '铅笔盒', '红领巾'],
  ['铅笔屑和作业本', '铅笔屑', '铅笔', '作业本', '作业', '课本', '桌面'],
  ['玻璃弹珠', '弹珠', '玻璃珠', '珠子'],
  ['跳房子的粉笔格', '跳房子', '粉笔格', '粉笔', '格子'],
  ['红色脸盆', '脸盆', '红脸盆', '水盆', '盆'],
  ['塑料凉鞋', '凉鞋', '拖鞋', '塑料拖鞋', '门口鞋'],
  ['老式风扇', '风扇', '电风扇', '落地扇', '老风扇'],
  ['门帘上的珠子', '门帘', '珠帘', '珠子', '房间门帘'],
  ['搪瓷杯里的水', '搪瓷杯', '茶杯', '水杯', '杯子'],
  ['收音机午后', '收音机', '广播', '磁带', '倒带', 'bp机', 'bb机'],
  ['黑白电视雪花', '电视', '电视机', '黑白电视', '雪花屏', '蓝光'],
  ['红白游戏机', '游戏机', '红白机', '录像厅', '电脑教室', '旧电脑'],
  ['录像厅门口', '录像厅', '影碟厅', '游戏厅', '屏幕'],
  ['楼下公用电话', '公用电话', '电话亭', '电话', '楼下电话'],
  ['公交月票夹', '公交月票', '月票夹', '月票', '公交站', '站牌', '等车'],
  ['旧铁门', '铁门', '旧门', '门锁', '金属门'],
  ['水泥楼梯', '楼梯', '楼道', '扶手', '水泥梯'],
  ['阳台的晾衣杆', '阳台', '晾衣杆', '晾衣服', '晒衣服', '衣服'],
  ['楼下晾衣服', '晾衣', '晾晒', '楼下衣服'],
  ['雨后的巷子', '雨后', '巷子', '小巷', '湿地', '积水'],
  ['雨中街灯', '雨中', '雨夜', '街灯', '路灯', '夜雨'],
  ['旧城河边栏杆', '河边', '栏杆', '河岸', '水面'],
  ['墙上的涂鸦', '涂鸦', '墙画', '墙上的画', '画墙'],
  ['榕树下的石凳', '榕树', '石凳', '树下', '树荫'],
  ['公园里的石凳', '公园', '长椅', '椅子', '石椅', '休息'],
  ['树边的长椅', '树边', '长椅', '木椅', '等人'],
  ['巷口修鞋摊', '修鞋', '修鞋摊', '摊位', '巷口'],
  ['旧医院门口', '医院', '诊所', '医院门口'],
  ['龙华老招牌', '龙华', '老招牌', '旧招牌', '招牌'],
  ['井盖上的落叶', '井盖', '落叶', '雨水', '地面'],
  ['厨房水槽', '厨房', '水槽', '水龙头', '洗碗池'],
  ['夜里的旧楼', '夜里', '夜晚', '旧楼', '窗口', '灯光'],
  ['旧屋饭桌', '饭桌', '餐桌', '碗筷', '晚饭', '吃饭'],
  ['校园走廊', '校园', '走廊', '学校走廊', '教学楼'],
  ['黄昏操场', '操场', '跑道', '球场', '放学'],
  ['旧教室桌椅', '教室', '桌椅', '课桌', '黑板'],
  ['拆迁前的空地', '拆迁', '拆', '空地', '工地', '城市更新'],
] as const;
const KEYWORD_ALIAS_TERMS = buildKeywordAliasTerms(KEYWORD_ALIASES);
const KEYWORD_SLOTS = [
  { x: [7, 22], y: [24, 38], scale: [0.68, 0.84] },
  { x: [7, 24], y: [52, 66], scale: [0.68, 0.86] },
  { x: [7, 24], y: [76, 92], scale: [0.62, 0.78] },
  { x: [24, 38], y: [72, 90], scale: [0.62, 0.78] },
  { x: [39, 47], y: [75, 94], scale: [0.58, 0.72] },
  { x: [53, 61], y: [75, 94], scale: [0.58, 0.72] },
  { x: [62, 76], y: [72, 90], scale: [0.62, 0.78] },
  { x: [77, 94], y: [76, 92], scale: [0.62, 0.78] },
  { x: [78, 94], y: [52, 66], scale: [0.68, 0.86] },
  { x: [78, 93], y: [24, 38], scale: [0.68, 0.84] },
] as const;

const preload = (sources: string[]) => {
  sources.forEach((src) => {
    const image = new Image();
    image.src = src;
    void image.decode?.().catch(() => undefined);
  });
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

function performanceTier() {
  const cores = window.navigator.hardwareConcurrency || 4;
  const memory = (window.navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4;
  if (cores <= 4 || memory <= 4) return 'low' as const;
  if (cores >= 8 && memory >= 8) return 'high' as const;
  return 'medium' as const;
}

function canvasDpr() {
  return Math.min(window.devicePixelRatio || 1, performanceTier() === 'low' ? LOW_CANVAS_DPR : MAX_CANVAS_DPR);
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function rectOrigin(rect: DOMRect): KeywordOrigin {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function App() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [photos, setPhotos] = useState<PhotoNode[]>([]);
  const [modernImages, setModernImages] = useState<string[]>(DEFAULT_MODERN_IMAGES);
  const [fenceSrc, setFenceSrc] = useState(UI.fence);
  const [flow, setFlow] = useState<FlowState>('home');
  const [detailPhoto, setDetailPhoto] = useState<PhotoNode | null>(null);
  const [keyword, setKeyword] = useState('');
  const [keywordOrigin, setKeywordOrigin] = useState<KeywordOrigin | null>(null);
  const [result, setResult] = useState<MemoryItem | null>(null);
  const [savedMemories, setSavedMemories] = useState<SavedMemory[]>([]);
  const [returningHome, setReturningHome] = useState(false);
  const returnHomeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/data/memories.json')
      .then((response) => response.json() as Promise<MemoryItem[]>)
      .then((items) => {
        if (!alive) return;
        setMemories(items);
        const homePhotos = buildHomePhotoNodes(items);
        setPhotos((current) => {
          const savedPhotos = current.filter((photo) => photo.isUserSaved);
          return savedPhotos.length ? [...homePhotos, ...savedPhotos] : homePhotos;
        });
        preload([...homePhotos.slice(0, 12).map((item) => item.src), UI.title, UI.wakeNormal, UI.wakeHover, UI.paper]);
      });

    fetch('/data/assets.json')
      .then((response) => response.json() as Promise<{ modern?: string[]; ui?: { fence?: string; title?: string; paper?: string; wakeNormal?: string; wakeHover?: string } }>)
      .then((manifest) => {
        if (!alive) return;
        const nextModern = manifest.modern?.length ? manifest.modern : DEFAULT_MODERN_IMAGES;
        setModernImages(nextModern);
        if (manifest.ui?.fence) setFenceSrc(manifest.ui.fence);
        preload([...nextModern.slice(0, 8), manifest.ui?.fence || UI.fence, manifest.ui?.title || UI.title, manifest.ui?.paper || UI.paper]);
      })
      .catch(() => undefined);

    const storedMemories = readSavedMemories();
    if (storedMemories.length) setSavedMemories(storedMemories);

    return () => {
      alive = false;
    };
  }, []);

  const matched = useMemo(() => matchMemories(memories, keyword), [memories, keyword]);
  useGlobalBreath();

  const openDetail = useCallback((photo: PhotoNode) => {
    setDetailPhoto(photo);
    setFlow('home');
  }, []);

  const startKeyword = useCallback(
    (nextKeyword: string, origin?: KeywordOrigin) => {
      const clean = nextKeyword.trim();
      if (!clean) return;
      setKeyword(clean);
      setKeywordOrigin(origin ?? null);
      setFlow('confirm');
    },
    [],
  );

  const startLoading = useCallback((excludeId?: string) => {
    const candidates = excludeId ? matched.filter((item) => item.id !== excludeId) : matched;
    const fallbackCandidates = memories.filter((item) => item.id !== excludeId && (item.mood.includes('怀旧') || item.mood.includes('模糊')));
    const anyOtherMemory = memories.find((item) => item.id !== excludeId);
    const fallback = fallbackCandidates.length ? fallbackCandidates[Math.floor(Math.random() * fallbackCandidates.length)] : anyOtherMemory;
    const pick = candidates[0] ?? fallback ?? memories[0] ?? null;
    setResult(pick);
    setFlow('loading');
  }, [matched, memories]);

  const confirmKeywordAndLoad = useCallback(
    (nextKeyword: string) => {
      const clean = nextKeyword.trim();
      if (!clean) return;
      const nextMatched = matchMemories(memories, clean);
      setKeyword(clean);
      setKeywordOrigin(null);
      setResult(nextMatched[0] ?? memories[0] ?? null);
      setFlow('loading');
    },
    [memories],
  );

  const saveMemory = useCallback(
    (note: string, signature: string, drawingDataUrl: string, editParams: EditParams, editedSrc?: string) => {
      if (!result) return;
      if (returnHomeTimerRef.current) window.clearTimeout(returnHomeTimerRef.current);
      const saved: SavedMemory = {
        id: `saved-${Date.now()}`,
        src: result.src,
        editedSrc,
        keyword,
        note,
        signature,
        drawingDataUrl,
        editParams,
        createdAt: Date.now(),
      };
      const nextSaved = writeSavedMemories([saved, ...savedMemories]);
      setSavedMemories(nextSaved);
      setPhotos((current) => [...current.filter((photo) => !photo.isUserSaved), ...makeSavedHomePhotos(nextSaved)]);
      setReturningHome(true);
      returnHomeTimerRef.current = window.setTimeout(() => {
        setFlow('home');
        setReturningHome(false);
        returnHomeTimerRef.current = null;
      }, EDITOR_HOME_RETURN_MS);
    },
    [keyword, result, savedMemories],
  );

  useEffect(() => {
    return () => {
      if (returnHomeTimerRef.current) window.clearTimeout(returnHomeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!savedMemories.length) return;
    setPhotos((current) => {
      const basePhotos = current.filter((photo) => !photo.isUserSaved);
      return [...basePhotos, ...makeSavedHomePhotos(savedMemories)];
    });
  }, [savedMemories]);

  return (
    <main className="app-shell">
      <CursorField />
      <GlobalMusicControl />
      <HomeView
        photos={photos}
        setPhotos={setPhotos}
        modernImages={modernImages}
        fenceSrc={fenceSrc}
        onOpenDetail={openDetail}
        onWake={() => setFlow('wake')}
        dimmed={!returningHome && (flow !== 'home' || Boolean(detailPhoto))}
        scattered={!returningHome && flow !== 'home'}
      />

      {detailPhoto && <DetailOverlay photo={detailPhoto} onClose={() => setDetailPhoto(null)} />}
      {flow === 'wake' && <WakeView onClose={() => setFlow('home')} onConfirm={confirmKeywordAndLoad} />}
      {flow === 'confirm' && <ConfirmView keyword={keyword} origin={keywordOrigin} onBack={() => setFlow('wake')} onYes={() => startLoading()} />}
      {flow === 'loading' && result && (
        <LoadingView
          keyword={keyword}
          result={result}
          source={loadingSourceFor(matched, memories, result)}
          onBack={() => setFlow('wake')}
          onRetry={startLoading}
          onEdit={() => setFlow('editor')}
        />
      )}
      {flow === 'result' && result && (
        <ResultView keyword={keyword} result={result} onBack={() => setFlow('wake')} onRetry={startLoading} onEdit={() => setFlow('editor')} />
      )}
      {flow === 'editor' && result && (
        <EditorView keyword={keyword} result={result} onSave={saveMemory} onBack={() => setFlow('result')} returningHome={returningHome} />
      )}
    </main>
  );
}

function GlobalMusicControl() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const userPausedRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const playMusic = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return false;
    audio.volume = GLOBAL_MUSIC_VOLUME;
    try {
      await audio.play();
      setIsPlaying(true);
      setIsBlocked(false);
      return true;
    } catch {
      setIsPlaying(false);
      if (!userPausedRef.current) setIsBlocked(true);
      return false;
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = GLOBAL_MUSIC_VOLUME;
    const markPlaying = () => {
      setIsPlaying(true);
      setIsBlocked(false);
    };
    const markPaused = () => setIsPlaying(false);
    audio.addEventListener('play', markPlaying);
    audio.addEventListener('pause', markPaused);
    audio.addEventListener('ended', markPaused);
    void playMusic();
    return () => {
      audio.removeEventListener('play', markPlaying);
      audio.removeEventListener('pause', markPaused);
      audio.removeEventListener('ended', markPaused);
    };
  }, [playMusic]);

  useEffect(() => {
    if (!isBlocked) return;
    const retryAfterGesture = () => {
      if (!userPausedRef.current) void playMusic();
    };
    window.addEventListener('pointerdown', retryAfterGesture, { once: true });
    window.addEventListener('keydown', retryAfterGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', retryAfterGesture);
      window.removeEventListener('keydown', retryAfterGesture);
    };
  }, [isBlocked, playMusic]);

  const toggleMusic = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      userPausedRef.current = false;
      void playMusic();
      return;
    }
    userPausedRef.current = true;
    setIsBlocked(false);
    audio.pause();
  };

  return (
    <div className="global-music">
      <audio ref={audioRef} src={GLOBAL_MUSIC_SRC} loop preload="auto" />
      <button
        type="button"
        className={`music-control ${isPlaying ? 'music-control--playing' : ''}`}
        onClick={toggleMusic}
        aria-label={isPlaying ? '暂停音乐' : '播放音乐'}
        title={isBlocked ? '点击播放音乐' : isPlaying ? '暂停音乐' : '播放音乐'}
      >
        <span className="music-control__icon" aria-hidden>
          <span className="music-control__cone" />
          <span className="music-control__wave music-control__wave--one" />
          <span className="music-control__wave music-control__wave--two" />
        </span>
        <span className="music-control__state">{isPlaying ? 'ON' : 'OFF'}</span>
      </button>
    </div>
  );
}

function readSavedMemories() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed)) return normalizeSavedMemories(parsed);
    }

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as unknown;
      const migrated = normalizeSavedMemories([parsed]);
      if (migrated.length) writeSavedMemories(migrated);
      return migrated;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  return [];
}

function writeSavedMemories(memories: SavedMemory[]) {
  let next = normalizeSavedMemories(memories);
  while (next.length > 0) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return next;
    } catch {
      next = next.slice(0, -1);
    }
  }
  localStorage.removeItem(STORAGE_KEY);
  return next;
}

function normalizeSavedMemories(memories: unknown[]) {
  const seen = new Set<string>();
  return memories
    .filter(isSavedMemory)
    .sort((a, b) => b.createdAt - a.createdAt)
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, MAX_SAVED_MEMORIES);
}

function isSavedMemory(value: unknown): value is SavedMemory {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<SavedMemory>;
  return (
    typeof item.id === 'string' &&
    typeof item.src === 'string' &&
    (typeof item.editedSrc === 'undefined' || typeof item.editedSrc === 'string') &&
    typeof item.keyword === 'string' &&
    typeof item.note === 'string' &&
    typeof item.signature === 'string' &&
    typeof item.drawingDataUrl === 'string' &&
    typeof item.createdAt === 'number' &&
    Boolean(item.editParams)
  );
}

function makeSavedHomePhotos(savedMemories: SavedMemory[]) {
  return normalizeSavedMemories(savedMemories).map((saved, index, all) => makeSavedHomePhoto(saved, index, all.length));
}

function makeSavedHomePhoto(saved: SavedMemory, rank = 0, total = 1): PhotoNode {
  const slot = SAVED_HOME_SLOTS[rank % SAVED_HOME_SLOTS.length];
  const loop = Math.floor(rank / SAVED_HOME_SLOTS.length);
  const seed = hashString(saved.id);
  const ageT = total <= 1 ? 0 : rank / Math.min(MAX_SAVED_MEMORIES - 1, Math.max(1, total - 1));
  const jitterX = (seededRandom(seed + 3) - 0.5) * 3.4 + loop * (slot.x < 50 ? -3.2 : 3.2);
  const jitterY = (seededRandom(seed + 5) - 0.5) * 3.2 + loop * 3.8;
  const position = {
    x: clamp(slot.x + jitterX, 8, 92),
    y: clamp(slot.y + jitterY, 18, 82),
    rotation: 0,
  };

  return {
    id: saved.id,
    kind: 'old',
    src: saved.editedSrc || saved.src,
    title: saved.keyword || '新的回忆',
    memory: saved.note || '这段回忆还没有被写完，只留下了一张重新找回来的照片。',
    author: saved.signature ? `by ${saved.signature}` : 'by 匿名上传',
    date: formatMemoryDate(saved.createdAt),
    drawingDataUrl: saved.drawingDataUrl,
    editParams: saved.editedSrc ? undefined : saved.editParams,
    position,
    organicPosition: position,
    width: clamp(11.8 - ageT * 4.6, 7.2, 11.8),
    depth: clamp(0.98 - ageT * 0.36, 0.58, 0.98),
    baseOpacity: clamp(0.96 - ageT * 0.34, 0.54, 0.96),
    breathPhase: 1.2 + rank * 0.42,
    entryDelay: 0,
    windPhase: 0.7 + rank * 0.31,
    createdAt: saved.createdAt,
    expiresAt: saved.createdAt + 180_000,
    state: 'visible',
    homeLayer: 'saved',
    homeZ: HOME_NEAR_FADE_START + 220 + rank * 440,
    isUserSaved: true,
    savedRank: rank,
  };
}

function toPhotoNode(item: MemoryItem): PhotoNode {
  const seed = hashString(item.id);
  const copy = memoryCopyFor(item, seed);
  return {
    id: item.id,
    kind: 'old',
    src: item.src,
    title: item.title,
    memory: copy.memory,
    author: copy.author,
    date: copy.date,
    position: item.defaultPosition,
    organicPosition: organicizePosition(item.defaultPosition, item.depth, seed),
    depth: item.depth,
    baseOpacity: 0.52 + seededRandom(seed + 11) * 0.32,
    breathPhase: seededRandom(seed + 17) * Math.PI * 2,
    entryDelay: 800 + seededRandom(seed + 29) * 1400,
    windPhase: seededRandom(seed + 37) * Math.PI * 2,
    createdAt: item.createdAt,
    expiresAt: item.createdAt + 75_000,
    state: 'visible',
    homeLayer: 'past',
    homeZ: -2600,
  };
}

function buildHomePhotoNodes(items: MemoryItem[]): PhotoNode[] {
  const random = createSeededRandom(2030);
  const viewportWidth = Math.max(1, window.innerWidth || 1440);
  const viewportHeight = Math.max(1, window.innerHeight || 900);
  const centerX = viewportWidth * 0.5;
  const centerY = viewportHeight * 0.515;
  const spreadX = Math.min(viewportWidth * 0.54, 700);
  const manifestItems = items
    .filter((item) => /^memory-\d+$/.test(item.id))
    .sort((a, b) => Number(a.id.replace('memory-', '')) - Number(b.id.replace('memory-', '')))
    .slice(0, HOME_MAX_PHOTO_COUNT);

  const clusterItems = manifestItems.map((item, index) => {
    const column = index % HOME_COLUMN_OFFSETS.length;
    const row = Math.floor(index / HOME_COLUMN_OFFSETS.length);
    const widthPx = index % 7 === 0 ? pickSeeded(random, 136, 172) : pickSeeded(random, 92, 132);
    const xPx = centerX + HOME_COLUMN_OFFSETS[column] * spreadX + HOME_ROW_X_OFFSETS[row % HOME_ROW_X_OFFSETS.length] + pickSeeded(random, -18, 18);
    const yPx = centerY + HOME_VERTICAL_OFFSETS[column] + HOME_ROW_Y_OFFSETS[row % HOME_ROW_Y_OFFSETS.length] + pickSeeded(random, -10, 10);
    const z = -2600 + index * 280 + row * 80 + pickSeeded(random, -55, 55);

    return { item, index, xPx, yPx, z, widthPx };
  });

  for (let index = 0; index < clusterItems.length; index += 1) {
    for (let otherIndex = 0; otherIndex < index; otherIndex += 1) {
      const current = clusterItems[index];
      const previous = clusterItems[otherIndex];
      const minCenterDistance = Math.max(current.widthPx, previous.widthPx) * 0.62;
      const centerDistance = Math.abs(current.xPx - previous.xPx);
      const depthDistance = Math.abs(current.z - previous.z);

      if (centerDistance < minCenterDistance && depthDistance < 1600) {
        current.z += 1600 - depthDistance;
      }
    }
  }

  for (let index = 0; index < clusterItems.length; index += 1) {
    for (let otherIndex = 0; otherIndex < index; otherIndex += 1) {
      const current = clusterItems[index];
      const previous = clusterItems[otherIndex];
      const currentProjection = projectInitialClusterItem(current, centerX, centerY);
      const previousProjection = projectInitialClusterItem(previous, centerX, centerY);
      const overlapX = Math.max(0, Math.min(currentProjection.right, previousProjection.right) - Math.max(currentProjection.left, previousProjection.left));
      const overlapY = Math.max(0, Math.min(currentProjection.bottom, previousProjection.bottom) - Math.max(currentProjection.top, previousProjection.top));
      if (overlapX <= 0 || overlapY <= 0) continue;

      const smallerArea = Math.min(currentProjection.width * currentProjection.height, previousProjection.width * previousProjection.height);
      const overlapRatio = smallerArea ? (overlapX * overlapY) / smallerArea : 0;
      if (overlapRatio < 0.18) continue;

      const yDirection = current.yPx >= previous.yPx ? 1 : -1;
      const xDirection = current.xPx >= previous.xPx ? 1 : -1;
      current.yPx += ((overlapY + 20) * yDirection) / currentProjection.perspective;
      current.xPx += (Math.min(overlapX, 42) * 0.34 * xDirection) / currentProjection.perspective;
    }
  }

  const projected = clusterItems.map(({ item, index, xPx, yPx, z, widthPx }) => {
    const copy = memoryCopyFor(item, index);
    const dz = z - HOME_INITIAL_CAMERA_DEPTH;
    const depth = clamp((10000 - dz) / 15000, 0.08, 0.98);
    const position = {
      x: (xPx / viewportWidth) * 100,
      y: (yPx / viewportHeight) * 100,
      rotation: 0,
    };

    return {
      id: item.id,
      kind: 'old' as const,
      src: item.src,
      title: item.title,
      memory: copy.memory,
      author: copy.author,
      date: copy.date,
      position,
      organicPosition: position,
      width: (widthPx / viewportWidth) * 100,
      depth,
      baseOpacity: 1,
      breathPhase: index * 0.47,
      entryDelay: 0,
      windPhase: index * 0.3,
      createdAt: item.createdAt,
      expiresAt: item.createdAt + 75_000,
      state: 'visible' as const,
      homeLayer: 'past' as const,
      homeZ: z,
      z,
    };
  });

  return projected.sort((a, b) => a.z - b.z).map(({ z: _z, ...photo }) => photo);
}

function projectInitialClusterItem(item: { xPx: number; yPx: number; z: number; widthPx: number }, centerX: number, centerY: number) {
  const dz = item.z - HOME_INITIAL_CAMERA_DEPTH;
  const perspectiveDistance = Math.max(HOME_MIN_FOCAL_DISTANCE, HOME_FOCAL_LENGTH + dz);
  const perspective = clamp(HOME_FOCAL_LENGTH / perspectiveDistance, HOME_MIN_PROJECT_SCALE, HOME_MAX_PROJECT_SCALE);
  const width = item.widthPx * perspective;
  const height = width * DEFAULT_PHOTO_ASPECT_RATIO;
  const x = centerX + (item.xPx - centerX) * perspective;
  const y = centerY + (item.yPx - centerY) * perspective;
  return {
    perspective,
    width,
    height,
    left: x - width / 2,
    right: x + width / 2,
    top: y - height / 2,
    bottom: y + height / 2,
  };
}

function createSeededRandom(seed: number) {
  let value = seed % 2147483647;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function pickSeeded(random: () => number, min: number, max: number) {
  return min + random() * (max - min);
}

function memoryCopyFor(item: MemoryItem, seed: number) {
  if (item.memory) {
    return {
      memory: item.memory,
      author: item.author || 'by 匿名上传',
      date: item.date || '2026.5.18',
    };
  }
  const tagLine = item.tags.slice(0, 3).join('、');
  const endings = [
    '它像一块没有被完全擦掉的底片，仍然替人保存着某个下午。',
    '后来城市继续往前走，这个地方却在记忆里变得越来越慢。',
    '每次想起它，画面都不完整，但气味、光线和脚步声还留在那里。',
    '新的道路覆盖上来以前，这里曾经短暂地属于许多人的日常。',
  ];
  return {
    memory: `${item.title}总和${tagLine}连在一起。那是一段${item.mood}的${item.era}记忆，${endings[Math.abs(seed) % endings.length]}`,
    author: 'by 匿名上传',
    date: `2026.5.${18 + (Math.abs(seed) % 12)}`,
  };
}

function formatMemoryDate(value: number) {
  return new Date(value).toLocaleDateString('zh-CN').replace(/\//g, '.');
}

function organicizePosition(position: { x: number; y: number; rotation: number }, depth: number, seed: number) {
  const layerY = 35 + depth * 34;
  const centerPull = 0.16 + (1 - depth) * 0.08;
  const jitterX = (seededRandom(seed + 1) - 0.5) * (18 + (1 - depth) * 10);
  const jitterY = (seededRandom(seed + 2) - 0.5) * (8 + (1 - depth) * 6);
  return {
    x: clamp(lerp(position.x, HOME_TUNNEL_ORIGIN.x, centerPull) + jitterX, 8, 92),
    y: clamp(lerp(position.y, layerY, 0.62) + jitterY, 26, 82),
    rotation: (seededRandom(seed + 3) - 0.5) * 6,
  };
}

function hashString(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function matchMemories(items: MemoryItem[], rawKeyword: string) {
  const key = normalizeKeyword(rawKeyword);
  if (!key) return items.slice(0, 6);

  const expandedTerms = expandKeywordTerms(key);
  const pinnedId = pinnedMemoryIdForTerms(expandedTerms);
  const pinned = pinnedId ? items.find((item) => item.id === pinnedId) : undefined;
  const ranked = items
    .map((item) => ({ item, score: scoreMemory(item, key, expandedTerms) }))
    .filter(({ item, score }) => score > 0 && item.id !== pinned?.id)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);

  if (pinned) return [pinned, ...ranked].slice(0, 6);
  if (ranked.length > 0) return ranked.slice(0, 6);
  return items.filter((item) => item.mood.includes('怀旧') || item.mood.includes('模糊')).slice(0, 6);
}

function loadingSourceFor(matched: MemoryItem[], memories: MemoryItem[], result: MemoryItem) {
  return matched.find((item) => item.id !== result.id) ?? memories.find((item) => item.id !== result.id) ?? result;
}

function normalizeKeyword(value: string) {
  return value.trim().replace(/[“”"'\\s]/g, '').toLowerCase();
}

function normalizeKeywordMap(matches: Record<string, string>) {
  return Object.fromEntries(Object.entries(matches).map(([key, id]) => [normalizeKeyword(key), id]));
}

function buildKeywordAliasTerms(groups: readonly (readonly string[])[]) {
  const terms: { term: string; canonical: string }[] = [];
  groups.forEach(([canonical, ...aliases]) => {
    if (!canonical) return;
    [canonical, ...aliases].forEach((term) => {
      const normalized = normalizeKeyword(term);
      if (normalized.length >= 1) terms.push({ term: normalized, canonical: normalizeKeyword(canonical) });
    });
  });
  return terms.sort((a, b) => b.term.length - a.term.length);
}

function pinnedMemoryIdForTerms(terms: string[]) {
  for (const term of terms) {
    const pinnedId = KEYWORD_MATCHES[term];
    if (pinnedId) return pinnedId;
  }
  return undefined;
}

function isPaperBackdropMemory(item: MemoryItem) {
  if (PAPER_BACKDROP_MEMORY_IDS.has(item.id)) return true;
  if (item.type !== 'object') return false;
  return item.tags.some((tag) => ['白底', '塑料凳', '冰棍箱', '灯泡'].includes(tag));
}

function keywordTerms(key: string) {
  const terms = new Set<string>();
  if (key.length >= 2) terms.add(key);
  const segments = key.split(/[的了着过和与在里中]/).filter((segment) => segment.length >= 2);
  segments.forEach((segment) => {
    terms.add(segment);
    const maxLength = Math.min(4, segment.length);
    for (let length = 2; length <= maxLength; length += 1) {
      for (let index = 0; index <= segment.length - length; index += 1) {
        terms.add(segment.slice(index, index + length));
      }
    }
  });
  return [...terms].sort((a, b) => b.length - a.length);
}

function expandKeywordTerms(key: string) {
  const terms = new Set(keywordTerms(key));
  KEYWORD_ALIAS_TERMS.forEach(({ term, canonical }) => {
    if (key.includes(term) || term.includes(key)) {
      terms.add(term);
      terms.add(canonical);
      keywordTerms(canonical).forEach((canonicalTerm) => terms.add(canonicalTerm));
    }
  });
  return [...terms].sort((a, b) => b.length - a.length);
}

function scoreMemory(item: MemoryItem, key: string, terms: string[]) {
  const fields = [item.title, item.mood, item.era, item.type, ...item.tags].map(normalizeKeyword);
  const haystack = fields.join(' ');
  let score = 0;

  if (haystack.includes(key)) score += 10 + key.length;
  terms.forEach((term) => {
    if (term === key) return;
    if (haystack.includes(term)) score += 3 + Math.min(term.length, 4);
    fields.forEach((field) => {
      if (field === term) score += 4;
      else if (field.length >= 2 && term.length >= 2 && (field.includes(term) || term.includes(field))) score += 1;
    });
  });

  if (key.length === 1 && haystack.includes(key)) score += 1;
  return score;
}

function useGlobalBreath() {
  useEffect(() => {
    let active = true;
    const tick = (time: number) => {
      const breath = Math.sin(time / 555) * 0.04;
      document.documentElement.style.setProperty('--breath', breath.toFixed(4));
      document.documentElement.style.setProperty('--breath-scale', (1 + breath).toFixed(4));
      document.documentElement.style.setProperty('--breath-alpha', (0.96 + breath).toFixed(4));
      if (active) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => {
      active = false;
    };
  }, []);
}

function CursorField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lag = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const target = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let active = true;
    const resize = () => {
      const dpr = canvasDpr();
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const move = (event: PointerEvent) => {
      target.current.x = event.clientX;
      target.current.y = event.clientY;
    };
    const draw = () => {
      lag.current.x += (target.current.x - lag.current.x) * 0.32;
      lag.current.y += (target.current.y - lag.current.y) * 0.32;
      document.documentElement.style.setProperty('--cursor-lag-x', `${lag.current.x}px`);
      document.documentElement.style.setProperty('--cursor-lag-y', `${lag.current.y}px`);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.strokeStyle = 'rgba(20, 20, 20, 0.52)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(lag.current.x, lag.current.y, 18, 0, Math.PI * 2);
      ctx.stroke();
      if (active) requestAnimationFrame(draw);
    };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', move, { passive: true });
    requestAnimationFrame(draw);
    return () => {
      active = false;
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
    };
  }, []);

  return <canvas className="cursor-field" ref={canvasRef} />;
}

function HomeView({
  photos,
  setPhotos,
  modernImages,
  fenceSrc,
  onOpenDetail,
  onWake,
  dimmed,
  scattered,
}: {
  photos: PhotoNode[];
  setPhotos: React.Dispatch<React.SetStateAction<PhotoNode[]>>;
  modernImages: string[];
  fenceSrc: string;
  onOpenDetail: (photo: PhotoNode) => void;
  onWake: () => void;
  dimmed: boolean;
  scattered: boolean;
}) {
  const [cameraDepth, setCameraDepth] = useState(HOME_INITIAL_CAMERA_DEPTH);
  const targetDepth = useRef(HOME_INITIAL_CAMERA_DEPTH);
  const cameraCurrent = useRef(HOME_INITIAL_CAMERA_DEPTH);
  const cameraVelocity = useRef(0);
  const rafRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const photosRef = useRef(photos);
  const dimmedRef = useRef(dimmed);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    dimmedRef.current = dimmed;
  }, [dimmed]);

  useEffect(() => {
    const tick = () => {
      const delta = targetDepth.current - cameraCurrent.current;
      cameraVelocity.current = delta * HOME_CAMERA_EASE;
      cameraCurrent.current = Math.abs(delta) < 0.02 ? targetDepth.current : clamp(cameraCurrent.current + cameraVelocity.current, HOME_CAMERA_MIN_Z, HOME_CAMERA_MAX_Z);
      setCameraDepth(cameraCurrent.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let scheduleTimer = 0;
    let revealTimer = 0;
    let clearFenceTimer = 0;

    const schedule = () => {
      if (!active) return;
      scheduleTimer = window.setTimeout(runUpdate, randomBetween(CITY_UPDATE_MIN_MS, CITY_UPDATE_MAX_MS));
    };

    const runUpdate = () => {
      if (!active) return;
      if (dimmedRef.current) {
        scheduleTimer = window.setTimeout(runUpdate, 10_000);
        return;
      }
      const now = Date.now();
      const candidates = photosRef.current.filter((photo) => photo.kind === 'old' && photo.state === 'visible' && !photo.isUserSaved && photo.homeLayer !== 'saved');
      const target = [...candidates].sort((a, b) => (a.homeZ ?? 0) - (b.homeZ ?? 0) || a.createdAt - b.createdAt)[0];
      if (!target) {
        schedule();
        return;
      }
      const modernSrc = modernImages[Math.floor(now / 1000) % modernImages.length] || DEFAULT_MODERN_IMAGES[0];
      const fenceId = `fence-${now}`;
      const modernId = `modern-${now}`;
      const fence: PhotoNode = {
        id: fenceId,
        kind: 'fence',
        src: fenceSrc,
        title: '施工围挡',
        memory: '围挡短暂地挡住旧照片，像城市更新时间里一块临时的空白。',
        author: 'system',
        date: formatMemoryDate(now),
        position: { ...target.position, rotation: 0 },
        organicPosition: { ...target.organicPosition, rotation: 0 },
        depth: target.depth + 0.08,
        baseOpacity: 0.88,
        breathPhase: target.breathPhase + 0.8,
        entryDelay: 0,
        windPhase: target.windPhase,
        createdAt: now,
        expiresAt: now + 11_000,
        state: 'revealing',
        homeLayer: 'transition',
        homeZ: (target.homeZ ?? 0) - 120,
      };
      const modern: PhotoNode = {
        id: modernId,
        kind: 'modern',
        src: modernSrc,
        title: '新的城市图像',
        memory: '旧照片慢慢退到后面，新的城市图像从模糊里显影出来。',
        author: 'system',
        date: formatMemoryDate(now),
        position: { ...target.position, rotation: 0 },
        organicPosition: { ...target.organicPosition, rotation: 0 },
        depth: clamp(target.depth - 0.06, 0.22, 0.82),
        baseOpacity: 0.58,
        breathPhase: target.breathPhase + 1.4,
        entryDelay: 0,
        windPhase: target.windPhase + 1,
        createdAt: now + 2_400,
        expiresAt: now + 120_000,
        state: 'revealing',
        homeLayer: 'recent',
        homeZ: (target.homeZ ?? 0) + 720,
      };
      preload([modernSrc, fenceSrc]);
      setPhotos((current) => [...current.map((photo) => (photo.id === target.id ? { ...photo, state: 'fading' as const } : photo)), fence]);
      revealTimer = window.setTimeout(() => setPhotos((current) => [...current.filter((photo) => photo.id !== target.id), modern]), 6800);
      clearFenceTimer = window.setTimeout(() => setPhotos((current) => current.filter((photo) => photo.id !== fenceId)), 12_000);
      schedule();
    };

    schedule();
    return () => {
      active = false;
      window.clearTimeout(scheduleTimer);
      window.clearTimeout(revealTimer);
      window.clearTimeout(clearFenceTimer);
    };
  }, [fenceSrc, modernImages, setPhotos]);

  const onWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    targetDepth.current = clamp(targetDepth.current + event.deltaY * HOME_WHEEL_SPEED, HOME_CAMERA_MIN_Z, HOME_CAMERA_MAX_Z);
  };

  return (
    <section ref={rootRef} className={`home-stage ${dimmed ? 'home-stage--dimmed' : ''}`} onWheel={onWheel}>
      <MapBackground />
      <div className="page-intro" aria-hidden />
      <div className="title-graphic">
        <img src={UI.title} alt="未来的回忆" decoding="async" />
      </div>
      <aside className="home-copy">
        <p>
          当城市不断向前更新，记忆还停留在一些具体却模糊的地方：<br />
          一棵树，一家店，一段放学路，一扇已经被拆掉的门...<br />
          当空间被重建，记忆不会立刻消失。<br />
          它逐渐模糊，再被新的图像覆盖，<br />
          最后成为未来回忆的一部分。
        </p>
      </aside>
      <div className="photo-field">
        {photos.map((photo) => (
          <MemoryPhoto
            key={photo.id}
            photo={photo}
            cameraDepth={cameraDepth}
            dimmed={dimmed}
            scattered={scattered}
            onOpen={() => onOpenDetail(photo)}
          />
        ))}
      </div>
      <button className="wake-image-button" onClick={onWake} aria-label="唤醒回忆">
        <img className="wake-button-image wake-button-normal" src={UI.wakeNormal} alt="" decoding="async" />
        <img className="wake-button-image wake-button-hover" src={UI.wakeHover} alt="" decoding="async" />
      </button>
      <div className="depth-meter" style={{ transform: `scaleX(${0.16 + clamp((cameraDepth - HOME_INITIAL_CAMERA_DEPTH) / (HOME_CAMERA_MAX_Z - HOME_INITIAL_CAMERA_DEPTH), 0, 1) * 0.84})` }} />
    </section>
  );
}

function MemoryPhoto({
  photo,
  cameraDepth,
  dimmed,
  scattered,
  onOpen,
}: {
  photo: PhotoNode;
  cameraDepth: number;
  dimmed: boolean;
  scattered: boolean;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const aspectRatio = useImageAspectRatio(photo.src);
  const scatterSeed = (Math.sin(photo.breathPhase * 2.7 + photo.windPhase) + 1) / 2;
  const visual = homeVisualForPhoto(photo, cameraDepth, dimmed, scattered, scatterSeed);
  const viewportWidth = window.innerWidth || 1440;
  const viewportHeight = window.innerHeight || 900;
  const centerX = viewportWidth * 0.5;
  const centerY = viewportHeight * 0.515;
  const targetX = (photo.organicPosition.x / 100) * viewportWidth;
  const targetY = (photo.organicPosition.y / 100) * viewportHeight;
  const displayX = centerX + (targetX - centerX) * visual.perspective;
  const displayY = centerY + (targetY - centerY) * visual.perspective;
  const displayScale = visual.scale * (scattered ? 0.92 + photo.depth * 0.05 : 1);
  const displayOpacity = visual.opacity;
  const displayBlur = visual.blur * 0.5;
  const displayZIndex = visual.zIndex;
  const base = {
    x: displayX,
    y: displayY,
    rotation: photo.organicPosition.rotation,
  };
  const x = 0;
  const y = 0;
  const basePercentX = (base.x / viewportWidth) * 100;
  const basePercentY = (base.y / viewportHeight) * 100;
  const scatterTarget = scattered ? wakeScatterTarget(photo, basePercentX, basePercentY, scatterSeed) : null;
  const scatterX = scatterTarget ? ((scatterTarget.x - basePercentX) / 100) * viewportWidth : 0;
  const scatterY = scatterTarget ? ((scatterTarget.y - basePercentY) / 100) * viewportHeight : 0;
  const scatterRotation = 0;
  const scatterDelay = scattered ? Math.round(24 + scatterSeed * 190 + (1 - photo.depth) * 70) : 0;
  const imageFilter = photo.editParams ? homeEditParamsFilter(photo.editParams) : undefined;
  const floatAmplitude = 2.2 + (1 - photo.depth) * 4.8;
  const driftDuration = 22 + (photo.windPhase % 1) * 13 + (1 - photo.depth) * 6;

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    node.style.setProperty('--my', `${event.clientY - rect.top}px`);
  };

  return (
    <button
      ref={ref}
      type="button"
      className={`memory-photo memory-photo--${photo.kind} memory-photo--${photo.state} memory-photo--entered ${scattered ? 'memory-photo--scattered' : ''}`}
      onClick={photo.kind !== 'fence' ? onOpen : undefined}
      onPointerMove={onPointerMove}
      style={
        {
        width: photo.width ? `${photo.width}vw` : undefined,
        left: `${base.x}px`,
        top: `${base.y}px`,
        opacity: displayOpacity,
        zIndex: displayZIndex,
        transform: `translate(-50%, -50%) translate3d(${x + scatterX}px, ${y + scatterY}px, 0) scale(${displayScale}) rotate(${base.rotation + scatterRotation}deg)`,
        transitionDelay: `${scatterDelay}ms`,
        '--photo-aspect-ratio': aspectRatio.toFixed(5),
        '--photo-phase': photo.breathPhase,
        '--project-blur': `${displayBlur.toFixed(2)}px`,
        '--project-opacity': displayOpacity,
        '--photo-contrast': visual.contrast,
        '--photo-saturation': visual.saturation,
        '--photo-brightness': visual.brightness,
        '--photo-shadow-y': `${visual.shadowY.toFixed(1)}px`,
        '--photo-shadow-blur': `${visual.shadowBlur.toFixed(1)}px`,
        '--photo-shadow-alpha': visual.shadowAlpha,
        '--photo-shadow-tight-alpha': visual.shadowTightAlpha,
        '--float-x': `${(Math.sin(photo.breathPhase) * floatAmplitude).toFixed(2)}px`,
        '--float-y': `${(Math.cos(photo.windPhase) * floatAmplitude * 0.72).toFixed(2)}px`,
        '--float-duration': `${driftDuration.toFixed(2)}s`,
        '--float-delay': `${(-photo.breathPhase * 2.8).toFixed(2)}s`,
        '--hover-scale': visual.hoverScale,
        } as React.CSSProperties
      }
    >
      <span className="photo-drift-shell">
          <span className="photo-hover-shell">
          <span className="inner-image-wrapper">
            <img src={photo.src} alt={photo.title} decoding="async" loading={photo.depth > 0.82 ? 'eager' : 'lazy'} style={imageFilter ? { filter: `${imageFilter} blur(${displayBlur.toFixed(2)}px)` } : undefined} />
          </span>
        </span>
      </span>
    </button>
  );
}

function wakeScatterTarget(photo: PhotoNode, baseX: number, baseY: number, seed: number) {
  const numeric = /^memory-(\d+)$/.exec(photo.id)?.[1];
  const index = numeric ? Number(numeric) - 1 : hashString(photo.id);
  const slot = WAKE_SCATTER_SLOTS[Math.abs(index) % WAKE_SCATTER_SLOTS.length];
  const jitterX = (seed - 0.5) * 4.8 + Math.sin(photo.windPhase * 1.7) * 2.2;
  const jitterY = (seed - 0.5) * 3.8 + Math.cos(photo.breathPhase * 1.3) * 2.1;
  const keepAwayFromCenterX = Math.abs(slot.x - 50) < 12 ? (slot.x < 50 ? -8 : 8) : 0;
  const keepAwayFromCenterY = Math.abs(slot.y - 50) < 11 ? (slot.y < 50 ? -7 : 7) : 0;

  return {
    x: clamp(slot.x + keepAwayFromCenterX + jitterX + (baseX - 50) * 0.05, 4, 96),
    y: clamp(slot.y + keepAwayFromCenterY + jitterY + (baseY - 50) * 0.04, 8, 91),
  };
}

function homeStaticCameraDepthForPhoto(photoDepth: number) {
  return clamp((0.84 - photoDepth) / 0.72, 0, 1);
}

function homeStaticTravelProgress(photoDepth: number, cameraDepth = 0.08) {
  const stop = homeStaticCameraDepthForPhoto(photoDepth);
  return smoothstep(stop - 0.14, stop + 0.24, cameraDepth);
}

function homeStaticPassProgress(photoDepth: number, cameraDepth = 0.08) {
  const stop = homeStaticCameraDepthForPhoto(photoDepth);
  return smoothstep(stop + 0.1, stop + 0.44, cameraDepth);
}

function homeStaticVisualForPhoto(photo: PhotoNode, dimmed: boolean, scattered: boolean, scatterSeed: number) {
  const depth = clamp(photo.depth, 0.08, 0.98);
  const far = 1 - depth;
  const farZ = Math.max(0, (photo.homeZ ?? 0) - HOME_CLEAR_FAR);
  const farZBlur = clamp(farZ / (HOME_FAR_BLUR_START - HOME_CLEAR_FAR), 0, 1) * 1.2;
  const scatterBlur = scattered ? 1.1 + far * 2.1 + scatterSeed * 0.9 : 0;
  const stop = homeStaticCameraDepthForPhoto(depth);
  const focusDistance = Math.abs(0.08 - stop);
  const focus = 1 - smoothstep(0.06, 0.22, focusDistance);
  const travel = homeStaticTravelProgress(depth);
  const pass = homeStaticPassProgress(depth);
  const focusBlur = Math.pow(clamp(focusDistance / 0.58, 0, 1), 1.35) * 7.4;

  let opacity = photo.baseOpacity * (0.2 + travel * 0.42 + focus * 0.38 - pass * 0.08);
  let blur = 0.08 + focusBlur + pass * 0.9 + farZBlur + scatterBlur;
  let zIndex = Math.round(travel * 74 + focus * 140 + pass * 42 + depth * 24);
  let contrast = 0.86 + depth * 0.06 + focus * 0.05;
  let saturation = 0.5 + depth * 0.12 + focus * 0.1;
  let brightness = 0.88 + depth * 0.04 + focus * 0.04;
  let shadowY = 12 + travel * 12 + focus * 12 + pass * 16;
  let shadowBlur = 18 + travel * 20 + focus * 26 + pass * 22;
  let shadowAlpha = 0.12 + travel * 0.11 + focus * 0.1;
  let shadowTightAlpha = 0.08 + travel * 0.08 + focus * 0.08;
  let hoverScale = 1.025 + focus * 0.03;
  let scale = 0.45 + travel * 0.34 + focus * 0.17 + pass * 0.18;

  if (photo.state === 'fading') {
    opacity = 0.08;
  } else if (photo.homeLayer === 'transition') {
    opacity = 0.9;
    blur = Math.min(blur, 0.7);
    zIndex = 430 + Math.round(depth * 10);
    shadowY = 16;
    shadowBlur = 40;
    shadowAlpha = 0.2;
  } else if (photo.homeLayer === 'saved') {
    const savedRank = photo.savedRank ?? 0;
    const savedAgeT = clamp(savedRank / Math.max(1, MAX_SAVED_MEMORIES - 1), 0, 1);
    const savedPresence = clamp(0.12 + travel * 0.28 + focus * 0.72 - pass * 0.48, 0, 1);
    opacity = clamp((0.98 - savedAgeT * 0.24) * savedPresence, 0, 0.98);
    blur = scattered ? 0.9 + scatterSeed * 0.5 + savedAgeT * 1.3 : Math.max(0.04 + savedAgeT * 1.4, blur * 0.72);
    zIndex = Math.max(80, 260 + Math.round(focus * 170 + travel * 48 - pass * 120) - savedRank * 4);
    contrast = 1.08 + focus * 0.12 - savedAgeT * 0.08;
    saturation = 1.02 + focus * 0.14 - savedAgeT * 0.14;
    brightness = 1 + focus * 0.08 - savedAgeT * 0.1;
    shadowY = 20 + focus * 24 + travel * 8 - savedAgeT * 9;
    shadowBlur = 30 + focus * 34 + travel * 8 - savedAgeT * 20;
    shadowAlpha = 0.16 + focus * 0.2 - savedAgeT * 0.12;
    shadowTightAlpha = 0.1 + focus * 0.12 - savedAgeT * 0.06;
    hoverScale = 1.025 + focus * 0.025;
  } else if (photo.kind === 'modern') {
    opacity = 0.58;
    blur = 0.6 + far * 1.4 + scatterBlur * 0.45;
    zIndex = 190 + Math.round(depth * 45);
    contrast = 0.92;
    saturation = 0.5;
    brightness = 0.9;
    shadowAlpha = 0.12 + depth * 0.1;
    hoverScale = 1.07;
  } else if (photo.homeLayer === 'recent') {
    opacity *= 0.86;
    blur += 0.35;
    zIndex = 45 + Math.round(depth * 74 + focus * 82);
    shadowAlpha *= 0.74;
    shadowTightAlpha *= 0.78;
  }

  const dimMultiplier = dimmed ? (scattered ? 0.48 + depth * 0.18 : 0.86) : 1;

  return {
    opacity: opacity * dimMultiplier,
    blur: clamp(blur, 0, 8.8),
    zIndex,
    contrast,
    saturation,
    brightness,
    scale,
    shadowY,
    shadowBlur,
    shadowAlpha,
    shadowTightAlpha,
    hoverScale,
  };
}

function homeVisualForPhoto(photo: PhotoNode, cameraDepth: number, dimmed: boolean, scattered: boolean, scatterSeed: number) {
  const depth = clamp(photo.depth, 0.08, 0.98);
  const dz = (photo.homeZ ?? 0) - cameraDepth;
  const perspectiveDistance = Math.max(HOME_MIN_FOCAL_DISTANCE, HOME_FOCAL_LENGTH + dz);
  const perspective = clamp(HOME_FOCAL_LENGTH / perspectiveDistance, HOME_MIN_PROJECT_SCALE, HOME_MAX_PROJECT_SCALE);
  const scale = perspective;
  const far = 1 - depth;
  const scatterBlur = scattered ? 1.1 + far * 2.1 + scatterSeed * 0.9 : 0;

  let opacity = photo.baseOpacity;
  let blur = 0;
  let clarity = 1;

  if (dz > HOME_FAR_BLUR_START) {
    const blurT = smoothstep(HOME_FAR_BLUR_START, HOME_FAR_HIDE_Z, dz);
    blur = lerp(0, 12, blurT);
    clarity = lerp(1, 0.2, blurT);
  } else if (dz > HOME_CLEAR_FAR) {
    const focusT = smoothstep(HOME_CLEAR_FAR, HOME_FAR_BLUR_START, dz);
    blur = Math.max(blur, lerp(0, 3.4, focusT));
    clarity = Math.min(clarity, lerp(1, 0.68, focusT));
  }

  if (dz > HOME_FAR_FADE_START) {
    const fadeT = smoothstep(HOME_FAR_FADE_START, HOME_FAR_HIDE_Z, dz);
    opacity *= lerp(1, 0.06, fadeT);
  }

  if (dz < HOME_NEAR_FADE_START) {
    const nearT = smoothstep(HOME_NEAR_HIDE_Z, HOME_NEAR_FADE_START, dz);
    opacity *= lerp(0, 1, nearT);
    blur = Math.max(blur, lerp(8, 0, nearT));
    clarity = lerp(0.75, 1, nearT);
  }

  if (dz < HOME_NEAR_HIDE_Z || dz > HOME_FAR_HIDE_Z) {
    opacity = 0;
    blur = dz > HOME_FAR_HIDE_Z ? 12 : 0;
    clarity = 0;
  }

  if (dz >= HOME_CLEAR_NEAR && dz <= HOME_CLEAR_FAR) {
    blur = 0;
    opacity = Math.max(opacity, photo.baseOpacity * 0.96);
    clarity = 1;
  }

  blur += scatterBlur;
  let zIndex = Math.round(10000 - (photo.homeZ ?? 0));
  let contrast = 0.9 + clarity * 0.18;
  let saturation = 0.58 + clarity * 0.38;
  let brightness = 0.9 + clarity * 0.1;
  let shadowY = 12 + scale * 14;
  let shadowBlur = 18 + scale * 22;
  let shadowAlpha = 0.08 + opacity * 0.2;
  let shadowTightAlpha = 0.05 + clarity * 0.1;
  let hoverScale = 1.025 + clarity * 0.035;

  if (photo.state === 'fading') {
    opacity = 0.08;
  } else if (photo.homeLayer === 'transition') {
    opacity = 0.9;
    blur = Math.min(blur, 0.7);
    zIndex = 430 + Math.round(depth * 10);
    shadowY = 16;
    shadowBlur = 40;
    shadowAlpha = 0.2;
  } else if (photo.homeLayer === 'saved') {
    const savedRank = photo.savedRank ?? 0;
    const savedAgeT = clamp(savedRank / Math.max(1, MAX_SAVED_MEMORIES - 1), 0, 1);
    opacity = clamp(opacity * (1.04 - savedAgeT * 0.24), 0, 0.98);
    blur = scattered ? 0.9 + scatterSeed * 0.5 + savedAgeT * 1.3 : Math.max(0.04 + savedAgeT * 1.4, blur * 0.72);
    zIndex += 260 - savedRank * 4;
    contrast = 1.08 + clarity * 0.12 - savedAgeT * 0.08;
    saturation = 1.02 + clarity * 0.14 - savedAgeT * 0.14;
    brightness = 1 + clarity * 0.08 - savedAgeT * 0.1;
    shadowY = 20 + clarity * 24 - savedAgeT * 9;
    shadowBlur = 30 + clarity * 34 - savedAgeT * 20;
    shadowAlpha = 0.16 + clarity * 0.2 - savedAgeT * 0.12;
    shadowTightAlpha = 0.1 + clarity * 0.12 - savedAgeT * 0.06;
    hoverScale = 1.025 + clarity * 0.025;
  } else if (photo.kind === 'modern') {
    opacity = Math.min(opacity, 0.58);
    blur = 0.6 + far * 1.4 + scatterBlur * 0.45;
    zIndex = Math.round(190 + depth * 45 + (10000 - dz) * 0.02);
    contrast = 0.92;
    saturation = 0.5;
    brightness = 0.9;
    shadowAlpha = 0.12 + depth * 0.1;
    hoverScale = 1.07;
  } else if (photo.homeLayer === 'recent') {
    opacity *= 0.86;
    blur += 0.35;
    zIndex += 45;
    shadowAlpha *= 0.74;
    shadowTightAlpha *= 0.78;
  }

  const dimMultiplier = dimmed ? (scattered ? 0.48 + depth * 0.18 : 0.86) : 1;

  return {
    opacity: opacity * dimMultiplier,
    blur: clamp(blur, 0, 12),
    zIndex,
    contrast,
    saturation,
    brightness,
    scale,
    perspective,
    shadowY,
    shadowBlur,
    shadowAlpha,
    shadowTightAlpha,
    hoverScale,
  };
}

function homeEditParamsFilter(params: EditParams) {
  const saturation = 1 - params.dream * 0.24 - params.worn * 0.16;
  const contrast = 1 + params.dream * 0.12 - params.worn * 0.08;
  const sepia = params.worn * 0.42;
  const hue = params.dream * 22;
  return `saturate(${saturation.toFixed(2)}) contrast(${contrast.toFixed(2)}) sepia(${sepia.toFixed(2)}) hue-rotate(${hue.toFixed(1)}deg)`;
}

function editParamsFilter(params: EditParams) {
  const blur = params.fade * 6;
  const saturation = 1 - params.dream * 0.24 - params.worn * 0.16;
  const contrast = 1 + params.dream * 0.12 - params.worn * 0.08;
  const sepia = params.worn * 0.42;
  const hue = params.dream * 22;
  return `blur(${blur.toFixed(2)}px) saturate(${saturation.toFixed(2)}) contrast(${contrast.toFixed(2)}) sepia(${sepia.toFixed(2)}) hue-rotate(${hue.toFixed(1)}deg)`;
}

function MapBackground() {
  const marks = [
    { x: 3, y: 59, red: false },
    { x: 7.5, y: 67, red: false },
    { x: 41, y: 28, red: false },
    { x: 70, y: 21, red: true },
    { x: 70, y: 67, red: true },
    { x: 89, y: 8, red: false },
  ];
  return (
    <div className="map-background" aria-hidden>
      {marks.map((mark, index) => (
        <span
          key={index}
          className={`red-pin ${mark.red ? 'red-pin--red' : 'red-pin--dark'}`}
          style={{
            left: `${mark.x}%`,
            top: `${mark.y}%`,
          }}
        />
      ))}
    </div>
  );
}

function DetailOverlay({ photo, onClose }: { photo: PhotoNode; onClose: () => void }) {
  const imageRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const aspectRatio = useImageAspectRatio(photo.src);

  useEffect(() => {
    if (!paperRef.current) return;
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(
      paperRef.current,
      {
        autoAlpha: 0,
        scale: 0.94,
        y: 18,
        filter: 'blur(10px)',
        boxShadow: '0 12px 28px rgba(34,31,25,0.08)',
      },
      {
        autoAlpha: 0.98,
        scale: 1,
        y: 0,
        filter: 'blur(0.4px)',
        boxShadow: '0 24px 56px rgba(34,31,25,0.18)',
        duration: 0.6,
      },
    )
      .to(paperRef.current, {
        autoAlpha: 1,
        filter: 'blur(0px)',
        duration: 0.16,
        ease: 'power2.out',
      });
    return () => {
      tl.kill();
    };
  }, []);

  const closeIfOutside = (event: React.MouseEvent<HTMLDivElement>) => {
    const path = event.nativeEvent.composedPath();
    const clickedContent =
      (imageRef.current && path.includes(imageRef.current)) ||
      (paperRef.current && path.includes(paperRef.current)) ||
      (closeButtonRef.current && path.includes(closeButtonRef.current));
    if (!clickedContent) onClose();
  };

  return (
    <div className="modal-layer detail-layer" onMouseDown={closeIfOutside}>
      <div className="white-veil" />
      <div className="detail-content">
        <div className="detail-image-wrap" ref={imageRef} style={{ '--detail-image-aspect-ratio': aspectRatio.toFixed(5) } as React.CSSProperties}>
          <img src={photo.src} alt={photo.title} decoding="async" style={photo.editParams ? { filter: editParamsFilter(photo.editParams) } : undefined} />
          <DetailDustCanvas />
        </div>
        <div className="paper-card detail-paper" ref={paperRef}>
          <img src={UI.paper} alt="" decoding="async" loading="lazy" />
          <div className="paper-text">
            <h2>{photo.title}</h2>
            <p>{photo.memory}</p>
            {photo.drawingDataUrl && <img className="paper-drawing" src={photo.drawingDataUrl} alt="" decoding="async" />}
            <small>
              {photo.author}
              <br />
              {photo.date}
            </small>
          </div>
        </div>
        <button className="close-button" ref={closeButtonRef} onClick={onClose} aria-label="关闭">
          ×
        </button>
      </div>
    </div>
  );
}

function WakeView({ onClose, onConfirm }: { onClose: () => void; onConfirm: (keyword: string) => void }) {
  const [input, setInput] = useState('');
  const [words, setWords] = useState<KeywordLayout[]>(() => layoutKeywords(KEYWORDS, true));
  const [refreshing, setRefreshing] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);
  const wordRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useScreenIntro(panelRef, { y: 0 });

  const submit = (value = input, origin?: KeywordOrigin) => {
    if (pendingConfirm) return;
    const clean = value.trim();
    if (!clean) return;
    void origin;
    resetRepel();
    setPendingConfirm(clean);
  };

  const refresh = () => {
    if (refreshing || pendingConfirm) return;
    setRefreshing(true);
    const leavingWords = words.map((word) => ({
      ...word,
      state: 'leaving' as const,
      leaveDelay: Math.round(Math.random() * 730),
    }));
    const maxLeaveDelay = Math.max(...leavingWords.map((word) => word.leaveDelay), 0);
    setWords(leavingWords);
    window.setTimeout(() => {
      const nextWords = layoutKeywords(KEYWORDS, true);
      const maxEnterDelay = Math.max(...nextWords.map((word) => word.enterDelay), 0);
      setWords(nextWords);
      window.setTimeout(() => setRefreshing(false), maxEnterDelay + 960);
    }, maxLeaveDelay + 940);
  };

  const repelKeywords = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pendingConfirm) return;
    Object.values(wordRefs.current).forEach((node) => {
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = cx - event.clientX;
      const dy = cy - event.clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const strength = distance < 110 ? (110 - distance) / 110 : 0;
      node.style.setProperty('--repel-x', `${(dx / (distance || 1)) * strength * 22}px`);
      node.style.setProperty('--repel-y', `${(dy / (distance || 1)) * strength * 16}px`);
    });
  };

  const resetRepel = () => {
    Object.values(wordRefs.current).forEach((node) => {
      node?.style.setProperty('--repel-x', '0px');
      node?.style.setProperty('--repel-y', '0px');
    });
  };

  return (
    <div
      className={`modal-layer wake-layer ${refreshing ? 'wake-layer--refreshing' : ''} ${pendingConfirm ? 'wake-layer--confirming' : ''}`}
      onPointerMove={repelKeywords}
      onPointerLeave={resetRepel}
      onMouseDown={(event) => {
        if (pendingConfirm) return;
        const path = event.nativeEvent.composedPath();
        const clickedKeyword = path.some((target) => target instanceof HTMLElement && target.classList.contains('keyword-chip'));
        if (panelRef.current && !path.includes(panelRef.current) && !clickedKeyword) onClose();
      }}
    >
      <div className="memory-fog-ellipse memory-ellipse" aria-hidden />
      <div className="keyword-field" aria-hidden={false}>
        {words.map((word) => (
          <button
            ref={(node) => {
              wordRefs.current[word.id] = node;
            }}
            type="button"
            className={`keyword-chip ${word.text.length > 10 ? 'keyword-chip--long' : ''} ${word.state === 'leaving' ? 'is-leaving' : 'is-entering'}`}
            key={word.id}
            disabled={Boolean(pendingConfirm)}
            onClick={(event) => submit(word.text, rectOrigin(event.currentTarget.getBoundingClientRect()))}
            style={
              {
              left: `${word.x}%`,
              top: `${word.y}%`,
              '--keyword-scale': word.scale,
              '--keyword-blur': `${word.blur}px`,
              opacity: word.opacity,
              '--drift-x': `${word.driftX}px`,
              '--drift-y': `${word.driftY}px`,
              '--drift-duration': `${word.driftDuration}ms`,
              '--leave-delay': `${word.leaveDelay}ms`,
              '--enter-delay': `${word.enterDelay}ms`,
              animationDelay: word.state === 'leaving' ? `${word.leaveDelay}ms` : `${word.enterDelay}ms`,
              } as React.CSSProperties
            }
          >
            <KeywordText text={word.text} />
          </button>
        ))}
      </div>
      <div className="wake-center" ref={panelRef}>
        <div className="memory-title-stack" aria-live="polite">
          <h1 className="memory-title memory-title--wake" aria-hidden={Boolean(pendingConfirm)}>你还记得哪个地方吗...</h1>
          <h1 className="memory-title memory-title--confirm" aria-hidden={!pendingConfirm}>确定是这里吗？</h1>
        </div>
        <div className="wake-controls">
          <form
            className="memory-input"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder="输入你对过去的回忆" disabled={Boolean(pendingConfirm)} />
            <button aria-label="提交关键词" disabled={Boolean(pendingConfirm)}>→</button>
          </form>
          <button className="refresh-button" onClick={refresh} aria-label="刷新关键词" type="button" disabled={Boolean(pendingConfirm)}>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M20 6v5h-5" />
              <path d="M4 18v-5h5" />
              <path d="M18.1 9A7 7 0 0 0 6.2 6.2L4 8.3" />
              <path d="M5.9 15A7 7 0 0 0 17.8 17.8L20 15.7" />
            </svg>
          </button>
        </div>
        <div className="wake-confirm-preview" aria-hidden={!pendingConfirm}>
          <p className="selected-keyword">{pendingConfirm ? quoteKeyword(pendingConfirm) : ''}</p>
          <div className="confirm-actions">
            <button className="yes-button" onClick={() => pendingConfirm && onConfirm(pendingConfirm)} type="button">
              <img src={UI.wakeNormal} alt="" decoding="async" />
              <span>是的</span>
            </button>
            <button className="think-button" onClick={() => setPendingConfirm(null)} type="button">
              再想想
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KeywordText({ text }: { text: string }) {
  if (text.length <= 10) return <span>{quoteKeyword(text)}</span>;
  return (
    <span>
      “{text.slice(0, 10)}
      <br />
      {text.slice(10)}”
    </span>
  );
}

function quoteKeyword(text: string) {
  const clean = text.trim().replace(/[“”"]/g, '');
  return `“${clean}”`;
}

function shuffleItems<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function pickRange(range: readonly [number, number]) {
  return range[0] + Math.random() * (range[1] - range[0]);
}

function isKeywordSafe(x: number, y: number) {
  const inWakeFocus = x > 24 && x < 76 && y > 32 && y < 82;
  return !inWakeFocus;
}

function layoutKeywords(source: string[], stagger = false): KeywordLayout[] {
  const keywords = shuffleItems(source).slice(0, KEYWORD_SLOTS.length);
  const slots = shuffleItems([...KEYWORD_SLOTS]);
  return keywords.map((text, index) => {
    const slot = slots[index % slots.length];
    let x = pickRange(slot.x);
    let y = pickRange(slot.y);
    for (let attempt = 0; attempt < 8 && !isKeywordSafe(x, y); attempt += 1) {
      x = pickRange(slot.x);
      y = pickRange(slot.y);
    }
    const scale = pickRange(slot.scale);
    const dx = x - 50;
    const dy = y - 50;
    const distanceNorm = clamp(Math.sqrt(dx * dx + dy * dy) / 54, 0, 1);
    const enterDelay = stagger ? Math.round(Math.random() * 760) : 0;
    return {
      id: `${text}-${index}-${Date.now()}-${Math.round(x)}`,
      text,
      x,
      y,
      scale,
      blur: 0.45 + 1.25 * distanceNorm,
      opacity: 0.74 - 0.18 * distanceNorm,
      driftX: (Math.random() > 0.5 ? 1 : -1) * (8 + Math.random() * 10),
      driftY: (Math.random() > 0.5 ? 1 : -1) * (7 + Math.random() * 10),
      driftDuration: 5200 + Math.round(Math.random() * 1800),
      leaveDelay: 0,
      enterDelay,
      state: 'entering',
    };
  });
}

function ConfirmView({ keyword, onBack, onYes }: { keyword: string; origin: KeywordOrigin | null; onBack: () => void; onYes: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const ghostWords = useMemo(() => layoutKeywords(KEYWORDS.slice(0, 18), false), []);
  useScreenIntro(ref, { autoAlpha: 1, y: 0, blur: 0, duration: 0.01 });
  return (
    <div
      className="modal-layer confirm-layer"
      onMouseDown={(event) => {
        if (!event.nativeEvent.composedPath().includes(ref.current as EventTarget)) onBack();
      }}
    >
      <div className="white-mask" />
      <div className="memory-fog-ellipse confirm-fog-ellipse" aria-hidden />
      <div className="confirm-keyword-field" aria-hidden>
        {ghostWords.map((word) => (
          <span
            key={word.id}
            className={`confirm-keyword ${word.text.length > 10 ? 'confirm-keyword--long' : ''}`}
            style={
              {
                left: `${word.x}%`,
                top: `${word.y}%`,
                '--keyword-scale': word.scale,
                '--keyword-blur': `${word.blur + 0.8}px`,
                opacity: Math.min(0.52, word.opacity),
              } as React.CSSProperties
            }
          >
            <KeywordText text={word.text} />
          </span>
        ))}
      </div>
      <div className="confirm-ghost-title">你还记得那个地方吗...</div>
      <div className="confirm-card" ref={ref}>
        <p className="confirm-question">确定是这里吗？</p>
        <p className="selected-keyword">{quoteKeyword(keyword)}</p>
        <div className="confirm-actions">
          <button className="yes-button" onClick={onYes} type="button">
            <img src={UI.wakeNormal} alt="" decoding="async" />
            <span>是的</span>
          </button>
          <button className="think-button" onClick={onBack} type="button">
            再想想
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingView({
  keyword,
  result,
  source,
  onBack,
  onRetry,
  onEdit,
}: {
  keyword: string;
  result: MemoryItem;
  source: MemoryItem;
  onBack: () => void;
  onRetry: (excludeId?: string) => void;
  onEdit: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isResolved, setIsResolved] = useState(false);
  const [restartNonce, setRestartNonce] = useState(0);
  const aspectRatio = useImageAspectRatio(result.src);
  const imageBox = useResultImageBox(aspectRatio);
  const needsPaperBackdrop = isPaperBackdropMemory(result);
  const resultImageSrc = usePaperBackdropImage(result.src, needsPaperBackdrop);
  const tiles = useMemo(
    () =>
      LOADING_MEMORY_TILES.map((tile) => ({
        ...tile,
        src: source.src,
      })),
    [source.src],
  );

  useEffect(() => {
    setIsCompleting(false);
    setIsResolved(false);
    const settleTimer = window.setTimeout(() => setIsCompleting(true), LOADING_TOTAL_MS - LOADING_COMPLETE_CROSSFADE_MS);
    const resolvedTimer = window.setTimeout(() => setIsResolved(true), LOADING_TOTAL_MS);
    return () => {
      window.clearTimeout(settleTimer);
      window.clearTimeout(resolvedTimer);
    };
  }, [restartNonce, result.src]);

  const retry = () => {
    onRetry(result.id);
    setRestartNonce((value) => value + 1);
  };

  return (
    <div
      className={`modal-layer loading-layer ${isCompleting ? 'loading-layer--completing' : ''} ${isResolved ? 'loading-layer--resolved' : ''}`}
      onMouseDown={(event) => {
        if (!event.nativeEvent.composedPath().includes(contentRef.current as EventTarget)) onBack();
      }}
    >
      <div className="memory-fog-ellipse loading-fog-ellipse" aria-hidden />
      <div className="loading-memory-wall" aria-hidden>
        {tiles.map((tile, index) => (
          <img
            key={`${tile.src}-${index}`}
            src={tile.src}
            alt=""
            decoding="async"
            className="loading-memory-tile"
            style={
              {
                left: `${tile.x}%`,
                top: `${tile.y}%`,
                width: `${tile.w}%`,
                transform: `rotate(${tile.r}deg)`,
                filter: `blur(${tile.blur}px) saturate(0.42) contrast(0.76) brightness(0.86)`,
                opacity: tile.opacity,
                animationDelay: `${index * 520}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className="loading-content" ref={contentRef}>
        <h1 className="loading-title">
          <span className="loading-title__search">寻找回忆中...</span>
          <span className="loading-title__resolved">这是你的回忆吗？</span>
        </h1>
        <div
          className={`loading-canvas-shell ${needsPaperBackdrop ? 'loading-canvas-shell--paper-backdrop' : ''}`}
          style={{ '--result-image-aspect': `${aspectRatio.toFixed(5)} / 1`, ...imageBox } as React.CSSProperties}
        >
          <LoadingMorphCanvas source={source.src} target={result.src} aspectRatio={aspectRatio} restartSignal={restartNonce} />
          <img className="loading-resolved-image" src={resultImageSrc} alt={result.title} decoding="async" />
        </div>
        <p className="loading-keyword">
          <KeywordText text={keyword} />
        </p>
        <div className="button-row loading-result-actions">
          <button className="solid-action" onClick={onEdit}>
            应该就是这
          </button>
          <button className="ghost-action" onClick={retry}>
            我还想再找找
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingMorphCanvas({ source, target, aspectRatio, restartSignal }: { source: string; target: string; aspectRatio: number; restartSignal: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointer = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let active = true;
    let paused = document.hidden;
    let frame = 0;
    const onVisibilityChange = () => {
      paused = document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    Promise.all([loadImage(source), loadImage(target)]).then(([fromImage, toImage]) => {
      if (!active) return;
      const tier = performanceTier();
      const dpr = canvasDpr();
      const w = RESULT_IMAGE_CANVAS_WIDTH;
      const h = Math.round(w / aspectRatio);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const particleCount = LOADING_PARTICLES[tier];
      const particles = sampleMorphParticles(fromImage, toImage, w, h, particleCount);
      const start = performance.now();
      const draw = (now: number) => {
        if (paused) {
          if (active) frame = requestAnimationFrame(draw);
          return;
        }
        const elapsed = now - start;
        const totalT = clamp(elapsed / LOADING_TOTAL_MS, 0, 1);
        const revealT = clamp((elapsed - LOADING_FREEFORM_MS) / LOADING_REVEAL_MS, 0, 1);
        const easedReveal = easeInOutCubic(revealT);
        const density = smoothstep(0.01, 0.6, totalT);
        const settle = smoothstep(0.42, 1, revealT);
        const breath = Math.sin(now / 1350) * 1.5;
        ctx.clearRect(0, 0, w, h);

        if (settle > 0) {
          ctx.save();
          ctx.globalAlpha = settle * 0.12;
          ctx.filter = `blur(${8 - settle * 6}px) saturate(0.66) contrast(0.9)`;
          drawImageCover(ctx, toImage, w, h);
          ctx.restore();
        }

        for (const p of particles) {
          if (p.birth > density) continue;
          const visible = clamp((density - p.birth) / 0.18, 0, 1);
          const driftX = Math.sin(now / p.driftSpeed + p.phase) * p.drift;
          const driftY = Math.cos(now / (p.driftSpeed * 1.18) + p.phase) * p.drift * 0.72;
          const freeOrbit = Math.sin(now / p.orbitSpeed + p.phase) * p.orbit;
          const freeX = p.fx + driftX + Math.cos(p.phase + now / 2400) * freeOrbit;
          const freeY = p.fy + driftY + Math.sin(p.phase + now / 2700) * freeOrbit * 0.72 + breath * p.breath;
          const targetT = smoothstep(0, 1, easedReveal);
          const x = lerp(freeX, p.tx, targetT);
          const y = lerp(freeY, p.ty, targetT);
          const dx = x - pointer.current.x;
          const dy = y - pointer.current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const repel = distance < 88 ? (88 - distance) / 88 : 0;
          const offsetX = repel ? (dx / (distance || 1)) * repel * (38 + p.drift) : 0;
          const offsetY = repel ? (dy / (distance || 1)) * repel * (28 + p.drift * 0.8) : 0;
          ctx.globalAlpha = visible * (0.34 + targetT * 0.72) * (1 - repel * 0.48);
          ctx.fillStyle = blendColor(p.fc, p.tc, easedReveal);
          ctx.beginPath();
          ctx.arc(x + offsetX, y + offsetY, p.size * (0.72 + visible * 0.38 + repel * 1.2 - settle * 0.16), 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = 1;
        if (active) frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    });

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      cancelAnimationFrame(frame);
    };
  }, [source, target, aspectRatio, restartSignal]);

  return (
    <canvas
      ref={canvasRef}
      className="loading-canvas"
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        pointer.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      }}
      onPointerLeave={() => {
        pointer.current = { x: -9999, y: -9999 };
      }}
    />
  );
}

function sampleMorphParticles(fromImage: HTMLImageElement, toImage: HTMLImageElement, width: number, height: number, count: number) {
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = width;
  sampleCanvas.height = height;
  const ctx = sampleCanvas.getContext('2d', { willReadFrequently: true })!;
  drawImageCover(ctx, fromImage, width, height);
  const fromData = ctx.getImageData(0, 0, width, height).data;
  ctx.clearRect(0, 0, width, height);
  drawImageCover(ctx, toImage, width, height);
  const toData = ctx.getImageData(0, 0, width, height).data;
  const particles = [];
  for (let i = 0; i < count; i += 1) {
    const tx = Math.random() * width;
    const ty = Math.random() * height;
    const cloudRadiusX = width * (0.12 + Math.random() * 0.42);
    const cloudRadiusY = height * (0.08 + Math.random() * 0.34);
    const angle = Math.random() * Math.PI * 2;
    const cx = width * 0.5 + Math.cos(angle) * cloudRadiusX;
    const cy = height * 0.5 + Math.sin(angle) * cloudRadiusY;
    const fx = width * 0.5 + (Math.random() - 0.5) * width * 0.94;
    const fy = height * 0.5 + (Math.random() - 0.5) * height * 0.72;
    particles.push({
      cx,
      cy,
      fx,
      fy,
      tx,
      ty,
      fc: mixColor(neutralLoadingColor(i), pixelAt(fromData, width, fx, fy), 0.18),
      tc: pixelAt(toData, width, tx, ty),
      size: 0.8 + Math.random() * 2.45,
      birth: Math.pow(Math.random(), 2.15),
      phase: Math.random() * Math.PI * 2,
      drift: 1.2 + Math.random() * 5.8,
      driftSpeed: 780 + Math.random() * 1600,
      orbit: 3 + Math.random() * 16,
      orbitSpeed: 1300 + Math.random() * 2300,
      breath: Math.random() * 1.4,
    });
  }
  return particles;
}

function neutralLoadingColor(index: number): [number, number, number] {
  const palette: [number, number, number][] = [
    [218, 216, 205],
    [188, 186, 176],
    [236, 232, 218],
    [142, 140, 132],
    [102, 100, 94],
  ];
  return palette[index % palette.length];
}

function mixColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))];
}

function pixelAt(data: Uint8ClampedArray, width: number, x: number, y: number) {
  const index = (Math.floor(y) * width + Math.floor(x)) * 4;
  return [data[index] ?? 200, data[index + 1] ?? 200, data[index + 2] ?? 200] as [number, number, number];
}

function blendColor(a: [number, number, number], b: [number, number, number], t: number) {
  return `rgb(${Math.round(lerp(a[0], b[0], t))}, ${Math.round(lerp(a[1], b[1], t))}, ${Math.round(lerp(a[2], b[2], t))})`;
}

function ResultView({
  keyword,
  result,
  onBack,
  onRetry,
  onEdit,
}: {
  keyword: string;
  result: MemoryItem;
  onBack: () => void;
  onRetry: (excludeId?: string) => void;
  onEdit: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const aspectRatio = useImageAspectRatio(result.src);
  const imageBox = useResultImageBox(aspectRatio);
  const needsPaperBackdrop = isPaperBackdropMemory(result);
  const resultImageSrc = usePaperBackdropImage(result.src, needsPaperBackdrop);
  useScreenIntro(ref, { autoAlpha: 0.96, y: 0, blur: 0, duration: 0.28 });
  const moveMask = (event: React.PointerEvent<HTMLDivElement>) => {
    const node = imageRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    node.style.setProperty('--my', `${event.clientY - rect.top}px`);
  };
  return (
    <div
      className="modal-layer result-layer"
      onMouseDown={(event) => {
        if (!event.nativeEvent.composedPath().includes(ref.current as EventTarget)) onBack();
      }}
    >
      <div className="memory-fog-ellipse result-fog-ellipse" aria-hidden />
      <div className="result-card" ref={ref}>
        <h1>这是你的回忆吗？</h1>
        <div
          className={`result-image ${needsPaperBackdrop ? 'result-image--paper-backdrop' : ''}`}
          ref={imageRef}
          onPointerMove={moveMask}
          style={{ '--result-image-aspect': `${aspectRatio.toFixed(5)} / 1`, ...imageBox } as React.CSSProperties}
        >
          <img src={resultImageSrc} alt={result.title} decoding="async" />
          <img className="result-blur-copy" src={resultImageSrc} alt="" aria-hidden decoding="async" loading="lazy" />
          <ResultTextureCanvas aspectRatio={aspectRatio} />
        </div>
        <p className="result-keyword">{keyword}</p>
        <div className="button-row">
          <button className="solid-action" onClick={onEdit}>
            应该就是这
          </button>
          <button className="ghost-action" onClick={() => onRetry(result.id)}>
            我还想再找找
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultTextureCanvas({ aspectRatio }: { aspectRatio: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let active = true;
    let paused = document.hidden;
    let frame = 0;
    const w = RESULT_IMAGE_CANVAS_WIDTH;
    const h = Math.round(w / aspectRatio);
    const dpr = canvasDpr();
    const tier = performanceTier();
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const particles = Array.from({ length: RESULT_TEXTURE_PARTICLES[tier] }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.35 + Math.random() * 1.4,
      a: 0.08 + Math.random() * 0.18,
      phase: Math.random() * Math.PI * 2,
      drift: 0.2 + Math.random() * 0.7,
    }));
    const onVisibilityChange = () => {
      paused = document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    const draw = (now: number) => {
      if (paused) {
        if (active) frame = requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        const breathe = Math.sin(now / 1200 + p.phase) * p.drift;
        ctx.globalAlpha = p.a;
        ctx.fillStyle = Math.random() > 0.1 ? 'rgba(42,38,34,0.65)' : 'rgba(160,22,18,0.45)';
        ctx.beginPath();
        ctx.arc(p.x + breathe, p.y - breathe * 0.6, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (active) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      cancelAnimationFrame(frame);
    };
  }, [aspectRatio]);

  return <canvas className="result-texture" ref={canvasRef} aria-hidden />;
}

function EditorView({
  keyword,
  result,
  onSave,
  onBack,
  returningHome,
}: {
  keyword: string;
  result: MemoryItem;
  onSave: (note: string, signature: string, drawingDataUrl: string, editParams: EditParams, editedSrc?: string) => void;
  onBack: () => void;
  returningHome: boolean;
}) {
  const [params, setParams] = useState<EditParams>({ fade: 0, dream: 0, worn: 0 });
  const [note, setNote] = useState('');
  const [signature, setSignature] = useState('');
  const [finishing, setFinishing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const editorImageRef = useRef<HTMLDivElement>(null);
  const glitchCanvasRef = useRef<HTMLCanvasElement>(null);
  const aspectRatio = useImageAspectRatio(result.src);
  const imageBox = useResultImageBox(aspectRatio);
  const processedImageSrc = usePaperBackdropImage(result.src, isPaperBackdropMemory(result));
  useScreenIntro(ref, { autoAlpha: 1, y: 0, blur: 0, duration: 0.01 });

  const update = (key: keyof EditParams, value: number) => setParams((current) => ({ ...current, [key]: value }));
  const moveImageMask = (event: React.PointerEvent<HTMLDivElement>) => {
    const node = editorImageRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    node.style.setProperty('--my', `${event.clientY - rect.top}px`);
  };

  const finish = () => {
    if (finishing) return;
    setFinishing(true);
    onSave(note, signature, '', params, canvasDataUrl(glitchCanvasRef.current));
  };

  return (
    <div
      className={`modal-layer editor-layer ${returningHome ? 'editor-layer--returning-home' : ''}`}
      onMouseDown={(event) => {
        if (finishing) return;
        if (!event.nativeEvent.composedPath().includes(ref.current as EventTarget)) onBack();
      }}
    >
      <div className={`editor-board ${finishing ? 'editor-board--finishing' : ''}`} ref={ref}>
        <div className="sliders">
          <MemorySlider label="vivid 清晰" endLabel="fade 淡忘" value={params.fade} onChange={(value) => update('fade', value)} />
          <MemorySlider label="real 现实" endLabel="dream 想象" value={params.dream} onChange={(value) => update('dream', value)} />
          <MemorySlider label="new 崭新" endLabel="worn 陈旧" value={params.worn} onChange={(value) => update('worn', value)} />
        </div>
        <div className="editor-image" ref={editorImageRef} onPointerMove={moveImageMask}>
          <h1>试着回想...</h1>
          <GlitchImage src={processedImageSrc} params={params} canvasRef={glitchCanvasRef} imageBox={imageBox} />
          <p className="editor-keyword">
            <KeywordText text={keyword} />
          </p>
          <button className="finish-button" onClick={finish} disabled={finishing}>
            就是这里
          </button>
        </div>
        <div className="paper-card editor-paper">
          <img src={UI.paper} alt="" decoding="async" loading="lazy" />
          <div className="editor-paper-content">
            <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="写下当时的感受，或者这个地方还留给你的声音..." />
            <input value={signature} onChange={(event) => setSignature(event.target.value)} placeholder="署名，可不填" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MemorySlider({
  label,
  endLabel,
  value,
  onChange,
}: {
  label: string;
  endLabel: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const updateFromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    onChange(clamp((clientX - rect.left) / rect.width, 0, 1));
  };

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event.clientX);
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    updateFromPointer(event.clientX);
  };

  const keyAdjust = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') onChange(clamp(value - 0.05, 0, 1));
    if (event.key === 'ArrowRight') onChange(clamp(value + 0.05, 0, 1));
  };

  return (
    <div className="memory-slider">
      <span>{label}</span>
      <div
        className="custom-slider"
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onKeyDown={keyAdjust}
      >
        <div className="custom-slider-fill" style={{ transform: `scaleX(${value})` }} />
        <div
          className="custom-slider-thumb"
          style={{
            left: `calc(4px + ${value * 100}% - ${value * 8}px)`,
            filter: `blur(${value * 3.2}px)`,
            opacity: 1 - value * 0.4,
          }}
        />
      </div>
      <span>{endLabel}</span>
    </div>
  );
}

function GlitchImage({
  src,
  params,
  canvasRef,
  imageBox,
}: {
  src: string;
  params: EditParams;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  imageBox?: { width: string; height: string };
}) {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const targetCanvasRef = canvasRef ?? internalCanvasRef;

  useEffect(() => {
    let active = true;
    loadImage(src).then((image) => {
      const canvas = targetCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || !active) return;
      const naturalRatio = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : DEFAULT_PHOTO_ASPECT_RATIO;
      const maxW = imageBox?.width ? Number.parseFloat(imageBox.width) : 520;
      const maxH = imageBox?.height ? Number.parseFloat(imageBox.height) : 350;
      const maxRatio = maxW / maxH;
      const w = naturalRatio >= maxRatio ? maxW : Math.round(maxH * naturalRatio);
      const h = naturalRatio >= maxRatio ? Math.round(maxW / naturalRatio) : maxH;
      const dpr = canvasDpr();
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const baseCanvas = document.createElement('canvas');
      baseCanvas.width = w;
      baseCanvas.height = h;
      const baseCtx = baseCanvas.getContext('2d');
      if (!baseCtx) return;
      baseCtx.filter = `blur(${params.fade * 6}px) saturate(${1 - params.dream * 0.28}) contrast(${1 + params.dream * 0.18}) hue-rotate(${params.dream * 24}deg)`;
      baseCtx.drawImage(image, 0, 0, w, h);

      ctx.clearRect(0, 0, w, h);
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(baseCanvas, 0, 0, w, h);
      drawWornGlitch(ctx, baseCanvas, w, h, params.worn, `${src}:${Math.round(params.worn * 100)}`);
    });
    return () => {
      active = false;
    };
  }, [src, params, targetCanvasRef, imageBox?.height, imageBox?.width]);

  return <canvas className="glitch-canvas" ref={targetCanvasRef} />;
}

function canvasDataUrl(canvas: HTMLCanvasElement | null) {
  if (!canvas || !canvas.width || !canvas.height) return undefined;
  try {
    return canvas.toDataURL('image/webp', 0.92);
  } catch {
    try {
      return canvas.toDataURL('image/png');
    } catch {
      return undefined;
    }
  }
}

function drawWornGlitch(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, width: number, height: number, worn: number, seedKey: string) {
  if (worn <= 0.03) return;
  const intensity = smoothstep(0.03, 1, worn);
  const rand = seededRandomStream(hashString(seedKey));
  const sliceCount = Math.round(5 + intensity * 32);
  const maxShift = 8 + intensity * 58;

  for (let i = 0; i < sliceCount; i += 1) {
    const y = Math.floor(rand() * height);
    const sliceHeight = Math.max(2, Math.floor(2 + rand() * (6 + intensity * 18)));
    const shift = (rand() < 0.5 ? -1 : 1) * (3 + rand() * maxShift);
    const sourceX = rand() * intensity * 10;
    ctx.globalAlpha = 0.28 + intensity * 0.42;
    ctx.drawImage(source, sourceX, y, width - sourceX, sliceHeight, shift, y, width - sourceX, sliceHeight);

    if (rand() > 0.68) {
      ctx.globalAlpha = 0.06 + intensity * 0.14;
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.72)' : 'rgba(18,18,18,0.78)';
      ctx.fillRect(0, y + rand() * sliceHeight, width, 1);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  const corruptBlocks = Math.round(4 + intensity * 18);
  for (let i = 0; i < corruptBlocks; i += 1) {
    const blockWidth = Math.floor(width * (0.08 + rand() * (0.24 + intensity * 0.3)));
    const blockHeight = Math.floor(2 + rand() * (5 + intensity * 14));
    const sourceX = Math.floor(rand() * Math.max(1, width - blockWidth));
    const sourceY = Math.floor(rand() * Math.max(1, height - blockHeight));
    const targetX = Math.floor(rand() * Math.max(1, width - blockWidth));
    const targetY = Math.floor(rand() * Math.max(1, height - blockHeight));
    const shift = (rand() - 0.5) * maxShift * 1.4;
    ctx.globalAlpha = 0.18 + intensity * 0.34;
    ctx.drawImage(source, sourceX, sourceY, blockWidth, blockHeight, targetX + shift, targetY, blockWidth, blockHeight);
  }

  const rgbPasses = Math.round(2 + intensity * 6);
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < rgbPasses; i += 1) {
    const y = Math.floor(rand() * height);
    const sliceHeight = Math.floor(3 + rand() * (8 + intensity * 14));
    const shift = (rand() < 0.5 ? -1 : 1) * (2 + intensity * 12);
    ctx.globalAlpha = 0.035 + intensity * 0.065;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,42,78,0.9)' : 'rgba(46,255,218,0.85)';
    ctx.fillRect(shift, y, width, sliceHeight);
  }
  ctx.globalCompositeOperation = 'source-over';

  const scanLines = Math.round(8 + intensity * 24);
  for (let i = 0; i < scanLines; i += 1) {
    const y = Math.floor(rand() * height);
    ctx.globalAlpha = 0.025 + rand() * intensity * 0.075;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.74)' : 'rgba(0,0,0,0.66)';
    ctx.fillRect(rand() * width * 0.08, y, width * (0.35 + rand() * 0.65), 1);
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function seededRandomStream(seed: number) {
  let value = seed || 1;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function DetailDustCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const w = 520;
    const h = 390;
    const dpr = canvasDpr();
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const particles = Array.from({ length: 130 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.24,
      vy: -0.08 - Math.random() * 0.18,
      r: 0.6 + Math.random() * 1.8,
      a: 0.1 + Math.random() * 0.32,
    }));
    let active = true;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) p.y = h + 10;
        ctx.fillStyle = `rgba(255, 255, 255, ${p.a * 0.72})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      if (active) requestAnimationFrame(draw);
    };
    draw();
    return () => {
      active = false;
    };
  }, []);

  return <canvas className="detail-dust" ref={canvasRef} />;
}

function useScreenIntro(
  ref: React.RefObject<HTMLElement | null>,
  options: { autoAlpha?: number; y?: number; blur?: number; duration?: number } = {},
) {
  useEffect(() => {
    if (!ref.current) return;
    const shouldMove = options.y !== 0;
    const fromVars = { autoAlpha: options.autoAlpha ?? 0, filter: `blur(${options.blur ?? 8}px)` };
    const toVars = { autoAlpha: 1, filter: 'blur(0px)', duration: options.duration ?? 0.65, ease: 'power3.out' };
    if (shouldMove) {
      Object.assign(fromVars, { y: options.y ?? 16 });
      Object.assign(toVars, { y: 0 });
    }
    const tween = gsap.fromTo(ref.current, fromVars, toVars);
    return () => {
      tween.kill();
    };
  }, [options.autoAlpha, options.blur, options.duration, options.y, ref]);
}

function useImageAspectRatio(src: string, fallback = DEFAULT_PHOTO_ASPECT_RATIO) {
  const [aspectRatio, setAspectRatio] = useState(fallback);

  useEffect(() => {
    let alive = true;
    const image = new Image();
    image.onload = () => {
      if (!alive || !image.naturalWidth || !image.naturalHeight) return;
      setAspectRatio(image.naturalWidth / image.naturalHeight);
    };
    image.src = src;
    return () => {
      alive = false;
    };
  }, [fallback, src]);

  return aspectRatio;
}

function usePaperBackdropImage(src: string, enabled: boolean) {
  const [processedSrc, setProcessedSrc] = useState(src);

  useEffect(() => {
    let active = true;
    setProcessedSrc(src);
    if (!enabled) return () => {
      active = false;
    };

    loadImage(src)
      .then((image) => paperBackdropDataUrl(image, src))
      .then((dataUrl) => {
        if (active) setProcessedSrc(dataUrl);
      })
      .catch(() => {
        if (active) setProcessedSrc(src);
      });

    return () => {
      active = false;
    };
  }, [enabled, src]);

  return processedSrc;
}

function paperBackdropDataUrl(image: HTMLImageElement, seedKey: string) {
  const naturalWidth = image.naturalWidth || image.width || RESULT_IMAGE_CANVAS_WIDTH;
  const naturalHeight = image.naturalHeight || image.height || Math.round(RESULT_IMAGE_CANVAS_WIDTH / DEFAULT_PHOTO_ASPECT_RATIO);
  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return image.src;
  ctx.drawImage(image, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const seed = hashString(seedKey);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const r = data[index] ?? 255;
      const g = data[index + 1] ?? 255;
      const b = data[index + 2] ?? 255;
      const a = data[index + 3] ?? 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
      const chroma = max - min;
      const paleStrength = smoothstep(176, 238, luma) * (1 - smoothstep(18, 74, chroma));
      const alphaStrength = 1 - a / 255;
      const strength = clamp(Math.max(paleStrength, alphaStrength), 0, 1);
      if (strength <= 0.015) continue;

      const paper = paperPixel(x, y, width, height, seed);
      data[index] = Math.round(lerp(r, paper[0], strength));
      data[index + 1] = Math.round(lerp(g, paper[1], strength));
      data[index + 2] = Math.round(lerp(b, paper[2], strength));
      data[index + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  try {
    return canvas.toDataURL('image/webp', 0.92);
  } catch {
    return canvas.toDataURL('image/png');
  }
}

function paperPixel(x: number, y: number, width: number, height: number, seed: number): [number, number, number] {
  const fine = seededPaperNoise(x, y, seed);
  const coarse = seededPaperNoise(Math.floor(x / 7), Math.floor(y / 7), seed + 97);
  const fiber = Math.sin((x + seed % 37) * 0.085) * 2.4 + Math.sin((y + seed % 53) * 0.047) * 3.2;
  const dx = x / width - 0.5;
  const dy = y / height - 0.5;
  const vignette = clamp(Math.sqrt(dx * dx + dy * dy) * 1.15, 0, 1);
  const tone = (fine - 0.5) * 30 + (coarse - 0.5) * 16 + fiber - vignette * 12;
  const speckle = fine > 0.986 ? -32 : coarse > 0.982 ? 22 : 0;
  return [
    clamp(Math.round(229 + tone + speckle), 184, 246),
    clamp(Math.round(228 + tone * 0.94 + speckle), 184, 246),
    clamp(Math.round(219 + tone * 0.82 + speckle * 0.72), 176, 242),
  ];
}

function seededPaperNoise(x: number, y: number, seed: number) {
  const value = Math.sin((x * 127.1 + y * 311.7 + seed * 0.013) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function useResultImageBox(aspectRatio: number) {
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth || 1440, height: window.innerHeight || 900 }));

  useEffect(() => {
    const update = () => setViewport({ width: window.innerWidth || 1440, height: window.innerHeight || 900 });
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return useMemo(() => {
    const safeAspectRatio = aspectRatio > 0 ? aspectRatio : DEFAULT_PHOTO_ASPECT_RATIO;
    const preferredWidth = clamp(viewport.width * 0.38, 300, 480);
    const maxWidth = Math.min(preferredWidth, viewport.width * 0.82);
    const maxHeight = Math.min(viewport.height * 0.46, 430);
    let width = maxWidth;
    let height = width / safeAspectRatio;

    if (height > maxHeight) {
      height = maxHeight;
      width = height * safeAspectRatio;
    }

    return {
      width: `${Math.round(width)}px`,
      height: `${Math.round(height)}px`,
    };
  }, [aspectRatio, viewport.height, viewport.width]);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawImageCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  const imageAspect = imageWidth / imageHeight;
  const targetAspect = width / height;
  let sx = 0;
  let sy = 0;
  let sw = imageWidth;
  let sh = imageHeight;

  if (imageAspect > targetAspect) {
    sw = imageHeight * targetAspect;
    sx = (imageWidth - sw) / 2;
  } else {
    sh = imageWidth / targetAspect;
    sy = (imageHeight - sh) / 2;
  }

  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default App;
