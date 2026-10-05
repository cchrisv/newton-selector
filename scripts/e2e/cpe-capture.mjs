import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

// Opens the Newton Selector CPE in Flow Builder and captures it for review:
// the inline panel, then each modal chapter via its tab. Also records layout
// metrics and whether Flow Builder raised a "Something went wrong" dialog
// (printed and written to <CPE_OUT>/metrics.json).
//
//   SF_TARGET_ORG=<alias> node scripts/e2e/cpe-capture.mjs
//
// Deploys the draft flow Newton_Selector_CPE_Lab from the fixtures package
// directory (fixtures/main/default/flows) before opening it. Options (env):
//   CPE_VIEWPORT=1500x1050   viewport size
//   CPE_OUT=<dir>            output directory (default output/cpe-capture)
//   CPE_PANEL_WAIT=<ms>      wait for the inline panel to load (default 3000)
//   CPE_APPEARANCE_STEPS=<n> extra screenshots walking the Appearance chapter
//   CPE_STYLE_SNAPSHOT=<file> write the computed style of every element in
//                            the panel and the editor (per data source) to a
//                            JSON file; two snapshots diff with
//                            scripts/e2e/style-snapshot-diff.mjs to prove a
//                            CSS refactor changed nothing on screen
//   PLAYWRIGHT_CHANNEL=chrome  use the installed Chrome instead of Chromium

const TARGET_ORG = process.env.SF_TARGET_ORG;
if (!TARGET_ORG) {
  console.error(
    "Set SF_TARGET_ORG to the alias or username of the org to capture."
  );
  process.exit(1);
}
const [W, H] = (process.env.CPE_VIEWPORT || "1500x1050").split("x").map(Number);
const OUT = resolve(process.env.CPE_OUT || "output/cpe-capture");
const FLOW_FILE = resolve(
  "fixtures/main/default/flows/Newton_Selector_CPE_Lab.flow-meta.xml"
);
const FIELD_NAME = process.env.CPE_FIELD || "Plan_Selector";
const SF_COMMAND = process.platform === "win32" ? "sf.cmd" : "sf";

mkdirSync(OUT, { recursive: true });

const runSf = (args) => {
  const raw = execFileSync(SF_COMMAND, [...args, "--json"], {
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  const result = JSON.parse(raw.slice(raw.indexOf("{")));
  if (result.status !== 0) {
    throw new Error(`sf ${args.join(" ")} failed: ${raw}`);
  }
  return result.result;
};

// Computed style of every element under the given hosts (shadow roots
// included), keyed by a stable DOM path. Regular properties are stored as a
// hash of all of them (exact equality) plus a readable visual subset;
// custom properties (design tokens, inherited by every element) are stored
// as whole sets in their own table, since only a few distinct sets exist.
// Each distinct style or token set is stored once.
async function snapshotStyles(page, hostSelectors) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  return page.evaluate((selectors) => {
    const READABLE =
      /^(display|position|inset|top|right|bottom|left|width|height|min-|max-|margin|padding|border|outline|box-shadow|background|color|opacity|visibility|font|line-height|letter-spacing|text-|gap|row-gap|column-gap|grid|flex|align|justify|place|order|overflow|transform|z-index|aspect-ratio|content|clip-path|filter|cursor)/;
    const hash = (text) => {
      let h1 = 0xdeadbeef;
      let h2 = 0x41c6ce57;
      for (let i = 0; i < text.length; i += 1) {
        const c = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 2654435761);
        h2 = Math.imul(h2 ^ c, 1597334677);
      }
      h1 =
        Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
        Math.imul(h2 ^ (h2 >>> 13), 3266489909);
      h2 =
        Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
        Math.imul(h1 ^ (h1 >>> 13), 3266489909);
      return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
    };
    const tables = { styles: [], tokens: [] };
    const ids = { styles: new Map(), tokens: new Map() };
    const intern = (table, key, text) => {
      if (!ids[table].has(key)) {
        ids[table].set(key, tables[table].length);
        tables[table].push(text());
      }
      return ids[table].get(key);
    };
    // Sorted: the computed list follows declaration order, which a pure
    // reordering of rules changes without changing any value.
    const idOf = (style) => {
      const props = Array.from(style).sort();
      const value = (prop) => `${prop}:${style.getPropertyValue(prop)}`;
      const regular = props.filter((prop) => !prop.startsWith("--"));
      const custom = props.filter((prop) => prop.startsWith("--"));
      const full = regular.map(value).join(";");
      const tokenText = custom.map(value).join(";");
      const fullKey = hash(full);
      return [
        intern(
          "styles",
          fullKey,
          () =>
            `#${fullKey};` +
            regular
              .filter((prop) => READABLE.test(prop))
              .map(value)
              .join(";")
        ),
        intern("tokens", hash(tokenText), () => tokenText)
      ];
    };
    const elements = {};
    const visit = (node, path) => {
      elements[path] = [
        idOf(getComputedStyle(node)),
        idOf(getComputedStyle(node, "::before")),
        idOf(getComputedStyle(node, "::after"))
      ];
      // An icon's SVG internals aren't styled by component CSS and number in
      // the thousands, so record the <svg> itself but not its paths.
      if (node.tagName.toLowerCase() === "svg") return;
      const children = [
        ...(node.shadowRoot ? node.shadowRoot.children : []),
        ...node.children
      ];
      const seen = {};
      for (const child of children) {
        const tag = child.tagName.toLowerCase();
        seen[tag] = (seen[tag] || 0) + 1;
        visit(child, `${path}>${tag}:${seen[tag]}`);
      }
    };
    selectors.forEach((selector, index) => {
      const find = (root) => {
        const hit = root.querySelector(selector);
        if (hit) return hit;
        for (const el of root.querySelectorAll("*")) {
          if (el.shadowRoot) {
            const inner = find(el.shadowRoot);
            if (inner) return inner;
          }
        }
        return null;
      };
      const host = find(document);
      if (host) visit(host, `${selector}#${index}`);
    });
    return { ...tables, elements };
  }, hostSelectors);
}
const styleSnapshot = {};

runSf([
  "project",
  "deploy",
  "start",
  "--target-org",
  TARGET_ORG,
  "--source-dir",
  FLOW_FILE,
  "--ignore-conflicts"
]);
const { url } = runSf([
  "org",
  "open",
  "--target-org",
  TARGET_ORG,
  "--source-file",
  FLOW_FILE,
  "--url-only"
]);

const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || undefined
});
const page = await (
  await browser.newContext({ viewport: { width: W, height: H } })
).newPage();
page.setDefaultTimeout(60000);

const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
});
page.on("pageerror", (e) => consoleErrors.push(e.message.slice(0, 300)));

// Everything printed below is also written to <CPE_OUT>/metrics.json.
const report = { viewport: [W, H], stages: [], layout: null };

// Flow Builder renders its own error modals; a non-zero count means a
// component threw (the CPE's document click handler once did on every click).
const stage = async (name) => {
  const entry = {
    stage: name,
    errorDialogs: await page.getByText("Something went wrong").count(),
    errors: consoleErrors.length,
    ...(consoleErrors.length ? { lastErrors: consoleErrors.slice(-3) } : {})
  };
  report.stages.push(entry);
  console.log(JSON.stringify(entry));
};

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {});
for (const name of ["Skip", "Got It", "Got it", "Close"]) {
  const b = page.getByRole("button", { name }).first();
  if (await b.isVisible().catch(() => false)) await b.click().catch(() => {});
}
await page.waitForTimeout(4000);
await stage("builder-loaded");

// Free-form canvas: the first Screen node sits under the Start element. The
// editor occasionally needs a second double-click to open.
for (let attempt = 0; attempt < 4; attempt += 1) {
  await page.mouse.dblclick(520, 340);
  const opened = await page
    .getByText(FIELD_NAME, { exact: true })
    .last()
    .waitFor({ state: "attached", timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  if (opened) break;
}
await page.getByText(FIELD_NAME, { exact: true }).last().click({
  force: true,
  timeout: 60000
});
await page.waitForTimeout(Number(process.env.CPE_PANEL_WAIT || 3000));
await stage("field-selected-inline-panel");
await page.screenshot({ path: join(OUT, "00-inline-panel.png") });
if (process.env.CPE_STYLE_SNAPSHOT) {
  styleSnapshot.panel = await snapshotStyles(page, [
    "c-newton-selector-flow-cpe"
  ]);
}

// Open the editor and wait until all four chapters have rendered their cards.
await page
  .getByRole("button", { name: /Edit configuration|Configure selector/i })
  .first()
  .click();
await page.waitForSelector("c-newton-selector-flow-cpe-studio", {
  timeout: 60000
});
await page.waitForFunction(
  () => {
    const count = (root) => {
      let n = root.querySelectorAll(".newton-studio__card").length;
      root.querySelectorAll("*").forEach((el) => {
        if (el.shadowRoot) n += count(el.shadowRoot);
      });
      return n;
    };
    return count(document) >= 20;
  },
  null,
  { timeout: 60000, polling: 50 }
);
await page.waitForTimeout(2500);
await stage("modal-open");

for (const [i, key] of [
  "data",
  "content",
  "behavior",
  "appearance"
].entries()) {
  await page
    .locator(`button.newton-studio__tab[data-key="${key}"]`)
    .first()
    .click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, `${i + 1}-${key}.png`) });
}

report.layout = await page.evaluate(() => {
  const deep = (root, sel, out = []) => {
    root.querySelectorAll(sel).forEach((n) => out.push(n));
    root.querySelectorAll("*").forEach((n) => {
      if (n.shadowRoot) deep(n.shadowRoot, sel, out);
    });
    return out;
  };
  const scroller = deep(document, ".newton-studio__scroll")[0];
  const chapters = Object.fromEntries(
    ["data", "content", "behavior", "appearance"].map((key) => {
      const host = deep(document, `[data-chapter="${key}"]`).find((n) =>
        n.tagName.startsWith("C-")
      );
      return [
        key,
        host ? Math.round(host.getBoundingClientRect().height) : null
      ];
    })
  );
  return {
    scrollHeight: scroller?.scrollHeight,
    clientHeight: scroller?.clientHeight,
    chapters,
    cardCount: deep(document, ".newton-studio__card").length
  };
});
console.log(JSON.stringify({ viewport: [W, H], ...report.layout }));

// Walk the Appearance chapter (the tallest) in viewport-sized steps.
const steps = Number(process.env.CPE_APPEARANCE_STEPS || 0);
for (let i = 0; i < steps; i += 1) {
  await page.evaluate((index) => {
    const deep = (root, sel, out = []) => {
      root.querySelectorAll(sel).forEach((n) => out.push(n));
      root.querySelectorAll("*").forEach((n) => {
        if (n.shadowRoot) deep(n.shadowRoot, sel, out);
      });
      return out;
    };
    const scroller = deep(document, ".newton-studio__scroll")[0];
    const host = deep(document, '[data-chapter="appearance"]').find((n) =>
      n.tagName.startsWith("C-")
    );
    const top =
      host.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop;
    scroller.scrollTop = top + index * (scroller.clientHeight - 60);
  }, i);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, `5-appearance-${i + 1}.png`) });
}

if (process.env.CPE_STYLE_SNAPSHOT) {
  await page
    .locator('button.newton-studio__tab[data-key="data"]')
    .first()
    .click();
  await page.waitForTimeout(800);
  const sources = page
    .locator('.newton-studio__selectorgroup[aria-label="Data source"]')
    .first();
  for (const name of [
    "Picklist",
    "Collection",
    "SOQL query",
    "Custom options"
  ]) {
    await sources
      .locator(".newton-selector-choice-tile__title", { hasText: name })
      .first()
      .click();
    await page.waitForTimeout(1500);
    styleSnapshot[name] = await snapshotStyles(page, [
      "c-newton-selector-flow-cpe-studio",
      "lightning-modal-footer"
    ]);
  }
  writeFileSync(
    resolve(process.env.CPE_STYLE_SNAPSHOT),
    JSON.stringify(styleSnapshot)
  );
  console.log(
    JSON.stringify({
      styleSnapshot: process.env.CPE_STYLE_SNAPSHOT,
      states: Object.keys(styleSnapshot),
      elements: Object.values(styleSnapshot).reduce(
        (n, s) => n + Object.keys(s.elements).length,
        0
      )
    })
  );
}

await stage("done");
writeFileSync(join(OUT, "metrics.json"), JSON.stringify(report, null, 2));
await browser.close();
