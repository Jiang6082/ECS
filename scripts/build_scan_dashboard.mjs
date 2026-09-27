import fs from "node:fs/promises";
import { regionOrder } from "../tools/regions.mjs";

const reportPath = "data/new_econ_roles_since_last_run.json";
const rawPath = "data/econ_internship_roles_scan_v2_raw.json";

async function readJson(path, fallback) {
  try { return JSON.parse(await fs.readFile(path, "utf8")); } catch { return fallback; }
}

function rowLink(row) {
  return `- **${row.Company}** - [${row.Title}](${row.URL}) - ${row.Location || "Location not listed"}`;
}

function groupedRows(rows = []) {
  const grouped = new Map(regionOrder.map((r) => [r, []]));
  for (const row of rows) {
    const region = row.Region || "Remote / Unspecified";
    if (!grouped.has(region)) grouped.set(region, []);
    grouped.get(region).push(row);
  }
  return regionOrder.flatMap((region) => {
    const list = grouped.get(region) || [];
    return [`### ${region} (${list.length})`, "", list.length ? list.map(rowLink).join("\n") : "_None._", ""];
  });
}

const report = await readJson(reportPath, { generatedAt: new Date().toISOString(), currentScanAt: "unknown", currentRows: 0, added: [], removed: [] });
const raw = await readJson(rawPath, { rows: [], entryLevelRows: [], companies: [], careerPageScanTasks: [] });
const audit = await readJson("data/econ_roster_scan_audit.json", { counts: {} });
const counts = audit.counts || {};

const byCategory = {};
for (const row of raw.rows || []) byCategory[row.Category || "Uncategorised"] = (byCategory[row.Category || "Uncategorised"] || 0) + 1;

const lines = [
  "# ECS Latest Econ Consulting Scan",
  "",
  `Last updated: ${report.currentScanAt || report.generatedAt}`,
  "",
  "## Summary",
  "",
  `- Firms searched: ${(raw.companies || []).length || "unknown"}`,
  `- Career pages checked: ${(raw.careerPageScanTasks || []).length || "unknown"}`,
  `- Current internship roles: ${report.currentRows || (raw.rows || []).length}`,
  `- Entry-level analyst roles: ${(raw.entryLevelRows || []).length} ([list](econ_entry_level_roles.md))`,
  `- New stable job URLs since previous scan: ${(report.added || []).length}`,
  `- No longer present since previous scan: ${(report.removed || []).length}`,
  `- Firms with matching roles: ${counts["matching-role-found"] ?? "unknown"}`,
  `- Confirmed no open postings: ${counts["confirmed-no-open-postings"] ?? "unknown"}`,
  `- Openings but no matching role: ${counts["confirmed-openings-no-matching-role"] ?? "unknown"}`,
  `- Could not fully verify: ${counts["could-not-fully-verify"] ?? "unknown"}`,
  "",
  "## Internships By Practice Area",
  "",
  ...(Object.keys(byCategory).length ? Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([c, n]) => `- ${c}: ${n}`) : ["_None._"]),
  "",
  "## New Roles Since Previous Scan",
  "",
  ...groupedRows(report.added || []),
  "## No Longer Present",
  "",
  (report.removed || []).length ? report.removed.map(rowLink).join("\n") : "_None._",
  "",
  "## Full Reports",
  "",
  "- [Current full internship list](econ_internship_roles_scan_v2.md)",
  "- [Entry-level analyst roles](econ_entry_level_roles.md)",
  "- [New roles since previous scan](new_econ_roles_since_last_run.md)",
  "- [Current roles not in your tracker](current_econ_roles_not_in_tracker.md)",
  "- [Roster verification audit](econ_roster_scan_audit.md)",
  "- [Current full internship CSV](econ_internship_roles_scan_v2.csv)",
  "",
];
await fs.writeFile("reports/LATEST_ECON_SCAN.md", `${lines.join("\n")}\n`, "utf8");
console.log("wrote reports/LATEST_ECON_SCAN.md");
