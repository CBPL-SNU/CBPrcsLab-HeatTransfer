// CFD 장면을 그리고 재생하는 부분 중 실험 A와 B가 공유하는 것.

import { frameData, valueRange } from "./cfd-loader.js";

// 색 램프. 둘 다 밝기가 단조 증가한다. 밝기가 곧 크기라야 색맹인 사람도 읽는다.
// 온도는 열화상 카메라의 관례(검정→보라→빨강→노랑→흰색)를 따른다. 색상이 함께 바뀌어
// 한 색상 램프보다 작은 온도차가 훨씬 잘 구분된다. 무지개와 달리 밝기 순서는 지킨다.
// 속력은 어두운 남색에서 흰색으로, 온도와 겹쳐 보이지 않게 찬 색 쪽을 쓴다.
export const RAMP = {
  temperature: ["#000004", "#160b39", "#420a68", "#6a176e", "#932667", "#bc3754",
                "#dd513a", "#f37819", "#fca50a", "#f6d746", "#fcffa4"],
  speed: ["#0d2035", "#1d4c7f", "#279fc3", "#6bd8c2", "#eefbff"]
};

function hexToRgb(hex) {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}

// 정지점을 256단계로 편다. sRGB 선형 보간이지만 램프가 단조라 충분하다.
function buildLut(stops) {
  const rgb = stops.map(hexToRgb);
  const table = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i += 1) {
    const pos = i / 255 * (stops.length - 1);
    const a = Math.floor(pos), b = Math.min(a + 1, stops.length - 1), u = pos - a;
    for (let k = 0; k < 3; k += 1) table[i * 3 + k] = rgb[a][k] + (rgb[b][k] - rgb[a][k]) * u;
  }
  return table;
}

const lut = {};
const scratch = document.createElement("canvas");
const tinted = document.createElement("canvas");

// 스프라이트의 한 프레임을 색칠해서 rect에 늘려 그린다.
// range를 주면 그 범위로 다시 칠한다. 두 case를 같은 색 범위로 나란히 놓을 때 쓴다
export function paintFrame(ctx, data, plane, field, frameIndex, rect, range = null) {
  lut[field] ??= buildLut(RAMP[field]);
  const table = lut[field];
  const image = frameData(data, plane, field, frameIndex, scratch);
  const remap = new Uint8ClampedArray(256);
  const own = valueRange(data.index, field, plane);
  for (let b = 0; b < 256; b += 1) {
    remap[b] = range ? (own.min + (own.max - own.min) * b / 255 - range.min) / (range.max - range.min) * 255 : b;
  }
  const out = new ImageData(image.width, image.height);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = remap[image.data[i]] * 3;
    out.data[i] = table[v]; out.data[i + 1] = table[v + 1]; out.data[i + 2] = table[v + 2]; out.data[i + 3] = 255;
  }
  tinted.width = image.width; tinted.height = image.height;
  tinted.getContext("2d").putImageData(out, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tinted, rect.x, rect.y, rect.w, rect.h);
}

// 포인터 아래 픽셀의 바이트 값. 값으로 되돌리는 것은 physical()이 한다.
export function sampleFrame(data, plane, field, frameIndex, u, v) {
  const image = frameData(data, plane, field, frameIndex, scratch);
  const col = Math.min(image.width - 1, Math.max(0, Math.floor(u * image.width)));
  const row = Math.min(image.height - 1, Math.max(0, Math.floor(v * image.height)));
  return image.data[(row * image.width + col) * 4];
}

export function frameImage(data, plane, field, frameIndex) {
  return frameData(data, plane, field, frameIndex, scratch);
}

// 포인터 판독. 옆에는 값과 가장 가까운 표면까지의 거리, 구석에는 CFD 좌표 [mm].
// 경계층 두께를 재려면 절대 좌표보다 표면에서의 거리가 바로 읽혀야 한다.
// surfaces: [{ name, d }] — d는 표면까지 거리 [m], 고체 안이면 음수. res는 격자 간격 [m].
export function showProbe(el, rect, panel, px, py, { reading, surfaces, coords, res }) {
  const digits = res < 0.0005 ? 2 : 1;
  const mm = m => (m * 1000).toFixed(digits);
  const near = surfaces.reduce((a, b) => (b.d < a.d ? b : a));
  const note = near.d < 0 ? `inside the ${near.name}` : `${mm(near.d)} mm from the ${near.name}`;
  el.tip.hidden = false;
  el.tip.innerHTML = `<b>${reading}</b><span>${note}</span>`;
  el.tip.style.left = `${px}px`; el.tip.style.top = `${py}px`;
  el.tip.style.transform = px > rect.width - 170 ? "translate(calc(-100% - 12px), -50%)" : "translate(12px, -50%)";
  el.coords.textContent = coords.map(([axis, m]) => `${axis} ${mm(m)}`).join("   ") + " mm";
  el.crossH.hidden = el.crossV.hidden = false;
  el.crossH.style.top = `${py}px`; el.crossH.style.left = `${panel.x}px`; el.crossH.style.right = `${rect.width - panel.x - panel.w}px`;
  el.crossV.style.left = `${px}px`; el.crossV.style.top = `${panel.y}px`; el.crossV.style.bottom = `${rect.height - panel.y - panel.h}px`;
}

export function hideProbe(el) {
  el.tip.hidden = el.crossH.hidden = el.crossV.hidden = true;
  el.coords.textContent = "";
}

// 재생은 fps가 아니라 실제 시간 대비 배속으로 고른다. case마다 프레임 간격이 달라서
// (실험 A 0.5 s, 실험 B 0.1 s) 같은 fps라도 실제로는 전혀 다른 속도가 되기 때문이다.
const PLAYBACK_RATES = [1, 2, 5, 10, 25];
const DEFAULT_PLAY_SECONDS = 20;  // 고르기 전에는 한 바퀴가 이 정도 안에 도는 가장 느린 배속
const MAX_DRAW_FPS = 30;          // 그 이상은 프레임을 건너뛴다. 그래프까지 다시 그리므로

// el: { play, ticks, rateValue, rateButtons }
// frames(): 현재 case의 프레임 시각 배열 또는 null. current(): 지금 프레임 번호.
export function createPlayer(el, { frames, current, setFrame, isActive }) {
  let playing = false, raf = null, chosenRate = null;

  const duration = () => { const f = frames(); return f.at(-1) - f[0]; };
  const rate = () => chosenRate ?? PLAYBACK_RATES.find(r => duration() / r <= DEFAULT_PLAY_SECONDS) ?? PLAYBACK_RATES.at(-1);

  function renderRate() {
    if (!frames()) return;
    const r = rate();
    el.rateButtons.forEach(button => {
      const on = Number(button.dataset.rate) === r;
      button.classList.toggle("is-active", on);
      button.setAttribute("aria-pressed", String(on));
    });
    const wall = duration() / r, step = duration() / (frames().length - 1);
    el.rateValue.textContent = `plays in ${wall < 10 ? wall.toFixed(1) : wall.toFixed(0)} s · ${step.toFixed(1)} s/frame`;
  }

  // 슬라이더 아래 눈금. 프레임 번호가 아니라 시뮬레이션 시각 [s]. 이름표끼리 56 px 이상 떨어지게 고른다
  function renderTicks() {
    if (!frames()) return;
    const end = duration();
    const room = Math.max(1, Math.floor(el.ticks.clientWidth / 56));
    const stepS = [1, 2, 5, 10, 15, 30, 60, 120].find(st => end / st <= room) ?? 300;
    const ticks = [];
    for (let t = 0; t <= end + 1e-9; t += stepS) ticks.push(t);
    el.ticks.innerHTML = ticks.map(t => `<span style="--at:${(t / end).toFixed(4)}">${t} s</span>`).join("");
  }

  function label() {
    const f = frames();
    el.play.textContent = playing ? "Pause" : f && current() === f.length - 1 ? "Replay" : "Play";
  }

  function stop() {
    playing = false;
    cancelAnimationFrame(raf);
    label();
  }

  // 시뮬레이션 시계를 벽시계 × 배속으로 돌리고, 그 시각까지의 마지막 프레임을 보여준다.
  // 느린 배속은 같은 프레임을 오래 들고, 빠른 배속은 프레임을 건너뛴다.
  function play() {
    const f = frames();
    if (!f) return;
    playing = true;
    if (current() >= f.length - 1) setFrame(0);
    label();
    let simTime = f[current()], lastWall = null, lastDraw = 0;
    const tick = wall => {
      if (!playing) return;
      if (document.hidden || !isActive() || frames() !== f) { stop(); return; }
      if (lastWall !== null) simTime += (wall - lastWall) / 1000 * rate();
      lastWall = wall;
      // 끝에서 멈춘다. 0 s로 되감으면 마지막 상태를 볼 틈이 없다. 다시 보려면 Replay
      if (simTime > f.at(-1)) { setFrame(f.length - 1); stop(); return; }
      if (wall - lastDraw >= 1000 / MAX_DRAW_FPS) {
        let i = current() > 0 && f[current()] <= simTime ? current() : 0;
        while (i + 1 < f.length && f[i + 1] <= simTime) i += 1;
        if (i !== current()) { setFrame(i); lastDraw = wall; }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  // 재생 중에 바꿔도 멈추지 않는다. 시계만 빨라지거나 느려진다
  el.rateButtons.forEach(button => button.addEventListener("click", () => {
    chosenRate = Number(button.dataset.rate);
    renderRate();
  }));
  new ResizeObserver(renderTicks).observe(el.ticks);

  return {
    play, stop, label, renderRate, renderTicks,
    toggle: () => (playing ? stop() : play()),
    get playing() { return playing; }
  };
}
