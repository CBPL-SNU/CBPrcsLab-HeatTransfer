// 측정 온도를 낮춰도 고온 교차점이 표시되는 회귀를 검사한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { radiationCrossover, cylinderHeat } from "../assets/js/physics/experiment-a.js";
import { drawAChart } from "../assets/js/views/experiment-a.js";
import { SERIES_COLOR } from "../assets/js/core/chart.js";

const defaults = { taC: 19.6, k: 0.027, nu: 1.75e-5, pr: 0.707 };

function draw({ tsC = 100, taC = 19.6, model = "mcadams", w = 700, h = 440 } = {}) {
  const log = { texts: [], boxes: [], arcs: [], strokes: [], operations: [] };
  let path = [];
  const canvas = { clientWidth: w, width: w, height: h,
    getBoundingClientRect: () => ({ width: w, height: h }), getContext: () => ctx };
  const ctx = { canvas, save() {}, restore() {}, setTransform() {}, clearRect() {},
    setLineDash(value) { this.dash = value; }, beginPath() { path = []; },
    moveTo(x, y) { path.push([x, y]); }, lineTo(x, y) { path.push([x, y]); },
    stroke() { log.operations.push("stroke"); log.strokes.push({ points: [...path], color: this.strokeStyle, dash: [...(this.dash ?? [])] }); },
    arc(x, y, r) { log.arcs.push({ x, y, r }); }, fill() {}, strokeRect() {},
    fillRect(x, y, w, h) { log.operations.push("box"); log.boxes.push({ x, y, w, h, opacity: this.globalAlpha ?? 1 }); },
    measureText(text) { return { width: text.length * 7 }; },
    fillText(text, x, y) { log.texts.push({ text: String(text), x, y, font: this.font, opacity: this.globalAlpha ?? 1 }); }
  };
  const note = { hidden: true, textContent: "" };
  const nodes = { aChart: canvas, aCrossoverNote: note,
    aVoltage: { value: "11" }, aCurrent: { value: "1.87" },
    aAirTemp: { value: String(taC) }, aSurfaceTemp: { value: String(tsC) },
    aK: { value: "0.027" }, aNu: { value: "0.0000175" }, aPr: { value: "0.707" },
    aModelMcadams: { checked: model === "mcadams" } };
  const previousDocument = globalThis.document, previousWindow = globalThis.window;
  globalThis.document = { querySelector: selector => nodes[selector.slice(1)] };
  globalThis.window = { devicePixelRatio: 1 };
  try { drawAChart(); } finally { globalThis.document = previousDocument; globalThis.window = previousWindow; }
  return { ...log, note, w, h };
}

for (const [model, expected] of [["mcadams", 259.5690997356], ["morgan", 209.3019972169]]) {
  test(model + ": 교차점은 측정 T10과 독립이며 실제 등호가 성립한다", () => {
    let previous;
    for (const tsC of [20, 50, 100, 200, 244, 500]) {
      const input = { ...defaults, model, tsC };
      const point = radiationCrossover(input);
      assert.ok(point);
      assert.ok(Math.abs(point.t - expected) < 1e-6);
      if (previous) assert.deepEqual(point, previous);
      const heat = cylinderHeat({ ...input, tsC: point.t });
      assert.ok(Math.abs(heat.qConv - heat.qRad) < 1e-9);
      const below = cylinderHeat({ ...input, tsC: point.t - 0.1 });
      const above = cylinderHeat({ ...input, tsC: point.t + 0.1 });
      assert.ok(below.qConv > below.qRad);
      assert.ok(above.qConv < above.qRad);
      previous = point;
    }
  });
}

test("온도차 0의 자명한 등호나 실제 근이 없는 조건을 교차점으로 표시하지 않는다", () => {
  assert.equal(radiationCrossover({ ...defaults, taC: 100, model: "mcadams" }), null);
});

for (const model of ["mcadams", "morgan"]) {
  test(model + ": 낮은 T10에서도 두 교차점이 그래프 안에 표시된다", () => {
    for (const tsC of [20, 50, 100, 200, 244, 500]) {
      const log = draw({ model, tsC });
      assert.ok(log.texts.some(item => item.text === "McAdams = radiation"));
      assert.ok(log.texts.some(item => item.text === "Morgan = radiation"));
      assert.equal(log.arcs.length, 2);
      for (const point of log.arcs) {
        assert.ok(point.x > 50 && point.x < log.w - 80);
        assert.ok(point.y > 24 && point.y < log.h - 44);
      }
      assert.equal(log.note.hidden, true);
    }
  });
}

for (const [w, h] of [[700, 440], [432, 288]]) {
  test("두 교차점 이름표가 겹치지 않고 플롯 안에 놓인다: " + w, () => {
    const log = draw({ w, h });
    assert.equal(log.boxes.length, 2);
    for (const box of log.boxes) {
      assert.ok(box.x >= 54 && box.y >= 28);
      assert.ok(box.x + box.w <= w - 84 + 1e-7);
      assert.ok(box.y + box.h <= h - 48 + 1e-7);
    }
    for (const box of log.boxes) {
      for (const point of log.arcs) {
        assert.ok(point.x < box.x - 4 || point.x > box.x + box.w + 4 || point.y < box.y - 4 || point.y > box.y + box.h + 4, "이름표가 교차점을 가리면 안 됨");
      }
    }
    const [a, b] = log.boxes;
    const area = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    assert.equal(area, 0);
  });
}

test("교차점이 탐색 범위에 없으면 해당 모델의 부재를 명시한다", () => {
  const log = draw({ taC: 100, tsC: 150 });
  assert.equal(log.note.hidden, false);
  assert.ok(log.note.textContent.includes("McAdams"));
  assert.ok(log.note.textContent.includes("10,000"));
  assert.ok(!log.texts.some(item => item.text === "McAdams = radiation"));
});

for (const model of ["mcadams", "morgan"]) {
  test(model + ": 세 성분곡선만 표시하고 선택 모델과 무관하게 유지한다", () => {
    const log = draw({ model, tsC: 50 });
    const series = log.strokes.filter(item => item.points.length === 100);
    assert.equal(series.length, 3);
    assert.deepEqual(series.map(item => item.color), [SERIES_COLOR.conv, SERIES_COLOR.morgan, SERIES_COLOR.rad]);
    for (const line of series) assert.deepEqual(line.dash, []);
    assert.ok(!log.texts.some(item => item.text === "Total"));
    const other = draw({ model: model === "morgan" ? "mcadams" : "morgan", tsC: 50 });
    assert.deepEqual(series, other.strokes.filter(item => item.points.length === 100));
    for (const label of log.texts) assert.ok(parseFloat(label.font) >= 14);
  });
}

test("교차점 설명은 모든 선 위에 그리며 배경만 반투명하다", () => {
  const log = draw({ w: 432, h: 288 });
  assert.ok(log.operations.lastIndexOf("stroke") < log.operations.indexOf("box"));
  for (const box of log.boxes) assert.equal(box.opacity, 0.88);
  for (const text of log.texts.filter(item => item.text.includes("= radiation") || item.text.startsWith("T₁₀ ="))) {
    assert.equal(text.opacity, 1);
  }
});
