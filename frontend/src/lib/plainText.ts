/**
 * Markdown -> plain text for screen-reader announcements. Drops syntax that would otherwise be
 * read out (`**`, `#`, list markers, link URLs, table pipes) and separates blocks with sentence
 * punctuation so the result reads naturally. Not a general markdown parser.
 */
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const HEADING = /^#{1,6}\s+/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+/;

function stripInline(text: string) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    // Underscore emphasis only at word edges, so ACTIVE_NOT_RECRUITING keeps its underscores.
    .replace(/(^|[^\w*])\*([^*\s](?:[^*]*[^*\s])?)\*(?![\w*])/g, "$1$2")
    .replace(/(^|[^\w_])_([^_\s](?:[^_]*[^_\s])?)_(?![\w_])/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

export function markdownToPlainText(markdown: string) {
  const blocks: string[] = [];
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push(stripInline(paragraph.join(" ")));
    paragraph = [];
  };

  for (const line of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    if (!line.trim()) {
      flushParagraph();
    } else if (TABLE_SEPARATOR.test(line)) {
      flushParagraph();
    } else if (TABLE_ROW.test(line)) {
      flushParagraph();
      const cells = line.trim().slice(1, -1).split("|").map((cell) => stripInline(cell));
      blocks.push(cells.filter(Boolean).join(", "));
    } else if (HEADING.test(line)) {
      flushParagraph();
      blocks.push(stripInline(line.replace(HEADING, "")));
    } else if (LIST_ITEM.test(line)) {
      flushParagraph();
      blocks.push(stripInline(line.replace(LIST_ITEM, "")));
    } else {
      paragraph.push(line.replace(/^>\s?/, ""));
    }
  }
  flushParagraph();

  return blocks
    .filter(Boolean)
    .map((block, index, all) => (index < all.length - 1 && !/[.!?:;]$/.test(block) ? `${block}.` : block))
    .join(" ");
}
