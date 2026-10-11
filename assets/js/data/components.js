// 장치 도식 구성요소의 설명 데이터.
// 센서 좌표가 확정되면 좌표 항목 추가 (CFD probe 위치와 공유)

export const componentData = {
  // 실험 A · HT14. measure는 센서에만 있다. 관이나 팬은 아무것도 재지 않는다.
  // inExpA는 이 실험에서 그 부품이 어떤 상태인지. 안 쓰는 부품을 한눈에 가르기 위해서다.
  "a-t10": { mode: "A", label: "T10 · cylinder surface temperature", badge: "Exp. A · Sensor",
    summary: "A thermocouple on the surface of the heated cylinder, at the middle of the heated zone. This is Tₛ, the hot side of every term in the balance.",
    measure: "T10 = Tₛ", location: "Middle of the heated zone, on the cylinder surface; the lead comes in through the right-hand end of the cylinder",
    role: "Both terms grow with how far T10 sits above T8, so an error in this one reading moves every number on the Calculate screen." },
  "a-t8": { mode: "A", label: "T8 · duct air temperature", badge: "Exp. A · Sensor",
    summary: "A thermocouple in the air near the duct inlet, well below the heater. It reads the air before the heater has touched it, so it stands for the surroundings, Tₐ.",
    measure: "T8 = Tₐ", location: "Duct centre-line near the inlet, entering through the right-hand wall and bending down to the axis",
    role: "It sits near the duct inlet, well below the heater, so it reads the air before the cylinder has warmed it." },
  "a-anemometer": { mode: "A", label: "Anemometer", badge: "Exp. A · Not used",
    summary: "A propeller anemometer in the middle of the duct with its lead brought out through the right-hand wall. It measures air velocity for Experiment B.",
    measure: "Uₐ", location: "Duct centre-line, between the heater and T8; below the region the CFD computed",
    inExpA: "Present in the duct but its lead is left unplugged from the controller",
    role: "Not part of the Experiment A calculation. It is drawn because it is physically there and you will see it on the rig." },
  "a-heater": { mode: "A", label: "Heated cylinder", badge: "Exp. A · Heat source",
    summary: "A 10 mm cylinder crossing the duct horizontally. Only the 70 mm inside the duct is heated; the assembly continues out through the right-hand wall to the terminals.",
    location: "Crossing the duct 150 mm below the outlet, axis at z = 1.05 m in the CFD frame",
    inExpA: "Supplied with V·I from the controller: 5, 11 and 17 V in turn",
    role: "The source of everything: natural convection and radiation both leave from this surface, and Q_in = V·I is what the balance has to account for." },
  "a-duct": { mode: "A", label: "Duct", badge: "Exp. A · Apparatus",
    summary: "A vertical tube of 70 mm inner diameter, about 1.2 m long, open at the top. Air enters at the bottom, passes T8 and the anemometer, is warmed as it passes the cylinder and leaves at the top.",
    location: "The whole rig; the heater sits 150 mm below its top",
    inExpA: "Open at both ends; nothing drives the flow but the heater itself",
    role: "It confines the rising plume and gives the radiation from the cylinder a surface to land on. The balance assumes that surface is at T8." },
  "a-throttle": { mode: "A", label: "Throttle plate", badge: "Exp. A · Not used",
    summary: "A disc over the side inlet of the fan casing. Turning it sets how much air the fan can draw.",
    location: "On the fan casing at the bottom of the rig, not inside the duct",
    inExpA: "Opened, so that air can reach the duct; the fan behind it stays off",
    role: "Sets the air velocity in Experiment B. In Experiment A it is simply left open." },
  "a-fan": { mode: "A", label: "Fan", badge: "Exp. A · Not used",
    summary: "A centrifugal blower under the duct that can force air up through it.",
    location: "Bottom of the rig, feeding the duct through a transition piece",
    inExpA: "Off: its power lead is left unplugged from the controller",
    role: "Forces convection in Experiment B. Experiment A is natural convection, so the fan must stay off." },

  "b-duct": { mode: "B", label: "Duct", badge: "Exp. B · Apparatus", summary: "Vertical duct in which air flows inside a heated outer wall with several thermocouples placed along it.", measure: "Air temperature and velocity", location: "Vertical duct holding the heater and the sensors", role: "Test space where wall radiation and air convection act on the sensors at the same time." },
  "b-heater-wall": { mode: "B", label: "Heated outer wall", badge: "Exp. B · Heat source", summary: "Heated by an electric band heater and radiates onto the thermocouples inside.", measure: "Outer wall temperature T10", location: "Duct wall surrounding T6, T7 and T8", role: "Hot surrounding surface that produces the radiation error of the sensors." },
  "b-t10": { mode: "B", label: "T10 outer wall temperature sensor", badge: "Exp. B · Sensor", summary: "Measures the temperature of the heated outer wall that surrounds the thermocouples.", measure: "T10 = Tₛ", location: "Heated outer wall", role: "Used as the wall temperature for the radiation received by the sensors." },
  "b-t5": { mode: "B", label: "T5 inlet air temperature sensor", badge: "Exp. B · Sensor", summary: "Measures the air temperature before the air enters the heated section.", measure: "T5 = T_g", location: "Below the heater and the test thermocouples", role: "Reference for the true gas temperature that the test thermocouples should read." },
  "b-t6": { mode: "B", label: "T6 · small grey-body bead", badge: "Exp. B · Test sensor", summary: "0.5 mm grey-body thermocouple with an emissivity below 1.", measure: "T6 = T_c", location: "Test sensor position inside the heated outer wall", role: "Compared with T7 to isolate the effect of emissivity at the same bead size." },
  "b-t7": { mode: "B", label: "T7 · small black bead", badge: "Exp. B · Test sensor", summary: "0.5 mm thermocouple that is close to a black body.", measure: "T7 = T_c", location: "Test sensor position inside the heated outer wall", role: "Differs from T6 in emissivity and from T8 in bead size." },
  "b-t8": { mode: "B", label: "T8 · large black bead", badge: "Exp. B · Test sensor", summary: "3 mm thermocouple close to a black body, with a larger bead than T7.", measure: "T8 = T_c", location: "Test sensor position inside the heated outer wall", role: "Shows the effect of bead size on the measured temperature and on the convective cooling." },
  "b-shield": { mode: "B", label: "Shield", badge: "Exp. B · Apparatus", summary: "Shield drawn at the top of the apparatus diagram in the course manual.", measure: "Shielding state", location: "Top of the heated section", role: "Forms the upper boundary of the apparatus and its radiation environment." },
  "b-anemometer": { mode: "B", label: "Anemometer", badge: "Exp. B · Sensor", summary: "Anemometer that reads the air velocity inside the duct.", measure: "Uₐ", location: "Inside the duct, below the test thermocouples", role: "Used to set the forced convection conditions of 0.2, 0.4, 0.8 and 1.6 m/s." },
  "b-fan": { mode: "B", label: "Fan", badge: "Exp. B · Apparatus", summary: "Fan that drives forced convection through the duct.", measure: "ON/OFF and air velocity", location: "Bottom of the vertical duct", role: "Switched on for the forced convection steps and used with the throttle plate to set the air velocity." },
  "b-throttle": { mode: "B", label: "Throttle plate", badge: "Exp. B · Apparatus", summary: "A disc on the fan's side inlet. Turning its handle opens or closes the inlet and so sets how much air the fan can draw.", measure: "", location: "Side inlet of the fan casing, at the bottom of the rig", role: "With the fan on, it sets the air velocity for the 0.2, 0.4, 0.8 and 1.6 m/s steps. With the fan off it does nothing." }
};

// 목록 패널 표시 순서
export const componentOrder = {
  A: ["a-t10", "a-t8", "a-heater", "a-duct", "a-anemometer", "a-throttle", "a-fan"],
  B: ["b-t8", "b-t6", "b-t7", "b-t10", "b-t5", "b-heater-wall", "b-shield", "b-duct", "b-anemometer", "b-throttle", "b-fan"]
};
