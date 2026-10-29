// 캔버스 선 그래프 공통 도구. 축 여백과 색을 전체에서 통일

export const PLOT_MARGIN = { left: 46, right: 16, top: 19, bottom: 34 };

export const SERIES_COLOR = {
  conv: "#2f6fed",
  morgan: "#24834f",
  total: "#111111",
  rad: "#d94f5c",
  surface: "#e66b37",
  marker: "#ad7b14",    // 학생이 입력한 조건을 가리키는 선. 측정값이 아니다
  residual: "#7d8b98"   // 모델 밖 열량, 또는 히터에 쌓이는 열. 오류가 아니므로 중립색
};

// 그래프 크롬. 데이터가 아니라 눈금과 표시다.
// assets/css/tokens.css의 --chart-* 와 값이 같아야 하며 테스트가 검사한다.
// plate는 캔버스 뒤에 비치는 --surface 와 같아야 한다. 글자를 곡선 위에 얹을 때 깔개로 쓴다.
export const CHART_INK = { ink: "#5c6a76", grid: "#dbe2e8", mark: "#46525e", plate: "#ffffff" };

// 그래프 안에서 서체를 섞지 않는다. 축 숫자와 계열 이름이 달라 보이면 안 된다.
const CHART_FONT_FAMILY = "'IBM Plex Sans', system-ui, sans-serif";
export const CHART_FONT = "12.5px " + CHART_FONT_FAMILY;
export const CHART_FONT_LARGE = "14px " + CHART_FONT_FAMILY;

// 표시 크기와 devicePixelRatio에 맞춤. 화면이 숨겨져 크기를 못 재면 null
export function setupCanvas(canvas) {
  if (!canvas) return null;          // 아직 열지 않은 화면에는 캔버스가 없다
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: rect.width, h: rect.height };
}

// 값 구간을 캔버스 좌표로 옮기는 매핑 함수 한 쌍
// margin은 선 끝 이름표를 그림 밖에 둘 그래프만 바꾼다
export function makeScales(w, h, xRange, yRange, margin = PLOT_MARGIN) {
  const { left, right, top, bottom } = margin;
  const [minX, maxX] = xRange;
  const [minY, maxY] = yRange;
  return {
    xMap: x => left + (x - minX) / (maxX - minX) * (w - left - right),
    yMap: y => h - bottom - (y - minY) / (maxY - minY) * (h - top - bottom)
  };
}

export function drawAxes(ctx, w, h, xLabel, yLabel, xTicks, yTicks, xMap, yMap, margin = PLOT_MARGIN, {
  font = CHART_FONT, gridWidth = 1, minorGridWidth = 0.5, minorXTicks = [], minorYTicks = [],
  xTickOffset = 17, axisLabelInset = 1, yLabelY = 11
} = {}) {
  const { left, right, top, bottom } = margin;
  ctx.clearRect(0, 0, w, h);
  ctx.font = font;
  ctx.fillStyle = CHART_INK.ink;
  ctx.strokeStyle = CHART_INK.grid;
  ctx.lineWidth = minorGridWidth;
  for (const value of minorYTicks) {
    if (yTicks.includes(value)) continue;
    const y = yMap(value);
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(w - right, y); ctx.stroke();
  }
  for (const value of minorXTicks) {
    if (xTicks.includes(value)) continue;
    const x = xMap(value);
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, h - bottom); ctx.stroke();
  }
  ctx.lineWidth = gridWidth;
  yTicks.forEach(value => {
    const y = yMap(value);
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(w - right, y); ctx.stroke();
    ctx.textAlign = "left"; ctx.fillText(String(value), 5, y + 4);
  });
  xTicks.forEach(value => {
    const x = xMap(value);
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, h - bottom); ctx.stroke();
    ctx.textAlign = "center"; ctx.fillText(String(value), x, h - xTickOffset);
  });
  ctx.textAlign = "left"; ctx.fillText(yLabel, left, yLabelY);
  ctx.textAlign = "right"; ctx.fillText(xLabel, w - right, h - axisLabelInset);
  ctx.textAlign = "left";
}

export function drawLine(ctx, points, stroke, width = 2.2, dash = []) {
  if (!points.length) return;
  ctx.beginPath();
  points.forEach((point, index) => index ? ctx.lineTo(point[0], point[1]) : ctx.moveTo(point[0], point[1]));
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** 색을 못 읽는 사람도 계열을 구분할 수 있도록 선 종류를 함께 쓴다. */
export const SERIES_DASH = { solid: [], dashed: [7, 4], dotted: [2, 3] };

// assets/css/tokens.css의 --sensor-* 와 값이 같아야 하며 테스트가 검사한다.
export const SENSOR_COLOR = { grey: "#78848f", black: "#2f3e4b" };

// 열전쌍은 물리량이 아니라 장치이므로 계열 색을 빌려 쓰지 않는다.
// 색은 비드 표면을, 굵기는 비드 지름을 나타낸다. 표면이 같은 T7과 T8은
// 색도 같고 굵기만 다르다. 선 종류는 색을 보조한다 (계획서 6절).
export function sensorStyle({ epsilon, d }) {
  const black = epsilon >= 0.7;          // 교안이 회색체(0.40)와 흑체(0.95)로만 나눈다
  return {
    color: black ? SENSOR_COLOR.black : SENSOR_COLOR.grey,
    width: d >= 0.002 ? 3.2 : 1.8,       // 0.5 mm와 3 mm
    dash: black ? SERIES_DASH.solid : SERIES_DASH.dotted
  };
}

// 교차점과 설명을 짧은 연결선으로 묶어 같은 위치를 가리키게 한다.
export function drawCrossing(ctx, x, y, label, h, { margin = PLOT_MARGIN, font = CHART_FONT, color = CHART_INK.mark, occupied = [], markers = [], labelLayer = null, backgroundOpacity = 1 } = {}) {
  const { left, right, top, bottom } = margin;
  const rightEdge = ctx.canvas.clientWidth - right;
  const bottomEdge = h - bottom;
  ctx.save();
  ctx.font = font;
  const fontSize = Number.parseFloat(font);
  const padding = 6, lineHeight = Math.ceil(fontSize + 3.5);
  const maxTextWidth = rightEdge - left - 20;
  const lines = [];
  for (const paragraph of label.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = line ? line + " " + word : word;
      if (line && ctx.measureText(candidate).width > maxTextWidth) { lines.push(line); line = word; }
      else line = candidate;
    }
    lines.push(line);
  }
  const boxWidth = Math.max(...lines.map(line => ctx.measureText(line).width)) + 2 * padding;
  const boxHeight = lines.length * lineHeight + 2 * padding;
  const fitsRight = x + 12 + boxWidth <= rightEdge - 4;
  const preferredX = fitsRight ? x + 12 : x - 12 - boxWidth;
  const preferredY = y - boxHeight - 12 < top + 4 ? y + 12 : y - boxHeight - 12;
  const otherX = fitsRight ? x - 12 - boxWidth : x + 12;
  const positions = [
    [preferredX, preferredY], [preferredX, y + 12],
    [otherX, preferredY], [otherX, y + 12],
    ...occupied.flatMap(box => [[preferredX, box.y - boxHeight - 8], [preferredX, box.y + box.h + 8]]),
    [preferredX, top + 4], [preferredX, bottomEdge - boxHeight - 4]
  ].map(([candidateX, candidateY]) => ({
    x: Math.max(left + 4, Math.min(candidateX, rightEdge - boxWidth - 4)),
    y: Math.max(top + 4, Math.min(candidateY, bottomEdge - boxHeight - 4))
  }));
  const overlap = position => [{ x, y }, ...markers].reduce((area, point) => area +
    (point.x >= position.x - 6 && point.x <= position.x + boxWidth + 6 &&
     point.y >= position.y - 6 && point.y <= position.y + boxHeight + 6 ? boxWidth * boxHeight : 0), 0) +
    occupied.reduce((area, box) => area +
    Math.max(0, Math.min(position.x + boxWidth + 8, box.x + box.w + 8) - Math.max(position.x, box.x)) *
    Math.max(0, Math.min(position.y + boxHeight + 8, box.y + box.h + 8) - Math.max(position.y, box.y)), 0);
  const position = positions.reduce((best, candidate) => overlap(candidate) < overlap(best) ? candidate : best);
  const boxX = position.x, boxY = position.y;
  const anchorX = Math.max(boxX, Math.min(x, boxX + boxWidth));
  const anchorY = Math.max(boxY, Math.min(y, boxY + boxHeight));

  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottomEdge); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(anchorX, anchorY); ctx.stroke();
  // 여러 교차점의 선을 모두 그린 뒤 설명을 최상단에 그릴 수 있다.
  const drawLabel = () => {
    ctx.save();
    ctx.font = font;
    ctx.globalAlpha = backgroundOpacity;
    ctx.fillStyle = CHART_INK.plate;
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = CHART_INK.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    lines.forEach((line, index) => ctx.fillText(line, boxX + padding, boxY + padding + fontSize + index * lineHeight));
    ctx.restore();
  };
  if (labelLayer) labelLayer.push(drawLabel);
  else drawLabel();

  ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = CHART_INK.plate; ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.restore();
  return { x: boxX, y: boxY, w: boxWidth, h: boxHeight };
}

// 곡선 위에 글자를 얹으면 선과 겹쳐 읽히지 않는다. 배경색 깔개를 먼저 깐다.
export function labelOnPlot(ctx, text, x, y, color, align = "left") {
  const width = ctx.measureText(text).width;
  ctx.fillStyle = CHART_INK.plate;
  ctx.fillRect((align === "right" ? x - width : x) - 3, y - 9, width + 6, 12);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}

// 곡선 오른쪽 끝에 계열 이름을 붙인다. 범례로 눈을 왕복시키지 않기 위해서다.
// 곡선이 서로 가까우면 이름표끼리 겹치므로 최소 간격을 두고 아래로 밀어낸다.
// outside면 선 끝 오른쪽 여백에 쓴다. 그림 안에 쓰면 이름표가 선 끝을 가린다
export function labelEnds(ctx, items, { outside = false, font = CHART_FONT, lineGap = 13 } = {}) {
  ctx.font = font;
  let lastY = -Infinity;
  [...items].sort((a, b) => a.y - b.y).forEach(item => {
    if (outside) {
      const y = Math.max(item.y + 4, lastY + lineGap);
      lastY = y;
      ctx.fillStyle = item.color; ctx.textAlign = "left";
      ctx.fillText(item.name, item.x + 6, y);
      return;
    }
    const y = Math.max(item.y - 5, lastY + lineGap - 1);
    lastY = y;
    labelOnPlot(ctx, item.name, item.x - 3, y, item.color, "right");
  });
}

// 두 곡선 사이를 채운다. 누적 면적 그래프는 아래 곡선 위에 다음 곡선을 쌓는 식으로 그린다.
export function drawArea(ctx, upper, lower, fill) {
  if (!upper.length) return;
  ctx.beginPath();
  upper.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  for (let i = lower.length - 1; i >= 0; i -= 1) ctx.lineTo(lower[i][0], lower[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function drawVerticalMarker(ctx, x, h, stroke = SERIES_COLOR.marker, margin = PLOT_MARGIN) {
  const { top, bottom } = margin;
  ctx.strokeStyle = stroke; ctx.lineWidth = 1.4; ctx.setLineDash([4, 5]);
  ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, h - bottom); ctx.stroke();
  ctx.setLineDash([]);
}

export function drawHorizontalGuide(ctx, y, w, stroke, dash = [5, 5], width = 1.3) {
  const { left, right } = PLOT_MARGIN;
  ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(w - right, y); ctx.stroke();
  ctx.setLineDash([]);
}

// 현재 시각까지는 진하게, 그 뒤는 옅게 그린다. 재생 중 어디까지 왔는지가 면의 경계로 읽힌다.
export function paintUpTo(ctx, x, h, paint) {
  ctx.save(); ctx.globalAlpha = 0.28; paint(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, x, h); ctx.clip(); paint(); ctx.restore();
}
