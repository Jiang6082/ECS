// Offline self-test: stubs fetch with canned ATS responses and checks every collector,
// the ATS detector, and the role filter.  Run: npm test
import assert from "node:assert/strict";
import * as C from "./collectors.mjs";
import { extractAtsTokens, detectUnsupportedAts } from "./ats-detect.mjs";
import { classifyRole } from "./relevance.mjs";
import { regionForLocation } from "./regions.mjs";

const routes = [
  [/boards-api\.greenhouse\.io\/v1\/boards\/demo\/jobs/, { jobs: [{ id: 1, title: "Economics Consulting Analyst Intern (Summer 2027)", location: { name: "Boston, MA" }, absolute_url: "https://job-boards.greenhouse.io/demo/jobs/1", first_published: "2026-09-01T00:00:00Z", departments: [{ name: "Consulting" }], content: "&lt;p&gt;Expected graduation 2028&lt;/p&gt;" }] }],
  [/boards-api\.eu\.greenhouse\.io\/v1\/boards\/demo\/jobs/, { jobs: [{ id: 2, title: "Summer Intern", location: { name: "London" }, absolute_url: "https://job-boards.eu.greenhouse.io/demo/jobs/2" }] }],
  [/api\.lever\.co\/v0\/postings\/demo/, [{ text: "Intern - Brussels", categories: { location: "Brussels", commitment: "Internship" }, hostedUrl: "https://jobs.lever.co/demo/abc", createdAt: 1767225600000 }]],
  [/api\.ashbyhq\.com\/posting-api\/job-board\/demo/, { jobs: [{ id: "x", title: "Research Analyst Intern", locationName: "Remote", jobUrl: "https://jobs.ashbyhq.com/demo/x" }] }],
  [/paged\.wd1\.myworkdayjobs\.com/, "WORKDAY_PAGED"],
  [/demo\.wd1\.myworkdayjobs\.com\/wday\/cxs\/demo\/Ext\/jobs/, { total: 1, jobPostings: [{ title: "2027 Summer Associate (Intern)", locationsText: "Washington, DC", externalPath: "/job/DC/2027-Summer-Associate_JR1", postedOn: "Posted 3 Days Ago" }] }],
  [/api\.smartrecruiters\.com\/v1\/companies\/demo\/postings/, { totalFound: 1, content: [{ id: "9", name: "Economics Intern", location: { city: "Paris", country: "fr" }, releasedDate: "2026-09-10" }] }],
  [/apply\.workable\.com\/api\/v3\/accounts\/demo\/jobs/, { results: [{ shortcode: "ABC", title: "Analyst Intern", location: { city: "Los Angeles", region: "California", country: "United States" }, published: "2026-09-05" }] }],
  [/demo\.jobs\.personio\.de\/xml/, "<workzag-jobs><position><id>369975</id><office>Berlin</office><name>Intern at Economics Consultancy (m/f/d)</name><employmentType>intern</employmentType></position></workzag-jobs>"],
  [/demo\.teamtailor\.com\/jobs/, '<ul><li><a href="/jobs/123456-economics-intern-analyst"><span>Economics Intern Analyst</span></a></li></ul>'],
  [/demo\.pinpointhq\.com\/postings\.json/, { data: [{ id: "u1", attributes: { title: "Energy Analyst Intern", location: { name: "London" }, url: "https://demo.pinpointhq.com/postings/u1" } }] }],
  [/demo\.breezy\.hr\/json/, [{ name: "Economist - Intern - Economic Impact - New York", url: "https://demo.breezy.hr/p/1", location: { name: "New York" } }]],
  [/demo\.applytojob\.com\/apply/, '<a href="https://demo.applytojob.com/apply/AbCdEf123/Summer-Analyst-Intern">Summer Analyst Internship</a><ul><li><i class="fa fa-map-marker"></i>New York, NY</li></ul>'],
  [/careers-demo\.icims\.com\/jobs\/search\?ss=1&in_iframe=1&pr=0/, '<li class="row"><div class="header left"><span class="sr-only field-label">Job Locations</span><span>US-MA-Boston</span></div><div class="header right"><span class="sr-only field-label">ID</span><span>2026-3005</span></div><div class="title"><a href="https://careers-demo.icims.com/jobs/3005/summer-analyst-intern/job?in_iframe=1"><span class="sr-only field-label">Title</span><h3>Summer Analyst Intern - Generalist</h3></a></div></li><li class="row"><div class="header left"><span class="sr-only field-label">Job Locations</span><span>FR-Paris</span></div><div class="header right"><span class="sr-only field-label">ID</span><span>2026-3068</span></div><div class="title"><a href="https://careers-demo.icims.com/jobs/3068/stage/job?in_iframe=1"><span class="sr-only field-label">Title</span><h3>Stage - Analyste - G&amp;eacute;n&amp;eacute;raliste</h3></a></div></li>'],
  [/careers-demo\.icims\.com\/jobs\/search\?ss=1&in_iframe=1&pr=1/, "<html>no more</html>"],
  [/paylocity\.com\/recruiting\/v2\/api\/feed\/jobs\/00000000-0000-0000-0000-000000000000/, { jobs: [{ jobId: 7, title: "Summer Economist", jobLocation: { city: "Washington", state: "DC" }, displayUrl: "https://recruiting.paylocity.com/Recruiting/Jobs/Details/7" }] }],
  [/demo\.fa\.us2\.oraclecloud\.com\/hcmRestApi/, { items: [{ TotalJobsCount: 1, requisitionList: [{ Id: "55", Title: "Transfer Pricing Intern - Summer 2027", PrimaryLocation: "Chicago, IL, United States", PostedDate: "2026-09-02" }] }] }],
  [/demo\.hire\.trakstar\.com/, '<div class="js-careers-page-job-list-item" data-href="/jobs/abc123/"><h3 class="js-job-list-opening-name">Research Associate Intern</h3><span>Cambridge, MA</span></div>'],
];

globalThis.fetch = async (url, opts = {}) => {
  if (/paged\.wd1\.myworkdayjobs\.com/.test(String(url))) {
    const { offset } = JSON.parse(opts.body || "{}");
    const n = Math.max(0, Math.min(20, 55 - offset));
    return new Response(JSON.stringify({ total: offset === 0 ? 55 : 0, jobPostings: Array.from({ length: n }, (_, k) => ({ title: `Job ${offset + k}`, externalPath: `/job/x_${offset + k}` })) }), { status: 200 });
  }
  const hit = routes.find(([re]) => re.test(String(url)));
  if (!hit) return new Response("not found", { status: 404 });
  const body = typeof hit[1] === "string" ? hit[1] : JSON.stringify(hit[1]);
  return new Response(body, { status: 200 });
};

const checks = [
  ["greenhouse", () => C.greenhouse("Demo", "demo"), "Boston, MA"],
  ["greenhouse-eu", () => C.greenhouse("Demo", "demo", { eu: true }), "London"],
  ["lever", () => C.lever("Demo", "demo"), "Brussels"],
  ["ashby", () => C.ashby("Demo", "demo"), "Remote"],
  ["workday", () => C.workday("Demo", { host: "demo.wd1.myworkdayjobs.com", site: "Ext" }), "Washington, DC"],
  ["smartrecruiters", () => C.smartrecruiters("Demo", "demo"), "Paris, fr"],
  ["workable", () => C.workable("Demo", "demo"), "Los Angeles, California, United States"],
  ["personio", () => C.personio("Demo", "demo"), "Berlin"],
  ["teamtailor", () => C.teamtailor("Demo", "demo"), ""],
  ["pinpoint", () => C.pinpoint("Demo", "demo"), "London"],
  ["breezy", () => C.breezy("Demo", "demo"), "New York"],
  ["jazzhr", () => C.jazzhr("Demo", "demo"), "New York, NY"],
  ["icims", () => C.icims("Demo", "careers-demo"), "US-MA-Boston", 2],
  ["paylocity", () => C.paylocity("Demo", "00000000-0000-0000-0000-000000000000"), "Washington, DC"],
  ["oracle", () => C.oracle("Demo", { host: "demo.fa.us2.oraclecloud.com", site: "CX_1" }), "Chicago, IL, United States"],
  ["trakstar", () => C.trakstar("Demo", "demo"), "Cambridge, MA"],
];
let failures = 0;
for (const [name, fn, location, count = 1] of checks) {
  try {
    const board = await fn();
    assert.ok(board, "board resolved");
    assert.equal(board.jobs.length, count, `${count} job(s)`);
    assert.ok(board.jobs[0].Title, "has title");
    assert.ok(/^https:\/\//.test(board.jobs[0].URL), "has absolute URL");
    assert.equal(board.jobs[0].Location, location);
    if (name === "icims") {
      assert.equal(board.jobs[0].Title, "Summer Analyst Intern - Generalist");
      assert.equal(board.jobs[1].Location, "FR-Paris");
      assert.equal(board.jobs[1].Title, "Stage - Analyste - Généraliste");
    }
    console.log(`ok   collector ${name}: ${board.jobs[0].Title}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL collector ${name}: ${error.message}`);
  }
}
assert.equal(await C.greenhouse("Demo", "missing"), null);
{
  const paged = await C.workday("Demo", { host: "paged.wd1.myworkdayjobs.com", site: "S" });
  if (paged.jobs.length !== 55) { failures += 1; console.log(`FAIL workday paging: got ${paged.jobs.length} of 55`); }
  else console.log("ok   workday paging past page 2 (total only on first page)");
}

const page = `<script src="https://boards.greenhouse.io/embed/job_board/js?for=thebrattlegroup"></script>
<a href="https://jobs.lever.co/compasslexecon?commitment=Internship">EU roles</a>
<a href="https://cornerstone.wd501.myworkdayjobs.com/en-US/CornerstoneResearch_Careers">US</a>
<a href="https://analystcareers-analysisgroup.icims.com/jobs/3005/job">x</a>
<a href="https://apply.workable.com/econ-one-research/">x</a>
<a href="https://e-ca.jobs.personio.de/job/369975">x</a>
<a href="https://recruiting.paylocity.com/recruiting/jobs/All/84ca0b5b-570a-409a-8e91-242f0baca23d/Edgeworth-Economics-LLC">x</a>
<a href="https://ehzq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/requisitions">x</a>
<a href="https://job-boards.eu.greenhouse.io/fideres">x</a>`;
const tokens = extractAtsTokens(page);
try {
  assert.deepEqual(tokens.greenhouse, ["thebrattlegroup"]);
  assert.deepEqual(tokens.greenhouse_eu, ["fideres"]);
  assert.deepEqual(tokens.lever, ["compasslexecon"]);
  assert.deepEqual(tokens.workday, [{ host: "cornerstone.wd501.myworkdayjobs.com", site: "CornerstoneResearch_Careers" }]);
  assert.deepEqual(tokens.icims, ["analystcareers-analysisgroup"]);
  assert.deepEqual(tokens.workable, ["econ-one-research"]);
  assert.deepEqual(tokens.personio, ["e-ca"]);
  assert.deepEqual(tokens.paylocity, ["84ca0b5b-570a-409a-8e91-242f0baca23d"]);
  assert.deepEqual(tokens.oracle, [{ host: "ehzq.fa.us2.oraclecloud.com", site: "CX_1" }]);
  assert.deepEqual(detectUnsupportedAts('<script src="https://x.avature.net/a.js"></script>'), ["avature"]);
  console.log("ok   ATS detection");
} catch (error) {
  failures += 1;
  console.log(`FAIL ATS detection: ${error.message}`, JSON.stringify(tokens));
}

const roleCases = [
  ["(2028 Bachelor's/Master's graduates) Economics Consulting Analyst/Associate Intern (Summer 2027)", "all", "Internship"],
  ["Research Analyst Summer 2027 - Generalist", "all", "Internship"],
  ["2027 Intern - Economic Consulting", "econ", "Internship"],
  ["2027 Intern - Technology Consulting", "econ", null],
  ["NERA Summer Intern 2027 - London", "\\bNERA\\b", "Internship"],
  ["Mercer Summer Intern 2027", "\\bNERA\\b", null],
  ["Intern London Summer 2026", "all", null],
  ["Senior Associate Intern (PhD)", "all", null],
  ["HR Intern", "all", null],
  ["Research Analyst", "all", "Entry-level"],
  ["Senior Analyst", "all", null],
  ["2027 Entry Level Consultant - Economic Consulting", "econ", "Entry-level"],
  ["Tax Intern - Transfer Pricing - Summer 2027", "econ", "Internship"],
  ["Werkstudent (m/w/d) Economic Consulting", "all", "Internship"],
  ["Student Talent Network", "all", null],
];
for (const [title, scope, want] of roleCases) {
  const got = classifyRole({ Title: title }, { scope }).track;
  if (got !== want) { failures += 1; console.log(`FAIL role "${title}" (${scope}): want ${want}, got ${got}`); }
}
console.log(`ok   role filter (${roleCases.length} cases)`);
assert.equal(regionForLocation("Washington, DC"), "North America");
assert.equal(regionForLocation("Brussels"), "Europe");

if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1); }
console.log("\nall self-tests passed");
