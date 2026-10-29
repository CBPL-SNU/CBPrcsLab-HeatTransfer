import { test } from "node:test";
import assert from "node:assert/strict";
import { nearestTimeIndex, pointTooltipPosition } from "../assets/js/core/lumped-probe.js";

test("그래프 판독은 실제 저장 시각을 선택하고 끝점을 넘지 않는다", () => {
  const points = [{ t: 0 }, { t: 0.5 }, { t: 1 }, { t: 1.137 }];
  assert.equal(nearestTimeIndex(points, -1), 0);
  assert.equal(nearestTimeIndex(points, 0.49), 1);
  assert.equal(nearestTimeIndex(points, 1.13), 3);
  assert.equal(nearestTimeIndex(points, 600), 3);
  assert.equal(nearestTimeIndex([{ t: 0 }], 2), 0);
});

test("점 판독 상자는 점 옆에 놓이고 네 모서리에서도 그래프 밖으로 나가지 않는다", () => {
  assert.deepEqual(pointTooltipPosition(180, 160, 140, 90, 500, 300), { left: 194, top: 56 });
  assert.deepEqual(pointTooltipPosition(480, 20, 140, 90, 500, 300), { left: 326, top: 34 });
  for (const [width, height] of [[500, 300], [220, 180]]) {
    for (const x of [0, width / 2, width]) {
      for (const y of [0, height / 2, height]) {
        const box = pointTooltipPosition(x, y, 140, 90, width, height);
        assert.ok(box.left >= 8 && box.left + 140 <= width - 8);
        assert.ok(box.top >= 8 && box.top + 90 <= height - 8);
      }
    }
  }
});
