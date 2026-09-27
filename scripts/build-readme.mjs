// Regenerates README.md from the latest scan outputs. Wired into the scan
// pipeline (run-econ-scan.mjs) so the README refreshes on every v2/all run,
// on any machine. Self-locating: resolves the repo root from its own path.
import fs from 'node:fs';
import path from 'node:path';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const csvPath = path.join(repo, 'reports/econ_internship_roles_scan_v2.csv');
const newPath = path.join(repo, 'data/new_econ_roles_since_last_run.json');
const scanPath = path.join(repo, 'reports/LATEST_ECON_SCAN.md');
const closedPath = path.join(repo, 'data/closed_roles_history.json');

let closedCount = 0;
try {
  const closed = JSON.parse(fs.readFileSync(closedPath, 'utf8'));
  if (Array.isArray(closed)) closedCount = closed.length;
} catch {}

// --- tiny CSV parser (handles quoted fields) ---
function parseCSV(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

let csvRaw = 'Company,Title,Location,Region,URL,Status\n';
let hasScan = true;
try { csvRaw = fs.readFileSync(csvPath, 'utf8'); } catch { hasScan = false; }
const rows = parseCSV(csvRaw).filter(r => r.length > 1);
const header = rows.shift();
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const roles = rows.map(r => ({
  Company: r[idx.Company],
  Title: r[idx.Title],
  Location: (r[idx.Location] || '').trim(),
  Region: r[idx.Region],
  URL: r[idx.URL],
  Status: r[idx.Status],
}));

let newData = { added: [] };
try { newData = JSON.parse(fs.readFileSync(newPath, 'utf8')); } catch {}
let entryCount = 0;
let firmCount = 0;
try {
  const raw = JSON.parse(fs.readFileSync(path.join(repo, 'data/econ_internship_roles_scan_v2_raw.json'), 'utf8'));
  entryCount = (raw.entryLevelRows || []).length;
  firmCount = (raw.companies || []).length;
} catch {}
if (!firmCount) {
  try { firmCount = JSON.parse(fs.readFileSync(path.join(repo, 'inputs/econ_firm_roster.json'), 'utf8')).companies.length; } catch {}
}
const added = newData.added || [];

// scan date — from the dashboard if present, else the report's own timestamp
let scanDate;
try {
  const scanMd = fs.readFileSync(scanPath, 'utf8');
  const m = scanMd.match(/Last updated:\s*(\S+)/);
  scanDate = (m ? m[1] : (newData.currentScanAt || new Date().toISOString())).slice(0, 10);
} catch {
  scanDate = (newData.currentScanAt || new Date().toISOString()).slice(0, 10);
}

const REGION_ORDER = [
  'North America',
  'Europe',
  'Asia',
  'Oceania',
  'Middle East',
  'South America',
  'Africa',
  'Global / Multiple Regions',
  'Remote / Unspecified',
];
function regionKey(r) {
  if (!r) return 'Remote / Unspecified';
  if (REGION_ORDER.includes(r)) return r;
  const low = r.toLowerCase();
  if (low.includes('multi') || low.includes('global')) return 'Global / Multiple Regions';
  if (low.includes('remote') || low.includes('unspec')) return 'Remote / Unspecified';
  return r;
}

function esc(s) { return (s || '').replace(/\|/g, '\\|'); }
function roleLine(role) {
  const loc = role.Location ? ` — ${esc(role.Location)}` : '';
  const verify = /verify/i.test(role.Status || '') ? ' _(verify)_' : '';
  return `- **${esc(role.Company)}** — [${esc(role.Title)}](${role.URL})${loc}${verify}`;
}

let out = '';
out += `# ECS — Economic Consulting Internship Scanner\n\n`;
out += `Automated scan of economic-consulting internships — litigation & antitrust economics, competition & regulatory, policy research, energy, transfer pricing & valuation, Big-4 economics practices, and health economics / HEOR — across a `;
out += `**${firmCount || '230+'}-firm universe**. `;
out += `GitHub is the shared source of truth — pull the repo, run the scan, and everyone sees the same latest roles.\n\n`;
out += hasScan ? '' : `> **No scan has been run yet.** Run \`npm run scan:all\` (or trigger the GitHub Action) to populate the role lists below.\n\n`;
if (hasScan) out += `> **Last scan:** ${scanDate} &nbsp;•&nbsp; **${roles.length} open internships** &nbsp;•&nbsp; **${added.length} new today**${entryCount ? ` &nbsp;•&nbsp; **${entryCount} entry-level analyst roles** ([list](reports/econ_entry_level_roles.md))` : ''}${closedCount ? ` &nbsp;•&nbsp; **${closedCount} closed** ([history](reports/closed_roles_history.md))` : ''}\n\n`;
if (fs.existsSync(path.join(repo, 'reports/VERIFIED_OPEN_ROLES.md'))) out += `> ✅ **[Verified open roles list](reports/VERIFIED_OPEN_ROLES.md)** — hand-checked status (open / likely open / closed) with title + link for every role found ([CSV](reports/VERIFIED_OPEN_ROLES.csv)).\n\n`;
out += `**Jump to:** [🆕 New Roles Released Today](#-new-roles-released-today) · [📋 All Roles Available](#-all-roles-available) · [How to Run](#how-to-run)\n\n`;
out += `---\n\n`;

// --- Section 1: New today ---
out += `## 🆕 New Roles Released Today\n\n`;
out += `_Scan date: ${scanDate}_\n\n`;
if (added.length === 0) {
  out += `_No new roles detected in the latest scan._\n\n`;
} else {
  out += `**${added.length}** new stable job posting${added.length === 1 ? '' : 's'} since the previous scan:\n\n`;
  const byRegionNew = {};
  for (const r of added) {
    const k = regionKey(r.Region);
    (byRegionNew[k] ||= []).push(r);
  }
  const regionsNew = REGION_ORDER.filter(r => byRegionNew[r]);
  for (const region of regionsNew) {
    out += `**${region}**\n\n`;
    for (const role of byRegionNew[region].sort((a, b) => a.Company.localeCompare(b.Company) || a.Title.localeCompare(b.Title))) {
      out += roleLine(role) + '\n';
    }
    out += '\n';
  }
}
out += `---\n\n`;

// --- Section 2: All roles ---
out += `## 📋 All Roles Available\n\n`;
out += `**${roles.length}** open internship roles, grouped by region. Click a title to open the posting. Rows marked _(verify)_ are web-discovered leads rather than direct ATS postings.\n\n`;

const byRegion = {};
for (const r of roles) {
  const k = regionKey(r.Region);
  (byRegion[k] ||= []).push(r);
}
const regions = REGION_ORDER.filter(r => byRegion[r]);
out += `**Regions:** `;
out += regions.map(r => {
  // GitHub slug: lowercase, drop non-word/space/hyphen, then each space -> one hyphen (no collapse)
  const anchor = r.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/ /g, '-');
  return `[${r} (${byRegion[r].length})](#${anchor})`;
}).join(' · ');
out += `\n\n`;

for (const region of regions) {
  const list = byRegion[region].slice().sort(
    (a, b) => a.Company.localeCompare(b.Company) || a.Title.localeCompare(b.Title)
  );
  out += `### ${region}\n\n`;
  out += `<details>\n<summary><strong>${list.length} role${list.length === 1 ? '' : 's'}</strong> — click to expand</summary>\n\n`;
  for (const role of list) {
    out += roleLine(role) + '\n';
  }
  out += `\n</details>\n\n`;
}
out += `---\n\n`;

// --- Firm universe ---
try {
  const roster = JSON.parse(fs.readFileSync(path.join(repo, 'inputs/econ_firm_roster.json'), 'utf8'));
  const byCat = {};
  for (const c of roster.companies) (byCat[c.category || 'Other'] ||= []).push(c.name);
  out += `## Firm Universe\n\n`;
  out += `${roster.companies.length} firms across ${Object.keys(byCat).length} practice areas. Edit [inputs/econ_firm_roster.json](inputs/econ_firm_roster.json) to add more.\n\n`;
  for (const cat of (roster.categories || Object.keys(byCat)).filter((c) => byCat[c])) {
    out += `<details>\n<summary><strong>${cat}</strong> (${byCat[cat].length})</summary>\n\n`;
    out += byCat[cat].slice().sort((a, b) => a.localeCompare(b)).join(' · ') + '\n\n</details>\n\n';
  }
  out += `---\n\n`;
} catch {}

// --- Operational docs ---
out += `## How to Run\n\n`;
out += `Requires **Node.js 18+** (no dependencies). From the repo folder:\n\n`;
out += '```bash\n';
out += 'npm run scan:all          # full workflow (v1 ATS boards + v2 career pages/web leads + reports + README)\n';
out += 'npm run scan:v1           # known + guessed ATS boards only\n';
out += 'npm run scan:v2           # v1 + saved career pages, custom-ATS snapshots, web-discovered leads\n';
out += 'npm run scan:all:publish  # scan, rebuild reports, commit, and push to GitHub\n';
out += 'npm run report:new -- --days=3   # roles released in the last 3 days (by ATS publish date)\n';
out += '```\n\n';
out += `**Scan modes:** \`v1\` (ATS boards) · \`v2\` (ATS + career pages + web leads) · \`all\` (same as v2, the full workflow).\n\n`;
out += `### Normal workflow on any machine\n\n`;
out += '```bash\n';
out += 'git pull\n';
out += 'npm run scan:all:publish\n';
out += '```\n\n';
out += `Every \`v2\`/\`all\` run rebuilds [reports/LATEST_ECON_SCAN.md](reports/LATEST_ECON_SCAN.md) and this README. The publish step commits changed reports and pushes to \`origin\` (needs \`gh auth login\`). To publish already-generated changes without scanning, run \`npm run publish\`.\n\n`;
out += `### Scheduled scans on GitHub Actions\n\n`;
out += `[.github/workflows/scan.yml](.github/workflows/scan.yml) runs \`npm run scan:all:publish\` every morning (and on demand from the Actions tab), caching \`.scan-state/\` between runs so new/closed-role detection keeps working.\n\n`;

out += `## Repo Layout\n\n`;
out += `- **Root** — \`README.md\`, \`package.json\`, \`.gitignore\`.\n`;
out += `- **[scripts/](scripts/)** — scanner pipeline (\`run-econ-scan.mjs\` orchestrates everything).\n`;
out += `- **[tools/](tools/)** — shared modules: ATS collectors, ATS detection, role filter, regions.\n`;
out += `- **[inputs/](inputs/)** — hand-maintained data: firm roster, verified ATS boards, career-page database, your application tracker.\n`;
out += `- **[reports/](reports/)** — human-readable generated reports incl. the [LATEST_ECON_SCAN.md](reports/LATEST_ECON_SCAN.md) dashboard.\n`;
out += `- **[data/](data/)** — machine-readable raw/audit JSON artifacts.\n`;
out += `- **[custom-ats-watch/](custom-ats-watch/)** — firms whose careers sites need a real browser (Avature, Radancy, viRecruit, email-only, …).\n\n`;
out += `### Key Files\n\n`;
out += `| File | What it is |\n|------|-----------|\n`;
out += `| [reports/LATEST_ECON_SCAN.md](reports/LATEST_ECON_SCAN.md) | Latest scan summary + newest roles |\n`;
out += `| [reports/VERIFIED_OPEN_ROLES.md](reports/VERIFIED_OPEN_ROLES.md) | Hand-verified role status list (title + link) |\n`;
out += `| [reports/econ_internship_roles_scan_v2.md](reports/econ_internship_roles_scan_v2.md) | Full current internship list (detailed, with coverage status per firm) |\n`;
out += `| [reports/econ_internship_roles_scan_v2.csv](reports/econ_internship_roles_scan_v2.csv) | Full current internship list (spreadsheet) |\n`;
out += `| [reports/econ_entry_level_roles.md](reports/econ_entry_level_roles.md) | Entry-level analyst roles found on the same boards |\n`;
out += `| [reports/new_econ_roles_since_last_run.md](reports/new_econ_roles_since_last_run.md) | New stable job URLs, grouped by region |\n`;
out += `| [reports/current_econ_roles_not_in_tracker.md](reports/current_econ_roles_not_in_tracker.md) | Current roles absent from your application tracker |\n`;
out += `| [reports/econ_roster_scan_audit.md](reports/econ_roster_scan_audit.md) | Every firm split into confirmed vs. unverifiable states |\n`;
out += `| [reports/closed_roles_history.md](reports/closed_roles_history.md) | Archive of roles that have closed, grouped by date detected (${closedCount} so far) |\n`;
out += `| [inputs/econ_firm_roster.json](inputs/econ_firm_roster.json) | The firm universe, practice-area category, and per-firm scope filter |\n`;
out += `| [inputs/ats_seeds.json](inputs/ats_seeds.json) | Verified ATS boards (Greenhouse, Lever, Workday, iCIMS, Workable, Personio, Teamtailor, Pinpoint, Paylocity, Oracle, …) |\n`;
out += `| [inputs/company_career_pages.json](inputs/company_career_pages.json) | Career-page database (auto-extended by discovery) |\n`;
out += `| [inputs/internship_tracker.csv](inputs/internship_tracker.csv) | Your applications — add URLs here to hide them from the "not in tracker" report |\n\n`;
out += `### Adding a firm\n\n`;
out += `1. Add it to \`inputs/econ_firm_roster.json\` with a \`category\` and \`scope\` (\`all\` for pure econ firms; \`econ\` or a regex for multi-practice firms).\n`;
out += `2. If you know its board, add it to \`inputs/ats_seeds.json\`; otherwise add its careers URL to \`inputs/company_career_pages.json\` and the scanner will find the board.\n\n`;
out += `Generated outputs are intentionally tracked so every clone shares the same baseline. The committed \`data/econ_internship_roles_scan_v2_raw.json\` is the cross-device baseline for the next comparison.\n`;

fs.writeFileSync(path.join(repo, 'README.md'), out);
console.log(`wrote README.md (roles=${roles.length}, new=${added.length}, closed=${closedCount})`);
