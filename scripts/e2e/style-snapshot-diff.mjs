import { readFileSync, writeFileSync } from "node:fs";

// Compares two CPE_STYLE_SNAPSHOT files from cpe-capture.mjs and reports the
// elements whose computed style (or ::before/::after style) differs. Exits 1
// when anything differs, so a CSS refactor that claims "no visual change" can
// prove it.
//
//   node scripts/e2e/style-snapshot-diff.mjs before.json after.json [report.json]
//
// Snapshots run to hundreds of MB, so each file is split into its top-level
// states and only one state per file is parsed at a time. Every difference is
// counted; only the first STYLE_DIFF_LIMIT (default 200) per state whose own
// computed style changed (not only inherited design tokens) are listed with
// their changed properties. Token changes are summarised once.

const [beforeFile, afterFile, reportFile] = process.argv.slice(2);
if (!beforeFile || !afterFile) {
  console.error(
    "Usage: node scripts/e2e/style-snapshot-diff.mjs before.json after.json [report.json]"
  );
  process.exit(2);
}
const LIMIT = Number(process.env.STYLE_DIFF_LIMIT || 200);
const VALUE_WIDTH = 80;

// Byte range of each top-level value in a JSON object: Map(key → [start, end)).
function topLevelEntries(buffer) {
  const entries = new Map();
  let depth = 0;
  let inString = false;
  let escaped = false;
  let keyStart = -1;
  let key = null;
  let valueStart = -1;
  const close = (end) => {
    entries.set(key, [valueStart, end]);
    key = null;
    valueStart = -1;
  };
  for (let i = 0; i < buffer.length; i += 1) {
    const b = buffer[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (b === 0x5c) escaped = true;
      else if (b === 0x22) {
        inString = false;
        if (depth === 1 && key === null && keyStart >= 0) {
          key = JSON.parse(buffer.toString("utf8", keyStart, i + 1));
          keyStart = -1;
        }
      }
      continue;
    }
    const blank = b === 0x20 || b === 0x0a || b === 0x0d || b === 0x09;
    if (depth === 1 && key !== null && valueStart < 0 && b !== 0x3a && !blank) {
      valueStart = i;
    }
    if (b === 0x22) {
      inString = true;
      if (depth === 1 && key === null) keyStart = i;
    } else if (b === 0x7b || b === 0x5b) {
      depth += 1;
    } else if (b === 0x7d || b === 0x5d) {
      depth -= 1;
      if (depth === 0 && key !== null) close(i);
    } else if (b === 0x2c && depth === 1 && key !== null) {
      close(i);
    }
  }
  return entries;
}

const parseState = (buffer, [start, end]) =>
  JSON.parse(buffer.toString("utf8", start, end));

// "prop:value;prop:value" → Map. Style entries start with "#<hash of every
// property>;" followed by a readable subset; token entries are all custom
// properties.
const toMap = (text) => {
  const map = new Map();
  for (const pair of text.split(";")) {
    const at = pair.indexOf(":");
    if (at > 0) map.set(pair.slice(0, at), pair.slice(at + 1));
  }
  return map;
};
const fullStyleHash = (text) => text.slice(0, text.indexOf(";"));
const short = (value) =>
  value === undefined
    ? "(unset)"
    : value.length > VALUE_WIDTH
      ? `${value.slice(0, VALUE_WIDTH)}…`
      : value;

function compareState(a, b, propertyCounts) {
  const entry = {
    compared: 0,
    differingCount: 0,
    // Differing in a regular property, not only in a design token.
    styleDifferingCount: 0,
    missingCount: 0,
    newCount: 0,
    differing: [],
    missing: [],
    new: []
  };
  const maps = { a: new Map(), b: new Map() };
  const mapOf = (side, table, index, text) => {
    const cacheKey = `${table}${index}`;
    if (!maps[side].has(cacheKey)) maps[side].set(cacheKey, toMap(text));
    return maps[side].get(cacheKey);
  };
  // Distinct style/token sets are few, so diff each pair of sets once.
  const pairDiffs = new Map();
  const diffPair = (table, indexA, indexB) => {
    const cacheKey = `${table}${indexA}/${indexB}`;
    if (pairDiffs.has(cacheKey)) return pairDiffs.get(cacheKey);
    const textA = a[table][indexA];
    const textB = b[table][indexB];
    let changed = [];
    const same =
      table === "styles"
        ? fullStyleHash(textA) === fullStyleHash(textB)
        : textA === textB;
    if (!same) {
      const x = mapOf("a", table, indexA, textA);
      const y = mapOf("b", table, indexB, textB);
      changed = [...new Set([...x.keys(), ...y.keys()])]
        .filter((prop) => x.get(prop) !== y.get(prop))
        .map((prop) => [prop, x.get(prop), y.get(prop)]);
      if (!changed.length) {
        changed = [["(a property outside the readable subset)", "", ""]];
      }
    }
    pairDiffs.set(cacheKey, changed);
    return changed;
  };

  for (const path of Object.keys(a.elements)) {
    const other = b.elements[path];
    if (!other) {
      entry.missingCount += 1;
      if (entry.missing.length < LIMIT) entry.missing.push(path);
      continue;
    }
    entry.compared += 1;
    const ids = a.elements[path];
    ["element", "::before", "::after"].forEach((part, index) => {
      const [styleA, tokensA] = ids[index];
      const [styleB, tokensB] = other[index];
      // Regular properties first: a theme change alters hundreds of tokens.
      const changed = [
        ...diffPair("styles", styleA, styleB),
        ...diffPair("tokens", tokensA, tokensB)
      ];
      if (!changed.length) return;
      entry.differingCount += 1;
      for (const [prop] of changed) {
        propertyCounts.set(prop, (propertyCounts.get(prop) || 0) + 1);
      }
      // Token-only differences are summarised by topChangedTokens; the list
      // shows parts whose own computed style changed.
      if (changed.every(([prop]) => prop.startsWith("--"))) return;
      entry.styleDifferingCount += 1;
      if (entry.differing.length < LIMIT) {
        entry.differing.push({
          path,
          part,
          changed: changed
            .slice(0, 12)
            .map(([prop, x, y]) => `${prop}: ${short(x)} → ${short(y)}`),
          ...(changed.length > 12 ? { moreChanged: changed.length - 12 } : {})
        });
      }
    });
  }
  for (const path of Object.keys(b.elements)) {
    if (!a.elements[path]) {
      entry.newCount += 1;
      if (entry.new.length < LIMIT) entry.new.push(path);
    }
  }
  return entry;
}

const beforeBuffer = readFileSync(beforeFile);
const afterBuffer = readFileSync(afterFile);
const beforeStates = topLevelEntries(beforeBuffer);
const afterStates = topLevelEntries(afterBuffer);

const propertyCounts = new Map();
const report = {
  limitPerState: LIMIT,
  states: {},
  differingElements: 0,
  missingElements: 0,
  newElements: 0,
  missingStates: [],
  newStates: [...afterStates.keys()].filter((state) => !beforeStates.has(state))
};
for (const [state, range] of beforeStates) {
  if (!afterStates.has(state)) {
    report.missingStates.push(state);
    continue;
  }
  const entry = compareState(
    parseState(beforeBuffer, range),
    parseState(afterBuffer, afterStates.get(state)),
    propertyCounts
  );
  report.states[state] = entry;
  report.differingElements += entry.differingCount;
  report.missingElements += entry.missingCount;
  report.newElements += entry.newCount;
}
const ranked = [...propertyCounts].sort((x, y) => y[1] - x[1]);
report.topChangedProperties = Object.fromEntries(
  ranked.filter(([prop]) => !prop.startsWith("--")).slice(0, 40)
);
report.topChangedTokens = Object.fromEntries(
  ranked.filter(([prop]) => prop.startsWith("--")).slice(0, 40)
);
report.changedTokenCount = ranked.filter(([prop]) =>
  prop.startsWith("--")
).length;

if (reportFile) writeFileSync(reportFile, JSON.stringify(report, null, 2));
for (const [state, entry] of Object.entries(report.states)) {
  console.log(
    `${state}: ${entry.compared} elements compared, ${entry.differingCount} element parts differ (${entry.styleDifferingCount} beyond tokens), ${entry.missingCount} missing, ${entry.newCount} new`
  );
}
for (const state of report.missingStates) {
  console.log(`${state}: state missing in after`);
}
for (const state of report.newStates)
  console.log(`${state}: state new in after`);
const top = Object.entries(report.topChangedProperties).slice(0, 15);
if (top.length) {
  console.log("Most changed properties (element parts affected):");
  for (const [prop, count] of top) console.log(`  ${prop}: ${count}`);
}
if (report.changedTokenCount) {
  const [token, count] = Object.entries(report.topChangedTokens)[0];
  console.log(
    `${report.changedTokenCount} design tokens changed (most: ${token} on ${count} element parts)`
  );
}
const identical =
  report.differingElements === 0 &&
  report.missingElements === 0 &&
  report.newElements === 0 &&
  !report.missingStates.length &&
  !report.newStates.length;
console.log(identical ? "IDENTICAL" : "DIFFERENT");
process.exit(identical ? 0 : 1);
