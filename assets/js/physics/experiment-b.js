// 실험 B: 벽 복사와 공기 대류가 함께 작용할 때 열전쌍 비드가 읽는 온도

import { SIGMA, toK, AIR, SENSOR_DEFS, BEAD_MATERIAL } from "./constants.js";
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

// 구형 비드의 대류 열전달 계수 (Ranz-Marshall 형태)
export function beadConvection(spec, velocity) {
  const re = Math.max(velocity, 0) * spec.d / AIR.nu;
  const Nu = 2 + 0.6 * Math.sqrt(Math.max(re, 0)) * Math.pow(AIR.Pr, 1 / 3);
  return { re, Nu, h: AIR.k * Nu / spec.d, area: Math.PI * spec.d * spec.d };
}

// 열수지 Qrad = Qconv 를 풀어 Tc를 구함. 전선 전도 손실은 미포함
export function solveSensor(name, { wallC, gasC, velocity, t6Emissivity, material = {} } = {}) {
  const spec = sensorSpec(name, { t6Emissivity });
  const { re, Nu, h, area } = beadConvection(spec, velocity);
  const wallK = toK(wallC);
  const gasK = toK(gasC);

  const balance = tcC => {
    const tcK = toK(tcC);
    const qRad = spec.epsilon * SIGMA * AIR.F * area * (Math.pow(wallK, 4) - Math.pow(tcK, 4));
    const qConv = h * area * (tcK - gasK);
    return qRad - qConv;
  };

  const tcC = Math.abs(wallC - gasC) < 1e-12
    ? wallC
    : bisect(balance, Math.min(wallC, gasC), Math.max(wallC, gasC));

  const tcK = toK(tcC);
  const qRad = spec.epsilon * SIGMA * AIR.F * area * (Math.pow(wallK, 4) - Math.pow(tcK, 4));
  const qConv = h * area * (tcK - gasK);

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
  const tau = thermalCapacity / (area * (h + hRadLocal));

  return {
    ...spec, wallC, gasC, velocity, re, Nu, h, hRad, hRadLocal, area,
    tcC, equilibrium: tcC, error: tcC - gasC, qRad, qConv, tau, thermalCapacity, density, cp, volume
  };
}
