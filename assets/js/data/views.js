// 화면 목록. 사이드바 메뉴와 상단 제목이 모두 여기서 나온다.
//
// 실험을 먼저 나누고 그 안에서 화면을 나눈다. 학생의 동선이 한 실험 안에서
// 계산 → 관찰 → 시간 순으로 흐르고, A와 B는 보는 물리량이 달라 화면을 섞지 않는다.
//
// status는 협업하는 사람에게 무엇이 실제로 동작하는지 알린다.
//   "ready"   — 계산과 화면이 모두 검증되어 그대로 쓸 수 있다
//   "planned" — 자리만 잡혀 있다. placeholder를 그리고 무엇이 들어올지 적는다
// 화면이 완성되면 이 한 단어만 바꾸면 된다.

export const VIEWS = [
  {
    id: "experiment-a", group: "Experiment A", status: "ready",
    label: "Calculate", sub: "Where the supplied power goes",
    title: "Experiment A · Combined convection and radiation"
  },
  {
    id: "a-field", group: "Experiment A", status: "ready",
    label: "Watch the flow", sub: "CFD around the cylinder",
    title: "Experiment A · The plume above the heated cylinder"
  },
  {
    id: "a-apparatus", group: "Experiment A", status: "ready",
    label: "Apparatus", sub: "HT14 in section",
    title: "Experiment A · The HT14 rig and its sensors"
  },
  {
    id: "experiment-b", group: "Experiment B", status: "ready",
    label: "Calculate", sub: "Thermocouple error",
    title: "Experiment B · Radiation error in temperature measurement"
  },
  {
    id: "b-field", group: "Experiment B", status: "ready",
    label: "Watch the flow", sub: "CFD around the bead",
    title: "Experiment B · Air around the thermocouple bead"
  },
  {
    id: "b-compare", group: "Experiment B", status: "ready",
    label: "Compare", sub: "Any two cases side by side",
    title: "Experiment B · Two cases side by side"
  },
  {
    id: "b-apparatus", group: "Experiment B", status: "ready",
    label: "Apparatus", sub: "HT16 in section",
    title: "Experiment B · The HT16 rig and its sensors"
  },
  {
    id: "data", status: "planned",
    label: "My data", sub: "Enter and export",
    title: "My measurements",
    plan: "A table for the values measured on the rig, with CSV import and export and a browser-local draft. Entry and export work; import, validation and saving do not exist yet."
  }
];

export const DEFAULT_VIEW = VIEWS[0].id;
