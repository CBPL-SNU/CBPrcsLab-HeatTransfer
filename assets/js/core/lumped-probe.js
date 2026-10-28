// 저장된 계산점을 선택하므로 온도와 기울기가 서로 다른 시각을 나타내지 않는다.
export function nearestTimeIndex(points, time) {
  let lo = 0, hi = points.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (points[mid].t < time) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(points[lo - 1].t - time) <= Math.abs(points[lo].t - time)) return lo - 1;
  return lo;
}
