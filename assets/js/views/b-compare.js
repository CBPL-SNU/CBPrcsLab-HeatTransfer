// 실험 B 비교 화면: 같은 1.6 m/s 흐름 속의 큰 구와 작은 구를 같은 시각, 같은 색 범위로 나란히 본다.

import { $, $$, clamp, numberValue } from "../core/dom.js";
import { setupCanvas, drawAxes, drawLine, makeScales, paintUpTo, CHART_INK, CHART_FONT, SERIES_COLOR, SENSOR_COLOR } from "../core/chart.js";
import { loadCase, ensureField, physical, valueRange } from "../core/cfd-loader.js";
import { RAMP, paintFrame, sampleFrame, createPlayer, showProbe, hideProbe } from "../core/field-player.js";

// 두 case는 같은 조건, 같은 시각 격자(0.1 s × 301)로 계산되었다
const BEADS = [
  { id: "B16L", label: "3.1 mm bead", line: 3.2 },
  { id: "B16S", label: "0.5 mm bead", line: 1.6 }   // 선 굵기가 구 지름을 뜻한다. 계산 화면과 같은 약속
];
const MIN_DT = 0.05;              // 이보다 작은 온도차에서는 h를 나누지 않는다 [K]

let cases = null;                 // [{ ...bead, data }]
let field = "temperature";
let frameIndex = 0;
let busy = false;
let loadVersion = 0;
let player = null;

const frames = () => cases?.[0].data.index.frames ?? null;

// 두 창을 아우르는 색 범위. 같은 색이면 같은 온도여야 비교가 된다
function sharedRange() {
  const ranges = cases.map(c => valueRange(c.data.index, field, "zoom"));
  return { min: Math.min(...ranges.map(r => r.min)), max: Math.max(...ranges.map(r => r.max)) };
}

// 넓으면 나란히, 좁으면 위아래. 색 막대 하나를 오른쪽에 둔다
function layout(w, h) {
  const margin = 8, labelH = 20, gap = 24, side = 68;
  if (w < 560) {
    const s = Math.min(w - 2 * margin - side, 300);
    const x = (w - s - side) / 2;
    return { panels: [{ x, y: margin, w: s, h: s }, { x, y: margin + s + labelH + gap, w: s, h: s }],
      bar: { x: x + s + 8, y: margin, h: 2 * s + labelH + gap }, height: 2 * s + 2 * labelH + gap + 2 * margin };
  }
  const s = Math.max(1, Math.min(360, (w - 2 * margin - gap - side) / 2));
  const left = (w - (2 * s + gap + side)) / 2, top = margin;
  return { panels: [{ x: left, y: top, w: s, h: s }, { x: left + s + gap, y: top, w: s, h: s }],
    bar: { x: left + 2 * s + gap + 8, y: top, h: s }, height: s + labelH + 2 * margin };
}

function roiOf(c) { return c.data.index.planes.zoom.roi; }

function paintPanel(ctx, c, panel, range) {
  paintFrame(ctx, c.data, "zoom", field, frameIndex, panel, range);
  const roi = roiOf(c), { bead } = c.data.index;
  const widthMm = (roi.xHi - roi.xLo) * 1000;
  const cx = panel.x + (bead.x - roi.xLo) / (roi.xHi - roi.xLo) * panel.w;
  const cy = panel.y + (roi.zHi - bead.z) / (roi.zHi - roi.zLo) * panel.h;
  const r = bead.radius * 1000 / widthMm * panel.w;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.strokeStyle = CHART_INK.mark; ctx.lineWidth = 1; ctx.stroke();
  // 두 창의 축척이 다르므로 축척 막대가 꼭 있어야 한다
  const barMm = [2, 1, 0.5, 0.2, 0.1].find(len => len <= widthMm / 5) ?? 0.1;
  const len = panel.w / widthMm * barMm, sx = panel.x + 10, sy = panel.y + panel.h - 12;
  ctx.fillStyle = field === "temperature" ? "rgba(255,255,255,.9)" : CHART_INK.mark;
  ctx.fillRect(sx, sy, len, 2);
  ctx.font = CHART_FONT; ctx.textAlign = "left"; ctx.fillText(`${barMm} mm`, sx + len + 6, sy + 4);
  ctx.strokeStyle = CHART_INK.grid; ctx.lineWidth = 1;
  ctx.strokeRect(panel.x + 0.5, panel.y + 0.5, panel.w - 1, panel.h - 1);
  ctx.fillStyle = CHART_INK.ink; ctx.textAlign = "center";
  ctx.fillText(c.label, panel.x + panel.w / 2, panel.y + panel.h + 14);
}

function paintBar(ctx, bar, range) {
  const gradient = ctx.createLinearGradient(0, bar.y + bar.h, 0, bar.y);
  RAMP[field].forEach((color, i) => gradient.addColorStop(i / (RAMP[field].length - 1), color));
  ctx.fillStyle = gradient; ctx.fillRect(bar.x, bar.y, 10, bar.h);
  ctx.strokeStyle = CHART_INK.grid; ctx.strokeRect(bar.x + 0.5, bar.y + 0.5, 9, bar.h - 1);
  const unit = field === "temperature" ? "°C" : "m/s", digits = field === "temperature" ? 1 : 2;
  ctx.font = CHART_FONT; ctx.fillStyle = CHART_INK.ink; ctx.textAlign = "left";
  ctx.fillText(`${range.max.toFixed(digits)} ${unit}`, bar.x + 15, bar.y + 9);
  ctx.fillText(`${range.min.toFixed(digits)} ${unit}`, bar.x + 15, bar.y + bar.h);
}

export function drawBCompare() {
  const canvas = $("#cCanvas");
  if (!canvas || !cases || busy) return;
  const width = canvas.clientWidth;
  // 창이 정사각형이라 높이는 폭에서 정해진다. 고정 높이면 위아래가 빈다
  if (width) canvas.style.height = `${layout(width, 0).height}px`;
  const setup = setupCanvas(canvas);
  if (!setup) return;
  const { ctx, w, h } = setup;
  ctx.clearRect(0, 0, w, h);
  const range = sharedRange(), { panels, bar } = layout(w, h);
  cases.forEach((c, i) => paintPanel(ctx, c, panels[i], range));
  paintBar(ctx, bar, range);
  drawTemperatures();
  showNumbers();
  updateLabels();
  hideTip();
}

const at = (c, key) => {
  const hist = c.data.history, now = frames()[frameIndex];
  const i = Math.max(0, hist.time_s.findIndex(t => t >= now - 1e-6));
  return hist[key][i];
};

function drawTemperatures() {
  const setup = setupCanvas($("#cTempChart"));
  if (!setup) return;
  const { ctx, w, h } = setup;
  const air = cases[0].data.index.ambientC;
  const all = cases.flatMap(c => c.data.history.T_bead_avg_C.filter(v => v !== null));
  const lo = Math.min(air, ...all), hi = Math.max(...all), pad = (hi - lo) * 0.1 || 1, end = frames().at(-1);
  const { xMap, yMap } = makeScales(w, h, [0, end], [lo - pad, hi + pad]);
  const digits = hi - lo < 5 ? 1 : 0;
  drawAxes(ctx, w, h, "t (s)", "T (°C)", [0, Math.round(end / 2), end],
    [+lo.toFixed(digits), +((lo + hi) / 2).toFixed(digits), +hi.toFixed(digits)], xMap, yMap);
  paintUpTo(ctx, xMap(frames()[frameIndex]), h, () => {
    drawLine(ctx, [[xMap(0), yMap(air)], [xMap(end), yMap(air)]], SERIES_COLOR.residual, 1.6, [7, 4]);
    cases.forEach(c => {
      const { time_s: t, T_bead_avg_C: T } = c.data.history;
      drawLine(ctx, t.flatMap((s, i) => (T[i] === null ? [] : [[xMap(s), yMap(T[i])]])), SENSOR_COLOR.black, c.line);
    });
  });
}

// 크기가 다른 두 구를 면적당으로 맞춘다. 받는 복사는 거의 같고, 지름이 작을수록 h가 커서 덜 오른다
function showNumbers() {
  const air = cases[0].data.index.ambientC;
  $("#cWall").textContent = `${cases[0].data.index.jacket.tempC.toFixed(1)} °C`;
  $("#cAir").innerHTML = `${air.toFixed(2)} <small>°C</small>`;
  cases.forEach((c, k) => {
    const suffix = k === 0 ? "L" : "S";
    const T = at(c, "T_bead_avg_C"), rad = at(c, "Q_air_to_bead_rad_W"), conv = at(c, "Q_air_to_bead_conv_W");
    const area = Math.PI * (2 * c.data.index.bead.radius) ** 2;           // 구 겉넓이 πD² [m²]
    $(`#${k === 0 ? "cLarge" : "cSmall"}`).innerHTML = T === null ? "—" : `${T.toFixed(2)} <small>°C</small>`;
    $(`#cRad${suffix}`).textContent = rad === null ? "—" : (rad / area).toFixed(0);
    const dT = T === null ? null : T - air;
    $(`#cErr${suffix}`).textContent = dT === null ? "—" : dT.toFixed(2);
    $(`#cH${suffix}`).textContent = conv === null || dT === null || dT < MIN_DT ? "—" : (-conv / (area * dT)).toFixed(0);
  });
}

function updateLabels() {
  const f = frames(), now = f[frameIndex];
  $("#cTimeValue").textContent = `${now.toFixed(1)} / ${f.at(-1).toFixed(0)} s`;
  $("#cTime").setAttribute("aria-valuetext", `${now.toFixed(1)} seconds`);
  player.renderRate();
  player.label();
  const [L, S] = cases.map(c => at(c, "T_bead_avg_C"));
  $("#cCanvas").setAttribute("aria-label", `At ${now.toFixed(1)} s the 3.1 mm bead is at ${L === null ? "an unrecorded temperature" : `${L.toFixed(1)} °C`} and the 0.5 mm bead at ${S === null ? "an unrecorded temperature" : `${S.toFixed(1)} °C`}.`);
}

const probe = () => ({ tip: $("#cTip"), coords: $("#cCoords"), crossH: $("#cCrossH"), crossV: $("#cCrossV") });
function hideTip() { hideProbe(probe()); }

function handleProbe(event) {
  const rect = $("#cCanvas").getBoundingClientRect();
  const px = event.clientX - rect.left, py = event.clientY - rect.top;
  const { panels } = layout(rect.width, rect.height);
  const k = panels.findIndex(p => px >= p.x && px < p.x + p.w && py >= p.y && py < p.y + p.h);
  if (k < 0) { hideTip(); return; }
  const c = cases[k], panel = panels[k], roi = roiOf(c), { bead } = c.data.index;
  const u = (px - panel.x) / panel.w, v = (py - panel.y) / panel.h;
  const value = physical(c.data.index, field, sampleFrame(c.data, "zoom", field, frameIndex, u, v), "zoom");
  const x = roi.xLo + u * (roi.xHi - roi.xLo), z = roi.zHi - v * (roi.zHi - roi.zLo);
  showProbe(probe(), rect, panel, px, py, {
    reading: field === "temperature" ? `${value.toFixed(2)} °C` : `${value.toFixed(3)} m/s`,
    surfaces: [{ name: "bead", d: Math.hypot(x - bead.x, z - bead.z) - bead.radius }],
    coords: [["x", x], ["z", z]],
    res: 1 / roi.pxPerM
  });
}

function setFrame(i) {
  if (!cases || busy) return;
  frameIndex = clamp(Math.round(i), 0, frames().length - 1);
  $("#cTime").value = frameIndex;
  drawBCompare();
}

function setLoading(value, message = "") {
  busy = value;
  $("#cPending").hidden = !message;
  $("#cPending").textContent = message;
  $("#b-compare").setAttribute("aria-busy", String(value));
  $$("#cPlay, #cTime, #b-compare .c-field-type").forEach(control => { control.disabled = value || !cases; });
}

async function load(nextField) {
  const version = ++loadVersion;
  setLoading(true, cases ? `Loading ${nextField}…` : "Loading both beads…");
  try {
    const loaded = await Promise.all(BEADS.map(b => loadCase(b.id)));
    if (version !== loadVersion) return;
    if (loaded.some(d => !d)) { setLoading(false, "One of the two beads is not available yet."); return; }
    await Promise.all(loaded.map(d => ensureField(d, nextField)));
    if (version !== loadVersion) return;
    const first = !cases;
    cases = BEADS.map((b, i) => ({ ...b, data: loaded[i] }));
    field = nextField;
    $$(".c-field-type").forEach(item => {
      item.classList.toggle("is-active", item.dataset.field === field);
      item.setAttribute("aria-pressed", String(item.dataset.field === field));
    });
    $("#cTime").max = frames().length - 1;
    setLoading(false);
    player.renderTicks();
    setFrame(first ? frames().length - 1 : frameIndex);
  } catch (error) {
    if (version === loadVersion) setLoading(false, "Could not load the two beads. Reload to retry.");
  }
}

export function initBCompare() {
  player = createPlayer({
    play: $("#cPlay"), ticks: $("#cTicks"), rateValue: $("#cPlayRateValue"), rateButtons: $$("#b-compare .play-rate")
  }, {
    frames,
    current: () => frameIndex,
    setFrame,
    isActive: () => !busy && $("#b-compare").classList.contains("is-active")
  });
  load("temperature");

  $$(".c-field-type").forEach(button => button.addEventListener("click", () => {
    if (!cases || busy || button.dataset.field === field) return;
    player.stop();
    load(button.dataset.field);
  }));
  const step = delta => { player.stop(); setFrame(frameIndex + delta); };
  $("#cTime").addEventListener("input", () => { player.stop(); setFrame(numberValue("#cTime", 0)); });
  $("#cPlay").addEventListener("click", () => { if (cases && !busy) player.toggle(); });
  $("#cCanvas").addEventListener("pointermove", event => { if (cases && !busy) handleProbe(event); });
  $("#cCanvas").addEventListener("pointerleave", hideTip);

  document.addEventListener("keydown", event => {
    if (!cases || busy || document.querySelector("dialog[open]") || !$("#b-compare").classList.contains("is-active")) return;
    const target = event.target;
    const typing = (target.tagName === "INPUT" && target.type !== "range")
      || target.tagName === "SELECT" || target.tagName === "TEXTAREA" || target.isContentEditable;
    if (typing) return;
    if (event.key === " ") {
      if (target.tagName === "BUTTON") return;
      event.preventDefault(); player.toggle();
    } else if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
    else if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
  });
}
