import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderFormula, renderFormulas } from "../assets/js/core/math.js";
import { updateA } from "../assets/js/views/experiment-a.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const markup = readFileSync(join(root, "assets/views/experiment-a.html"), "utf8");

test("실험 A의 LaTeX 수식은 독립 수식과 접근성 MathML을 생성한다", () => {
  const elements = [...markup.matchAll(/<span[^>]*data-tex="([^"]+)"[^>]*>/g)].map(match => ({
    dataset: { tex: match[1], display: match[0].includes('data-display="block"') ? "block" : "inline" },
    innerHTML: ""
  }));
  assert.equal(elements.length, 12);
  renderFormulas({ querySelectorAll: () => elements });
  assert.equal(elements.filter(element => element.innerHTML.includes('class="katex-display"')).length, 3);
  for (const element of elements) {
    assert.ok(element.innerHTML.includes('class="katex-html"'));
    assert.ok(element.innerHTML.includes('class="katex-mathml"'));
    assert.ok(!element.innerHTML.includes('class="katex-error"'));
  }
});

test("로컬 KaTeX 스타일시트와 모든 수학 글꼴이 존재한다", () => {
  const index = readFileSync(join(root, "index.html"), "utf8");
  assert.ok(index.includes('href="assets/vendor/katex/katex.min.css"'));
  const css = readFileSync(join(root, "assets/vendor/katex/katex.min.css"), "utf8");
  const assets = [...new Set([...css.matchAll(/url\(([^)]+)\)/g)].map(match => match[1].replace(/["']/g, "")))];
  assert.ok(assets.length > 0);
  for (const asset of assets) assert.ok(existsSync(join(root, "assets/vendor/katex", asset)), asset);
  assert.ok(existsSync(join(root, "assets/vendor/katex/LICENSE")));
});

test("LaTeX 오류를 조용히 원문으로 출력하지 않는다", () => {
  assert.throws(() => renderFormula({ innerHTML: "" }, "\\notARealCommand{x}"));
});

class Element {
  constructor() { this.dataset = {}; this.style = {}; this.checked = false; this.attributes = {}; this._text = ""; this._html = ""; this.classList = { remove() {}, toggle() {} }; this.clientWidth = 1000; this.scrollWidth = 100; }
  get textContent() { return this._text; }
  set textContent(value) { this._text = value; }
  get innerHTML() { return this._html; }
  set innerHTML(value) { this._html = value; this._text = value.replace(/<[^>]*>/g, ""); }
  setAttribute(name, value) { this.attributes[name] = value; }
}

test("모델을 왕복 전환해도 LaTeX 위첨자와 계수 값이 갱신된다", () => {
  const nodes = Object.fromEntries([...markup.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element()]));
  nodes["experiment-a"] = new Element(); nodes.aChart = null;
  for (const match of markup.matchAll(/<input[^>]+>/g)) {
    const node = nodes[/id="([^"]+)"/.exec(match[0])[1]];
    node.value = /value="([^"]+)"/.exec(match[0])?.[1] ?? "";
    node.checked = /\bchecked\b/.test(match[0]);
  }
  for (const prefix of ["aConv", "aRad", "aLoss"]) nodes[prefix + "Label"].parentElement = nodes[prefix + "Bar"];
  const previousDocument = globalThis.document;
  globalThis.document = { querySelector: selector => nodes[selector.slice(1)] };
  try {
    updateA();
    assert.ok(nodes.aConvectionModelExponent.innerHTML.includes("McAdams"));
    assert.match(nodes.aConvSub.textContent, /^16.16 /);
    const radiation = nodes.aRadSub.textContent;
    nodes.aModelMcadams.checked = false; nodes.aModelMorgan.checked = true;
    updateA();
    assert.ok(nodes.aConvectionModelExponent.innerHTML.includes("Morgan"));
    assert.match(nodes.aConvSub.textContent, /^13.72 /);
    assert.equal(nodes.aRadSub.textContent, radiation);
    assert.equal(nodes.aMcadamsCoefficientFormula.hidden, true);
    assert.equal(nodes.aMorganCoefficientFormula.hidden, false);
    assert.equal(nodes.aConvectionLegend.textContent, "Convection (Morgan)");
    assert.equal(nodes.aMorganTemperatureExponent.textContent, "1.25");
    nodes.aSurfaceTemp.value = "100"; updateA();
    assert.notEqual(nodes.aRadSub.textContent, radiation);
    assert.equal(nodes.aMorganTemperatureExponent.textContent, "1.188");
    nodes.aModelMcadams.checked = true; nodes.aModelMorgan.checked = false; updateA();
    assert.ok(nodes.aConvectionModelExponent.innerHTML.includes("McAdams"));
    assert.equal(nodes.aMcadamsCoefficientFormula.hidden, false);
    assert.equal(nodes.aMorganCoefficientFormula.hidden, true);
  } finally { globalThis.document = previousDocument; }
});
