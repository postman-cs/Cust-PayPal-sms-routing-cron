import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregateRoutingLogs } from "../src/aggregate.mjs";
import { readJson } from "../src/json.mjs";

test("aggregates approved dimensions without retaining raw messages", async () => {
  const fixture = await readJson(new URL("../fixtures/datadog-logs.sample.json", import.meta.url));
  const mapping = await readJson(new URL("../config/log-field-map.json", import.meta.url));
  const result = aggregateRoutingLogs(fixture.data, mapping);

  assert.equal(result.totalLogs, 9);
  assert.equal(result.unmappedLogs, 0);
  assert.deepEqual(result.rows[1], { country: "US", vendor: "Sinch", requested: 50, submitted: 47, converted: 44 });
  assert.deepEqual(result.rows[2], { country: "US", vendor: "Twilio", requested: 100, submitted: 92, converted: 88 });
  assert.doesNotMatch(JSON.stringify(result), /sample message/);
});
