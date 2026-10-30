// 실험 B: 벽 복사와 공기 대류가 함께 작용할 때 열전쌍 비드가 읽는 온도

import { SIGMA, toK, AIR, GRAVITY, SENSOR_DEFS, BEAD_MATERIAL } from "./constants.js";
import { airProperties } from "./air-properties.js";
import { bisect } from "../core/numeric.js";

// T6 복사율만 사용자가 조절하므로 호출 시점에 사양을 만듦
export function sensorSpec(name, { t6Emissivity } = {}) {
  const base = SENSOR_DEFS[name];
  if (!base) return null;
  if (name === "T6" && Number.isFinite(t6Emissivity)) {
    return { ...base, epsilon: Math.min(1, Math.max(0.01, t6Emissivity)) };
  }
  return { ...base };
}

// 두 구 상관식 모두 비드–공기 film 온도에서 물성을 평가한다.
export function beadConvection(spec, velocity, { model = "ranz-marshall", beadC = 25, gasC = 25, air } = {}) {
  if (!["ranz-marshall", "churchill"].includes(model)) throw new RangeError("Unknown bead correlation.");
  const temperatureK = toK((beadC + gasC) / 2);
  const airUsed = airProperties(temperatureK, air, AIR);
  const re = Math.max(velocity, 0) * spec.d / airUsed.nu;
  const ra = GRAVITY * airUsed.beta * Math.abs(beadC - gasC) * spec.d ** 3 / (airUsed.nu * airUsed.alpha);
  const Nu = model === "churchill"
    ? 2 + 0.589 * ra ** 0.25 / (1 + (0.469 / airUsed.pr) ** (9 / 16)) ** (4 / 9)
    : 2 + 0.6 * Math.sqrt(re) * airUsed.pr ** (1 / 3);
  return { re, ra, Nu, h: airUsed.k * Nu / spec.d, area: Math.PI * spec.d ** 2, airUsed,
    extrapolated: model === "churchill" ? airUsed.pr < 0.7 || ra > 1e11 : re > 200 };
}

export function sensorHeat(spec, { wallC, gasC, velocity, beadC, model, air, ua = 0 }) {
  if (!Number.isFinite(ua) || ua < 0) throw new RangeError("Extra loss UA must be a non-negative finite value.");
  const convection = beadConvection(spec, velocity, { beadC, gasC, model, air });
  const wallK = toK(wallC), beadK = toK(beadC);
  const qRad = spec.epsilon * SIGMA * AIR.F * convection.area * (wallC - beadC) * (wallK + beadK) * (wallK ** 2 + beadK ** 2);
  const qConv = convection.h * convection.area * (beadC - gasC);
  const qExtra = ua * (beadC - gasC);
  return { ...convection, qRad, qConv, qExtra };
}

// 추가 손실은 공기 온도를 기준으로 하며, UA=0이면 기존 열수지와 같다.
export function solveSensor(name, { wallC, gasC, velocity, t6Emissivity, model = "ranz-marshall", air, ua = 0, material = {} } = {}) {
  const spec = sensorSpec(name, { t6Emissivity });
  const heatAt = beadC => sensorHeat(spec, { wallC, gasC, velocity, beadC, model, air, ua });
  const wallK = toK(wallC);

  const balance = tcC => {
    const { qRad, qConv, qExtra } = heatAt(tcC);
    return qRad - qConv - qExtra;
  };

  const tcC = Math.abs(wallC - gasC) < 1e-12
    ? wallC
    : bisect(balance, Math.min(wallC, gasC), Math.max(wallC, gasC));

  const tcK = toK(tcC);
  const heat = heatAt(tcC);
  const { re, Nu, h, area, qRad, qConv } = heat;

  // 열전달량 표시용 복사 계수. 시간상수에는 평형점에서의 미분 계수를 쓴다.
  const hRad = spec.epsilon * SIGMA * AIR.F * (wallK + tcK) * (wallK * wallK + tcK * tcK);
  const volume = Math.PI / 6 * Math.pow(spec.d, 3);
  const density = material.density ?? BEAD_MATERIAL.density;
  const cp = material.cp ?? BEAD_MATERIAL.cp;
  const thermalCapacity = material.thermalCapacity ?? density * volume * cp;
  if (![density, cp, thermalCapacity].every(value => Number.isFinite(value) && value > 0)) {
    throw new RangeError("Bead density, specific heat and heat capacity must be positive finite values");
  }
  const hRadLocal = 4 * spec.epsilon * SIGMA * AIR.F * tcK ** 3;
  // 자연대류는 h(T)도 미분에 포함한다. 물성 범위 끝에서는 단측 차분을 쓴다.
  const delta = 0.0001;
  const filmK = toK((tcC + gasC) / 2);
  const lower = air?.mode === "auto" && filmK <= 250 + delta ? tcC : tcC - delta;
  const upper = air?.mode === "auto" && filmK >= 600 - delta ? tcC : tcC + delta;
  const slope = (balance(upper) - balance(lower)) / (upper - lower);
  const tau = model === "ranz-marshall" && air?.mode !== "auto" ? thermalCapacity / (area * (h + hRadLocal) + ua) : slope < 0 ? -thermalCapacity / slope : null;

  return {
    ...spec, ...heat, model, ua, wallC, gasC, velocity, re, Nu, h, hRad, hRadLocal, area,
    tcC, equilibrium: tcC, error: tcC - gasC, qRad, qConv, tau, thermalCapacity, density, cp, volume
  };
}
