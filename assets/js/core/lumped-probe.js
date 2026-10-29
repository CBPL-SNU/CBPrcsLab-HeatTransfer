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

// 점 옆에 두되 오른쪽·위쪽 공간이 부족하면 반대편으로 옮긴다.
export function pointTooltipPosition(x, y, width, height, boundsWidth, boundsHeight) {
  const inset = 8, gap = 14;
  const preferredLeft = x + gap + width <= boundsWidth - inset ? x + gap : x - gap - width;
  const preferredTop = y - gap - height >= inset ? y - gap - height : y + gap;
  return {
    left: Math.max(inset, Math.min(boundsWidth - width - inset, preferredLeft)),
    top: Math.max(inset, Math.min(boundsHeight - height - inset, preferredTop))
  };
}
