// Role filter for economic-consulting internships (and, separately, entry-level analyst roles).
//
// classifyRole(row, firm) -> { track: "Internship" | "Entry-level" | null, reason }
//   row  = { Title, Department, Location, Notes/Content }
//   firm = roster entry { scope: "all" | "econ" | "<regex>" }

export const TARGET_YEARS = ["2027"]; // internship cycle being scanned (recruiting season Fall 2026)

export const internSignal = /\b(interns?|internships?|co-?op|summer (?:analyst|associate|consultant|economist|research analyst|research assistant|student|program(?:me)?|scholar)s?|vacation (?:scheme|programme|program|student)|work experience|(?:industrial |year[- ]long |sandwich )?placement(?: year| student)?|insight (?:day|week|programme|program)|spring week|praktik(?:um|ant(?:in)?)|werkstudent(?:in)?|stagiaire|student (?:research )?(?:assistant|analyst|associate|worker)|undergraduate research assistant|vacationer)\b/i;
const stageSignal = /\(stage\)|\bstage\s*(?:[-–)]|$)|\bstage (?:de|en)\b/i;
const summerYearAnalyst = /\bsummer\s*20\d{2}\b/i;

const econKeyword = /\b(econom\w*|competition|antitrust|disputes?|litigation|damages|transfer pricing|valuation|forensic|expert services|regulat\w*|policy|public sector|heor|health economics|outcomes research|market access|research (?:analyst|assistant|associate)|energy (?:markets?|economics|analytics)|market design|investigations|quantitative economics|quest|nera|compass lexecon|arbitration|claims)\b/i;

// Functions that are never "economic consulting" even at an econ firm.
const blockedFunction = /\b(human resources|\bhr\b|people (?:team|operations)|talent acquisition|recruit(?:ing|ment|er)|marketing|communications|graphic|design(?:er)?|facilities|office services|reception\w*|administrative|executive assistant|legal assistant|paralegal|help ?desk|it support|desktop support|network engineer|cyber ?security|information security|payroll|accounts payable|billing|business development|sales|events?)\b/i;

// Practices that sit inside econ/disputes firms but are not economic consulting.
const nonEconPractice = /\b(construction|engineering sciences?|cyber|forensic technology|technology consulting|management advisory|strategy consulting|commercial strategy|corporate finance|restructuring|turnaround|performance improvement|forensic accounting|audit|deals|portfolio management|portfolio valuation|investments? (?:&|and) portfolio|pilotage|program(?:me)? management|office (?:assistant|manager)|people (?:&|and) culture|p&c)\b/i;

const blockedEducation = /\b(ph\.?d|doctoral|doctorate|postdoc\w*|mba|jd|law student|summer associate - (?:phd|mba))\b/i;
const educationAllowed = /\b(bachelor|undergrad\w*|b\.?a\.?\/b\.?s|bs\/ms|master'?s|ms|msc|ma)\b/i;
const phdOnlyBody = /\b(?:must be (?:working towards|pursuing|enrolled in) a ph\.?d|ph\.?d\.? (?:candidates|students|program(?:me)? in)|doctoral (?:candidates|students)|currently enrolled in a doctoral)\b/i;
const recruitingEvent = /\b(networking|information session|info session|career fair|open house|webinar|talent (?:community|network|pool)|general application|expression of interest|future opportunities|join our talent)\b/i;

// Dated titles outside the target cycle (e.g. "Summer 2026", "2025 Intern").
const staleTiming = /\b(?:(?:spring|summer|fall|autumn|winter|january|february|march|april|may|june|july|august)\s*(?:20(?:1\d|2[0-6])))\b|\b(?:20(?:1\d|2[0-6]))\s*(?:spring|summer|fall|autumn|winter|intern|internship|summer)\b/i;

const seniority = /\b(senior|sr\.?|principal|director|managing|manager|vice president|\bvp\b|partner|lead|head of|chief|experienced|lateral|associate director|expert|staff economist|economist ii|analyst ii|analyst iii|consultant ii|supervisor)\b/i;
const entryTitle = /\b(associate|analyst|research analyst|economic analyst|research associate|research assistant|associate analyst|consulting analyst|junior (?:economist|consultant|analyst)|assistant economist|graduate economist|economist|associate consultant|consultant|data analyst|analytics associate)\b/i;
const entrySignal = /\b(summer 20(?:26|27)(?: grads?| graduates?)?|20(?:26|27) grads?|entry[- ]level|new grad(?:uate)?|recent graduates?|graduate (?:programme|program|scheme|economist|analyst|intake)|campus|university|class of 20(?:26|27)|20(?:26|27) (?:start|graduates?|analyst|associate|consultant|intake|entry)|(?:start|starting) (?:in )?20(?:26|27)|junior|assistant economist|analyst i\b|level (?:i|1)\b|early careers?)\b/i;

function scopeMatches(text, scope) {
  if (!scope || scope === "all") return true;
  if (scope === "econ") return econKeyword.test(text);
  try { return new RegExp(scope, "i").test(text); } catch { return true; }
}

export function internshipTiming(title = "", content = "") {
  const t = title.match(/\b(spring|summer|fall|autumn|winter)\s*20\d{2}\b/i)?.[0]
    || title.match(/\b20\d{2}\s*(spring|summer|fall|autumn|winter)\b/i)?.[0]
    || title.match(/\b20\d{2}\b/)?.[0]
    || title.match(/\b(spring|summer|fall|autumn|winter|off[- ]cycle)\b/i)?.[0]
    || "";
  const grad = String(content).split(/(?<=[.!?;])\s+/)
    .filter((s) => /\b(graduat\w*|class of|degree completion|expected to complete)\b/i.test(s))
    .join(" ");
  const gradYears = [...new Set([...grad.matchAll(/\b20\d{2}\b/g)].map((m) => m[0]))];
  return [
    t ? `timing: ${t}` : "timing not stated in title",
    gradYears.length ? `graduation years mentioned: ${gradYears.join(", ")}` : "",
  ].filter(Boolean).join("; ");
}

export function classifyRole(row, firm = {}) {
  const title = String(row.Title || "").trim();
  const dept = String(row.Department || "");
  const body = `${row.Notes || ""} ${row.Content || ""}`;
  const titleDept = `${title} ${dept}`;
  if (!title) return { track: null, reason: "empty title" };
  if (recruitingEvent.test(title)) return { track: null, reason: "recruiting event / talent pool" };
  if (blockedFunction.test(title)) return { track: null, reason: "non-economics function" };
  if (nonEconPractice.test(title)) return { track: null, reason: "non-economics practice" };
  if (!scopeMatches(titleDept, firm.scope)) return { track: null, reason: `outside firm scope (${firm.scope})` };
  if (blockedEducation.test(title) && !educationAllowed.test(`${title} ${body.slice(0, 1500)}`)) return { track: null, reason: "PhD/MBA/JD-only" };
  if (staleTiming.test(title)) return { track: null, reason: "dated for a past cycle" };

  const isIntern = internSignal.test(titleDept) || stageSignal.test(title)
    || (summerYearAnalyst.test(title) && !/\b(full[- ]time|associate|grads?|graduates?|start date|new hire)\b/i.test(title));
  if (isIntern) {
    const years = [...title.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
    if (years.length && years.every((y) => y <= 2026)) return { track: null, reason: "dated for a past cycle" };
    if (phdOnlyBody.test(body) && !educationAllowed.test(body.replace(phdOnlyBody, ""))) return { track: null, reason: "PhD-only (per description)" };
    if (/\b(new grad|full[- ]time)\b/i.test(title) && !/\bintern/i.test(title)) return { track: null, reason: "full-time" };
    return { track: "Internship", reason: "internship" };
  }

  if (entryTitle.test(title) && !seniority.test(title)) {
    const firmIsCore = !firm.scope || firm.scope === "all";
    const exactEntry = /^(?:economic |research |consulting |associate |economics )?(?:analyst|research analyst|research associate|economic analyst|associate analyst|analyst,? economics(?: consulting)?)(?:\s*[-–,(].*)?$/i.test(title);
    if (entrySignal.test(`${titleDept}`) || (firmIsCore && exactEntry)) return { track: "Entry-level", reason: "entry-level analyst" };
  }
  return { track: null, reason: "not an internship or entry-level role" };
}
