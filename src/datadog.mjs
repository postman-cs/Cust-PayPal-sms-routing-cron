const DEFAULT_PAGE_LIMIT = 1000;
const DEFAULT_MAX_PAGES = 20;

export function datadogApiBase(site = "datadoghq.com") {
  const value = String(site).trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!value || value === "datadoghq.com") return "https://api.datadoghq.com";
  if (value.startsWith("api.")) return `https://${value}`;
  return `https://api.${value}`;
}

export async function searchDatadogLogs(options) {
  const {
    apiKey,
    appKey,
    query,
    from,
    to,
    site,
    indexes = ["*"],
    pageLimit = DEFAULT_PAGE_LIMIT,
    maxPages = DEFAULT_MAX_PAGES,
    fetchImpl = fetch,
  } = options;

  if (!apiKey || !appKey) throw new Error("DD_API_KEY and DD_APP_KEY are required for scheduled runs.");
  if (!query) throw new Error("DD_LOG_QUERY is required for scheduled runs.");
  if (!from || !to) throw new Error("A bounded Datadog time window is required.");

  const endpoint = `${datadogApiBase(site)}/api/v2/logs/events/search`;
  const logs = [];
  const warnings = [];
  let cursor;

  for (let page = 0; page < maxPages; page += 1) {
    const body = {
      filter: { from, to, indexes, query, storage_tier: "indexes" },
      options: { timezone: "UTC" },
      page: { limit: pageLimit, ...(cursor ? { cursor } : {}) },
      sort: "timestamp",
    };
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "dd-api-key": apiKey,
        "dd-application-key": appKey,
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = Array.isArray(payload.errors) ? payload.errors.join("; ") : `HTTP ${response.status}`;
      throw new Error(`Datadog log search failed: ${detail}`);
    }
    logs.push(...(Array.isArray(payload.data) ? payload.data : []));
    if (Array.isArray(payload.meta?.warnings)) warnings.push(...payload.meta.warnings);
    cursor = payload.meta?.page?.after;
    if (!cursor) return { logs, warnings, pages: page + 1, truncated: false };
  }

  return { logs, warnings, pages: maxPages, truncated: true };
}
