import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

// Runtime feature E2E for the Newton Selector Flow Screen component.
// Deploys a multi-screen Flow that exercises every layout, selection mode,
// validation rule, option modifier and data source, then drives it in a real
// browser and asserts the Flow outputs on a results screen.
//
//   SF_TARGET_ORG=<alias> node scripts/e2e/newton-selector-runtime-e2e.mjs
//
// Optional: PLAYWRIGHT_CHANNEL=chrome (use installed Chrome),
// PLAYWRIGHT_HEADLESS=false, NEWTON_E2E_RUN_ID=<id> (artifact folder name),
// NEWTON_E2E_SOFT=1 (record failed checks and keep going instead of stopping
// at the first one).
//
// Artifacts in output/playwright/newton-selector-runtime-e2e/<runId>/:
// results.json (every check with its outcome, detail and duration),
// diagnostics.json (browser errors) and a screenshot per screen.

const TARGET_ORG = process.env.SF_TARGET_ORG;
if (!TARGET_ORG) {
  console.error("Set SF_TARGET_ORG to the alias or username of the test org.");
  process.exit(1);
}
const FLOW_API_NAME = "Newton_Selector_Features";
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== "false";
const SOFT = process.env.NEWTON_E2E_SOFT === "1";
const SF_COMMAND = process.platform === "win32" ? "sf.cmd" : "sf";
// Generated into the fixtures package directory, never into force-app.
const FLOW_SOURCE_FILE = resolve(
  "fixtures",
  "main",
  "default",
  "flows",
  `${FLOW_API_NAME}.flow-meta.xml`
);
const RUN_ID =
  process.env.NEWTON_E2E_RUN_ID ||
  new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const ARTIFACT_DIR = resolve(
  "output",
  "playwright",
  "newton-selector-runtime-e2e",
  RUN_ID
);

// ---------------------------------------------------------------------------
// Flow fixture
// ---------------------------------------------------------------------------

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function baseConfig(overrides) {
  return {
    dataSource: "custom",
    layout: "grid",
    selectionMode: "single",
    autoAdvance: false,
    enableSearch: false,
    showSelectAll: false,
    minSelections: 0,
    maxSelections: null,
    required: false,
    customErrorMessage: "",
    label: "",
    helpText: "",
    fieldLevelHelp: "",
    emptyStateMessage: "No options available.",
    errorStateMessage: "Could not load options.",
    picklist: {
      objectApiName: "",
      fieldApiName: "",
      recordTypeId: "",
      valueSource: "apiName"
    },
    collection: {
      fieldMap: {
        label: "",
        sublabel: "",
        icon: "",
        value: "",
        badge: "",
        helpText: ""
      }
    },
    sobject: {
      sObjectApiName: "",
      whereClause: "",
      orderByField: "",
      orderByDirection: "ASC",
      limit: 10,
      labelField: "",
      valueField: "Id",
      sublabelField: "",
      iconField: "",
      badgeField: "",
      helpField: ""
    },
    custom: { items: [] },
    includeNoneOption: false,
    noneOptionLabel: "--None--",
    noneOptionPosition: "start",
    overrides: {},
    display: { sortBy: "none", sortDirection: "asc", limit: null },
    gridConfig: {
      minWidth: "9rem",
      gapH: "2",
      gapV: "2",
      showIcons: true,
      showBadges: true
    },
    ...overrides
  };
}

const items = (...labels) =>
  labels.map((label) => ({
    label,
    value: label.toLowerCase().replace(/\W+/g, "-"),
    icon: "circle"
  }));

const ABC = () => items("Alpha", "Bravo", "Gamma");

function field(name, config, { type = "Account", extraInputs = "" } = {}) {
  return `
        <fields>
            <name>${name}</name>
            <dataTypeMappings>
                <typeName>T</typeName>
                <typeValue>${type}</typeValue>
            </dataTypeMappings>
            <extensionName>c:newtonSelectorFlowScreen</extensionName>
            <fieldType>ComponentInstance</fieldType>
            <inputParameters>
                <name>selectorConfigJson</name>
                <value>
                    <stringValue>${escapeXml(JSON.stringify(config))}</stringValue>
                </value>
            </inputParameters>${extraInputs}
            <inputsOnNextNavToAssocScrn>UseStoredValues</inputsOnNextNavToAssocScrn>
            <isRequired>false</isRequired>
            <storeOutputAutomatically>true</storeOutputAutomatically>
            <styleProperties>
                <verticalAlignment>
                    <stringValue>top</stringValue>
                </verticalAlignment>
                <width>
                    <stringValue>12</stringValue>
                </width>
            </styleProperties>
        </fields>`;
}

function screen(name, label, fields, next) {
  const connector = next
    ? `
        <connector>
            <targetReference>${next}</targetReference>
        </connector>`
    : "";
  return `
    <screens>
        <name>${name}</name>
        <label>${label}</label>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <allowBack>true</allowBack>
        <allowFinish>true</allowFinish>
        <allowPause>false</allowPause>${connector}${fields}
        <showFooter>true</showFooter>
        <showHeader>true</showHeader>
    </screens>`;
}

const RESULT_LINES = [
  "grid={!L_Grid.value}",
  "list={!L_List.value}",
  "horizontal={!L_Horizontal.value}",
  "picklist={!L_Picklist.value}",
  "radio={!L_Radio.value}",
  "columns={!L_Columns.value}",
  "dualCount={!L_Dual.selectionCount}",
  "keyboard={!K_Picklist.value}",
  "multiCount={!B_Multi.selectionCount}",
  "multiLabels={!B_Multi.selectedLabels}",
  "none=[{!B_None.value}] noneCount={!B_None.selectionCount}",
  "overrides={!B_Overrides.value} overridesLabel={!B_Overrides.selectedLabel}",
  "displayLabels={!B_Display.allLabels}",
  "ratingLabel={!S_Picklist.selectedLabel}",
  "soqlCount={!S_Soql.selectionCount} soqlLabel={!S_Soql.selectedLabel}",
  "collectionCount={!S_Collection.selectionCount} collectionLabel={!S_Collection.selectedLabel}",
  "auto={!A_Auto.value}"
];

function buildFlowXml() {
  const layouts = [
    field(
      "L_Grid",
      baseConfig({
        label: "L Grid",
        layout: "grid",
        required: true,
        customErrorMessage: "Grid selection is required.",
        custom: { items: ABC() }
      })
    ),
    field(
      "L_List",
      baseConfig({
        label: "L List",
        layout: "list",
        custom: { items: ABC() }
      })
    ),
    field(
      "L_Horizontal",
      baseConfig({
        label: "L Horizontal",
        layout: "horizontal",
        custom: { items: ABC() }
      })
    ),
    field(
      "L_Picklist",
      baseConfig({
        label: "L Picklist",
        layout: "picklist",
        custom: { items: ABC() }
      })
    ),
    field(
      "L_Radio",
      baseConfig({
        label: "L Radio",
        layout: "radio",
        custom: { items: ABC() }
      })
    ),
    field(
      "L_Columns",
      baseConfig({
        label: "L Columns",
        layout: "columns",
        custom: { items: ABC() }
      })
    ),
    field(
      "L_Dual",
      baseConfig({
        label: "L Dual",
        layout: "dualListbox",
        selectionMode: "multi",
        custom: { items: ABC() }
      })
    ),
    // Icon size "Large" on small tiles: the admin's explicit size must win
    // over the tile-size default.
    field(
      "I_Large_Icons",
      baseConfig({
        label: "I Large Icons",
        layout: "grid",
        custom: { items: ABC() },
        gridConfig: {
          ...baseConfig({}).gridConfig,
          size: "small",
          iconSize: "large"
        }
      })
    ),
    // Dropdown driven only by the keyboard.
    field(
      "K_Picklist",
      baseConfig({
        label: "K Picklist",
        layout: "picklist",
        custom: { items: ABC() }
      })
    )
  ].join("");

  const behavior = [
    field(
      "B_Multi",
      baseConfig({
        label: "B Multi",
        layout: "list",
        selectionMode: "multi",
        minSelections: 2,
        maxSelections: 3,
        showSelectAll: true,
        enableSearch: true,
        custom: { items: items("One", "Two", "Three", "Four", "Five") }
      })
    ),
    field(
      "B_None",
      baseConfig({
        label: "B None",
        layout: "grid",
        includeNoneOption: true,
        noneOptionLabel: "None of these",
        noneOptionPosition: "end",
        custom: { items: items("Red", "Blue") }
      })
    ),
    field(
      "B_Overrides",
      baseConfig({
        label: "B Overrides",
        layout: "list",
        custom: { items: items("Apple", "Berry", "Cherry") },
        overrides: {
          apple: { label: "Apple Renamed" },
          berry: { hidden: true }
        }
      })
    ),
    field(
      "B_Display",
      baseConfig({
        label: "B Display",
        layout: "list",
        custom: {
          items: items("Anise", "Basil", "Cumin", "Dill", "Elder")
        },
        display: { sortBy: "label", sortDirection: "desc", limit: 3 }
      })
    ),
    // Blank text is saved blank and shows the Custom Label default.
    field(
      "B_Defaults",
      baseConfig({
        label: "B Defaults",
        layout: "list",
        includeNoneOption: true,
        noneOptionLabel: "",
        manualInput: {
          enabled: true,
          label: "",
          minLength: 0,
          maxLength: null
        },
        custom: { items: items("Red", "Blue") }
      })
    ),
    field(
      "B_Empty",
      baseConfig({
        label: "B Empty",
        layout: "list",
        emptyStateMessage: "",
        custom: { items: [] }
      })
    ),
    field(
      "B_Disabled",
      baseConfig({
        label: "B Disabled",
        layout: "radio",
        custom: {
          items: [
            { label: "Open", value: "open", icon: "circle" },
            { label: "Locked", value: "locked", icon: "lock", disabled: true }
          ]
        }
      })
    )
  ].join("");

  const sources = [
    field(
      "S_Picklist",
      baseConfig({
        label: "S Picklist",
        layout: "picklist",
        dataSource: "picklist",
        picklist: {
          objectApiName: "Lead",
          fieldApiName: "Rating",
          recordTypeId: "",
          valueSource: "apiName"
        }
      }),
      { type: "Lead" }
    ),
    field(
      "S_Soql",
      baseConfig({
        label: "S Soql",
        layout: "list",
        dataSource: "sobject",
        sobject: {
          sObjectApiName: "Account",
          whereClause: "",
          orderByField: "CreatedDate",
          orderByDirection: "DESC",
          limit: 5,
          labelField: "Name",
          valueField: "Id",
          sublabelField: "Industry",
          iconField: "",
          badgeField: "",
          helpField: ""
        }
      })
    ),
    field(
      "S_Collection",
      baseConfig({
        label: "S Collection",
        layout: "list",
        dataSource: "collection",
        collection: {
          fieldMap: {
            label: "Name",
            sublabel: "Industry",
            icon: "",
            value: "Id",
            badge: "",
            helpText: ""
          }
        }
      }),
      {
        extraInputs: `
            <inputParameters>
                <name>sourceRecords</name>
                <value>
                    <elementReference>Get_Accounts</elementReference>
                </value>
            </inputParameters>`
      }
    )
  ].join("");

  const auto = field(
    "A_Auto",
    baseConfig({
      label: "A Auto",
      layout: "grid",
      autoAdvance: true,
      custom: { items: items("Go", "Stop") }
    })
  );

  const resultText = RESULT_LINES.map((line) => `<p>${line}</p>`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>66.0</apiVersion>
    <environments>Default</environments>
    <interviewLabel>Newton Selector Features {!$Flow.CurrentDateTime}</interviewLabel>
    <label>Newton Selector Features</label>
    <processMetadataValues>
        <name>BuilderType</name>
        <value>
            <stringValue>LightningFlowBuilder</stringValue>
        </value>
    </processMetadataValues>
    <processType>Flow</processType>
    <recordLookups>
        <name>Get_Accounts</name>
        <label>Get Accounts</label>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <assignNullValuesIfNoRecordsFound>false</assignNullValuesIfNoRecordsFound>
        <connector>
            <targetReference>Sources_Screen</targetReference>
        </connector>
        <getFirstRecordOnly>false</getFirstRecordOnly>
        <limit>
            <numberValue>4.0</numberValue>
        </limit>
        <object>Account</object>
        <sortField>CreatedDate</sortField>
        <sortOrder>Desc</sortOrder>
        <storeOutputAutomatically>true</storeOutputAutomatically>
    </recordLookups>${screen("Layouts_Screen", "Layouts", layouts, "Behavior_Screen")}${screen("Behavior_Screen", "Behavior", behavior, "Get_Accounts")}${screen("Sources_Screen", "Sources", sources, "Auto_Screen")}${screen("Auto_Screen", "Auto advance", auto, "Result_Screen")}
    <screens>
        <name>Result_Screen</name>
        <label>Results</label>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <allowBack>true</allowBack>
        <allowFinish>true</allowFinish>
        <allowPause>false</allowPause>
        <fields>
            <name>Result_Text</name>
            <fieldText>${escapeXml(resultText)}</fieldText>
            <fieldType>DisplayText</fieldType>
        </fields>
        <showFooter>true</showFooter>
        <showHeader>true</showHeader>
    </screens>
    <start>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <connector>
            <targetReference>Layouts_Screen</targetReference>
        </connector>
    </start>
    <status>Active</status>
</Flow>
`;
}

// ---------------------------------------------------------------------------
// Salesforce CLI helpers
// ---------------------------------------------------------------------------

function runSf(args) {
  const output = execFileSync(SF_COMMAND, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const start = output.indexOf("{");
  if (start < 0) throw new Error(`sf returned no JSON: ${output}`);
  return JSON.parse(output.slice(start));
}

function deployFlow() {
  const result = runSf([
    "project",
    "deploy",
    "start",
    "--target-org",
    TARGET_ORG,
    "--source-dir",
    FLOW_SOURCE_FILE,
    "--ignore-conflicts",
    "--json"
  ]);
  if (result.status !== 0) {
    throw new Error(`Flow deploy failed: ${JSON.stringify(result)}`);
  }
}

function runtimeUrl() {
  const result = runSf([
    "org",
    "open",
    "--target-org",
    TARGET_ORG,
    "--path",
    `/lightning/flow/${FLOW_API_NAME}`,
    "--url-only",
    "--json"
  ]);
  if (result.status !== 0) {
    throw new Error(`org open failed: ${JSON.stringify(result)}`);
  }
  return result.result.url;
}

// ---------------------------------------------------------------------------
// Run record: results.json lists every check with its outcome, detail and
// duration. A failed check stops the run unless NEWTON_E2E_SOFT=1.
// ---------------------------------------------------------------------------

const resultsPath = join(ARTIFACT_DIR, "results.json");
const diagnosticsPath = join(ARTIFACT_DIR, "diagnostics.json");
const results = {
  runId: RUN_ID,
  targetOrg: TARGET_ORG,
  flowApiName: FLOW_API_NAME,
  soft: SOFT,
  startedAt: new Date().toISOString(),
  checks: []
};
const diagnostics = { console: [], pageErrors: [] };

function recordCheck(name, ok, detail) {
  results.checks.push({ name, ok, ...(detail ? { detail } : {}) });
  console.log(JSON.stringify({ check: name, ok, ...(detail || {}) }));
  if (!ok && !SOFT) {
    throw new Error(`${name} failed: ${JSON.stringify(detail || {})}`);
  }
}

// Runs fn as one check; a thrown error is the failure detail.
async function check(name, fn) {
  const started = Date.now();
  let error = "";
  try {
    await fn();
  } catch (caught) {
    error = String(caught?.message || caught).split("\n")[0];
  }
  recordCheck(name, !error, {
    ms: Date.now() - started,
    ...(error ? { error } : {})
  });
}

function writeResults(error) {
  writeFileSync(
    resultsPath,
    JSON.stringify(
      {
        ...results,
        finishedAt: new Date().toISOString(),
        ok: !error && results.checks.every((c) => c.ok),
        failed: results.checks.filter((c) => !c.ok).map((c) => c.name),
        ...(error ? { error: String(error.message || error) } : {})
      },
      null,
      2
    ),
    "utf8"
  );
  writeFileSync(diagnosticsPath, JSON.stringify(diagnostics, null, 2), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------

const selectorFor = (page, label) =>
  page
    .locator("c-newton-selector-data-selector")
    .filter({
      has: page.locator(".newton-data-selector__label-text", {
        hasText: new RegExp(`^${label}$`)
      })
    })
    .first();

const tile = (scope, label) =>
  scope
    .locator("c-newton-selector-choice-tile")
    .filter({ hasText: label })
    .first();

async function pickTile(scope, label) {
  await tile(scope, label)
    .locator("label.newton-selector-choice-tile__label")
    .click({ timeout: 15000 });
}

async function isChecked(scope, label) {
  return tile(scope, label).locator("input").isChecked();
}

async function bodyText(page) {
  return page.locator("body").innerText({ timeout: 10000 });
}

async function waitForText(page, pattern, timeout = 60000) {
  const deadline = Date.now() + timeout;
  let text = "";
  while (Date.now() < deadline) {
    text = await bodyText(page).catch(() => "");
    if (pattern.test(text)) return text;
    await page.waitForTimeout(500);
  }
  throw new Error(
    `Timed out waiting for ${pattern}. Body: ${text.slice(0, 300)}`
  );
}

async function clickNext(page) {
  const button = page.getByRole("button", { name: /^(Next|Finish)$/ }).last();
  await button.click({ timeout: 15000 });
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

mkdirSync(ARTIFACT_DIR, { recursive: true });
writeFileSync(FLOW_SOURCE_FILE, buildFlowXml(), "utf8");

let browser;
let runError;
try {
  console.log(
    JSON.stringify({
      step: "setup",
      targetOrg: TARGET_ORG,
      flowApiName: FLOW_API_NAME,
      runId: RUN_ID,
      artifactDir: ARTIFACT_DIR,
      soft: SOFT
    })
  );
  deployFlow();

  browser = await chromium.launch({
    headless: HEADLESS,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined
  });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 1400 }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on("pageerror", (error) =>
    diagnostics.pageErrors.push({
      message: error.message,
      stack: error.stack || ""
    })
  );
  page.on("console", (message) => {
    if (message.type() === "error") {
      diagnostics.console.push({
        text: message.text(),
        location: message.location()
      });
    }
  });

  await page.goto(runtimeUrl(), {
    waitUntil: "domcontentloaded",
    timeout: 120000
  });
  await waitForText(page, /L Grid/, 120000);
  await page.waitForTimeout(2000);

  // ---- Screen 1: layouts --------------------------------------------------
  console.log("\nScreen 1 - layouts");
  const grid = selectorFor(page, "L Grid");
  const list = selectorFor(page, "L List");
  const horizontal = selectorFor(page, "L Horizontal");
  const picklist = selectorFor(page, "L Picklist");
  const radio = selectorFor(page, "L Radio");
  const columns = selectorFor(page, "L Columns");
  const dual = selectorFor(page, "L Dual");

  await check("all seven layouts render", async () => {
    for (const label of [
      "L Grid",
      "L List",
      "L Horizontal",
      "L Picklist",
      "L Radio",
      "L Columns",
      "L Dual"
    ]) {
      assert(
        await selectorFor(page, label).isVisible(),
        `${label} selector not visible`
      );
    }
  });

  await check("custom icons render as SVG children (Locker-safe)", async () => {
    const children = await grid
      .locator("c-newton-selector-icon svg")
      .first()
      .evaluate((svg) => svg.childNodes.length);
    assert(children > 0, "icon svg has no child nodes");
  });

  await page.screenshot({
    path: join(ARTIFACT_DIR, "01-layouts.png"),
    fullPage: true
  });

  await check("required selector blocks Next with custom error", async () => {
    await clickNext(page);
    await waitForText(page, /Grid selection is required\./, 15000);
  });

  await check("grid: single select", async () => {
    await pickTile(grid, "Bravo");
    assert(await isChecked(grid, "Bravo"), "Bravo not checked");
    await pickTile(grid, "Gamma");
    assert(await isChecked(grid, "Gamma"), "Gamma not checked");
    assert(!(await isChecked(grid, "Bravo")), "Bravo still checked");
  });
  await check("list: single select", async () => {
    await pickTile(list, "Alpha");
    assert(await isChecked(list, "Alpha"), "Alpha not checked");
  });
  await check("horizontal: single select", async () => {
    await pickTile(horizontal, "Bravo");
    assert(await isChecked(horizontal, "Bravo"), "Bravo not checked");
  });
  await check("picklist: open and select option", async () => {
    await picklist.getByRole("combobox").click();
    await picklist
      .locator('[role="option"][data-value="gamma"]')
      .first()
      .click();
    const label = await picklist.getByRole("combobox").innerText();
    assert(/Gamma/.test(label), `combobox shows "${label}"`);
  });
  await check("radio: single select", async () => {
    await pickTile(radio, "Alpha");
    assert(await isChecked(radio, "Alpha"), "Alpha not checked");
  });
  await check("columns: single select", async () => {
    await pickTile(columns, "Bravo");
    assert(await isChecked(columns, "Bravo"), "Bravo not checked");
  });
  await check("dual listbox: move selected to chosen", async () => {
    await pickTile(dual, "Alpha");
    await dual.getByRole("button", { name: "Move selected to chosen" }).click();
    const chosen = dual.getByRole("group", { name: "Chosen", exact: true });
    assert(/Alpha/.test(await chosen.innerText()), "Alpha not in chosen panel");
  });

  // Icon size "Large" pins the glyph at the icon component's large size
  // (newtonSelectorIcon renders it with its _size-large class), even on
  // small tiles whose default would be the small glyph.
  const largeIcons = await selectorFor(page, "I Large Icons")
    .locator(
      "c-newton-selector-choice-tile c-newton-selector-icon.newton-selector-choice-tile__icon span.newton-selector-icon"
    )
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        className: node.className,
        widthPx: Math.round(node.getBoundingClientRect().width)
      }))
    );
  recordCheck(
    'icon size "Large" renders large icons on small tiles',
    largeIcons.length === 3 &&
      largeIcons.every((icon) =>
        /\bnewton-selector-icon_size-large\b/.test(icon.className)
      ),
    {
      config: { tileSize: "small", iconSize: "large" },
      expectedClass: "newton-selector-icon_size-large",
      icons: largeIcons
    }
  );

  // Dropdown keyboard contract (WAI-ARIA select-only combobox): Enter on the
  // focused trigger opens the list with the first option active, ArrowDown
  // moves to the next option, Enter chooses it and closes the list.
  const keyboardPicklist = selectorFor(page, "K Picklist");
  const keyboardTrigger = keyboardPicklist.getByRole("combobox");
  await keyboardTrigger.focus();
  const keySteps = [];
  for (const key of ["Enter", "ArrowDown", "Enter"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(300);
    keySteps.push({
      key,
      expanded: await keyboardTrigger.getAttribute("aria-expanded"),
      activeDescendant: await keyboardTrigger.getAttribute(
        "aria-activedescendant"
      ),
      activeOption: await keyboardPicklist
        .locator(
          '[role="option"][aria-selected="true"], [role="option"].slds-has-focus'
        )
        .allInnerTexts()
        .catch(() => [])
    });
  }
  const keyboardTriggerText = (await keyboardTrigger.innerText()).trim();
  recordCheck(
    "dropdown: Enter opens, ArrowDown moves, Enter chooses the option",
    /^Bravo$/.test(keyboardTriggerText) &&
      keySteps[keySteps.length - 1].expanded !== "true",
    { expected: "Bravo", keyboardTriggerText, keySteps }
  );

  await clickNext(page);

  // ---- Screen 2: behavior -------------------------------------------------
  console.log("\nScreen 2 - behavior");
  await waitForText(page, /B Multi/);
  await page.waitForTimeout(1500);
  const multi = selectorFor(page, "B Multi");
  const none = selectorFor(page, "B None");
  const overrides = selectorFor(page, "B Overrides");
  const display = selectorFor(page, "B Display");
  const disabled = selectorFor(page, "B Disabled");
  const defaults = selectorFor(page, "B Defaults");
  const empty = selectorFor(page, "B Empty");

  await check("multi: min selections enforced", async () => {
    await pickTile(multi, "One");
    await clickNext(page);
    await waitForText(page, /at least 2 option/, 15000);
  });
  await check("multi: search filters options", async () => {
    await multi.getByLabel("Filter items").fill("Thr");
    await page.waitForTimeout(500);
    assert(await tile(multi, "Three").isVisible(), "Three hidden by search");
    assert(!(await tile(multi, "Five").isVisible()), "Five still visible");
    await multi.getByLabel("Filter items").fill("");
    await page.waitForTimeout(500);
  });
  await check("multi: select all respects max, clear all empties", async () => {
    await multi.getByRole("button", { name: "Select all" }).click();
    let checked = 0;
    for (const label of ["One", "Two", "Three", "Four", "Five"]) {
      if (await isChecked(multi, label)) checked += 1;
    }
    assert(checked === 3, `expected 3 selected (max), got ${checked}`);
    await multi.getByRole("button", { name: "Clear all" }).click();
    for (const label of ["One", "Two", "Three", "Four", "Five"]) {
      assert(!(await isChecked(multi, label)), `${label} not cleared`);
    }
  });
  await check("multi: max selections blocks extra picks", async () => {
    await pickTile(multi, "One");
    await pickTile(multi, "Two");
    await pickTile(multi, "Three");
    const fourth = tile(multi, "Four").locator("input");
    assert(await fourth.isDisabled(), "Four should be disabled at max");
  });

  await check(
    "none option: renders last and clears the picked value",
    async () => {
      const labels = await none
        .locator("c-newton-selector-choice-tile")
        .allInnerTexts();
      assert(
        /None of these/.test(labels[labels.length - 1]),
        "None option is not last"
      );
      await pickTile(none, "Red");
      assert(await isChecked(none, "Red"), "Red not selected");
      await pickTile(none, "None of these");
      assert(!(await isChecked(none, "Red")), "Red still selected after None");
      await page.waitForTimeout(500);
      const noneChecked = await isChecked(none, "None of these");
      const diag = noneChecked
        ? ""
        : await none
            .locator("c-newton-selector-group")
            .first()
            .evaluate((g) =>
              JSON.stringify({
                selectedValues: g.selectedValues,
                items: g.items.map((i) => i.value)
              })
            );
      assert(
        noneChecked,
        `None tile should show as selected after it is picked ${diag}`
      );
    }
  );
  await check("overrides: relabel and hide", async () => {
    assert(await tile(overrides, "Apple Renamed").isVisible(), "no relabel");
    assert((await tile(overrides, "Berry").count()) === 0, "Berry not hidden");
    await pickTile(overrides, "Cherry");
  });
  await check("display: sort desc and limit 3", async () => {
    const texts = (
      await display.locator("c-newton-selector-choice-tile").allInnerTexts()
    ).map((t) => t.split("\n")[0].trim());
    assert(
      JSON.stringify(texts) === JSON.stringify(["Elder", "Dill", "Cumin"]),
      `got ${JSON.stringify(texts)}`
    );
  });
  await check("blank text shows the default labels", async () => {
    const labels = (
      await defaults.locator("c-newton-selector-choice-tile").allInnerTexts()
    ).map((t) => t.split("\n")[0].trim());
    assert(labels.includes("--None--"), `no --None-- in ${labels}`);
    assert(labels.includes("Other"), `no Other in ${labels}`);
    const emptyText = await empty.innerText();
    assert(
      emptyText.includes("No options available."),
      `empty state shows ${JSON.stringify(emptyText)}`
    );
  });
  await check("disabled item cannot be chosen", async () => {
    assert(
      await tile(disabled, "Locked").locator("input").isDisabled(),
      "Locked is enabled"
    );
    await pickTile(disabled, "Open");
  });
  await page.screenshot({
    path: join(ARTIFACT_DIR, "02-behavior.png"),
    fullPage: true
  });
  await pickTile(multi, "Three"); // deselect -> 2 selected, within min/max
  await clickNext(page);

  // ---- Screen 3: data sources --------------------------------------------
  console.log("\nScreen 3 - data sources");
  await waitForText(page, /S Picklist/);
  await page.waitForTimeout(3000);
  const sPicklist = selectorFor(page, "S Picklist");
  const sSoql = selectorFor(page, "S Soql");
  const sCollection = selectorFor(page, "S Collection");

  await check("picklist source loads Lead.Rating values", async () => {
    await sPicklist.getByRole("combobox").click();
    const options = sPicklist.locator('[role="option"]');
    assert((await options.count()) >= 2, "expected picklist options");
    await options.first().click();
  });
  await check("SOQL source loads Account records", async () => {
    await sSoql
      .locator(".newton-skeleton")
      .first()
      .waitFor({ state: "detached", timeout: 30000 })
      .catch(() => {});
    const count = await sSoql.locator("c-newton-selector-choice-tile").count();
    assert(count >= 1 && count <= 5, `expected 1-5 tiles, got ${count}`);
    await sSoql.locator("c-newton-selector-choice-tile label").first().click();
  });
  await check("collection source renders Flow record collection", async () => {
    const count = await sCollection
      .locator("c-newton-selector-choice-tile")
      .count();
    assert(count >= 1 && count <= 4, `expected 1-4 tiles, got ${count}`);
    await sCollection
      .locator("c-newton-selector-choice-tile label")
      .first()
      .click();
  });
  await page.screenshot({
    path: join(ARTIFACT_DIR, "03-sources.png"),
    fullPage: true
  });
  await clickNext(page);

  // ---- Screen 4: auto advance -------------------------------------------
  console.log("\nScreen 4 - auto advance");
  await waitForText(page, /A Auto/);
  await page.waitForTimeout(1500);
  await check("auto-advance moves to results on select", async () => {
    await pickTile(selectorFor(page, "A Auto"), "Go");
    await waitForText(page, /grid=/, 30000);
  });

  // ---- Screen 5: output assertions ---------------------------------------
  console.log("\nResults - Flow outputs");
  const text = await bodyText(page);
  await page.screenshot({
    path: join(ARTIFACT_DIR, "04-results.png"),
    fullPage: true
  });
  const expectOutput = (name, pattern) =>
    check(`output ${name}`, async () => {
      const key = `${pattern.source.split("=")[0]}=`;
      const line = text.split("\n").find((entry) => entry.includes(key));
      assert(
        pattern.test(text),
        `${name} did not match ${pattern}; results screen shows "${line}"`
      );
    });
  await expectOutput("grid value", /grid=gamma/);
  await expectOutput("list value", /list=alpha/);
  await expectOutput("horizontal value", /horizontal=bravo/);
  await expectOutput("picklist value", /picklist=gamma/);
  await expectOutput("radio value", /radio=alpha/);
  await expectOutput("columns value", /columns=bravo/);
  await expectOutput("dual listbox count", /dualCount=1\b/);
  await expectOutput("keyboard-chosen dropdown value", /keyboard=bravo\b/);
  await expectOutput("multi count", /multiCount=2\b/);
  await expectOutput(
    "multi labels",
    /multiLabels=.*One.*Two|multiLabels=.*Two.*One/
  );
  await expectOutput("none option clears value", /none=\[\]/);
  await expectOutput(
    "override relabel and value",
    /overrides=cherry overridesLabel=Cherry/
  );
  await expectOutput("display labels", /displayLabels=.*Elder.*Dill.*Cumin/);
  await expectOutput("picklist source label", /ratingLabel=\S+/);
  await expectOutput("SOQL selection count", /soqlCount=1 soqlLabel=\S+/);
  await expectOutput(
    "collection selection count",
    /collectionCount=1 collectionLabel=\S+/
  );
  await expectOutput("auto-advance value", /auto=go/);

  const componentErrors = [
    ...diagnostics.pageErrors.map((entry) => entry.message),
    ...diagnostics.console.map((entry) => entry.text)
  ]
    .filter((text) => /newton|importNode|replaceChildren|TypeError/i.test(text))
    .map((text) => text.split("\n")[0]);
  recordCheck(
    "no component errors in the browser console",
    componentErrors.length === 0,
    { componentErrors: componentErrors.slice(0, 5) }
  );

  await context.close();
} catch (error) {
  runError = error;
  console.error(error.stack || error.message || error);
} finally {
  if (browser) await browser.close().catch(() => {});
  rmSync(FLOW_SOURCE_FILE, { force: true });
}

writeResults(runError);
const failed = results.checks.filter((c) => !c.ok);
console.log(
  `\n${results.checks.length - failed.length}/${results.checks.length} checks passed. Results: ${resultsPath}`
);
if (runError || failed.length) {
  for (const f of failed) console.log(` - FAILED ${f.name}`);
  process.exitCode = 1;
}
