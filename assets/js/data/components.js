// 장치 도식 구성요소의 설명 데이터.
// 한 부품에 한 문장. 위치는 그림이 보여 주므로 쓰지 않는다. measure는 센서에만 있다.

export const componentData = {
  "a-t10": { mode: "A", label: "T10 · cylinder surface", badge: "Exp. A · Sensor", measure: "T10 = T<sub>s</sub>",
    summary: "The hot side of both terms in the balance, so an error here moves every number on the Calculate screen." },
  "a-t8": { mode: "A", label: "T8 · duct air", badge: "Exp. A · Sensor", measure: "T8 = T<sub>a</sub>",
    summary: "Reads the air before the heater has warmed it and stands for the surroundings." },
  "a-heater": { mode: "A", label: "Heated cylinder", badge: "Exp. A · Heat source",
    summary: "Only the 70 mm inside the duct is heated; it takes 5, 11 and 17 V in turn." },
  "a-duct": { mode: "A", label: "Duct", badge: "Exp. A · Apparatus",
    summary: "Open at both ends, so only the heater drives the flow; the balance takes its wall to be at T8." },
  "a-anemometer": { mode: "A", label: "Anemometer", badge: "Exp. A · Not used", measure: "U<sub>a</sub>",
    summary: "Measures air velocity for Experiment B and is left unplugged here." },
  "a-throttle": { mode: "A", label: "Throttle plate", badge: "Exp. A · Not used",
    summary: "Sets the fan's air flow in Experiment B and is simply left open here." },
  "a-fan": { mode: "A", label: "Fan", badge: "Exp. A · Not used",
    summary: "Stays off: Experiment A is natural convection." },

  "b-t8": { mode: "B", label: "T8 · large black bead", badge: "Exp. B · Test sensor", measure: "T8 = T<sub>c</sub>",
    summary: "3 mm black bead. Against T7 it shows what bead size does." },
  "b-t7": { mode: "B", label: "T7 · small black bead", badge: "Exp. B · Test sensor", measure: "T7 = T<sub>c</sub>",
    summary: "0.5 mm black bead. Same surface as T8, same size as T6." },
  "b-t6": { mode: "B", label: "T6 · small grey bead", badge: "Exp. B · Test sensor", measure: "T6 = T<sub>c</sub>",
    summary: "0.5 mm grey bead. Against T7 it shows what emissivity does." },
  "b-t10": { mode: "B", label: "T10 · heated wall", badge: "Exp. B · Sensor", measure: "T10 = T<sub>s</sub>",
    summary: "The wall the beads take their radiation from." },
  "b-t5": { mode: "B", label: "T5 · inlet air", badge: "Exp. B · Sensor", measure: "T5 = T<sub>g</sub>",
    summary: "The true air temperature every bead should read." },
  "b-heater-wall": { mode: "B", label: "Band heater", badge: "Exp. B · Heat source",
    summary: "Heats the duct wall around the beads; this wall is the source of their radiation error." },
  "b-shield": { mode: "B", label: "Shield", badge: "Exp. B · Apparatus",
    summary: "Closes the top of the heated section." },
  "b-duct": { mode: "B", label: "Duct", badge: "Exp. B · Apparatus",
    summary: "Carries the air past the beads, where wall radiation and air convection act on them together." },
  "b-anemometer": { mode: "B", label: "Anemometer", badge: "Exp. B · Sensor", measure: "U<sub>a</sub>",
    summary: "Used to set the air velocity: 0.2, 0.4, 0.8 and 1.6 m/s." },
  "b-throttle": { mode: "B", label: "Throttle plate", badge: "Exp. B · Apparatus",
    summary: "With the fan on, opening it raises the air velocity." },
  "b-fan": { mode: "B", label: "Fan", badge: "Exp. B · Apparatus",
    summary: "Off for natural convection, on for the forced steps." }
};

// 도식에 그려야 할 부품. 테스트가 도식과 대조한다
export const componentOrder = {
  A: ["a-t10", "a-t8", "a-heater", "a-duct", "a-anemometer", "a-throttle", "a-fan"],
  B: ["b-t8", "b-t6", "b-t7", "b-t10", "b-t5", "b-heater-wall", "b-shield", "b-duct", "b-anemometer", "b-throttle", "b-fan"]
};
