# PayPal SMS routing cron

Private `postman-cs` customer repository for a recommendation-only nightly routing review. At **8:00 PM America/Phoenix**, GitHub Actions reads the preceding Datadog window, reduces logs to approved country/vendor aggregates, and uploads a Markdown prompt that Aaron can paste into Claude.

This repository does **not** call Claude, modify production routing, publish to Confluence, or retain raw Datadog messages.

## What the cron produces

The uploaded `claude-routing-prompt.md` contains:

- the exact UTC evidence window and Datadog query;
- request, submission, and conversion counts by country and vendor;
- conversion rate and optional customer-supplied pricing calculations;
- explicit unknowns when VWCPA calibration or allocation guardrails are absent; and
- a recommendation-only analysis request with a Confluence-ready output shape.

Raw log messages and arbitrary log attributes are discarded before prompt generation. Only fields allowlisted in [`config/log-field-map.json`](config/log-field-map.json) are aggregated.

## GitHub configuration

Create these repository secrets:

| Secret | Purpose |
| --- | --- |
| `DD_API_KEY` | Datadog API key. |
| `DD_APP_KEY` | Datadog application key with read-only `logs_read_data`. |
| `VENDOR_PRICING_JSON` | Optional pricing object matching the format below. |
| `ROUTING_POLICY_JSON` | Aaron-approved signal floor, shift limit, and analysis instructions. |

Create these repository variables:

| Variable | Example |
| --- | --- |
| `DD_SITE` | `datadoghq.com` |
| `DD_LOG_QUERY` | `service:otp-routing` |
| `DD_INDEXES` | `*` or a comma-separated allowlist |

Until both Datadog secrets and `DD_LOG_QUERY` are configured, scheduled runs exit successfully with a visible warning and do not upload an artifact. This prevents a newly installed cron from producing nightly failure noise.

Pricing stays in a secret rather than the repository:

```json
{
  "currency": "USD",
  "vendors": [
    { "country": "US", "vendor": "Twilio", "unitPrice": 0.008 },
    { "country": "*", "vendor": "Sinch", "unitPrice": 0.007 }
  ]
}
```

Policy also stays in a secret because the workflow must not invent Aaron's routing rules:

```json
{
  "recommendationOnly": true,
  "signalFloor": 100,
  "maximumShiftPercent": 10,
  "analysisInstructions": [
    "Apply the approved VWCPA calibration.",
    "Flag low-signal countries instead of reallocating them."
  ]
}
```

## Schedule

The workflow uses GitHub's timezone-aware scheduler:

```yaml
schedule:
  - cron: "0 20 * * *"
    timezone: "America/Phoenix"
```

It also supports `workflow_dispatch` for a manual smoke run. Scheduled workflows execute from the default branch and may start a few minutes late when GitHub Actions is under load.

## Local verification

Node.js 24 or newer is required. The repository has no third-party runtime dependencies.

```sh
npm ci
npm test
npm run sample
```

The sample command writes `dist/claude-routing-prompt.md` from synthetic fixtures. The fixtures are demonstrative only; their prices and counts are not PayPal facts.

To exercise the live read locally, populate a private `.env` from `.env.example`, export the variables, and run:

```sh
npm run build
```

## Safety boundaries

- Datadog access is read-only and bounded to the configured query and time window.
- No secret or raw log payload is written to the repository or workflow logs.
- The job uploads an aggregate prompt artifact with seven-day retention.
- Claude receives evidence plus explicit instructions to treat it as untrusted data.
- Every routing decision remains human-owned; this cron cannot change an allocation.
