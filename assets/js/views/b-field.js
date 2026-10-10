// 실험 B 관찰 화면: 가열된 관과 그 가운데 열전대 구의 CFD 단면을 재생한다.

import { $, $$, clamp, numberValue } from "../core/dom.js";
import { setupCanvas, drawAxes, drawLine, makeScales, paintUpTo, CHART_INK, CHART_FONT, SERIES_COLOR, SENSOR_COLOR } from "../core/chart.js";
import { loadCase, ensureField, physical, valueRange } from "../core/cfd-loader.js";
import { RAMP, paintFrame, sampleFrame, createPlayer, showProbe, hideProbe } from "../core/field-player.js";

const PANEL_LABEL = { full: "Heated section", zoom: "Around the bead" };

let data = null;
let field = "temperature";
let frameIndex = 0;
let busy = false;
let loadVersion = 0;
let player = null;

// 왼쪽은 가열 구간 전체(좁고 길다), 오른쪽은 구 주변(정사각형). 각 창 오른쪽에 자기 색 범위.
function layout(w, h) {
  const { full, zoom } = data.index.planes;
  const margin = 8, labelH = 20, bar = 10, barText = 52, gap = 36;
  const fullAspect = full.w / full.h, zoomAspect = zoom.w / zoom.h;
  const side = 2 * (bar + 6 + barText);
  const ph = Math.max(1, Math.min(h - 2 * margin - labelH, (w - 2 * margin - gap - side) / (fullAspect + zoomAspect)));
  const fw = ph * fullAspect, zw = ph * zoomAspect;
  const total = fw + zw + gap + side;
  const left = Math.max(margin, (w - total) / 2);
  const top = Math.max(margin, (h - ph - labelH) / 2);
  const zoomX = left + fw + bar + 6 + barText + gap;
  return [
    { plane: "full", x: left, y: top, w: fw, h: ph, bar: { x: left + fw + 6, w: bar } },
    { plane: "zoom", x: zoomX, y: top, w: zw, h: ph, bar: { x: zoomX + zw + 6, w: bar } }
  ];
}

// 물리 좌표 [m] → 창 안의 px
function toPanel(panel, x, z) {
  const roi = data.index.planes[panel.plane].roi;
  return [panel.x + (x - roi.xLo) / (roi.xHi - roi.xLo) * panel.w,
          panel.y + (roi.zHi - z) / (roi.zHi - roi.zLo) * panel.h];
}

function outline(ctx, draw) {
  // 바탕이 검정일 수도 노랑일 수도 있어 흰 테두리 위에 검은 선을 얹는다
  draw(); ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.strokeStyle = CHART_INK.mark; ctx.lineWidth = 1; ctx.stroke();
}

function paintPanel(ctx, panel) {
  const { index } = data;
  paintFrame(ctx, data, panel.plane, field, frameIndex, panel);
  const { bead, jacket } = index;

  if (panel.plane === "full") {
    // 가열 벽면이 있는 높이. 관 벽 바깥에 표면 온도 색으로 긋는다
    const [, y0] = toPanel(panel, 0, jacket.zHi), [, y1] = toPanel(panel, 0, jacket.zLo);
    ctx.fillStyle = SERIES_COLOR.surface;
    ctx.fillRect(panel.x - 4, y0, 3, y1 - y0);
    ctx.fillRect(panel.x + panel.w + 1, y0, 3, y1 - y0);
    // 오른쪽 창이 보여주는 영역
    const z = index.planes.zoom.roi;
    const [bx0, by0] = toPanel(panel, z.xLo, z.zHi), [bx1, by1] = toPanel(panel, z.xHi, z.zLo);
    outline(ctx, () => { ctx.beginPath(); ctx.rect(bx0, by0, bx1 - bx0, by1 - by0); });
    // 상자에서 오른쪽 창의 두 모서리로. 무엇을 확대했는지가 선으로 이어진다
    const zoom = layout(ctx.canvas.clientWidth, ctx.canvas.clientHeight)[1];
    ctx.strokeStyle = CHART_INK.ink; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(bx1, by0); ctx.lineTo(zoom.x, zoom.y);
    ctx.moveTo(bx1, by1); ctx.lineTo(zoom.x, zoom.y + zoom.h);
    ctx.stroke(); ctx.setLineDash([]);
  } else {
    const [cx, cy] = toPanel(panel, bead.x, bead.z);
    const r = bead.radius / (index.planes.zoom.roi.xHi - index.planes.zoom.roi.xLo) * panel.w;
    outline(ctx, () => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); });
    // 1 mm 축척. 구 주변 경계층 두께를 눈으로 잴 수 있게
    const mm = panel.w / ((index.planes.zoom.roi.xHi - index.planes.zoom.roi.xLo) * 1000);
    const sx = panel.x + 10, sy = panel.y + panel.h - 12;
    // 온도장은 바탕이 어둡고 속력장은 밝다
    ctx.fillStyle = field === "temperature" ? "rgba(255,255,255,.9)" : CHART_INK.mark;
    ctx.fillRect(sx, sy, mm, 2);
    ctx.font = CHART_FONT; ctx.textAlign = "left"; ctx.fillText("1 mm", sx + mm + 6, sy + 4);
  }

  ctx.strokeStyle = CHART_INK.grid; ctx.lineWidth = 1;
  ctx.strokeRect(panel.x + 0.5, panel.y + 0.5, panel.w - 1, panel.h - 1);
  ctx.font = CHART_FONT; ctx.fillStyle = CHART_INK.ink; ctx.textAlign = "center";
  ctx.fillText(PANEL_LABEL[panel.plane], panel.x + panel.w / 2, panel.y + panel.h + 14);

  // 창마다 따로인 색 범위
  const { bar } = panel;
  const gradient = ctx.createLinearGradient(0, panel.y + panel.h, 0, panel.y);
  RAMP[field].forEach((color, i) => gradient.addColorStop(i / (RAMP[field].length - 1), color));
  ctx.fillStyle = gradient;
  ctx.fillRect(bar.x, panel.y, bar.w, panel.h);
  ctx.strokeStyle = CHART_INK.grid; ctx.strokeRect(bar.x + 0.5, panel.y + 0.5, bar.w - 1, panel.h - 1);
  const range = valueRange(index, field, panel.plane);
  const digits = field === "temperature" ? (range.max - range.min < 10 ? 1 : 0) : 2;
  const unit = field === "temperature" ? "°C" : "m/s";
  ctx.fillStyle = CHART_INK.ink; ctx.textAlign = "left";
  ctx.fillText(`${range.max.toFixed(digits)} ${unit}`, bar.x + bar.w + 5, panel.y + 9);
  ctx.fillText(`${range.min.toFixed(digits)} ${unit}`, bar.x + bar.w + 5, panel.y + panel.h);
}

export function drawBFieldView() {
  const canvas = $("#bFieldCanvas");
  const setup = setupCanvas(canvas);
  if (!setup || !data || busy) return;
  const { ctx, w, h } = setup;
  ctx.clearRect(0, 0, w, h);
  layout(w, h).forEach(panel => paintPanel(ctx, panel));
  drawBeadTemperature();
  drawBeadHeat();
  updateLabels();
  showBalance();
  hideTip();
}

const historyIndex = () => {
  const now = data.index.frames[frameIndex];
  return Math.max(0, data.history.time_s.findIndex(t => t >= now - 1e-6));
};

// null은 값이 없는 시각이다. 첫 시각의 열량, 그리고 재시작 경계의 한 프레임.
// 조교의 정책대로 그 사이를 메우지 않는다
const present = values => values.filter(v => v !== null);
const series = (t, values, xMap, yMap) =>
  t.flatMap((s, i) => (values[i] === null ? [] : [[xMap(s), yMap(values[i])]]));

function drawBeadTemperature() {
  const setup = setupCanvas($("#bTempChart"));
  if (!setup) return;
  const { ctx, w, h } = setup;
  const { time_s: t, T_bead_avg_C: bead } = data.history;
  const air = data.index.ambientC;
  const lo = Math.min(air, ...present(bead)), hi = Math.max(...present(bead));
  const pad = (hi - lo) * 0.1 || 1, end = t.at(-1);
  const { xMap, yMap } = makeScales(w, h, [0, end], [lo - pad, hi + pad]);
  drawAxes(ctx, w, h, "t (s)", "T (°C)", [0, Math.round(end / 2), end],
    [+lo.toFixed(0), +((lo + hi) / 2).toFixed(0), +hi.toFixed(0)], xMap, yMap);
  const x = xMap(data.index.frames[frameIndex]);
  paintUpTo(ctx, x, h, () => {
    drawLine(ctx, [[xMap(0), yMap(air)], [xMap(end), yMap(air)]], SERIES_COLOR.residual, 1.6, [7, 4]);
    drawLine(ctx, series(t, bead, xMap, yMap), SENSOR_COLOR.black, 2.2);
  });
}

function drawBeadHeat() {
  const setup = setupCanvas($("#bHeatChart"));
  if (!setup) return;
  const { ctx, w, h } = setup;
  const { time_s: t } = data.history;
  // W는 너무 작아 mW로 그린다
  const mW = key => data.history[key].map(v => (v === null ? null : v * 1000));
  const rad = mW("Q_air_to_bead_rad_W"), conv = mW("Q_air_to_bead_conv_W"), net = mW("Q_air_to_bead_total_W");
  const all = present([...rad, ...conv, ...net]);
  const lo = Math.min(0, ...all), hi = Math.max(0, ...all);
  const pad = (hi - lo) * 0.08, end = t.at(-1);
  const { xMap, yMap } = makeScales(w, h, [0, end], [lo - pad, hi + pad]);
  drawAxes(ctx, w, h, "t (s)", "Q (mW)", [0, Math.round(end / 2), end],
    [+lo.toFixed(0), 0, +hi.toFixed(0)], xMap, yMap);
  drawLine(ctx, [[xMap(0), yMap(0)], [xMap(end), yMap(0)]], CHART_INK.grid, 1);
  paintUpTo(ctx, xMap(data.index.frames[frameIndex]), h, () => {
    drawLine(ctx, series(t, rad, xMap, yMap), SERIES_COLOR.rad, 2);
    drawLine(ctx, series(t, conv, xMap, yMap), SERIES_COLOR.conv, 2);
    drawLine(ctx, series(t, net, xMap, yMap), SERIES_COLOR.residual, 2);
  });
}

function showBalance() {
  const i = historyIndex(), hist = data.history;
  const bead = hist.T_bead_avg_C[i], air = data.index.ambientC;
  $("#bCfdAir").innerHTML = `${air.toFixed(2)} <small>°C</small>`;
  $("#bCfdBead").innerHTML = bead === null ? "—" : `${bead.toFixed(2)} <small>°C</small>`;
  $("#bCfdError").innerHTML = bead === null ? "—" : `${(bead - air).toFixed(2)} <small>K</small>`;
  const mW = key => (hist[key][i] === null ? "—" : `${(hist[key][i] * 1000).toFixed(1)} <small>mW</small>`);
  $("#bCfdRad").innerHTML = mW("Q_air_to_bead_rad_W");
  $("#bCfdConv").innerHTML = mW("Q_air_to_bead_conv_W");
  $("#bCfdNet").innerHTML = mW("Q_air_to_bead_total_W");
}

function updateLabels() {
  const { frames } = data.index;
  const now = frames[frameIndex];
  $("#bFieldTimeValue").textContent = `${now.toFixed(1)} / ${frames.at(-1).toFixed(0)} s`;
  $("#bFieldTime").setAttribute("aria-valuetext", `${now.toFixed(1)} seconds`);
  player.renderRate();
  player.label();
  const bead = data.history.T_bead_avg_C[historyIndex()];
  $("#bFieldCanvas").setAttribute("aria-label",
    `At ${now.toFixed(1)} s the bead is at ${bead === null ? "an unrecorded temperature" : `${bead.toFixed(1)} °C`} in air entering at ${data.index.ambientC.toFixed(1)} °C; ` +
    `the heated wall is at ${data.index.jacket.tempC.toFixed(0)} °C.`);
}

function handleProbe(event) {
  const canvas = $("#bFieldCanvas");
  const rect = canvas.getBoundingClientRect();
  const px = event.clientX - rect.left, py = event.clientY - rect.top;
  const panel = layout(rect.width, rect.height).find(p => px >= p.x && px < p.x + p.w && py >= p.y && py < p.y + p.h);
  if (!panel) { hideTip(); return; }
  const u = (px - panel.x) / panel.w, v = (py - panel.y) / panel.h;
  const value = physical(data.index, field, sampleFrame(data, panel.plane, field, frameIndex, u, v), panel.plane);
  const { planes, bead } = data.index;
  const roi = planes[panel.plane].roi;
  const x = roi.xLo + u * (roi.xHi - roi.xLo), z = roi.zHi - v * (roi.zHi - roi.zLo);
  const tubeR = planes.full.roi.xHi;              // 관 안쪽 반지름. 전체 창이 벽에서 벽까지다
  showProbe(probe(), rect, panel, px, py, {
    reading: field === "temperature" ? `${value.toFixed(panel.plane === "zoom" ? 2 : 1)} °C` : `${value.toFixed(3)} m/s`,
    surfaces: [{ name: "bead", d: Math.hypot(x - bead.x, z - bead.z) - bead.radius }, { name: "tube wall", d: tubeR - Math.abs(x) }],
    coords: [["x", x], ["z", z]],
    res: 1 / roi.pxPerM
  });
}

const probe = () => ({ tip: $("#bFieldTip"), coords: $("#bFieldCoords"), crossH: $("#bFieldCrossH"), crossV: $("#bFieldCrossV") });

function hideTip() {
  hideProbe(probe());
}

function setFrame(i) {
  if (!data || busy) return;
  frameIndex = clamp(Math.round(i), 0, data.index.frames.length - 1);
  $("#bFieldTime").value = frameIndex;
  drawBFieldView();
}

function setLoading(value, message = "") {
  busy = value;
  $("#bFieldPending").hidden = !message;
  $("#bFieldPending").textContent = message;
  $("#b-field").setAttribute("aria-busy", String(value));
  $$("#bFieldPlay, #bFieldTime, #b-field .b-field-type").forEach(control => { control.disabled = value || !data; });
}

async function switchCase(button) {
  player.stop();
  const version = ++loadVersion;
  data = null;
  $$(".b-case-pick").forEach(b => b.classList.toggle("is-active", b === button));
  setLoading(true, `Loading ${button.textContent}…`);
  ["bCfdBead", "bCfdAir", "bCfdError", "bCfdRad", "bCfdConv", "bCfdNet", "bFieldTimeValue"]
    .forEach(id => { $(`#${id}`).textContent = "—"; });
  ["bFieldCanvas", "bTempChart", "bHeatChart"].forEach(id => {
    const canvas = $(`#${id}`);
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  });
  try {
    const loaded = await loadCase(button.dataset.case);
    if (version !== loadVersion) return;
    if (!loaded) { setLoading(false, `${button.textContent} is not available yet.`); return; }
    await ensureField(loaded, field);
    if (version !== loadVersion) return;
    data = loaded;
    $("#bFieldTime").max = data.index.frames.length - 1;
    setLoading(false);
    player.renderTicks();
    setFrame(data.index.frames.length - 1);
  } catch (error) {
    if (version === loadVersion) setLoading(false, "Could not load this case. Pick another or reload to retry.");
  }
}

export function initBFieldViewer() {
  player = createPlayer({
    play: $("#bFieldPlay"), ticks: $("#bFieldTicks"), rateValue: $("#bPlayRateValue"), rateButtons: $$("#b-field .play-rate")
  }, {
    frames: () => data?.index.frames ?? null,
    current: () => frameIndex,
    setFrame,
    isActive: () => !busy && $("#b-field").classList.contains("is-active")
  });

  const picks = $$(".b-case-pick");
  picks.forEach(b => { b.disabled = true; });
  Promise.all(picks.map(async button => {
    let ok = false;
    try { ok = (await fetch(`assets/data/cfd/${button.dataset.case}/index.json`, { method: "HEAD" })).ok; } catch { /* 연결 실패도 선택 불가 */ }
    button.disabled = !ok;
    return ok ? button : null;
  })).then(buttons => {
    const first = buttons.find(Boolean);
    if (first) switchCase(first);
    else setLoading(false, "No computed case could be loaded. Reload to retry.");
  });
  picks.forEach(button => button.addEventListener("click", () => switchCase(button)));

  $$(".b-field-type").forEach(button => button.addEventListener("click", async () => {
    if (!data || busy) return;
    player.stop();
    const version = ++loadVersion;
    const nextField = button.dataset.field;
    setLoading(true, `Loading ${button.textContent.toLowerCase()}…`);
    try {
      await ensureField(data, nextField);
      if (version !== loadVersion) return;
      field = nextField;
      $$(".b-field-type").forEach(item => {
        item.classList.toggle("is-active", item === button);
        item.setAttribute("aria-pressed", String(item === button));
      });
      setLoading(false);
      drawBFieldView();
    } catch (error) {
      if (version === loadVersion) setLoading(false, "Could not load this field. Select it again to retry.");
    }
  }));

  const step = delta => { player.stop(); setFrame(frameIndex + delta); };
  $("#bFieldTime").addEventListener("input", () => { player.stop(); setFrame(numberValue("#bFieldTime", 0)); });
  $("#bFieldPlay").addEventListener("click", () => { if (data && !busy) player.toggle(); });
  $("#bFieldCanvas").addEventListener("pointermove", event => { if (data && !busy) handleProbe(event); });
  $("#bFieldCanvas").addEventListener("pointerleave", hideTip);

  document.addEventListener("keydown", event => {
    if (!data || busy || document.querySelector("dialog[open]") || !$("#b-field").classList.contains("is-active")) return;
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
