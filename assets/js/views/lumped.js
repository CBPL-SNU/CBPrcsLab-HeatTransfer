import { simulateCylinder, simulateSensors } from "../physics/lumped.js";
import { BEAD_MATERIAL, SENSOR_DEFS, AIR, CYLINDER } from "../physics/constants.js";
import { setupCanvas, drawAxes, drawLine, makeScales, SERIES_COLOR, PLOT_MARGIN, labelEnds, CHART_INK, labelOnPlot } from "../core/chart.js";
import { nearestTimeIndex, pointTooltipPosition } from "../core/lumped-probe.js";

const states = {};
const COLORS = ["#0072b2", "#d55e00", "#008060"];
const MARGIN = { ...PLOT_MARGIN, left: 108, right: 58 };

function tableValue(value, unit, decimals = null) {
  const result = document.createElement("span");
  const magnitude = Math.abs(value);
  if (magnitude > 0 && (magnitude < 0.1 || magnitude >= 1e6)) {
    const [mantissa, exponent] = value.toExponential(4).split("e");
    const power = document.createElement("sup");
    power.textContent = String(Number(exponent)).replace("-", "−");
    result.append(String(Number(mantissa)) + " × 10", power, " " + unit);
  } else {
    result.textContent = (decimals === null ? value.toPrecision(5) : value.toFixed(decimals)) + " " + unit;
  }
  return result;
}

function marker(ctx, x, y, color, index) {
  ctx.beginPath();
  if (index === 1) ctx.rect(x - 4, y - 4, 8, 8);
  else if (index === 2) { ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y + 4); ctx.lineTo(x - 5, y + 4); ctx.closePath(); }
  else ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

export function drawLumpedView(kind) {
  const state = states[kind];
  if (!state) return;
  const canvas = state.section.querySelector("[data-lumped-chart]");
  const setup = setupCanvas(canvas);
  if (!setup) return;
  const { ctx, w, h } = setup;
  const temps = state.lines.flatMap(line => [...line.points.map(p => p.temp), ...(line.equilibrium === undefined ? [] : [line.equilibrium])]);
  const lo = Math.min(...temps), hi = Math.max(...temps);
  const pad = Math.max(1, (hi - lo) * 0.12);
  const min = Math.floor(lo - pad), max = Math.ceil(hi + pad);
  const { xMap, yMap } = makeScales(w, h, [0, state.duration], [min, max], MARGIN);
  state.plot = { xMap, yMap, w, h };
  // 가까운 정상상태 눈금은 간격을 벌리고 실제 높이까지 연결선을 그린다.
  const guides = state.lines.filter(line => line.equilibrium !== undefined)
    .map(line => ({ ...line, y: yMap(line.equilibrium) })).sort((a, b) => a.y - b.y);
  let previousY = MARGIN.top - 16;
  guides.forEach(guide => { guide.labelY = Math.max(guide.y, previousY + 16); previousY = guide.labelY; });
  if (guides.length) {
    const shift = Math.max(0, guides.at(-1).labelY - (h - MARGIN.bottom));
    guides.forEach(guide => { guide.labelY -= shift; });
  }
  const ticks = [min, (min + max) / 2, max];
  drawAxes(ctx, w, h, "t (s)", "T (°C)", [0, state.duration / 2, state.duration], [], xMap, yMap, MARGIN);
  ticks.forEach(value => drawLine(ctx, [[MARGIN.left, yMap(value)], [w - MARGIN.right, yMap(value)]], CHART_INK.grid, 1));
  guides.forEach(guide => {
    const text = guide.equilibrium.toFixed(2);
    const start = 5 + ctx.measureText(text).width + 4;
    drawLine(ctx, [[start, guide.labelY], [MARGIN.left - 44, guide.y], [MARGIN.left, guide.y]], guide.color, 1);
    ctx.fillStyle = guide.color;
    ctx.textAlign = "left";
    ctx.fillText(text, 5, guide.labelY + 4);
  });
  // 회색 눈금은 축 가까이, 정상상태 값은 바깥쪽 열에 둔다.
  ticks.forEach(value => labelOnPlot(ctx, String(value), MARGIN.left - 6, yMap(value) + 4, CHART_INK.ink, "right"));
  ctx.textAlign = "left";
  // 정상상태는 축 범위에 포함시키고, 시간응답보다 먼저 그려 실선을 가리지 않는다.
  state.lines.forEach(line => {
    if (line.equilibrium !== undefined) drawLine(ctx, [[xMap(0), yMap(line.equilibrium)], [xMap(state.duration), yMap(line.equilibrium)]], line.color, 1.4, [5, 4]);
  });
  state.lines.forEach(line => {
    drawLine(ctx, line.points.map(p => [xMap(p.t), yMap(p.temp)]), line.color, 2.2);
  });
  labelEnds(ctx, state.lines.map(line => ({ name: line.name, color: line.color, x: xMap(state.duration), y: yMap(line.points.at(-1).temp) })), { outside: true });
  if (state.selected) {
    const { lineIndex, pointIndex } = state.selected;
    const line = state.lines[lineIndex], p = line.points[pointIndex];
    marker(ctx, xMap(p.t), yMap(p.temp), line.color, lineIndex);
    ctx.beginPath(); ctx.arc(xMap(p.t), yMap(p.temp), 7, 0, Math.PI * 2); ctx.strokeStyle = line.color; ctx.stroke();
    const tip = state.section.querySelector("[data-lumped-tooltip]");
    const inspector = tip.parentElement;
    const position = pointTooltipPosition(canvas.offsetLeft + xMap(p.t), canvas.offsetTop + yMap(p.temp), tip.offsetWidth, tip.offsetHeight, inspector.clientWidth, inspector.clientHeight);
    tip.style.left = position.left + "px";
    tip.style.top = position.top + "px";
  }
  canvas.setAttribute("aria-label", "Interactive temperature response. " + state.lines.map(line => line.name + ': ' + line.points[0].temp.toFixed(2) + ' to ' + line.points.at(-1).temp.toFixed(2) + ' °C' + (line.equilibrium === undefined ? '' : ', steady state ' + line.equilibrium.toFixed(2) + ' °C')).join('; ') + '. Use arrow keys to inspect samples.');
}

function showPoint(kind, lineIndex, pointIndex) {
  const state = states[kind];
  state.selected = { lineIndex, pointIndex };
  const line = state.lines[lineIndex], point = line.points[pointIndex];
  const tip = state.section.querySelector("[data-lumped-tooltip]");
  tip.hidden = false;
  const rate = Math.abs(point.rate) < 1e-10 ? "0.000000" : point.rate.toPrecision(6);
  tip.textContent = (kind === "b" ? line.name + '\n' : '') + 't = ' + point.t.toFixed(3) + ' s\nT = ' + point.temp.toFixed(3) + ' °C\ndT/dt = ' + rate + ' °C/s';
  tip.style.borderColor = line.color;

  drawLumpedView(kind);
}

function initInspection(kind, section) {
  const canvas = section.querySelector("[data-lumped-chart]");
  const pick = section.querySelector("[data-lumped-curve]");
  const tip = section.querySelector("[data-lumped-tooltip]");
  tip.hidden = true;
  function clear() {
    if (!states[kind]) return;
    states[kind].selected = null;
    tip.textContent = "";
    tip.hidden = true;
    drawLumpedView(kind);
  }
  function inspect(event) {
    const state = states[kind];
    if (!state?.plot) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    const { xMap, yMap, w, h } = state.plot;
    if (x < MARGIN.left || x > w - MARGIN.right || y < MARGIN.top || y > h - MARGIN.bottom) { clear(); return; }
    const time = (x - MARGIN.left) / (w - MARGIN.left - MARGIN.right) * state.duration;
    let best = null;
    state.lines.forEach((line, lineIndex) => {
      if (pick && pick.value !== "all" && Number(pick.value) !== lineIndex) return;
      // 초기 급변 구간에서는 x가 가까운 점 외에 주변 점도 조사한다.
      const near = nearestTimeIndex(line.points, time);
      for (let pointIndex = Math.max(0, near - 2); pointIndex <= Math.min(line.points.length - 1, near + 2); pointIndex++) {
        const p = line.points[pointIndex];
        const distance = Math.hypot(xMap(p.t) - x, yMap(p.temp) - y);
        if (!best || distance < best.distance) best = { distance, lineIndex, pointIndex };
      }
    });
    if (best && best.distance <= (event.pointerType === "touch" ? 36 : 24)) showPoint(kind, best.lineIndex, best.pointIndex);
    else clear();
  }
  canvas.addEventListener("pointermove", inspect);
  canvas.addEventListener("pointerdown", inspect);
  canvas.addEventListener("pointerleave", event => { if (event.pointerType !== "touch") clear(); });
  canvas.addEventListener("keydown", event => {
    const state = states[kind];
    if (!state) return;
    if (event.key === "Escape") { clear(); return; }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let lineIndex = state.selected?.lineIndex ?? (!pick || pick.value === "all" ? 0 : Number(pick.value));
    let pointIndex = state.selected?.pointIndex ?? 0;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      lineIndex = (lineIndex + (event.key === "ArrowDown" ? 1 : state.lines.length - 1)) % state.lines.length;
      if (pick) pick.value = String(lineIndex);
    }
    const last = state.lines[lineIndex].points.length - 1;
    if (event.key === "ArrowLeft") pointIndex--;
    if (event.key === "ArrowRight") pointIndex++;
    if (event.key === "Home") pointIndex = 0;
    if (event.key === "End") pointIndex = last;
    showPoint(kind, lineIndex, Math.min(last, Math.max(0, pointIndex)));
  });
  pick?.addEventListener("change", clear);
}

function materialInputs(section) {
  const target = section.querySelector("[data-lumped-materials]");
  for (const name of Object.keys(SENSOR_DEFS)) {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = name + ' · diameter ' + (SENSOR_DEFS[name].d * 1000).toFixed(1) + ' mm';
    fieldset.append(legend);
    for (const [key, text, value, min] of [
      ["density", "Density (kg/m³)", BEAD_MATERIAL.density, 1],
      ["cp", "Specific heat (J/kg·K)", BEAD_MATERIAL.cp, 1],
      ["thermalCapacity", "Effective C (J/K, optional)", "", 0.000001]
    ]) {
      const label = document.createElement("label"), input = document.createElement("input");
      input.name = name + '-' + key;
      input.type = "number"; input.step = "any"; input.min = String(min); input.value = value;
      input.required = key !== "thermalCapacity";
      label.append(document.createTextNode(text), input);
      fieldset.append(label);
    }
    target.append(fieldset);
  }
}

function initAirControls(kind, form) {
  const model = form.elements.model, mode = form.elements.airMode;
  const manual = form.querySelector("[data-air-manual]");
  function sync() {
    const unused = kind === "a" && model.value === "mcadams";
    mode.disabled = unused;
    manual.disabled = unused || mode.value === "auto";
    if (kind === "b") form.elements.velocity.disabled = model.value === "churchill";
    form.querySelector("[data-air-policy]").textContent = unused
      ? "McAdams does not use these air-property inputs. Choose Morgan to enable them."
      : model.value === "ranz-marshall"
        ? "Ranz–Marshall evaluates air at the mean bead–air film temperature. Velocity is used; buoyancy is not included."
        : "Air is evaluated at the mean body–air film temperature (K); β = 1/Tfilm. Natural convection does not use imposed velocity. Natural and forced convection are not combined.";
  }
  model.addEventListener("change", sync);
  mode.addEventListener("change", sync);
  sync();
}

export function initLumpedView(kind) {
  const section = document.getElementById(kind + "-lumped");
  const form = section.querySelector("[data-lumped-form]");
  const error = section.querySelector("[data-lumped-error]");
  const status = section.querySelector("[data-lumped-status]");
  if (kind === "b") materialInputs(section);
  initInspection(kind, section);
  initAirControls(kind, form);
  function update(event) {
    event?.preventDefault();
    if (!form.reportValidity()) return;
    const raw = Object.fromEntries(new FormData(form));
    const p = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== "").map(([key, value]) => [key, ["model", "airMode"].includes(key) ? value : Number(value)]));
    p.airMode ??= "manual";
    p.air = { mode: p.airMode, k: p.airK, nu: p.airNu === undefined ? undefined : p.airNu * 1e-6, pr: p.airPr };
    if (kind === "b" && p.model === "churchill") p.velocity = 0;
    error.hidden = true;
    try {
      let lines, rows, result;
      if (kind === "a") {
        const r = simulateCylinder({ ...p, dt: Math.min(0.5, p.capacity / (20 * (1 + p.ua))) });
        result = r;
        if (!Number.isFinite(r.finalTemp)) throw new Error("Please check the input conditions.");
        lines = [{ name: "Tₛ", points: r.points, equilibrium: r.equilibrium, color: SERIES_COLOR.surface }];
        rows = [["Surface temperature", tableValue(r.finalTemp, "°C", 2)], ["Convection out", tableValue(r.qConv, "W", 3)], ["Radiation out", tableValue(r.qRad, "W", 3)]];
        section.querySelector("[data-lumped-fixed]").textContent = 'Fixed cylinder assumptions: diameter ' + CYLINDER.D * 1000 + ' mm; heated length ' + CYLINDER.L * 1000 + ' mm; emissivity ' + CYLINDER.epsilon + '; view factor ' + CYLINDER.F + '. Effective capacity includes the cylinder and heater.';
      } else {
        const beadProperties = Object.fromEntries(Object.keys(SENSOR_DEFS).map(name => [name, Object.fromEntries(["density", "cp", "thermalCapacity"].filter(key => p[name + '-' + key] !== undefined).map(key => [key, p[name + '-' + key]]))]));
        const r = simulateSensors({ ...p, beadProperties, samples: 1200 });
        result = r;
        lines = r.sensors.map((sensor, i) => ({ name: sensor.name, points: r.series[sensor.name], equilibrium: sensor.equilibrium, color: COLORS[i] }));
        rows = r.sensors.flatMap(sensor => {
          const last = r.finalResults[sensor.name];
          return [
            [sensor.name + " · Temperature", tableValue(last.temp, "°C", 2)],
            [sensor.name + " · Convection out", tableValue(last.qConv, "W")],
            [sensor.name + " · Radiation in", tableValue(last.qRad, "W")]
          ];
        });
        section.querySelector("[data-lumped-fixed]").textContent = 'Fixed assumptions: T6/T7 diameter ' + SENSOR_DEFS.T6.d * 1000 + '/' + SENSOR_DEFS.T7.d * 1000 + ' mm; T8 diameter ' + SENSOR_DEFS.T8.d * 1000 + ' mm; T7/T8 emissivity ' + SENSOR_DEFS.T7.epsilon + '/' + SENSOR_DEFS.T8.epsilon + '; view factor ' + AIR.F + '. Convection uses the selected correlation and air-property settings.';
        section.querySelector("[data-lumped-capacities]").textContent = 'Capacities used: ' + r.sensors.map(s => s.name + ' = ' + s.thermalCapacity.toPrecision(5) + ' J/K' + (beadProperties[s.name].thermalCapacity === undefined ? ' (ρcₚV)' : ' (override)')).join('; ') + '.';
      }
      const warning = section.querySelector("[data-lumped-warnings]");
      warning.textContent = result.warnings.join(" ");
      warning.hidden = result.warnings.length === 0;
      const airSummary = section.querySelector("[data-lumped-air]");
      airSummary.hidden = p.airMode !== "auto" || (kind === "a" && p.model === "mcadams");
      const airText = value => 'T = ' + value.temperatureK.toFixed(2) + ' K, k = ' + value.k.toPrecision(5) + ' W/(m·K), ν = ' + value.nu.toExponential(4) + ' m²/s, Pr = ' + value.pr.toPrecision(5);
      airSummary.textContent = airSummary.hidden ? "" : kind === "a"
        ? 'Air properties, start: ' + airText(result.airStart) + '; end: ' + airText(result.airEnd)
        : result.sensors.map(sensor => sensor.name + ' air properties, start: ' + airText(result.airStart[sensor.name]) + '; end: ' + airText(result.airEnd[sensor.name])).join(' | ');
      const body = section.querySelector("[data-lumped-results]");
      body.replaceChildren(...rows.map(([label, value]) => {
        const row = document.createElement("tr");
        for (const text of [label, value]) { const cell = document.createElement("td"); cell.append(text); row.append(cell); }
        return row;
      }));
      const legend = section.querySelector("[data-lumped-legend]");
      const legendItem = (label, color, dashed = false) => {
        const item = document.createElement("span");
        const swatch = document.createElement("i");
        swatch.setAttribute("aria-hidden", "true");
        swatch.style.borderColor = color;
        if (dashed) swatch.className = "dashed";
        item.append(swatch, document.createTextNode(label));
        return item;
      };
      const lineColor = kind === "a" ? lines[0].color : CHART_INK.ink;
      legend.replaceChildren(
        ...(kind === "b" ? lines.map(line => legendItem(line.name, line.color)) : []),
        legendItem("Transient response", lineColor),
        legendItem("Steady state", lineColor, true)
      );
      const pick = section.querySelector("[data-lumped-curve]");
      if (pick) {
      const selected = pick.value;
      pick.replaceChildren(...[...((kind === "b") ? [["all", "Nearest curve"]] : []), ...lines.map((line, index) => [String(index), line.name])].map(([value, text]) => { const option = document.createElement("option"); option.value = value; option.textContent = text; return option; }));
      if ([...pick.options].some(o => o.value === selected)) pick.value = selected;
      }
      const tip = section.querySelector("[data-lumped-tooltip]");
      tip.textContent = "";
      tip.hidden = true;
      states[kind] = { section, lines, duration: p.duration };
      status.textContent = "";
      status.hidden = true;
      drawLumpedView(kind);
    } catch (cause) {
      error.textContent = "Could not calculate the response. " + cause.message;
      error.hidden = false;
      status.textContent = "Calculation failed. Any displayed graph and table still belong to the previous successful run.";
      status.hidden = false;
    }
  }
  form.addEventListener("submit", update);
  form.addEventListener("input", () => {
    status.textContent = "Inputs have changed. Press Calculate to update the graph and results.";
    status.hidden = false;
  });
  update();
}
