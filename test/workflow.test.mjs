import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("runs nightly at 8 PM Arizona time and remains manually testable", async () => {
  const workflow = await readFile(new URL("../.github/workflows/nightly-routing-prompt.yml", import.meta.url), "utf8");
  assert.match(workflow, /cron: "0 20 \* \* \*"/);
  assert.match(workflow, /timezone: "America\/Phoenix"/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /permissions:\n  contents: read/);
});
