/**
 * Parse a subset of markdown (Bold, Italic, Underline, Lists) into styled HTML safely.
 * Escapes raw HTML first to prevent XSS.
 */
export function parseMarkdownToHtml(text: string): string {
  if (!text) return "";

  // 1. Escape HTML to prevent XSS
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Parse Underline: __text__ -> <u>text</u>
  html = html.replace(/__([^_]+)__/g, "<u>$1</u>");

  // 3. Parse Bold: **text** -> <strong>$1</strong>
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // 4. Parse Italic: *text* -> <em>$1</em> or _text_ -> <em>$1</em>
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");

  // 5. Parse Lists & Newlines
  const lines = html.split("\n");
  const processedLines: string[] = [];
  let inUnorderedList = false;
  let inOrderedList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Bullet List: line starts with "- " or "* "
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
    // Numbered List: line starts with "1. ", "2. ", etc.
    const numberMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);

    if (bulletMatch) {
      if (inOrderedList) {
        processedLines.push("</ol>");
        inOrderedList = false;
      }
      if (!inUnorderedList) {
        processedLines.push("<ul class='list-disc pl-5 my-1'>");
        inUnorderedList = true;
      }
      processedLines.push(`<li>${bulletMatch[2]}</li>`);
    } else if (numberMatch) {
      if (inUnorderedList) {
        processedLines.push("</ul>");
        inUnorderedList = false;
      }
      if (!inOrderedList) {
        processedLines.push("<ol class='list-decimal pl-5 my-1'>");
        inOrderedList = true;
      }
      processedLines.push(`<li>${numberMatch[2]}</li>`);
    } else {
      // Close open lists if any
      if (inUnorderedList) {
        processedLines.push("</ul>");
        inUnorderedList = false;
      }
      if (inOrderedList) {
        processedLines.push("</ol>");
        inOrderedList = false;
      }
      processedLines.push(line);
    }
  }

  if (inUnorderedList) processedLines.push("</ul>");
  if (inOrderedList) processedLines.push("</ol>");

  // Join lines, appending br only for normal text paragraphs
  return processedLines
    .map((line) => {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("</ul>") ||
        trimmed.startsWith("<ol") ||
        trimmed.startsWith("</ol>") ||
        trimmed.startsWith("<li>")
      ) {
        return line;
      }
      return line === "" ? "<br />" : line + "<br />";
    })
    .join("");
}
