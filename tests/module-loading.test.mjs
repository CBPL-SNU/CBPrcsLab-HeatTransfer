import { test } from "node:test";
import assert from "node:assert/strict";
import { initRouter, switchView } from "../assets/js/core/router.js";

test("실제 브라우저 라우터 모듈을 구문 오류 없이 불러온다", () => {
  assert.equal(typeof initRouter, "function");
  assert.equal(typeof switchView, "function");
});
