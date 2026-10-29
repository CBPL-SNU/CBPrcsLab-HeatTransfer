import { switchView } from "../core/router.js";
import { VIEWS } from "../data/views.js";

const LANGUAGE_KEY = "cbprcslab-introduction-language";
const COPY = {
  ko: {
    file: "assets/views/introduction.ko.md",
    title: "열전달 실험 · 소개",
    languageLabel: "소개 언어",
    toc: "이 페이지의 목차",
    loading: "소개를 불러오는 중입니다.",
    retry: "다시 시도",
    error: "소개를 불러오지 못했습니다. 다시 시도해 주세요.",
    topics: {
      "Experiment A": "대류와 복사에 의한 복합 열전달",
      "Experiment B": "온도 측정에서의 복사 오차"
    }
  },
  en: {
    file: "assets/views/introduction.md",
    title: "Heat Transfer Lab · Introduction",
    languageLabel: "Introduction language",
    toc: "On this page",
    loading: "Loading the introduction.",
    retry: "Try again",
    error: "Could not load the introduction. Please try again."
  }
};
let language = "ko";

const LINK = /\[([^\]]+)\]\(([^\s)]+)\)/g;

// 외부 웹 링크, 등록된 화면 링크, 저장소 docs/ 안의 파일만 허용한다.
function linkKind(href) {
  if (href.startsWith("#")) return VIEWS.some(view => view.id === href.slice(1)) ? "screen" : null;
  if (/^https?:\/\//i.test(href)) return "web";
  if (/^docs\/[\w.-]+$/.test(href)) return "doc";
  return null;
}

function makeLink(text, href) {
  const kind = linkKind(href);
  const node = document.createElement(kind ? "a" : "span");
  node.textContent = text;
  if (!kind) return node;
  node.setAttribute("href", href);
  if (kind !== "screen") { node.target = "_blank"; node.rel = "noopener"; }
  return node;
}

// → 문자는 본문 글꼴에 없어 대체 글꼴로 어긋나게 그려지므로 아이콘은 모두 SVG로 둔다
const svg = paths => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const ICON = {
  file: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
  download: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  external: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>')
};

// 실험 묶음의 주제. Calculate 화면 제목의 "·" 뒤를 쓴다
function groupTopic(group, language) {
  if (language === "ko" && COPY.ko.topics[group]) return COPY.ko.topics[group];
  const title = VIEWS.find(view => view.group === group)?.title ?? "";
  return title.split("·").slice(1).join("·").trim();
}

function formatBytes(bytes) {
  return bytes >= 1e6 ? (bytes / 1e6).toFixed(1) + " MB" : Math.round(bytes / 1e3) + " kB";
}

// 링크만 있는 문단은 본문 속 밑줄 링크 대신 버튼 줄로 보인다.
// 파일은 내려받기 카드, 화면은 실험 표지를 단 이동 버튼이 된다.
function linkRow(text, language) {
  const matches = [...text.matchAll(LINK)];
  if (!matches.length || text.replace(LINK, "").replace(/[·|\s]/g, "")) return null;
  const row = document.createElement("div");
  row.className = "intro-links";
  for (const [, label, href] of matches) {
    const kind = linkKind(href);
    const node = makeLink("", href);
    node.classList.add("intro-link", "intro-link--" + (kind ?? "none"));
    const lead = document.createElement("span");
    lead.className = "intro-link-lead";
    const title = document.createElement("span");
    title.className = "intro-link-title";
    title.textContent = label;
    const meta = document.createElement("span");
    meta.className = "intro-link-meta";
    let trail = ICON.external;

    if (kind === "doc") {
      lead.innerHTML = ICON.file;
      trail = ICON.download;
      const type = href.split(".").pop().toUpperCase();
      meta.textContent = type;
      fetch(href, { method: "HEAD" }).then(response => {
        const size = Number(response.headers.get("content-length"));
        if (response.ok && size) meta.textContent = type + " · " + formatBytes(size);
      }).catch(() => {});
    } else if (kind === "screen") {
      const view = VIEWS.find(item => item.id === href.slice(1));
      const letter = /Experiment (\w+)$/.exec(view.group ?? "")?.[1];
      if (letter) { lead.textContent = letter; lead.classList.add("is-letter"); }
      else lead.innerHTML = ICON.arrow;
      meta.textContent = groupTopic(view.group, language) || view.sub;
      trail = ICON.arrow;
    } else {
      lead.innerHTML = ICON.external;
      meta.textContent = new URL(href, location.href).hostname;
    }

    const body = document.createElement("span");
    body.className = "intro-link-body";
    body.append(title, meta);
    const end = document.createElement("span");
    end.className = "intro-link-trail";
    end.innerHTML = trail;
    node.append(lead, body, end);
    row.append(node);
  }
  return row;
}

// 소개에 필요한 Markdown만 지원한다. HTML을 실행하지 않고 DOM의 텍스트로 넣는다.
function inline(parent, text) {
  const pattern = /\x60([^\x60]+)\x60|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^\s)]+)\)/g;
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    parent.append(document.createTextNode(text.slice(end, match.index)));
    let node;
    if (match[1] !== undefined || match[2] !== undefined) {
      node = document.createElement(match[1] !== undefined ? "code" : "strong");
      node.textContent = match[1] ?? match[2];
    } else node = makeLink(match[3], match[4]);
    parent.append(node);
    end = match.index + match[0].length;
  }
  parent.append(document.createTextNode(text.slice(end)));
}

export function renderIntroductionMarkdown(source, language = "en") {
  const fragment = document.createDocumentFragment();
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let paragraph = [];
  let list = null;
  const flush = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ");
    const row = linkRow(text, language);
    const node = row ?? document.createElement("p");
    if (!row) inline(node, text);
    fragment.append(node);
    paragraph = [];
  };
  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const item = /^(?:([-*])|\d+\.)\s+(.+)$/.exec(line);
    const quote = /^>\s?(.*)$/.exec(line);
    if (!line.trim()) { flush(); list = null; continue; }
    if (item) {
      flush();
      const tag = item[1] ? "ul" : "ol";
      if (!list || list.localName !== tag) {
        list = document.createElement(tag);
        fragment.append(list);
        if (tag === "ol") list.start = Number.parseInt(line, 10);
      }
      const node = document.createElement("li");
      inline(node, item[2]);
      list.append(node);
      continue;
    }
    list = null;
    if (heading || quote) {
      flush();
      // 페이지 상단 제목이 h1이므로 본문 제목은 h2부터 시작한다.
      const node = document.createElement(heading ? 'h' + (heading[1].length + 1) : "blockquote");
      inline(node, heading ? heading[2] : quote[1]);
      fragment.append(node);
    } else paragraph.push(line.trim());
  }
  flush();
  return fragment;
}

// 목차는 본문의 절 제목(md의 ##)으로 만든다. 소절 제목은 길어서 넣지 않는다.
// 주소의 #은 router가 화면 전환에 쓰므로, 목차는 주소를 바꾸지 않고 스크롤만 한다.
let onScroll = null;
function buildToc(content, toc, label) {
  if (onScroll) window.removeEventListener("scroll", onScroll);
  const headings = [...content.querySelectorAll("h3")];
  if (!headings.length) { toc.replaceChildren(); return; }
  const title = document.createElement("div");
  title.className = "intro-toc-title";
  title.textContent = label;
  const list = document.createElement("ul");

  const activate = current => links.forEach((link, index) => link.classList.toggle("is-active", headings[index] === current));
  // 목차를 눌러 부드럽게 스크롤하는 동안에는 지나가는 절을 강조하지 않는다
  let target = null, release = 0;
  const links = headings.map((heading, index) => {
    heading.id = "intro-" + index;
    const link = document.createElement("a");
    link.href = "#" + heading.id;
    link.textContent = heading.textContent;
    link.addEventListener("click", event => {
      event.preventDefault();
      target = heading;
      activate(heading);
      heading.scrollIntoView({ behavior: "smooth", block: "start" });
      clearTimeout(release);
      release = setTimeout(() => { target = null; }, 900);
    });
    const item = document.createElement("li");
    item.append(link);
    list.append(item);
    return link;
  });
  toc.replaceChildren(title, list);

  // 상단 바 아래 140px 선을 지난 마지막 제목이 현재 절이다.
  // 페이지 끝에 닿으면 마지막 절은 그 선까지 올라오지 못하므로 따로 처리한다
  let frame = 0;
  const mark = () => {
    frame = 0;
    if (target || !content.offsetParent) return;
    const bottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    const current = bottom ? headings.at(-1)
      : headings.filter(heading => heading.getBoundingClientRect().top < 140).at(-1) ?? headings[0];
    activate(current);
  };
  onScroll = () => { if (!frame) frame = requestAnimationFrame(mark); };
  window.addEventListener("scroll", onScroll, { passive: true });
  mark();
}

export function redrawIntroductionView() {
  if (!document.querySelector("#introduction").classList.contains("is-active")) return;
  const title = document.createElement("span");
  title.lang = language;
  title.textContent = COPY[language].title;
  document.querySelector("#pageTitle").replaceChildren(title);
}

export function initIntroductionView() {
  const content = document.querySelector("#introductionContent");
  const toc = document.querySelector("#introductionToc");
  const retry = document.querySelector("#retryIntroduction");
  const controls = document.querySelector("#introductionLanguage");
  const buttons = [...controls.querySelectorAll("button")];
  // 브라우저에서 저장소 접근을 막아도 언어 전환은 사용할 수 있다.
  try { language = localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "ko"; }
  catch { language = "ko"; }
  let requestId = 0;

  async function load() {
    const request = ++requestId;
    const selectedLanguage = language;
    const copy = COPY[selectedLanguage];
    content.lang = selectedLanguage;
    content.parentElement.lang = selectedLanguage;
    toc.lang = selectedLanguage;
    toc.setAttribute("aria-label", copy.toc);
    toc.replaceChildren();
    if (onScroll) window.removeEventListener("scroll", onScroll);
    onScroll = null;
    controls.lang = selectedLanguage;
    controls.setAttribute("aria-label", copy.languageLabel);
    buttons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.language === selectedLanguage)));
    retry.lang = selectedLanguage;
    retry.textContent = copy.retry;
    retry.hidden = true;
    redrawIntroductionView();
    content.setAttribute("aria-busy", "true");
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.textContent = copy.loading;
    content.replaceChildren(status);
    try {
      const response = await fetch(copy.file);
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const source = await response.text();
      // 늦게 도착한 이전 언어의 응답이 현재 선택을 덮어쓰지 않게 한다.
      if (request !== requestId) return;
      content.replaceChildren(renderIntroductionMarkdown(source, selectedLanguage));
      buildToc(content, toc, copy.toc);
    } catch (error) {
      if (request !== requestId) return;
      status.textContent = copy.error + ' (' + error.message + ')';
      content.replaceChildren(status);
      retry.hidden = false;
    } finally {
      if (request === requestId) content.setAttribute("aria-busy", "false");
    }
  }
  controls.addEventListener("click", event => {
    const button = event.target.closest("button[data-language]");
    if (!button || button.dataset.language === language) return;
    language = button.dataset.language;
    try { localStorage.setItem(LANGUAGE_KEY, language); }
    catch { /* 저장이 제한된 환경에서는 현재 방문 동안만 유지한다. */ }
    load();
  });
  retry.addEventListener("click", load);
  content.addEventListener("click", event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    switchView(link.getAttribute("href").slice(1));
  });
  load();
}
