// 실험 B 장치 화면: HT16 단면을 치수 데이터에서 그리고, 부품을 누르면 설명을 보여준다.

import { $, $$ } from "../core/dom.js";
import { HT16, PX_PER_MM_B } from "../data/apparatus.js";
import { componentData, componentOrder } from "../data/components.js";

// 가열 구간 주변(Watch the flow 창과 그 위 리드)은 축척대로, 그 아래는 줄여 그린다. 실험 A와 같은 방식
const PX_PER_M = PX_PER_MM_B * 1000;
const SQUEEZE = 400;            // 줄인 구간의 축척 [px/m]
const BREAK_H = 22;
const TOP = 44;
const CX = 250;
const W = 580;
const MIN_BEAD_R = 1.6;         // 단면의 구는 위치 표시일 뿐이다. 크기는 확대 그림에서 본다 [px]
// 비드 확대 그림. 세 비드를 한 칸씩 따로, 같은 배율로 그린다. 크기 차이가 이 화면의 핵심이다.
// 좌우 간격은 그림에서 어림한 값이라 칸을 나누면 간격을 주장하지 않아도 된다
const ZOOM = 10;
const CELL = 74, CELL_GAP = 10, CLOSE_X = 360;   // 칸 한 변, 칸 사이, 칸들의 왼쪽 [px]
const LABEL_W = 122;                               // 칸 오른쪽 이름표 자리. 선택 상자가 칸과 이름표를 함께 감싼다 [px]
const HIT_PAD = 4;                                 // 선택 상자와 칸 사이 여백. 세 칸 모두 같다 [px]
const CELL_ORDER = ["b-t8", "b-t7", "b-t6"];     // 위에서부터. T8–T7은 크기, T7–T6은 방사율이 다르다

const rig = HT16;
const rIn = rig.duct.innerD / 2 * PX_PER_M;
const wall = rig.duct.wall * PX_PER_M;
const Z_BREAK = rig.window.zLo - 0.01;
const yBreakTop = TOP + (rig.duct.outletZ - Z_BREAK) * PX_PER_M;
const yBreakBottom = yBreakTop + BREAK_H;

function yOf(z) {
  if (z >= Z_BREAK) return TOP + (rig.duct.outletZ - z) * PX_PER_M;
  return yBreakBottom + (Z_BREAK - z) * SQUEEZE;
}
const xOf = x => CX + x * PX_PER_M;
const f = n => n.toFixed(1);
const inSqueeze = z => z < Z_BREAK;
const arrow = (cls, d, marker) => `<path class="${cls}" d="${d}" marker-end="url(#${marker})"/>`;

function label(part, x, y, anchorX, side, lift = 0) {
  const tx = side === "right" ? anchorX + 8 : anchorX - 8;
  const align = side === "right" ? "start" : "end";
  const yText = y - lift;
  const bend = lift ? `V${f(yText)} ` : "";
  return `
    <path class="part-leader" d="M${f(x)} ${f(y)} ${bend}H${f(anchorX)}"/>
    <text class="part-label" id="blabel-${part.id}" x="${f(tx)}" y="${f(yText + 4)}" text-anchor="${align}">${part.name}</text>`;
}

function group(part, inner) {
  const squeezed = part.z !== undefined && inSqueeze(part.z) ? " apparatus-part--squeezed" : "";
  return `<g class="apparatus-part${squeezed}" data-part="${part.id}" tabindex="0" role="button" aria-labelledby="blabel-${part.id}">${inner}</g>`;
}

function wave(y, x0, x1) {
  const a = 3, p = 14; let d = `M${f(x0)} ${f(y)}`;
  for (let x = x0; x < x1; x += p) d += ` q${p / 4} ${-a} ${p / 2} 0 q${p / 4} ${a} ${p / 2} 0`;
  return d;
}

// 복사의 관례 기호: 물결선
function wavyArrow(x0, y0, x1, y1) {
  const n = 4, a = 1.4;
  const dx = (x1 - x0) / n, dy = (y1 - y0) / n, L = Math.hypot(dx, dy);
  const nx = -dy / L * a, ny = dx / L * a;
  let d = `M${f(x0)} ${f(y0)}`;
  for (let i = 0; i < n; i++) {
    const sgn = i % 2 ? -1 : 1;
    d += ` q${f(dx / 2 + sgn * nx)} ${f(dy / 2 + sgn * ny)} ${f(dx)} ${f(dy)}`;
  }
  d += ` l${f(dx / 3)} ${f(dy / 3)}`;
  return arrow("rad-path", d, "bArrowRad");
}

// 밴드 히터 안의 전열선. 지그재그
function coil(x, y0, y1, w) {
  let d = `M${f(x + w * 0.25)} ${f(y0 + 4)}`;
  for (let y = y0 + 4, i = 0; y < y1 - 6; y += 6, i++) d += ` L${f(x + (i % 2 ? w * 0.25 : w * 0.75))} ${f(y + 6)}`;
  return `<path class="heater-coil" d="${d}"/>`;
}

// 비드 확대 칸. 칸 안에서는 축척대로다 (단면의 ×10)
function closeup(parts, y0) {
  const k = ZOOM * PX_PER_M, body = { "b-t6": "small grey", "b-t7": "small black", "b-t8": "large black" };
  const cells = CELL_ORDER.map((id, n) => {
    const p = parts[id], x = CLOSE_X, y = y0 + n * (CELL + CELL_GAP), cx = x + CELL / 2, cy = y + CELL / 2 + 6;
    const r = Math.max(p.d / 2 * k, 1.5), tx = x + CELL + 10;
    return `<g class="apparatus-part closeup-cell" data-part="${id}" tabindex="0" role="button" aria-labelledby="blabel-${id}">
      <rect class="part-hit" x="${f(x - HIT_PAD)}" y="${f(y - HIT_PAD)}" width="${f(CELL + LABEL_W + 2 * HIT_PAD)}" height="${f(CELL + 2 * HIT_PAD)}" rx="7"/>
      <rect class="closeup-box" x="${f(x)}" y="${f(y)}" width="${CELL}" height="${CELL}" rx="5"/>
      <path class="tc-lead tc-lead--close" d="M${f(cx)} ${f(y)} V${f(cy - r)}" aria-hidden="true"/>
      <g class="flow-layer" data-layer-group="radiation" aria-hidden="true">
        ${wavyArrow(x + 4, cy, cx - r - 4, cy)}${wavyArrow(x + CELL - 4, cy, cx + r + 4, cy)}
      </g>
      <g class="flow-layer" data-layer-group="convection" aria-hidden="true">
        ${arrow("conv-path", `M${f(cx + r * 0.7 + 2)} ${f(cy - r * 0.7 - 2)} C${f(cx + r + 8)} ${f(cy - r - 8)} ${f(cx + r + 4)} ${f(y + 16)} ${f(cx + r + 8)} ${f(y + 6)}`, "bArrowConv")}
      </g>
      <circle class="bead ${id === "b-t6" ? "bead--grey" : "bead--black"}" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/>
      <text class="part-label" id="blabel-${id}" x="${f(tx)}" y="${f(cy + 5)}">${p.name} <tspan class="part-kind">${body[id]}</tspan></text>
    </g>`;
  }).join("");
  return `
  <!-- 세 비드를 한 칸씩. 리드는 위에서 내려온다 -->
  <text class="closeup-title" x="${f(CLOSE_X)}" y="${f(y0 - 8)}" aria-hidden="true">Beads, ×${ZOOM}</text>
  <g class="scale-bar" aria-hidden="true">
    <path d="M${f(CLOSE_X)} ${f(y0 + 3 * CELL + 2 * CELL_GAP + 12)} h${f(0.002 * k)}"/>
    <text x="${f(CLOSE_X + 0.002 * k + 6)}" y="${f(y0 + 3 * CELL + 2 * CELL_GAP + 16)}">2 mm</text>
  </g>
  ${cells}`;
}

export function buildDiagramB() {
  const parts = Object.fromEntries(rig.parts.map(p => [p.id, p]));
  const yTop = yOf(rig.duct.outletZ), yInlet = yOf(rig.duct.inletZ);
  const xL = CX - rIn, xR = CX + rIn, xLo = xL - wall, xRo = xR + wall;
  const band = rig.heater.band * PX_PER_M;
  const rightAnchor = xRo + band + 56, leftAnchor = xLo - band - 48;
  const yHT = yOf(rig.heater.zHi), yHB = yOf(rig.heater.zLo);
  const sh = rig.shield, shW = sh.d * PX_PER_M, ySH = yOf(sh.zHi), ySL = yOf(sh.zLo);
  const yLead = yOf(rig.leadZ);
  const beads = ["b-t6", "b-t8", "b-t7"].map(id => parts[id]);
  const yB = yOf(parts["b-t8"].z);
  const t10 = parts["b-t10"], an = parts["b-anemometer"], t5 = parts["b-t5"];
  const yT10 = yOf(t10.z), yAn = yOf(an.z), yT5 = yOf(t5.z);
  const win = rig.window;
  const yTrans = yInlet + 14, yCase = yTrans + 4, caseH = 56, yCaseMid = yCase + caseH / 2;
  const height = yCase + caseH + 26;
  // 확대 칸 묶음은 비드 높이에 가운데를 맞춘다. 단면에는 세 비드를 둘러싼 표시만 둔다
  const stackH = 3 * CELL + 2 * CELL_GAP, cy0 = yB - stackH / 2;
  const cw = 34, ch = 12;

  return `
<svg class="apparatus-diagram" style="--diagram-width: ${W}px" viewBox="0 0 ${W} ${f(height)}" role="group" aria-label="Section through the HT16 duct. Parts are buttons; press one to read about it.">
  <defs>
    <marker id="bArrowAir" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" refX="5.4" refY="3.5" orient="auto"><path class="arrow-air" d="M0,0 L7,3.5 L0,7 z"/></marker>
    <marker id="bArrowConv" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" refX="5.4" refY="3.5" orient="auto"><path class="arrow-conv" d="M0,0 L7,3.5 L0,7 z"/></marker>
    <marker id="bArrowRad" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" refX="5.4" refY="3.5" orient="auto"><path class="arrow-rad" d="M0,0 L7,3.5 L0,7 z"/></marker>
    <pattern id="bSqueezeHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <path class="squeeze-hatch" d="M0 0 V8"/>
    </pattern>
  </defs>

  <g class="scale-bar" aria-hidden="true">
    <path d="M${f(W - 8 - 0.05 * PX_PER_M)} ${f(TOP - 22)} h${f(0.05 * PX_PER_M)}"/>
    <text x="${f(W - 8)}" y="${f(TOP - 27)}" text-anchor="end">50 mm</text>
  </g>

  <rect class="window-box" x="${f(xLo - band - 6)}" y="${f(yOf(win.zHi) - 4)}" width="${f(xRo - xLo + 2 * band + 12)}" height="${f(yOf(win.zLo) - yOf(win.zHi) + 8)}" rx="4" aria-hidden="true"/>
  <text class="window-label" x="${f(xLo - band - 10)}" y="${f(yOf(win.zHi) + 14)}" text-anchor="end" aria-hidden="true">${((win.zHi - win.zLo) * 100).toFixed(0)} cm in Watch the flow</text>

  ${group(parts["b-duct"], `
    <rect class="part-hit" x="${f(xLo - 3)}" y="${f(yTop)}" width="${f(xRo - xLo + 6)}" height="${f(yInlet - yTop)}"/>
    <rect class="duct-air" x="${f(xL)}" y="${f(yTop)}" width="${f(xR - xL)}" height="${f(yBreakTop - yTop)}"/>
    <rect class="duct-air" x="${f(xL)}" y="${f(yBreakBottom)}" width="${f(xR - xL)}" height="${f(yInlet - yBreakBottom)}"/>
    <rect fill="url(#bSqueezeHatch)" x="${f(xL)}" y="${f(yBreakBottom)}" width="${f(xR - xL)}" height="${f(yInlet - yBreakBottom)}"/>
    <path class="cfd-cut" d="M${f(xLo - 10)} ${f(yOf(rig.cfd.zLo))} H${f(xR)}"/>
    <text class="break-label" x="${f(xLo - 14)}" y="${f(yOf(rig.cfd.zLo) + 4)}" text-anchor="end">CFD computed above this line</text>
    <rect class="duct-wall" x="${f(xLo)}" y="${f(yTop)}" width="${f(wall)}" height="${f(yBreakTop - yTop)}"/>
    <rect class="duct-wall" x="${f(xR)}" y="${f(yTop)}" width="${f(wall)}" height="${f(yBreakTop - yTop)}"/>
    <rect class="duct-wall" x="${f(xLo)}" y="${f(yBreakBottom)}" width="${f(wall)}" height="${f(yInlet - yBreakBottom)}"/>
    <rect class="duct-wall" x="${f(xR)}" y="${f(yBreakBottom)}" width="${f(wall)}" height="${f(yInlet - yBreakBottom)}"/>
    <path class="break-line" d="${wave(yBreakTop + 3, xLo - band - 6, xRo + band + 6)}"/>
    <path class="break-line" d="${wave(yBreakBottom - 3, xLo - band - 6, xRo + band + 6)}"/>
    <text class="break-label" x="${f(xRo + band + 12)}" y="${f(yBreakTop + BREAK_H / 2 + 4)}">lower ${((Z_BREAK - rig.duct.inletZ) * 100).toFixed(0)} cm compressed</text>
    ${label(parts["b-duct"], xLo, yOf(0.86), leftAnchor, "left")}`)}

  <!-- 흐름. 공기는 차폐통 옆으로 올라가고, 복사는 가열 벽에서 구로, 대류는 구에서 공기로 -->
  <g class="flow-layer" data-layer-group="air" aria-hidden="true">
    ${[-34, 34].map(dx => arrow("air-path", `M${f(CX + dx)} ${f(yInlet - 6)} V${f(yBreakBottom + 10)}`, "bArrowAir")
      + arrow("air-path", `M${f(CX + dx)} ${f(yBreakTop - 6)} V${f(yTop + 10)}`, "bArrowAir")).join("")}
  </g>
  <g class="flow-layer" data-layer-group="radiation" aria-hidden="true">
    ${[-1, 1].map(sx => wavyArrow(sx < 0 ? xL + 3 : xR - 3, yB + 22, CX + sx * 22, yB + 22)).join("")}
  </g>

  <!-- 밴드 히터: 관 바깥을 감싼다. 단면에서는 양쪽 벽 밖의 두 띠로 보인다 -->
  ${group(parts["b-heater-wall"], `
    <rect class="part-hit" x="${f(xLo - band - 4)}" y="${f(yHT - 4)}" width="${f(xRo - xLo + 2 * band + 8)}" height="${f(yHB - yHT + 8)}"/>
    <rect class="heater-band" x="${f(xLo - band)}" y="${f(yHT)}" width="${f(band)}" height="${f(yHB - yHT)}" rx="2"/>
    <rect class="heater-band" x="${f(xRo)}" y="${f(yHT)}" width="${f(band)}" height="${f(yHB - yHT)}" rx="2"/>
    ${coil(xLo - band, yHT, yHB, band)}${coil(xRo, yHT, yHB, band)}
    <rect class="heater-hot-wall" x="${f(xL - 1.5)}" y="${f(yHT)}" width="3" height="${f(yHB - yHT)}"/>
    <rect class="heater-hot-wall" x="${f(xR - 1.5)}" y="${f(yHT)}" width="3" height="${f(yHB - yHT)}"/>
    <path class="sensor-stem" d="M${f(xRo + band)} ${f(yHB - 10)} c14 0 18 10 18 28"/>
    ${label(parts["b-heater-wall"], xLo - band, yOf(0.655), leftAnchor, "left")}`)}

  <!-- 차폐통과 열전대 리드: 리드는 오른쪽에서 들어와 꺾여 내려오고, 차폐통 아래에서 세 구로 갈라진다 -->
  ${group(parts["b-shield"], `
    <rect class="part-hit" x="${f(CX - shW / 2 - 4)}" y="${f(ySH - 4)}" width="${f(shW + 8)}" height="${f(ySL - ySH + 8)}"/>
    <path class="shield-rod" d="M${f(CX - shW / 2 + 5)} ${f(ySH)} V${f(TOP - 10)}"/>
    <rect class="shield-handle" x="${f(CX - shW / 2 - 24)}" y="${f(TOP - 18)}" width="32" height="9" rx="2"/>
    <rect class="shield-body" x="${f(CX - shW / 2)}" y="${f(ySH)}" width="${f(shW)}" height="${f(ySL - ySH)}" rx="2"/>
    ${label(parts["b-shield"], CX - shW / 2, yOf(0.79), leftAnchor, "left")}`)}
  <path class="tc-sheath" d="M${f(xRo + band + 46)} ${f(yLead)} H${f(CX + 10)} q-10 0 -10 10 V${f(ySL)}" aria-hidden="true"/>

  <!-- 단면의 비드는 자리만 표시한다. 확대 그림과 점선으로 잇는다 -->
  <g aria-hidden="true">
    ${beads.map(p => `<path class="tc-lead" d="M${f(CX)} ${f(ySL)} L${f(xOf(p.x))} ${f(yB)}"/>
    <circle class="bead ${p.id === "b-t6" ? "bead--grey" : "bead--black"}" cx="${f(xOf(p.x))}" cy="${f(yB)}" r="${f(MIN_BEAD_R)}"/>`).join("")}
    <rect class="closeup-mark" x="${f(CX - cw / 2)}" y="${f(yB - ch / 2)}" width="${f(cw)}" height="${f(ch)}"/>
    <path class="closeup-link" d="M${f(CX + cw / 2)} ${f(yB - ch / 2)} L${f(CLOSE_X)} ${f(cy0)} M${f(CX + cw / 2)} ${f(yB + ch / 2)} L${f(CLOSE_X)} ${f(cy0 + stackH)}"/>
  </g>
  ${closeup(parts, cy0)}

  <!-- T10: 가열 벽 위의 열전대 -->
  ${group(t10, `
    <circle class="part-hit" cx="${f(xL - wall / 2)}" cy="${f(yT10)}" r="8"/>
    <circle class="sensor sensor--surface" cx="${f(xL - wall / 2)}" cy="${f(yT10)}" r="3.5"/>
    ${label(t10, xLo - band, yT10, leftAnchor, "left")}`)}

  ${group(an, `
    <rect class="part-hit" x="${f(CX - 24)}" y="${f(yAn - 14)}" width="${f(xR - CX + 26)}" height="28"/>
    <path class="sensor-stem" d="M${f(CX + 14)} ${f(yAn)} H${f(xR)}"/>
    <path class="anemometer" d="M${f(CX - 18)} ${f(yAn - 8)} L${f(CX)} ${f(yAn)} L${f(CX - 18)} ${f(yAn + 8)} Z M${f(CX + 18)} ${f(yAn - 8)} L${f(CX)} ${f(yAn)} L${f(CX + 18)} ${f(yAn + 8)} Z"/>
    <circle class="anemometer-hub" cx="${f(CX)}" cy="${f(yAn)}" r="3"/>
    ${label(an, xR, yAn, rightAnchor, "right")}`)}

  <!-- T5: 오른쪽 벽으로 들어와 아래로 꺾인 공기 온도 열전대. 가열 구간보다 아래라 데워지기 전의 공기다 -->
  ${group(t5, `
    <circle class="part-hit" cx="${f(xOf(t5.x))}" cy="${f(yT5)}" r="9"/>
    <path class="sensor-stem" d="M${f(xR)} ${f(yT5 - 14)} H${f(xOf(t5.x) + 6)} q-6 0 -6 6 V${f(yT5 - 4)}"/>
    <circle class="sensor sensor--air" cx="${f(xOf(t5.x))}" cy="${f(yT5)}" r="4"/>
    ${label(t5, xR, yT5 - 14, rightAnchor, "right")}`)}

  ${group(parts["b-fan"], `
    <rect class="part-hit" x="${f(xLo - 46)}" y="${f(yInlet)}" width="${f(xRo - xLo + 62)}" height="${f(caseH + 22)}"/>
    <path class="fan-transition" d="M${f(xLo)} ${f(yInlet)} L${f(xLo - 6)} ${f(yTrans)} H${f(xRo + 6)} L${f(xRo)} ${f(yInlet)} Z"/>
    <rect class="fan-box" x="${f(xLo - 6)}" y="${f(yCase)}" width="${f(xRo - xLo + 12)}" height="${f(caseH)}" rx="3"/>
    <circle class="fan-hub" cx="${f(CX)}" cy="${f(yCaseMid)}" r="${f(caseH / 2 - 8)}"/>
    <path class="fan-blade" d="M${f(CX)} ${f(yCaseMid - (caseH / 2 - 8))} A${f(caseH / 2 - 8)} ${f(caseH / 2 - 8)} 0 0 1 ${f(CX + (caseH / 2 - 8) * 0.85)} ${f(yCaseMid + (caseH / 2 - 8) * 0.5)} M${f(CX)} ${f(yCaseMid + (caseH / 2 - 8))} A${f(caseH / 2 - 8)} ${f(caseH / 2 - 8)} 0 0 1 ${f(CX - (caseH / 2 - 8) * 0.85)} ${f(yCaseMid - (caseH / 2 - 8) * 0.5)}"/>
    <rect class="fan-motor" x="${f(xLo - 44)}" y="${f(yCase + 10)}" width="36" height="${f(caseH - 20)}" rx="2"/>
    <path class="fan-base" d="M${f(xLo - 50)} ${f(yCase + caseH + 6)} H${f(xRo + 30)}"/>
    ${label(parts["b-fan"], xLo - 44, yCaseMid, leftAnchor, "left")}`)}
  ${group(parts["b-throttle"], `
    <rect class="part-hit" x="${f(xRo + 4)}" y="${f(yCaseMid - 16)}" width="34" height="32"/>
    <rect class="throttle-inlet" x="${f(xRo + 6)}" y="${f(yCaseMid - 12)}" width="4" height="24"/>
    <path class="throttle-stem" d="M${f(xRo + 10)} ${f(yCaseMid)} H${f(xRo + 22)}"/>
    <ellipse class="throttle-disc" cx="${f(xRo + 24)}" cy="${f(yCaseMid)}" rx="3.5" ry="14"/>
    ${label(parts["b-throttle"], xRo + 28, yCaseMid, rightAnchor, "right")}`)}
</svg>`;
}

// 도식의 범례처럼 한 줄에 하나. 이름 뒤에 무엇인지 짧게
const partRow = id => {
  const name = rig.parts.find(p => p.id === id)?.name ?? componentData[id].label;
  const what = componentData[id].label.split(" · ")[1] ?? "";
  return `<button class="part-row" type="button" data-part="${id}"><b>${name}</b>${what ? `<span>${what}</span>` : ""}</button>`;
};

function selectPart(partId) {
  const data = componentData[partId];
  if (!data) return;
  $$("#b-apparatus .apparatus-part").forEach(part => part.classList.toggle("selected", part.dataset.part === partId));
  $("#bComponentBadge").textContent = data.badge;
  $("#bComponentTitle").textContent = data.label;
  $("#bComponentSummary").textContent = data.summary;
  $$("#bComponentList .part-row").forEach(row => row.classList.toggle("is-active", row.dataset.part === partId));
  $("#bComponentMeasure").hidden = !data.measure;
  $("#bComponentMeasure").innerHTML = data.measure ?? "";
}

function updateFlowLayers() {
  $$("#b-apparatus .toggle-layer").forEach(button => {
    const visible = button.classList.contains("is-active");
    button.setAttribute("aria-pressed", String(visible));
    $$(`#b-apparatus [data-layer-group="${button.dataset.layer}"]`).forEach(layer => layer.classList.toggle("layer-hidden", !visible));
  });
}

export function initBApparatusView() {
  $("#bApparatusStage").innerHTML = buildDiagramB();
  $("#bComponentList").innerHTML = componentOrder.B.map(partRow).join("");
  $$("#bComponentList .part-row").forEach(row => row.addEventListener("click", () => selectPart(row.dataset.part)));
  $$("#b-apparatus .apparatus-part").forEach(part => {
    part.addEventListener("click", () => selectPart(part.dataset.part));
    part.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectPart(part.dataset.part); }
    });
  });
  $$("#b-apparatus .toggle-layer").forEach(button =>
    button.addEventListener("click", () => { button.classList.toggle("is-active"); updateFlowLayers(); }));
  selectPart("b-t8");
  updateFlowLayers();
}
