const knownWrongSources = new Map([
  ["Campbell and Company", /(?:thecampbellscompany\.com|campbellsoup\.)/i],
]);

export function isKnownWrongCareerPage(company, url = "") {
  return knownWrongSources.get(company)?.test(url) || false;
}
