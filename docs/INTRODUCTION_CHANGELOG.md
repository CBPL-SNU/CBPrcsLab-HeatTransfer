# Introduction 페이지 추가 내역

작성일: 2026-10-28

## 변경 목적과 동작

열전달 실험 학습 도구의 목적, 실험 A·B 개요, 사용 순서를 안내하는 소개 페이지를 추가했습니다. 기존 HTML·CSS·JavaScript 모듈 구조를 유지하고 외부 의존성이나 빌드 단계를 추가하지 않았습니다.

왼쪽 메뉴 맨 위에 Introduction을 추가했습니다. 화면 해시 없이 사이트를 열면 소개가 표시되고, 기존 실험 화면의 직접 링크는 그대로 사용할 수 있습니다.

## 추가한 파일

| 파일 | 역할 |
|---|---|
| `assets/views/introduction.md` | 수정 가능한 소개 본문. 도구 목적, 실험 A·B, 사용 순서, 결과 해석 안내 |
| `assets/views/introduction.html` | 소개 본문 표시 영역, 로딩 안내, 다시 불러오기 버튼 |
| `assets/js/views/introduction.js` | Markdown 읽기·표시, 로딩 실패 처리, 소개 본문의 실험 화면 링크 연결 |
| `assets/css/views/introduction.css` | 소개 페이지의 글꼴 크기, 본문 폭, 여백, 목록·인용·링크 스타일 |

## 수정한 파일

| 파일 | 변경 내용 |
|---|---|
| `index.html` | `introduction` 화면 영역을 추가하고 초기 활성 화면으로 지정 |
| `assets/js/data/views.js` | Introduction 메뉴를 첫 항목으로 등록. 기존 `DEFAULT_VIEW = VIEWS[0].id`에 따라 기본 화면이 소개로 변경 |
| `assets/js/main.js` | `initIntroductionView`를 가져와 `SCREENS`에 초기화 함수 등록 |

README.md에 임시로 추가했던 소개 페이지 수정 안내는 이 문서로 옮기고 README에서는 제거했습니다.

## 소개 페이지 수정

- 본문: `assets/views/introduction.md`
- 모양: `assets/css/views/introduction.css`
- 화면 틀: `assets/views/introduction.html`
- 메뉴 이름과 상단 제목: `assets/js/data/views.js`의 `introduction` 항목

주소에 화면 해시가 없으면 소개가 첫 화면으로 열립니다. 기존 `#experiment-a` 등의 직접 링크도 유지됩니다.

본문은 간단한 Markdown을 지원합니다: `#` / `##` / `###` 제목, 빈 줄로 구분한 문단, `-` 또는 `1.` 목록, `**굵게**`, 인라인 코드, `>` 인용, `[이름](https://example.com)` 링크. `[실험 A](#experiment-a)`처럼 등록된 화면으로 이동하는 링크도 가능합니다. 제목은 사이트 상단 제목 아래의 계층으로 표시됩니다.

중첩 목록, 표, 이미지, 코드 블록, 수식 및 HTML 삽입은 지원하지 않습니다. 외부 라이브러리 없이 소개에 필요한 문법만 표시합니다. 내용을 바꾼 뒤 브라우저를 새로고침하면 다시 읽습니다.

## 구현 참고

- 기존 라우터가 소개 HTML과 전용 CSS를 처음 열 때 불러옵니다.
- 소개 초기화 함수가 Markdown 파일을 읽고 브라우저 DOM으로 표시합니다. 원시 HTML은 실행하지 않습니다.
- Markdown 링크는 HTTP(S) 주소와 등록된 화면의 해시 링크를 지원합니다.
- Markdown 로딩에 실패하면 안내와 다시 불러오기 버튼을 표시합니다.
- 소개 본문은 한국어이며, 본문 영역에 `lang="ko"`를 지정했습니다.

## 확인 결과

- 변경한 JavaScript 3개 파일의 `node --check` 구문 검사 통과.
- 기존 `tests/markup-contract.test.mjs` 실행 결과: 26개 통과, 1개 생략, 1개 실패.
- 실패는 기존 테스트가 Windows 경로에서 미구현 My data 모듈을 제외하지 못해 발생했습니다. 해당 테스트는 슬래시 기반 문자열 치환으로 경로를 처리하고 있습니다.
- 브라우저 화면 확인과 GitHub 배포는 수행하지 않았습니다.

## 2026-10-28 · English interface

- Translated the introduction Markdown, menu subtitle, page title, loading message, retry button and error message into English.
- Updated the content language to en. The Markdown editing workflow is unchanged.
- Added the lumped screen to the recommended learning sequence.
