// Builds reports/VERIFIED_OPEN_ROLES.{md,csv}: one clean list of every currently open
// econ-consulting internship (title + link), combining
//   1. roles confirmed live on an official ATS in the latest scan, and
//   2. hand-checked roles from inputs/manual_verified_roles.json for sites the scanner
//      cannot read (custom portals, email-only, JS-only boards),
// plus roles that closed in the last 14 days.
import fs from "node:fs/promises";
import { toCsv } from "../tools/common.mjs";
import { regionForLocation } from "../tools/regions.mjs";
import { classifyRole } from "../tools/relevance.mjs";
import { loadRoster } from "../tools/firms.mjs";

async function readJson(path, fallback) {
  try { return JSON.parse(await fs.readFile(path, "utf8")); } catch { return fallback; }
}

const raw = await readJson("data/econ_internship_roles_scan_v2_raw.json", { rows: [], entryLevelRows: [], searchedAt: "" });
const manual = await readJson("inputs/manual_verified_roles.json", { roles: [], firmNotes: {} });
const closed = await readJson("data/closed_roles_history.json", []);
const scanAt = raw.searchedAt || new Date().toISOString();
const scanDay = scanAt.slice(0, 10);
const esc = (v) => String(v ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

const confirmed = (raw.rows || []).filter((r) => /confirmed official/i.test(r.Status || ""));
const leads = (raw.rows || []).filter((r) => !/confirmed official/i.test(r.Status || ""));
const liveUrls = new Set((raw.rows || []).map((r) => (r.URL || "").toLowerCase()));
const liveTitles = new Set((raw.rows || []).map((r) => `${r.Company}\n${r.Title}`.toLowerCase()));
const manualRows = (manual.roles || []).filter((m) => !liveUrls.has((m.url || "").toLowerCase()) && !liveTitles.has(`${m.company}\n${m.title}`.toLowerCase()));
const { byName } = await loadRoster();
const displayLocation = (loc) => (/^\d+ Locations?$/i.test(String(loc).trim()) ? "Multiple locations" : esc(loc));

const byFirm = new Map();
for (const r of confirmed) {
  if (!byFirm.has(r.Company)) byFirm.set(r.Company, []);
  byFirm.get(r.Company).push(r);
}
const firms = [...byFirm.keys()].sort((a, b) => a.localeCompare(b));

const cutoff = new Date(Date.parse(scanAt) - 14 * 864e5).toISOString();
const closedSeen = new Set();
const recentlyClosed = (Array.isArray(closed) ? closed : [])
  .filter((c) => !c.reopenedAt && String(c.detectedClosedAt) >= cutoff)
  .filter((c) => c.Track !== "Entry-level" && classifyRole({ Title: c.Title }, byName.get(c.Company) || {}).track === "Internship")
  .filter((c) => { const k = `${c.Company}\n${c.Title}\n${c.Location}`.toLowerCase(); if (closedSeen.has(k)) return false; closedSeen.add(k); return true; })
  .sort((a, b) => String(b.detectedClosedAt).localeCompare(String(a.detectedClosedAt)));

const lines = [
  "# Open Econ Consulting Internships",
  "",
  `**Last scan:** ${scanAt.replace("T", " ").slice(0, 16)} UTC · **${confirmed.length} roles confirmed live on official job boards** across ${firms.length} firms · **${manualRows.length} hand-checked roles** on sites the scanner can't read`,
  "",
  "Every role below is economics-consulting work (litigation & antitrust economics, competition, damages, transfer pricing economics, regulatory/policy, energy economics, health economics). Technology, construction, engineering, forensic accounting, restructuring and strategy-only roles are filtered out.",
  "",
  "- **Confirmed live** = returned by the firm's own applicant-tracking system during the scan above. Updated automatically every day.",
  "- **Hand-checked** = sites without a machine-readable job board; status as of the date shown.",
  "",
  `## ✅ Confirmed Live On Official Job Boards (${confirmed.length})`,
  "",
];
for (const firm of firms) {
  const list = byFirm.get(firm).sort((a, b) => a.Title.localeCompare(b.Title));
  lines.push(`### ${firm} (${list.length})`, "");
  if (manual.firmNotes?.[firm]) lines.push(`_${manual.firmNotes[firm]}_`, "");
  lines.push("| Role | Location | Region |", "|---|---|---|");
  for (const r of list) lines.push(`| [${esc(r.Title)}](${r.URL}) | ${displayLocation(r.Location) || "See posting"} | ${r.Region || regionForLocation(r.Location)} |`);
  lines.push("");
}
lines.push(`## 🟡 Hand-Checked Roles (${manualRows.length})`, "", "| Firm | Role | Location | Status | Checked | Notes |", "|---|---|---|---|---|---|");
for (const m of manualRows) lines.push(`| ${esc(m.company)} | [${esc(m.title)}](${m.url}) | ${esc(m.location)} | ${esc(m.status)} | ${m.checkedAt} | ${esc(m.note)} |`);
lines.push("");
if (leads.length) {
  lines.push(`## 🔎 Web-Discovered Leads — Verify Before Applying (${leads.length})`, "", "| Firm | Role | Source |", "|---|---|---|");
  for (const r of leads) lines.push(`| ${esc(r.Company)} | [${esc(r.Title)}](${r.URL}) | ${esc(r.Status)} |`);
  lines.push("");
}
lines.push(`## Entry-Level (Full-Time 2027) Analyst Roles`, "", `${(raw.entryLevelRows || []).length} full-time analyst/associate roles for 2027 graduates are listed separately in [econ_entry_level_roles.md](econ_entry_level_roles.md).`, "");
lines.push(`## ⛔ Closed In The Last 14 Days (${recentlyClosed.length})`, "");
lines.push(recentlyClosed.length
  ? ["| Firm | Role | Detected closed |", "|---|---|---|", ...recentlyClosed.map((c) => `| ${esc(c.Company)} | [${esc(c.Title)}](${c.URL}) | ${String(c.detectedClosedAt).slice(0, 10)} |`)].join("\n")
  : "_None._");
lines.push("", `_Generated by ECS on ${scanDay}. Full detail: [econ_internship_roles_scan_v2.md](econ_internship_roles_scan_v2.md) · [CSV](VERIFIED_OPEN_ROLES.csv)_`, "");
await fs.writeFile("reports/VERIFIED_OPEN_ROLES.md", lines.join("\n"), "utf8");

const csvRows = [
  ...confirmed.map((r) => ({ Status: "Confirmed live (official ATS)", Company: r.Company, Title: r.Title, URL: r.URL, Location: r.Location, Checked: scanDay, Notes: manual.firmNotes?.[r.Company] || "" })),
  ...manualRows.map((m) => ({ Status: `Hand-checked: ${m.status}`, Company: m.company, Title: m.title, URL: m.url, Location: m.location, Checked: m.checkedAt, Notes: m.note })),
  ...leads.map((r) => ({ Status: r.Status, Company: r.Company, Title: r.Title, URL: r.URL, Location: r.Location, Checked: scanDay, Notes: "" })),
];
await fs.writeFile("reports/VERIFIED_OPEN_ROLES.csv", toCsv(csvRows, ["Status", "Company", "Title", "URL", "Location", "Checked", "Notes"]), "utf8");
console.log(`verified roles: confirmed=${confirmed.length} handChecked=${manualRows.length} leads=${leads.length} recentlyClosed=${recentlyClosed.length}`);
