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
      // 외부 웹 링크와 등록된 화면 링크만 허용한다.
      const href = match[4];
      const screen = href.startsWith("#") && VIEWS.some(view => view.id === href.slice(1));
      const web = /^https?:\/\//i.test(href);
      node = document.createElement(screen || web ? "a" : "span");
      node.textContent = match[3];
      if (screen || web) node.setAttribute("href", href);
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

export function initIntroductionView() {
  const content = document.querySelector("#introductionContent");
  const retry = document.querySelector("#retryIntroduction");
  async function load() {
    content.setAttribute("aria-busy", "true");
    retry.hidden = true;
    try {
      const response = await fetch("assets/views/introduction.md", { cache: "no-cache" });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      content.replaceChildren(renderIntroductionMarkdown(await response.text()));
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
