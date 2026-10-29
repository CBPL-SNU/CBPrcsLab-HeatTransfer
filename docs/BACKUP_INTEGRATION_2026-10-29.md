# 새 clone에 백업 변경 통합

작성일: 2026-10-29

## 기준

- 대상: CBPrcsLab-HeatTransfer (현재 작업 폴더)
- 백업: ../CBPrcsLab-HeatTransfer_copied (읽기 전용으로 사용)
- 이전 기준 커밋: 92c6cf6db93f90d59d552af2e23c6fbe9acaaafc
- 새 clone 기준 커밋: c0823fd0c74b69e5f98c2855b7dbc060f52983a5

Git 실행 파일을 사용할 수 없어 Git 객체를 읽어 기준 커밋의 파일과 양쪽 작업 파일을 비교했다. 줄바꿈 차이는 기능 변경에서 제외했다.

## 통합 결과

백업의 변경 18개 파일과 최신 main의 변경 13개 파일 사이에 파일 단위 중복은 없었다. 대상 파일에 별도의 로컬 수정이 없는 것을 확인한 뒤 백업의 기능 변경만 반영했다. 최신 공통 스타일의 segmented 컨트롤과 소속 표시, CFD/Compare/My data 화면 변경, SNU 엠블럼은 유지했다.

반영 기능: A McAdams/Morgan 선택, B Ranz–Marshall/Churchill 선택, 공기 물성 자동/수동 설정, 온도 의존 열수지와 RK4 오차 추정, A Calculate Morgan 입력 개선 및 관련 문서.

### 반영 파일

- assets/css/views/a-lumped.css
- assets/css/views/b-lumped.css
- assets/css/views/experiment-a.css
- assets/js/core/transient.js
- assets/js/physics/air-properties.js
- assets/js/physics/constants.js
- assets/js/physics/experiment-a.js
- assets/js/physics/experiment-b.js
- assets/js/physics/lumped.js
- assets/js/views/experiment-a.js
- assets/js/views/lumped.js
- assets/views/a-lumped.html
- assets/views/b-lumped.html
- assets/views/experiment-a.html
- docs/AIR_PROPERTIES_MODEL.md
- docs/CONVECTION_MODEL_AIR_PROPERTIES_PLAN.md
- docs/LUMPED_CHANGELOG.md
- README.md

## 확인 범위

- 기능 변경 18개 파일은 통합 직후 백업과 바이트 단위로 일치했다.
- 동료가 변경한 13개 파일은 통합 전후 SHA-256이 모두 같았다.
- JavaScript 8개 파일의 node --check 구문 검사가 통과했다.
- 수치 회귀 테스트, 독립 물리 검증 및 브라우저 동작 검증은 실행하지 않았다.
- 커밋, push, 배포 및 .git 변경은 수행하지 않았다.
- 백업의 자동 물성은 검증 전 선택 옵션이라는 상태를 그대로 유지했다.
