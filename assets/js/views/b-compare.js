// 실험 B 비교 화면: 아무 두 case의 구 주변을 같은 시각에 나란히 본다.

import { $, $$, clamp, numberValue } from "../core/dom.js";
import { setupCanvas, drawAxes, drawLine, makeScales, paintUpTo, CHART_INK, CHART_FONT, SERIES_COLOR, SERIES_DASH, SENSOR_COLOR } from "../core/chart.js";
import { loadCase, ensureField, physical, saturated, valueRange } from "../core/cfd-loader.js";
import { RAMP, paintFrame, sampleFrame, createPlayer, showProbe, hideProbe } from "../core/field-player.js";
import { CFD_CASES } from "../data/cfd-cases.js";

const CHOICES = Object.entries(CFD_CASES).filter(([, c]) => c.kind === "B")
  .map(([id, c]) => ({ id, label: c.label.replace(/^B · /, "") }));
const DEFAULT_PAIR = ["B16L", "B16S"];     // 같은 흐름 속의 두 구 크기. 실험 B의 핵심 비교
const SIDES = ["left", "right"];
// CFD의 두 구는 크기만 다른 흑체라 둘 다 흑체 색이다. 회색은 회색체(T6) 색이므로 쓰지 않고 선 모양으로 가른다
const SIDE_COLOR = { left: SENSOR_COLOR.black, right: SENSOR_COLOR.black };
const SIDE_DASH = { left: SERIES_DASH.solid, right: SERIES_DASH.dashed };
const MIN_DT = 0.05;              // 이보다 작은 온도차에서는 h를 나누지 않는다 [K]

let cases = null;                 // [{ side, id, label, data, line }]
let field = "temperature";
let scale = "shared";
let frameIndex = 0;               // 둘 중 긴 case의 프레임 번호
let busy = false;
let loadVersion = 0;
let player = null;

// 두 case의 길이가 다를 수 있다(30 s, 60 s). 긴 쪽의 시각 격자로 재생하고 짧은 쪽은 마지막 프레임에 머문다
const longest = () => cases.reduce((a, b) => (b.data.index.frames.length > a.data.index.frames.length ? b : a));
const frames = () => (cases ? longest().data.index.frames : null);
const now = () => frames()[frameIndex];
function indexAt(c, t) {
  const f = c.data.index.frames;
  let i = Math.min(f.length - 1, Math.round(t / (f[1] - f[0])));
  while (i > 0 && f[i] > t + 1e-6) i -= 1;
  return i;
}
const ended = c => now() > c.data.index.frames.at(-1) + 1e-6;

function rangeFor(c) {
  if (scale === "own") return valueRange(c.data.index, field, "zoom");
  const ranges = cases.map(k => valueRange(k.data.index, field, "zoom"));
  const max = Math.max(...ranges.map(r => r.max));
  // 상한을 정한 쪽이 잘렸으면 공유 범위도 잘린 것이다
  return { min: Math.min(...ranges.map(r => r.min)), max, clipped: ranges.some(r => r.max === max && r.clipped) };
}

// 넓으면 나란히, 좁으면 위아래. 색 범위가 공유면 막대 하나, 따로면 창마다 하나
function layout(w) {
  const margin = 8, labelH = 20, gap = 24, side = 68, own = scale === "own";
  if (w < 560) {
    const s = Math.min(w - 2 * margin - side, 300), x = (w - s - side) / 2;
    const panels = [{ x, y: margin, w: s, h: s }, { x, y: margin + s + labelH + gap, w: s, h: s }];
    const bars = own ? panels.map(p => ({ x: p.x + s + 8, y: p.y, h: s })) : [{ x: x + s + 8, y: margin, h: 2 * s + labelH + gap }];
    return { panels, bars, height: 2 * s + 2 * labelH + gap + 2 * margin };
  }
  const s = Math.max(1, Math.min(360, (w - 2 * margin - gap - (own ? 2 : 1) * side) / 2));
  const total = 2 * s + gap + (own ? 2 : 1) * side, left = (w - total) / 2;
  const x2 = left + s + (own ? side : 0) + gap;
  const panels = [{ x: left, y: margin, w: s, h: s }, { x: x2, y: margin, w: s, h: s }];
  const bars = own ? panels.map(p => ({ x: p.x + s + 8, y: margin, h: s })) : [{ x: x2 + s + 8, y: margin, h: s }];
  return { panels, bars, height: s + labelH + 2 * margin };
}

const roiOf = c => c.data.index.planes.zoom.roi;

function paintPanel(ctx, c, panel) {
  paintFrame(ctx, c.data, "zoom", field, indexAt(c, now()), panel, rangeFor(c));
  const roi = roiOf(c), { bead } = c.data.index;
  const widthMm = (roi.xHi - roi.xLo) * 1000;
  const cx = panel.x + (bead.x - roi.xLo) / (roi.xHi - roi.xLo) * panel.w;
  const cy = panel.y + (roi.zHi - bead.z) / (roi.zHi - roi.zLo) * panel.h;
  ctx.beginPath(); ctx.arc(cx, cy, bead.radius * 1000 / widthMm * panel.w, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.strokeStyle = CHART_INK.mark; ctx.lineWidth = 1; ctx.stroke();
  // 두 창의 축척이 다를 수 있으므로 축척 막대가 꼭 있어야 한다
  const barMm = [2, 1, 0.5, 0.2, 0.1].find(len => len <= widthMm / 5) ?? 0.1;
  const len = panel.w / widthMm * barMm, sx = panel.x + 10, sy = panel.y + panel.h - 12;
  const ink = field === "temperature" ? "rgba(255,255,255,.9)" : CHART_INK.mark;
  ctx.fillStyle = ink; ctx.fillRect(sx, sy, len, 2);
  ctx.font = CHART_FONT; ctx.textAlign = "left"; ctx.fillText(`${barMm} mm`, sx + len + 6, sy + 4);
  // 짧은 case는 끝난 뒤 마지막 프레임에 머문다. 멈춘 그림을 지금으로 읽지 않게 적는다
  if (ended(c)) { ctx.textAlign = "right"; ctx.fillText(`ended at ${c.data.index.frames.at(-1).toFixed(0)} s`, panel.x + panel.w - 8, panel.y + 16); }
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
  ctx.fillText(`${range.clipped ? "≥ " : ""}${range.max.toFixed(digits)} ${unit}`, bar.x + 15, bar.y + 9);
  ctx.fillText(`${range.min.toFixed(digits)} ${unit}`, bar.x + 15, bar.y + bar.h);
}

export function drawBCompare() {
  const canvas = $("#cCanvas");
  if (!canvas || !cases || busy) return;
  // 창이 정사각형이라 높이는 폭에서 정해진다. 고정 높이면 위아래가 빈다
  if (canvas.clientWidth) canvas.style.height = `${layout(canvas.clientWidth).height}px`;
  const setup = setupCanvas(canvas);
  if (!setup) return;
  const { ctx, w, h } = setup;
  ctx.clearRect(0, 0, w, h);
  const { panels, bars } = layout(w);
  cases.forEach((c, i) => paintPanel(ctx, c, panels[i]));
  bars.forEach((bar, i) => paintBar(ctx, bar, rangeFor(cases[i])));
  drawTemperatures();
  showNumbers();
  updateLabels();
  hideTip();
}

const at = (c, key) => {
  const hist = c.data.history, t = Math.min(now(), c.data.index.frames.at(-1));
  return hist[key][Math.max(0, hist.time_s.findIndex(s => s >= t - 1e-6))];
};

function drawTemperatures() {
  const setup = setupCanvas($("#cTempChart"));
  if (!setup) return;
  const { ctx, w, h } = setup;
  const airs = cases.map(c => c.data.index.ambientC);
  const all = cases.flatMap(c => c.data.history.T_bead_avg_C.filter(v => v !== null));
  const lo = Math.min(...airs, ...all), hi = Math.max(...all), pad = (hi - lo) * 0.1 || 1, end = frames().at(-1);
  const { xMap, yMap } = makeScales(w, h, [0, end], [lo - pad, hi + pad]);
  const digits = hi - lo < 5 ? 1 : 0;
  drawAxes(ctx, w, h, "t (s)", "T (°C)", [0, Math.round(end / 2), end],
    [+lo.toFixed(digits), +((lo + hi) / 2).toFixed(digits), +hi.toFixed(digits)], xMap, yMap);
  paintUpTo(ctx, xMap(now()), h, () => {
    cases.forEach(c => {
      const air = c.data.index.ambientC, stop = c.data.index.frames.at(-1);
      drawLine(ctx, [[xMap(0), yMap(air)], [xMap(stop), yMap(air)]], SERIES_COLOR.residual, 1.4, [7, 4]);
      const { time_s: t, T_bead_avg_C: T } = c.data.history;
      drawLine(ctx, t.flatMap((s, i) => (T[i] === null ? [] : [[xMap(s), yMap(T[i])]])), SIDE_COLOR[c.side], c.line, SIDE_DASH[c.side]);
    });
  });
}

// 크기나 조건이 다른 두 구를 면적당으로 맞춘다
function showNumbers() {
  cases.forEach(c => {
    const k = c.side === "left" ? "L" : "R", air = c.data.index.ambientC;
    const T = at(c, "T_bead_avg_C"), rad = at(c, "Q_air_to_bead_rad_W"), conv = at(c, "Q_air_to_bead_conv_W");
    const area = Math.PI * (2 * c.data.index.bead.radius) ** 2;           // 구 겉넓이 πD² [m²]
    const dT = T === null ? null : T - air;
    $(`#cErr${c.side === "left" ? "Left" : "Right"}`).innerHTML = dT === null ? "—" : `${dT.toFixed(2)} <small>K</small>`;
    $(`#cWall${k}`).textContent = c.data.index.jacket.tempC.toFixed(1);
    $(`#cAir${k}`).textContent = air.toFixed(2);
    $(`#cBead${k}`).textContent = T === null ? "—" : T.toFixed(2);
    $(`#cRad${k}`).textContent = rad === null ? "—" : (rad / area).toFixed(0);
    $(`#cH${k}`).textContent = conv === null || dT === null || dT < MIN_DT ? "—" : (-conv / (area * dT)).toFixed(0);
  });
}

function updateLabels() {
  const f = frames();
  $("#cTimeValue").textContent = `${now().toFixed(1)} / ${f.at(-1).toFixed(0)} s`;
  $("#cTime").setAttribute("aria-valuetext", `${now().toFixed(1)} seconds`);
  player.renderRate();
  player.label();
  $("#cCanvas").setAttribute("aria-label", cases.map(c => {
    const T = at(c, "T_bead_avg_C");
    return `${c.label}: ${T === null ? "no reading" : `${T.toFixed(1)} °C`}`;
  }).join("; ") + ` at ${now().toFixed(1)} s.`);
}

// 범례는 고른 두 case에 따라 바뀐다. 선 굵기가 구 지름, 실선·점선이 왼쪽·오른쪽이다
function renderLegend() {
  $("#cLegend").innerHTML = cases.map(c =>
    `<span><i style="border-color:${SIDE_COLOR[c.side]};border-top-width:${c.line + 1}px;border-top-style:${c.side === "left" ? "solid" : "dashed"}"></i>${c.label}</span>`).join("")
    + '<span><i class="residual dashed"></i>Inlet air</span>';
  $("#cHeadL").textContent = cases[0].label;
  $("#cHeadR").textContent = cases[1].label;
}

const probe = () => ({ tip: $("#cTip"), coords: $("#cCoords"), crossH: $("#cCrossH"), crossV: $("#cCrossV") });
function hideTip() { hideProbe(probe()); }

function handleProbe(event) {
  const rect = $("#cCanvas").getBoundingClientRect();
  const px = event.clientX - rect.left, py = event.clientY - rect.top;
  const { panels } = layout(rect.width);
  const k = panels.findIndex(p => px >= p.x && px < p.x + p.w && py >= p.y && py < p.y + p.h);
  if (k < 0) { hideTip(); return; }
  const c = cases[k], panel = panels[k], roi = roiOf(c), { bead } = c.data.index;
  const u = (px - panel.x) / panel.w, v = (py - panel.y) / panel.h;
  const byte = sampleFrame(c.data, "zoom", field, indexAt(c, now()), u, v);
  const value = physical(c.data.index, field, byte, "zoom");
  const atLeast = saturated(c.data.index, field, byte, "zoom") ? "≥ " : "";
  const x = roi.xLo + u * (roi.xHi - roi.xLo), z = roi.zHi - v * (roi.zHi - roi.zLo);
  showProbe(probe(), rect, panel, px, py, {
    reading: atLeast + (field === "temperature" ? `${value.toFixed(2)} °C` : `${value.toFixed(3)} m/s`),
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

async function load(nextField = field) {
  player.stop();
  const version = ++loadVersion;
  const ids = [$("#cLeft").value, $("#cRight").value];
  setLoading(true, "Loading…");
  try {
    const loaded = await Promise.all(ids.map(id => loadCase(id)));
    if (version !== loadVersion) return;
    if (loaded.some(d => !d)) { setLoading(false, "One of the two cases is not available yet."); return; }
    await Promise.all(loaded.map(d => ensureField(d, nextField)));
    if (version !== loadVersion) return;
    const keepTime = cases ? now() : null;
    cases = SIDES.map((side, i) => ({
      side, id: ids[i], data: loaded[i],
      label: CHOICES.find(c => c.id === ids[i]).label,
      line: loaded[i].index.bead.radius > 0.001 ? 3.2 : 1.6     // 선 굵기가 구 지름. 계산 화면과 같은 약속
    }));
    field = nextField;
    $$(".c-field-type").forEach(item => {
      item.classList.toggle("is-active", item.dataset.field === field);
      item.setAttribute("aria-pressed", String(item.dataset.field === field));
    });
    renderLegend();
    $("#cTime").max = frames().length - 1;
    setLoading(false);
    player.renderTicks();
    // 고른 case만 바뀌었으면 보던 시각을 지킨다. 처음엔 끝 프레임부터
    const f = frames();
    setFrame(keepTime === null ? f.length - 1 : f.findIndex(t => t >= Math.min(keepTime, f.at(-1)) - 1e-6));
  } catch (error) {
    if (version === loadVersion) setLoading(false, "Could not load the two cases. Reload to retry.");
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

  SIDES.forEach((side, i) => {
    const select = $(side === "left" ? "#cLeft" : "#cRight");
    select.innerHTML = CHOICES.map(c => `<option value="${c.id}">${c.label}</option>`).join("");
    select.value = DEFAULT_PAIR[i];
    select.addEventListener("change", () => load());
  });
  load("temperature");

  $$(".c-field-type").forEach(button => button.addEventListener("click", () => {
    if (!cases || busy || button.dataset.field === field) return;
    load(button.dataset.field);
  }));
  $$(".c-scale").forEach(button => button.addEventListener("click", () => {
    scale = button.dataset.scale;
    $$(".c-scale").forEach(item => {
      item.classList.toggle("is-active", item === button);
      item.setAttribute("aria-pressed", String(item === button));
    });
    drawBCompare();
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
