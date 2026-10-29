import { bisect } from "../core/numeric.js";
import { integrateTransient } from "../core/transient.js";
import { cylinderHeat } from "./experiment-a.js";
import { AIR_AUTO, toK } from "./constants.js";
import { solveSensor, sensorHeat } from "./experiment-b.js";

export function simulateCylinder({ V, I, ta, initial, capacity, ua, duration, model = "mcadams", air, dt = 0.5 }) {
  if (![V, I, ta, initial, capacity, ua, duration, dt].every(Number.isFinite) || V < 0 || I < 0 || capacity <= 0 || ua < 0 || duration < 0 || dt <= 0 || Math.min(ta, initial) <= -273.15) throw new RangeError("Invalid cylinder conditions.");
  const warnings = new Set();
  const heatAt = value => {
    const heat = cylinderHeat({ tsC: value, taC: ta, model, air });
    if (heat.extrapolated) warnings.add("Morgan: Ra outside the tabulated correlation range.");
    return heat;
  };
  const input = V * I;
  const net = value => { const heat = heatAt(value); return input - heat.qConv - heat.qRad - ua * (value - ta); };
  const derivative = value => net(value) / capacity;
  const limit = model === "morgan" && air?.mode === "auto" ? 2 * AIR_AUTO.maxK - toK(ta) - 273.15 : 100000;
  let upper = Math.min(ta + 1, limit);
  while (net(upper) > 0 && upper < limit) upper = Math.min(ta + 2 * (upper - ta), limit);
  if (net(upper) > 0) throw new RangeError("Steady state lies outside the supported temperature range. Use manual air properties or reduce power.");
  const root = input === 0 ? ta : bisect(net, ta, upper);
  const residual = net(root);
  const equilibrium = Math.abs(residual) <= 1e-7 * Math.max(1, input) ? root : undefined;
  if (equilibrium === undefined) warnings.add("Morgan segment boundary: steady balance did not meet the residual tolerance; the steady-state guide is omitted.");
  const integration = integrateTransient({ initial, duration, derivative, maxStep: Math.min(dt, capacity / (20 * (1 + ua))) });
  const points = integration.points, finalTemp = points.at(-1).temp;
  const finalHeat = heatAt(finalTemp), initialHeat = heatAt(initial);
  const target = initial + 0.95 * (finalTemp - initial);
  const t95 = points.find(p => finalTemp >= initial ? p.temp >= target : p.temp <= target)?.t ?? duration;
  return { points, finalTemp, equilibrium, steadyResidual: residual, t95, qConv: finalHeat.qConv, qRad: finalHeat.qRad,
    ta, duration, input, integration, warnings: [...warnings], airStart: initialHeat.airUsed, airEnd: finalHeat.airUsed };
}

export function simulateSensors({ wall, gas, velocity = 0, initial, t6Emissivity, duration = 600, names = ["T6", "T7", "T8"], samples = 600, dt = 0.1, beadProperties = {}, model = "ranz-marshall", air } = {}) {
  if (![wall, gas, velocity, initial, duration, dt].every(Number.isFinite) || Math.min(wall, gas, initial) <= -273.15 || velocity < 0 || duration < 0 || dt <= 0 || !Number.isInteger(samples) || samples < 1) throw new RangeError("Invalid sensor transient conditions.");
  const sensors = names.map(name => solveSensor(name, { wallC: wall, gasC: gas, velocity, t6Emissivity, material: beadProperties[name], model, air }));
  const series = {}, integration = {}, finalResults = {}, airStart = {}, airEnd = {};
  const warnings = new Set();
  for (const sensor of sensors) {
    const heatAt = beadC => {
      const heat = sensorHeat(sensor, { wallC: wall, gasC: gas, velocity, beadC, model, air });
      if (heat.extrapolated) warnings.add(model === "churchill" ? "Churchill: outside the recommended Pr ≥ 0.7 / Ra ≤ 10¹¹ range; results are extrapolations." : "Ranz–Marshall: Re exceeds the original low-Re range (200); results are extrapolations.");
      return heat;
    };
    const derivative = value => { const heat = heatAt(value); return (heat.qRad - heat.qConv) / sensor.thermalCapacity; };
    // 온도 구간의 기울기로 간격 상한을 잡고, 각 단계에서 오차도 추정한다.
    let maxSlope = 0;
    const lo = Math.min(initial, wall, gas), hi = Math.max(initial, wall, gas);
    for (let i = 0; i < 32; i++) {
      const a = lo + (hi - lo) * i / 32, b = lo + (hi - lo) * (i + 1) / 32;
      if (b > a) maxSlope = Math.max(maxSlope, Math.abs((derivative(b) - derivative(a)) / (b - a)));
    }
    const maxStep = Math.min(dt, maxSlope > 0 ? 0.05 / maxSlope : dt);
    const result = integrateTransient({ initial, duration, derivative, samples, maxStep });
    series[sensor.name] = result.points;
    integration[sensor.name] = { maxStep, steps: result.steps, rejected: result.rejected };
    const temp = result.points.at(-1).temp;
    finalResults[sensor.name] = { temp, ...heatAt(temp) };
    airStart[sensor.name] = heatAt(initial).airUsed;
    airEnd[sensor.name] = finalResults[sensor.name].airUsed;
  }
  return { wall, gas, velocity, initial, duration, sensors, series, integration, finalResults, airStart, airEnd, warnings: [...warnings] };
}
