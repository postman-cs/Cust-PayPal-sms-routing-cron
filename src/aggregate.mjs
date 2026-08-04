function valueAtPath(input, path) {
  return String(path).split(".").reduce((value, key) => value?.[key], input);
}

function firstValue(input, paths) {
  for (const path of paths ?? []) {
    const value = valueAtPath(input, path);
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return undefined;
}

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

function eventKind(value, aliases) {
  const candidate = normalized(value);
  for (const [kind, values] of Object.entries(aliases ?? {})) {
    if ((values ?? []).map(normalized).includes(candidate)) return kind;
  }
  return "unknown";
}

function countValue(log, paths) {
  const value = Number(firstValue(log, paths) ?? 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function aggregateRoutingLogs(logs, mapping) {
  const groups = new Map();
  let unmapped = 0;

  for (const log of logs ?? []) {
    const country = String(firstValue(log, mapping.countryPaths) ?? "").trim().toUpperCase();
    const vendor = String(firstValue(log, mapping.vendorPaths) ?? "").trim();
    const kind = eventKind(firstValue(log, mapping.eventPaths), mapping.eventAliases);
    if (!country || !vendor || kind === "unknown") {
      unmapped += 1;
      continue;
    }
    const key = `${country}\u0000${vendor.toLowerCase()}`;
    const row = groups.get(key) ?? { country, vendor, requested: 0, submitted: 0, converted: 0 };
    row[kind] += countValue(log, mapping.countPaths);
    groups.set(key, row);
  }

  const rows = [...groups.values()].sort((a, b) => a.country.localeCompare(b.country) || a.vendor.localeCompare(b.vendor));
  return { rows, totalLogs: logs?.length ?? 0, mappedLogs: (logs?.length ?? 0) - unmapped, unmappedLogs: unmapped };
}
