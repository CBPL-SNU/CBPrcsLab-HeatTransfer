import katex from "../../vendor/katex/katex.mjs";

export function renderFormula(element, tex, displayMode = false) {
  element.innerHTML = katex.renderToString(String.raw`\boldsymbol{${tex}}`, {
    displayMode,
    throwOnError: true,
    strict: "error"
  });
}

export function renderFormulas(root) {
  for (const element of root.querySelectorAll("[data-tex]")) {
    renderFormula(element, element.dataset.tex, element.dataset.display === "block");
  }
}
