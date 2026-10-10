// 사전 계산 CFD case 목록.
// 여기 있는 것은 실험 조건(정체성)뿐이고 계산 결과는 아직 없다.
// 지어낸 숫자를 두면 학생이 결과로 읽으므로 status: "pending"으로 비워 둔다.
// 연구실에서 case를 계산하면 이 파일에 값을 채우는 것만으로 화면이 살아난다.

export const CFD_CASES = {
  A5:  { kind: "A", mode: "natural", label: "A · 5 V", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Mean cylinder surface temperature" },
  A11: { kind: "A", mode: "natural", label: "A · 11 V", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Mean cylinder surface temperature" },
  A17: { kind: "A", mode: "natural", label: "A · 17 V", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Mean cylinder surface temperature" },
  // 실험 B는 조교가 계산을 마친 것만 둔다. 나머지 세 case는 들어오는 대로 추가한다
  B02L: { kind: "B", mode: "forced", label: "B · 0.2 m/s · 3.1 mm bead", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Bead temperature" },
  B16L: { kind: "B", mode: "forced", label: "B · 1.6 m/s · 3.1 mm bead", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Bead temperature" }
};
