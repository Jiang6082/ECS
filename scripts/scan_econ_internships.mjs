// ECS v1 scan: enumerate every known / guessable ATS board for the econ-consulting
// firm universe and keep internship (and entry-level analyst) roles.
//
//   inputs/econ_firm_roster.json  -> firm universe + per-firm scope
//   inputs/ats_seeds.json         -> hand-verified ATS boards
//   + guessed Greenhouse / Lever / Ashby slugs from the firm name
//
// Writes reports/econ_internship_roles_scan.{csv,md} and data/econ_internship_scan_{raw,audit}.json
import fs from "node:fs/promises";
import { fetchJson, mapLimit, toCsv } from "../tools/common.mjs";
import { ashby, collectorTasks, greenhouse, lever, seedKey } from "../tools/collectors.mjs";
import { generatedTokens, loadRoster, loadSeeds } from "../tools/firms.mjs";
import { classifyRole, internshipTiming } from "../tools/relevance.mjs";

const { firms } = await loadRoster();
const seeds = await loadSeeds();

function normalizeName(value = "") {
  return value.toLowerCase().replace(/&/g, "and").replace(/\(.*?\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

// A guessed Greenhouse slug only counts if the board's display name resembles the firm.
async function greenhouseBoardMatches(firm, token) {
  const meta = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${token}`);
  if (!meta?.name) return false;
  const board = normalizeName(meta.name).replace(/\s+/g, "");
  const words = normalizeName(firm.name).split(" ").filter((w) => w.length > 2 && !["the", "and", "group", "economics", "economic", "consulting", "associates"].includes(w));
  return words.some((w) => board.includes(w));
}

async function scanFirm(firm) {
  const firmSeeds = seeds[firm.name] || {};
  const tasks = collectorTasks(firm.name, firmSeeds).map((t) => ({ ...t, origin: "seeded" }));
  const seededKeys = new Set(tasks.map((t) => seedKey(t.key, t.value)));
  for (const token of generatedTokens(firm.name)) {
    if (!seededKeys.has(seedKey("greenhouse", token))) {
      tasks.push({ key: "greenhouse", value: token, origin: "guessed", run: async () => ((await greenhouseBoardMatches(firm, token)) ? greenhouse(firm.name, token) : null) });
    }
    if (!seededKeys.has(seedKey("lever", token))) tasks.push({ key: "lever", value: token, origin: "guessed", run: () => lever(firm.name, token) });
    if (!seededKeys.has(seedKey("ashby", token))) tasks.push({ key: "ashby", value: token, origin: "guessed", run: () => ashby(firm.name, token) });
  }

  const outcomes = await Promise.all(tasks.map((task) => task.run().catch(() => null)));
  const boards = [];
  outcomes.forEach((result, i) => {
    const task = tasks[i];
    if (result) boards.push({ ...result, origin: task.origin });
    else if (task.origin === "seeded") boards.push({ source: `${task.key}:${typeof task.value === "string" ? task.value : `${task.value.host}/${task.value.site}`}`, jobs: null, origin: "seeded", failed: true });
  });

  const seen = new Set();
  const matches = [];
  const rejected = {};
  for (const board of boards.filter((b) => b.jobs)) {
    for (const j of board.jobs) {
      if (!j.URL || seen.has(j.URL)) continue;
      seen.add(j.URL);
      const verdict = classifyRole({ ...j, Notes: j.Content }, firm);
      if (!verdict.track) { rejected[verdict.reason] = (rejected[verdict.reason] || 0) + 1; continue; }
      matches.push({
        Company: firm.name,
        Category: firm.category,
        Track: verdict.track,
        Title: j.Title,
        Location: j.Location,
        URL: j.URL,
        Source: `Official ATS ${j.Source}`,
        PostedAt: j.PostedAt,
        Notes: internshipTiming(j.Title, j.Content),
      });
    }
  }
  return {
    company: firm.name,
    category: firm.category,
    boards: boards.map((b) => ({ source: b.source, origin: b.origin, ok: !b.failed, count: b.jobs ? b.jobs.length : 0 })),
    jobsSeen: boards.reduce((n, b) => n + (b.jobs?.length || 0), 0),
    rejected,
    matches,
  };
}

const scannedAt = new Date().toISOString();
const results = await mapLimit(firms, 10, scanFirm, "firms scanned");

const byUrl = new Map();
for (const m of results.flatMap((r) => r.matches)) if (!byUrl.has(m.URL)) byUrl.set(m.URL, m);
const matches = [...byUrl.values()].sort((a, b) => a.Company.localeCompare(b.Company) || a.Title.localeCompare(b.Title));
const internships = matches.filter((m) => m.Track === "Internship");
const entry = matches.filter((m) => m.Track === "Entry-level");

const headers = ["Company", "Category", "Track", "Title", "Location", "URL", "Source", "PostedAt", "Notes"];
await fs.mkdir("reports", { recursive: true });
await fs.mkdir("data", { recursive: true });
await fs.writeFile("reports/econ_internship_roles_scan.csv", toCsv(matches, headers), "utf8");

const withBoards = results.filter((r) => r.boards.some((b) => b.ok));
const md = [
  "# Econ Consulting Internship Scan (v1: ATS boards)",
  "",
  `Scanned: ${scannedAt}`,
  `Firms in universe: ${firms.length}`,
  `Firms with at least one live ATS board: ${withBoards.length}`,
  `Internship roles: ${internships.length}`,
  `Entry-level analyst roles: ${entry.length}`,
  "",
  "Criteria: open posting on an official ATS board; internship / summer analyst / summer associate / placement wording; economics-consulting function (large multi-practice firms must also match an economics, disputes, transfer-pricing, policy or HEOR keyword); excludes PhD/MBA/JD-only, recruiting events, and titles dated for past cycles.",
  "",
  "## Internships",
  "",
  internships.length ? internships.map((m) => `- **${m.Company}** — [${m.Title}](${m.URL}) — ${m.Location || "Location not listed"} (${m.Source}; ${m.Notes})`).join("\n") : "_None found by the ATS scan._",
  "",
  "## Entry-Level Analyst Roles",
  "",
  entry.length ? entry.map((m) => `- **${m.Company}** — [${m.Title}](${m.URL}) — ${m.Location || "Location not listed"} (${m.Source})`).join("\n") : "_None._",
  "",
  "## Firms Without A Live ATS Board (v1)",
  "",
  results.filter((r) => !r.boards.some((b) => b.ok)).map((r) => `- ${r.company}`).join("\n") || "_None._",
  "",
].join("\n");
await fs.writeFile("reports/econ_internship_roles_scan.md", md, "utf8");
await fs.writeFile("data/econ_internship_scan_raw.json", JSON.stringify({ scannedAt, results }, null, 2), "utf8");
await fs.writeFile("data/econ_internship_scan_audit.json", JSON.stringify({
  scannedAt,
  companies: firms.map((f) => f.name),
  companyAudits: results.map((r) => ({
    company: r.company,
    category: r.category,
    resolvedBoards: r.boards.filter((b) => b.ok),
    failedSeededBoards: r.boards.filter((b) => !b.ok).map((b) => b.source),
    jobsSeen: r.jobsSeen,
    relevantInternships: r.matches.filter((m) => m.Track === "Internship").length,
    entryLevelRoles: r.matches.filter((m) => m.Track === "Entry-level").length,
    rejectedByReason: r.rejected,
  })),
}, null, 2), "utf8");

console.log(`firms=${firms.length} liveBoards=${withBoards.length} internships=${internships.length} entryLevel=${entry.length}`);
console.log("wrote econ_internship_roles_scan.csv, econ_internship_roles_scan.md, econ_internship_scan_raw.json, econ_internship_scan_audit.json");
