import { AIR_AUTO } from "./constants.js";

// 250–600 K는 이 도구의 사용 제한이다. Sutherland 식 전체의 검증 범위를 뜻하지 않는다.
export function airProperties(temperatureK, settings = {}, defaults = {}) {
  if (!Number.isFinite(temperatureK) || temperatureK <= 0) throw new RangeError("Air evaluation temperature must be above absolute zero.");
  const mode = settings.mode ?? "manual";
  if (mode === "auto") {
    const a = AIR_AUTO;
    if (temperatureK < a.minK || temperatureK > a.maxK) throw new RangeError("Automatic air properties require an evaluation temperature of 250–600 K. Use manual properties outside this range.");
    const scale = (s) => (temperatureK / a.referenceK) ** 1.5 * (a.referenceK + s) / (temperatureK + s);
    const mu = a.mu0 * scale(a.muS), k = a.k0 * scale(a.kS);
    const rho = a.pressure / (a.gasConstant * temperatureK);
    const nu = mu / rho, alpha = k / (rho * a.cp), pr = nu / alpha;
    return { mode, temperatureK, mu, rho, k, nu, pr, alpha, beta: 1 / temperatureK, cp: a.cp };
  }
  if (mode !== "manual") throw new RangeError("Unknown air-property mode.");
  const k = settings.k ?? defaults.k, nu = settings.nu ?? defaults.nu, pr = settings.pr ?? defaults.Pr;
  if (![k, nu, pr].every(v => Number.isFinite(v) && v > 0)) throw new RangeError("Air k, ν and Pr must be positive finite values.");
  return { mode, temperatureK, k, nu, pr, alpha: nu / pr, beta: 1 / temperatureK };
}
