// 실험 A 화면: 정상상태 계산 결과와 그래프

import { $, clamp, numberValue, formatW } from "../core/dom.js";
import { renderFormula, renderFormulas } from "../core/math.js";
import { setupCanvas, drawAxes, drawLine, makeScales, drawVerticalMarker, drawCrossing, labelEnds, PLOT_MARGIN, SERIES_COLOR, SERIES_DASH, CHART_FONT_LARGE } from "../core/chart.js";

// 세 선이 오른쪽 끝에서 모이므로 이름표는 그림 밖 여백에 둔다
const MARGIN = { ...PLOT_MARGIN, left: 50, right: 80, top: 24, bottom: 44 };
import { experimentASteady, cylinderHeat, radiationCrossover, CROSSOVER_SEARCH_SPAN, morganCN } from "../physics/experiment-a.js";

let defaultResistance;

// 화면 입력값을 물리 모델의 인자 형태로 변환
function readInputs() {
  return {
    V: numberValue("#aVoltage", 0),
    I: numberValue("#aCurrent", 0),
    taC: numberValue("#aAirTemp", 25),
    tsC: numberValue("#aSurfaceTemp", 90),
    model: $("#aModelMcadams").checked ? "mcadams" : "morgan",
    k: numberValue("#aK", 0.027),
    nu: numberValue("#aNu", 1.75e-5),
    pr: numberValue("#aPr", 0.707)
  };
}

function chartTicks(min, max, step) {
  const first = Math.ceil(min / step), last = Math.floor(max / step);
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => (first + index) * step);
}

export function drawAChart() {
  const canvas = $("#aChart");
  const setup = setupCanvas(canvas);
  if (!setup) return;
  const { ctx, w, h } = setup;
  const input = readInputs();

  const crossings = [
    { model: "mcadams", name: "McAdams", color: SERIES_COLOR.conv },
    { model: "morgan", name: "Morgan", color: SERIES_COLOR.morgan }
  ].map(item => ({ ...item, point: radiationCrossover({ ...input, model: item.model }) }));
  const visibleCrossings = crossings.filter(item => item.point);
  const minX = Math.floor(input.taC);
  // 측정 온도를 낮춰도 두 교차점은 오른쪽 여백과 함께 표시한다.
  const maxX = Math.ceil(Math.max(180, input.taC + 30, input.tsC + 30,
    ...visibleCrossings.map(item => item.point.t + Math.max(30, (item.point.t - input.taC) * 0.1))));
  const missing = crossings.filter(item => !item.point).map(item => item.name);
  const note = $("#aCrossoverNote");
  note.hidden = missing.length === 0;
  note.textContent = missing.length
    ? `No high-temperature ${missing.join(" or ")}–radiation crossover found within ${CROSSOVER_SEARCH_SPAN.toLocaleString("en-US")} °C above air temperature for these inputs.`
    : "";
  const values = [];
  let maxY = 1;
  for (let i = 0; i < 100; i += 1) {
    const t = minX + (maxX - minX) * i / 99;
    const mcadams = cylinderHeat({ ...input, tsC: t, model: "mcadams" });
    const morgan = cylinderHeat({ ...input, tsC: t, model: "morgan" });
    const qa = Math.abs(mcadams.qConv), qm = Math.abs(morgan.qConv), qr = Math.abs(mcadams.qRad);
    values.push({ t, qa, qm, qr });
    maxY = Math.max(maxY, qa, qm, qr);
  }
  maxY = Math.ceil(maxY * 1.12);

  const { xMap, yMap } = makeScales(w, h, [minX, maxX], [0, maxY], MARGIN);
  // 보조선 간격과 숫자가 겹치지 않는 주 눈금 간격은 분리한다.
  const plotWidth = w - MARGIN.left - MARGIN.right, plotHeight = h - MARGIN.top - MARGIN.bottom;
  const xLabelStep = 25 * Math.max(1, Math.ceil((maxX - minX) / 25 / Math.max(2, Math.floor(plotWidth / 60))));
  const yTarget = Math.max(1, maxY / Math.max(2, Math.floor(plotHeight / 32)));
  const magnitude = 10 ** Math.floor(Math.log10(yTarget));
  const yLabelStep = [1, 2, 5, 10].find(step => step * magnitude >= yTarget) * magnitude;
  drawAxes(ctx, w, h, "Surface T₁₀ (°C)", "Q (W)",
    chartTicks(minX, maxX, xLabelStep), chartTicks(0, maxY, yLabelStep), xMap, yMap, MARGIN,
    { font: CHART_FONT_LARGE, gridWidth: 0.6, minorGridWidth: 0.3,
      minorXTicks: chartTicks(minX, maxX, 25), minorYTicks: chartTicks(0, maxY, 1),
      xTickOffset: 24, axisLabelInset: 4, yLabelY: 14 });
  // 모델별 색을 구분하고 모든 열량 곡선을 실선으로 그린다.
  drawLine(ctx, values.map(item => [xMap(item.t), yMap(item.qa)]), SERIES_COLOR.conv, 2.2, SERIES_DASH.solid);
  drawLine(ctx, values.map(item => [xMap(item.t), yMap(item.qm)]), SERIES_COLOR.morgan, 2.2, SERIES_DASH.solid);
  drawLine(ctx, values.map(item => [xMap(item.t), yMap(item.qr)]), SERIES_COLOR.rad, 2.2, SERIES_DASH.solid);

  drawVerticalMarker(ctx, xMap(clamp(input.tsC, minX, maxX)), h, SERIES_COLOR.marker, MARGIN);

  // 두 모델의 고온 교차점을 표시하고 이름표가 서로 겹치지 않게 놓는다.
  const occupied = [];
  const labelLayer = [];
  const markers = visibleCrossings.map(({ point }) => ({ x: xMap(point.t), y: yMap(point.q) }));
  for (const { point, name, color } of visibleCrossings.sort((a, b) => b.point.q - a.point.q)) {
    const box = drawCrossing(ctx, xMap(point.t), yMap(point.q), `${name} = radiation\nT₁₀ = ${point.t.toFixed(0)} °C`, h,
      { margin: MARGIN, font: CHART_FONT_LARGE, color, occupied, markers, labelLayer, backgroundOpacity: 0.88 });
    occupied.push(box);
  }

  const last = values[values.length - 1];
  labelEnds(ctx, [
    { name: "McAdams", color: SERIES_COLOR.conv, x: xMap(last.t), y: yMap(last.qa) },
    { name: "Morgan", color: SERIES_COLOR.morgan, x: xMap(last.t), y: yMap(last.qm) },
    { name: "Radiation", color: SERIES_COLOR.rad, x: xMap(last.t), y: yMap(last.qr) }
  ], { outside: true, font: CHART_FONT_LARGE, lineGap: 18 });

  // 설명 상자는 모든 곡선·점선·계열 이름 위에 놓는다.
  labelLayer.forEach(drawLabel => drawLabel());

}

function fitSplitLabels() {
  for (const [prefix, valueId] of [["aConv", "aConv"], ["aRad", "aRad"], ["aLoss", "aResidual"]]) {
    const label = $("#" + prefix + "Label");
    const percent = $("#" + prefix + "Pct").textContent;
    const fits = percent !== "" && label.parentElement.clientWidth >= label.scrollWidth + 8;
    label.style.visibility = fits ? "visible" : "hidden";
    $("#" + prefix + "PctFallback").textContent = fits || percent === "" ? "" : $("#" + valueId).textContent + " " + percent;
  }
}

/**
 * 공급 전력이 대류·복사·나머지로 어떻게 갈리는지 그린다.
 *
 * 배분이라는 말이 성립하지 않는 두 경우에는 막대를 비우고 이유를 적는다.
 * 표면이 공기보다 차가우면 실린더는 열을 잃는 쪽이 아니라 얻는 쪽이고,
 * 전력이 0이면 나눌 것이 없다. 앞의 경우는 리그에서 T8과 T10을 바꿔 적는
 * 흔한 실수인데, 침묵하면 학생은 음수 옆에 그려진 양의 막대를 믿는다.
 */
function showSplit(input, result) {
  const qIn = Math.abs(result.qIn);
  const reversed = input.tsC <= input.taC;
  const noPower = qIn <= 1e-12;
  const note = $("#aSplitNote");

  if (reversed) {
    note.textContent = "Surface T₁₀ sits at or below air T₈, so the cylinder is gaining heat rather than losing it. There is no supplied power to split. Check whether T₈ and T₁₀ went into the right boxes.";
  } else if (noPower) {
    note.textContent = "No electrical power is entering the cylinder, so there is nothing to split. Enter the voltage and current you measured.";
  }
  note.hidden = !(reversed || noPower);

  if (reversed || noPower) {
    ["#aConvPct", "#aRadPct", "#aLossPct"].forEach(id => { $(id).textContent = ""; });
    $("#aStackBar").setAttribute("aria-label", note.textContent);
    ["#aConvBar", "#aRadBar", "#aLossBar"].forEach(id => { $(id).style.width = "0%"; });
    $("#aStackBar").classList.remove("is-over");
    $("#aOverflowNote").hidden = true;
    fitSplitLabels();
    return;
  }

  // 분모는 대류+복사 합이 아니라 공급 전력이어야 막대가 100%를 뜻한다.
  const share = value => value / qIn * 100;
  const convPct = share(Math.abs(result.qConv));
  const radPct = share(Math.abs(result.qRad));
  const residualPct = share(result.residual);

  $("#aConvPct").textContent = `(${convPct.toFixed(1)}%)`;
  $("#aRadPct").textContent = `(${radPct.toFixed(1)}%)`;
  $("#aLossPct").textContent = `(${residualPct.toFixed(1)}%)`;
  const modelName = input.model === "morgan" ? "Morgan" : "McAdams";
  $("#aStackBar").setAttribute("aria-label", `Electrical input ${result.qIn.toFixed(2)} W. Convection (${modelName}) ${result.qConv.toFixed(2)} W (${convPct.toFixed(1)}%), radiation ${result.qRad.toFixed(2)} W (${radPct.toFixed(1)}%), unmodelled ${result.residual.toFixed(2)} W (${residualPct.toFixed(1)}%).`);

  // 모델 합이 공급 전력을 넘으면 잔차가 음수가 된다. 막대를 100%에서 끊고 빗금으로 알린다.
  const over = residualPct < 0;
  const scale = over ? 100 / Math.max(convPct + radPct, 1e-9) : 1;
  $("#aConvBar").style.width = `${clamp(convPct * scale, 0, 100)}%`;
  $("#aRadBar").style.width = `${clamp(radPct * scale, 0, 100)}%`;
  $("#aLossBar").style.width = `${over ? 0 : clamp(residualPct, 0, 100)}%`;
  $("#aStackBar").classList.toggle("is-over", over);
  $("#aOverflowNote").hidden = !over;
  fitSplitLabels();
}

export function updateA() {
  const input = readInputs();
  const result = experimentASteady(input);

  $("#aResistance").value = $("#aLockResistance").checked
    ? defaultResistance.toFixed(2)
    : input.I === 0 ? "—" : (input.V / input.I).toFixed(2);
  $("#aPower").innerHTML = formatW(result.qIn);
  $("#aConv").innerHTML = formatW(result.qConv);
  $("#aRad").innerHTML = formatW(result.qRad);
  $("#aResidual").innerHTML = formatW(result.residual);
  $("#aConvSub").textContent = `${result.hConv.toFixed(2)} W·m⁻²·K⁻¹`;
  $("#aRadSub").textContent = `${result.hRad.toFixed(2)} W·m⁻²·K⁻¹`;
  const morgan = input.model === "morgan";
  $("#aMcadamsCoefficientFormula").hidden = morgan;
  $("#aMorganCoefficientFormula").hidden = !morgan;
  $("#experiment-a").dataset.convectionModel = input.model;
  const modelName = morgan ? "Morgan" : "McAdams";
  renderFormula($("#aConvectionModelExponent"), String.raw`Q_c^{\mathrm{${modelName}}}`);
  $("#aConvectionLegend").textContent = "Convection (" + modelName + ")";
  const morganHeat = morgan ? result : cylinderHeat({ ...input, model: "morgan" });
  const exponent = $("#aMorganTemperatureExponent");
  if (morganHeat.ra > 0) {
    const { n } = morganCN(Math.log10(morganHeat.ra));
    exponent.textContent = String(Number((1 + n).toFixed(3)));
    exponent.title = `Approximate temperature exponent at measured T₁₀: 1 + n, with n = ${n}. Assumes nearly constant film temperature and air properties; n varies with Ra.`;
  } else {
    exponent.textContent = "1+n";
    exponent.title = "The approximate temperature exponent is 1 + n. A nonzero temperature difference is needed to select the Ra range.";
  }

  showSplit(input, result);

  if (result.model === "morgan") {
    $("#aWarning").textContent = `Morgan correlation, Ra = ${result.ra ? result.ra.toExponential(2) : "0"}, using the k, ν and Pr you entered.${result.extrapolated ? " This Ra falls outside the table in the course notes." : ""}`;
  } else {
    $("#aWarning").textContent = "McAdams simple correlation. Cylinder dimensions and emissivity are still placeholder values.";
  }
  drawAChart();
}

// 상세 패널은 <div hidden>이므로 <details>의 open 속성으로는 열리지 않는다.
function setAdvanced(open) {
  $("#aAdvanced").hidden = !open;
  $("#aAdvancedToggle").setAttribute("aria-expanded", String(open));
}

export function initExperimentAView() {
  renderFormulas($("#experiment-a"));
  const splitObserver = new ResizeObserver(fitSplitLabels);
  ["#aConvBar", "#aRadBar", "#aLossBar", "#aConvLabel", "#aRadLabel", "#aLossLabel"]
    .forEach(id => splitObserver.observe($(id)));

  const voltage = $("#aVoltage");
  const current = $("#aCurrent");
  const lock = $("#aLockResistance");
  // 고정 기준은 현재 입력값이 아니라 기본 조건인 11 V, 1.87 A의 비율이다.
  defaultResistance = Number(voltage.defaultValue) / Number(current.defaultValue);
  lock.setAttribute("aria-label", "Fix resistance to default (" + defaultResistance.toFixed(2) + " Ω)");
  lock.title = "Default resistance: " + defaultResistance.toFixed(2) + " Ω";
  let electricalSource = "voltage";
  const syncElectricalInputs = () => {
    if (lock.checked) {
      if (electricalSource === "voltage") current.value = (numberValue("#aVoltage") / defaultResistance).toFixed(6).replace(/\.?0+$/, "");
      else voltage.value = (numberValue("#aCurrent") * defaultResistance).toFixed(6).replace(/\.?0+$/, "");
    }
    updateA();
  };
  voltage.addEventListener("input", () => { electricalSource = "voltage"; syncElectricalInputs(); });
  current.addEventListener("input", () => { electricalSource = "current"; syncElectricalInputs(); });
  lock.addEventListener("change", syncElectricalInputs);

  const adjustSteppedInput = (element, onStep, step, direction) => {
    element.value = Math.max(Number(element.min), Number(element.value) + direction * step).toFixed(6).replace(/\.?0+$/, "");
    onStep();
  };
  for (const [up, down, element, onStep, step] of [
    ["#aVoltageUp", "#aVoltageDown", voltage, () => { electricalSource = "voltage"; syncElectricalInputs(); }, 0.1],
    ["#aCurrentUp", "#aCurrentDown", current, () => { electricalSource = "current"; syncElectricalInputs(); }, 0.1],
    ["#aAirTempUp", "#aAirTempDown", $("#aAirTemp"), updateA, 1],
    ["#aSurfaceTempUp", "#aSurfaceTempDown", $("#aSurfaceTemp"), updateA, 1]
  ]) {
    $(up).addEventListener("click", () => adjustSteppedInput(element, onStep, step, 1));
    $(down).addEventListener("click", () => adjustSteppedInput(element, onStep, step, -1));
    element.addEventListener("keydown", event => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      adjustSteppedInput(element, onStep, step, event.key === "ArrowUp" ? 1 : -1);
    });
  }

  ["#aAirTemp", "#aSurfaceTemp", "#aK", "#aNu", "#aPr"]
    .forEach(id => $(id).addEventListener("input", updateA));

  $("#aAdvancedToggle").addEventListener("click", () => setAdvanced($("#aAdvanced").hidden));

  // Morgan은 공기 물성 입력이 필요하므로 상세 패널을 펼침
  $("#aModel").addEventListener("change", () => {
    updateA();
    if ($("#aModelMorgan").checked) setAdvanced(true);
  });

  updateA();
}
