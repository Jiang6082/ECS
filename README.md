# ECS — Economic Consulting Internship Scanner

Automated scan of economic-consulting internships — litigation & antitrust economics, competition & regulatory, policy research, energy, transfer pricing & valuation, Big-4 economics practices, and health economics / HEOR — across a **232-firm universe**. GitHub is the shared source of truth — pull the repo, run the scan, and everyone sees the same latest roles.

> **No scan has been run yet.** Run `npm run scan:all` (or trigger the GitHub Action) to populate the role lists below.

**Jump to:** [🆕 New Roles Released Today](#-new-roles-released-today) · [📋 All Roles Available](#-all-roles-available) · [How to Run](#how-to-run)

---

## 🆕 New Roles Released Today

_Scan date: 2026-09-27_

_No new roles detected in the latest scan._

---

## 📋 All Roles Available

**0** open internship roles, grouped by region. Click a title to open the posting. Rows marked _(verify)_ are web-discovered leads rather than direct ATS postings.

**Regions:** 

---

## Firm Universe

232 firms across 9 practice areas. Edit [inputs/econ_firm_roster.json](inputs/econ_firm_roster.json) to add more.

<details>
<summary><strong>Litigation, Antitrust & Damages</strong> (64)</summary>

AlixPartners · Analysis & Inference · Analysis Group · Ankura · Applied Economics Consulting Group · ARPC · Ashenfelter & Ashmore · Bates Group · Bates White · Berkeley Research Group · BLDS · Capital Trade · Charles River Associates · Christensen Associates · Coherent Economics · Compass Lexecon · Cornerstone Research · Crowninshield Financial Research · DCI Consulting Group · Econ One · Economic Consulting Services · Economists Incorporated · Edgeworth Economics · Empiris · EmployStats · Epsilon Economics · ERS Group · Fideres · Finnerty Economic Consulting · FTI Consulting (Economic Consulting) · Georgetown Economic Services · Global Economics Group · Gnarus Advisors · Greylock McKinnon Associates · Guidehouse · Hemming Morse · HKA · Houlihan Lokey (Dispute Resolution Consulting) · Integra FEC · Intensity · Invotex · J.S. Held · Keystone Strategy · LitiNomics · Market Platform Dynamics · MiCRA · Micronomics · Monument Economics Group · Nathan Associates · NERA Economic Consulting · OnPoint Analytics · Pinnacle Economics · Precision Economics · Quadrant Economics · Quantitative Economic Solutions · Resolution Economics · Secretariat · Stanford Consulting Group · Summit Consulting · The Brattle Group · The Kenrich Group · Vega Economics · Vocational Economics · Welch Consulting

</details>

<details>
<summary><strong>Competition & Regulatory (Europe)</strong> (49)</summary>

Accuracy · Afi · Aldwych Partners · Analysys Mason · BAK Economics · BiGGAR Economics · Cambridge Econometrics · CEPA · Copenhagen Economics · Decisio · DICE Consult · DIW Econ · DKM Economic Consultants · DotEcon · E.CA Economics · Economic Consulting Associates · Economic Insight · Ecoplan · Ecorys · Europe Economics · First Economics · Frontier Economics · Indecon · Indepen · INFRAS · Lear · Lexonomics · London Economics · Menon Economics · Metro Dynamics · Oslo Economics · Oxera · Perspective Economics · Plum Consulting · Polynomics · Prognos · Prometeia · Ramboll Management Consulting · RBB Economics · Reckon LLP · SEO Amsterdam Economics · SQW · Steer · Swiss Economics · Technopolis Group · Vista Analyse · Vivid Economics (McKinsey) · Volterra Partners · WIK-Consult

</details>

<details>
<summary><strong>Economic Consulting (APAC)</strong> (20)</summary>

ACIL Allen · Asia Competition Associates · Axiom Economics · BERL · Castalia · CEG (Competition Economists Group) · Deloitte Access Economics · Frontier Economics Australia · HoustonKemp · Incenta Economic Consulting · Infometrics · Mandala Partners · Marsden Jacob Associates · Nous Group · NZIER · Oakley Greenwood · Sapere Research Group · SGS Economics & Planning · Synergies Economic Consulting · The Centre for International Economics

</details>

<details>
<summary><strong>Policy & Research Economics</strong> (32)</summary>

Abt Global · Acumen · American Institutes for Research · Appleseed · BAE Urban Economics · Beacon Economics · Camoin Associates · Chemonics International · Chmura Economics & Analytics · DAI Global · Eastern Research Group · EBP US · Econometrica · Economic & Planning Systems · ECONorthwest · Econsult Solutions · Estolano Advisors · HR&A Advisors · ICF · Industrial Economics (IEc) · Keyser Marston Associates · L&M Policy Research · Lightcast · Mathematica · MDRC · NORC at the University of Chicago · RCLCO · REMI · RTI International · TischlerBise · Urban Institute · Westat

</details>

<details>
<summary><strong>Energy & Environmental Economics</strong> (22)</summary>

AFRY Management Consulting · Aurora Energy Research · Baringa · CE Delft · Christensen Associates Energy Consulting · Concentric Energy Advisors · Cornwall Insight · Demand Side Analytics · Energy + Environmental Economics (E3) · LCP Delta · London Economics International · Monitoring Analytics · Opinion Dynamics · Potomac Economics · REF-E · Resources for the Future · Rhodium Group · ScottMadden · Synapse Energy Economics · The Cadmus Group · THEMA Consulting Group · Wood Mackenzie

</details>

<details>
<summary><strong>Transfer Pricing & Valuation</strong> (10)</summary>

Andersen (Transfer Pricing) · Baker Tilly (Transfer Pricing) · BDO (Transfer Pricing) · Crowe (Transfer Pricing) · Economics Partners · Grant Thornton (Transfer Pricing / Economics) · Kroll · RSM (Transfer Pricing) · Ryan (Transfer Pricing) · Stout

</details>

<details>
<summary><strong>Big 4 & Advisory Economics</strong> (10)</summary>

Alvarez & Marsal (Disputes & Investigations) · Deloitte (Economics / Transfer Pricing) · Deloitte UK Economic Advisory · EY (QUEST / Economic Advisory / Transfer Pricing) · EY UK Economic Advisory · Grant Thornton UK Economic Consulting · KPMG (Economic & Valuation Services) · KPMG Singapore Economics & Regulation · KPMG UK Economics · PwC (Economics / Transfer Pricing / Forensics)

</details>

<details>
<summary><strong>Health Economics & HEOR</strong> (18)</summary>

Avalere Health · Broadstreet HEOR · Dobson DaVanzo & Associates · Evidera (Thermo Fisher) · Genesis Research Group · Health Advances · Health Management Associates · IQVIA (HEOR) · KNG Health Consulting · Lumanity · Medicus Economics · Milliman · OPEN Health · PRECISIONheor (Precision AQ) · RTI Health Solutions · Trinity Life Sciences · Wakely Consulting Group · Xcenda (Cencora)

</details>

<details>
<summary><strong>Macro & Economic Research</strong> (7)</summary>

Capital Economics · Cebr · Fathom Consulting · Moody's Analytics (Economics) · Oxford Economics · Pantheon Macroeconomics · S&P Global (Economics)

</details>

---

## How to Run

Requires **Node.js 18+** (no dependencies). From the repo folder:

```bash
npm run scan:all          # full workflow (v1 ATS boards + v2 career pages/web leads + reports + README)
npm run scan:v1           # known + guessed ATS boards only
npm run scan:v2           # v1 + saved career pages, custom-ATS snapshots, web-discovered leads
npm run scan:all:publish  # scan, rebuild reports, commit, and push to GitHub
npm run report:new -- --days=3   # roles released in the last 3 days (by ATS publish date)
```

**Scan modes:** `v1` (ATS boards) · `v2` (ATS + career pages + web leads) · `all` (same as v2, the full workflow).

### Normal workflow on any machine

```bash
git pull
npm run scan:all:publish
```

Every `v2`/`all` run rebuilds [reports/LATEST_ECON_SCAN.md](reports/LATEST_ECON_SCAN.md) and this README. The publish step commits changed reports and pushes to `origin` (needs `gh auth login`). To publish already-generated changes without scanning, run `npm run publish`.

### Scheduled scans on GitHub Actions

[.github/workflows/scan.yml](.github/workflows/scan.yml) runs `npm run scan:all:publish` every morning (and on demand from the Actions tab), caching `.scan-state/` between runs so new/closed-role detection keeps working.

## Repo Layout

- **Root** — `README.md`, `package.json`, `.gitignore`.
- **[scripts/](scripts/)** — scanner pipeline (`run-econ-scan.mjs` orchestrates everything).
- **[tools/](tools/)** — shared modules: ATS collectors, ATS detection, role filter, regions.
- **[inputs/](inputs/)** — hand-maintained data: firm roster, verified ATS boards, career-page database, your application tracker.
- **[reports/](reports/)** — human-readable generated reports incl. the [LATEST_ECON_SCAN.md](reports/LATEST_ECON_SCAN.md) dashboard.
- **[data/](data/)** — machine-readable raw/audit JSON artifacts.
- **[custom-ats-watch/](custom-ats-watch/)** — firms whose careers sites need a real browser (Avature, Radancy, viRecruit, email-only, …).

### Key Files

| File | What it is |
|------|-----------|
| [reports/LATEST_ECON_SCAN.md](reports/LATEST_ECON_SCAN.md) | Latest scan summary + newest roles |
| [reports/econ_internship_roles_scan_v2.md](reports/econ_internship_roles_scan_v2.md) | Full current internship list (detailed, with coverage status per firm) |
| [reports/econ_internship_roles_scan_v2.csv](reports/econ_internship_roles_scan_v2.csv) | Full current internship list (spreadsheet) |
| [reports/econ_entry_level_roles.md](reports/econ_entry_level_roles.md) | Entry-level analyst roles found on the same boards |
| [reports/new_econ_roles_since_last_run.md](reports/new_econ_roles_since_last_run.md) | New stable job URLs, grouped by region |
| [reports/current_econ_roles_not_in_tracker.md](reports/current_econ_roles_not_in_tracker.md) | Current roles absent from your application tracker |
| [reports/econ_roster_scan_audit.md](reports/econ_roster_scan_audit.md) | Every firm split into confirmed vs. unverifiable states |
| [reports/closed_roles_history.md](reports/closed_roles_history.md) | Archive of roles that have closed, grouped by date detected (0 so far) |
| [inputs/econ_firm_roster.json](inputs/econ_firm_roster.json) | The firm universe, practice-area category, and per-firm scope filter |
| [inputs/ats_seeds.json](inputs/ats_seeds.json) | Verified ATS boards (Greenhouse, Lever, Workday, iCIMS, Workable, Personio, Teamtailor, Pinpoint, Paylocity, Oracle, …) |
| [inputs/company_career_pages.json](inputs/company_career_pages.json) | Career-page database (auto-extended by discovery) |
| [inputs/internship_tracker.csv](inputs/internship_tracker.csv) | Your applications — add URLs here to hide them from the "not in tracker" report |

### Adding a firm

1. Add it to `inputs/econ_firm_roster.json` with a `category` and `scope` (`all` for pure econ firms; `econ` or a regex for multi-practice firms).
2. If you know its board, add it to `inputs/ats_seeds.json`; otherwise add its careers URL to `inputs/company_career_pages.json` and the scanner will find the board.

Generated outputs are intentionally tracked so every clone shares the same baseline. The committed `data/econ_internship_roles_scan_v2_raw.json` is the cross-device baseline for the next comparison.
