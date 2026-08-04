#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { aggregateRoutingLogs } from "./aggregate.mjs";
import { searchDatadogLogs } from "./datadog.mjs";
import { parseJsonEnvironment, readJson } from "./json.mjs";
import { buildClaudePrompt } from "./prompt.mjs";

function argumentsMap(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    values[item.slice(2)] = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : true;
  }
  return values;
}

function boundedHours(value) {
  const hours = Number(value ?? 24);
  if (!Number.isFinite(hours) || hours < 1 || hours > 168) throw new Error("WINDOW_HOURS must be between 1 and 168.");
  return hours;
}

function indexes(value) {
  const parsed = String(value || "*").split(",").map((item) => item.trim()).filter(Boolean);
  return parsed.length ? parsed : ["*"];
}

const args = argumentsMap(process.argv.slice(2));
const to = new Date(args.to || process.env.WINDOW_TO || Date.now());
const hours = boundedHours(args.hours || process.env.WINDOW_HOURS);
const from = new Date(args.from || process.env.WINDOW_FROM || to.getTime() - hours * 60 * 60 * 1000);
if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) throw new Error("The evidence window must contain valid increasing timestamps.");

const mapping = await readJson(resolve(args.mapping || "config/log-field-map.json"));
const policyDefaults = await readJson(resolve("config/policy.defaults.json"));
const policy = parseJsonEnvironment("ROUTING_POLICY_JSON", policyDefaults);
const pricing = args.pricing
  ? await readJson(resolve(args.pricing))
  : parseJsonEnvironment("VENDOR_PRICING_JSON", { currency: "USD", vendors: [] });

let logs;
let source;
let warnings = [];
if (args.fixture) {
  const fixture = await readJson(resolve(args.fixture));
  logs = Array.isArray(fixture) ? fixture : fixture.data;
  source = `fixture:${args.fixture}`;
} else {
  const result = await searchDatadogLogs({
    apiKey: process.env.DD_API_KEY,
    appKey: process.env.DD_APP_KEY,
    site: process.env.DD_SITE,
    query: process.env.DD_LOG_QUERY,
    indexes: indexes(process.env.DD_INDEXES),
    from: from.toISOString(),
    to: to.toISOString(),
  });
  logs = result.logs;
  warnings = result.warnings;
  source = `Datadog (${result.pages} page${result.pages === 1 ? "" : "s"}${result.truncated ? ", capped" : ""})`;
}

const aggregate = aggregateRoutingLogs(logs, mapping);
const prompt = buildClaudePrompt({
  aggregate,
  pricing,
  policy,
  window: { from: from.toISOString(), to: to.toISOString() },
  query: process.env.DD_LOG_QUERY,
  source,
});
const output = resolve(args.output || "dist/claude-routing-prompt.md");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, prompt, { encoding: "utf8", mode: 0o600 });
process.stdout.write(`${JSON.stringify({ output, ...aggregate, warnings: warnings.length }, null, 2)}\n`);
