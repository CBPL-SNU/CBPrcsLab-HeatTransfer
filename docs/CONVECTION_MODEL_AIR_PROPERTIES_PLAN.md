# 대류 모델 선택 및 공기 물성 개선 계획

작성일: 2026-10-28
상태: 계획만 작성 — 구현 승인이나 완료 기록이 아님

## 1. 요청과 이번 작업 범위

사용자가 요청한 사항을 다음 구현을 위한 계획으로 정리한다. 이번 작업에서는 이 파일만 추가한다. 계산 엔진, 화면, 입력 기본값, README 및 기존 변경 기록은 수정하지 않으며 테스트도 실행하지 않는다.

1. B Lumped parameter에서 구의 자연대류/강제대류 모델을 직접 선택한다.
2. A Lumped parameter에서 기존 McAdams/Morgan 모델을 직접 선택한다.
3. Lumped 화면의 공기 물성을 계산 중 자동으로 정하는 방안을 검토하고, 직접 입력 대안을 준비한다.
4. A Calculate의 Morgan 공기 물성 입력 너비와 숫자 증감 간격을 개선한다.

영문 화면 기조를 유지한다. 사용자 표현의 Chulchil은 표준 철자인 Churchill로, Mc Adams는 기존 코드와 같은 McAdams로 표기한다.

## 2. 현재 코드에서 확인한 사항

- A Calculate: assets/views/experiment-a.html의 aModel에서 McAdams/Morgan 선택이 가능하다. aK, aNu, aPr를 직접 입력하며 세 입력 모두 step=any이다. 값은 각각 0.027 W/(m·K), 0.0000175 m²/s, 0.707이다.
- A 물리 함수: assets/js/physics/experiment-a.js의 cylinderHeat는 model, k, nu, pr를 받는다. Morgan에서 beta는 현재 film temperature의 역수로 평가하지만, k/nu/Pr 자체가 온도에 따라 자동 변경되는 것은 아니다.
- A Lumped: simulateCylinder에는 model 인자가 있으나 UI 선택창은 없고 McAdams가 기본이다. 현재 k/nu/pr를 transient 함수에서 cylinderHeat로 전달하는 경로도 없다.
- B: assets/js/physics/experiment-b.js의 beadConvection은 고정 AIR 물성과 Ranz–Marshall을 사용한다. solveSensor를 Calculate와 Lumped가 공유한다.
- B Lumped: simulateSensors는 처음 구한 sensor.h를 전체 시간 동안 재사용한다. 자연대류나 온도 의존 물성을 추가하면 이 구조를 바꿔야 한다.
- Lumped 공통 폼은 현재 빈 값을 제외한 모든 필드를 Number로 변환한다. 문자열 model/airMode를 추가할 때 이 처리를 유지하면 NaN이 되므로 명시적으로 분리한다.
- A Calculate 전용 CSS 파일 assets/css/views/experiment-a.css는 현재 없다. 필요하면 이 파일을 추가할 수 있으며 라우터가 화면별 CSS를 로드하는 구조는 이미 있다.

## 3. 모델 선택 UI

### A Lumped

- 입력 영역에 Correlation 선택창 추가.
- 항목: McAdams (natural convection), Morgan (natural convection).
- 기본 선택은 기존 계산과 동일한 McAdams.
- 선택한 모델을 시간 적분, 정상상태 점선, 종료 시점 열전달률, 조회 기울기에 모두 적용한다.
- McAdams는 현재 식에서 k/nu/Pr를 직접 사용하지 않는다. 공기 물성 설정은 Morgan을 선택할 때만 활성화하고, 모델 변경 시 입력값은 보존한다.

### B Lumped

- 입력 영역에 Correlation 선택창 추가.
- 항목: Churchill (natural convection), Ranz–Marshall (forced convection).
- 기본 선택은 기존 계산과 동일한 Ranz–Marshall.
- 유속으로 모델을 자동 전환하지 않는다. 혼합대류 모델과 두 상관식의 단순 합산은 이번 구현 범위에 넣지 않는다.
- Churchill 선택 시 유속 입력은 비활성화하고 이 모델에서 사용하지 않음을 설명한다. 다시 강제대류를 선택하면 사용자가 입력한 유속을 복원한다.
- 정상상태 점선, 시간응답, 종료 결과, 조회 기울기에 동일 모델과 물성 정책을 사용한다.
- 모델 설명에 구 형상, 적용 범위, 평가 온도와 고정/자동 물성 여부를 표시한다. 작은 Ra에서 Nu가 2로 접근하는 전도 한계와 실제 자연대류 효과를 구분한다.

### B Calculate와의 관계

직접 요청된 중심 범위는 Lumped 모델 선택이다. 공통 엔진을 변경하더라도 기존 B Calculate 호출은 Ranz–Marshall과 기존 고정 물성을 기본값으로 유지한다.

권장 후속 범위로 B Calculate에도 같은 선택창과 물성 설정을 제공하면 두 화면 비교가 쉬워진다. 이를 포함할 경우 함께 처리해야 할 항목:

- Churchill에서는 유속별 온도 그래프와 최소 요구 유속 지표가 의미가 없으므로 숨기거나 Not applicable로 표시한다.
- criticalVelocity의 이분법은 강제대류에서만 호출한다.
- 두 화면의 모델과 물성 모드가 다르면 정상상태 결과도 달라질 수 있음을 명시한다.
- 이번 계획 작성만으로 B Calculate 기능 확장까지 구현 완료 또는 확정 범위로 간주하지 않는다.

## 4. 공기 물성: 자동 계산 가능성과 우선안

### 가능 여부

브라우저에서 온도를 받아 작은 표를 보간하거나 간단한 식을 평가하는 작업은 가능하다. 대규모 물성 라이브러리나 계산 서버는 필요하지 않다. 실제 600초 연산 속도는 구현 후 측정한다.

### 권장 구성

Lumped 화면에 접이식 Air properties 패널을 두고 다음 두 모드를 제공한다.

- Automatic (temperature-dependent): 검증된 로컬 물성 자료를 사용한다.
- Manual (constant): 사용자가 지정한 k, nu, Pr를 시간에 대해 일정하게 사용한다.

자동 모드는 출처/적용 범위와 독립 검증이 준비된 뒤 기본값으로 채택한다. 자료 확보 전에는 기존 고정값 기반 수동 모드를 제공한다. 자동 모드가 이미 정확하게 준비된 것처럼 UI를 만들지 않는다.

초기 자동 모델은 건조 공기, 기준 압력 101325 Pa로 한정하고 가정을 표시한다. 습도·조성·고도 영향은 포함하지 않는다. 압력 입력 확장은 별도 범위로 둔다.

### 물성 자료와 계산 규칙

1. 출처, 온도 범위, 압력, 단위 및 재사용 조건이 확인된 물성표를 확보한다. 이번 계획에서는 특정 수치표를 확보·검증했다고 주장하지 않는다.
2. 권장 방식은 로컬 온도표와 선형 보간이다. 선택한 자료의 정확도와 표 간격을 검토한다. 고차 보간에 따른 음수/오버슈트는 피한다.
3. 한 일관된 자료에서 rho, mu, k, cp를 얻고 nu=mu/rho, alpha=k/(rho*cp), Pr=mu*cp/k를 계산하는 구성을 우선한다. 서로 다른 자료의 nu/Pr를 임의로 섞지 않는다.
4. Sutherland 식은 점도 계산 대안이다. 이것만으로 k와 cp까지 얻을 수는 없으므로 열전도도/비열의 별도 자료가 필요하다. 온도 단위와 계수 단위를 확인한다.
5. 자료 범위 밖에서는 자동 외삽/끝값 고정을 하지 않는다. 계산 불가 이유와 수동 입력 전환 방법을 알려준다. RK4 중간 단계와 정상상태 탐색의 후보 온도도 검사한다.
6. 물성 출처/보간 규칙은 코드와 문서에 함께 남긴다. 실행 중 인터넷 조회는 하지 않는다.

### 평가 온도

- A Morgan: 실린더와 공기 온도의 평균 film temperature를 기준으로 검토한다. 온도는 절대온도로 변환한다.
- B Churchill: 비드와 공기의 film temperature에서 물성을 평가하는 채택 문헌의 규칙을 따른다. beta의 평가 위치도 해당 문헌에 맞춰 명시한다.
- B Ranz–Marshall: 채택한 상관식 출처의 자유류/film 물성 평가 관례를 먼저 확인한다. 다른 모델과 맞추기 위해 일괄적으로 film temperature를 적용하지 않는다. 자유류 물성 기준을 채택하면 공기 온도가 일정한 실행에서는 자동 모드여도 물성이 일정할 수 있다.
- 이상기체 beta=1/T를 사용한다면 어떤 절대온도 T를 썼는지 명시한다.
- 공기 물성과 비드 고체 물성을 구분한다. 자동 공기 물성이 기존 비드 밀도·비열·유효 열용량 입력을 덮어쓰지 않도록 한다.

### 사용자에게 보여줄 정보

- 접힌 상태: Automatic/Manual 및 자료의 기준 압력.
- 펼친 상태: 출처, 허용 온도 범위, 평가 온도 기준과 단위.
- 자동 모드: 시작/종료 시점의 평가 온도와 k, nu, Pr 요약. B는 비드별 온도가 다를 수 있으므로 필요 시 센서별 표시.
- 수동 모드: k, nu, Pr 입력과 양의 유한값 검사. beta는 명시한 온도 규칙으로 계산한다. 수동이라고 h까지 일정한 것은 아니며 Churchill의 Ra는 비드 온도차에 따라 변한다.
- 서로 다른 모델/물성 모드로 계산한 결과를 비교할 때 조건 차이를 확인할 수 있게 결과 설명에 사용한 설정을 남긴다.

## 5. 계산 엔진 변경 설계

### 공통 함수 경계

- 새 순수 함수 모듈 후보: assets/js/physics/air-properties.js.
- 출처가 검증된 표는 작은 별도 데이터 모듈에 보관하거나 위 파일에 함께 둔다. 장치 상수와 기준 압력 등 공통 상수는 constants.js 관례에 맞춰 관리한다.
- 공기 물성 함수는 평가 온도, 물성 모드, 수동값을 받아 물성과 유효 범위 정보를 반환한다. DOM 접근이나 네트워크 호출은 하지 않는다.
- 각 대류 함수는 model, 물체 온도, 공기 온도, 유속, 물성 설정을 받아 h, Nu, Re/Ra 및 사용 물성을 반환한다.
- 동일한 열유속 함수를 정상상태 해 찾기, RK4 미분 함수, 종료 결과와 조회 기울기 계산에 재사용한다.

### A

- simulateCylinder에 model과 공기 물성 설정을 전달한다.
- Morgan의 각 RK4 중간 온도에서 필요 물성을 평가한다.
- 정상상태 해도 같은 함수로 순열량=0을 풀며 UA를 포함한다.
- 기존 Morgan의 구간별 C/n은 교안과 맞춰 유지한다. 구간 경계에 미세한 불연속이 있을 수 있으므로 이분법의 온도 구간이 작아졌다는 이유만으로 수렴을 선언하지 않는다. 에너지 잔차도 확인하고 허용오차를 못 맞추면 표시한다.

### B

- Churchill의 구 상관식: Nu = 2 + 0.589 Ra^(1/4) / [1 + (0.469/Pr)^(9/16)]^(4/9).
- Ra = g beta abs(Tb-Tg) D^3 / (nu alpha), h = k Nu/D.
- 적용 범위는 채택 문헌 기준으로 검사한다(대표적인 안내: Pr 약 0.7 이상, Ra 약 10^11 이하). 고온 공기의 Pr이 경계 아래가 되는 경우도 정상 범위라고 묵인하지 않는다.
- h는 각 RK4 중간 온도에서 다시 구한다. 현재 sensor.h 한 번 계산 후 재사용하는 경로를 변경한다.
- solveSensor의 정상상태 balance도 후보 비드 온도마다 같은 h를 평가한다.
- 종료 시점 대류/복사, 저장점 dT/dt, 정상상태 점선 모두 이 공통 함수에서 계산한다.
- 비드 유효 열용량은 그대로 사용한다. 정상상태는 용량과 무관해야 한다.
- 현재 tau는 고정 h를 전제로 한다. h(T)가 추가되면 Qnet의 온도 미분을 포함해 다시 정의하거나 해당 모드에서 기존 tau 출력을 중지한다. 강제대류의 기존 tau를 자연대류에 그대로 재사용하지 않는다.

### 적분 간격과 계산 안정성

현재 B의 최소 시간상수 기반 maxStep은 고정 h 가정이다. 자동 물성/자연대류에 그대로 적용해 안전하다고 단정하지 않는다.

- 온도 구간에서 전체 열유속의 온도 민감도를 고려하는 보수적 간격 또는 RK4 step-doubling 오차 추정을 검토한다.
- 검증 가능한 공통 정책을 A/B에 적용하되 그래프 저장 간격은 적분 간격과 분리한다.
- dt 절반/4분의 1 결과와 독립 적분을 비교하여 정책을 선택한다.
- 적분 횟수 상한과 사용자 안내를 유지한다. 정확도가 확보되지 않으면 성공 결과처럼 출력하지 않는다.
- 표시용 반올림이나 조회 이벤트가 재적분을 유발하지 않도록 유지한다.

## 6. 직접 입력 대안 및 A Calculate 입력칸 개선

자동 물성 자료 확보가 지연되면 접이식 Manual air properties부터 구현할 수 있다. 기본값은 기존 각 엔진 값과 맞춘다. A nu=1.75e-5, B nu=1.7e-5처럼 현재 값이 다르므로 임의로 통일하지 않는다.

A Calculate의 Morgan 입력칸 개선안:

| 항목 | 표시 기본값 | 화살표 1회 증감 제안 | 내부 값 |
|---|---:|---:|---|
| k [W/(m·K)] | 0.027 | 0.001 | 입력값 그대로 |
| nu [10^-6 m²/s] | 17.5 | 0.1 | 표시값 × 10^-6 |
| Pr [-] | 0.707 | 0.001 | 입력값 그대로 |

- 각 필드 너비 약 200–220px, 숫자 입력 부분 최소 약 120px를 확보한다. 단위 때문에 숫자가 잘리지 않도록 하고 모바일에서는 한 열로 배치한다.
- nu를 마이크로 단위로 표시하면 긴 0의 나열을 줄일 수 있다. 라벨에서 10^-6을 위첨자로 명확히 표시하고, readInputs에서 SI 단위 변환을 단 한 번 수행한다.
- 기존 직접입력 정밀도를 불필요하게 제한하지 않는다. step=any를 유지하면서 작은 증감용 버튼을 추가하는 방식과 명시적 step 속성을 쓰는 방식을 비교한다. 후자를 선택하면 stepMismatch 때문에 유효한 세밀한 값이 거부되지 않는지 확인한다.
- 기본값 복원, 빈 값, 0/음수, 과학적 입력, 단위 변환을 명시적으로 처리한다. 기존 min/max 보정으로 잘못된 값을 조용히 정상값처럼 계산하지 않는다.
- 기본 전압·전류·측정온도와 모델 선택 기능은 이 UI 개선에서 변경하지 않는다.
- 새 experiment-a.css에서 #experiment-a #aAdvanced 범위에만 스타일을 적용해 다른 화면 입력 크기에 영향을 주지 않는다.

## 7. 예상 변경 파일

| 파일 | 예정 역할 |
|---|---|
| assets/views/a-lumped.html, b-lumped.html | 모델 선택, 접이식 공기 물성 설정, 가정 설명 |
| assets/js/views/lumped.js | 문자열/숫자 입력 분리, 조건 전달, 모델별 컨트롤과 물성 요약 |
| assets/css/views/a-lumped.css, b-lumped.css | 물성 입력과 설명의 반응형 배치 |
| assets/js/physics/air-properties.js (신규 후보) | 자동/수동 공기 물성 평가 |
| assets/js/physics/constants.js | 필요한 공통 기준 상수 |
| assets/js/physics/experiment-a.js, experiment-b.js | 모델 선택과 상태별 대류 평가 |
| assets/js/physics/lumped.js | 각 RK4 단계 및 정상상태 계산 연결, 간격 정책 |
| assets/views/experiment-a.html | Morgan 입력 단위·증감 제어 |
| assets/js/views/experiment-a.js | nu 표시 단위 변환, 값 검사 |
| assets/css/views/experiment-a.css (신규 후보) | A Calculate 상세 입력 너비 |
| tests/ 및 tools/ | 구현 시 승인된 검증 범위에 따라 회귀·독립 물리 검증 보완 |
| README.md, docs/LUMPED_CHANGELOG.md | 실제 구현 후 사용법·변경 내역 갱신 |

B Calculate UI 확장을 선택할 경우 experiment-b.html 및 views/experiment-b.js의 유속 그래프/criticalVelocity 처리도 함께 변경한다.

## 8. 구현 순서와 향후 검증 계획

1. 물성 자료 출처·범위·평가 온도를 확정하고 공통 함수 계약을 정한다.
2. A Calculate 입력칸 개선을 독립적으로 구현한다.
3. 고정 수동 물성 기준으로 A/B Lumped 모델 선택과 Churchill 계산을 구현한다.
4. 검증된 자동 물성 모드를 연결하고 온도 의존 열유속/적분 간격을 개선한다.
5. 실제 사용 조건과 경계 조건을 검증한 뒤 README와 변경 기록에 결과를 남긴다.

아래는 향후 검증 항목이며 이번 작업에서 실행한 테스트가 아니다.

- 기존 McAdams/Ranz–Marshall + 고정 물성의 결과 회귀 비교.
- 물성표의 원래 지점·중간 보간·허용 범위 경계·범위 밖 동작 확인.
- 정상상태 에너지 잔차 및 충분히 긴 시간응답의 정상상태 수렴 확인.
- 가열/냉각/온도차 0, Churchill의 U 무관성, 강제대류의 유속 증가 효과 확인.
- 물성 모드에 관계없이 용량을 바꾸면 응답 속도는 달라지고 정상상태는 유지되는지 확인.
- 동일 모델·동일 물성 정책의 Calculate/Lumped 결과 일치 확인.
- dt 축소 수렴과 SciPy 등 독립 적분 비교. 기존 RK4 검증 기록을 새 모델 검증으로 대신하지 않는다.
- Morgan 구간 경계, Churchill 적용 범위, 아주 작은 용량과 큰 온도차 검사.
- 600초 및 최대 지원 시간 연산 비용 측정. 물성 계산과 화면 렌더링 비용을 구분한다.
- 데스크톱/모바일 모델 전환, 상세 입력, 조회 상자, 점선 라벨, 키보드·터치 조작 확인.

## 9. 참고 자료와 미확정 사항

- [COMSOL Heat Transfer Module User’s Guide](https://doc.comsol.com/6.4/doc/com.comsol.help.heat/HeatTransferModuleUsersGuide.pdf): 구 자연대류 식 및 물성 평가 조건을 확인할 공식 자료. 이를 공기 물성 수치표를 확보했다는 의미로 사용하지 않는다.
- [EES 구 자연대류 공식 문서](https://www.fchartsoftware.com/ees/heat_transfer_library/free_convection/hs3035.htm): Churchill 식의 이름과 대표 적용 범위.
- [NASA Viscosity](https://www.grc.nasa.gov/www/BGH/viscosity.html): Sutherland 점도 식. 이 페이지의 Rankine/영미 단위 계수를 SI 코드에 그대로 넣지 않는다.
- [COMSOL Sutherland’s Law](https://doc.comsol.com/6.4/doc/com.comsol.help.cfd/cfd_ug_fluidflow_high_mach.08.46.html): 점도 온도 의존 근사 및 공기 적용 설명.

구현 전에 확정할 사항은 물성 데이터의 실제 출처/범위, 상관식별 평가 온도 규칙, 자동 모드 기본 채택 시점, B Calculate까지의 UI 확장 범위이다. 이 파일의 제안은 구현 전 검토용이다.

## 2026-10-29 구현 기록

이전 본문은 작성 당시의 계획이며, 현재 구현 상태는 이 항목을 따른다.

- A/B Lumped 모델 선택, 자동/수동 공기 물성, A Calculate Morgan 입력 개선을 구현했다.
- 자동 물성표 대신 출처가 있는 Sutherland 점도·열전도도 식, 이상기체 밀도 및 일정 cp 근사를 채택했다. 검증된 물성 데이터베이스라고 표현하지 않는다.
- Ranz–Marshall도 연구 문헌의 film 온도 관례를 채택했다. 자동 물성은 RK4 각 단계에서 갱신한다.
- 독립 검증 전이므로 수동 모드를 기본값으로 유지하고 자동 모드는 선택 가능하게 제공한다.
- 적분 오차 추정 및 온도/상관식 범위 처리를 추가했다. 수치 검증과 브라우저 검증은 아직 수행하지 않았다.
- 선택 사항이었던 B Calculate 모델 선택 UI는 이번 범위에 포함하지 않았다.
- 세부 식, 출처와 검증 상태: [AIR_PROPERTIES_MODEL.md](AIR_PROPERTIES_MODEL.md).
