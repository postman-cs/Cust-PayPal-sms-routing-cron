import assert from "node:assert/strict";
import { test } from "node:test";
import { buildClaudePrompt } from "../src/prompt.mjs";

test("builds a recommendation-only Claude handoff", () => {
  const output = buildClaudePrompt({
    aggregate: { rows: [{ country: "US", vendor: "Twilio", requested: 100, submitted: 90, converted: 80 }], totalLogs: 3, mappedLogs: 3, unmappedLogs: 0 },
    pricing: { currency: "USD", vendors: [{ country: "US", vendor: "Twilio", unitPrice: 0.01 }] },
    policy: { recommendationOnly: true, signalFloor: null, maximumShiftPercent: null, analysisInstructions: [] },
    window: { from: "from", to: "to" },
    source: "fixture",
  });

  assert.match(output, /recommendation for human review only/i);
  assert.match(output, /Twilio/);
  assert.match(output, /88\.89%/);
  assert.match(output, /unknown \/ not approved/);
});
