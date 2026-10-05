import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const TARGET_ORG = process.env.SF_TARGET_ORG;
if (!TARGET_ORG) {
  console.error("Set SF_TARGET_ORG to the alias or username of the test org.");
  process.exit(1);
}
// NEWTON_E2E_SOFT=1 records a failed check and keeps going, so one run lists
// every failing check in results.json. By default the first failure stops it.
const SOFT = process.env.NEWTON_E2E_SOFT === "1";
const FLOW_API_NAME = "Newton_Selector_E2E";
const FLOW_LABEL = "Newton Selector E2E";
const SCREEN_LABEL = "Newton Selector E2E Screen";
const RUN_ID =
  process.env.NEWTON_E2E_RUN_ID ||
  new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const COMPANY = "NewtonE2ECompany";
const EDITED_LABEL = "E2E Custom Selector Edited";
const LABEL_RESOURCE = "E2E_Label_Text";
const DEFAULT_RESOURCE = "E2E_Default_Value";
// Optional: reuse existing Leads (comma-separated LastNames, two or more) instead
// of creating temporary ones, e.g. when the org has no free data storage.
const EXISTING_LEADS = (process.env.NEWTON_E2E_EXISTING_LEADS || "")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);
const USE_EXISTING_LEADS = EXISTING_LEADS.length >= 2;
const LEAD_ALPHA = USE_EXISTING_LEADS
  ? EXISTING_LEADS[0]
  : `NewtonE2EAlpha${RUN_ID}`;
const LEAD_BETA = USE_EXISTING_LEADS
  ? EXISTING_LEADS[1]
  : `NewtonE2EBeta${RUN_ID}`;
const LEAD_WHERE_CLAUSE = USE_EXISTING_LEADS
  ? `LastName IN (${EXISTING_LEADS.map((name) => `'${name}'`).join(", ")})`
  : `Company = '${COMPANY}'`;
const SETUP_ONLY = process.env.NEWTON_E2E_SETUP_ONLY === "true";
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== "false";
const SF_COMMAND = process.platform === "win32" ? "sf.cmd" : "sf";
// Generated into the fixtures package directory, never into force-app.
const FLOW_SOURCE_FILE = resolve(
  "fixtures",
  "main",
  "default",
  "flows",
  `${FLOW_API_NAME}.flow-meta.xml`
);
const ARTIFACT_DIR = resolve(
  "output",
  "playwright",
  "flow-builder-newton-selector-e2e",
  RUN_ID
);

const screenshots = {
  builderLoaded: join(ARTIFACT_DIR, "01-builder-loaded.png"),
  screenEditor: join(ARTIFACT_DIR, "02-screen-editor.png"),
  modal: join(ARTIFACT_DIR, "03-config-modal.png"),
  invalidModal: join(ARTIFACT_DIR, "03a-invalid-config-modal.png"),
  afterSave: join(ARTIFACT_DIR, "04-builder-after-save.png"),
  debugRuntime: join(ARTIFACT_DIR, "05-debug-runtime.png"),
  done: join(ARTIFACT_DIR, "06-debug-done.png")
};
const diagnosticsPath = join(ARTIFACT_DIR, "diagnostics.json");

const temporaryLeadIds = [];
const diagnosticPages = new WeakSet();
const diagnostics = {
  console: [],
  pageErrors: [],
  requestFailures: []
};

// Run record written to results.json in the artifact directory: every check
// with its outcome and the timing of each config change, so a run can be
// verified and compared after the fact.
const resultsPath = join(ARTIFACT_DIR, "results.json");
const results = {
  runId: RUN_ID,
  targetOrg: TARGET_ORG,
  soft: SOFT,
  startedAt: new Date().toISOString(),
  checks: [],
  configChangeTimingsMs: []
};

// What the editor showed during the sweep, reported with the checks that
// verify the saved Flow afterwards.
const observed = {};

function recordCheck(name, ok, detail) {
  results.checks.push({ name, ok, ...(detail ? { detail } : {}) });
  console.log(JSON.stringify({ check: name, ok, ...(detail || {}) }));
  assert(ok || SOFT, `${name} failed: ${JSON.stringify(detail || {})}`);
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
}

function runSf(args) {
  const output = execFileSync(SF_COMMAND, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  return parseFirstJson(output);
}

function parseFirstJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    if (start < 0) {
      throw new Error(`Salesforce CLI did not return JSON: ${raw}`);
    }
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < raw.length; i += 1) {
      const ch = raw[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
      } else if (ch === "{") {
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          return JSON.parse(raw.slice(start, i + 1));
        }
      }
    }
    throw new Error(`Could not parse Salesforce CLI JSON: ${raw}`);
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXml(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isProductDiagnosticText(text) {
  return /newton|professor flow|Newton selector|custom_selector|newtonselectorflowscreen|Newton_Selector|c-newton|TypeError|ReferenceError|Unhandled|Cannot read|undefined is not|is not a function/i.test(
    text || ""
  );
}

function attachDiagnosticsToPage(page) {
  if (!page || diagnosticPages.has(page)) return;
  diagnosticPages.add(page);

  page.on("console", (message) => {
    if (
      message.type() !== "error" &&
      !isProductDiagnosticText(message.text())
    ) {
      return;
    }
    diagnostics.console.push({
      type: message.type(),
      text: message.text(),
      location: message.location(),
      url: page.url()
    });
  });
  page.on("pageerror", (error) => {
    diagnostics.pageErrors.push({
      message: error?.message || String(error),
      stack: error?.stack || "",
      url: page.url()
    });
  });
  page.on("requestfailed", (request) => {
    diagnostics.requestFailures.push({
      method: request.method(),
      url: request.url(),
      failure: request.failure()?.errorText || ""
    });
  });
}

function attachDiagnosticsToContext(context) {
  context.on("page", attachDiagnosticsToPage);
}

// An error counts against Newton Selector only when it names our code.
// Generic TypeErrors thrown wholly inside Salesforce's own Flow Builder
// modules (e.g. screenPropertiesEditorContainer failing to describe a
// component right after a deploy) are platform noise, not product defects.
const OWN_CODE = /newton/i;

function actionableDiagnostics() {
  const consoleErrors = diagnostics.console.filter(
    (entry) =>
      entry.type === "error" &&
      isProductDiagnosticText(entry.text) &&
      OWN_CODE.test(entry.text)
  );
  const pageErrors = diagnostics.pageErrors.filter((entry) => {
    const text = `${entry.message}\n${entry.stack}`;
    return isProductDiagnosticText(text) && OWN_CODE.test(text);
  });
  const requestFailures = diagnostics.requestFailures.filter(
    (entry) =>
      /newton|Newton_Selector|flowruntime|flowbuilder/i.test(entry.url) &&
      !/ERR_ABORTED|aborted|cancelled|canceled/i.test(entry.failure)
  );
  return { consoleErrors, pageErrors, requestFailures };
}

function writeDiagnostics() {
  writeFileSync(
    diagnosticsPath,
    JSON.stringify(
      { ...diagnostics, actionable: actionableDiagnostics() },
      null,
      2
    ),
    "utf8"
  );
}

function assertNoActionableBrowserDiagnostics() {
  const actionable = actionableDiagnostics();
  const total =
    actionable.consoleErrors.length +
    actionable.pageErrors.length +
    actionable.requestFailures.length;
  if (!total) return;
  throw new Error(
    `Browser diagnostics found ${total} selector-relevant issue(s). See ${diagnosticsPath}`
  );
}

async function assertPageText(context, pattern, label, timeout = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const text = await context
      .locator("body")
      .innerText({ timeout: 5000 })
      .catch(() => "");
    if (pattern.test(text)) {
      return text;
    }
    await context.waitForTimeout(1000);
  }
  const finalText = await context
    .locator("body")
    .innerText({ timeout: 5000 })
    .catch(() => "");
  throw new Error(
    `${label} did not appear. Expected ${pattern}. Body starts with: ${finalText.slice(
      0,
      1200
    )}`
  );
}

async function dismissTransientUi(page) {
  for (const name of ["Skip", "Got It", "Got it", "Close"]) {
    const button = page.getByRole("button", { name }).first();
    if (
      (await button.count()) &&
      (await button.isVisible().catch(() => false))
    ) {
      await button.click({ timeout: 2000 }).catch(() => {});
    }
  }
}

function defaultConfig(overrides = {}) {
  return {
    dataSource: "custom",
    layout: "grid",
    selectionMode: "single",
    autoAdvance: false,
    enableSearch: true,
    showSelectAll: false,
    minSelections: 0,
    maxSelections: null,
    required: false,
    customErrorMessage: "Select an E2E option.",
    label: "",
    helpText: "",
    fieldLevelHelp: "",
    emptyStateMessage: "No E2E options available.",
    errorStateMessage: "Could not load E2E options.",
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
      orderByField: "CreatedDate",
      orderByDirection: "DESC",
      limit: 10,
      labelField: "LastName",
      valueField: "Id",
      sublabelField: "Company",
      iconField: "",
      badgeField: "Rating",
      helpField: ""
    },
    custom: { items: [] },
    includeNoneOption: false,
    noneOptionLabel: "--None--",
    noneOptionPosition: "start",
    overrides: {},
    display: { sortBy: "none", sortDirection: "asc", limit: null },
    gridConfig: {
      minWidth: "16rem",
      gapH: "7",
      gapV: "7",
      margin: {
        top: "none",
        right: "none",
        bottom: "none",
        left: "none",
        linked: true
      },
      padding: { top: "", right: "", bottom: "", left: "", linked: true },
      size: "medium",
      aspectRatio: "1:1",
      badge: {
        position: "bottom-inline",
        variant: "neutral",
        shape: "pill",
        variantHex: ""
      },
      columns: null,
      selectionIndicator: "checkmark",
      elevation: "outlined",
      pattern: "none",
      patternTone: "neutral",
      patternHoverTone: "",
      patternSelectedTone: "brand",
      patternDisabledTone: "neutral",
      cornerStyle: "none",
      cornerTone: "neutral",
      surfaceStyle: "solid",
      surfaceTone: "neutral",
      surfaceHoverTone: "",
      surfaceSelectedTone: "brand",
      surfaceDisabledTone: "neutral",
      iconDecor: "none",
      iconStyle: "filled",
      iconShading: "flat",
      iconTone: "neutral",
      iconToneHex: "",
      iconGlyphTone: "auto",
      iconGlyphToneHex: "",
      patternToneHex: "",
      patternHoverToneHex: "",
      patternSelectedToneHex: "",
      patternDisabledToneHex: "",
      cornerToneHex: "",
      surfaceToneHex: "",
      surfaceHoverToneHex: "",
      surfaceSelectedToneHex: "",
      surfaceDisabledToneHex: "",
      showIcons: true,
      showBadges: true
    },
    ...overrides
  };
}

function customConfig(label) {
  return defaultConfig({
    dataSource: "custom",
    label,
    helpText: "Custom options rendered by the E2E Flow.",
    custom: {
      items: [
        {
          label: "E2E Custom Alpha",
          value: "custom-alpha",
          sublabel: "Custom A",
          icon: "list-checks",
          badge: "A",
          helpText: "First custom option"
        },
        {
          label: "E2E Custom Beta",
          value: "custom-beta",
          sublabel: "Custom B",
          icon: "list-checks",
          badge: "B",
          helpText: "Second custom option"
        },
        {
          label: "E2E Custom Gamma",
          value: "custom-gamma",
          sublabel: "Custom C",
          icon: "list-checks",
          badge: "C",
          helpText: "Third custom option"
        }
      ]
    }
  });
}

function picklistConfig() {
  return defaultConfig({
    dataSource: "picklist",
    label: "E2E Rating Selector",
    helpText: "Picklist mode.",
    picklist: {
      objectApiName: "Lead",
      fieldApiName: "Rating",
      recordTypeId: "",
      valueSource: "apiName"
    }
  });
}

function sobjectConfig() {
  return defaultConfig({
    dataSource: "sobject",
    label: "E2E SOQL Lead Selector",
    helpText: "SOQL-backed Lead mode.",
    sobject: {
      sObjectApiName: "Lead",
      whereClause: LEAD_WHERE_CLAUSE,
      orderByField: "CreatedDate",
      orderByDirection: "DESC",
      limit: 10,
      labelField: "LastName",
      valueField: "Id",
      sublabelField: "Company",
      iconField: "",
      badgeField: "Rating",
      helpField: ""
    }
  });
}

function collectionConfig() {
  return defaultConfig({
    dataSource: "collection",
    label: "E2E Collection Lead Selector",
    helpText: "Flow record collection mode.",
    collection: {
      fieldMap: {
        label: "LastName",
        sublabel: "Company",
        icon: "",
        value: "Id",
        badge: "Rating",
        helpText: ""
      }
    }
  });
}

function componentFieldXml(name, config, extraInputs = "") {
  return `
        <fields>
            <name>${name}</name>
            <dataTypeMappings>
                <typeName>T</typeName>
                <typeValue>Lead</typeValue>
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

function leadLookupFiltersXml() {
  const filters = USE_EXISTING_LEADS
    ? EXISTING_LEADS.map((name) => ["LastName", name])
    : [["Company", COMPANY]];
  return filters
    .map(
      ([field, value]) => `
        <filters>
            <field>${field}</field>
            <operator>EqualTo</operator>
            <value>
                <stringValue>${escapeXml(value)}</stringValue>
            </value>
        </filters>`
    )
    .join("");
}

function buildFlowXml() {
  const collectionInput = `
            <inputParameters>
                <name>sourceRecords</name>
                <value>
                    <elementReference>Get_E2E_Leads</elementReference>
                </value>
            </inputParameters>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>66.0</apiVersion>
    <areMetricsLoggedToDataCloud>false</areMetricsLoggedToDataCloud>
    <customProperties>
        <name>ScreenProgressIndicator</name>
        <value>
            <stringValue>{&quot;location&quot;:&quot;top&quot;,&quot;type&quot;:&quot;simple&quot;}</stringValue>
        </value>
    </customProperties>
    <environments>Default</environments>
    <interviewLabel>${FLOW_LABEL} {!$Flow.CurrentDateTime}</interviewLabel>
    <label>${FLOW_LABEL}</label>
    <processMetadataValues>
        <name>BuilderType</name>
        <value>
            <stringValue>LightningFlowBuilder</stringValue>
        </value>
    </processMetadataValues>
    <processMetadataValues>
        <name>CanvasMode</name>
        <value>
            <stringValue>AUTO_LAYOUT_CANVAS</stringValue>
        </value>
    </processMetadataValues>
    <processMetadataValues>
        <name>OriginBuilderType</name>
        <value>
            <stringValue>LightningFlowBuilder</stringValue>
        </value>
    </processMetadataValues>
    <processType>Flow</processType>
    <recordLookups>
        <name>Get_E2E_Leads</name>
        <label>Get E2E Leads</label>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <assignNullValuesIfNoRecordsFound>false</assignNullValuesIfNoRecordsFound>
        <connector>
            <targetReference>Newton_Selector_E2E_Screen</targetReference>
        </connector>
        <filterLogic>${USE_EXISTING_LEADS ? "or" : "and"}</filterLogic>${leadLookupFiltersXml()}
        <getFirstRecordOnly>false</getFirstRecordOnly>
        <limit>
            <numberValue>10.0</numberValue>
        </limit>
        <object>Lead</object>
        <sortField>CreatedDate</sortField>
        <sortOrder>Desc</sortOrder>
        <storeOutputAutomatically>true</storeOutputAutomatically>
    </recordLookups>
    <screens>
        <name>Newton_Selector_E2E_Screen</name>
        <label>${SCREEN_LABEL}</label>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <allowBack>true</allowBack>
        <allowFinish>true</allowFinish>
        <allowPause>false</allowPause>
        <connector>
            <targetReference>Done_Screen</targetReference>
        </connector>${componentFieldXml(
          "Custom_Selector",
          customConfig("E2E Custom Selector")
        )}${componentFieldXml(
          "Picklist_Selector",
          picklistConfig()
        )}${componentFieldXml("SObject_Selector", sobjectConfig())}${componentFieldXml(
          "Collection_Selector",
          collectionConfig(),
          collectionInput
        )}
        <showFooter>true</showFooter>
        <showHeader>true</showHeader>
    </screens>
    <screens>
        <name>Done_Screen</name>
        <label>E2E Done</label>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <allowBack>true</allowBack>
        <allowFinish>true</allowFinish>
        <allowPause>false</allowPause>
        <fields>
            <name>Done_Text</name>
            <fieldText>&lt;p&gt;E2E Flow completed.&lt;/p&gt;&lt;p&gt;Custom: {!Custom_Selector.selectedLabel}&lt;/p&gt;&lt;p&gt;Rating: {!Picklist_Selector.selectedLabel}&lt;/p&gt;&lt;p&gt;SOQL: {!SObject_Selector.selectedLabel}&lt;/p&gt;&lt;p&gt;Collection: {!Collection_Selector.selectedLabel}&lt;/p&gt;</fieldText>
            <fieldType>DisplayText</fieldType>
            <styleProperties>
                <verticalAlignment>
                    <stringValue>top</stringValue>
                </verticalAlignment>
                <width>
                    <stringValue>12</stringValue>
                </width>
            </styleProperties>
        </fields>
        <showFooter>true</showFooter>
        <showHeader>true</showHeader>
    </screens>
    <start>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <connector>
            <targetReference>Get_E2E_Leads</targetReference>
        </connector>
    </start>
    <status>Draft</status>${textVariableXml(LABEL_RESOURCE, EDITED_LABEL)}${textVariableXml(
      DEFAULT_RESOURCE,
      "custom-beta"
    )}
</Flow>
`;
}

// Flow text variables the CPE's resource pickers offer: one for the Selector
// label (merge field) and one for the Default selection (value input).
function textVariableXml(name, value) {
  return `
    <variables>
        <name>${name}</name>
        <dataType>String</dataType>
        <isCollection>false</isCollection>
        <isInput>false</isInput>
        <isOutput>false</isOutput>
        <value>
            <stringValue>${escapeXml(value)}</stringValue>
        </value>
    </variables>`;
}

function writeFlowFixture() {
  writeFileSync(FLOW_SOURCE_FILE, buildFlowXml(), "utf8");
}

function removeFlowFixture() {
  rmSync(FLOW_SOURCE_FILE, { force: true });
}

function createLead(lastName, rating) {
  const values = `LastName=${lastName} Company=${COMPANY} Rating=${rating} Email=${lastName}@example.com`;
  const result = runSf([
    "data",
    "create",
    "record",
    "--target-org",
    TARGET_ORG,
    "--sobject",
    "Lead",
    "--values",
    process.platform === "win32" ? `"${values}"` : values,
    "--json"
  ]);
  assert(result.status === 0, `Lead create failed: ${JSON.stringify(result)}`);
  temporaryLeadIds.push(result.result.id);
  return result.result.id;
}

function deleteTemporaryLeads() {
  for (const id of temporaryLeadIds) {
    try {
      runSf([
        "data",
        "delete",
        "record",
        "--target-org",
        TARGET_ORG,
        "--sobject",
        "Lead",
        "--record-id",
        id,
        "--json"
      ]);
    } catch (error) {
      console.warn(`Could not delete temporary Lead ${id}: ${error.message}`);
    }
  }
}

function deployFlowFixture() {
  const result = runSf([
    "project",
    "deploy",
    "start",
    "--target-org",
    TARGET_ORG,
    "--source-dir",
    FLOW_SOURCE_FILE,
    "--json"
  ]);
  assert(
    result.status === 0,
    `Flow fixture deploy failed: ${JSON.stringify(result)}`
  );
}

function openFlowBuilderUrl() {
  const result = runSf([
    "org",
    "open",
    "--target-org",
    TARGET_ORG,
    "--source-file",
    FLOW_SOURCE_FILE,
    "--url-only",
    "--json"
  ]);
  assert(
    result.status === 0,
    `Could not open Flow Builder: ${JSON.stringify(result)}`
  );
  return result.result.url;
}

function findFile(startDir, fileName) {
  if (!existsSync(startDir)) return null;
  for (const entry of readdirSync(startDir, { withFileTypes: true })) {
    const entryPath = join(startDir, entry.name);
    if (entry.isDirectory()) {
      const nested = findFile(entryPath, fileName);
      if (nested) return nested;
    } else if (entry.name === fileName) {
      return entryPath;
    }
  }
  return null;
}

function flowFieldInputBlocks(xml, fieldName) {
  const fieldBlocks = xml.match(/<fields>[\s\S]*?<\/fields>/g) || [];
  const fieldBlock = fieldBlocks.find((block) =>
    block.includes(`<name>${fieldName}</name>`)
  );
  assert(fieldBlock, `Could not find Flow screen field ${fieldName}.`);
  return (
    fieldBlock.match(/<inputParameters>[\s\S]*?<\/inputParameters>/g) || []
  );
}

// The saved value of one component input, e.g. { elementReference: "X" } or
// { stringValue: "..." }; null when the input is not set.
function extractComponentInput(xml, fieldName, inputName) {
  const block = flowFieldInputBlocks(xml, fieldName).find((entry) =>
    entry.includes(`<name>${inputName}</name>`)
  );
  if (!block) return null;
  const valueMatch = block.match(
    /<value>\s*<(\w+)>([\s\S]*?)<\/\1>\s*<\/value>/
  );
  return valueMatch ? { [valueMatch[1]]: decodeXml(valueMatch[2].trim()) } : {};
}

function extractSelectorConfigFromFlowXml(xml, fieldName) {
  const configBlock = flowFieldInputBlocks(xml, fieldName).find((block) =>
    block.includes("<name>selectorConfigJson</name>")
  );
  assert(configBlock, `Could not find selectorConfigJson for ${fieldName}.`);

  const valueMatch = configBlock.match(
    /<stringValue>([\s\S]*?)<\/stringValue>/
  );
  assert(valueMatch, `selectorConfigJson has no stringValue for ${fieldName}.`);
  return JSON.parse(decodeXml(valueMatch[1].trim()));
}

function retrieveAndAssertPersistedConfig() {
  const retrieveDir = join(ARTIFACT_DIR, "retrieved");
  rmSync(retrieveDir, { recursive: true, force: true });
  const result = runSf([
    "project",
    "retrieve",
    "start",
    "--metadata",
    `Flow:${FLOW_API_NAME}`,
    "--target-org",
    TARGET_ORG,
    "--output-dir",
    retrieveDir,
    "--json"
  ]);
  assert(
    result.status === 0,
    `Flow retrieve after Builder save failed: ${JSON.stringify(result)}`
  );

  const flowXmlPath = findFile(retrieveDir, `${FLOW_API_NAME}.flow-meta.xml`);
  assert(flowXmlPath, `Retrieved Flow XML was not found under ${retrieveDir}.`);
  const xml = readFileSync(flowXmlPath, "utf8");
  const config = extractSelectorConfigFromFlowXml(xml, "Custom_Selector");

  recordCheck(
    "a Flow resource picked for Selector label saves as a merge field",
    config.label === `{!${LABEL_RESOURCE}}`,
    {
      expected: `{!${LABEL_RESOURCE}}`,
      savedLabel: config.label,
      labelInEditorAfterPick: observed.labelInEditorAfterPick
    }
  );
  const valueInput = extractComponentInput(xml, "Custom_Selector", "value");
  recordCheck(
    "Default selection saves as the component's value input",
    valueInput?.elementReference === DEFAULT_RESOURCE,
    {
      expected: { elementReference: DEFAULT_RESOURCE },
      savedValueInput: valueInput,
      defaultSelectionField: observed.defaultSelectionField
    }
  );
  assert(
    config.dataSource === "custom",
    `Saved Selector dataSource did not persist. Got ${config.dataSource}`
  );
  assert(
    config.layout === "grid",
    `Saved Selector layout did not persist. Got ${config.layout}`
  );
  assert(
    config.selectionMode === "single",
    `Saved Selector selectionMode did not persist. Got ${config.selectionMode}`
  );
  assert(
    config.gridConfig?.size === "medium",
    `Saved Selector tile size did not persist. Got ${config.gridConfig?.size}`
  );
  assert(
    config.gridConfig?.aspectRatio === "1:1",
    `Saved Selector aspect ratio did not persist. Got ${config.gridConfig?.aspectRatio}`
  );
  assert(
    config.gridConfig?.iconDecor === "ring",
    `Saved Selector icon decoration did not persist. Got ${config.gridConfig?.iconDecor}`
  );
  assert(
    config.gridConfig?.patternSelectedTone === "brand",
    `Saved Selector selected pattern color did not persist. Got ${config.gridConfig?.patternSelectedTone}`
  );
  assert(
    config.gridConfig?.surfaceHoverTone === "teal",
    `Saved Selector hover surface color did not persist. Got ${config.gridConfig?.surfaceHoverTone}`
  );

  return { flowXmlPath, config };
}

// Dispatches an event only. Never write properties or styles onto components
// from here: foreign writes into Lightning-managed DOM make every later
// re-render slower, which is what stalled this script in the Appearance sweep.
async function dispatchCustomEvent(locator, eventName, detail) {
  await locator.evaluate(
    (node, payload) => {
      node.dispatchEvent(
        new CustomEvent(payload.eventName, {
          detail: payload.detail,
          bubbles: true,
          composed: true
        })
      );
    },
    { eventName, detail }
  );
}

async function dispatchCardSelect(page, ariaLabel, value) {
  const label = ariaLabel.includes(" - ")
    ? `${ariaLabel}, ${ariaLabel.replace(" - ", " \u2014 ")}`
    : ariaLabel;
  const selector = label
    .split(", ")
    .map((entry) => `.newton-studio__selectorgroup[aria-label="${entry}"]`)
    .join(", ");
  const group = page.locator(selector).first();
  await assertVisible(group, `selector group "${ariaLabel}"`);
  await dispatchCustomEvent(group, "cardselect", { value });
}

async function activateStudioSection(page, key) {
  const studio = page.locator("c-newton-selector-flow-cpe-studio").first();
  await assertVisible(studio, "Newton Selector studio");
  await dispatchCustomEvent(studio, "sectionclick", key);
  await page.waitForTimeout(250);
}

// Types the value into the field and tabs out, as a user would. Writing
// `value` onto the component from outside (the old approach) makes Lightning's
// component framework do more work on every later re-render, until each config
// change in the modal takes minutes.
async function dispatchValueChanged(locator, newValue) {
  await assertVisible(locator, "value editor");
  const input = locator.locator("input, textarea").first();
  await input.fill(newValue, { timeout: 15000 });
  // Merge-field fields open a suggestion menu as you type, and a menu left
  // open covers later controls. Commit with Tab, then dismiss the menu the way
  // a user does: click somewhere neutral (the field closes it on an outside
  // click). Escape is not used: with no menu open it would close the modal.
  const page = locator.page();
  await page.waitForTimeout(400);
  await input.press("Tab");
  await page.getByText("Component preview", { exact: true }).first().click();
  await page.waitForTimeout(250);
}

// Clicks the toggle's real On/Off option, as a user would. Assigning `checked`
// onto the component and firing a synthetic event instead leaves the host and
// its template out of step, and every later config change in the modal then
// takes twice as long as the one before (minutes by the Appearance sweep).
async function dispatchToggle(locator, checked) {
  await assertVisible(locator, "toggle");
  await locator
    .locator(`button[data-checked="${checked ? "true" : "false"}"]`)
    .first()
    .click({ timeout: 15000 });
}

async function dispatchSelectionMode(page, mode) {
  const toggle = page
    .locator(
      "c-newton-selector-flow-cpe-behavior-config c-newton-selector-flow-cpe-toggle"
    )
    .first();
  await dispatchToggle(toggle, mode === "multi");
}

async function dispatchConfigPatch(locator, path, value) {
  await assertVisible(locator, "config component");
  await dispatchCustomEvent(locator, "configpatch", { path, value });
}

async function assertVisible(locator, label, timeout = 30000) {
  await locator.waitFor({ state: "attached", timeout });
  const visible = await locator.isVisible().catch(() => false);
  assert(visible, `${label} is not visible`);
}

async function clickFirstVisible(locator, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const count = await locator.count().catch(() => 0);
    for (let i = 0; i < count; i += 1) {
      const candidate = locator.nth(i);
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click({ timeout: 5000 });
        return;
      }
    }
    await locator.page().waitForTimeout(500);
  }
  throw new Error(`${label} was not visible`);
}

async function modalSaveButton(page) {
  const saveButton = page.getByRole("button", { name: /^Save$/ }).last();
  await assertVisible(saveButton, "modal save button");
  return saveButton;
}

async function assertModalSaveDisabled(page, issuePattern, label) {
  await assertPageText(page, issuePattern, label, 30000);
  const saveButton = await modalSaveButton(page);
  assert(
    await saveButton.isDisabled(),
    `Modal Save button was enabled for invalid state: ${label}`
  );
}

async function assertModalSaveEnabled(page, label) {
  const saveButton = await modalSaveButton(page);
  assert(
    !(await saveButton.isDisabled().catch(() => false)),
    `Modal Save button was disabled after restoring valid state: ${label}`
  );
}

async function exerciseInvalidBuilderStates(page) {
  const dataConfig = page.locator("c-newton-selector-flow-cpe-data-config");

  await dispatchCardSelect(page, "Data source", "collection");
  await assertModalSaveDisabled(
    page,
    /Choose the record collection variable\./,
    "collection mode missing Flow record binding"
  );

  await dispatchCustomEvent(dataConfig, "refchange", {
    name: "sourceRecordsRef",
    value: "{!Get_E2E_Leads}"
  });
  await dispatchConfigPatch(
    dataConfig,
    ["collection", "fieldMap", "label"],
    ""
  );
  await assertModalSaveDisabled(
    page,
    /Choose the field to show as each option's label\./,
    "collection mode missing label field mapping"
  );

  await dispatchCardSelect(page, "Data source", "custom");
  await dispatchConfigPatch(dataConfig, ["custom", "items"], []);
  await assertModalSaveDisabled(
    page,
    /Add at least one option\./,
    "custom mode missing custom items"
  );
  await page.screenshot({ path: screenshots.invalidModal, fullPage: true });
  const saveStatus = page.locator(".newton-modal__status").first();
  const saveStatusText = (
    await saveStatus.textContent({ timeout: 10000 }).catch(() => "")
  ).trim();
  recordCheck(
    "a disabled Save says why, next to the button",
    /^1 error to fix · Data: Add at least one option\.$/.test(saveStatusText),
    { saveStatusText }
  );
  const errorRowColor = await page
    .locator(".newton-studio__issue_error")
    .first()
    .evaluate((node) => getComputedStyle(node).color)
    .catch(() => "");
  const [red, green] = (errorRowColor.match(/\d+/g) || []).map(Number);
  recordCheck(
    "an error in the issues list is styled as an error",
    red > 120 && green < 90,
    { errorRowColor }
  );

  await dispatchCustomEvent(dataConfig, "refchange", {
    name: "sourceRecordsRef",
    value: ""
  });
  await dispatchConfigPatch(
    dataConfig,
    ["custom", "items"],
    customConfig("E2E Custom Selector").custom.items
  );
  await assertModalSaveEnabled(page, "invalid-state recovery");
}

// Every text field in the editor (inputs, pickers, search boxes, the
// resource picker, the filter builder) is drawn as the same box. Returns the
// box each visible field draws: the nearest element with an outline.
async function measureTextFields(page) {
  return page.evaluate(() => {
    const all = [];
    const walk = (root) => {
      root.querySelectorAll("*").forEach((node) => {
        all.push(node);
        if (node.shadowRoot) walk(node.shadowRoot);
      });
    };
    walk(document);
    const scroller = all.find((node) =>
      node.classList?.contains("newton-studio__scroll")
    );
    if (!scroller) return [];
    const area = scroller.getBoundingClientRect();
    const parentOf = (node) =>
      node.parentElement || node.getRootNode?.().host || null;
    const isField = (node) =>
      node.matches?.(
        'input:not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="range"]):not([type="hidden"]), textarea, select, button[role="combobox"]'
      );
    const visible = (node) => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return (
        box.width > 40 &&
        box.height > 12 &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        Number(style.opacity) > 0 &&
        box.right > area.left &&
        box.left < area.right
      );
    };
    const outlineOf = (node) => {
      let current = node;
      for (let depth = 0; current && depth < 5; depth += 1) {
        const style = getComputedStyle(current);
        if (
          parseFloat(style.borderTopWidth) >= 1 &&
          style.borderTopStyle !== "none" &&
          current.getBoundingClientRect().height >= 24
        ) {
          return current;
        }
        current = parentOf(current);
      }
      return node;
    };
    const labelOf = (node) =>
      node.getAttribute("aria-label") ||
      node.getAttribute("placeholder") ||
      node.getAttribute("name") ||
      node.id ||
      node.tagName.toLowerCase();
    const seen = new Set();
    return all
      .filter((node) => isField(node) && visible(node))
      .map((node) => {
        const box = outlineOf(node);
        if (seen.has(box)) return null;
        seen.add(box);
        const rect = box.getBoundingClientRect();
        const style = getComputedStyle(box);
        return {
          field: labelOf(node),
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          look: [
            `height ${Math.round(rect.height)}`,
            `border ${style.borderTopWidth} ${style.borderTopColor}`,
            `radius ${style.borderTopLeftRadius}`,
            `fill ${style.backgroundColor}`,
            `text ${getComputedStyle(node).fontSize}`
          ].join(" · ")
        };
      })
      .filter(Boolean);
  });
}

function recordTextFieldChecks(passes) {
  const fields = passes.flat();
  const looks = {};
  for (const field of fields) {
    (looks[field.look] ||= []).push(field.field);
  }
  writeFileSync(
    join(ARTIFACT_DIR, "text-fields.json"),
    JSON.stringify({ fields, looks }, null, 2)
  );
  recordCheck(
    "every text field in the editor is the same box",
    fields.length > 10 && Object.keys(looks).length === 1,
    {
      fieldCount: fields.length,
      looks: Object.fromEntries(
        Object.entries(looks).map(([look, names]) => [look, names.slice(0, 5)])
      )
    }
  );
  // Fields placed side by side (same row, not overlapping) share a top edge.
  const misaligned = [];
  for (const pass of passes) {
    for (const a of pass) {
      for (const b of pass) {
        const sideBySide = a.right <= b.left && b.left - a.right < 48;
        if (
          sideBySide &&
          Math.abs(a.top - b.top) > 1 &&
          Math.abs(a.top - b.top) < 40
        ) {
          misaligned.push(`${a.field} (${a.top}) / ${b.field} (${b.top})`);
        }
      }
    }
  }
  recordCheck("fields side by side line up", misaligned.length === 0, {
    misaligned
  });
}

// Copy and behavior an admin relies on to understand and fix the setup:
// named option controls, recoverable override clearing, an honest query
// limit, a quiet blank filter, reachable min/max limits, and layout names
// that don't collide with data sources or selection modes.
async function exerciseClarity(page) {
  const dataConfig = page.locator("c-newton-selector-flow-cpe-data-config");
  await activateStudioSection(page, "data");

  const deleteAlpha = page.getByRole("button", {
    name: "Delete E2E Custom Alpha",
    exact: true
  });
  const moveBetaUp = page.getByRole("button", {
    name: "Move E2E Custom Beta up",
    exact: true
  });
  recordCheck(
    "option row buttons name the option they act on",
    (await deleteAlpha.count()) === 1 && (await moveBetaUp.count()) === 1,
    {
      deleteAlpha: await deleteAlpha.count(),
      moveBetaUp: await moveBetaUp.count()
    }
  );

  await clickTile(page, "Data source", "SOQL query");
  await dispatchConfigPatch(dataConfig, ["sobject", "sObjectApiName"], "Lead");
  await dispatchConfigPatch(dataConfig, ["sobject", "limit"], "");
  await page.waitForTimeout(600);
  const queryPreview = (
    await page
      .locator('code[aria-label="Generated SOQL preview"]')
      .first()
      .textContent({ timeout: 10000 })
      .catch(() => "")
  ).trim();
  recordCheck(
    "an empty Limit previews the 50 rows the runtime loads",
    /LIMIT 50$/.test(queryPreview),
    { queryPreview }
  );
  const soqlFields = await measureTextFields(page);
  const blankFilterNagging = await page
    .getByText(/Finish this condition|Complete field, operator/)
    .first()
    .isVisible()
    .catch(() => false);
  recordCheck(
    "an untouched blank filter condition shows no error",
    !blankFilterNagging
  );
  const overrideToggle = page.locator(
    ".newton-studio__override-mode c-newton-selector-flow-cpe-toggle"
  );
  await dispatchToggle(overrideToggle, true);
  await dispatchConfigPatch(dataConfig, ["overrides"], {
    "custom-alpha": { label: "Override Alpha" }
  });
  await dispatchToggle(overrideToggle, false);
  const clearedVisible = await page
    .getByText("Overrides cleared.", { exact: false })
    .first()
    .isVisible()
    .catch(() => false);
  await page
    .getByRole("button", { name: "Undo", exact: true })
    .first()
    .click({ timeout: 10000 })
    .catch(() => {});
  await page.waitForTimeout(400);
  const restored = await dataConfig
    .first()
    .evaluate((node) => JSON.parse(JSON.stringify(node.config || {})))
    .then((config) => config.overrides?.["custom-alpha"]?.label || "");
  recordCheck(
    "switching overrides to Default can be undone",
    clearedVisible && restored === "Override Alpha",
    { clearedVisible, restored }
  );
  await dispatchConfigPatch(dataConfig, ["overrides"], {});
  await dispatchToggle(overrideToggle, false);

  await clickTile(page, "Data source", "Custom options");

  await activateStudioSection(page, "behavior");
  await dispatchSelectionMode(page, "multi");
  const minField = page.getByLabel("Minimum selections", { exact: true });
  const maxField = page.getByLabel("Maximum selections", { exact: true });
  await minField.fill("3");
  await minField.press("Tab");
  await maxField.fill("2");
  await maxField.press("Tab");
  await page.waitForTimeout(400);
  const minMaxStatus = (
    await page
      .locator(".newton-modal__status")
      .first()
      .textContent({ timeout: 5000 })
      .catch(() => "")
  ).trim();
  const saveBlocked = await (await modalSaveButton(page)).isDisabled();
  await maxField.fill("4");
  await maxField.press("Tab");
  await page.waitForTimeout(400);
  const saveRestored = !(await (await modalSaveButton(page)).isDisabled());
  recordCheck(
    "min and max selections can be set and their error fixed in the editor",
    /Behavior: Maximum selections must be at least the minimum, and at least 1\./.test(
      minMaxStatus
    ) &&
      saveBlocked &&
      saveRestored,
    { minMaxStatus, saveBlocked, saveRestored }
  );
  recordTextFieldChecks([soqlFields, await measureTextFields(page)]);
  await minField.fill("");
  await minField.press("Tab");
  await maxField.fill("");
  await maxField.press("Tab");
  await dispatchSelectionMode(page, "single");

  await activateStudioSection(page, "appearance");
  const titles = (
    await page
      .locator(
        '.newton-studio__selectorgroup[aria-label="Layout"] .newton-selector-choice-tile__title'
      )
      .allTextContents()
  ).map((title) => title.trim());
  recordCheck(
    "layout names don't reuse data source or selection mode words",
    titles.includes("Dropdown") &&
      titles.includes("Dual listbox") &&
      !titles.includes("Picklist") &&
      !titles.includes("Multi-select"),
    { titles }
  );
  await activateStudioSection(page, "data");
}

// The resource picker (text box + Flow resource menu) whose label reads
// exactly `label`, inside the editor chapter `chapterTag`.
function resourceField(page, chapterTag, label) {
  return page
    .locator(`${chapterTag} c-newton-selector-flow-cpe-resource-selector`)
    .filter({
      has: page.locator("label", {
        hasText: new RegExp(`^\\s*${label.replace(/[()]/g, "\\$&")}\\s*$`)
      })
    });
}

// Picks a Flow variable from a resource picker the way an admin does: click
// the box, clear any text in it, click the variable in the menu.
async function pickFlowResource(field, apiName) {
  const page = field.page();
  const input = field.locator("input").first();
  await input.click({ timeout: 15000 });
  // Filter the list the way an admin does, by typing part of the name: the
  // typed filter text must not be saved instead of the picked resource.
  await input.fill(apiName.slice(0, 8), { timeout: 15000 });
  await page.waitForTimeout(800);
  const option = field
    .locator(`[role="option"][data-value="${apiName}"]`)
    .first();
  await option.waitFor({ state: "visible", timeout: 15000 });
  await option.click({ timeout: 15000 });
  await page.waitForTimeout(600);
  return (await field.innerText().catch(() => "")).trim();
}

// The SOQL source's visual filter builder, driven with real clicks and typing:
// an unfinished condition blocks Save without dropping the finished ones from
// the query, and number fields compare unquoted.
async function exerciseWhereBuilder(page) {
  const dataConfig = page.locator("c-newton-selector-flow-cpe-data-config");
  const whereBuilder = page
    .locator("c-newton-selector-flow-cpe-where-builder")
    .first();
  const conditions = whereBuilder.locator(".cc-where-condition");
  const preview = page
    .locator('code[aria-label="Generated SOQL preview"]')
    .first();
  const readPreview = async () =>
    (await preview.textContent({ timeout: 10000 }).catch(() => "")).trim();
  const readStatus = async () =>
    (
      await page
        .locator(".newton-modal__status")
        .first()
        .textContent({ timeout: 5000 })
        .catch(() => "")
    ).trim();
  const builderState = async () => ({
    conditionCount: await conditions.count(),
    manualMode:
      (await whereBuilder.getByText("Manual WHERE clause").count()) > 0,
    queryPreview: await readPreview()
  });
  const chooseField = async (condition, apiName) => {
    const fieldInput = condition.locator('input[role="combobox"]').first();
    await fieldInput.click({ timeout: 15000 });
    await fieldInput.fill(apiName, { timeout: 15000 });
    await condition
      .locator('[role="option"]', { hasText: apiName })
      .first()
      .click({ timeout: 20000 });
    await page.waitForTimeout(600);
  };
  const neutralClick = () =>
    page.getByText("Component preview", { exact: true }).first().click();

  await activateStudioSection(page, "data");
  await clickTile(page, "Data source", "SOQL query");
  await dispatchConfigPatch(dataConfig, ["sobject", "sObjectApiName"], "Lead");
  await page.waitForTimeout(2500);

  // A saved filter with one finished condition, then the admin adds a second
  // condition and picks its field but no value yet.
  await dispatchConfigPatch(
    dataConfig,
    ["sobject", "whereClause"],
    "Rating = 'Hot'"
  );
  await page.waitForTimeout(1000);
  await whereBuilder.locator("button.cc-where-add").first().click();
  await page.waitForTimeout(600);
  await chooseField(conditions.nth(1), "LastName");
  await neutralClick();
  await page.waitForTimeout(800);
  const incomplete = await builderState();
  recordCheck(
    "an unfinished filter condition keeps the finished ones in the query",
    /\bWHERE Rating = 'Hot'/.test(incomplete.queryPreview),
    { expectedFragment: "WHERE Rating = 'Hot'", ...incomplete }
  );
  const expectedStatus =
    "1 error to fix · Data: Finish or remove the highlighted filter condition.";
  const incompleteStatus = await readStatus();
  const saveDisabledWhileIncomplete = await (
    await modalSaveButton(page)
  ).isDisabled();
  await page.screenshot({
    path: join(ARTIFACT_DIR, "03b-incomplete-filter.png"),
    fullPage: true
  });
  recordCheck(
    "an unfinished filter condition blocks Save and says why",
    saveDisabledWhileIncomplete && incompleteStatus === expectedStatus,
    {
      expectedStatus,
      saveStatusText: incompleteStatus,
      saveDisabled: saveDisabledWhileIncomplete
    }
  );

  await whereBuilder
    .getByRole("button", { name: "Remove condition", exact: true })
    .nth(1)
    .click({ timeout: 15000 });
  await page.waitForTimeout(800);
  const saveEnabledAfterRemove = !(await (
    await modalSaveButton(page)
  ).isDisabled());
  const afterRemove = await builderState();
  recordCheck(
    "removing the unfinished filter condition re-enables Save",
    saveEnabledAfterRemove &&
      afterRemove.conditionCount === 1 &&
      /\bWHERE Rating = 'Hot'/.test(afterRemove.queryPreview),
    {
      saveEnabled: saveEnabledAfterRemove,
      saveStatusText: await readStatus(),
      ...afterRemove
    }
  );

  // From a blank filter (removing the last condition leaves a blank one):
  // NumberOfEmployees = 5, typed as an admin would.
  await whereBuilder
    .getByRole("button", { name: "Remove condition", exact: true })
    .first()
    .click({ timeout: 15000 });
  await page.waitForTimeout(1000);
  const first = conditions.nth(0);
  await chooseField(first, "NumberOfEmployees");
  await first
    .locator(
      'c-newton-selector-flow-cpe-choice-control button[role="combobox"]'
    )
    .first()
    .click({ timeout: 15000 });
  await first
    .locator('[role="option"][data-value="="]')
    .first()
    .click({ timeout: 15000 });
  const valueInput = first
    .locator("c-newton-selector-flow-cpe-resource-selector input")
    .first();
  await valueInput.fill("5", { timeout: 15000 });
  await page.waitForTimeout(400);
  // The value box must survive its own typing; if it is gone, the builder
  // replaced the condition and the detail below says how.
  const valueBoxKept = (await valueInput.count()) === 1;
  if (valueBoxKept) {
    await valueInput.press("Tab");
    await neutralClick();
  }
  await page.waitForTimeout(600);
  const numberState = await builderState();
  recordCheck(
    "a number filter value previews unquoted",
    /\bWHERE NumberOfEmployees = 5\b/.test(numberState.queryPreview),
    {
      expectedFragment: "WHERE NumberOfEmployees = 5",
      valueBoxKept,
      ...numberState
    }
  );

  // Leave the selector as it was: no filter, Custom options.
  await dispatchConfigPatch(dataConfig, ["sobject", "whereClause"], "");
  await page.waitForTimeout(600);
  await clickTile(page, "Data source", "Custom options");
}

// Diagnostic: NEWTON_E2E_SKIP=invalid,sources,content,behavior skips those
// phases of the config sweep so a slowdown can be bisected.
const SKIP_PHASES = new Set(
  (process.env.NEWTON_E2E_SKIP || "").split(",").filter(Boolean)
);

async function exerciseAllConfigChapters(page) {
  await assertPageText(page, /Configure Newton Selector/i, "config modal");
  await page.screenshot({ path: screenshots.modal, fullPage: true });

  if (!SKIP_PHASES.has("invalid")) {
    console.log(JSON.stringify({ step: "invalid-states" }));
    await exerciseInvalidBuilderStates(page);
    await exerciseClarity(page);
    await exerciseWhereBuilder(page);
    console.log(JSON.stringify({ step: "chapters" }));
  }

  if (!SKIP_PHASES.has("sources")) {
    const sourceModes = ["picklist", "collection", "sobject", "custom"];
    for (const value of sourceModes) {
      await dispatchCardSelect(page, "Data source", value);
    }
  }

  if (!SKIP_PHASES.has("content")) {
    await activateStudioSection(page, "content");
    const contentFields = page.locator(
      "c-newton-selector-flow-cpe-content-config c-newton-selector-flow-cpe-resource-selector"
    );
    await dispatchValueChanged(contentFields.nth(0), EDITED_LABEL);
    // Then bind the label to a Flow text variable through the picker; the
    // saved config must keep the merge-field wrapper (checked after Save).
    await pickFlowResource(
      resourceField(
        page,
        "c-newton-selector-flow-cpe-content-config",
        "Selector label"
      ),
      LABEL_RESOURCE
    );
    observed.labelInEditorAfterPick = await page
      .locator("c-newton-selector-flow-cpe-content-config")
      .first()
      .evaluate((node) => node.config?.label ?? null);
    await page.getByText("Component preview", { exact: true }).first().click();
    await dispatchValueChanged(
      contentFields.nth(1),
      "Edited help text from Playwright."
    );
    await dispatchValueChanged(
      contentFields.nth(2),
      "Edited tooltip from Playwright."
    );
    await dispatchValueChanged(contentFields.nth(3), "E2E empty state");
    await dispatchValueChanged(contentFields.nth(4), "E2E error state");
  }
  if (!SKIP_PHASES.has("behavior")) {
    await activateStudioSection(page, "behavior");
    await dispatchSelectionMode(page, "multi");
    await dispatchToggle(
      page.locator(
        'c-newton-selector-flow-cpe-behavior-config c-newton-selector-flow-cpe-toggle[data-key="required"]'
      ),
      true
    );
    await dispatchSelectionMode(page, "single");
    await dispatchToggle(
      page.locator(
        'c-newton-selector-flow-cpe-behavior-config c-newton-selector-flow-cpe-toggle[data-key="autoAdvance"]'
      ),
      false
    );
    await dispatchToggle(
      page.locator(
        'c-newton-selector-flow-cpe-behavior-config c-newton-selector-flow-cpe-toggle[data-key="includeNoneOption"]'
      ),
      true
    );
    await dispatchValueChanged(
      resourceField(
        page,
        "c-newton-selector-flow-cpe-behavior-config",
        "Error message (optional)"
      ).first(),
      "None of these"
    );
    await dispatchCardSelect(page, "None option position", "end");
    await dispatchToggle(
      page.locator(
        'c-newton-selector-flow-cpe-behavior-config c-newton-selector-flow-cpe-toggle[data-key="enableSearch"]'
      ),
      true
    );
    await dispatchToggle(
      page.locator(
        'c-newton-selector-flow-cpe-behavior-config c-newton-selector-flow-cpe-toggle[data-key="includeNoneOption"]'
      ),
      false
    );
  }
  await activateStudioSection(page, "appearance");
  const appearanceSelections = [
    ["Layout", "grid"],
    ["Layout", "list"],
    ["Layout", "horizontal"],
    ["Layout", "picklist"],
    ["Layout", "radio"],
    ["Layout", "columns"],
    ["Layout", "dualListbox"],
    ["Layout", "grid"],
    ["Tile size", "small"],
    ["Tile size", "medium"],
    ["Tile size", "large"],
    ["Aspect ratio", "1:1"],
    ["Aspect ratio", "4:3"],
    ["Aspect ratio", "16:9"],
    ["Aspect ratio", "3:4"],
    ["Tile elevation", "outlined"],
    ["Tile elevation", "plain"],
    ["Tile elevation", "raised"],
    ["Pattern", "none"],
    ["Pattern", "dots"],
    ["Pattern", "lines"],
    ["Pattern", "diagonal"],
    ["Pattern", "grid"],
    ["Pattern", "glow"],
    ["Pattern", "noise"],
    ["Pattern", "paper"],
    ["Pattern", "waves"],
    ["Corner style", "none"],
    ["Corner style", "trim"],
    ["Corner style", "brackets"],
    ["Corner style", "dots"],
    ["Surface style", "solid"],
    ["Surface style", "gradient-top"],
    ["Surface style", "gradient-radial"],
    ["Surface style", "gradient-diagonal"],
    ["Surface style", "tint"],
    ["Icon decoration", "none"],
    ["Icon decoration", "ring"],
    ["Icon decoration", "halo"],
    ["Icon decoration", "badge"],
    ["Icon decoration", "square"],
    ["Icon style", "filled"],
    ["Icon style", "outlined"],
    ["Icon style", "soft"],
    ["Icon style", "glow"],
    ["Icon style", "filled"],
    ["Icon shading", "flat"],
    ["Icon shading", "gradient"],
    ["Icon shading", "emboss"],
    ["Icon size", "xx-small"],
    ["Icon size", "x-small"],
    ["Icon size", "small"],
    ["Icon size", "medium"],
    ["Icon size", "large"],
    ["Selection indicator", "checkmark"],
    ["Selection indicator", "fill"],
    ["Selection indicator", "bar"],
    ["Horizontal gap", "none"],
    ["Horizontal gap", "1"],
    ["Horizontal gap", "4"],
    ["Horizontal gap", "7"],
    ["Vertical gap", "none"],
    ["Vertical gap", "1"],
    ["Vertical gap", "4"],
    ["Vertical gap", "7"],
    ["Margin - all sides", "none"],
    ["Margin - all sides", "2"],
    ["Padding - all sides", ""],
    ["Padding - all sides", "3"]
  ];
  const limit = Number(process.env.NEWTON_E2E_APPEARANCE_LIMIT || 0);
  for (const [label, value] of limit
    ? appearanceSelections.slice(0, limit)
    : appearanceSelections) {
    const started = Date.now();
    await dispatchCardSelect(page, label, value);
    const elapsed = Date.now() - started;
    results.configChangeTimingsMs.push({ label, value, ms: elapsed });
    const dialogs = await page.getByText("Something went wrong").count();
    console.log(
      JSON.stringify({
        t: new Date().toISOString().slice(11, 19),
        step: "appearance-select",
        label,
        value,
        ms: elapsed,
        errorDialogs: dialogs,
        consoleErrors: diagnostics.console.length,
        pageErrors: diagnostics.pageErrors.length
      })
    );
    if (elapsed > 20000 || dialogs) {
      await page.screenshot({
        path: join(ARTIFACT_DIR, `slow-${label.replace(/\W+/g, "_")}.png`),
        fullPage: true
      });
    }
  }

  // Every config change must stay responsive across the whole sweep. A
  // per-change cost that grows (the config-proxy bug doubled it each edit)
  // fails this long before the sweep ends.
  const budgetMs = Number(process.env.NEWTON_E2E_STEP_BUDGET_MS || 2000);
  const slowest = results.configChangeTimingsMs.reduce(
    (max, entry) => (entry.ms > max.ms ? entry : max),
    { ms: 0 }
  );
  recordCheck(
    "config changes stay under the latency budget",
    slowest.ms <= budgetMs,
    {
      changes: results.configChangeTimingsMs.length,
      budgetMs,
      slowestMs: slowest.ms,
      slowestStep: slowest.label ? `${slowest.label}=${slowest.value}` : null
    }
  );

  const appearance = page.locator(
    "c-newton-selector-flow-cpe-appearance-config"
  );
  for (const [label, value] of [
    ["Columns", "3"],
    ["Pattern selected color", "brand"],
    ["Corner color", "success"],
    ["Surface hover color", "teal"],
    ["Icon color", "warning"],
    ["Icon glyph color", "contrast"],
    ["Badge color", "brand"]
  ]) {
    await appearance
      .locator(`[aria-label="${label}"] [data-value="${value}"]`)
      .first()
      .click({ force: true, timeout: 15000 });
  }
  // Badge position and shape are tile pickers: click them by title.
  await clickTile(page, "Badge position", "Top right");
  await clickTile(page, "Badge shape", "Square");

  await dispatchConfigPatch(appearance, ["gridConfig", "showIcons"], false);
  await dispatchConfigPatch(appearance, ["gridConfig", "showIcons"], true);
  await dispatchConfigPatch(appearance, ["gridConfig", "showBadges"], false);
  await dispatchConfigPatch(appearance, ["gridConfig", "showBadges"], true);

  await activateStudioSection(page, "data");
  await dispatchCardSelect(page, "Data source", "custom");
  await activateStudioSection(page, "appearance");
  await dispatchCardSelect(page, "Layout", "grid");
  await activateStudioSection(page, "behavior");
  await dispatchSelectionMode(page, "single");
  await activateStudioSection(page, "appearance");
  await dispatchCardSelect(page, "Tile size", "medium");
  await dispatchCardSelect(page, "Aspect ratio", "1:1");
  await dispatchCardSelect(page, "Tile elevation", "outlined");
  await dispatchCardSelect(page, "Pattern", "none");
  await dispatchCardSelect(page, "Surface style", "solid");
  await dispatchCardSelect(page, "Corner style", "none");
  await dispatchCardSelect(page, "Icon decoration", "ring");
  await dispatchCardSelect(page, "Selection indicator", "checkmark");
  await dispatchConfigPatch(
    appearance,
    ["gridConfig", "surfaceHoverTone"],
    "teal"
  );

  // Default selection (single mode): a Flow text variable whose value is the
  // option to preselect. Saved metadata and the debug run are checked later.
  await activateStudioSection(page, "behavior");
  const defaultField = resourceField(
    page,
    "c-newton-selector-flow-cpe-behavior-config",
    "Default selection"
  );
  const defaultFieldCount = await defaultField.count();
  observed.defaultSelectionField = {
    found: defaultFieldCount === 1,
    count: defaultFieldCount
  };
  if (defaultFieldCount === 1) {
    observed.defaultSelectionField.shows = await pickFlowResource(
      defaultField,
      DEFAULT_RESOURCE
    );
    await page.getByText("Component preview", { exact: true }).first().click();
  }
  recordCheck(
    'Behavior has a "Default selection" Flow resource picker',
    defaultFieldCount === 1,
    observed.defaultSelectionField
  );

  await page.screenshot({ path: screenshots.modal, fullPage: true });
}

// Opens the screen, selects the Newton Selector field and clicks "Edit
// configuration". Right after a deploy (including this script's own flow
// fixture deploy), Flow Builder sometimes loads without the custom component's
// metadata: the canvas shows the raw `c:newtonSelectorFlowScreen` name and the
// CPE never appears. A reload fixes it, so retry a few times.
async function openCpeModal(page, builderUrl) {
  const configureButton = page
    .getByRole("button", { name: /Edit configuration|Configure selector/i })
    .first();
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (attempt === 1) {
      await page.goto(builderUrl, {
        waitUntil: "domcontentloaded",
        timeout: 120000
      });
    } else {
      console.log(JSON.stringify({ step: "reload-builder", attempt }));
      await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
    }
    await page
      .waitForLoadState("networkidle", { timeout: 45000 })
      .catch(() => {});
    await dismissTransientUi(page);
    await assertPageText(
      page,
      new RegExp(`${FLOW_LABEL}|Flow Builder|Auto-Layout|Run|Debug`, "i"),
      "Flow Builder shell",
      120000
    );
    await page.screenshot({ path: screenshots.builderLoaded, fullPage: true });

    await page.getByText(SCREEN_LABEL, { exact: true }).first().click({
      timeout: 90000
    });
    await assertPageText(
      page,
      /Edit Screen|Screen Properties/i,
      "screen editor"
    );
    await page.screenshot({ path: screenshots.screenEditor, fullPage: true });

    await page
      .getByText("Custom_Selector", { exact: true })
      .last()
      .click({ force: true, timeout: 60000 });
    const ready = await configureButton
      .waitFor({ state: "visible", timeout: 60000 })
      .then(() => true)
      .catch(() => false);
    if (ready) {
      await configureButton.click({ timeout: 30000 });
      return;
    }
  }
  throw new Error(
    "Flow Builder never loaded the Newton Selector CPE (Edit configuration not shown after 3 attempts)."
  );
}

// Clicks each chapter tab the way an admin does and checks that the tab
// becomes current and its chapter is scrolled to the top of the controls.
// Every choice tile in the studio's controls (layouts, sizes, patterns, gaps,
// data sources...) should read as one family: same outer size, the visual
// centered on the same line, and the title starting at the same offset.
async function exerciseTileUniformity(page) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  const tiles = await page
    .locator('div[slot="controls"] c-newton-selector-choice-tile')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const root = node.shadowRoot || node;
          const label = root.querySelector(
            ".newton-selector-choice-tile__label"
          );
          const title = root.querySelector(
            ".newton-selector-choice-tile__title"
          );
          const visual = root.querySelector(
            ".newton-selector-choice-tile__icon-wrap, .newton-selector-choice-tile__shape-wrap"
          );
          if (!label || !title) return null;
          const box = label.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) return null;
          const titleBox = title.getBoundingClientRect();
          const visualBox = visual?.getBoundingClientRect();
          const input = root.querySelector("input");
          const figure = root.querySelector(
            ".newton-selector-choice-tile__figure"
          );
          const sub = root.querySelector(".newton-selector-choice-tile__sub");
          const group = node.closest("[role=radiogroup]");
          const pick = (element, props) => {
            if (!element) return null;
            const style = getComputedStyle(element);
            return props.map((prop) => style[prop]).join(" ");
          };
          return {
            group: group?.getAttribute("aria-label") || "?",
            selected: Boolean(input?.checked),
            disabled: Boolean(input?.disabled),
            // Everything an admin sees as "the tile's styling": surface,
            // edge, shadow, padding, the visual cell, type, and the spacing
            // between tiles.
            styling: JSON.stringify({
              surface: pick(figure, [
                "backgroundColor",
                "backgroundImage",
                "borderTopColor",
                "borderTopWidth",
                "borderTopLeftRadius",
                "boxShadow",
                "paddingTop",
                "paddingRight",
                "paddingBottom",
                "paddingLeft"
              ]),
              visual: pick(visual, [
                "width",
                "height",
                "backgroundColor",
                "borderTopColor",
                "borderTopWidth",
                "borderTopLeftRadius",
                "color"
              ]),
              title: pick(title, ["color", "fontSize", "fontWeight"]),
              sub: pick(sub, ["color", "fontSize", "fontWeight"]),
              spacing: pick(group, ["rowGap", "columnGap"])
            }),
            title: title.textContent.trim(),
            size: `${Math.round(box.width)}x${Math.round(box.height)}`,
            titleTop: Math.round(titleBox.top - box.top),
            visualMid: visualBox
              ? Math.round(visualBox.top + visualBox.height / 2 - box.top)
              : null
          };
        })
        .filter(Boolean)
    );
  const byGroup = {};
  for (const tile of tiles) {
    const entry = (byGroup[tile.group] ||= {
      sizes: new Set(),
      titleTops: new Set(),
      visualMids: new Set()
    });
    entry.sizes.add(tile.size);
    entry.titleTops.add(tile.titleTop);
    if (tile.visualMid !== null) entry.visualMids.add(tile.visualMid);
  }
  const summary = Object.fromEntries(
    Object.entries(byGroup).map(([group, entry]) => [
      group,
      {
        sizes: [...entry.sizes],
        titleTops: [...entry.titleTops],
        visualMids: [...entry.visualMids]
      }
    ])
  );
  const spread = (values) => Math.max(...values) - Math.min(...values);
  const widths = tiles.map((t) => Number(t.size.split("x")[0]));
  const heights = tiles.map((t) => Number(t.size.split("x")[1]));
  const visualMids = tiles
    .map((t) => t.visualMid)
    .filter((value) => value !== null);
  writeFileSync(
    join(ARTIFACT_DIR, "tile-measurements.json"),
    JSON.stringify({ tiles, summary }, null, 2)
  );
  recordCheck(
    "every CPE choice tile renders at the same size",
    tiles.length > 20 && spread(widths) <= 1 && spread(heights) <= 1,
    { tileCount: tiles.length, summary }
  );
  recordCheck(
    "every CPE choice tile centers its visual and starts its title on the same line",
    spread(visualMids) <= 2 && spread(tiles.map((t) => t.titleTop)) <= 2,
    {
      visualMidSpread: spread(visualMids),
      titleTopSpread: spread(tiles.map((t) => t.titleTop))
    }
  );

  // Every tile shares one look at rest and one when selected: surface, edge,
  // shadow, padding, visual cell, type and spacing. The icon style and
  // shading pickers preview the icon treatment itself, so only their visual
  // is exempt; their tile chrome is compared like every other tile's.
  const PREVIEWS_ICON_TREATMENT = new Set(["Icon style", "Icon shading"]);
  const looks = (selected) => {
    const families = {};
    for (const tile of tiles) {
      if (tile.disabled || tile.selected !== selected) continue;
      const styling = JSON.parse(tile.styling);
      if (PREVIEWS_ICON_TREATMENT.has(tile.group)) styling.visual = "(preview)";
      // Not every option has a description; when one is shown it is compared
      // on its own below.
      delete styling.sub;
      (families[JSON.stringify(styling)] ||= []).push(
        `${tile.group}: ${tile.title}`
      );
    }
    return Object.entries(families).map(([styling, members]) => ({
      styling: JSON.parse(styling),
      count: members.length,
      examples: members.slice(0, 6)
    }));
  };
  const chromeLooks = (families) =>
    new Set(
      families.map(({ styling }) =>
        JSON.stringify({ ...styling, visual: null })
      )
    ).size;
  const visualLooks = (families) =>
    new Set(
      families
        .map(({ styling }) => styling.visual)
        .filter((visual) => visual !== "(preview)")
    ).size;
  const descriptionLooks = new Set(
    tiles
      .filter((tile) => !tile.disabled)
      .map((tile) => JSON.parse(tile.styling).sub)
      .filter(Boolean)
  ).size;
  const atRest = looks(false);
  const selected = looks(true);
  writeFileSync(
    join(ARTIFACT_DIR, "tile-styling.json"),
    JSON.stringify({ atRest, selected }, null, 2)
  );
  recordCheck(
    "every CPE choice tile shares one look at rest and one when selected",
    chromeLooks(atRest) === 1 &&
      chromeLooks(selected) === 1 &&
      visualLooks(atRest) === 1 &&
      visualLooks(selected) === 1 &&
      descriptionLooks === 1,
    {
      descriptionLooks,
      atRestLooks: atRest.length,
      selectedLooks: selected.length,
      examples: atRest.map((family) => family.examples[0])
    }
  );
}

async function exerciseChapterTabs(page) {
  for (const key of ["content", "behavior", "appearance", "data"]) {
    await page
      .locator(`button.newton-studio__tab[data-key="${key}"]`)
      .first()
      .click({ timeout: 15000 });
    await page.waitForTimeout(1000);
    const state = await page.evaluate((chapterKey) => {
      const deep = (root, sel, out = []) => {
        root.querySelectorAll(sel).forEach((n) => out.push(n));
        root.querySelectorAll("*").forEach((n) => {
          if (n.shadowRoot) deep(n.shadowRoot, sel, out);
        });
        return out;
      };
      const scroller = deep(document, ".newton-studio__scroll")[0];
      const host = deep(document, `[data-chapter="${chapterKey}"]`).find((n) =>
        n.tagName.startsWith("C-")
      );
      const active = deep(document, "button.newton-studio__tab_active")[0];
      if (!scroller || !host) return null;
      return {
        activeTab: active ? active.dataset.key : null,
        offsetPx: Math.round(
          host.getBoundingClientRect().top -
            scroller.getBoundingClientRect().top
        )
      };
    }, key);
    recordCheck(
      `chapter tab "${key}" makes its chapter current and scrolls to it`,
      Boolean(state) &&
        state.activeTab === key &&
        state.offsetPx >= -4 &&
        state.offsetPx <= 80,
      state || { error: "studio not found" }
    );
  }
}

// Reads the Appearance chapter's current config. Read-only: never write
// properties onto components from here.
async function appearanceConfig(page) {
  return page
    .locator("c-newton-selector-flow-cpe-appearance-config")
    .first()
    .evaluate((node) => JSON.parse(JSON.stringify(node.config || {})));
}

async function clickTile(page, groupLabel, tileLabel) {
  await page
    .locator(
      `.newton-studio__selectorgroup[aria-label="${groupLabel}"] .newton-selector-choice-tile__title`,
      { hasText: new RegExp(`^\\s*${tileLabel}\\s*$`) }
    )
    .first()
    .click({ timeout: 15000 });
  await page.waitForTimeout(400);
}

const studioIsOpen = async (page) =>
  (await page.locator("c-newton-selector-flow-cpe-studio").count()) > 0;

const discardPrompt = (page) =>
  page.getByText("Discard your unsaved changes?", { exact: false }).first();

// Appearance work must never be lost by accident: switching layouts keeps
// style and remembers each layout's geometry, Reset can be undone, and
// Cancel/Esc ask before discarding unsaved changes. All through real clicks
// and keys, as an admin would.
async function exerciseAppearanceSafety(page) {
  await page
    .locator('button.newton-studio__tab[data-key="appearance"]')
    .first()
    .click();
  await page.waitForTimeout(800);
  const initial = await appearanceConfig(page);

  await clickTile(page, "Pattern", "Dots");
  await clickTile(page, "Tile size", "Large");

  await clickTile(page, "Layout", "List");
  let config = await appearanceConfig(page);
  recordCheck(
    "switching layout keeps style settings",
    config.layout === "list" && config.gridConfig.pattern === "dots",
    {
      layout: config.layout,
      pattern: config.gridConfig.pattern
    }
  );
  recordCheck(
    "switching layout applies the new layout's geometry",
    config.gridConfig.size === "small",
    {
      size: config.gridConfig.size
    }
  );

  await clickTile(page, "Layout", "Grid");
  config = await appearanceConfig(page);
  recordCheck(
    "switching back restores that layout's remembered geometry",
    config.layout === "grid" && config.gridConfig.size === "large",
    {
      layout: config.layout,
      size: config.gridConfig.size
    }
  );

  await page.getByRole("button", { name: "Reset appearance" }).first().click();
  await page.waitForTimeout(400);
  config = await appearanceConfig(page);
  const undoButton = page.getByRole("button", { name: "Undo" }).first();
  await page.screenshot({
    path: join(ARTIFACT_DIR, "07-reset-undo.png"),
    fullPage: true
  });
  recordCheck(
    "Reset appearance restores defaults and offers Undo",
    config.gridConfig.pattern === "none" &&
      config.gridConfig.size === "small" &&
      (await undoButton.isVisible()),
    {
      pattern: config.gridConfig.pattern,
      size: config.gridConfig.size
    }
  );

  await undoButton.click();
  await page.waitForTimeout(400);
  config = await appearanceConfig(page);
  recordCheck(
    "Undo restores exactly what Reset replaced",
    config.gridConfig.pattern === "dots" &&
      config.gridConfig.size === "large" &&
      !(await undoButton.isVisible().catch(() => false)),
    {
      pattern: config.gridConfig.pattern,
      size: config.gridConfig.size
    }
  );

  await page.getByRole("button", { name: "Reset appearance" }).first().click();
  await page.waitForTimeout(400);
  await clickTile(page, "Pattern", "Lines");
  recordCheck(
    "Undo is withdrawn once the admin makes another change",
    !(await undoButton.isVisible().catch(() => false))
  );

  await page
    .getByRole("button", { name: /^Cancel$/ })
    .last()
    .click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: join(ARTIFACT_DIR, "08-discard-question.png"),
    fullPage: true
  });
  recordCheck(
    "Cancel with unsaved changes asks before discarding",
    (await discardPrompt(page).isVisible()) && (await studioIsOpen(page))
  );
  await page.getByRole("button", { name: "Keep editing" }).first().click();
  await page.waitForTimeout(400);
  config = await appearanceConfig(page);
  recordCheck(
    "Keep editing leaves the work intact",
    !(await discardPrompt(page)
      .isVisible()
      .catch(() => false)) && config.gridConfig.pattern === "lines",
    {
      pattern: config.gridConfig.pattern
    }
  );

  const focusedLabel = await page.evaluate(() => {
    let node = document.activeElement;
    while (node?.shadowRoot?.activeElement)
      node = node.shadowRoot.activeElement;
    return (node?.textContent || "").trim();
  });
  recordCheck(
    "Keep editing returns focus to Cancel",
    focusedLabel === "Cancel",
    {
      focusedLabel
    }
  );

  await page.locator(".newton-chapter__title").first().click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const afterEsc = {
    promptVisible: await discardPrompt(page).isVisible(),
    studioOpen: await studioIsOpen(page)
  };
  recordCheck(
    "Esc with unsaved changes asks instead of closing",
    afterEsc.promptVisible && afterEsc.studioOpen,
    afterEsc
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  recordCheck(
    "a second Esc dismisses the question and keeps the modal open",
    !(await discardPrompt(page)
      .isVisible()
      .catch(() => false)) && (await studioIsOpen(page))
  );

  await page
    .getByRole("button", { name: /^Cancel$/ })
    .last()
    .click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Discard changes" }).first().click();
  await page.waitForTimeout(1500);
  recordCheck("Discard changes closes the modal", !(await studioIsOpen(page)));

  await page
    .getByRole("button", { name: /Edit configuration|Configure selector/i })
    .first()
    .click({ timeout: 30000 });
  await page.waitForSelector("c-newton-selector-flow-cpe-studio", {
    timeout: 60000
  });
  await page.waitForTimeout(1500);
  config = await appearanceConfig(page);
  recordCheck(
    "after discarding, reopening shows the original configuration",
    config.layout === initial.layout &&
      config.gridConfig.pattern === initial.gridConfig.pattern &&
      config.gridConfig.size === initial.gridConfig.size,
    {
      layout: config.layout,
      pattern: config.gridConfig.pattern,
      size: config.gridConfig.size
    }
  );

  // No changes: Cancel must close straight away, without a needless prompt.
  await page
    .getByRole("button", { name: /^Cancel$/ })
    .last()
    .click();
  await page.waitForTimeout(1500);
  recordCheck(
    "Cancel with no changes closes without asking",
    !(await studioIsOpen(page)) &&
      !(await discardPrompt(page)
        .isVisible()
        .catch(() => false))
  );
  await page
    .getByRole("button", { name: /Edit configuration|Configure selector/i })
    .first()
    .click({ timeout: 30000 });
  await page.waitForSelector("c-newton-selector-flow-cpe-studio", {
    timeout: 60000
  });
  await page.waitForTimeout(1500);
}

async function openBuilderAndConfigure(page, builderUrl) {
  await openCpeModal(page, builderUrl);
  await exerciseChapterTabs(page);
  await exerciseTileUniformity(page);
  await exerciseAppearanceSafety(page);
  await exerciseAllConfigChapters(page);

  const saveButton = page.getByRole("button", { name: /^Save$/ }).last();
  await assertVisible(saveButton, "modal save button");
  assert(
    !(await saveButton.isDisabled().catch(() => false)),
    "Config modal Save button is disabled after option sweep."
  );
  await saveButton.click();
  await assertPageText(
    page,
    /E2E Custom Selector Edited|Custom items|Current configuration/i,
    "CPE summary after modal save",
    60000
  );
  const summaryText = await page
    .locator("c-newton-selector-flow-cpe")
    .first()
    .innerText()
    .catch(() => "");
  const leakedValues = summaryText.match(
    /at below|none icon|\b(top|radial|diagonal) surface|subtle elevation|hidden globally|selected brand\)|\(neutral/gi
  );
  recordCheck(
    "the Flow Builder summary uses the editor's own words, not stored values",
    !leakedValues && summaryText.length > 0,
    { leakedValues, summaryText: summaryText.slice(0, 600) }
  );

  const doneButton = page.getByRole("button", { name: /^Done$/ }).last();
  await clickFirstVisible(doneButton, "screen editor Done button", 60000);
  await assertPageText(page, /Run|Debug|Save/i, "Flow Builder toolbar");

  const builderSaveButton = page
    .getByRole("button", { name: /^Save$/ })
    .first();
  if (await builderSaveButton.isVisible().catch(() => false)) {
    await builderSaveButton.click({ timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(8000);
  }
  await page.screenshot({ path: screenshots.afterSave, fullPage: true });
  const persisted = retrieveAndAssertPersistedConfig();
  console.log(
    JSON.stringify({
      step: "metadata-verified",
      flowXmlPath: persisted.flowXmlPath,
      customSelectorLabel: persisted.config.label
    })
  );
}

async function clickDebugRunButton(page) {
  const debugButton = page.getByRole("button", { name: /^Debug$/ }).first();
  await clickFirstVisible(debugButton, "Flow Builder Debug button", 60000);
  await assertPageText(
    page,
    /Select Debug Options|Debug|Input Variables/i,
    "debug panel"
  );

  const runButtons = page.getByRole("button", { name: /^Run$/ });
  const count = await runButtons.count();
  for (let i = count - 1; i >= 0; i -= 1) {
    const button = runButtons.nth(i);
    if (await button.isVisible().catch(() => false)) {
      await button.click({ timeout: 30000 });
      return;
    }
  }
  throw new Error("No visible Run button found in the Debug panel.");
}

async function runtimeContextAfterDebug(page, context) {
  const newPagePromise = context
    .waitForEvent("page", { timeout: 15000 })
    .catch(() => null);
  await clickDebugRunButton(page);
  const newPage = await newPagePromise;
  const candidate = newPage || page;
  if (newPage) {
    await newPage.waitForLoadState("domcontentloaded", { timeout: 120000 });
    await newPage
      .waitForLoadState("networkidle", { timeout: 45000 })
      .catch(() => {});
  }

  const contexts = [candidate, ...candidate.frames()];
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    for (const frameOrPage of contexts) {
      const text = await frameOrPage
        .locator("body")
        .innerText({ timeout: 3000 })
        .catch(() => "");
      if (/E2E Rating Selector/i.test(text)) {
        return { page: candidate, context: frameOrPage };
      }
    }
    await candidate.waitForTimeout(1000);
  }

  const body = await candidate
    .locator("body")
    .innerText({ timeout: 5000 })
    .catch(() => "");
  throw new Error(
    `Debug runtime did not render the Newton Selector screen. Body starts with: ${body.slice(
      0,
      1200
    )}`
  );
}

async function runDebugFlow(page, browserContext) {
  const runtime = await runtimeContextAfterDebug(page, browserContext);
  const runtimePage = runtime.page;
  const runtimeScope = runtime.context;

  await assertPageText(
    runtimeScope,
    /E2E Rating Selector/i,
    "debug runtime rating Selector"
  );
  await assertPageText(
    runtimeScope,
    /E2E SOQL Lead Selector/i,
    "debug runtime SOQL Selector"
  );
  await assertPageText(
    runtimeScope,
    /E2E Collection Lead Selector/i,
    "debug runtime collection Selector"
  );
  await assertPageText(runtimeScope, /E2E Custom Alpha/i, "custom option");
  await assertPageText(
    runtimeScope,
    new RegExp(LEAD_ALPHA, "i"),
    "SOQL or collection lead option"
  );
  await runtimePage.screenshot({
    path: screenshots.debugRuntime,
    fullPage: true
  });

  // E2E_Default_Value holds "custom-beta", so Beta starts selected.
  const startingSelection = {};
  for (const label of [
    "E2E Custom Alpha",
    "E2E Custom Beta",
    "E2E Custom Gamma"
  ]) {
    startingSelection[label] = await runtimeScope
      .locator("c-newton-selector-choice-tile")
      .filter({ hasText: label })
      .first()
      .locator("input")
      .isChecked({ timeout: 10000 })
      .catch((error) => `not found: ${error.message.split("\n")[0]}`);
  }
  recordCheck(
    "the Default selection resource preselects its option in the debug run",
    startingSelection["E2E Custom Beta"] === true &&
      startingSelection["E2E Custom Alpha"] === false &&
      startingSelection["E2E Custom Gamma"] === false,
    { defaultResourceValue: "custom-beta", startingSelection }
  );

  for (const text of ["E2E Custom Alpha", "Hot", LEAD_ALPHA, LEAD_BETA]) {
    await runtimeScope
      .getByText(text, { exact: true })
      .first()
      .click({ force: true, timeout: 30000 })
      .catch(async () => {
        await runtimeScope.getByText(text).first().click({
          force: true,
          timeout: 30000
        });
      });
  }

  const nextButton = runtimeScope
    .getByRole("button", { name: /^Next$/ })
    .last();
  await clickFirstVisible(nextButton, "Flow runtime Next button", 60000);
  await assertPageText(
    runtimeScope,
    /E2E Flow completed/i,
    "debug completion screen"
  );
  await runtimePage.screenshot({ path: screenshots.done, fullPage: true });
}

mkdirSync(ARTIFACT_DIR, { recursive: true });

let browser;
try {
  console.log(
    JSON.stringify({
      step: "setup",
      targetOrg: TARGET_ORG,
      flowApiName: FLOW_API_NAME,
      runId: RUN_ID,
      artifactDir: ARTIFACT_DIR
    })
  );
  writeFlowFixture();
  if (SETUP_ONLY) {
    deployFlowFixture();
    console.log(
      JSON.stringify(
        {
          ok: true,
          setupOnly: true,
          targetOrg: TARGET_ORG,
          flowApiName: FLOW_API_NAME,
          flowSourceFile: FLOW_SOURCE_FILE
        },
        null,
        2
      )
    );
  } else {
    if (!USE_EXISTING_LEADS) {
      createLead(LEAD_ALPHA, "Hot");
      createLead(LEAD_BETA, "Warm");
    }
    deployFlowFixture();
    const builderUrl = openFlowBuilderUrl();

    browser = await chromium.launch({
      headless: HEADLESS,
      channel: process.env.PLAYWRIGHT_CHANNEL || undefined
    });
    const context = await browser.newContext({
      viewport: { width: 1500, height: 1050 },
      recordVideo:
        process.env.PLAYWRIGHT_RECORD_VIDEO === "true"
          ? { dir: ARTIFACT_DIR }
          : undefined
    });
    attachDiagnosticsToContext(context);
    const page = await context.newPage();
    attachDiagnosticsToPage(page);
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(120000);

    await openBuilderAndConfigure(page, builderUrl);
    await runDebugFlow(page, context);
    assertNoActionableBrowserDiagnostics();
    writeDiagnostics();

    await context.close();
    console.log(
      JSON.stringify(
        {
          ok: results.checks.every((check) => check.ok),
          failed: results.checks.filter((c) => !c.ok).map((c) => c.name),
          targetOrg: TARGET_ORG,
          flowApiName: FLOW_API_NAME,
          runId: RUN_ID,
          resultsPath,
          screenshots
        },
        null,
        2
      )
    );
  }
  writeResults();
  // Soft mode records failures without throwing; the exit code still tells.
  if (results.checks.some((check) => !check.ok)) process.exitCode = 1;
} catch (error) {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
  writeResults(error);
} finally {
  writeDiagnostics();
  if (browser) {
    await browser.close().catch(() => {});
  }
  deleteTemporaryLeads();
  removeFlowFixture();
}
