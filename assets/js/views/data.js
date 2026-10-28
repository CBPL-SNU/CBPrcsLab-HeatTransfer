import { $, $$ } from "../core/dom.js";
import { showToast } from "../core/ui.js";
import { buildXlsx, XLSX_TYPE } from "../core/xlsx.js";
import { schemas } from "../data/schemas.js";

// 입력값은 이 브라우저에만 저장한다. 서버로 보내지 않는다
const STORE = "heat-transfer-lab.my-data.v1";
const NOTE = { key: "note", label: "Note", unit: "" };

let dataset = "A";
let state;

const today = () => new Date().toLocaleDateString("sv");   // YYYY-MM-DD
const blank = () => ({ date: today(), group: "", A: [], B: [], comments: { A: "", B: "" } });
const runName = index => String.fromCharCode(97 + index);

function load() {
  try { return { ...blank(), ...JSON.parse(localStorage.getItem(STORE)) }; }
  catch { return blank(); }
}

function save() {
  const saved = $("#dataSaved");
  try {
    localStorage.setItem(STORE, JSON.stringify(state));
    saved.textContent = "Saved in this browser · " + new Date().toTimeString().slice(0, 5);
    saved.classList.remove("is-off");
  } catch {
    saved.textContent = "Not saved: browser storage is off. Export before closing.";
    saved.classList.add("is-off");
  }
}

// 쉼표 소수점도 받는다. 빈 칸은 null, 숫자가 아니면 NaN
function parse(raw) {
  const text = String(raw ?? "").trim().replace(",", ".");
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : NaN;
}

function render() {
  const schema = schemas[dataset];
  const rows = state[dataset];
  $("#dataTitle").textContent = schema.title;
  $("#dataComment").value = state.comments[dataset] ?? "";

  const table = document.createElement("table");
  table.className = "data-table";
  const head = table.createTHead().insertRow();
  for (const column of [{ label: "Run", unit: "" }, ...schema.columns, NOTE]) {
    const th = document.createElement("th");
    th.textContent = column.label;
    if (column.unit) {
      const unit = document.createElement("span");
      unit.className = "unit";
      unit.textContent = column.unit;
      th.append(unit);
    }
    if (column === NOTE) th.className = "is-note";
    head.append(th);
  }

  const body = table.createTBody();
  schema.rows.forEach((hint, index) => {
    const row = body.insertRow();
    const run = document.createElement("th");
    run.scope = "row";
    run.textContent = runName(index);
    row.append(run);
    for (const column of [...schema.columns, NOTE]) {
      const input = document.createElement("input");
      const numeric = column !== NOTE;
      input.type = "text";
      input.inputMode = numeric ? "decimal" : "text";
      input.autocomplete = "off";
      input.value = rows[index]?.[column.key] ?? "";
      // 교안의 설정값을 흐리게 보여 준다. 측정값으로 저장되지는 않는다
      if (hint[column.key] !== undefined) input.placeholder = hint[column.key];
      input.setAttribute("aria-label", `Run ${runName(index)} ${column.label}${column.unit ? " (" + column.unit + ")" : ""}`);
      input.dataset.row = index;
      input.dataset.key = column.key;
      if (numeric) input.classList.add("is-number");
      check(input);
      row.insertCell().append(input);
    }
  });
  $("#dataTableWrap").replaceChildren(table);
}

function check(input) {
  const bad = input.classList.contains("is-number") && Number.isNaN(parse(input.value));
  input.classList.toggle("is-invalid", bad);
  input.setAttribute("aria-invalid", String(bad));
}

function onInput(event) {
  const input = event.target.closest("input[data-key]");
  if (!input) return;
  const rows = state[dataset];
  const index = Number(input.dataset.row);
  rows[index] = { ...rows[index], [input.dataset.key]: input.value };
  check(input);
  save();
}

// 표 안에서 Enter는 아래 칸으로 내려간다. 측정값을 열 단위로 받아 적을 때가 많다
function onKey(event) {
  if (event.key !== "Enter") return;
  const input = event.target.closest("input[data-key]");
  if (!input) return;
  event.preventDefault();
  const step = event.shiftKey ? -1 : 1;
  $(`#dataTableWrap input[data-key="${input.dataset.key}"][data-row="${Number(input.dataset.row) + step}"]`)?.focus();
}

// 교안과 보고서의 Raw data 표는 온도를 ℃와 K로 함께 적는다. 엑셀에서는 ℃ 열마다 K 열을 붙인다
const toKelvin = celsius => Math.round((celsius + 273.15) * 100) / 100;

function sheetFor(id) {
  const schema = schemas[id];
  const columns = schema.columns.flatMap(c => c.unit === "°C" ? [c, { ...c, unit: "K", kelvinOf: c.key }] : [c]);
  const header = [{ v: "Run", bold: true }, ...columns.map(c => ({ v: `${c.label} (${c.unit})`, bold: true })), { v: NOTE.label, bold: true }];
  const rows = schema.rows.map((_, index) => {
    const saved = state[id][index] ?? {};
    return [runName(index), ...columns.map(c => {
      const raw = saved[c.kelvinOf ?? c.key];
      const value = parse(raw);
      if (c.kelvinOf) return Number.isFinite(value) ? toKelvin(value) : null;
      // 숫자가 아닌 값은 버리지 않고 글자 그대로 넘긴다. 엑셀에서 눈에 띈다
      return value === null ? null : Number.isNaN(value) ? String(raw) : value;
    }), saved.note ?? ""];
  });
  const comment = (state.comments?.[id] ?? "").trim();
  return {
    name: "Experiment " + id,
    widths: [8, ...columns.map(c => Math.max(10, c.label.length + c.unit.length + 4)), 28],
    rows: [
      [{ v: schema.title, bold: true }],
      ["Date", state.date || ""],
      ["Group", state.group || ""],
      [],
      header,
      ...rows,
      ...(comment ? [[], [{ v: "Comment", bold: true }], ...comment.split("\n").map(line => [line])] : [])
    ]
  };
}

function exportXlsx() {
  const bytes = buildXlsx(["A", "B"].map(sheetFor));
  const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_TYPE }));
  const anchor = document.createElement("a");
  const group = state.group.trim().replace(/[^\w-]+/g, "_");
  anchor.href = url;
  anchor.download = `heat-transfer-${state.date || today()}${group ? "-group-" + group : ""}.xlsx`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function clearDataset() {
  if (!confirm(`Clear every value in Experiment ${dataset}?`)) return;
  state[dataset] = [];
  state.comments[dataset] = "";
  save();
  render();
  showToast(`Experiment ${dataset} cleared`);
}

export function initDataView() {
  state = load();
  state.comments = { A: "", B: "", ...state.comments };
  const date = $("#dataDate"), group = $("#dataGroup"), comment = $("#dataComment");
  comment.addEventListener("input", () => { state.comments[dataset] = comment.value; save(); });
  // 저장소가 막힌 브라우저면 처음부터 알린다
  save();
  date.value = state.date;
  group.value = state.group;
  date.addEventListener("input", () => { state.date = date.value; save(); });
  group.addEventListener("input", () => { state.group = group.value; save(); });

  $$(".dataset-button").forEach(button => button.addEventListener("click", () => {
    dataset = button.dataset.dataset;
    $$(".dataset-button").forEach(item => {
      item.classList.toggle("is-active", item === button);
      item.setAttribute("aria-pressed", String(item === button));
    });
    render();
  }));

  const wrap = $("#dataTableWrap");
  wrap.addEventListener("input", onInput);
  wrap.addEventListener("keydown", onKey);
  $("#clearData").addEventListener("click", clearDataset);
  $("#exportXlsx").addEventListener("click", exportXlsx);

  render();
}
