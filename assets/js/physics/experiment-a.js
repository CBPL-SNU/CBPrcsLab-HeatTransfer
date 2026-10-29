// 실험 A: 수평 가열 실린더의 정상상태 자연대류·복사 열전달

import { SIGMA, GRAVITY, toK, CYLINDER, AIR_A_DEFAULT } from "./constants.js";
import { bisect } from "../core/numeric.js";
import { airProperties } from "./air-properties.js";

// 가열 구간 표면적 [m²]
export const cylinderArea = () => Math.PI * CYLINDER.D * CYLINDER.L;

// log10(Ra) 구간별 계수 C, n. 교안 표 범위 밖이면 extrapolated로 표시
export function morganCN(logRa) {
  const rows = [
    [-9, -2, 0.675, 0.058], [-2, 2, 1.020, 0.148], [2, 4, 0.850, 0.188],
    [4, 7, 0.480, 0.250], [7, 12, 0.125, 0.333]
  ];
  const row = rows.find((item, index) => logRa >= item[0] && (logRa < item[1] || (index === rows.length - 1 && logRa <= item[1])));
  if (row) return { c: row[2], n: row[3], extrapolated: false };
  const edge = logRa < -9 ? rows[0] : rows[rows.length - 1];
  return { c: edge[2], n: edge[3], extrapolated: true };
}

// model은 "mcadams" 또는 "morgan". morgan일 때만 공기 물성 k, nu, pr를 사용
export function cylinderHeat({ tsC, taC, model = "mcadams", k, nu, pr, air }) {
  const tsK = toK(tsC);
  const taK = toK(taC);
  const dT = tsC - taC;
  const area = cylinderArea();
  const hRad = SIGMA * CYLINDER.epsilon * CYLINDER.F * (tsK + taK) * (tsK * tsK + taK * taK);

  if (!["mcadams", "morgan"].includes(model)) throw new RangeError("Unknown cylinder correlation.");
  const airUsed = model === "morgan" ? airProperties((tsK + taK) / 2, air ?? { k, nu, pr }, AIR_A_DEFAULT) : null;
  let hConv = 0;
  let ra = null;
  let extrapolated = false;

  if (Math.abs(dT) > 1e-12) {
    if (model === "morgan") {
      const kAir = airUsed.k;
      const nuAir = airUsed.nu;
      const prAir = airUsed.pr;
      const film = (tsK + taK) / 2;      // 물성을 평가하는 film 온도
      const beta = 1 / film;             // 이상기체 가정의 열팽창계수
      const gr = GRAVITY * beta * Math.abs(dT) * Math.pow(CYLINDER.D, 3) / (nuAir * nuAir);
      ra = gr * prAir;
      const coefficient = morganCN(Math.log10(Math.max(ra, 1e-30)));
      extrapolated = coefficient.extrapolated;
      const Nu = coefficient.c * Math.pow(Math.max(ra, 0), coefficient.n);
      hConv = kAir * Nu / CYLINDER.D;
    } else {
      hConv = 1.32 * Math.pow(Math.abs(dT) / CYLINDER.D, 0.25);
    }
  }

  return {
    qConv: hConv * area * dT,
    qRad: hRad * area * dT,
    hConv, hRad, area, ra, extrapolated, model, tsC, taC, airUsed
  };
}

// residual은 실험 오차가 아니라 '모델에 포함되지 않은 열량'
export function experimentASteady({ V, I, tsC, taC, model, k, nu, pr, air }) {
  const heat = cylinderHeat({ tsC, taC, model, k, nu, pr, air });
  const qIn = V * I;
  const total = heat.qConv + heat.qRad;
  return { ...heat, qIn, total, residual: qIn - total };
}

// 표시 범위·측정 T10과 독립적으로 고온 측의 대류→복사 교차를 찾는다.
export const CROSSOVER_SEARCH_SPAN = 10000;
export function radiationCrossover(input) {
  const difference = delta => {
    const heat = cylinderHeat({ ...input, tsC: input.taC + delta });
    return heat.hConv - heat.hRad;
  };
  const minDelta = 1e-6, samples = 500;
  let previousDelta = minDelta, previous = difference(minDelta), crossing = null;
  for (let i = 1; i <= samples; i += 1) {
    const delta = minDelta * (CROSSOVER_SEARCH_SPAN / minDelta) ** (i / samples);
    const current = difference(delta);
    if (previous > 0 && current <= 0) {
      const root = bisect(difference, previousDelta, delta, 60);
      const heat = cylinderHeat({ ...input, tsC: input.taC + root });
      // Morgan 계수표의 불연속 점프를 등호가 성립하는 교차점으로 오인하지 않는다.
      if (Math.abs(heat.hConv - heat.hRad) <= 1e-8 * Math.max(heat.hConv, heat.hRad)) {
        crossing = { t: input.taC + root, q: heat.qConv };
      }
    }
    previousDelta = delta;
    previous = current;
  }
  return crossing;
}
