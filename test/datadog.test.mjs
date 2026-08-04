import assert from "node:assert/strict";
import { test } from "node:test";
import { datadogApiBase, searchDatadogLogs } from "../src/datadog.mjs";

test("normalizes Datadog sites", () => {
  assert.equal(datadogApiBase("datadoghq.com"), "https://api.datadoghq.com");
  assert.equal(datadogApiBase("us5.datadoghq.com"), "https://api.us5.datadoghq.com");
});

test("paginates bounded log searches without exposing credentials", async () => {
  const requests = [];
  const responses = [
    { data: [{ id: "one" }], meta: { page: { after: "next" } } },
    { data: [{ id: "two" }], meta: { page: {} } },
  ];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => responses.shift() };
  };
  const result = await searchDatadogLogs({ apiKey: "api", appKey: "app", query: "service:otp", from: "2026-08-02T00:00:00Z", to: "2026-08-03T00:00:00Z", fetchImpl });

  assert.equal(result.logs.length, 2);
  assert.equal(result.pages, 2);
  assert.equal(JSON.parse(requests[1].options.body).page.cursor, "next");
  assert.equal(requests[0].options.headers["dd-api-key"], "api");
});
