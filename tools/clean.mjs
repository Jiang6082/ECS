// Shared title/row cleanup used by the scanners and by the one-off output migration.
import { decodeHtml } from "./common.mjs";
import { classifyRole } from "./relevance.mjs";

export function cleanTitle(title = "") {
  return decodeHtml(title).replace(/^(?:Job\s+)?(?:Posting\s+)?Title\s+/i, "").trim();
}

// True when a previously-recorded role would still be kept by the current filter.
export function stillRelevant(row, firm = {}) {
  return Boolean(classifyRole({ Title: cleanTitle(row.Title), Notes: row.Notes || "" }, firm).track);
}
