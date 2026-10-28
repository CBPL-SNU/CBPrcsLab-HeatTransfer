# Lumped parameter 페이지 및 실험 B 적분 변경 내역

작성일: 2026-10-28

## 사용자에게 보이는 변경

- Experiment A와 Experiment B에 각각 Lumped parameter 메뉴를 추가했습니다.
- 두 화면 모두 기본 600초(10분)의 온도응답을 표시합니다. 계산 시간은 10~3600초로 변경할 수 있습니다.
- 조건을 수정한 후 계산하기를 누르면 결과와 그래프가 갱신됩니다.
- A는 평균 표면 온도 및 종료 시점 대류·복사 열전달량을 표시합니다.
- B는 T6·T7·T8 온도 곡선, 첫 10초 확대 그래프, 최종·평형 온도 및 국소 시간상수를 표시합니다.
- 종료 시점 값을 정상상태 값으로 표시하지 않습니다.

## 계산 변경

실험 B는 고정된 지수응답 대신 다음 비선형 열수지를 센서별 RK4로 직접 적분합니다.

C dTb/dt = εσFA(Tw⁴ − Tb⁴) − hA(Tb − Tg)

복사 항은 절대온도를 사용합니다. 벽 온도, 공기 온도, 유속, 물성은 계산 중 일정하고 전선 전도는 제외합니다.

적분 간격의 상한은 기본 0.1초와 도달 가능한 최고 온도에서 계산한 최소 시간상수의 1/20 중 작은 값입니다. 호출자가 dt를 주더라도 시간상수에 따른 상한을 유지합니다. 적분 간격과 그래프 저장 간격을 분리하며, 마지막 시각을 정확히 맞춥니다. 평형 도달 후에도 전체 요청 시간까지 적분합니다.

solveSensor의 tau는 평형점 미분 복사계수 4εσFTeq³를 이용하도록 수정했습니다. 기존 hRad는 열전달량 표시용으로 유지하고 hRadLocal을 추가했습니다. 지수함수는 과도응답 계산에 사용하지 않습니다.

A의 계산 엔진은 유지했습니다. 화면에서 작은 열용량과 큰 손실에 대응해 dt 상한을 보수적으로 낮춥니다.

## 파일

| 파일 | 변경 |
|---|---|
| assets/js/physics/lumped.js | B 비선형 RK4, 600초 기본값, 입력 검사, 적분 횟수 정보 |
| assets/js/physics/experiment-b.js | 국소 시간상수 수정 |
| assets/views/a-lumped.html, b-lumped.html | 실험별 입력·그래프·결과·가정 |
| assets/js/views/lumped.js | 두 화면의 공통 계산·표·그래프 처리 |
| assets/js/views/a-lumped.js, b-lumped.js | 실험별 초기화 및 다시 그리기 연결 |
| assets/css/views/a-lumped.css, b-lumped.css | 화면별 스타일 |
| assets/js/data/views.js, assets/js/main.js, index.html | 메뉴와 화면 등록 |
| assets/views/introduction.md | lumped 화면 제공 상태 설명 갱신 |
| tests/physics.test.mjs | 가열·냉각, 초기 기울기, 수렴, 시간상수, 잘못된 입력 검사 |
| tests/markup-contract.test.mjs | Windows 경로도 미구현 화면을 정상 제외하도록 경로 정규화 |
| tools/export_reference.mjs | B 과도응답 7개 조건의 기준 출력 추가 |
| tools/verify_physics.py | SciPy DOP853과 B 전체 시계열 비교 추가 |
| tools/verify_sensor_quadrature.py | 표준 라이브러리만 사용하는 독립 구적 검증 |
| tools/benchmark_sensors.mjs | 600초 센서 연산 성능 측정 |

## 검증 결과

- 전체 Node 테스트: 82개 통과, 1개 생략, 실패 없음. 물리 테스트 31개 포함.
- 독립 구적: t = ∫ C/Qnet(T) dT로 계산 시각을 역산하여 2,590건 통과. 최대 시간 상대 차이 4.150e-8.
- 구적 검증은 평형 부근의 특이성을 피해 초기·중간 과도응답을 확인합니다. 평형 수렴은 별도 물리 테스트에서 확인합니다.
- SciPy가 현재 Python 환경에 없어 SciPy 교차 검증은 실행하지 못했습니다. 해당 검증 코드는 추가해 두었습니다.
- Chrome headless 실행을 시도했으나 프로세스가 종료 코드 2147483651로 실패했습니다. 실제 브라우저 화면·렌더링 검증은 완료하지 못했습니다.
- GitHub 배포는 수행하지 않았습니다.

## 성능 측정

CPU: Intel Core i5-13400F. Node.js v24.16.0. 벽 145°C, 공기·초기 온도 25°C, 센서 3개, 600초, 센서당 601개 저장점. 10회 예열 후 100회 측정했습니다. 엔진만 측정하며 화면 그리기·다운로드 시간은 제외합니다.

| 유속 (m/s) | 중앙값 (ms) | 95백분위 (ms) | RK4 단계 합계 |
|---|---:|---:|---:|
| 0 | 0.902 | 1.084 | 18,000 |
| 0.4 | 1.023 | 1.209 | 22,200 |
| 1.6 | 1.385 | 1.642 | 29,400 |
| 5 | 1.904 | 2.158 | 40,200 |

최초 실행은 첫 조건에서 약 5.34ms였습니다. 첫 호출에는 JIT 초기화 등의 영향이 포함될 수 있습니다. 화면은 전체 1,201점/센서와 별도 초기 확대 계산을 사용하므로 이 표가 화면 전체의 응답 시간을 의미하지는 않습니다. 일반 PC에서 가벼운 계산으로 판단되지만 실제 브라우저·장치별 속도를 보장하는 측정은 아닙니다.

재실행 명령:

~~~sh
node --test tests/*.test.mjs
node tools/export_reference.mjs
py tools/verify_sensor_quadrature.py
node tools/benchmark_sensors.mjs
# SciPy가 있는 Python 환경에서
python tools/verify_physics.py
~~~

## 2026-10-28 · English interface and equation layout

- Translated both lumped screens, input labels, results, legends, error messages and status messages into English; set the content language to en. Source comments remain Korean under repository conventions.
- Removed Experiment B’s first-10-seconds panel and its separate simulation, stored series and redraw call. The full-duration graph remains. Earlier entries above describe the initial implementation.
- Replaced plain-text energy balances with native MathML fractions, subscripts and powers. No external dependencies were added. The equation region scrolls horizontally when needed, and includes an accessible description.
- Renamed B’s temperature rows to Temperature at end of run and Steady-state temperature. Added an explanation: the first is the integrated value at the selected end time; the second independently solves zero net heat flow under the same fixed conditions.
- Updated README to reflect the English screens, single B graph and native equation rendering.

## 2026-10-28 · Steady-state guides, material inputs and graph inspection

- B now shows only steady-state temperatures in its results table. End-of-run temperatures remain available by inspecting the transient curves.
- T6, T7 and T8 use blue, orange and green solid curves, with circle, square and triangle markers and text labels. Matching dashed horizontal lines show steady-state temperatures. Plot limits include these reference values even for short runs.
- Added density and specific heat inputs for each bead, plus an optional effective capacity override in J/K. Without an override, capacity is density × specific heat × spherical bead volume. Defaults remain 8,000 kg/m³ and 500 J/(kg·K). An explicit capacity overrides the material-based calculation.
- The original controls were sufficient only with fixed material assumptions. A already exposed effective heat capacity and UA; B hid the material capacity. Fixed diameters, emissivities, view factors and air properties are now disclosed on screen. These remain model assumptions, not measured calibrations.
- Added finite-positive checks for material inputs and a step-count guard against excessively stiff capacity/duration combinations.
- Both models now return the instantaneous rate at each saved sample. B rates evaluate the nonlinear radiation/convection balance; A rates evaluate supplied power minus all modeled losses.
- Both graphs show time, temperature and signed dT/dt near the selected computed sample. Support includes pointer/tap selection, a curve selector, left/right time keys, up/down curve keys, Home/End and Escape. No external chart library was added; pointer updates reuse computed series.
- Files: physics/experiment-b.js and physics/lumped.js, views/lumped.js, core/lumped-probe.js, both lumped HTML/CSS files, physics and probe tests, reference exporter and independent verification scripts, README. Paths are under assets/js or assets/views/assets/css as appropriate.
- Chrome UI checks passed for opening A and B, keyboard point selection, pointer selection on T8, and changing T6 specific heat. Example T8 readout: 101.000 s, 37.842 °C, 0.0164194 °C/s. Doubling T6 specific heat changed the used capacity from 0.00026180 to 0.00052360 J/K while its steady-state temperature stayed 26.73 °C.
- Independent quadrature including changed material properties and capacity overrides: 3,287 checks passed; maximum relative time error 4.150e-8. SciPy remains unavailable in the local Python environment; its verification code was updated but not executed.
- Real mobile hardware was not tested. GitHub deployment was not performed.
- Final Node regression suite: 88 passed, 1 skipped, 0 failed.

## 2026-10-28 · Consistent end-of-run results and Calculate defaults

- Removed the fixed circle/square/triangle markers placed partway along each curve. They were sensor identifiers, not extra data or integration errors. Colour and endpoint labels identify curves; a marker remains only on an inspected sample.
- Added Experiment A’s steady-state guide using bisection on the same nonlinear energy balance as the transient model, including extra loss UA. Plot limits include the steady-state temperature regardless of duration.
- Changed B’s table to end-of-run temperature, convection rate and radiation rate for each bead. Rates are evaluated at the final integrated temperature, not copied from the steady-state solver. Positive B convection leaves the bead; positive B radiation enters it.
- Increased the A lumped current limit from 2 A to 4 A.
- Matched shared Calculate defaults: A 11 V, 1.87 A and 19.6 °C air; B wall 165 °C, air 25.5 °C, velocity 0.4 m/s and T6 emissivity 0.4. Initial temperatures use ambient air (A 19.6 °C, B 25.5 °C); Calculate’s measured A surface temperature is a different physical quantity. Transient-only defaults remain unchanged.
- Updated README and both English screen descriptions. Existing file structure and dependency-free rendering are retained.
- Automated tests and browser checks were not run for this update.

## 2026-10-28 · Axis labels and stable inspection layout

- Added steady-state temperature labels beside the vertical axis in each curve’s colour, with two decimal places. Nearby labels are separated and connected to the actual guide heights; conflicting ordinary tick labels are omitted.
- Kept the inspection box visible at a fixed height. Leaving a curve, clearing selection or recalculating now clears only its text. Wrapped readouts scroll within the box without shifting the content below.
- Removed Experiment A’s Inspect curve selector. Shared pointer and keyboard handling now supports a missing selector; B retains its selector.
- Both lumped result tables render nonzero magnitudes below 0.01 or at least 1,000,000 using five significant digits and a superscript exponent (for example, 5.0875 × 10⁻⁴ W). Zero and ordinary values retain decimal formatting. Calculations and stored values are unchanged.
- Updated README. No dependencies or file structure changes were introduced. Tests and browser checks were not run for this display update.

## 2026-10-28 · Compact readout and axis column corrections

- Reduced both inspection boxes from 5em to one text line plus padding. The box remains visible when empty; long readouts scroll horizontally without changing its height.
- Explicitly clear the output element’s hidden state during initialization and sample display. This also handles previously cached screen markup containing the old hidden attribute. The reported B disappearance was not reproduced in a browser during this update.
- Moved grey temperature ticks next to the vertical axis and coloured steady-state values to the outer left column. Kept separate label spacing and connector lines, with a wider left margin for both columns.
- Extended scientific notation to nonzero absolute values below 0.1 (previously 0.01). Removed unnecessary mantissa trailing zeros: 0.0999 is displayed as 9.99 × 10⁻². The large-value threshold remains 1,000,000.
- Updated README. Tests and browser checks were not run for this update.
