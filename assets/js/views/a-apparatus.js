// 실험 A 장치 화면: 치수 데이터에서 단면도를 그리고, 부품을 누르면 설명을 보여준다.

import { $, $$ } from "../core/dom.js";
import { HT14, PX_PER_MM } from "../data/apparatus.js";
import { componentData, componentOrder } from "../data/components.js";

// 히터 주변(Watch the flow 창)은 축척대로, 그 아래 1 m는 줄여 그린다. 관의 대부분이 빈 관이고,
// 학생은 실제 장치를 봤으므로 길이감은 안다. 줄인 구간의 부품은 다른 시각 언어로 그려 구분한다.
const PX_PER_M = PX_PER_MM * 1000;
const SQUEEZE = 130;            // 줄인 구간의 축척 [px/m]
const BREAK_H = 22;
const TOP = 44;
const CX = 250;                 // 관 중심 x [px]
const W = 580;

const rig = HT14;
const rIn = rig.duct.innerD / 2 * PX_PER_M;
const wall = rig.duct.wall * PX_PER_M;
const Z_BREAK = rig.window.zLo - 0.03;               // 창 바로 아래에서 끊는다. 데이터에서 유도
const yBreakTop = TOP + (rig.duct.outletZ - Z_BREAK) * PX_PER_M;
const yBreakBottom = yBreakTop + BREAK_H;

let selectedPart = null;

// z [m] → y [px]. 끊은 지점 아래는 다른 축척이다.
function yOf(z) {
  if (z >= Z_BREAK) return TOP + (rig.duct.outletZ - z) * PX_PER_M;
  return yBreakBottom + (Z_BREAK - z) * SQUEEZE;
}
const xOf = x => CX + x * PX_PER_M;
const f = n => n.toFixed(1);
const inSqueeze = z => z < Z_BREAK;

// 이름표. 센서는 무엇을 재는지 한 줄 더 붙인다. 나머지 설명은 오른쪽 카드가 맡는다.
// 리더선은 부품에서 시작해 필요하면 한 번 꺾고 옆으로 나간다.
function label(part, x, y, anchorX, side, lift = 0) {
  const data = componentData[part.id];
  // ≈ 는 위치가 어림인 센서에만 그린다. 형상이나 두께의 어림은 카드가 말한다.
  // 전부에 붙이면 표지가 뜻을 잃는다.
  const approx = part.approximatePosition ? ' <tspan class="part-approx">≈</tspan>' : "";
  const tx = side === "right" ? anchorX + 8 : anchorX - 8;
  const align = side === "right" ? "start" : "end";
  const yText = y - lift;
  const sub = part.kind === "sensor" ? `<text class="part-sub" x="${f(tx)}" y="${f(yText + 11)}" text-anchor="${align}">${data.measure}</text>` : "";
  const bend = lift ? `V${f(yText)} ` : "";
  return `
    <path class="part-leader" d="M${f(x)} ${f(y)} ${bend}H${f(anchorX)}"/>
    <text class="part-label" id="label-${part.id}" x="${f(tx)}" y="${f(yText + (sub ? -3 : 4))}" text-anchor="${align}">${part.name}${approx}</text>
    ${sub}`;
}

function group(part, inner) {
  const squeezed = part.z !== undefined && inSqueeze(part.z) ? " apparatus-part--squeezed" : "";
  return `<g class="apparatus-part${squeezed}" data-part="${part.id}" tabindex="0" role="button" aria-labelledby="label-${part.id}">${inner}</g>`;
}

// 관례적인 단절 기호: 완만한 물결 한 줄
function wave(y, x0, x1) {
  const a = 3, p = 14; let d = `M${f(x0)} ${f(y)}`;
  for (let x = x0; x < x1; x += p) d += ` q${p / 4} ${-a} ${p / 2} 0 q${p / 4} ${a} ${p / 2} 0`;
  return d;
}

// 화살표 한 토막. 끝에 화살촉이 붙는다
const arrow = (cls, d, marker) => `<path class="${cls}" d="${d}" marker-end="url(#${marker})"/>`;

// 복사의 관례 기호: 물결선. (x0,y0)→(x1,y1)로 가며 진행 방향에 수직으로 흔들리고 끝은 곧다
function wavyArrow(x0, y0, x1, y1) {
  const n = 4, a = 1.4;
  const dx = (x1 - x0) / n, dy = (y1 - y0) / n, L = Math.hypot(dx, dy);
  const nx = -dy / L * a, ny = dx / L * a;             // 진행 방향의 법선
  let d = `M${f(x0)} ${f(y0)}`;
  for (let i = 0; i < n; i++) {
    const sgn = i % 2 ? -1 : 1;
    d += ` q${f(dx / 2 + sgn * nx)} ${f(dy / 2 + sgn * ny)} ${f(dx)} ${f(dy)}`;
  }
  d += ` l${f(dx / 3)} ${f(dy / 3)}`;
  return arrow("rad-path", d, "arrowRad");
}

export function buildDiagram() {
  const parts = Object.fromEntries(rig.parts.map(p => [p.id, p]));
  const yTop = yOf(rig.duct.outletZ), yInlet = yOf(rig.duct.inletZ);
  const xL = CX - rIn, xR = CX + rIn;           // 관 안쪽 벽
  const xLo = xL - wall, xRo = xR + wall;       // 관 바깥 벽
  const rightAnchor = xRo + 64, leftAnchor = xLo - 56;
  const h = rig.heater;
  const yH = yOf(h.z), rH = h.d / 2 * PX_PER_M;
  const support = h.supportRight * PX_PER_M;
  const win = rig.window;
  const t10 = { ...parts["a-t10"], z: h.z + h.d / 2 };          // 표면 위. 지름이 바뀌어도 따라간다
  const an = parts["a-anemometer"], t8 = parts["a-t8"];
  const yAn = yOf(an.z), yT8 = yOf(t8.z);

  // 송풍기: 관 아래 이행부, 케이싱, 임펠러, 왼쪽 모터, 오른쪽 흡입구의 throttle 원판
  const yTrans = yInlet + 14, yCase = yTrans + 4, caseH = 56, yCaseMid = yCase + caseH / 2;
  const height = yCase + caseH + 26;

  return `
<svg class="apparatus-diagram" viewBox="0 0 ${W} ${f(height)}" role="group" aria-label="Section through the HT14 duct. Parts are buttons; press one to read about it.">
  <defs>
    <marker id="arrowAir" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" refX="5.4" refY="3.5" orient="auto"><path class="arrow-air" d="M0,0 L7,3.5 L0,7 z"/></marker>
    <marker id="arrowConv" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" refX="5.4" refY="3.5" orient="auto"><path class="arrow-conv" d="M0,0 L7,3.5 L0,7 z"/></marker>
    <marker id="arrowRad" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" refX="5.4" refY="3.5" orient="auto"><path class="arrow-rad" d="M0,0 L7,3.5 L0,7 z"/></marker>
  </defs>

  <defs>
    <!-- 줄인 구간의 빗금. 축척 구간과 다른 언어로 읽혀야 한다 -->
    <pattern id="squeezeHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <path class="squeeze-hatch" d="M0 0 V8"/>
    </pattern>
  </defs>

  <!-- 축척 막대. 위 구간만 축척대로다 -->
  <g class="scale-bar" aria-hidden="true">
    <path d="M${f(W - 8 - 0.05 * PX_PER_M)} ${f(TOP - 22)} h${f(0.05 * PX_PER_M)}"/>
    <text x="${f(W - 8)}" y="${f(TOP - 27)}" text-anchor="end">50 mm</text>
  </g>
  <text class="legend-note" x="${f(W - 8)}" y="${f(height - 8)}" text-anchor="end" aria-hidden="true">≈ position estimated from the manual's figure, not measured</text>

  <!-- Watch the flow 창 -->
  <rect class="window-box" x="${f(xLo - 6)}" y="${f(yOf(win.zHi) - 4)}" width="${f(xRo - xLo + 12)}" height="${f(yOf(win.zLo) - yOf(win.zHi) + 8)}" rx="4" aria-hidden="true"/>
  <text class="window-label" x="${f(xLo - 6)}" y="${f(yOf(win.zHi) - 10)}" aria-hidden="true">${((win.zHi - win.zLo) * 100).toFixed(0)} cm shown in Watch the flow</text>

  <!-- 관: 위 구간 축척대로, 아래 구간 줄임 -->
  ${group(parts["a-duct"], `
    <rect class="part-hit" x="${f(xLo - 3)}" y="${f(yTop)}" width="${f(xRo - xLo + 6)}" height="${f(yInlet - yTop)}"/>
    <rect class="duct-air" x="${f(xL)}" y="${f(yTop)}" width="${f(xR - xL)}" height="${f(yBreakTop - yTop)}"/>
    <rect class="duct-air" x="${f(xL)}" y="${f(yBreakBottom)}" width="${f(xR - xL)}" height="${f(yInlet - yBreakBottom)}"/>
    <rect class="duct-air--squeezed" x="${f(xL)}" y="${f(yBreakBottom)}" width="${f(xR - xL)}" height="${f(yInlet - yBreakBottom)}"/>
    <!-- CFD는 여기서부터 위만 계산했다. T8과 풍속계는 그 밖이다 -->
    <path class="cfd-cut" d="M${f(xLo - 10)} ${f(yOf(rig.cfdCut))} H${f(xR)}"/>
    <text class="break-label" x="${f(xLo - 14)}" y="${f(yOf(rig.cfdCut) + 4)}" text-anchor="end">CFD computed above this line</text>
    <rect class="duct-wall" x="${f(xLo)}" y="${f(yTop)}" width="${f(wall)}" height="${f(yBreakTop - yTop)}"/>
    <rect class="duct-wall" x="${f(xR)}" y="${f(yTop)}" width="${f(wall)}" height="${f(yBreakTop - yTop)}"/>
    <rect class="duct-wall" x="${f(xLo)}" y="${f(yBreakBottom)}" width="${f(wall)}" height="${f(yInlet - yBreakBottom)}"/>
    <rect class="duct-wall" x="${f(xR)}" y="${f(yBreakBottom)}" width="${f(wall)}" height="${f(yInlet - yBreakBottom)}"/>
    <path class="break-line" d="${wave(yBreakTop + 3, xLo - 6, xRo + 6)}"/>
    <path class="break-line" d="${wave(yBreakBottom - 3, xLo - 6, xRo + 6)}"/>
    <text class="break-label" x="${f(xRo + 12)}" y="${f(yBreakTop + BREAK_H / 2 + 4)}">lower ${((Z_BREAK - rig.duct.inletZ) * 100).toFixed(0)} cm compressed, not to scale</text>
    ${label(parts["a-duct"], xLo, yOf(1.12), leftAnchor, "left")}`)}

  <!-- 흐름. 켜고 끌 수 있다. 팬이 꺼져 있어도 플룸이 관 아래 공기를 끌어올린다.
       이 단면은 실린더 축을 지나므로 공기는 실린더 앞뒤로 돌아간다. 그래서 공기선을 실린더에서 끊는다 -->
  <g class="flow-layer" data-layer-group="air" aria-hidden="true">
    ${[-24, 24].map(dx => {
      const x = CX + dx;
      return arrow("air-path", `M${f(x)} ${f(yInlet - 6)} V${f(yBreakBottom + 10)}`, "arrowAir")
        + arrow("air-path", `M${f(x)} ${f(yBreakTop - 6)} V${f(yH + 2.4 * rH)}`, "arrowAir")
        + arrow("air-path", `M${f(x)} ${f(yH - 2.4 * rH)} V${f(yTop + 10)}`, "arrowAir");
    }).join("")}
  </g>
  <g class="flow-layer" data-layer-group="convection" aria-hidden="true">
    ${[-1, 1].map(sg => arrow("conv-path",
      `M${f(CX + sg * 2.2 * rH)} ${f(yH - rH - 2)} C${f(CX + sg * 2.8 * rH)} ${f(yH - 6 * rH)} ${f(CX + sg * 2.2 * rH)} ${f(yH - 9 * rH)} ${f(CX + sg * 2.6 * rH)} ${f(yH - 14 * rH)}`,
      "arrowConv")).join("")}
  </g>
  <g class="flow-layer" data-layer-group="radiation" aria-hidden="true">
    ${[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) =>
      wavyArrow(CX + sx * 3 * rH, yH + sy * (rH + 2), sx > 0 ? xR - 3 : xL + 3, yH + sy * 5.5 * rH)).join("")}
  </g>

  <!-- 히터: 관을 가로지르는 실린더. 관 안쪽 70 mm가 가열 구간, 오른쪽 벽 밖으로 조립체가 이어진다 -->
  ${group(parts["a-heater"], `
    <rect class="part-hit" x="${f(xLo - 4)}" y="${f(yH - rH - 6)}" width="${f(xRo - xLo + support + 10)}" height="${f(2 * rH + 12)}"/>
    <rect class="heater-support" x="${f(xLo - 1)}" y="${f(yH - rH)}" width="${f(xRo - xLo + support + 1)}" height="${f(2 * rH)}" rx="${f(rH)}"/>
    <rect class="heater-hot" x="${f(xL)}" y="${f(yH - rH)}" width="${f(xR - xL)}" height="${f(2 * rH)}"/>
    <rect class="heater-bracket" x="${f(xRo + 4)}" y="${f(yH - 2 * rH)}" width="${f(support - 12)}" height="${f(4 * rH)}" rx="2"/>
    ${label(parts["a-heater"], xRo + support, yH, rightAnchor, "right")}`)}

  <!-- T10: 표면 위. 리더선은 비드에서 시작해 위로 꺾는다 -->
  ${group(t10, `
    <circle class="part-hit" cx="${f(xOf(t10.x))}" cy="${f(yOf(t10.z))}" r="8"/>
    <circle class="sensor sensor--surface" cx="${f(xOf(t10.x))}" cy="${f(yOf(t10.z))}" r="4.5"/>
    ${label(t10, xOf(t10.x), yOf(t10.z), rightAnchor, "right", 4 * rH)}`)}

  <!-- 풍속계: 관 중심의 프로펠러, 오른쪽 벽으로 리드가 나간다. 줄인 구간이라 위치는 어림 -->
  ${group(an, `
    <rect class="part-hit" x="${f(CX - 24)}" y="${f(yAn - 14)}" width="${f(xR - CX + 26)}" height="28"/>
    <path class="sensor-stem" d="M${f(CX + 14)} ${f(yAn)} H${f(xR)}"/>
    <path class="anemometer" d="M${f(CX - 18)} ${f(yAn - 8)} L${f(CX)} ${f(yAn)} L${f(CX - 18)} ${f(yAn + 8)} Z M${f(CX + 18)} ${f(yAn - 8)} L${f(CX)} ${f(yAn)} L${f(CX + 18)} ${f(yAn + 8)} Z"/>
    <circle class="anemometer-hub" cx="${f(CX)}" cy="${f(yAn)}" r="3"/>
    ${label(an, xR, yAn, rightAnchor, "right")}`)}

  <!-- T8: 오른쪽 벽으로 들어와 아래로 꺾여 관 중심에 비드. 줄인 구간이라 높이는 어림 -->
  ${group(t8, `
    <circle class="part-hit" cx="${f(xOf(t8.x))}" cy="${f(yT8)}" r="9"/>
    <path class="sensor-stem" d="M${f(xR)} ${f(yT8 - 14)} H${f(xOf(t8.x) + 6)} q-6 0 -6 6 V${f(yT8 - 4)}"/>
    <circle class="sensor sensor--air" cx="${f(xOf(t8.x))}" cy="${f(yT8)}" r="4.5"/>
    ${label(t8, xR, yT8 - 14, rightAnchor, "right")}`)}

  <!-- 송풍기: 관 아래 이행부, 원심 케이싱, 왼쪽 모터. 오른쪽 옆 흡입구에 throttle 원판 -->
  ${group(parts["a-fan"], `
    <rect class="part-hit" x="${f(xLo - 46)}" y="${f(yInlet)}" width="${f(xRo - xLo + 62)}" height="${f(caseH + 22)}"/>
    <path class="fan-transition" d="M${f(xLo)} ${f(yInlet)} L${f(xLo - 6)} ${f(yTrans)} H${f(xRo + 6)} L${f(xRo)} ${f(yInlet)} Z"/>
    <rect class="fan-box" x="${f(xLo - 6)}" y="${f(yCase)}" width="${f(xRo - xLo + 12)}" height="${f(caseH)}" rx="3"/>
    <circle class="fan-hub" cx="${f(CX)}" cy="${f(yCaseMid)}" r="${f(caseH / 2 - 8)}"/>
    <path class="fan-blade" d="M${f(CX)} ${f(yCaseMid - (caseH / 2 - 8))} A${f(caseH / 2 - 8)} ${f(caseH / 2 - 8)} 0 0 1 ${f(CX + (caseH / 2 - 8) * 0.85)} ${f(yCaseMid + (caseH / 2 - 8) * 0.5)} M${f(CX)} ${f(yCaseMid + (caseH / 2 - 8))} A${f(caseH / 2 - 8)} ${f(caseH / 2 - 8)} 0 0 1 ${f(CX - (caseH / 2 - 8) * 0.85)} ${f(yCaseMid - (caseH / 2 - 8) * 0.5)}"/>
    <rect class="fan-motor" x="${f(xLo - 44)}" y="${f(yCase + 10)}" width="36" height="${f(caseH - 20)}" rx="2"/>
    <path class="fan-base" d="M${f(xLo - 50)} ${f(yCase + caseH + 6)} H${f(xRo + 30)}"/>
    ${label(parts["a-fan"], xLo - 44, yCaseMid, leftAnchor, "left")}`)}
  ${group(parts["a-throttle"], `
    <rect class="part-hit" x="${f(xRo + 4)}" y="${f(yCaseMid - 16)}" width="34" height="32"/>
    <rect class="throttle-inlet" x="${f(xRo + 6)}" y="${f(yCaseMid - 12)}" width="4" height="24"/>
    <path class="throttle-stem" d="M${f(xRo + 10)} ${f(yCaseMid)} H${f(xRo + 22)}"/>
    <ellipse class="throttle-disc" cx="${f(xRo + 24)}" cy="${f(yCaseMid)}" rx="3.5" ry="14"/>
    ${label(parts["a-throttle"], xRo + 28, yCaseMid, rightAnchor, "right")}`)}
</svg>`;
}

function selectPart(partId) {
  const data = componentData[partId];
  if (!data) return;
  selectedPart = partId;
  $$(".apparatus-part").forEach(part => part.classList.toggle("selected", part.dataset.part === partId));
  $("#componentBadge").textContent = data.badge;
  $("#componentTitle").textContent = data.label;
  $("#componentSummary").textContent = data.summary;
  $("#componentLocation").textContent = data.location;
  $("#componentRole").textContent = data.role;
  // 센서만 무엇을 재는지가 있고, 나머지는 이 실험에서의 상태가 있다
  $("#componentMeasureRow").hidden = !data.measure;
  $("#componentMeasure").textContent = data.measure ?? "";
  $("#componentStateRow").hidden = !data.inExpA;
  $("#componentState").textContent = data.inExpA ?? "";
  const geometry = rig.parts.find(p => p.id === partId);
  $("#componentApprox").hidden = !geometry?.approximate;
  if (geometry?.approximate) $("#componentApprox").textContent = `≈ Estimated, not measured: ${geometry.approximate}.`;
  $$("#componentList .btn").forEach(chip => chip.classList.toggle("is-active", chip.dataset.part === partId));
}

function updateFlowLayers() {
  $$(".toggle-layer").forEach(button => {
    const visible = button.classList.contains("is-active");
    button.setAttribute("aria-pressed", String(visible));
    $$(`[data-layer-group="${button.dataset.layer}"]`).forEach(layer => layer.classList.toggle("layer-hidden", !visible));
  });
}

export function initApparatusView() {
  $("#apparatusStage").innerHTML = buildDiagram();

  $("#componentList").innerHTML = componentOrder.A
    .map(id => `<button class="btn" type="button" data-part="${id}">${rig.parts.find(p => p.id === id)?.name ?? componentData[id].label}</button>`)
    .join("");
  $$("#componentList .btn").forEach(button => button.addEventListener("click", () => selectPart(button.dataset.part)));

  $$(".apparatus-part").forEach(part => {
    part.addEventListener("click", () => selectPart(part.dataset.part));
    part.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectPart(part.dataset.part); }
    });
  });

  $$(".toggle-layer").forEach(button =>
    button.addEventListener("click", () => { button.classList.toggle("is-active"); updateFlowLayers(); }));

  selectPart("a-t10");
  updateFlowLayers();
}

export { selectedPart };
