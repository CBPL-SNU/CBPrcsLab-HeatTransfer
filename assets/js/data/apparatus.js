// 장치 치수와 부품 위치. 도식은 이 숫자에서 축척대로 그려진다.
//
// 좌표계는 CFD와 같다. z는 연직 위 방향, 단위는 m, 관 아래 끝이 z = 0, 히터 축이 z = 1.05.
// 그래서 여기 좌표가 확정되면 도식과 Watch the flow와 CFD probe가 같은 점을 가리킨다.
//
// approximate 는 무엇이 어림인지 적는다. 값이 있으면 도식에 ≈ 가 붙고 카드가 그 사유를 말한다.
// 출처는 교안 2쪽 그림 3(HT14 schematic)과 조교 발표 자료 5쪽이다. 그림 3은 축척도가 아니라서
// 비례로 환산한 위치는 전부 어림값이다. 조교가 실측 좌표를 주면 지운다.

export const PX_PER_MM = 1.4;     // 축척 구간의 화면 배율. Watch the flow의 절개도와 같아야 한다

export const HT14 = {
  name: "HT14 · Combined convection and radiation",
  duct: {
    innerD: 0.070,          // 내경 [m]. CFD 격자와 같다
    wall: 0.004,            // 벽 두께 [m]. 어림값
    inletZ: 0.000,          // 관 아래 끝 [m]
    outletZ: 1.200          // 관 위 끝 (출구) [m]. 조교 발표 자료: 덕트 길이 1.2 m
  },
  heater: {
    z: 1.050,               // 실린더 축 높이 [m]. CFD와 같다
    d: 0.010,               // 지름 [m]. 교안 표 1
    heatedLength: 0.070,    // 가열 구간 [m]. 교안 표 1. 관 내경과 같다
    supportRight: 0.040     // 오른쪽 벽 밖으로 나온 조립체 길이 [m]. 그림 3은 오른쪽만 튀어나온다. 어림값
  },
  cfdCut: 0.5467,           // CFD가 계산 영역을 자른 높이 [m]. 그 아래는 계산하지 않았다
  window: { zLo: 1.020, zHi: 1.200 },   // Watch the flow가 보여주는 창. tools/cfd_to_frames.py의 Z_LO/Z_HI와 같다
  parts: [
    // name은 도식 위의 짧은 이름표. 긴 이름과 설명은 components.js에 있다.
    // side는 이름표를 어느 쪽에 둘지. 치수가 아니라 배치다.
    { id: "a-t10", kind: "sensor", name: "T10", x: 0.000, z: 1.055, side: "right",
      approximate: "exact spot on the cylinder surface" },
    { id: "a-heater", kind: "heater", name: "Heated cylinder", side: "right",
      approximate: "length of the assembly outside the duct" },
    { id: "a-duct", kind: "duct", name: "Duct", side: "left",
      approximate: "wall thickness" },
    // approximatePosition 이 있는 부품만 도식에 ≈ 가 붙는다. 다른 어림은 카드에서만 말한다.
    { id: "a-anemometer", kind: "sensor", name: "Anemometer", x: 0.000, z: 0.500, side: "right",
      approximate: "height, scaled from the manual's figure 3", approximatePosition: true },
    { id: "a-t8", kind: "sensor", name: "T8", x: 0.000, z: 0.120, side: "right",
      approximate: "height, scaled from the manual's figure 3", approximatePosition: true },
    { id: "a-throttle", kind: "throttle", name: "Throttle plate", side: "right",
      approximate: "shape, from the manual's figure 3" },
    { id: "a-fan", kind: "fan", name: "Fan", side: "left",
      approximate: "shape, from the manual's figure 3" }
  ]
};
