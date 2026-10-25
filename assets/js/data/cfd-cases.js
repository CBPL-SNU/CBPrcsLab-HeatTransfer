// 사전 계산 CFD case 목록.
// 여기 있는 것은 실험 조건(정체성)뿐이고 계산 결과는 아직 없다.
// 지어낸 숫자를 두면 학생이 결과로 읽으므로 status: "pending"으로 비워 둔다.
// 연구실에서 case를 계산하면 이 파일에 값을 채우는 것만으로 화면이 살아난다.

export const CFD_CASES = {
  A5:  { kind: "A", mode: "natural", label: "A · 5 V", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Mean cylinder surface temperature" },
  A11: { kind: "A", mode: "natural", label: "A · 11 V", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Mean cylinder surface temperature" },
  A17: { kind: "A", mode: "natural", label: "A · 17 V", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Mean cylinder surface temperature" },
  // 실험 B는 다섯 유동 조건 × 두 구. L은 지름 3.1 mm(T8), S는 0.5 mm(T7). CFD는 둘 다 흑체로 계산했다
  B00V5L: { kind: "B", mode: "natural", label: "B · fan off · 5 V · 3.1 mm bead", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Bead temperature" },
  B00V5S: { kind: "B", mode: "natural", label: "B · fan off · 5 V · 0.5 mm bead", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Bead temperature" },
  B00V17L: { kind: "B", mode: "natural", label: "B · fan off · 17 V · 3.1 mm bead", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Bead temperature" },
  B00V17S: { kind: "B", mode: "natural", label: "B · fan off · 17 V · 0.5 mm bead", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Bead temperature" },
  B02L: { kind: "B", mode: "forced", label: "B · 0.2 m/s · 3.1 mm bead", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Bead temperature" },
  B02S: { kind: "B", mode: "forced", label: "B · 0.2 m/s · 0.5 mm bead", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Bead temperature" },
  B16L: { kind: "B", mode: "forced", label: "B · 1.6 m/s · 3.1 mm bead", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Bead temperature" },
  B16S: { kind: "B", mode: "forced", label: "B · 1.6 m/s · 0.5 mm bead", status: "pending", radMethod: "CFD field + radiation post-processing", quantity: "Bead temperature" }
};
