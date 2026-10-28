// 내 데이터 화면의 측정 표. rows는 교안의 설정값으로, 입력칸에 흐리게 보이는 안내다(측정값이 아니다)

export const schemas = {
  A: {
    title: "Experiment A · Combined convection and radiation",
    columns: [
      { key: "V", label: "Voltage", unit: "V" },
      { key: "I", label: "Current", unit: "A" },
      { key: "T8", label: "Air T8", unit: "°C" },
      { key: "T10", label: "Surface T10", unit: "°C" }
    ],
    rows: [{ V: 5 }, { V: 11 }, { V: 17 }]
  },
  B: {
    title: "Experiment B · Radiation error in temperature measurement",
    columns: [
      { key: "V", label: "Voltage", unit: "V" },
      { key: "I", label: "Current", unit: "A" },
      { key: "Ua", label: "Air velocity", unit: "m/s" },
      { key: "T5", label: "Inlet air T5", unit: "°C" },
      { key: "T6", label: "Grey bead T6", unit: "°C" },
      { key: "T7", label: "Small black T7", unit: "°C" },
      { key: "T8", label: "Large black T8", unit: "°C" },
      { key: "T10", label: "Wall T10", unit: "°C" }
    ],
    rows: [
      { V: 5, Ua: 0 }, { V: 11, Ua: 0 }, { V: 17, Ua: 0 },
      { V: 17, Ua: 0.2 }, { V: 17, Ua: 0.4 }, { V: 17, Ua: 0.8 }, { V: 17, Ua: 1.6 }
    ]
  }
};
