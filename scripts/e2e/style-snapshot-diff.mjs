import { readFileSync, writeFileSync } from "node:fs";

// Compares two CPE_STYLE_SNAPSHOT files from cpe-capture.mjs and reports every
// element whose computed style (or ::before/::after style) differs. Exits 1
// when anything differs, so a CSS refactor that claims "no visual change" can
// prove it.
//
//   node scripts/e2e/style-snapshot-diff.mjs before.json after.json [report.json]

const [beforeFile, afterFile, reportFile] = process.argv.slice(2);
const before = JSON.parse(readFileSync(beforeFile, "utf8"));
const after = JSON.parse(readFileSync(afterFile, "utf8"));

const parse = (text) =>
  Object.fromEntries(
    text
      .split(";")
      .filter((pair) => pair.includes(":"))
      .map((pair) => {
        const at = pair.indexOf(":");
        return [pair.slice(0, at), pair.slice(at + 1)];
      })
  );

const report = { states: {}, differingElements: 0, missingElements: 0 };
for (const state of Object.keys(before)) {
  const a = before[state];
  const b = after[state];
  const entry = { compared: 0, differing: [], missing: [] };
  report.states[state] = entry;
  if (!b) {
    entry.missing.push("(state missing in after)");
    report.missingElements += 1;
    continue;
  }
  for (const [path, ids] of Object.entries(a.elements)) {
    const other = b.elements[path];
    if (!other) {
      entry.missing.push(path);
      report.missingElements += 1;
      continue;
    }
    entry.compared += 1;
    ["element", "::before", "::after"].forEach((part, index) => {
      const [styleA, tokensA] = ids[index];
      const [styleB, tokensB] = other[index];
      const x = `${a.styles[styleA]};${a.tokens[tokensA]}`;
      const y = `${b.styles[styleB]};${b.tokens[tokensB]}`;
      if (x === y) return;
      const px = parse(x);
      const py = parse(y);
      const changed = Object.keys({ ...px, ...py })
        .filter((prop) => px[prop] !== py[prop])
        .map((prop) => `${prop}: ${px[prop]} → ${py[prop]}`);
      entry.differing.push({
        path,
        part,
        changed: changed.length
          ? changed.slice(0, 12)
          : ["(a property outside the readable subset changed)"]
      });
      report.differingElements += 1;
    });
  }
  for (const path of Object.keys(b.elements)) {
    if (!a.elements[path]) {
      entry.missing.push(`(new) ${path}`);
      report.missingElements += 1;
    }
  }
}

if (reportFile) writeFileSync(reportFile, JSON.stringify(report, null, 2));
for (const [state, entry] of Object.entries(report.states)) {
  console.log(
    `${state}: ${entry.compared} elements compared, ${entry.differing.length} differ, ${entry.missing.length} missing`
  );
}
const identical =
  report.differingElements === 0 && report.missingElements === 0;
console.log(identical ? "IDENTICAL" : "DIFFERENT");
process.exit(identical ? 0 : 1);
