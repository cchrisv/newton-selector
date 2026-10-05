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
//   CPE_FIELD=<api name>     screen field whose editor to open (default
//                            Plan_Selector; the lab flow also has
//                            Addons_Selector and Account_Selector)
//   CPE_OUT=<dir>            output directory (default output/cpe-capture)
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

// execFileSync throws on a non-zero exit (sf's JSON status is its exit code),
// so a returned result always succeeded. A failure is rethrown with the CLI's
// own JSON error text and the subcommand that failed.
const runSf = (args) => {
  let raw;
  try {
    raw = execFileSync(SF_COMMAND, [...args, "--json"], {
      encoding: "utf8",
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
  } catch (error) {
    throw new Error(
      `sf ${args.slice(0, 3).join(" ")} failed: ${error.stdout || error.stderr || error.message}`
    );
  }
  return JSON.parse(raw.slice(raw.indexOf("{"))).result;
};

const pause = (ms) => new Promise((done) => setTimeout(done, ms));

// Reads until two consecutive reads are equal, so a capture is taken after
// rendering, transitions and smooth scrolling have finished. Throws if it
// never settles.
async function readSettled(read, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  let previous = await read();
  while (Date.now() < deadline) {
    await pause(250);
    const current = await read();
    if (JSON.stringify(current) === JSON.stringify(previous)) return current;
    previous = current;
  }
  throw new Error(`${label} kept changing for ${timeout} ms`);
}

// The position and size of every element on the page (shadow roots
// included) and every scroll offset, folded into one value.
const layoutSignature = (page) =>
  page.evaluate(() => {
    let count = 0;
    let hash = 0;
    const visit = (root) => {
      for (const el of root.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        for (const n of [r.x, r.y, r.width, r.height, el.scrollTop]) {
          hash = (Math.imul(hash, 31) + Math.round(n)) | 0;
        }
        count += 1;
        if (el.shadowRoot) visit(el.shadowRoot);
      }
    };
    visit(document);
    return `${count}:${hash}`;
  });

const layoutSettled = (page, label) =>
  readSettled(() => layoutSignature(page), `${label}: page layout`);

// Clicks a studio chapter tab, waits until it is the current one, then
// until the smooth scroll to its chapter has finished.
async function openTab(page, key) {
  const tab = `button.newton-studio__tab[data-key="${key}"]`;
  await page.locator(tab).first().click();
  await page
    .locator(`${tab}[aria-current="page"]`)
    .first()
    .waitFor({ state: "attached", timeout: 10000 });
  await layoutSettled(page, `${key} tab`);
}

// Computed style of every element under the given hosts (shadow roots
// included), keyed by a stable DOM path. Regular properties are stored as a
// hash of all of them (exact equality) plus a readable visual subset;
// custom properties (design tokens, inherited by every element) are stored
// as whole sets in their own table, since only a few distinct sets exist.
// Each distinct style or token set is stored once. Taken once two
// consecutive snapshots agree, so hover transitions have finished.
async function snapshotStyles(page, hostSelectors) {
  await page.mouse.move(0, 0);
  return readSettled(() => readStyles(page, hostSelectors), "Style snapshot");
}

function readStyles(page, hostSelectors) {
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
      if (!host) {
        throw new Error(`Style snapshot: no element matches ${selector}`);
      }
      visit(host, `${selector}#${index}`);
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
await layoutSettled(page, "Flow Builder");
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
await page
  .getByRole("button", { name: /Edit configuration|Configure selector/i })
  .first()
  .waitFor({ state: "visible", timeout: 60000 });
await layoutSettled(page, "Inline panel");
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
await layoutSettled(page, "Configuration modal");
await stage("modal-open");

for (const [i, key] of [
  "data",
  "content",
  "behavior",
  "appearance"
].entries()) {
  await openTab(page, key);
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
  await layoutSettled(page, `Appearance step ${i + 1}`);
  await page.screenshot({ path: join(OUT, `5-appearance-${i + 1}.png`) });
}

if (process.env.CPE_STYLE_SNAPSHOT) {
  await openTab(page, "data");
  const sources = page
    .locator('.newton-studio__selectorgroup[aria-label="Data source"]')
    .first();
  for (const name of [
    "Picklist",
    "Collection",
    "SOQL query",
    "Custom options"
  ]) {
    const sourceTile = sources
      .locator("c-newton-selector-choice-tile")
      .filter({
        has: page.locator(".newton-selector-choice-tile__title", {
          hasText: name
        })
      })
      .first();
    await sourceTile.locator(".newton-selector-choice-tile__title").click();
    const deadline = Date.now() + 10000;
    while (!(await sourceTile.getByRole("radio").isChecked())) {
      if (Date.now() > deadline) {
        throw new Error(`Data source tile "${name}" did not become checked`);
      }
      await pause(100);
    }
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
