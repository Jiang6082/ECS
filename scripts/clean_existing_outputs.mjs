// One-off migration (2026-10-03): re-applies the fixed title cleanup, econ-only filter and
// de-duplication to outputs produced by earlier scanner versions, then rebuilds every report.
// Safe to re-run; normal scans already produce clean output.
import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { parseCsv, toCsv } from "../tools/common.mjs";
import { cleanTitle } from "../tools/clean.mjs";
import { loadRoster } from "../tools/firms.mjs";
import { classifyRole } from "../tools/relevance.mjs";
import { groupedRoleMarkdown, regionForLocation } from "../tools/regions.mjs";

const { byName } = await loadRoster();
const readJson = async (p, f) => { try { return JSON.parse(await fs.readFile(p, "utf8")); } catch { return f; } };
const writeJson = (p, v) => fs.writeFile(p, `${JSON.stringify(v, null, 2)}\n`, "utf8");

// Older iCIMS parsing attached each job's location to the neighbouring job, so for those
// rows derive the location from the title (or leave it to the posting).
function fixLocation(row) {
  if (!/icims\.com/i.test(row.URL || "")) return row.Location || "";
  const t = row.Title;
  const city = t.match(/-\s*(Paris|London|Beijing|Brussels|Munich|Boston|Chicago|New York)\b/i)?.[1];
  if (city) return city;
  if (/Montr[eé]al|Toronto/i.test(t)) return "Montreal / Toronto";
  if (/Cornerstone/i.test(row.Company)) return row.Location || "";
  if (/^Summer (Analyst|Associate) Intern/i.test(t)) return "Multiple US offices";
  return "See posting";
}

function cleanRows(rows, { wantTrack } = {}) {
  const out = [];
  const seen = new Set();
  for (const r0 of rows || []) {
    const r = { ...r0, Title: cleanTitle(r0.Title || r0.title || "") };
    r.Location = fixLocation(r);
    const v = classifyRole({ Title: r.Title, Notes: r.Notes || "" }, byName.get(r.Company) || {});
    if (!v.track || (wantTrack && v.track !== wantTrack)) continue;
    const id = `${r.Company}\n${r.Title}\n${r.Location}`.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    r.Track = v.track;
    r.Region = regionForLocation(r.Location);
    out.push(r);
  }
  return out.sort((a, b) => a.Company.localeCompare(b.Company) || a.Title.localeCompare(b.Title));
}

// ---- v1 output ----
const v1Csv = parseCsv(await fs.readFile("reports/econ_internship_roles_scan.csv", "utf8").catch(() => ""));
const v1 = cleanRows(v1Csv);
await fs.writeFile("reports/econ_internship_roles_scan.csv", toCsv(v1, ["Company", "Category", "Track", "Title", "Location", "URL", "Source", "PostedAt", "Notes"]), "utf8");
const v1Raw = await readJson("data/econ_internship_scan_raw.json", null);
if (v1Raw) {
  for (const res of v1Raw.results || []) res.matches = cleanRows(res.matches);
  await writeJson("data/econ_internship_scan_raw.json", v1Raw);
  const ints = v1.filter((m) => m.Track === "Internship");
  const ent = v1.filter((m) => m.Track === "Entry-level");
  await fs.writeFile("reports/econ_internship_roles_scan.md", [
    "# Econ Consulting Internship Scan (v1: ATS boards)", "", `Scanned: ${v1Raw.scannedAt}`, `Internship roles: ${ints.length}`, `Entry-level analyst roles: ${ent.length}`, "",
    "## Internships", "", ints.map((m) => `- **${m.Company}** — [${m.Title}](${m.URL}) — ${m.Location || "Location not listed"} (${m.Source})`).join("\n") || "_None._", "",
    "## Entry-Level Analyst Roles", "", ent.map((m) => `- **${m.Company}** — [${m.Title}](${m.URL}) — ${m.Location || "Location not listed"} (${m.Source})`).join("\n") || "_None._", "",
  ].join("\n"), "utf8");
}

// ---- v2 output ----
const raw = await readJson("data/econ_internship_roles_scan_v2_raw.json", null);
const all = cleanRows([...(raw.rows || []), ...(raw.entryLevelRows || [])]);
raw.rows = all.filter((r) => r.Track === "Internship");
raw.entryLevelRows = all.filter((r) => r.Track === "Entry-level");
const withRows = new Set(raw.rows.map((r) => r.Company));
const dropped = new Set([...(raw.companies || [])].filter((c) => !withRows.has(c) && !(raw.companiesWithoutRows || []).includes(c)));
raw.companiesWithoutRows = (raw.companies || []).filter((c) => !withRows.has(c)).sort();
raw.confirmedNoMatchingRoles = [...new Set([...(raw.confirmedNoMatchingRoles || []), ...dropped])].filter((c) => !withRows.has(c)).sort();
raw.confirmedNoOpenPostings = (raw.confirmedNoOpenPostings || []).filter((c) => !withRows.has(c));
raw.couldNotFullyVerify = (raw.couldNotFullyVerify || []).filter((c) => !withRows.has(c) && !raw.confirmedNoMatchingRoles.includes(c));
raw.cleanedAt = new Date().toISOString();
await writeJson("data/econ_internship_roles_scan_v2_raw.json", raw);
const headers = ["Company", "Category", "Title", "Location", "Region", "URL", "Source", "Status", "PostedAt", "Notes"];
await fs.writeFile("reports/econ_internship_roles_scan_v2.csv", toCsv(raw.rows, headers), "utf8");
await fs.writeFile("reports/econ_entry_level_roles.csv", toCsv(raw.entryLevelRows, headers), "utf8");
await fs.writeFile("reports/econ_internship_roles_scan_v2.md", [
  "# Econ Consulting Internship Scan v2", "", `Scanned: ${raw.searchedAt}`, `Firms searched: ${raw.companies.length}`, `Career pages checked: ${(raw.careerPageScanTasks || []).length}`,
  `Internship roles retained: ${raw.rows.length}`, `Entry-level analyst roles (separate report): ${raw.entryLevelRows.length}`, "",
  "## Roles And Leads By Region", "", ...groupedRoleMarkdown(raw.rows),
  "## Confirmed: Enumerated Source Reports No Open Postings", "", raw.confirmedNoOpenPostings.map((c) => `- ${c}`).join("\n") || "_None._", "",
  "## Confirmed: Open Postings Exist, None Matched", "", raw.confirmedNoMatchingRoles.map((c) => `- ${c}`).join("\n") || "_None._", "",
  "## Unverified: Could Not Fully Enumerate", "", raw.couldNotFullyVerify.map((c) => `- ${c}`).join("\n") || "_None._", "",
].join("\n"), "utf8");
await fs.writeFile("reports/econ_entry_level_roles.md", ["# Entry-Level Econ Consulting Analyst Roles", "", `Scanned: ${raw.searchedAt}`, `Roles: ${raw.entryLevelRows.length}`, "",
  "Full-time analyst / research analyst / associate roles aimed at new graduates, found on the same official boards as the internship scan.", "", ...groupedRoleMarkdown(raw.entryLevelRows)].join("\n"), "utf8");

// ---- new-roles report ----
const nr = await readJson("data/new_econ_roles_since_last_run.json", null);
if (nr) {
  nr.added = cleanRows(nr.added, { wantTrack: "Internship" });
  nr.removed = cleanRows(nr.removed);
  nr.currentRows = raw.rows.length;
  await writeJson("data/new_econ_roles_since_last_run.json", nr);
  await fs.writeFile("reports/new_econ_roles_since_last_run.md", [
    "# New Econ Consulting Roles Since Last Run", "", `Previous scan: ${nr.previousScanAt}`, `Current scan: ${nr.currentScanAt}`, `Current rows: ${nr.currentRows}`,
    `New stable job URLs: ${nr.added.length}`, `No longer present: ${nr.removed.length}`, "", "## New Roles By Region", "", ...groupedRoleMarkdown(nr.added),
    "## No Longer Present", "", nr.removed.length ? nr.removed.map((r) => `- **${r.Company}** - [${r.Title}](${r.URL})`).join("\n") : "_None._", "",
  ].join("\n"), "utf8");
}

// ---- roles not in tracker ----
const tracker = parseCsv(await fs.readFile("inputs/internship_tracker.csv", "utf8").catch(() => ""));
const loose = (u = "") => u.toLowerCase().replace(/[?#].*$/, "").replace(/\/$/, "");
const trackerUrls = new Set(tracker.map((r) => loose(r.URL)).filter(Boolean));
const notInTracker = raw.rows.filter((r) => !trackerUrls.has(loose(r.URL)));
await writeJson("data/current_econ_roles_not_in_tracker.json", { generatedAt: new Date().toISOString(), currentScanAt: raw.searchedAt, historicalTrackerUrls: trackerUrls.size, roles: notInTracker });
await fs.writeFile("reports/current_econ_roles_not_in_tracker.md", ["# Current Econ Consulting Roles Not In Your Tracker", "", `Current scan: ${raw.searchedAt}`, `Tracker URLs: ${trackerUrls.size}`,
  `Current roles absent from tracker: ${notInTracker.length}`, "", "These roles are not in inputs/internship_tracker.csv (add URLs there as you apply). They are not necessarily newly posted.", "", ...groupedRoleMarkdown(notInTracker)].join("\n"), "utf8");

// ---- closed history: clean titles, drop non-econ roles and duplicates ----
// Older scans read at most 40 jobs from large Workday sites, so roles beyond that cut-off
// looked "closed". Drop closures from Workday sites that returned exactly 40 jobs.
const v1Audit = await readJson("data/econ_internship_scan_audit.json", { companyAudits: [] });
const capped = new Set(v1Audit.companyAudits.flatMap((a) => (a.resolvedBoards || [])
  .filter((b) => /^Workday:/.test(b.source) && b.count === 40).map((b) => b.source.slice(8).toLowerCase())));
const workdayBoard = (u = "") => { const m = u.match(/https:\/\/([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/]+)\//i); return m ? `${m[1]}/${m[2]}`.toLowerCase() : ""; };
const closed = (await readJson("data/closed_roles_history.json", [])).filter((e) => !capped.has(workdayBoard(e.URL)));
const seenClosed = new Set();
const closedClean = closed.map((e) => ({ ...e, Title: cleanTitle(e.Title) }))
  .filter((e) => classifyRole({ Title: e.Title }, byName.get(e.Company) || {}).track)
  .filter((e) => { const k = `${e.Company}\n${e.Title}\n${e.Location}`.toLowerCase(); if (seenClosed.has(k)) return false; seenClosed.add(k); return true; });
await writeJson("data/closed_roles_history.json", closedClean);
const byDay = new Map();
for (const e of closedClean) { const d = String(e.detectedClosedAt).slice(0, 10); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(e); }
await fs.writeFile("reports/closed_roles_history.md", ["# Closed / Removed Roles History", "", `Total closures recorded: ${closedClean.length}`, `Last updated: ${raw.searchedAt}`, "",
  "Each role below was present in an earlier scan and absent in a later one. \"Detected closed\" is the first scan that no longer saw the posting.", "", "## Closures By Date Detected", "",
  ...[...byDay.keys()].sort((a, b) => b.localeCompare(a)).flatMap((d) => [`### ${d} (${byDay.get(d).length})`, "", ...byDay.get(d).map((e) => `- **${e.Company}** - [${e.Title}](${e.URL})${e.Location ? ` - ${e.Location}` : ""}${e.reopenedAt ? ` — _reopened ${String(e.reopenedAt).slice(0, 10)}_` : ""}`), ""])].join("\n"), "utf8");

for (const script of ["build_econ_roster_scan_audit.mjs", "build_verified_roles.mjs", "build_scan_dashboard.mjs", "build-readme.mjs"]) {
  const r = spawnSync(process.execPath, [`scripts/${script}`], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status || 1);
}
console.log(`cleaned: internships=${raw.rows.length} entry=${raw.entryLevelRows.length} new=${nr?.added.length ?? 0} closedHistory=${closedClean.length}`);
