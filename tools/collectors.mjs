// ATS collectors. Each returns { source, jobs } when the board resolves, or null.
// Job shape: { Company, Title, Department, Location, URL, Source, PostedAt, Content }
import { decodeHtml, fetchJson, fetchText, postJson, stripHtml } from "./common.mjs";

const job = (company, source, fields) => ({
  Company: company,
  Title: (fields.Title || "").replace(/\s+/g, " ").trim(),
  Department: fields.Department || "",
  Location: (fields.Location || "").toString().replace(/\s+/g, " ").trim(),
  URL: (fields.URL || "").trim(),
  Source: source,
  PostedAt: fields.PostedAt || "",
  Content: (fields.Content || "").slice(0, 4000),
});

// ---- Greenhouse (US + EU data centres) -------------------------------------------------
export async function greenhouse(company, token, { eu = false } = {}) {
  const host = eu ? "boards-api.eu.greenhouse.io" : "boards-api.greenhouse.io";
  const json = await fetchJson(`https://${host}/v1/boards/${token}/jobs?content=true`);
  if (!json || !Array.isArray(json.jobs)) return null;
  const source = `Greenhouse${eu ? "-EU" : ""}:${token}`;
  return {
    source,
    jobs: json.jobs.map((j) => job(company, source, {
      Title: j.title,
      Department: (j.departments || []).map((d) => d.name).filter(Boolean).join(", "),
      Location: j.location?.name,
      URL: j.absolute_url || `https://job-boards${eu ? ".eu" : ""}.greenhouse.io/${token}/jobs/${j.id}`,
      PostedAt: j.first_published || j.updated_at || "",
      Content: stripHtml(j.content || ""),
    })),
  };
}

// ---- Lever (US + EU) ------------------------------------------------------------------
export async function lever(company, token, { eu = false } = {}) {
  const json = await fetchJson(`https://api.${eu ? "eu." : ""}lever.co/v0/postings/${token}?mode=json`);
  if (!Array.isArray(json)) return null;
  const source = `Lever${eu ? "-EU" : ""}:${token}`;
  return {
    source,
    jobs: json.map((j) => job(company, source, {
      Title: j.text,
      Department: [j.categories?.team, j.categories?.department, j.categories?.commitment].filter(Boolean).join(", "),
      Location: j.categories?.allLocations?.join("; ") || j.categories?.location,
      URL: j.hostedUrl || j.applyUrl,
      PostedAt: j.createdAt ? new Date(j.createdAt).toISOString() : "",
      Content: stripHtml(`${j.descriptionPlain || ""} ${(j.lists || []).map((l) => `${l.text} ${l.content}`).join(" ")}`),
    })),
  };
}

// ---- Ashby ----------------------------------------------------------------------------
export async function ashby(company, token) {
  const json = await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${token}`);
  if (!json || !Array.isArray(json.jobs)) return null;
  const source = `Ashby:${token}`;
  return {
    source,
    jobs: json.jobs.map((j) => job(company, source, {
      Title: j.title,
      Department: [j.department, j.team, j.employmentType].filter(Boolean).join(", "),
      Location: j.locationName || j.location,
      URL: j.jobUrl || `https://jobs.ashbyhq.com/${token}/${j.id}`,
      PostedAt: j.publishedAt || "",
      Content: stripHtml(j.descriptionHtml || ""),
    })),
  };
}

// ---- Workday (public CXS API) -----------------------------------------------------------
export async function workday(company, { host, site, tenant, searchText = "" }) {
  const origin = `https://${host}`;
  const ten = tenant || host.split(".")[0];
  const url = `${origin}/wday/cxs/${ten}/${site}/jobs`;
  const postings = [];
  const limit = 20;
  for (let offset = 0; offset < 2000; offset += limit) {
    const json = await postJson(url, { appliedFacets: {}, limit, offset, searchText });
    if (!json) { if (offset === 0) return null; break; }
    const page = json.jobPostings || [];
    postings.push(...page);
    if (!page.length || page.length < limit || postings.length >= (json.total || 0)) break;
  }
  const source = `Workday:${ten}/${site}`;
  return {
    source,
    jobs: postings.map((p) => job(company, source, {
      Title: p.title,
      Location: p.locationsText,
      URL: `${origin}/${site}${p.externalPath || ""}`,
      PostedAt: p.postedOn || "",
      Content: (p.bulletFields || []).join(" | "),
    })),
  };
}

// ---- SmartRecruiters ------------------------------------------------------------------
export async function smartrecruiters(company, token) {
  const postings = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const json = await fetchJson(`https://api.smartrecruiters.com/v1/companies/${token}/postings?limit=100&offset=${offset}`);
    if (!json) { if (offset === 0) return null; break; }
    const page = json.content || [];
    postings.push(...page);
    if (page.length < 100 || postings.length >= (json.totalFound || 0)) break;
  }
  const source = `SmartRecruiters:${token}`;
  return {
    source,
    jobs: postings.map((p) => job(company, source, {
      Title: p.name,
      Department: p.department?.label || p.function?.label || "",
      Location: p.location?.remote ? "Remote" : [p.location?.city, p.location?.region, p.location?.country].filter(Boolean).join(", "),
      URL: `https://jobs.smartrecruiters.com/${token}/${p.id}`,
      PostedAt: p.releasedDate || "",
    })),
  };
}

// ---- Workable -------------------------------------------------------------------------
export async function workable(company, account) {
  const results = [];
  let token;
  for (let i = 0; i < 20; i += 1) {
    const json = await postJson(`https://apply.workable.com/api/v3/accounts/${account}/jobs`, token ? { token } : {});
    if (!json) { if (i === 0) return null; break; }
    results.push(...(json.results || []));
    token = json.nextPage;
    if (!token) break;
  }
  const source = `Workable:${account}`;
  return {
    source,
    jobs: results.map((r) => job(company, source, {
      Title: r.title,
      Department: [r.department, r.type].filter(Boolean).join(", "),
      Location: [r.location?.city, r.location?.region, r.location?.country].filter(Boolean).join(", ") || (r.remote ? "Remote" : ""),
      URL: `https://apply.workable.com/${account}/j/${r.shortcode}/`,
      PostedAt: r.published || "",
    })),
  };
}

// ---- Personio (XML feed) ----------------------------------------------------------------
export async function personio(company, sub, { tld = "de" } = {}) {
  const res = await fetchText(`https://${sub}.jobs.personio.${tld}/xml?language=en`);
  if (!res.ok || !/<position>/i.test(res.text)) return null;
  const tag = (block, name) => decodeHtml((block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"))?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, ""));
  const source = `Personio:${sub}`;
  const jobs = [...res.text.matchAll(/<position>([\s\S]*?)<\/position>/gi)].map(([, block]) => job(company, source, {
    Title: tag(block, "name"),
    Department: [tag(block, "department"), tag(block, "employmentType"), tag(block, "schedule")].filter(Boolean).join(", "),
    Location: tag(block, "office"),
    URL: `https://${sub}.jobs.personio.${tld}/job/${tag(block, "id")}`,
    PostedAt: tag(block, "createdAt"),
    Content: stripHtml(tag(block, "value")),
  }));
  return { source, jobs };
}

// ---- Teamtailor (server-rendered job list) ---------------------------------------------------
export async function teamtailor(company, sub, { host } = {}) {
  const base = host ? `https://${host}` : `https://${sub}.teamtailor.com`;
  const res = await fetchText(`${base}/jobs`);
  if (!res.ok) return null;
  const source = `Teamtailor:${sub}`;
  const seen = new Set();
  const jobs = [];
  for (const m of res.text.matchAll(/<a[^>]+href="([^"]*\/jobs\/\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = new URL(decodeHtml(m[1]), base).toString();
    if (seen.has(url)) continue;
    const text = stripHtml(m[2]);
    if (!text) continue;
    seen.add(url);
    const [title, ...rest] = text.split(/\s{2,}| · | – /);
    jobs.push(job(company, source, { Title: title, Location: rest.join(", "), URL: url }));
  }
  return { source, jobs };
}

// ---- Pinpoint (postings.json) ---------------------------------------------------------------
export async function pinpoint(company, hostOrSub) {
  const host = hostOrSub.includes(".") ? hostOrSub : `${hostOrSub}.pinpointhq.com`;
  const json = await fetchJson(`https://${host}/postings.json`);
  const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : null;
  if (!list) return null;
  const source = `Pinpoint:${host}`;
  return {
    source,
    jobs: list.map((p) => {
      const a = p.attributes || p;
      return job(company, source, {
        Title: a.title,
        Department: [a.department?.name || a.department, a.employment_type_text || a.employment_type].filter(Boolean).join(", "),
        Location: a.location?.name || a.location_name || [a.location?.city, a.location?.province].filter(Boolean).join(", "),
        URL: a.url || `https://${host}/postings/${p.id}`,
        PostedAt: a.published_at || a.created_at || "",
        Content: stripHtml(a.description || ""),
      });
    }),
  };
}

// ---- Breezy HR ---------------------------------------------------------------------------
export async function breezy(company, sub) {
  const json = await fetchJson(`https://${sub}.breezy.hr/json`);
  if (!Array.isArray(json)) return null;
  const source = `Breezy:${sub}`;
  return {
    source,
    jobs: json.map((p) => job(company, source, {
      Title: p.name,
      Department: [p.department, p.type?.name].filter(Boolean).join(", "),
      Location: p.location?.name || [p.location?.city, p.location?.country?.name].filter(Boolean).join(", "),
      URL: p.url,
      PostedAt: p.published_date || "",
    })),
  };
}

// ---- JazzHR (applytojob.com) ----------------------------------------------------------------
export async function jazzhr(company, sub) {
  const res = await fetchText(`https://${sub}.applytojob.com/apply`);
  if (!res.ok) return null;
  const source = `JazzHR:${sub}`;
  const seen = new Set();
  const jobs = [];
  for (const m of res.text.matchAll(/<a[^>]+href="((?:https?:\/\/[^"]*applytojob\.com)?\/apply\/[A-Za-z0-9]{6,}\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = new URL(decodeHtml(m[1]), `https://${sub}.applytojob.com`).toString();
    const title = stripHtml(m[2]);
    if (!title || seen.has(url) || /^apply$/i.test(title)) continue;
    seen.add(url);
    const tail = res.text.slice(m.index + m[0].length, m.index + m[0].length + 600);
    const loc = stripHtml(tail.match(/fa-map-marker[\s\S]*?<\/i>([\s\S]*?)<\/li>/i)?.[1] || "");
    jobs.push(job(company, source, { Title: title, Location: loc, URL: url }));
  }
  return { source, jobs };
}

// ---- iCIMS (iframe search pages) --------------------------------------------------------------
export async function icims(company, sub) {
  const host = sub.includes(".") ? sub : `${sub}.icims.com`;
  const source = `iCIMS:${host.split(".")[0]}`;
  const seen = new Set();
  const jobs = [];
  let resolved = false;
  for (let page = 0; page < 15; page += 1) {
    const res = await fetchText(`https://${host}/jobs/search?ss=1&in_iframe=1&pr=${page}`);
    if (!res.ok) break;
    resolved = true;
    let added = 0;
    for (const m of res.text.matchAll(/<a[^>]+href="(https?:\/\/[^"]+\/jobs\/(\d+)\/[^"]*\/job[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const id = m[2];
      if (seen.has(id)) continue;
      const title = stripHtml(m[3]).replace(/^Job Title\s*/i, "");
      if (!title) continue;
      seen.add(id);
      added += 1;
      const tail = res.text.slice(m.index, m.index + 2500);
      const loc = stripHtml(tail.match(/Job Locations?[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] || "");
      jobs.push(job(company, source, { Title: title, Location: loc, URL: `https://${host}/jobs/${id}/job` }));
    }
    if (!added) break;
  }
  return resolved ? { source, jobs } : null;
}

// ---- Paylocity -------------------------------------------------------------------------------
export async function paylocity(company, guid) {
  const source = `Paylocity:${guid.slice(0, 8)}`;
  const feed = await fetchJson(`https://recruiting.paylocity.com/recruiting/v2/api/feed/jobs/${guid}`);
  const feedJobs = feed?.jobs || feed?.Jobs;
  if (Array.isArray(feedJobs)) {
    return {
      source,
      jobs: feedJobs.map((j) => job(company, source, {
        Title: j.title || j.JobTitle,
        Location: [j.jobLocation?.city || j.city, j.jobLocation?.state || j.state].filter(Boolean).join(", ") || j.LocationName,
        URL: j.displayUrl || j.applyUrl || `https://recruiting.paylocity.com/Recruiting/Jobs/Details/${j.jobId || j.JobId}`,
        PostedAt: j.publishedDate || j.PublishedDate || "",
        Content: stripHtml(j.description || ""),
      })),
    };
  }
  const res = await fetchText(`https://recruiting.paylocity.com/recruiting/jobs/All/${guid}`);
  if (!res.ok) return null;
  const raw = res.text.match(/window\.pageData\s*=\s*(\{[\s\S]*?\});\s*(?:<\/script>|window\.)/)?.[1];
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch {}
  const list = data?.Jobs || [];
  return {
    source,
    jobs: list.map((j) => job(company, source, {
      Title: j.JobTitle,
      Department: j.HiringDepartment || "",
      Location: j.LocationName || [j.JobLocation?.City, j.JobLocation?.State].filter(Boolean).join(", "),
      URL: `https://recruiting.paylocity.com/Recruiting/Jobs/Details/${j.JobId}`,
      PostedAt: j.PublishedDate || "",
    })),
  };
}

// ---- Oracle Recruiting Cloud (Candidate Experience REST) ----------------------------------------
export async function oracle(company, { host, site }) {
  const all = [];
  for (let offset = 0; offset < 2000; offset += 200) {
    const url = `https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${site},facetsList=NONE,limit=200,offset=${offset},sortBy=POSTING_DATES_DESC`;
    const json = await fetchJson(url);
    const bucket = json?.items?.[0];
    if (!bucket) { if (offset === 0) return null; break; }
    const list = bucket.requisitionList || [];
    all.push(...list);
    if (list.length < 200 || all.length >= (bucket.TotalJobsCount || 0)) break;
  }
  const source = `Oracle:${host.split(".")[0]}/${site}`;
  return {
    source,
    jobs: all.map((r) => job(company, source, {
      Title: r.Title,
      Department: [r.JobFamily, r.JobFunction].filter(Boolean).join(", "),
      Location: [r.PrimaryLocation, ...(r.secondaryLocations || []).map((l) => l.Name)].filter(Boolean).join("; "),
      URL: `https://${host}/hcmUI/CandidateExperience/en/sites/${site}/job/${r.Id}`,
      PostedAt: r.PostedDate || "",
      Content: stripHtml(`${r.ShortDescriptionStr || ""} ${r.ExternalQualificationsStr || ""}`),
    })),
  };
}

// ---- Trakstar Hire (server-rendered) -------------------------------------------------------------
export async function trakstar(company, sub) {
  const res = await fetchText(`https://${sub}.hire.trakstar.com/`);
  if (!res.ok) return null;
  const source = `Trakstar:${sub}`;
  const jobs = [];
  const cards = [...res.text.matchAll(/js-careers-page-job-list-item"[\s\S]*?data-href="\/jobs\/([a-z0-9]+)\/?"([\s\S]*?)(?=js-careers-page-job-list-item|$)/gi)];
  for (const [, id, block] of cards) {
    const title = stripHtml(block.match(/js-job-list-opening-name[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || "");
    if (!title) continue;
    const loc = block.replace(/<h3[\s\S]*?<\/h3>/i, " ").replace(/<[^>]+>/g, " ").match(/([A-Z][A-Za-z.\-\/ ]+,\s*[A-Z][A-Za-z.\-\/ ]+)/)?.[1] || "";
    jobs.push(job(company, source, { Title: title, Location: loc.replace(/\s+/g, " ").trim(), URL: `https://${sub}.hire.trakstar.com/jobs/${id}/` }));
  }
  return { source, jobs };
}

// ---- Dispatcher --------------------------------------------------------------------------------
// seeds: { greenhouse:[], greenhouse_eu:[], lever:[], lever_eu:[], ashby:[], workday:[{host,site}],
//          smartrecruiters:[], workable:[], personio:[], personio_com:[], teamtailor:[], pinpoint:[],
//          pinpoint_host:[], breezy:[], jazzhr:[], icims:[], paylocity:[], oracle:[{host,site}], trakstar:[] }
export function collectorTasks(company, seeds = {}) {
  const tasks = [];
  const add = (key, fn) => { for (const value of seeds[key] || []) tasks.push({ key, value, run: () => fn(value) }); };
  add("greenhouse", (t) => greenhouse(company, t));
  add("greenhouse_eu", (t) => greenhouse(company, t, { eu: true }));
  add("lever", (t) => lever(company, t));
  add("lever_eu", (t) => lever(company, t, { eu: true }));
  add("ashby", (t) => ashby(company, t));
  add("workday", (w) => workday(company, w));
  add("smartrecruiters", (t) => smartrecruiters(company, t));
  add("workable", (t) => workable(company, t));
  add("personio", (t) => personio(company, t));
  add("personio_com", (t) => personio(company, t, { tld: "com" }));
  add("teamtailor", (t) => teamtailor(company, t));
  add("pinpoint", (t) => pinpoint(company, t));
  add("pinpoint_host", (h) => pinpoint(company, h));
  add("breezy", (t) => breezy(company, t));
  add("jazzhr", (t) => jazzhr(company, t));
  add("icims", (t) => icims(company, t));
  add("paylocity", (g) => paylocity(company, g));
  add("oracle", (o) => oracle(company, o));
  add("trakstar", (t) => trakstar(company, t));
  return tasks;
}

export function seedKey(key, value) {
  return `${key}:${typeof value === "string" ? value.toLowerCase() : `${value.host}/${value.site}`.toLowerCase()}`;
}

export function mergeSeeds(...sets) {
  const out = {};
  const seen = new Set();
  for (const set of sets) {
    for (const [key, values] of Object.entries(set || {})) {
      for (const value of values || []) {
        const k = seedKey(key, value);
        if (seen.has(k)) continue;
        seen.add(k);
        (out[key] ||= []).push(value);
      }
    }
  }
  return out;
}
