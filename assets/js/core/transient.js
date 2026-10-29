import { rk4Scalar } from "./numeric.js";

// 전체 간격 1회와 반 간격 2회를 비교하여 저장 시각과 독립적으로 적분폭을 조절한다.
export function integrateTransient({ initial, duration, derivative, samples = 300, maxStep = 0.5 }) {
  if (![initial, duration, maxStep].every(Number.isFinite) || duration < 0 || maxStep <= 0 || !Number.isInteger(samples) || samples < 1) throw new RangeError("Invalid transient conditions.");
  if (duration / maxStep > 2000000) throw new RangeError("This capacity requires too many integration steps. Increase it or shorten the duration.");
  let temp = initial, time = 0, nextStep = maxStep, steps = 0, rejected = 0;
  const points = [{ t: 0, temp, rate: derivative(temp) }];
  for (let i = 1; i <= samples && duration > 0; i++) {
    const target = duration * i / samples;
    while (time < target - 1e-12) {
      if (++steps > 2000000) throw new RangeError("Integration limit reached. Increase capacity or shorten the duration.");
      const h = Math.min(nextStep, target - time);
      const full = rk4Scalar(temp, h, derivative);
      const half = rk4Scalar(rk4Scalar(temp, h / 2, derivative), h / 2, derivative);
      const error = Math.abs(half - full) / 15;
      const tolerance = 1e-7 + 1e-9 * Math.max(Math.abs(temp), Math.abs(half));
      if (!Number.isFinite(half) || !Number.isFinite(error) || error > tolerance) {
        rejected++;
        nextStep = h / 2;
        if (nextStep < 1e-10) throw new RangeError("Unable to resolve the transient at the requested tolerance.");
        continue;
      }
      temp = half;
      time += h;
      nextStep = Math.min(maxStep, h * (error === 0 ? 2 : Math.min(2, Math.max(0.5, 0.9 * (tolerance / error) ** 0.2))));
    }
    time = target;
    points.push({ t: target, temp, rate: derivative(temp) });
  }
  return { points, steps, rejected, maxStep };
}
