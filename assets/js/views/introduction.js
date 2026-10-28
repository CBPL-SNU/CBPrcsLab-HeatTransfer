import { switchView } from "../core/router.js";
import { VIEWS } from "../data/views.js";

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
    } else {
      // 외부 웹 링크, 등록된 화면 링크, 저장소 docs/ 안의 파일만 허용한다.
      const href = match[4];
      const screen = href.startsWith("#") && VIEWS.some(view => view.id === href.slice(1));
      const web = /^https?:\/\//i.test(href);
      const doc = /^docs\/[\w.-]+$/.test(href);
      node = document.createElement(screen || web || doc ? "a" : "span");
      node.textContent = match[3];
      if (screen || web || doc) node.setAttribute("href", href);
      if (web || doc) { node.target = "_blank"; node.rel = "noopener"; }
    }
    parent.append(node);
    end = match.index + match[0].length;
  }
  parent.append(document.createTextNode(text.slice(end)));
}

export function renderIntroductionMarkdown(source) {
  const fragment = document.createDocumentFragment();
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let paragraph = [];
  let list = null;
  const flush = () => {
    if (!paragraph.length) return;
    const node = document.createElement("p");
    inline(node, paragraph.join(" "));
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
function buildToc(content, toc) {
  if (onScroll) window.removeEventListener("scroll", onScroll);
  const headings = [...content.querySelectorAll("h3")];
  if (!headings.length) { toc.replaceChildren(); return; }
  const title = document.createElement("div");
  title.className = "intro-toc-title";
  title.textContent = "On this page";
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

export function initIntroductionView() {
  const content = document.querySelector("#introductionContent");
  const toc = document.querySelector("#introductionToc");
  const retry = document.querySelector("#retryIntroduction");
  async function load() {
    content.setAttribute("aria-busy", "true");
    retry.hidden = true;
    try {
      const response = await fetch("assets/views/introduction.md");
      if (!response.ok) throw new Error('HTTP ' + response.status);
      content.replaceChildren(renderIntroductionMarkdown(await response.text()));
      buildToc(content, toc);
    } catch (error) {
      content.textContent = 'Could not load the introduction. Please try again. (' + error.message + ')';
      retry.hidden = false;
    } finally {
      content.setAttribute("aria-busy", "false");
    }
  }
  retry.addEventListener("click", load);
  content.addEventListener("click", event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    switchView(link.getAttribute("href").slice(1));
  });
  load();
}
