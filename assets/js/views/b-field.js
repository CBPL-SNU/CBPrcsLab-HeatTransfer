// 실험 B 관찰 화면: 가열된 관과 그 가운데 열전대 구의 CFD 단면을 재생한다.

import { $, $$, clamp, numberValue } from "../core/dom.js";
import { setupCanvas, drawAxes, drawLine, drawArea, makeScales, paintUpTo, CHART_INK, CHART_FONT, SERIES_COLOR, SENSOR_COLOR } from "../core/chart.js";
import { loadCase, ensureField, physical, saturated, valueRange } from "../core/cfd-loader.js";
import { RAMP, paintFrame, sampleFrame, createPlayer, showProbe, hideProbe } from "../core/field-player.js";

const PANEL_LABEL = { full: "Heated section", zoom: "Around the bead" };

let data = null;
let field = "temperature";
let frameIndex = 0;
let busy = false;
let loadVersion = 0;
let player = null;
let preferredBead = "large";       // 학생이 고른 구. 그 크기가 없는 조건에서는 큰 구를 보이고 선택은 기억한다
let flowButton = null;

// 왼쪽은 가열 구간 전체(좁고 길다), 오른쪽은 구 주변(정사각형). 각 창 오른쪽에 자기 색 범위.
const NARROW = 520;                // 이보다 좁으면 두 창을 위아래로 쌓는다
const STACK = { margin: 8, labelH: 20, gap: 16, side: 68 };

// 좁은 화면: 확대 창을 위에 크게, 가열 구간을 그 아래에. 한 줄에 두면 창이 100 px 남짓으로 줄어든다
function stackedSize(w) {
  const { margin, side } = STACK;
  return Math.min(w - 2 * margin - side, 320);
}
function stackedHeight(w) {
  const { margin, labelH, gap } = STACK;
  return 2 * stackedSize(w) + 2 * labelH + gap + 2 * margin;
}

function layout(w, h) {
  const { full, zoom } = data.index.planes;
  const margin = 8, labelH = 20, bar = 10, barText = 52, gap = 36;
  const fullAspect = full.w / full.h, zoomAspect = zoom.w / zoom.h;
  if (w < NARROW) {
    const s = stackedSize(w);
    const zx = (w - s - STACK.side) / 2, fwid = s * fullAspect;
    const fx = (w - fwid - STACK.side) / 2, fy = margin + s + labelH + STACK.gap;
    return [
      { plane: "full", x: fx, y: fy, w: fwid, h: s, bar: { x: fx + fwid + 6, w: bar }, stacked: true },
      { plane: "zoom", x: zx, y: margin, w: s, h: s * zoom.h / zoom.w, bar: { x: zx + s + 6, w: bar }, stacked: true }
    ];
  }
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
    if (panel.stacked) {
      // 확대 창이 위에 있으므로 상자 위 두 모서리에서 확대 창 아래 두 모서리로
      ctx.moveTo(bx0, by0); ctx.lineTo(zoom.x, zoom.y + zoom.h);
      ctx.moveTo(bx1, by0); ctx.lineTo(zoom.x + zoom.w, zoom.y + zoom.h);
    } else {
      ctx.moveTo(bx1, by0); ctx.lineTo(zoom.x, zoom.y);
      ctx.moveTo(bx1, by1); ctx.lineTo(zoom.x, zoom.y + zoom.h);
    }
    ctx.stroke(); ctx.setLineDash([]);
  } else {
    const [cx, cy] = toPanel(panel, bead.x, bead.z);
    const r = bead.radius / (index.planes.zoom.roi.xHi - index.planes.zoom.roi.xLo) * panel.w;
    outline(ctx, () => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); });
    // 축척 막대. 창 폭의 1/5 이하인 가장 큰 깔끔한 길이. 구 주변 경계층 두께를 눈으로 잴 수 있게
    const widthMm = (index.planes.zoom.roi.xHi - index.planes.zoom.roi.xLo) * 1000;
    const barMm = [2, 1, 0.5, 0.2, 0.1].find(len => len <= widthMm / 5) ?? 0.1;
    const mm = panel.w / widthMm * barMm;
    const sx = panel.x + 10, sy = panel.y + panel.h - 12;
    // 온도장은 바탕이 어둡고 속력장은 밝다
    ctx.fillStyle = field === "temperature" ? "rgba(255,255,255,.9)" : CHART_INK.mark;
    ctx.fillRect(sx, sy, mm, 2);
    ctx.font = CHART_FONT; ctx.textAlign = "left"; ctx.fillText(`${barMm} mm`, sx + mm + 6, sy + 4);
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
  ctx.fillText(`${range.clipped ? "≥ " : ""}${range.max.toFixed(digits)} ${unit}`, bar.x + bar.w + 5, panel.y + 9);
  ctx.fillText(`${range.min.toFixed(digits)} ${unit}`, bar.x + bar.w + 5, panel.y + panel.h);
}

export function drawBFieldView() {
  const canvas = $("#bFieldCanvas");
  if (!canvas) return;
  const width = canvas.clientWidth;
  canvas.style.height = width && width < NARROW ? `${stackedHeight(width)}px` : "";
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
  // 팬이 꺼진 5 V는 1 K 안에서 움직인다. 정수로 반올림하면 눈금이 한 점으로 겹친다
  const digits = hi - lo < 5 ? 1 : 0;
  drawAxes(ctx, w, h, "t (s)", "T (°C)", [0, Math.round(end / 2), end],
    [+lo.toFixed(digits), +((lo + hi) / 2).toFixed(digits), +hi.toFixed(digits)], xMap, yMap);
  const x = xMap(data.index.frames[frameIndex]);
  paintUpTo(ctx, x, h, () => {
    drawLine(ctx, [[xMap(0), yMap(air)], [xMap(end), yMap(air)]], SERIES_COLOR.residual, 1.6, [7, 4]);
    drawLine(ctx, series(t, bead, xMap, yMap), SENSOR_COLOR.black, 2.2);
  });
}

// 들어오는 복사와 나가는 대류를 둘 다 양수로 그린다. 두 선 사이가 구를 데우는 몫이고,
// 두 선이 만나면 구가 평형에 이른 것이다. 실험 A의 "Warming the heater"와 같은 읽기다.
function drawBeadHeat() {
  const setup = setupCanvas($("#bHeatChart"));
  if (!setup) return;
  const { ctx, w, h } = setup;
  const { time_s: t, Q_air_to_bead_rad_W: radW, Q_air_to_bead_conv_W: convW } = data.history;
  // W는 너무 작아 mW로 그린다. 첫 시각과 재시작 경계는 값이 없다
  const rows = t.flatMap((s, i) => (radW[i] === null || convW[i] === null ? []
    : [{ t: s, inn: radW[i] * 1000, out: -convW[i] * 1000 }]));
  const values = rows.flatMap(r => [r.inn, r.out]);
  const lo = Math.min(0, ...values), hi = Math.max(...values) * 1.1, end = t.at(-1);
  const { xMap, yMap } = makeScales(w, h, [0, end], [lo, hi]);
  // 작은 구는 1 mW 안쪽이라 눈금 자릿수를 범위에 맞춘다
  const digits = hi - lo < 5 ? 2 : 0;
  // 자연대류는 시작 직후 뜨거운 공기가 구를 데워 대류가 음수로 크게 내려간다. 그때는 아래 끝도 눈금으로 단다
  const ticks = lo < -0.1 * hi ? [lo, 0, hi] : [0, hi / 2, hi];
  drawAxes(ctx, w, h, "t (s)", "Q (mW)", [0, Math.round(end / 2), end],
    ticks.map(v => +v.toFixed(digits)), xMap, yMap);
  const inn = rows.map(r => [xMap(r.t), yMap(r.inn)]), out = rows.map(r => [xMap(r.t), yMap(r.out)]);
  paintUpTo(ctx, xMap(data.index.frames[frameIndex]), h, () => {
    drawArea(ctx, inn, out, SERIES_COLOR.residual);
    drawLine(ctx, inn, SERIES_COLOR.rad, 2);
    drawLine(ctx, out, SERIES_COLOR.conv, 2);
  });
}

function showBalance() {
  const i = historyIndex(), hist = data.history;
  const bead = hist.T_bead_avg_C[i], air = data.index.ambientC;
  $("#bCfdAir").innerHTML = `${air.toFixed(2)} <small>°C</small>`;
  $("#bCfdWall").innerHTML = `${data.index.jacket.tempC.toFixed(1)} <small>°C</small>`;
  $("#bCfdBead").innerHTML = bead === null ? "—" : `${bead.toFixed(2)} <small>°C</small>`;
  $("#bCfdError").innerHTML = bead === null ? "—" : `${(bead - air).toFixed(2)} <small>K</small>`;
  // 큰 구는 수십 mW, 작은 구는 1 mW 안쪽이다
  const mW = (key, sign) => {
    const v = hist[key][i] === null ? null : sign * hist[key][i];
    if (v === null) return "—";
    return `${(v * 1000).toFixed(Math.abs(v * 1000) < 10 ? 2 : 1)} <small>mW</small>`;
  };
  $("#bCfdRad").innerHTML = mW("Q_air_to_bead_rad_W", 1);
  $("#bCfdConv").innerHTML = mW("Q_air_to_bead_conv_W", -1);
  $("#bCfdNet").innerHTML = mW("Q_air_to_bead_total_W", 1);
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
  const byte = sampleFrame(data, panel.plane, field, frameIndex, u, v);
  const value = physical(data.index, field, byte, panel.plane);
  const atLeast = saturated(data.index, field, byte, panel.plane) ? "≥ " : "";
  const { planes, bead } = data.index;
  const roi = planes[panel.plane].roi;
  const x = roi.xLo + u * (roi.xHi - roi.xLo), z = roi.zHi - v * (roi.zHi - roi.zLo);
  const tubeR = planes.full.roi.xHi;              // 관 안쪽 반지름. 전체 창이 벽에서 벽까지다
  showProbe(probe(), rect, panel, px, py, {
    reading: atLeast + (field === "temperature" ? `${value.toFixed(panel.plane === "zoom" ? 2 : 1)} °C` : `${value.toFixed(3)} m/s`),
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

const caseOf = (flow, bead) => flow.dataset[bead === "small" ? "caseSmall" : "caseLarge"];

// 유동 조건과 구 크기를 case 하나로 바꾼다
function pick(flow) {
  flowButton = flow;
  const bead = caseOf(flow, preferredBead) ? preferredBead : "large";
  $$(".b-flow").forEach(b => b.classList.toggle("is-active", b === flow));
  $$(".b-bead").forEach(b => {
    const on = b.dataset.bead === bead;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", String(on));
    b.disabled = !caseOf(flow, b.dataset.bead);
  });
  const beadLabel = $(`.b-bead[data-bead="${bead}"]`).textContent;
  switchCase(caseOf(flow, bead), `${flow.textContent}, ${beadLabel} bead`);
}

async function switchCase(caseId, label) {
  player.stop();
  const version = ++loadVersion;
  data = null;
  setLoading(true, `Loading ${label}…`);
  ["bCfdBead", "bCfdAir", "bCfdWall", "bCfdError", "bCfdRad", "bCfdConv", "bCfdNet", "bFieldTimeValue"]
    .forEach(id => { $(`#${id}`).textContent = "—"; });
  ["bFieldCanvas", "bTempChart", "bHeatChart"].forEach(id => {
    const canvas = $(`#${id}`);
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  });
  try {
    const loaded = await loadCase(caseId);
    if (version !== loadVersion) return;
    if (!loaded) { setLoading(false, `${label} is not available yet.`); return; }
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

  // 산출물이 있는 조건만 누를 수 있다. 처음에는 두 구를 비교할 수 있는 1.6 m/s를 연다
  const flows = $$(".b-flow");
  const available = async id => {
    try { return (await fetch(`assets/data/cfd/${id}/index.json`, { method: "HEAD" })).ok; } catch { return false; }
  };
  flows.forEach(b => { b.disabled = true; });
  $$(".b-bead").forEach(b => { b.disabled = true; });
  Promise.all(flows.map(async flow => {
    for (const key of ["caseLarge", "caseSmall"]) {
      if (flow.dataset[key] && !(await available(flow.dataset[key]))) delete flow.dataset[key];
    }
    flow.disabled = !flow.dataset.caseLarge;
    return flow.disabled ? null : flow;
  })).then(ready => {
    const open = ready.filter(Boolean);
    const first = open.find(flow => flow.dataset.caseSmall) ?? open[0];
    if (first) pick(first);
    else setLoading(false, "No computed case could be loaded. Reload to retry.");
  });
  flows.forEach(flow => flow.addEventListener("click", () => pick(flow)));
  $$(".b-bead").forEach(button => button.addEventListener("click", () => {
    preferredBead = button.dataset.bead;
    if (flowButton) pick(flowButton);
  }));

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
