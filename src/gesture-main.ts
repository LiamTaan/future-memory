import './gesture.css';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

type MemoryItem = {
  id: string;
  src: string;
  title: string;
  memory?: string;
  author?: string;
  date?: string;
};

type AssetManifest = {
  modern?: string[];
  oldCity?: string[];
};

type Landmark = {
  x: number;
  y: number;
  z?: number;
};

type ModernTile = {
  id: string;
  src: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  width: number;
  height: number;
  rotation: number;
  cropX: number;
  cropY: number;
  zoom: number;
  cropShape: string;
  phase: number;
  node: HTMLDivElement;
};

type CropPreset = {
  widthRatio: number;
  minWidth: number;
  maxWidth: number;
  heightRatio: number;
  x: number;
  y: number;
  zoom: number;
  shape: string;
};

type PastPhoto = {
  id: string;
  src: string;
  title: string;
  memory: string;
  author: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  node: HTMLDivElement;
  state: 'dragging' | 'placed' | 'fading';
  createdAt: number;
  placedAt: number;
  expiresAt: number;
  sourceIndex: number;
};

type HandState = {
  active: boolean;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  pinch: number;
  pinchDown: boolean;
  wasPinching: boolean;
  confidence: number;
};

type HandLandmarkerInstance = Awaited<ReturnType<typeof HandLandmarker.createFromOptions>>;

const PHOTO_LIFETIME_MS = 20_000;
const PHOTO_FADE_MS = 1_100;
const PICK_COOLDOWN_MS = 1_200;
const PINCH_RELEASE_THRESHOLD = 0.42;

const gestureRoot = document.querySelector<HTMLElement>('#gesture-root');
if (!gestureRoot) throw new Error('Missing gesture root');
const root: HTMLElement = gestureRoot;

const state = {
  modernTiles: [] as ModernTile[],
  pastPhotos: [] as PastPhoto[],
  memories: [] as MemoryItem[],
  memoryQueue: [] as MemoryItem[],
  modernSources: [] as string[],
  runningCamera: false,
  handReady: false,
  activePhoto: null as PastPhoto | null,
  nextMemoryIndex: 0,
  pinchArmed: true,
  lastMemorySrc: '',
  mouseX: window.innerWidth * 0.5,
  mouseY: window.innerHeight * 0.5,
  lastNow: performance.now(),
  selectCooldownUntil: 0,
  cameraStream: null as MediaStream | null,
};

const hand: HandState = {
  active: false,
  x: window.innerWidth * 0.5,
  y: window.innerHeight * 0.5,
  targetX: window.innerWidth * 0.5,
  targetY: window.innerHeight * 0.5,
  pinch: 0,
  pinchDown: false,
  wasPinching: false,
  confidence: 0,
};

root.innerHTML = `
  <section class="gesture-page">
    <div class="gesture-camera-fallback" aria-hidden="true"></div>
    <video class="gesture-camera" data-video playsinline muted></video>
    <div class="gesture-camera-wash" aria-hidden="true"></div>
    <div class="gesture-data-flow" aria-hidden="true"><span></span><span></span><span></span></div>
    <div class="gesture-location-data" aria-hidden="true">
      <span class="gesture-map-title">Memory Map / Shenzhen Archive</span>
      <span class="gesture-map-node gesture-map-node--nostalgia">南头古城</span>
      <span class="gesture-map-node gesture-map-node--storage">华强北</span>
      <span class="gesture-map-node gesture-map-node--forgetting">岗厦</span>
      <span class="gesture-map-node gesture-map-node--media">蛇口码头</span>
      <span class="gesture-map-node gesture-map-node--glitch">盐田港</span>
      <span class="gesture-data-fragment gesture-data-fragment--one">N22.5431 E114.0579 / 1999-06-10 / lost_packet_0x7A3F</span>
      <span class="gesture-data-fragment gesture-data-fragment--two">010101 MEMORY_FADE / CRC_ERR / archive://sz/old-city</span>
      <span class="gesture-data-fragment gesture-data-fragment--three">乱码 M4A#7F / 大梅沙 / scanline / frame_20s / null</span>
    </div>
    <div class="gesture-modern-flow" data-modern-flow aria-hidden="true"></div>
    <div class="gesture-past-layer" data-past-layer></div>
    <canvas class="gesture-hand-canvas" data-hand-canvas></canvas>
    <span class="gesture-status" data-status aria-live="polite"></span>
  </section>
`;

const modernFlow = root.querySelector<HTMLElement>('[data-modern-flow]')!;
const pastLayer = root.querySelector<HTMLElement>('[data-past-layer]')!;
const video = root.querySelector<HTMLVideoElement>('[data-video]')!;
const handCanvas = root.querySelector<HTMLCanvasElement>('[data-hand-canvas]')!;
const handCtx = handCanvas.getContext('2d')!;
const statusNode = root.querySelector<HTMLElement>('[data-status]')!;

void boot();

async function boot() {
  const [memories, assets] = await Promise.all([loadMemories(), loadAssets()]);
  state.memories = buildPastMemories(memories, assets.oldCity || []);
  state.memoryQueue = shuffled(state.memories);
  console.info(`[gesture] old-city pick pool: ${state.memories.length} photos`);
  state.modernSources = buildModernSources(assets.modern || []);
  await createModernTiles(state.modernSources);
  bindPointerPreview();
  window.addEventListener('resize', resizeHandCanvas);
  resizeHandCanvas();
  void startCameraGesture();
  requestAnimationFrame(tick);
}

async function loadMemories() {
  try {
    const response = await fetch('/data/memories.json');
    const items = (await response.json()) as MemoryItem[];
    return items.filter((item) => item.src);
  } catch {
    return [
      {
        id: 'fallback-1',
        src: '/assets/old-city/memory-01.webp',
        title: '旧照片',
        memory: '一张从旧城照片里取出的过去照片。',
        author: 'system',
      },
    ];
  }
}

async function loadAssets() {
  try {
    const response = await fetch('/data/assets.json');
    return (await response.json()) as AssetManifest;
  } catch {
    return {
      modern: [
        '/assets/new-city/25cd8e17-4eff-4db8-a83c-9e9f1a6cc820.webp',
        '/assets/new-city/7cfa6337-dfd2-429f-be06-ae37f2dce37f.webp',
      ],
      oldCity: ['/assets/old-city/memory-01.webp'],
    };
  }
}

function buildPastMemories(memories: MemoryItem[], oldCitySources: string[]) {
  const memoryBySrc = new Map(memories.map((item) => [item.src, item]));
  const sources = uniqueStrings(oldCitySources);

  return sources.map((src, index) => {
    const matched = memoryBySrc.get(src);
    return {
      id: matched?.id || `old-city-${index}`,
      src,
      title: matched?.title || `过去照片 ${index + 1}`,
      memory: matched?.memory || '从旧城照片里取出的一段过去影像。',
      author: matched?.author || 'old-city',
      date: matched?.date,
    };
  });
}

function buildModernSources(sources: string[]) {
  if (sources.length) return sources;
  return [
    '/assets/new-city/25cd8e17-4eff-4db8-a83c-9e9f1a6cc820.webp',
    '/assets/new-city/7cfa6337-dfd2-429f-be06-ae37f2dce37f.webp',
  ];
}

async function createModernTiles(sources: string[]) {
  const count = Math.min(11, Math.max(7, sources.length));
  const sourceAspects = await Promise.all(sources.map((src) => getImageAspect(src)));
  const lanes = [0.18, 0.33, 0.5, 0.67, 0.82];
  const spacing = Math.max(360, window.innerWidth / 3.2);
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < count; i += 1) {
    const src = sources[i % sources.length];
    const sourceAspect = sourceAspects[i % sourceAspects.length] || 1;
    const node = document.createElement('div');
    node.className = 'gesture-modern-photo';
    node.innerHTML = `<img src="${src}" alt="" decoding="async" loading="${i < 8 ? 'eager' : 'lazy'}" />`;
    fragment.appendChild(node);

    const lane = i % lanes.length;
    const z = 0.38 + (i % 4) * 0.16;
    const crop = pickModernCropPreset(sourceAspect, i);
    const width = clamp(window.innerWidth * crop.widthRatio, crop.minWidth, crop.maxWidth);
    const height = clamp(window.innerHeight * crop.heightRatio, width * 0.3, width * 1.55);
    const cropX = (crop.x + ((i * 7) % 9) - 4 + 100) % 100;
    const cropY = (crop.y + ((i * 11) % 9) - 4 + 100) % 100;
    const zoom = crop.zoom;
    state.modernTiles.push({
      id: `modern-${i}`,
      src,
      x: i * spacing - 320,
      y: window.innerHeight * lanes[lane] + ((i % 2) ? 34 : -24),
      z,
      vx: 42 + (i % 3) * 9,
      width,
      height,
      rotation: ((i % 3) - 1) * 0.25,
      cropX,
      cropY,
      zoom,
      cropShape: crop.shape,
      phase: (i * 1.17) % (Math.PI * 2),
      node,
    });
  }

  modernFlow.appendChild(fragment);
}

const modernCropPresets = [
  { widthRatio: 0.16, minWidth: 150, maxWidth: 260, heightRatio: 0.34, x: 26, y: 44, zoom: 1.85, shape: 'inset(0 0 0 0)' },
  { widthRatio: 0.13, minWidth: 130, maxWidth: 220, heightRatio: 0.42, x: 54, y: 38, zoom: 2.15, shape: 'polygon(4% 0, 100% 0, 96% 100%, 0 100%)' },
  { widthRatio: 0.18, minWidth: 160, maxWidth: 280, heightRatio: 0.3, x: 76, y: 56, zoom: 2.35, shape: 'inset(0 0 0 0)' },
];

const modernWideCropPresets: CropPreset[] = [
  { widthRatio: 0.11, minWidth: 115, maxWidth: 190, heightRatio: 0.42, x: 22, y: 48, zoom: 2.2, shape: 'inset(0 0 0 0)' },
  { widthRatio: 0.13, minWidth: 130, maxWidth: 220, heightRatio: 0.5, x: 48, y: 42, zoom: 2.45, shape: 'polygon(4% 0, 100% 0, 96% 100%, 0 100%)' },
  { widthRatio: 0.1, minWidth: 105, maxWidth: 175, heightRatio: 0.36, x: 72, y: 58, zoom: 2.65, shape: 'inset(0 0 0 0)' },
];

const modernTallCropPresets: CropPreset[] = [
  { widthRatio: 0.3, minWidth: 280, maxWidth: 500, heightRatio: 0.12, x: 48, y: 18, zoom: 2.1, shape: 'inset(0 0 0 0)' },
  { widthRatio: 0.34, minWidth: 300, maxWidth: 560, heightRatio: 0.15, x: 52, y: 46, zoom: 2.35, shape: 'inset(0 0 0 0)' },
  { widthRatio: 0.26, minWidth: 240, maxWidth: 440, heightRatio: 0.11, x: 42, y: 76, zoom: 2.55, shape: 'polygon(0 0, 100% 0, 98% 100%, 2% 100%)' },
];

function pickModernCropPreset(sourceAspect: number, index: number) {
  const presets = sourceAspect >= 1.12
    ? modernWideCropPresets
    : sourceAspect <= 0.9
      ? modernTallCropPresets
      : modernCropPresets;
  return presets[index % presets.length];
}

function getImageAspect(src: string) {
  return new Promise<number>((resolve) => {
    const image = new Image();
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        resolve(1);
        return;
      }
      resolve(image.naturalWidth / image.naturalHeight);
    };
    image.onerror = () => resolve(1);
    image.src = src;
  });
}

function bindPointerPreview() {
  window.addEventListener('pointermove', (event) => {
    state.mouseX = event.clientX;
    state.mouseY = event.clientY;
    if (!state.runningCamera) {
      hand.active = true;
      hand.targetX = event.clientX;
      hand.targetY = event.clientY;
      hand.confidence = 0.72;
      hand.pinchDown = event.buttons === 1;
      hand.pinch = event.buttons === 1 ? 1 : 0;
    }
  }, { passive: true });

  window.addEventListener('pointerdown', () => {
    if (!state.runningCamera) {
      hand.pinchDown = true;
      hand.pinch = 1;
    }
  });

  window.addEventListener('pointerup', () => {
    if (!state.runningCamera) {
      hand.pinchDown = false;
      hand.pinch = 0;
    }
  });
}

async function startCameraGesture() {
  if (state.runningCamera) return;
  statusNode.textContent = '加载手势模型';

  if (!navigator.mediaDevices?.getUserMedia) {
    statusNode.textContent = '浏览器不支持摄像头';
    return;
  }

  let stream: MediaStream | null = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    state.cameraStream = stream;
    video.srcObject = stream;
    await video.play();

    statusNode.textContent = '初始化手势识别';
    const landmarker = await createHandLandmarker();

    state.runningCamera = true;
    state.handReady = true;
    root.classList.add('gesture-camera-active');
    statusNode.textContent = '合拢双指抓取过去照片';
    detectHands(landmarker);
  } catch (error) {
    console.warn(error);
    stopCameraStream(stream);
    state.cameraStream = null;
    statusNode.textContent = cameraErrorMessage(error);
  }
}

async function createHandLandmarker() {
  const wasm = await FilesetResolver.forVisionTasks('/vendor/mediapipe/wasm');
  const baseOptions = {
    modelAssetPath: '/vendor/mediapipe/hand_landmarker.task',
  };

  try {
    return await HandLandmarker.createFromOptions(wasm, {
      baseOptions: { ...baseOptions, delegate: 'GPU' },
      ...handLandmarkerOptions,
    });
  } catch (error) {
    console.warn('GPU hand landmarker failed, falling back to CPU.', error);
    return HandLandmarker.createFromOptions(wasm, {
      baseOptions,
      ...handLandmarkerOptions,
    });
  }
}

const handLandmarkerOptions = {
  runningMode: 'VIDEO' as const,
  numHands: 1,
  minHandDetectionConfidence: 0.45,
  minHandPresenceConfidence: 0.45,
  minTrackingConfidence: 0.45,
};

function stopCameraStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
  if (video.srcObject === stream) video.srcObject = null;
}

function cameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return '摄像头权限被拒绝';
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return '没有可用摄像头';
    if (error.name === 'NotReadableError') return '摄像头被占用';
  }

  return '手势模型加载失败';
}

function detectHands(landmarker: HandLandmarkerInstance) {
  let lastVideoTime = -1;

  const run = () => {
    if (!state.runningCamera || !video.videoWidth) {
      requestAnimationFrame(run);
      return;
    }

    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const result = landmarker.detectForVideo(video, performance.now());
      updateHandFromLandmarks(result.landmarks?.[0]);
    }

    requestAnimationFrame(run);
  };

  requestAnimationFrame(run);
}

function updateHandFromLandmarks(landmarks?: Landmark[]) {
  if (!landmarks?.length) {
    hand.confidence *= 0.9;
    hand.active = hand.confidence > 0.08;
    statusNode.textContent = '等待手势';
    return;
  }

  const indexTip = landmarks[8];
  const thumbTip = landmarks[4];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];
  const wrist = landmarks[0];
  const points = [indexTip, thumbTip, middleTip, ringTip, pinkyTip, wrist].filter(Boolean) as Landmark[];
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const centerX = (indexTip.x + thumbTip.x) * 0.5;
  const centerY = (indexTip.y + thumbTip.y) * 0.5;
  const pinchDistance = distance(indexTip, thumbTip);
  const palmSpread = Math.max(distance(indexTip, pinkyTip), distance(middleTip, wrist), maxX - minX, maxY - minY);
  const mirroredX = 1 - centerX;

  hand.active = true;
  hand.targetX = mirroredX * window.innerWidth;
  hand.targetY = centerY * window.innerHeight;
  hand.pinch = clamp(1 - pinchDistance / Math.max(0.06, palmSpread * 0.72), 0, 1);
  hand.pinchDown = hand.pinch > 0.66;
  hand.confidence = lerp(hand.confidence, 1, 0.22);
  statusNode.textContent = hand.pinchDown ? '移动照片，松开双指放置' : '合拢双指抓取过去照片';
}

function tick(now: number) {
  const dt = Math.min((now - state.lastNow) / 1000, 0.034);
  state.lastNow = now;

  hand.x = lerp(hand.x, hand.targetX, state.runningCamera ? 0.24 : 0.2);
  hand.y = lerp(hand.y, hand.targetY, state.runningCamera ? 0.24 : 0.2);

  moveModernTiles(dt, now);
  updatePinchState(now);
  updatePastPhotos(now);
  drawHandLayer(now);

  requestAnimationFrame(tick);
}

function moveModernTiles(dt: number, now: number) {
  for (const tile of state.modernTiles) {
    const drift = Math.sin(now * 0.001 + tile.phase) * 11;
    tile.x += tile.vx * dt;
    tile.y += Math.sin(now * 0.0008 + tile.phase) * dt * 7;

    if (tile.x - tile.width * 0.5 > window.innerWidth + 180) {
      tile.x = -tile.width - 280 - Math.random() * 180;
      tile.y = clamp(tile.y + Math.sin(now * 0.0007 + tile.phase) * 26, window.innerHeight * 0.14, window.innerHeight * 0.86);
    }

    const scale = lerp(0.88, 1.1, tile.z);
    const blur = lerp(0.82, 0.08, tile.z);
    const opacity = lerp(0.68, 0.92, tile.z);
    tile.node.style.width = `${tile.width}px`;
    tile.node.style.height = `${tile.height}px`;
    tile.node.style.opacity = `${opacity}`;
    tile.node.style.zIndex = `${Math.round(tile.z * 80)}`;
    tile.node.style.filter = `blur(${blur}px) saturate(0.96) contrast(1.02) brightness(1.04)`;
    tile.node.style.setProperty('--crop-x', `${tile.cropX}%`);
    tile.node.style.setProperty('--crop-y', `${tile.cropY}%`);
    tile.node.style.setProperty('--image-zoom', `${tile.zoom}`);
    tile.node.style.setProperty('--crop-shape', tile.cropShape);
    tile.node.style.transform = `translate3d(${tile.x}px, ${tile.y + drift}px, 0) translate(-50%, -50%) scale(${scale}) rotate(${tile.rotation}deg)`;
  }
}

function updatePinchState(now: number) {
  const justPinched = hand.pinchDown && !hand.wasPinching;
  const justReleased = !hand.pinchDown && hand.wasPinching;

  if (!hand.pinchDown && hand.pinch < PINCH_RELEASE_THRESHOLD) {
    state.pinchArmed = true;
  }

  if (justPinched && state.pinchArmed && !state.activePhoto && hand.active && now > state.selectCooldownUntil) {
    state.pinchArmed = false;
    grabNewPastPhoto(now);
    state.selectCooldownUntil = now + PICK_COOLDOWN_MS;
  }

  if (justReleased && state.activePhoto) {
    placeActivePhoto(now);
  }

  hand.wasPinching = hand.pinchDown;
}

function grabNewPastPhoto(now: number) {
  if (!state.memories.length) return;

  const memory = takeNextMemory();
  const sourceIndex = state.nextMemoryIndex;
  state.nextMemoryIndex += 1;

  const width = clamp(window.innerWidth * 0.24, 180, 340);
  const photo: PastPhoto = {
    id: `past-${memory.id}-${now.toFixed(0)}`,
    src: memory.src,
    title: memory.title,
    memory: memory.memory || '',
    author: memory.author || '',
    x: hand.x,
    y: hand.y,
    width,
    height: width / 1.42,
    rotation: lerp(-3.5, 3.5, (sourceIndex % 7) / 6),
    node: document.createElement('div'),
    state: 'dragging',
    createdAt: now,
    placedAt: Number.POSITIVE_INFINITY,
    expiresAt: Number.POSITIVE_INFINITY,
    sourceIndex,
  };

  photo.node.className = 'gesture-past-photo gesture-past-photo--dragging';
  photo.node.innerHTML = `<img src="${photo.src}" alt="${escapeHtml(photo.title)}" decoding="async" />`;
  pastLayer.appendChild(photo.node);
  state.pastPhotos.push(photo);
  state.activePhoto = photo;
}

function placeActivePhoto(now: number) {
  const photo = state.activePhoto;
  if (!photo) return;

  photo.state = 'placed';
  photo.placedAt = now;
  photo.expiresAt = now + PHOTO_LIFETIME_MS;
  photo.node.classList.remove('gesture-past-photo--dragging');
  photo.node.classList.add('gesture-past-photo--placed');
  state.activePhoto = null;
}

function updatePastPhotos(now: number) {
  for (const photo of [...state.pastPhotos]) {
    if (photo.state === 'dragging') {
      photo.x = lerp(photo.x, hand.x, 0.44);
      photo.y = lerp(photo.y, hand.y, 0.44);
      photo.rotation = lerp(photo.rotation, (hand.x - window.innerWidth * 0.5) * 0.006, 0.08);
    }

    if (photo.state === 'placed' && now > photo.expiresAt) {
      photo.state = 'fading';
      photo.node.classList.add('gesture-past-photo--fading');
      window.setTimeout(() => removePastPhoto(photo), PHOTO_FADE_MS);
    }

    const nearHand = hand.active && pointInPhoto(hand.x, hand.y, photo);
    const localTouchX = clamp(((hand.x - photo.x) / photo.width + 0.5) * 100, 0, 100);
    const localTouchY = clamp(((hand.y - photo.y) / photo.height + 0.5) * 100, 0, 100);
    photo.node.classList.toggle('gesture-past-photo--under-hand', nearHand || photo.state === 'dragging');
    photo.node.style.width = `${photo.width}px`;
    photo.node.style.height = `${photo.height}px`;
    photo.node.style.setProperty('--touch-x', `${localTouchX}%`);
    photo.node.style.setProperty('--touch-y', `${localTouchY}%`);
    if (photo.state === 'placed') {
      const age = clamp((now - photo.placedAt) / PHOTO_LIFETIME_MS, 0, 1);
      photo.node.style.setProperty('--placed-opacity', `${lerp(0.72, 0.16, age)}`);
      photo.node.style.setProperty('--placed-blur', `${lerp(0.4, 8.5, easeInCubic(age))}px`);
      photo.node.style.setProperty('--placed-decay', `${age}`);
    } else {
      photo.node.style.removeProperty('--placed-opacity');
      photo.node.style.removeProperty('--placed-blur');
      photo.node.style.removeProperty('--placed-decay');
    }
    photo.node.style.transform = `translate3d(${photo.x}px, ${photo.y}px, 0) translate(-50%, -50%) rotate(${photo.rotation}deg)`;
  }
}

function removePastPhoto(photo: PastPhoto) {
  photo.node.remove();
  state.pastPhotos = state.pastPhotos.filter((item) => item.id !== photo.id);
  if (state.activePhoto?.id === photo.id) state.activePhoto = null;
}

function takeNextMemory() {
  if (!state.memoryQueue.length) {
    state.memoryQueue = shuffled(state.memories);
    if (state.memoryQueue.length > 1 && state.memoryQueue[0].src === state.lastMemorySrc) {
      state.memoryQueue.push(state.memoryQueue.shift()!);
    }
  }

  const next = state.memoryQueue.shift() || state.memories[0];
  state.lastMemorySrc = next.src;
  return next;
}

function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function uniqueStrings(items: string[]) {
  return [...new Set(items)];
}

function pointInPhoto(x: number, y: number, photo: PastPhoto) {
  return Math.abs(x - photo.x) < photo.width * 0.58 && Math.abs(y - photo.y) < photo.height * 0.62;
}

function drawHandLayer(now: number) {
  resizeHandCanvas();
  handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
  if (!hand.active) return;

  const dpr = window.devicePixelRatio || 1;
  handCtx.save();
  handCtx.scale(dpr, dpr);
  handCtx.globalAlpha = clamp(hand.confidence, 0, 1);

  const pulse = 1 + Math.sin(now * 0.006) * 0.055;
  const radius = lerp(26, 48, hand.pinch) * pulse;
  const haloRadius = radius * (hand.pinchDown ? 3.2 : 2.65);
  const gradient = handCtx.createRadialGradient(hand.x, hand.y, radius * 0.12, hand.x, hand.y, haloRadius);
  gradient.addColorStop(0, hand.pinchDown ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.56)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.18)');
  gradient.addColorStop(0.68, 'rgba(255,255,255,0.065)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  handCtx.fillStyle = gradient;
  handCtx.beginPath();
  handCtx.arc(hand.x, hand.y, haloRadius, 0, Math.PI * 2);
  handCtx.fill();

  handCtx.strokeStyle = hand.pinchDown ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.62)';
  handCtx.lineWidth = hand.pinchDown ? 1.6 : 1.15;
  handCtx.beginPath();
  handCtx.arc(hand.x, hand.y, radius, 0, Math.PI * 2);
  handCtx.stroke();

  handCtx.restore();
}

function resizeHandCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (handCanvas.width === Math.floor(width * dpr) && handCanvas.height === Math.floor(height * dpr)) return;
  handCanvas.width = Math.floor(width * dpr);
  handCanvas.height = Math.floor(height * dpr);
  handCanvas.style.width = `${width}px`;
  handCanvas.style.height = `${height}px`;
}

function distance(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeInCubic(value: number) {
  return value * value * value;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char] || char;
  });
}
