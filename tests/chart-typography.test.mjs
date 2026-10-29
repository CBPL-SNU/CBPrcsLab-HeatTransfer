import { test } from "node:test";
import assert from "node:assert/strict";
import { drawBChart } from "../assets/js/views/experiment-b.js";

for (const width of [360, 600]) {
  for (const wallC of [165, 25.5]) {
    test("실험 B 그래프의 눈금과 범례 배치: " + width + "px, wall " + wallC, () => {
      const texts = [], strokes = [];
      const height = width * 2 / 3;
      const canvas = { clientWidth: width, width, height,
        getBoundingClientRect: () => ({ width, height }), getContext: () => ctx };
      const ctx = { canvas, save() {}, restore() {}, setTransform() {}, clearRect() {}, setLineDash(value) { this.dash = value; },
        beginPath() { this.path = []; },
        moveTo(x, y) { this.path.push([x, y]); },
        lineTo(x, y) { this.path.push([x, y]); },
        stroke() { strokes.push({ points: this.path, dash: this.dash ?? [], color: this.strokeStyle }); },
        fillRect() {},
        measureText(text) { return { width: String(text).length * 7 }; },
        fillText(text, x, y) { texts.push({ text: String(text), x, y, font: this.font, align: this.textAlign }); }
      };
      const nodes = { bChart: canvas, bWallTemp: { value: String(wallC) }, bGasTemp: { value: "25.5" }, bVelocity: { value: "0.4" }, bT6Emissivity: { value: "0.4" } };
      const previousDocument = globalThis.document, previousWindow = globalThis.window;
      globalThis.document = { querySelector: selector => nodes[selector.slice(1)] };
      globalThis.window = { devicePixelRatio: 1 };
      try {
        drawBChart();
        assert.ok(texts.length > 0);
        for (const label of texts) {
          assert.ok(parseFloat(label.font) >= 14, label.text);
          assert.ok(label.y >= 14 && label.y <= height, label.text + " at " + label.y);
        }
        assert.ok(!texts.some(label => /^T[678]\b/.test(label.text)), '센서 이름은 범례에서만 보여 준다');
        assert.equal(strokes.filter(stroke => stroke.points.length === 90).length, 3, '세 센서 곡선은 유지한다');
        const xTicks = texts.filter(label => label.y === height - 17).map(label => Number(label.text));
        assert.deepEqual(xTicks, [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8]);
        const airGuide = strokes.find(stroke => stroke.dash.join(',') === '2,5');
        assert.ok(airGuide, '공기 온도 안내선을 유지한다');
        assert.ok(airGuide.points[0][1] <= height - 54, '공기 온도 아래에 화면 여백을 둔다');
        assert.ok(!texts.some(label => label.text === 'Air temperature'), '공기 온도 문구는 범례에 표시한다');
      } finally { globalThis.document = previousDocument; globalThis.window = previousWindow; }
    });
  }
}
