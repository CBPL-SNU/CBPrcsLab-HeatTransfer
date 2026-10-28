import { test } from "node:test";
import assert from "node:assert/strict";
import { nearestTimeIndex } from "../assets/js/core/lumped-probe.js";

test("그래프 판독은 실제 저장 시각을 선택하고 끝점을 넘지 않는다", () => {
  const points = [{ t: 0 }, { t: 0.5 }, { t: 1 }, { t: 1.137 }];
  assert.equal(nearestTimeIndex(points, -1), 0);
  assert.equal(nearestTimeIndex(points, 0.49), 1);
  assert.equal(nearestTimeIndex(points, 1.13), 3);
  assert.equal(nearestTimeIndex(points, 600), 3);
  assert.equal(nearestTimeIndex([{ t: 0 }], 2), 0);
});
