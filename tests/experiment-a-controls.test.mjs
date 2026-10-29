import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initExperimentAView, drawAChart } from "../assets/js/views/experiment-a.js";

const markup = readFileSync(new URL("../assets/views/experiment-a.html", import.meta.url), "utf8");

class Element {
  constructor() {
    this.dataset = {}; this.style = {}; this.attributes = {}; this.events = {}; this.children = [];
    this.checked = false; this.value = ""; this.min = ""; this._text = ""; this._html = "";
    this.clientWidth = 1000; this.scrollWidth = 100;
    this.classList = { remove() {}, toggle() {} };
  }
  get valueAsNumber() { return this.value === "" ? NaN : Number(this.value); }
  get textContent() { return this.children.length ? this.children.map(child => child.textContent).join("") : this._text; }
  set textContent(value) { this._text = value; }
  get innerHTML() { return this._html; }
  set innerHTML(value) { this._html = value; this._text = value.replace(/<[^>]*>/g, ""); }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(type, handler) { (this.events[type] ??= []).push(handler); }
  dispatchEvent(event) { for (const handler of this.events[event.type] ?? []) handler(event); return true; }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  closest() { return this.parentElement; }
  focus() { this.focused = true; }
}

function withView(check) {
  const nodes = Object.fromEntries([...markup.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element()]));
  nodes["experiment-a"] = new Element(); nodes.aChart = null;
  for (const match of markup.matchAll(/<[a-z][^>]*\bid="([^"]+)"[^>]*>/g)) {
    if (match[1] === "aChart") continue;
    nodes[match[1]].attributes = Object.fromEntries([...match[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(item => [item[1], item[2]]));
    nodes[match[1]].hidden = /\shidden(?=\s|>)/.test(match[0]);
  }
  for (const match of markup.matchAll(/<input[^>]+>/g)) {
    const attrs = Object.fromEntries([...match[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(item => [item[1], item[2]]));
    const node = nodes[attrs.id];
    node.attributes = attrs; node.id = attrs.id; node.value = attrs.value ?? "";
    node.defaultValue = node.value; node.min = attrs.min ?? "";
    node.dataset.increment = attrs["data-increment"]; node.checked = /\bchecked\b/.test(match[0]);
    node.parentElement = new Element();
  }
  for (const prefix of ["aConv", "aRad", "aLoss"]) nodes[prefix + "Label"].parentElement = nodes[prefix + "Bar"];
  nodes["experiment-a"].querySelectorAll = () => [...markup.matchAll(/<span[^>]*data-tex="([^"]+)"[^>]*>/g)].map(match => {
    const id = /id="([^"]+)"/.exec(match[0])?.[1];
    const node = id ? nodes[id] : new Element();
    node.dataset.tex = match[1]; node.dataset.display = match[0].includes('data-display="block"') ? "block" : "inline";
    return node;
  });
  const previous = { document: globalThis.document, Event: globalThis.Event, ResizeObserver: globalThis.ResizeObserver };
  globalThis.document = { compatMode: "CSS1Compat", querySelector: selector => nodes[selector.slice(1)], createElement: () => new Element() };
  globalThis.Event = class { constructor(type, options) { this.type = type; this.bubbles = options?.bubbles; } };
  globalThis.ResizeObserver = class { observe() {} };
  try { initExperimentAView(); check(nodes); }
  finally { globalThis.document = previous.document; globalThis.Event = previous.Event; globalThis.ResizeObserver = previous.ResizeObserver; }
}

const fire = (node, type, extra = {}) => node.dispatchEvent({ type, ...extra });
const choose = (nodes, model) => {
  nodes.aModelMcadams.checked = model === "mcadams"; nodes.aModelMorgan.checked = model === "morgan";
  fire(nodes.aModel, "change");
};

test("Air properties는 Morgan에서만 보이고 클릭으로 열고 닫힌다", () => withView(nodes => {
  assert.ok(markup.indexOf('id="aAdvancedToggle"') > markup.indexOf('id="aModel"'));
  assert.ok(markup.indexOf('id="aAdvancedToggle"') < markup.indexOf('id="aConvectionHeading"'));
  assert.ok(markup.includes('>Air properties</button>'));
  assert.ok(!markup.includes("What this assumed"));
  assert.ok(!markup.includes("Kinematic viscosity (nu)"));
  assert.ok(!markup.includes("Enter ν"));
  assert.ok(!markup.includes('<span class="unit">—</span>'));
  assert.equal(nodes.aAirProperties.hidden, true);
  choose(nodes, "morgan");
  assert.equal(nodes.aAirProperties.hidden, false);
  assert.equal(nodes.aAdvanced.hidden, true);
  assert.equal(nodes.aAdvancedToggle.attributes["aria-expanded"], "false");
  fire(nodes.aAdvancedToggle, "click");
  assert.equal(nodes.aAdvanced.hidden, false);
  assert.equal(nodes.aAdvancedToggle.attributes["aria-expanded"], "true");
  fire(nodes.aAdvancedToggle, "click");
  assert.equal(nodes.aAdvanced.hidden, true);
  assert.equal(nodes.aAdvancedToggle.attributes["aria-expanded"], "false");
  choose(nodes, "mcadams");
  assert.equal(nodes.aAirProperties.hidden, true);
  assert.equal(nodes.aAdvanced.hidden, true);
}));

test("Greek nu 입력은 단위가 유지되고 조절 버튼이 동작한다", () => withView(nodes => {
  assert.ok(nodes.aNu.attributes["aria-label"].includes("Greek nu"));
  assert.equal(nodes.aNu.value, "17.5");
  choose(nodes, "morgan");
  assert.ok(nodes.aNuUp.attributes["aria-label"].includes("Greek nu"));
  fire(nodes.aNuUp, "click");
  assert.equal(nodes.aNu.value, "17.6");
  fire(nodes.aNu, "keydown", { key: "ArrowDown", preventDefault() {} });
  assert.equal(nodes.aNu.value, "17.5");
}));

test("Ra는 온도·점도·Pr 변화에 갱신되고 k에는 변하지 않는다", () => withView(nodes => {
  choose(nodes, "morgan");
  const initial = nodes.aRayleighValue.innerHTML;
  assert.ok(initial.includes("1.25")); assert.ok(initial.includes("10^{4}"));
  nodes.aK.value = "0.054"; fire(nodes.aK, "input");
  assert.equal(nodes.aRayleighValue.innerHTML, initial);
  nodes.aNu.value = "17.6"; fire(nodes.aNu, "input");
  assert.notEqual(nodes.aRayleighValue.innerHTML, initial);
  nodes.aNu.value = "17.5"; nodes.aPr.value = "1.414"; fire(nodes.aPr, "input");
  assert.ok(nodes.aRayleighValue.innerHTML.includes("2.51"));
  nodes.aPr.value = "0.707"; nodes.aSurfaceTemp.value = "100"; fire(nodes.aSurfaceTemp, "input");
  assert.ok(nodes.aRayleighValue.innerHTML.includes("10^{3}"));
  const valid = nodes.aRayleighValue.innerHTML;
  nodes.aK.value = ""; fire(nodes.aK, "input");
  assert.equal(nodes.aAirError.hidden, false); assert.equal(nodes.aRayleighValue.innerHTML, valid);
}));

test("Parameters 배치 후에도 고정 저항과 온도 스테퍼가 유지된다", () => withView(nodes => {
  nodes.aLockResistance.checked = true; fire(nodes.aLockResistance, "change");
  fire(nodes.aVoltageUp, "click");
  assert.equal(nodes.aVoltage.value, "11.1");
  assert.ok(Math.abs(Number(nodes.aCurrent.value) - 11.1 / (11 / 1.87)) < 1e-6);
  fire(nodes.aAirTempUp, "click"); assert.equal(nodes.aAirTemp.value, "20.6");
  fire(nodes.aSurfaceTempDown, "click"); assert.equal(nodes.aSurfaceTemp.value, "243");
}));

test("유효하지 않은 숨겨진 공기 물성이 McAdams 계산을 막지 않는다", () => withView(nodes => {
  choose(nodes, "morgan");
  nodes.aK.value = ""; fire(nodes.aK, "input");
  assert.equal(nodes.aAirError.hidden, false);
  choose(nodes, "mcadams");
  assert.equal(nodes.aAirProperties.hidden, true);
  assert.equal(nodes.aAirError.hidden, true);
  assert.match(nodes.aConvSub.textContent, /^16.16 /);
  fire(nodes.aVoltageUp, "click");
  assert.equal(nodes.aPower.innerHTML, '20.76 <small>W</small>');
  choose(nodes, "morgan");
  assert.equal(nodes.aAirError.hidden, false);
  assert.equal(nodes.aK.value, "");
  nodes.aK.value = "0.027"; fire(nodes.aK, "input");
  assert.equal(nodes.aAirError.hidden, true);
}));

test("실험 A가 아직 열리지 않았을 때 그래프 다시 그리기는 안전하다", () => {
  const previous = globalThis.document;
  globalThis.document = { querySelector: () => null };
  try { assert.doesNotThrow(() => drawAChart()); }
  finally { globalThis.document = previous; }
});
