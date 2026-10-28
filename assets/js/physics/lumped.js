// Lumped-parameter 시간응답 모델.
// 유효 열용량과 추가 열손실 계수는 교안에 없으므로 실측 시간 기록으로 보정 필요.

import { rk4Scalar, bisect } from "../core/numeric.js";
import { cylinderHeat } from "./experiment-a.js";
import { SIGMA, AIR, toK } from "./constants.js";
import { solveSensor } from "./experiment-b.js";

// 실린더·히터 1-node: C dTs/dt = V·I - Qconv(Ts) - Qrad(Ts) - UA·(Ts - Ta)
export function simulateCylinder({ V, I, ta, initial, capacity, ua, duration, model = "mcadams", dt = Math.min(0.5, duration / 1200) }) {
  const input = V * I;
  const outputEvery = Math.max(1, Math.round((duration / dt) / 300));  // 그래프에 남길 점의 개수를 제한합니다

  const derivative = value => {
    const heat = cylinderHeat({ tsC: value, taC: ta, model });
    return (input - heat.qConv - heat.qRad - ua * (value - ta)) / capacity;
  };

  // 종료 시각과 무관하게 순열량이 0인 온도를 구한다. 추가 손실 UA도 포함한다.
  let upper = ta + 1;
  let expansions = 0;
  while (derivative(upper) > 0 && expansions < 60) {
    upper = ta + 2 * (upper - ta);
    expansions += 1;
  }
  if (!Number.isFinite(derivative(upper)) || derivative(upper) > 0) {
    throw new RangeError("Could not bracket the cylinder steady-state temperature.");
  }
  const equilibrium = input === 0 ? ta : bisect(derivative, ta, upper);

  let temp = initial;
  const points = [{ t: 0, temp, rate: derivative(temp) }];
  let step = 0;

  for (let t = 0; t < duration - 1e-9; t += dt) {
    // dt가 duration을 정확히 나누지 못하면 마지막 구간을 잘라 duration에 맞춘다.
    // 그러지 않으면 마지막 점의 라벨과 실제 적분 시각이 어긋난다.
    const h = Math.min(dt, duration - t);
    temp = rk4Scalar(temp, h, derivative);
    step += 1;
    if (step % outputEvery === 0 || t + h >= duration - 1e-9) points.push({ t: t + h, temp, rate: derivative(temp) });
  }

  const finalHeat = cylinderHeat({ tsC: temp, taC: ta, model });
  const target = initial + 0.95 * (temp - initial);
  const t95Point = points.find(point => (temp >= initial ? point.temp >= target : point.temp <= target));

  return {
    points, equilibrium, finalTemp: temp, t95: t95Point?.t ?? duration,
    qConv: finalHeat.qConv, qRad: finalHeat.qRad, ta, duration, input
  };
}

// 비드 1-node: C dTb/dt = εσFA(Tw⁴ - Tb⁴) - hA(Tb - Tg). 벽·공기·유속은 시간에 대해 일정하다.
export function simulateSensors({ wall, gas, velocity, initial, t6Emissivity, duration = 600, names = ["T6", "T7", "T8"], samples = 600, dt, beadProperties = {} } = {}) {
  if (![wall, gas, velocity, initial, duration].every(Number.isFinite)
      || Math.min(wall, gas, initial) <= -273.15 || velocity < 0 || duration < 0
      || !Number.isInteger(samples) || samples < 1
      || (dt !== undefined && (!Number.isFinite(dt) || dt <= 0))) {
    throw new RangeError("Invalid sensor transient conditions or integration step");
  }
  const sensors = names.map(name => solveSensor(name, { wallC: wall, gasC: gas, velocity, t6Emissivity, material: beadProperties[name] }));
  const series = {};
  const integration = {};
  const finalResults = {};
  const wallK = toK(wall);

  names.forEach((name, index) => {
    const sensor = sensors[index];
    const radiation = sensor.epsilon * SIGMA * AIR.F;
    // 도달 가능한 최고 온도에서 가장 짧은 시간상수를 잡아 작은 비드도 안정적으로 적분한다.
    const maxK = toK(Math.max(initial, wall, gas));
    const minTau = sensor.thermalCapacity / (sensor.area * (sensor.h + 4 * radiation * maxK ** 3));
    const maxStep = Math.min(dt ?? 0.1, minTau / 20);
    if (duration / maxStep + samples > 2000000) {
      throw new RangeError("This heat capacity requires too many integration steps. Increase it or shorten the duration.");
    }
    const heatAt = temp => {
      const beadK = toK(temp);
      // T⁴의 차를 인수분해해 온도차가 작을 때의 유효 숫자 손실을 줄인다.
      const qRad = radiation * sensor.area * (wall - temp) * (wallK + beadK) * (wallK ** 2 + beadK ** 2);
      const qConv = sensor.h * sensor.area * (temp - gas);
      return { qRad, qConv };
    };
    const derivative = temp => {
      const { qRad, qConv } = heatAt(temp);
      return (qRad - qConv) / sensor.thermalCapacity;
    };
    let temp = initial;
    let previous = 0;
    let steps = 0;
    series[name] = [{ t: 0, temp, rate: derivative(temp) }];
    for (let i = 1; i <= samples && duration > 0; i += 1) {
      const target = duration * i / samples;
      // 그래프 저장 간격과 적분 간격을 분리하고 각 저장 시각에 정확히 도달한다.
      const count = Math.ceil((target - previous) / maxStep);
      const step = (target - previous) / count;
      for (let j = 0; j < count; j += 1) temp = rk4Scalar(temp, step, derivative);
      steps += count;
      series[name].push({ t: target, temp, rate: derivative(temp) });
      previous = target;
    }
    finalResults[name] = { temp, ...heatAt(temp) };
    integration[name] = { maxStep, steps };
  });

  return { wall, gas, velocity, initial, duration, sensors, series, integration, finalResults };
}
