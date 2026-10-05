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
// A screen the Debug run never reaches: selectors saved with a WHERE clause
// the filter builder must refuse to save (hand-written in Manual mode).
const SAVED_WHERE_SCREEN_LABEL = "Newton Selector E2E Saved Filters";
const RUN_ID =
  process.env.NEWTON_E2E_RUN_ID ||
  new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const COMPANY = "NewtonE2ECompany";
const EDITED_LABEL = "E2E Custom Selector Edited";
const LABEL_RESOURCE = "E2E_Label_Text";
const DEFAULT_RESOURCE = "E2E_Default_Value";
// A Number variable (never a text resource) and a single Lead record variable
// (a text picker opens it to pick a text field).
const NUMBER_RESOURCE = "E2E_Min_Employees";
const RECORD_RESOURCE = "E2E_Lead_Record";
const DATETIME_VALUE = "2026-01-01T00:00:00Z";
const DATA = "c-newton-selector-flow-cpe-data-config";
const CONTENT = "c-newton-selector-flow-cpe-content-config";
const BEHAVIOR = "c-newton-selector-flow-cpe-behavior-config";
const APPEARANCE = "c-newton-selector-flow-cpe-appearance-config";
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
  done: join(ARTIFACT_DIR, "06-debug-done.png"),
  fatal: join(ARTIFACT_DIR, "99-fatal-error.png")
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

// execFileSync throws on a non-zero exit (sf's JSON status is its exit code),
// so a returned result always succeeded. A failure is rethrown with the CLI's
// own JSON error text and the subcommand that failed.
function runSf(args) {
  try {
    const output = execFileSync(SF_COMMAND, args, {
      encoding: "utf8",
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    return parseFirstJson(output);
  } catch (error) {
    throw new Error(
      `sf ${args.slice(0, 3).join(" ")} failed: ${error.stdout || error.stderr || error.message}`
    );
  }
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
  return /newton|custom_selector|TypeError|ReferenceError|Unhandled|Cannot read|undefined is not|is not a function/i.test(
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
    (entry) => entry.type === "error" && OWN_CODE.test(entry.text)
  );
  const pageErrors = diagnostics.pageErrors.filter((entry) =>
    OWN_CODE.test(`${entry.message}\n${entry.stack}`)
  );
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
      queryLimit: 10,
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
      queryLimit: 10,
      labelField: "LastName",
      valueField: "Id",
      sublabelField: "Company",
      iconField: "",
      badgeField: "Rating",
      helpField: ""
    }
  });
}

// A SOQL selector saved with `whereClause`, for the Saved Filters screen.
function savedWhereConfig(label, whereClause) {
  const config = sobjectConfig();
  return { ...config, label, sobject: { ...config.sobject, whereClause } };
}

const SAVED_WHERE_SELECTORS = [
  {
    field: "Saved_In_Flow_Value_Selector",
    label: "E2E Saved IN Flow Value",
    whereClause: `LastName IN ('{!${LABEL_RESOURCE}}')`,
    message: /need typed values/,
    check: "reopening a saved IN filter with a Flow value blocks Save at once"
  },
  {
    field: "Saved_Invalid_Number_Selector",
    label: "E2E Saved Invalid Number",
    whereClause: "NumberOfEmployees = abc",
    message: /\bnumber\b/i,
    check:
      'reopening a saved filter with "abc" on a number field blocks Save at once'
  }
];

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
        <connector>
            <targetReference>Saved_Where_Screen</targetReference>
        </connector>
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
    <screens>
        <name>Saved_Where_Screen</name>
        <label>${SAVED_WHERE_SCREEN_LABEL}</label>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <allowBack>true</allowBack>
        <allowFinish>true</allowFinish>
        <allowPause>false</allowPause>${SAVED_WHERE_SELECTORS.map(
          ({ field, label, whereClause }) =>
            componentFieldXml(field, savedWhereConfig(label, whereClause))
        ).join("")}
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
    <variables>
        <name>${NUMBER_RESOURCE}</name>
        <dataType>Number</dataType>
        <isCollection>false</isCollection>
        <isInput>false</isInput>
        <isOutput>false</isOutput>
        <scale>0</scale>
        <value>
            <numberValue>5.0</numberValue>
        </value>
    </variables>
    <variables>
        <name>${RECORD_RESOURCE}</name>
        <dataType>SObject</dataType>
        <isCollection>false</isCollection>
        <isInput>false</isInput>
        <isOutput>false</isOutput>
        <objectType>Lead</objectType>
    </variables>
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
  runSf([
    "project",
    "deploy",
    "start",
    "--target-org",
    TARGET_ORG,
    "--source-dir",
    FLOW_SOURCE_FILE,
    "--json"
  ]);
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
  const retrieved = runSf([
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

  const flowXmlPath = findFile(retrieveDir, `${FLOW_API_NAME}.flow-meta.xml`);
  assert(
    flowXmlPath,
    `Retrieved Flow XML was not found under ${retrieveDir}. Retrieve result: ${JSON.stringify(
      retrieved?.result?.files ?? retrieved
    )}`
  );
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
  // Every value here differs from the deployed fixture, so a lost modal or
  // Builder Save fails the check.
  const grid = config.gridConfig || {};
  const expectedSettings = {
    helpText: [config.helpText, "Edited help text from Playwright."],
    fieldLevelHelp: [config.fieldLevelHelp, "Edited tooltip from Playwright."],
    emptyStateMessage: [config.emptyStateMessage, "E2E empty state"],
    errorStateMessage: [config.errorStateMessage, "E2E error state"],
    required: [config.required, true],
    customErrorMessage: [config.customErrorMessage, "None of these"],
    noneOptionPosition: [config.noneOptionPosition, "end"],
    columns: [grid.columns == null ? null : String(grid.columns), "3"],
    size: [grid.size, "large"],
    aspectRatio: [grid.aspectRatio, "4:3"],
    iconDecor: [grid.iconDecor, "ring"],
    patternSelectedTone: [grid.patternSelectedTone, "success"],
    cornerTone: [grid.cornerTone, "success"],
    surfaceHoverTone: [grid.surfaceHoverTone, "teal"],
    iconTone: [grid.iconTone, "warning"],
    iconGlyphTone: [grid.iconGlyphTone, "contrast"],
    badgeVariant: [grid.badge?.variant, "brand"],
    badgePosition: [grid.badge?.position, "top-right"],
    badgeShape: [grid.badge?.shape, "square"]
  };
  const mismatches = Object.fromEntries(
    Object.entries(expectedSettings)
      .filter(([, [saved, expected]]) => saved !== expected)
      .map(([key, [saved, expected]]) => [key, { saved, expected }])
  );
  recordCheck(
    "the saved Flow keeps every setting the sweep changed",
    Object.keys(mismatches).length === 0,
    { checked: Object.keys(expectedSettings).length, mismatches }
  );

  recordCheck(
    'the "Select all and Clear all buttons" toggle saves showSelectAll',
    config.showSelectAll === true,
    { savedShowSelectAll: config.showSelectAll ?? null }
  );

  const sourceRecords = extractComponentInput(
    xml,
    "Custom_Selector",
    "sourceRecords"
  );
  recordCheck(
    "a source switched away from Collection saves without a sourceRecords binding",
    sourceRecords === null,
    {
      savedDataSource: config.dataSource,
      savedSourceRecords: sourceRecords,
      collectionPickedInEditor: observed.collectionBinding ?? null
    }
  );

  recordCheck(
    "option overrides do not survive a data-source change",
    Object.keys(config.overrides || {}).length === 0,
    {
      savedOverrides: config.overrides ?? null,
      overridesModeBackOnSoql: observed.overridesModeBackOnSoql ?? null
    }
  );

  const savedWhere = config.sobject?.whereClause || "";
  recordCheck(
    "the WHERE builder saves a text Flow value quoted and an ISO 8601 datetime",
    savedWhere.includes(`LastName = '{!${LABEL_RESOURCE}}'`) &&
      new RegExp(`CreatedDate < '?${DATETIME_VALUE}'?`).test(savedWhere),
    {
      expectedFragments: [
        `LastName = '{!${LABEL_RESOURCE}}'`,
        `CreatedDate < ${DATETIME_VALUE} (quoted or not)`
      ],
      savedWhereClause: savedWhere,
      previewInEditor: observed.whereWithTextMerge ?? null
    }
  );

  return { flowXmlPath, config };
}

// Every step below goes through the control an admin uses: a click on a
// tile, a toggle option, a tab or a menu option, typing, or a key press.
// Never dispatch component events or write properties onto components from
// here: that skips the controls under test and slows every later re-render.

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Polls read() until ok(value) holds or the timeout passes. Returns what it
// last read, so a check records the real state instead of throwing.
async function waitUntil(read, ok, timeout = 15000) {
  const deadline = Date.now() + timeout;
  let value = await read();
  while (!ok(value) && Date.now() < deadline) {
    await pause(250);
    value = await read();
  }
  return { met: Boolean(ok(value)), value };
}

// Reads until two consecutive reads are equal, so a measurement is taken
// after transitions and re-renders have finished. Throws if it never settles.
async function readSettled(read, label, timeout = 10000) {
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

// Whether the locator reaches the state within the timeout.
async function reaches(locator, state, timeout = 15000) {
  return locator.waitFor({ state, timeout }).then(
    () => true,
    () => false
  );
}

async function bodyText(page) {
  return page
    .locator("body")
    .innerText({ timeout: 5000 })
    .catch(() => "");
}

async function neutralClick(page) {
  await page.getByText("Component preview", { exact: true }).first().click();
}

const CHAPTER_LABELS = {
  data: "Data",
  content: "Content",
  behavior: "Behavior",
  appearance: "Appearance"
};

function chapterTab(page, key) {
  return page
    .getByRole("navigation", { name: "Configuration chapters" })
    .getByRole("button", { name: new RegExp(`^${CHAPTER_LABELS[key]}`) });
}

async function openChapter(page, key) {
  const tab = chapterTab(page, key);
  await tab.click({ timeout: 15000 });
  const { met } = await waitUntil(
    () => tab.getAttribute("aria-current"),
    (current) => current === "page",
    10000
  );
  assert(met, `Chapter tab "${key}" did not become current`);
}

// Clicks the tile whose radio holds `value` in the radio group named
// `groupLabel`, and waits until that radio is checked. Returns how long the
// click took to show as selected, and whether it did.
async function selectTile(page, groupLabel, value, timeout = 10000) {
  const group = page.getByRole("radiogroup", { name: groupLabel, exact: true });
  const radios = group.getByRole("radio");
  await radios.first().waitFor({ state: "attached", timeout: 30000 });
  const values = await radios.evaluateAll((nodes) =>
    nodes.map((node) => node.value)
  );
  const index = values.indexOf(value);
  assert(
    index >= 0,
    `No "${value}" tile in "${groupLabel}" (tiles: ${values.join(", ")})`
  );
  const started = Date.now();
  await group
    .locator("c-newton-selector-choice-tile")
    .nth(index)
    .locator("label")
    .first()
    .click({ timeout });
  const { met } = await waitUntil(
    () => radios.nth(index).isChecked(),
    Boolean,
    timeout
  );
  return { ms: Date.now() - started, selected: met };
}

async function selectTileOrThrow(page, groupLabel, value) {
  const { selected } = await selectTile(page, groupLabel, value);
  assert(selected, `Tile "${value}" in "${groupLabel}" did not select`);
}

// Clicks the option named `option` of the toggle labelled `label` and waits
// until it is the checked one.
async function setToggle(scope, label, option) {
  const radio = scope
    .getByRole("radiogroup", { name: label, exact: true })
    .getByRole("radio", { name: option, exact: true });
  await radio.click({ timeout: 15000 });
  const { met } = await waitUntil(
    () => radio.getAttribute("aria-checked"),
    (checked) => checked === "true",
    10000
  );
  assert(met, `Toggle "${label}" did not switch to ${option}`);
}

// Presses the chip for `value` in the chip row named `label` and waits until
// it reads as pressed. A disabled or covered chip fails here.
async function pressChip(scope, label, value) {
  const chip = scope
    .getByRole("group", { name: label, exact: true })
    .locator(`[data-value="${value}"]`)
    .first();
  await chip.click({ timeout: 15000 });
  const { met } = await waitUntil(
    () => chip.getAttribute("aria-pressed"),
    (pressed) => pressed === "true",
    10000
  );
  assert(met, `Chip "${value}" in "${label}" did not become pressed`);
}

// Types the value into the field and tabs out, as a user would. Typing opens
// the field's resource menu; Tab on a closed menu would open it instead of
// committing, so wait for the menu first. Then dismiss it the way a user
// does: click somewhere neutral (Escape would close the modal).
async function typeIntoField(field, text) {
  await assertVisible(field, "value editor");
  const input = field.locator("input, textarea").first();
  await input.fill(text, { timeout: 15000 });
  const menu = field.getByRole("listbox").first();
  assert(
    await reaches(menu, "visible", 3000),
    `Typing "${text}" did not open the field's resource menu`
  );
  await input.press("Tab");
  await neutralClick(field.page());
  assert(
    await reaches(menu, "hidden", 5000),
    `The resource menu stayed open after typing "${text}"`
  );
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
    await pause(500);
  }
  throw new Error(`${label} was not visible`);
}

async function modalSaveButton(page) {
  const saveButton = page.getByRole("button", { name: /^Save$/ }).last();
  await assertVisible(saveButton, "modal save button");
  return saveButton;
}

async function readModalStatus(page) {
  return (
    await page
      .locator(".newton-modal__status")
      .first()
      .textContent({ timeout: 5000 })
      .catch(() => "")
  ).trim();
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
    !(await saveButton.isDisabled()),
    `Modal Save button was disabled after restoring valid state: ${label}`
  );
}

const studio = (page) => page.locator("c-newton-selector-flow-cpe-studio");

const discardPrompt = (page) =>
  page.getByText("Discard your unsaved changes?", { exact: false }).first();

// Opens the configuration modal from the Flow Builder panel and waits until
// every chapter has rendered its config.
async function openModalFromPanel(page) {
  await page
    .getByRole("button", { name: /Edit configuration|Configure selector/i })
    .first()
    .click({ timeout: 30000 });
  await studio(page).first().waitFor({ state: "attached", timeout: 60000 });
  const { met, value } = await waitUntil(
    () => appearanceSelection(page).catch(() => ({})),
    (selection) =>
      Boolean(selection.layout && selection.pattern && selection.size),
    30000
  );
  assert(
    met,
    `The configuration modal opened without a selected Layout, Pattern and Tile size: ${JSON.stringify(value)}`
  );
}

// Cancel, confirm the discard, and open the modal again on the saved config.
async function discardAndReopen(page) {
  await page
    .getByRole("button", { name: /^Cancel$/ })
    .last()
    .click();
  await discardPrompt(page).waitFor({ state: "visible", timeout: 15000 });
  await page.getByRole("button", { name: "Discard changes" }).first().click();
  await studio(page).first().waitFor({ state: "detached", timeout: 60000 });
  await openModalFromPanel(page);
}

// Invalid configurations block Save and say why: a Collection source with no
// record collection, then with no label field, then Custom with no options.
// Recovers by discarding the session.
async function exerciseInvalidBuilderStates(page) {
  const data = page.locator(DATA);
  await openChapter(page, "data");

  // Duplicating an option copies its value: Save waits until the copy gets
  // a value of its own.
  const repeatMessage = "Option 2 repeats an earlier option's value.";
  const repeatState = async () => ({
    messageShown: (await bodyText(page)).includes(repeatMessage),
    saveDisabled: await (await modalSaveButton(page)).isDisabled(),
    saveStatusText: await readModalStatus(page)
  });
  await data
    .getByRole("button", { name: "Duplicate E2E Custom Alpha", exact: true })
    .click({ timeout: 15000 });
  const { value: whileRepeated } = await waitUntil(
    repeatState,
    (state) => state.messageShown && state.saveDisabled,
    10000
  );
  await typeIntoField(
    resourceField(page, DATA, "Value").nth(1),
    "custom-alpha-copy"
  );
  const { value: onceUnique } = await waitUntil(
    repeatState,
    (state) => !state.messageShown && !state.saveDisabled,
    10000
  );
  recordCheck(
    "a duplicated option's repeated value blocks Save until it is unique",
    whileRepeated.messageShown &&
      whileRepeated.saveDisabled &&
      !onceUnique.messageShown &&
      !onceUnique.saveDisabled,
    { expectedMessage: repeatMessage, whileRepeated, onceUnique }
  );
  await data
    .getByRole("button", { name: "Delete E2E Custom Alpha", exact: true })
    .nth(1)
    .click({ timeout: 15000 });

  await selectTileOrThrow(page, "Data source", "collection");
  await assertModalSaveDisabled(
    page,
    /Choose the record collection variable\./,
    "collection mode missing Flow record binding"
  );

  await pickFlowResource(
    resourceField(page, DATA, "Flow record collection"),
    "Get_E2E_Leads"
  );
  const bound = await waitUntil(
    () => bodyText(page),
    (text) => !/Choose the record collection variable\./.test(text),
    30000
  );
  assert(bound.met, "Picking Get_E2E_Leads left the missing-collection error");
  await assertModalSaveDisabled(
    page,
    /Choose the field to show as each option's label\./,
    "collection mode missing label field mapping"
  );

  await selectTileOrThrow(page, "Data source", "custom");
  for (const label of [
    "E2E Custom Alpha",
    "E2E Custom Beta",
    "E2E Custom Gamma"
  ]) {
    await data
      .getByRole("button", { name: `Delete ${label}`, exact: true })
      .click({ timeout: 15000 });
  }
  await assertModalSaveDisabled(
    page,
    /Add at least one option\./,
    "custom mode missing custom items"
  );
  await page.screenshot({ path: screenshots.invalidModal, fullPage: true });
  const { value: saveStatusText } = await waitUntil(
    () => readModalStatus(page),
    (text) => /^1 error to fix · Data: Add at least one option\.$/.test(text),
    10000
  );
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

  await discardAndReopen(page);
  await assertModalSaveEnabled(page, "invalid-state recovery");
}

// Every text field in the editor (inputs, pickers, search boxes, the
// resource picker, the filter builder, the option icon picker's trigger) is
// drawn as the same box. Returns the box each visible field draws: the
// nearest element with an outline.
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
    // The icon picker opens from a button, but it sits in the option row
    // among text boxes and must look like one.
    const isIconPickerTrigger = (node) =>
      node.tagName === "BUTTON" &&
      node.hasAttribute("aria-haspopup") &&
      node.getRootNode?.().host?.tagName ===
        "C-NEWTON-SELECTOR-FLOW-CPE-ICON-SELECTOR";
    const isField = (node) =>
      node.matches?.(
        'input:not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="range"]):not([type="hidden"]), textarea, select, button[role="combobox"]'
      ) || isIconPickerTrigger(node);
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
      (isIconPickerTrigger(node) ? "Icon picker" : "") ||
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

// A resource picker (Selector label, option Label/Value/…, Default selection)
// holds a plain value or a Flow resource; it is not a search box, so it shows
// no magnifier. Returns every visible resource picker in the open chapter with
// the search icons drawn inside it.
async function findResourceFieldSearchIcons(page) {
  return page.evaluate(() => {
    const descendants = (root) => {
      const found = [];
      root.querySelectorAll("*").forEach((node) => {
        found.push(node);
        if (node.shadowRoot) found.push(...descendants(node.shadowRoot));
      });
      return found;
    };
    const all = descendants(document);
    const scroller = all.find((node) =>
      node.classList?.contains("newton-studio__scroll")
    );
    if (!scroller) return [];
    const area = scroller.getBoundingClientRect();
    const shown = (node) => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return (
        box.width > 0 &&
        box.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        box.right > area.left &&
        box.left < area.right
      );
    };
    const searchIcon =
      'svg[data-key="search"], .slds-input__icon_left, lightning-icon[icon-name$=":search"], c-newton-selector-icon[name="search"]';
    return all
      .filter(
        (node) =>
          node.tagName === "C-NEWTON-SELECTOR-FLOW-CPE-RESOURCE-SELECTOR" &&
          shown(node)
      )
      .map((field) => {
        const inside = [
          ...field.querySelectorAll("*"),
          ...(field.shadowRoot ? descendants(field.shadowRoot) : [])
        ];
        return {
          field:
            field.getAttribute("label") ||
            field.label ||
            field.getAttribute("name") ||
            "resource picker",
          searchIcons: inside
            .filter((node) => node.matches(searchIcon) && shown(node))
            .map((node) =>
              [
                node.tagName.toLowerCase(),
                node.getAttribute("data-key") ||
                  node.getAttribute("name") ||
                  node.getAttribute("class") ||
                  ""
              ].join(" ")
            )
        };
      });
  });
}

function recordResourceFieldSearchIconCheck(passes) {
  const fields = passes.flat();
  const withIcon = fields.filter((f) => f.searchIcons.length);
  recordCheck(
    "plain value fields show no search icon",
    fields.length > 5 && withIcon.length === 0,
    {
      resourceFieldsChecked: fields.length,
      fieldsWithSearchIcon: withIcon
        .slice(0, 8)
        .map((f) => `${f.field}: ${f.searchIcons.join(", ")}`),
      fieldsWithSearchIconCount: withIcon.length
    }
  );
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
  const iconPickers = fields.filter((f) => f.field === "Icon picker").length;
  recordCheck(
    "every text field in the editor is the same box",
    fields.length > 10 && iconPickers > 0 && Object.keys(looks).length === 1,
    {
      fieldCount: fields.length,
      iconPickers,
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

const queryPreview = (page) =>
  page.locator(DATA).locator(".newton-query-preview__code code").first();

async function readPreview(page) {
  return (
    await queryPreview(page)
      .textContent({ timeout: 10000 })
      .catch(() => "")
  ).trim();
}

async function previewMatches(page, pattern, timeout = 15000) {
  return waitUntil(
    () => readPreview(page),
    (text) => pattern.test(text),
    timeout
  );
}

// The SOQL source's Object lookup.
const objectLookup = (page) =>
  page
    .locator(DATA)
    .getByRole("combobox", { name: /\bObject\b/ })
    .first();

async function pickSoqlObject(page, apiName) {
  const box = objectLookup(page);
  await box.click({ timeout: 15000 });
  await box.fill(apiName, { timeout: 15000 });
  await page
    .locator(DATA)
    .locator(`[role="option"][data-id="${apiName}"]`)
    .first()
    .click({ timeout: 20000 });
  const { met, value } = await previewMatches(
    page,
    new RegExp(`\\bFROM ${apiName}\\b`)
  );
  assert(met, `Picking ${apiName} in Object did not reach the query: ${value}`);
}

// Esc in an open lookup list closes the list and is handled there: the modal
// must not also ask to discard the (unsaved) changes. Once with no matches,
// once with matches.
async function exerciseLookupEscape(page) {
  const data = page.locator(DATA);
  const box = objectLookup(page);
  const cases = [];
  for (const [term, shown] of [
    ["zzzqqq", data.getByText("No results found.").first()],
    ["Lead", data.locator('[role="option"][data-id="Lead"]').first()]
  ]) {
    await box.click({ timeout: 15000 });
    await box.fill(term, { timeout: 15000 });
    await shown.waitFor({ state: "visible", timeout: 20000 });
    await box.press("Escape");
    const { value: listState } = await waitUntil(
      async () => ({
        expanded: await box.getAttribute("aria-expanded"),
        prompt: await discardPrompt(page).isVisible()
      }),
      (state) => state.expanded !== "true" || state.prompt,
      3000
    );
    // A discard prompt can follow the closing list by a render.
    const prompt =
      listState.prompt || (await reaches(discardPrompt(page), "visible", 1500));
    cases.push({
      term,
      listClosed: listState.expanded !== "true",
      discardPrompt: prompt,
      modalOpen: (await studio(page).count()) > 0
    });
    if (prompt) {
      await page.getByRole("button", { name: "Keep editing" }).first().click();
      await reaches(discardPrompt(page), "hidden", 10000);
    }
    if (listState.expanded === "true") await neutralClick(page);
    await box.fill("", { timeout: 15000 });
  }
  await neutralClick(page);
  recordCheck(
    "Esc in an open lookup closes its list without the discard prompt",
    cases.every((c) => c.listClosed && !c.discardPrompt && c.modalOpen),
    { cases }
  );
}

// Text pickers on a scratch option (a copy of Gamma, deleted afterwards):
// the menu lists text resources and record variables to open for a text
// field, Back returns to the list without touching the field, and the menu
// works from the keyboard.
async function exerciseTextResourcePickers(page) {
  const data = page.locator(DATA);
  await data
    .getByRole("button", { name: "Duplicate E2E Custom Gamma", exact: true })
    .click({ timeout: 15000 });
  const copyField = (label) => resourceField(page, DATA, label).nth(3);
  await copyField("Badge").waitFor({ state: "visible", timeout: 15000 });
  const optionValues = (field) =>
    field
      .locator('[role="option"]')
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.value));
  const option = (field, value) =>
    field.locator(`[role="option"][data-value="${value}"]`).first();

  // 1. What a text picker lists, and opening a record variable for a field.
  const badge = copyField("Badge");
  await badge.locator("input").first().click({ timeout: 15000 });
  const { value: listed } = await waitUntil(
    () => optionValues(badge),
    (values) => values.length > 0,
    10000
  );
  let drilledToLastName = false;
  let fieldAfterPick = "";
  if (listed.includes(RECORD_RESOURCE)) {
    await option(badge, RECORD_RESOURCE)
      .getByTitle("Open object fields")
      .click({ timeout: 15000 });
    drilledToLastName = await reaches(
      option(badge, "LastName"),
      "visible",
      15000
    );
    if (drilledToLastName) {
      await option(badge, "LastName").click({ timeout: 15000 });
      fieldAfterPick = (
        await waitUntil(
          () => badge.innerText().catch(() => ""),
          (text) => /Last ?Name/.test(text),
          10000
        )
      ).value;
    }
  }
  await neutralClick(page);
  recordCheck(
    "a text picker lists text resources and opens a record variable for a text field",
    listed.includes(LABEL_RESOURCE) &&
      listed.includes(RECORD_RESOURCE) &&
      !listed.includes(NUMBER_RESOURCE) &&
      drilledToLastName &&
      /Last ?Name/.test(fieldAfterPick),
    {
      listedOnOpen: listed,
      expectListed: [LABEL_RESOURCE, RECORD_RESOURCE],
      expectNotListed: [NUMBER_RESOURCE],
      drilledToLastName,
      fieldAfterPick: fieldAfterPick.replace(/\s+/g, " ").trim()
    }
  );

  // 2. Back after opening a record variable.
  const help = copyField("Help text");
  const helpInput = help.locator("input").first();
  const before = await helpInput.inputValue();
  await helpInput.click({ timeout: 15000 });
  await option(help, RECORD_RESOURCE)
    .getByTitle("Open object fields")
    .click({ timeout: 15000 });
  await option(help, "LastName").waitFor({ state: "visible", timeout: 15000 });
  const back = help.getByRole("button", { name: "Back" }).first();
  const backShown = await reaches(back, "visible", 5000);
  if (backShown) await back.click({ timeout: 15000 });
  const listedAgain = await reaches(
    option(help, LABEL_RESOURCE),
    "visible",
    5000
  );
  await neutralClick(page);
  await reaches(help.locator('[role="option"]').first(), "hidden", 5000);
  const after = await helpInput
    .inputValue({ timeout: 5000 })
    .catch(() => "(no text box)");
  recordCheck(
    "Back in a resource picker returns to the list without clearing the field",
    backShown && listedAgain && after === before,
    { before, after, backShown, rootListShownAfterBack: listedAgain }
  );

  // 3. Keyboard: filter by typing, ArrowDown to the match, Enter to pick.
  const sublabel = copyField("Sublabel");
  const comboboxes = await sublabel.getByRole("combobox").count();
  const subInput = sublabel.locator("input").first();
  await subInput.click({ timeout: 15000 });
  await subInput.fill(LABEL_RESOURCE.slice(0, 8), { timeout: 15000 });
  await option(sublabel, LABEL_RESOURCE).waitFor({
    state: "visible",
    timeout: 10000
  });
  await subInput.press("ArrowDown");
  const activeOption =
    comboboxes > 0
      ? await sublabel
          .getByRole("combobox")
          .first()
          .getAttribute("aria-activedescendant")
      : null;
  await subInput.press("Enter");
  const picked = await waitUntil(
    () => sublabel.innerText().catch(() => ""),
    (text) => text.includes(LABEL_RESOURCE),
    5000
  );
  await neutralClick(page);
  recordCheck(
    "a resource picker menu can be used from the keyboard",
    comboboxes > 0 && picked.met,
    {
      comboboxRoles: comboboxes,
      activeOptionAfterArrowDown: activeOption,
      keys: `typed "${LABEL_RESOURCE.slice(0, 8)}", ArrowDown, Enter`,
      fieldAfterEnter: picked.value.replace(/\s+/g, " ").trim()
    }
  );

  const deleteGamma = data.getByRole("button", {
    name: "Delete E2E Custom Gamma",
    exact: true
  });
  await deleteGamma.last().click({ timeout: 15000 });
  const { met } = await waitUntil(
    () => deleteGamma.count(),
    (count) => count === 1,
    10000
  );
  assert(met, "The scratch copy of E2E Custom Gamma was not deleted");
}

// Option overrides edited through the overrides card: a label override on a
// sample row, Default clears it, Undo brings it back.
async function exerciseOverrideUndo(page) {
  const data = page.locator(DATA);
  await setToggle(data, "Option overrides", "Advanced");
  await data
    .getByRole("button", { name: /^(Re)?load sample rows$/i })
    .first()
    .click({ timeout: 15000 });
  const firstRow = data
    .getByRole("button", { name: /^Edit overrides for / })
    .first();
  await firstRow.waitFor({ state: "visible", timeout: 30000 });
  await firstRow.click();
  await typeIntoField(
    resourceField(page, DATA, "Label override").first(),
    "Override Alpha"
  );
  const overrideLabel = data.getByText("Override Alpha", { exact: true });
  const overrideShown = await reaches(overrideLabel.first(), "visible", 10000);
  await setToggle(data, "Option overrides", "Default");
  const clearedVisible = await reaches(
    data.getByText("Overrides cleared.", { exact: false }).first(),
    "visible",
    10000
  );
  if (clearedVisible) {
    await data
      .getByRole("button", { name: "Undo", exact: true })
      .first()
      .click({ timeout: 10000 });
  }
  const restored = await reaches(overrideLabel.first(), "visible", 10000);
  recordCheck(
    "switching overrides to Default can be undone",
    overrideShown && clearedVisible && restored,
    { overrideShown, clearedVisible, restored }
  );
}

// Copy and behavior an admin relies on to understand and fix the setup:
// named option controls, text pickers, recoverable override clearing, an
// honest query limit, a quiet blank filter, reachable min/max limits, the
// multi-only Select all toggle, and layout names that don't collide with
// data sources or selection modes.
async function exerciseClarity(page) {
  const data = page.locator(DATA);
  await openChapter(page, "data");

  const deleteAlpha = data.getByRole("button", {
    name: "Delete E2E Custom Alpha",
    exact: true
  });
  const moveBetaUp = data.getByRole("button", {
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
  await exerciseTextResourcePickers(page);

  await selectTileOrThrow(page, "Data source", "sobject");
  await exerciseLookupEscape(page);
  await pickSoqlObject(page, "Lead");
  const rowsToLoad = data.getByLabel("Rows to load");
  await rowsToLoad.fill("25");
  await rowsToLoad.press("Tab");
  const limitTyped = await previewMatches(page, /LIMIT 25$/, 10000);
  assert(
    limitTyped.met,
    `Rows to load 25 did not reach the query: ${limitTyped.value}`
  );
  await rowsToLoad.fill("");
  await rowsToLoad.press("Tab");
  const { value: limitPreview } = await previewMatches(
    page,
    /LIMIT 50$/,
    10000
  );
  recordCheck(
    "an empty Limit previews the 50 rows the runtime loads",
    /LIMIT 50$/.test(limitPreview),
    { typed: "25, then cleared", queryPreview: limitPreview }
  );
  const soqlFields = await measureTextFields(page);

  const whereBuilder = page
    .locator("c-newton-selector-flow-cpe-where-builder")
    .first();
  const removeButtons = whereBuilder.getByRole("button", {
    name: "Remove condition",
    exact: true
  });
  await removeButtons.first().waitFor({ state: "visible", timeout: 15000 });
  const conditionCount = await removeButtons.count();
  const blankFilterErrors = await whereBuilder
    .getByText(/Finish this condition/)
    .count();
  recordCheck(
    "an untouched blank filter condition shows no error",
    conditionCount === 1 && blankFilterErrors === 0,
    { conditionCount, blankFilterErrors }
  );

  await exerciseOverrideUndo(page);
  // With the override still set, a new data source starts without it
  // (checked in the saved Flow).
  await selectTileOrThrow(page, "Data source", "custom");
  const customFields = await measureTextFields(page);
  const searchIconPasses = [await findResourceFieldSearchIcons(page)];
  await openChapter(page, "content");
  searchIconPasses.push(await findResourceFieldSearchIcons(page));

  await openChapter(page, "behavior");
  const behavior = page.locator(BEHAVIOR);
  await setToggle(behavior, "Selection mode", "Multi");
  const selectAllToggle = behavior.getByRole("radiogroup", {
    name: "Select all and Clear all buttons",
    exact: true
  });
  const selectAllInMulti = await reaches(selectAllToggle, "visible", 5000);
  if (selectAllInMulti) {
    await setToggle(behavior, "Select all and Clear all buttons", "On");
    await selectAllToggle.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: join(ARTIFACT_DIR, "09-select-all-toggle.png")
    });
  }
  const minField = page.getByLabel("Minimum selections", { exact: true });
  const maxField = page.getByLabel("Maximum selections", { exact: true });
  await minField.fill("3");
  await minField.press("Tab");
  await maxField.fill("2");
  await maxField.press("Tab");
  const minMaxPattern =
    /Behavior: Maximum selections must be at least the minimum, and at least 1\./;
  const { value: minMaxStatus } = await waitUntil(
    () => readModalStatus(page),
    (text) => minMaxPattern.test(text),
    10000
  );
  const saveBlocked = await (await modalSaveButton(page)).isDisabled();
  await maxField.fill("4");
  await maxField.press("Tab");
  const { value: saveRestored } = await waitUntil(
    async () => !(await (await modalSaveButton(page)).isDisabled()),
    Boolean,
    10000
  );
  recordCheck(
    "min and max selections can be set and their error fixed in the editor",
    minMaxPattern.test(minMaxStatus) && saveBlocked && saveRestored,
    { minMaxStatus, saveBlocked, saveRestored }
  );
  recordTextFieldChecks([
    soqlFields,
    customFields,
    await measureTextFields(page)
  ]);
  searchIconPasses.push(await findResourceFieldSearchIcons(page));
  recordResourceFieldSearchIconCheck(searchIconPasses);
  await minField.fill("");
  await minField.press("Tab");
  await maxField.fill("");
  await maxField.press("Tab");
  await exerciseMultiDefaultSelectionLiteral(page);
  await setToggle(behavior, "Selection mode", "Single");
  const selectAllHiddenInSingle = await reaches(
    selectAllToggle,
    "hidden",
    5000
  );
  recordCheck(
    'the "Select all and Clear all buttons" toggle shows only in Multi mode',
    selectAllInMulti && selectAllHiddenInSingle,
    {
      shownInMulti: selectAllInMulti,
      hiddenInSingle: selectAllHiddenInSingle
    }
  );

  await openChapter(page, "appearance");
  const titles = (
    await page
      .getByRole("radiogroup", { name: "Layout", exact: true })
      .getByRole("radio")
      .evaluateAll((nodes) =>
        nodes.map((node) => (node.labels?.[0]?.innerText || "").split("\n")[0])
      )
  ).map((title) => title.trim());
  recordCheck(
    "layout names don't reuse data source or selection mode words",
    titles.includes("Dropdown") &&
      titles.includes("Dual listbox") &&
      !titles.includes("Picklist") &&
      !titles.includes("Multi-select"),
    { titles }
  );
  await openChapter(page, "data");
}

// Multi select pre-selects from the component's `values` input, a text
// collection. A typed literal can't fill a collection, so the field says so
// and the literal is not bound to `values`. Leaves the field empty.
const MULTI_DEFAULT_LITERAL_ERROR =
  "Pick a text collection variable for multiple default selections.";
async function exerciseMultiDefaultSelectionLiteral(page) {
  const behavior = page
    .locator("c-newton-selector-flow-cpe-behavior-config")
    .first();
  const field = resourceField(
    page,
    "c-newton-selector-flow-cpe-behavior-config",
    "Default selection"
  ).first();
  await typeIntoField(field, "custom-beta");
  // innerText holds only rendered text, so a line equal to the message means
  // the field shows it. Only the refusal shows; the field is not also
  // reported as a bad reference.
  const { value: fieldText } = await waitUntil(
    async () => (await field.innerText().catch(() => "")).trim(),
    (text) => text.includes(MULTI_DEFAULT_LITERAL_ERROR),
    5000
  );
  const errorShown = fieldText
    .split("\n")
    .some((line) => line.trim() === MULTI_DEFAULT_LITERAL_ERROR);
  const otherErrors = fieldText.includes("no resource with that name") ? 1 : 0;
  // The text box itself is invalid, so assistive tech announces the error.
  const inputInvalid = await field
    .locator("input")
    .first()
    .getAttribute("aria-invalid")
    .catch(() => null);
  const valuesRef = await behavior.evaluate((node) => node.valuesRef ?? null);
  recordCheck(
    "a typed literal in multi-select Default selection is refused with an error",
    errorShown &&
      otherErrors === 0 &&
      inputInvalid === "true" &&
      !String(valuesRef || "").includes("custom-beta"),
    {
      typed: "custom-beta",
      expectedError: MULTI_DEFAULT_LITERAL_ERROR,
      errorShown,
      otherErrors,
      inputInvalid,
      fieldText,
      valuesInputInEditor: valuesRef
    }
  );
  await typeIntoField(field, "");
}

// The resource picker (text box + Flow resource menu) whose label reads
// exactly `label`, inside the editor chapter `chapterTag`. A required picker's
// label starts with the "*" required marker.
function resourceField(page, chapterTag, label) {
  return page
    .locator(`${chapterTag} c-newton-selector-flow-cpe-resource-selector`)
    .filter({
      has: page.locator("label", {
        hasText: new RegExp(
          `^\\s*\\*?\\s*${label.replace(/[()]/g, "\\$&")}\\s*$`
        )
      })
    });
}

// Picks a Flow resource from a resource picker the way an admin does: click
// the box, type part of the name to filter the list, click the resource.
// The typed filter text must not be saved instead of the picked resource.
async function pickFlowResource(field, apiName) {
  const input = field.locator("input").first();
  await input.click({ timeout: 15000 });
  await input.fill(apiName.slice(0, 8), { timeout: 15000 });
  const option = field
    .locator(`[role="option"][data-value="${apiName}"]`)
    .first();
  await option.waitFor({ state: "visible", timeout: 15000 });
  await option.click({ timeout: 15000 });
  await reaches(field.locator('[role="option"]').first(), "hidden", 10000);
  return (await field.innerText().catch(() => "")).trim();
}

// Sentences shown in a filter condition row: its error messages. The row's
// other text is the condition number, the operator and the value.
async function conditionMessages(condition) {
  return (await condition.innerText().catch(() => ""))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.split(/\s+/).length >= 4);
}

function isValidQueryMessage(message) {
  return (
    /\bvalid/i.test(message) &&
    !/\binvalid\b|\berror\b|unable|fail|couldn/i.test(message)
  );
}

// Clicks Validate query and returns the message it shows.
async function validateQuery(page) {
  const section = page
    .locator(DATA)
    .locator("section", {
      has: page.getByRole("button", { name: /Validate query|Validating/ })
    })
    .first();
  await section
    .getByRole("button", { name: "Validate query" })
    .click({ timeout: 15000 });
  const { value } = await waitUntil(
    async () =>
      (
        await section
          .getByRole("status")
          .first()
          .innerText()
          .catch(() => "")
      ).trim(),
    (text) => text && !/^Not checked yet/.test(text),
    30000
  );
  return value;
}

// The SOQL source's visual filter builder, driven with real clicks, typing
// and keys: an unfinished condition blocks Save without dropping the
// finished ones, number fields compare unquoted, invalid typed values block
// Save, Flow values validate and are quoted for text fields, and IN refuses
// a Flow value. Leaves `CreatedDate < <datetime> AND LastName = '{!label}'`.
async function exerciseWhereBuilder(page) {
  const data = page.locator(DATA);
  const whereBuilder = page
    .locator("c-newton-selector-flow-cpe-where-builder")
    .first();
  const removeCondition = (condition) =>
    condition
      .getByRole("button", { name: "Remove condition", exact: true })
      .click({ timeout: 15000 });
  const conditions = whereBuilder.locator("article").filter({
    has: page.getByRole("button", { name: "Remove condition", exact: true })
  });
  const valueField = (condition) =>
    condition.locator("c-newton-selector-flow-cpe-resource-selector").first();
  const operatorBox = (condition) =>
    condition
      .locator(
        'c-newton-selector-flow-cpe-choice-control button[role="combobox"]'
      )
      .first();
  const saveDisabled = async () => (await modalSaveButton(page)).isDisabled();
  const builderState = async () => ({
    conditionCount: await conditions.count(),
    manualMode:
      (await whereBuilder.getByText("Manual WHERE clause").count()) > 0,
    queryPreview: await readPreview(page)
  });
  const chooseField = async (condition, apiName) => {
    const fieldInput = condition.locator('input[role="combobox"]').first();
    await fieldInput.click({ timeout: 15000 });
    await fieldInput.fill(apiName, { timeout: 15000 });
    await condition
      .locator('[role="option"]', { hasText: apiName })
      .first()
      .click({ timeout: 20000 });
    const { met } = await waitUntil(
      () => fieldInput.inputValue(),
      (value) => value.length > 0,
      10000
    );
    assert(met, `Field ${apiName} was not chosen in the filter condition`);
  };
  const chooseOperator = async (condition, operator) => {
    await operatorBox(condition).click({ timeout: 15000 });
    await condition
      .locator(`[role="option"][data-value="${operator}"]`)
      .first()
      .click({ timeout: 15000 });
    const { met } = await waitUntil(
      async () => (await operatorBox(condition).innerText()).trim(),
      (text) => text === operator,
      10000
    );
    assert(met, `Operator ${operator} was not chosen`);
  };
  const addCondition = async () => {
    const before = await conditions.count();
    await whereBuilder
      .getByRole("button", { name: "Add condition" })
      .click({ timeout: 15000 });
    await conditions.nth(before).waitFor({ state: "visible", timeout: 10000 });
    return conditions.nth(before);
  };
  // Save disabled plus a message in the row containing `pattern`.
  const blockedWithMessage = (condition, pattern) =>
    waitUntil(
      async () => ({
        saveDisabled: await saveDisabled(),
        messages: await conditionMessages(condition),
        queryPreview: await readPreview(page)
      }),
      (state) =>
        state.saveDisabled && state.messages.some((m) => pattern.test(m)),
      8000
    );

  await openChapter(page, "data");
  await selectTileOrThrow(page, "Data source", "sobject");
  const advancedChecked = await data
    .getByRole("radiogroup", { name: "Option overrides", exact: true })
    .getByRole("radio", { name: "Advanced", exact: true })
    .getAttribute("aria-checked");
  observed.overridesModeBackOnSoql =
    advancedChecked === "true" ? "Advanced" : "Default";
  const objectKept = await previewMatches(page, /\bFROM Lead\b/);
  assert(objectKept.met, `SOQL object Lead was not kept: ${objectKept.value}`);
  await conditions.first().waitFor({ state: "visible", timeout: 15000 });

  // A finished condition typed in the builder, then a second condition with
  // a field but no value yet.
  await chooseField(conditions.nth(0), "Rating");
  await typeIntoField(valueField(conditions.nth(0)), "Hot");
  const finished = await previewMatches(page, /\bWHERE Rating = 'Hot'/);
  assert(finished.met, `Rating = 'Hot' did not preview: ${finished.value}`);
  const unfinished = await addCondition();
  await chooseField(unfinished, "LastName");
  await neutralClick(page);
  const expectedStatus =
    "1 error to fix · Data: Finish or remove the highlighted filter condition.";
  const { value: incompleteStatus } = await waitUntil(
    () => readModalStatus(page),
    (text) => text === expectedStatus,
    10000
  );
  const incomplete = await builderState();
  recordCheck(
    "an unfinished filter condition keeps the finished ones in the query",
    /\bWHERE Rating = 'Hot'/.test(incomplete.queryPreview),
    { expectedFragment: "WHERE Rating = 'Hot'", ...incomplete }
  );
  const saveDisabledWhileIncomplete = await saveDisabled();
  await page.screenshot({
    path: join(ARTIFACT_DIR, "03b-incomplete-filter.png"),
    fullPage: true
  });
  // The row's message must read as a sentence under the fields, not wrap
  // word by word in a narrow column.
  const rowMessage = await unfinished
    .getByText(/^Finish this condition/)
    .first()
    .evaluate((node) => {
      const box = node.getBoundingClientRect();
      return {
        widthPx: Math.round(box.width),
        lines: Math.round(
          box.height / parseFloat(getComputedStyle(node).lineHeight)
        )
      };
    })
    .catch((error) => ({ error: error.message }));
  recordCheck(
    "a filter condition's message reads as a sentence under its fields",
    rowMessage.lines <= 2 && rowMessage.widthPx >= 200,
    rowMessage
  );
  recordCheck(
    "an unfinished filter condition blocks Save and says why",
    saveDisabledWhileIncomplete && incompleteStatus === expectedStatus,
    {
      expectedStatus,
      saveStatusText: incompleteStatus,
      saveDisabled: saveDisabledWhileIncomplete
    }
  );

  await removeCondition(unfinished);
  const { value: afterRemove } = await waitUntil(
    async () => ({
      ...(await builderState()),
      saveDisabled: await saveDisabled()
    }),
    (state) => state.conditionCount === 1 && !state.saveDisabled,
    10000
  );
  recordCheck(
    "removing the unfinished filter condition re-enables Save",
    !afterRemove.saveDisabled &&
      afterRemove.conditionCount === 1 &&
      /\bWHERE Rating = 'Hot'/.test(afterRemove.queryPreview),
    { saveStatusText: await readModalStatus(page), ...afterRemove }
  );

  // Removing the last condition leaves a blank one.
  await removeCondition(conditions.nth(0));
  const noWhereAfterLast = await previewMatches(
    page,
    /^(?![\s\S]*\bWHERE\b)/,
    10000
  );
  assert(
    noWhereAfterLast.met,
    `Removing the last condition left a WHERE clause: ${noWhereAfterLast.value}`
  );
  const numberCondition = conditions.nth(0);
  await chooseField(numberCondition, "NumberOfEmployees");

  // The operator is a select-mode combobox: Enter opens it, ArrowDown moves
  // to the next operator, Enter picks it.
  const operator = operatorBox(numberCondition);
  const operatorBefore = (await operator.innerText()).trim();
  await operator.focus();
  await page.keyboard.press("Enter");
  const listOpened = await reaches(
    numberCondition.getByRole("option").first(),
    "visible",
    5000
  );
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  const { value: operatorAfter } = await waitUntil(
    async () => (await operator.innerText()).trim(),
    (text) => text !== operatorBefore,
    5000
  );
  const listClosed = (await operator.getAttribute("aria-expanded")) !== "true";
  recordCheck(
    "a select-mode combobox picks an option with the keyboard",
    operatorBefore === "=" && operatorAfter === "!=" && listClosed,
    {
      keys: "Enter, ArrowDown, Enter on the Operator",
      operatorBefore,
      operatorAfter,
      listOpened,
      listClosed
    }
  );
  if (!listClosed) await neutralClick(page);

  await chooseOperator(numberCondition, "=");
  await typeIntoField(valueField(numberCondition), "5");
  const numberState = await previewMatches(
    page,
    /\bWHERE NumberOfEmployees = 5\b/
  );
  recordCheck("a number filter value previews unquoted", numberState.met, {
    expectedFragment: "WHERE NumberOfEmployees = 5",
    queryPreview: numberState.value
  });

  await typeIntoField(valueField(numberCondition), "abc");
  const invalidNumber = await blockedWithMessage(
    numberCondition,
    /\bnumber\b/i
  );

  // A Flow value on a number field: Validate query checks it with a stand-in
  // number, and sample rows say they skipped the WHERE clause.
  await pickFlowResource(valueField(numberCondition), NUMBER_RESOURCE);
  const numberMerge = await previewMatches(
    page,
    new RegExp(`NumberOfEmployees = \\{!${NUMBER_RESOURCE}\\}`)
  );
  const numberMergeValidation = await validateQuery(page);
  recordCheck(
    "Validate query accepts a Flow value on a number field",
    numberMerge.met && isValidQueryMessage(numberMergeValidation),
    {
      queryPreview: numberMerge.value,
      validationMessage: numberMergeValidation
    }
  );
  await setToggle(data, "Option overrides", "Advanced");
  await data
    .getByRole("button", { name: /^(Re)?load sample rows$/i })
    .first()
    .click({ timeout: 15000 });
  const { value: sample } = await waitUntil(
    async () => {
      const lines = (await data.innerText().catch(() => "")).split("\n");
      return {
        note: lines.find((l) => /\bWHERE\b/.test(l) && /ignor/i.test(l)) || "",
        loadError:
          lines.find((l) => /couldn'?t load sample rows/i.test(l)) || "",
        sampleRows: await data
          .getByRole("button", { name: /^Edit overrides for / })
          .count()
      };
    },
    (state) => Boolean(state.note || state.loadError),
    30000
  );
  recordCheck(
    "Load sample rows says it ignored a WHERE clause that uses Flow values",
    Boolean(sample.note) && !sample.loadError,
    { whereClause: numberMerge.value, ...sample }
  );

  // A typed date that is not a date, then an ISO 8601 datetime.
  await removeCondition(numberCondition);
  const noWhereAfterNumber = await previewMatches(
    page,
    /^(?![\s\S]*\bWHERE\b)/,
    10000
  );
  assert(
    noWhereAfterNumber.met,
    `Removing the number condition left a WHERE clause: ${noWhereAfterNumber.value}`
  );
  const dateCondition = conditions.nth(0);
  await chooseField(dateCondition, "CreatedDate");
  await chooseOperator(dateCondition, "<");
  await typeIntoField(valueField(dateCondition), "yesterday");
  const invalidDate = await blockedWithMessage(dateCondition, /\bdate\b/i);
  recordCheck(
    "an invalid number or date value blocks Save with a message",
    invalidNumber.met && invalidDate.met,
    {
      number: { typed: "abc", ...invalidNumber.value },
      date: { typed: "yesterday", ...invalidDate.value }
    }
  );
  await typeIntoField(valueField(dateCondition), DATETIME_VALUE);
  const datetime = await previewMatches(
    page,
    new RegExp(`CreatedDate < '?${DATETIME_VALUE}'?`)
  );
  const datetimeValidation = await validateQuery(page);
  recordCheck(
    "a DATETIME value typed as ISO 8601 passes Validate query",
    datetime.met && isValidQueryMessage(datetimeValidation),
    {
      typed: DATETIME_VALUE,
      queryPreview: datetime.value,
      validationMessage: datetimeValidation
    }
  );

  // A text Flow value, kept (checked quoted in the saved Flow).
  const textCondition = await addCondition();
  await chooseField(textCondition, "LastName");
  await pickFlowResource(valueField(textCondition), LABEL_RESOURCE);
  observed.whereWithTextMerge = (
    await previewMatches(page, new RegExp(`\\{!${LABEL_RESOURCE}\\}`))
  ).value;

  // IN needs typed values: a Flow value there blocks Save with a message.
  const inCondition = await addCondition();
  await chooseField(inCondition, "LastName");
  await chooseOperator(inCondition, "IN");
  await pickFlowResource(valueField(inCondition), LABEL_RESOURCE);
  const inBlocked = await blockedWithMessage(inCondition, /need typed values/);
  recordCheck(
    "IN with a Flow value is blocked with a message",
    inBlocked.met,
    inBlocked.value
  );
  await removeCondition(inCondition);
  const { met: inRemoved } = await waitUntil(
    async () => (await conditions.count()) === 2 && !(await saveDisabled()),
    Boolean,
    10000
  );
  assert(inRemoved, "Removing the IN condition did not re-enable Save");

  await selectTileOrThrow(page, "Data source", "custom");
}

const APPEARANCE_SWEEP = [
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
  ["Margin — all sides", "none"],
  ["Margin — all sides", "2"],
  ["Padding — all sides", ""],
  ["Padding — all sides", "3"]
];

async function exerciseAllConfigChapters(page) {
  await assertPageText(page, /Configure Newton Selector/i, "config modal");
  await page.screenshot({ path: screenshots.modal, fullPage: true });

  console.log(JSON.stringify({ step: "invalid-states" }));
  await exerciseInvalidBuilderStates(page);
  await exerciseClarity(page);
  await exerciseWhereBuilder(page);
  console.log(JSON.stringify({ step: "chapters" }));

  // Sources: every data source tile; Collection is bound to a record
  // collection on the way (the saved Flow must drop that binding).
  await openChapter(page, "data");
  for (const value of ["picklist", "collection", "sobject", "custom"]) {
    await selectTileOrThrow(page, "Data source", value);
    if (value === "collection") {
      observed.collectionBinding = await pickFlowResource(
        resourceField(page, DATA, "Flow record collection"),
        "Get_E2E_Leads"
      );
    }
  }

  await openChapter(page, "content");
  const contentFields = page.locator(
    `${CONTENT} c-newton-selector-flow-cpe-resource-selector`
  );
  await typeIntoField(contentFields.nth(0), EDITED_LABEL);
  // Then bind the label to a Flow text variable through the picker; the
  // saved config must keep the merge-field wrapper (checked after Save).
  await pickFlowResource(
    resourceField(page, CONTENT, "Selector label"),
    LABEL_RESOURCE
  );
  observed.labelInEditorAfterPick = await page
    .locator(CONTENT)
    .first()
    .evaluate((node) => node.config?.label ?? null);
  await neutralClick(page);
  await typeIntoField(
    contentFields.nth(1),
    "Edited help text from Playwright."
  );
  await typeIntoField(contentFields.nth(2), "Edited tooltip from Playwright.");
  await typeIntoField(contentFields.nth(3), "E2E empty state");
  await typeIntoField(contentFields.nth(4), "E2E error state");

  await openChapter(page, "behavior");
  const behavior = page.locator(BEHAVIOR);
  await setToggle(behavior, "Selection mode", "Multi");
  await setToggle(behavior, "Required", "Required");
  await setToggle(behavior, "Selection mode", "Single");
  await setToggle(behavior, "Auto-advance", "Off");
  await setToggle(behavior, "Include a --None-- option", "On");
  await typeIntoField(
    resourceField(page, BEHAVIOR, "Error message (optional)").first(),
    "None of these"
  );
  await selectTileOrThrow(page, "None option position", "end");
  await setToggle(behavior, "Show a search filter", "On");
  await setToggle(behavior, "Include a --None-- option", "Off");

  // Appearance sweep: every tile clicked as an admin would. Each click must
  // select its tile, stay under the latency budget (the config-proxy bug
  // doubled the cost of each edit), and raise no error dialog.
  await openChapter(page, "appearance");
  const notSelected = [];
  const errorDialogSteps = [];
  for (const [label, value] of APPEARANCE_SWEEP) {
    const { ms, selected } = await selectTile(page, label, value);
    results.configChangeTimingsMs.push({ label, value, ms, selected });
    if (!selected) notSelected.push(`${label}=${value}`);
    if (label === "Icon decoration") {
      // Evidence for the distinct decoration looks: the preview after each.
      await page
        .locator("c-newton-selector-flow-cpe-config-preview")
        .first()
        .screenshot({
          path: join(ARTIFACT_DIR, `10-icon-decoration-${value}.png`)
        });
    }
    const dialogs = await page.getByText("Something went wrong").count();
    if (dialogs) {
      errorDialogSteps.push(`${label}=${value}`);
      await page.screenshot({
        path: join(
          ARTIFACT_DIR,
          `error-dialog-${label.replace(/\W+/g, "_")}.png`
        ),
        fullPage: true
      });
    }
    console.log(
      JSON.stringify({
        t: new Date().toISOString().slice(11, 19),
        step: "appearance-select",
        label,
        value,
        ms,
        selected,
        errorDialogs: dialogs,
        consoleErrors: diagnostics.console.length,
        pageErrors: diagnostics.pageErrors.length
      })
    );
  }
  const budgetMs = Number(process.env.NEWTON_E2E_STEP_BUDGET_MS || 2000);
  const slowest = results.configChangeTimingsMs.reduce(
    (max, entry) => (entry.ms > max.ms ? entry : max),
    { ms: 0 }
  );
  recordCheck(
    "config changes stay under the latency budget",
    slowest.ms <= budgetMs && notSelected.length === 0,
    {
      changes: results.configChangeTimingsMs.length,
      budgetMs,
      slowestMs: slowest.ms,
      slowestStep: slowest.label ? `${slowest.label}=${slowest.value}` : null,
      notSelected
    }
  );
  recordCheck(
    "no Flow Builder error dialog during the Appearance sweep",
    errorDialogSteps.length === 0,
    { errorDialogSteps }
  );

  const appearance = page.locator(APPEARANCE);
  for (const [label, value] of [
    ["Columns", "3"],
    ["Pattern selected color", "success"],
    ["Corner color", "success"],
    ["Surface hover color", "teal"],
    ["Icon color", "warning"],
    ["Icon glyph color", "contrast"],
    ["Badge color", "brand"]
  ]) {
    await pressChip(appearance, label, value);
  }
  await selectTileOrThrow(page, "Badge position", "top-right");
  await selectTileOrThrow(page, "Badge shape", "square");
  await setToggle(appearance, "Show icons", "Hidden");
  await setToggle(appearance, "Show icons", "Shown");
  await setToggle(appearance, "Show badges", "Hidden");
  await setToggle(appearance, "Show badges", "Shown");

  // The Debug run needs Custom options, Grid and Single select. The other
  // values end away from the fixture's, so the saved Flow proves the save.
  await openChapter(page, "data");
  await selectTileOrThrow(page, "Data source", "custom");
  await openChapter(page, "appearance");
  await selectTileOrThrow(page, "Layout", "grid");
  await openChapter(page, "behavior");
  await setToggle(behavior, "Selection mode", "Single");
  await openChapter(page, "appearance");
  for (const [label, value] of [
    ["Tile size", "large"],
    ["Aspect ratio", "4:3"],
    ["Tile elevation", "outlined"],
    ["Pattern", "none"],
    ["Surface style", "solid"],
    ["Corner style", "none"],
    ["Icon decoration", "ring"],
    ["Selection indicator", "checkmark"]
  ]) {
    await selectTileOrThrow(page, label, value);
  }

  // Default selection (single mode): a Flow text variable whose value is the
  // option to preselect. Saved metadata and the debug run are checked later.
  await openChapter(page, "behavior");
  const defaultField = resourceField(page, BEHAVIOR, "Default selection");
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
    await neutralClick(page);
  }
  recordCheck(
    'Behavior has a "Default selection" Flow resource picker',
    defaultFieldCount === 1,
    observed.defaultSelectionField
  );

  await page.screenshot({ path: screenshots.modal, fullPage: true });
}

// Opens the screen, selects the Newton Selector field (Custom_Selector on the
// main screen unless told otherwise) and clicks "Edit configuration". Right after a deploy (including this script's own flow
// fixture deploy), Flow Builder sometimes loads without the custom component's
// metadata: the canvas shows the raw `c:newtonSelectorFlowScreen` name and the
// CPE never appears. A reload fixes it, so retry a few times.
async function openCpeModal(
  page,
  builderUrl,
  screenLabel = SCREEN_LABEL,
  fieldName = "Custom_Selector"
) {
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
    // The canvas has loaded once the screen element is drawn on it.
    const screenElement = page.getByText(screenLabel, { exact: true }).first();
    await screenElement.waitFor({ state: "visible", timeout: 120000 });
    await page.screenshot({ path: screenshots.builderLoaded, fullPage: true });

    await screenElement.click({ timeout: 90000 });
    await assertPageText(
      page,
      /Edit Screen|Screen Properties/i,
      "screen editor"
    );
    await page.screenshot({ path: screenshots.screenEditor, fullPage: true });

    await page
      .getByText(fieldName, { exact: true })
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

// Every choice tile in the studio's controls (layouts, sizes, patterns, gaps,
// data sources...) should read as one family: same outer size, the visual
// centered on the same line, and the title starting at the same offset.
async function exerciseTileUniformity(page) {
  await page.mouse.move(0, 0);
  // Measured once the hover styling has transitioned away.
  const measureTiles = () =>
    page
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
  const tiles = await readSettled(measureTiles, "Choice tile measurements");
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

// Distance from the top of the controls' scroll area to the chapter's top.
async function chapterOffset(page, key) {
  return page.evaluate((chapterKey) => {
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
    if (!scroller || !host) return null;
    return Math.round(
      host.getBoundingClientRect().top - scroller.getBoundingClientRect().top
    );
  }, key);
}

// Clicks each chapter tab the way an admin does and checks that the tab
// becomes current and its chapter is scrolled to the top of the controls.
async function exerciseChapterTabs(page) {
  for (const key of ["content", "behavior", "appearance", "data"]) {
    const tab = chapterTab(page, key);
    await tab.click({ timeout: 15000 });
    // Smooth scrolling has no end event: wait until the offset settles in
    // range.
    const { value: state } = await waitUntil(
      async () => ({
        current: await tab.getAttribute("aria-current"),
        offsetPx: await chapterOffset(page, key)
      }),
      (s) =>
        s.current === "page" &&
        s.offsetPx !== null &&
        s.offsetPx >= -4 &&
        s.offsetPx <= 80,
      5000
    );
    recordCheck(
      `chapter tab "${key}" makes its chapter current and scrolls to it`,
      state.current === "page" &&
        state.offsetPx !== null &&
        state.offsetPx >= -4 &&
        state.offsetPx <= 80,
      state
    );
  }
}

// The Layout, Pattern and Tile size the admin sees selected: the checked
// radio in each of those tile groups ("" when none is checked).
async function appearanceSelection(page) {
  const checked = (groupLabel) =>
    page
      .locator(APPEARANCE)
      .first()
      .getByRole("radiogroup", { name: groupLabel, exact: true })
      .getByRole("radio")
      .evaluateAll((nodes) => nodes.find((node) => node.checked)?.value || "");
  return {
    layout: await checked("Layout"),
    pattern: await checked("Pattern"),
    size: await checked("Tile size")
  };
}

// Polls the visible selection until it matches `expected` (a subset of
// layout/pattern/size) and returns the last selection read.
async function appearanceSelectionReaches(page, expected) {
  const { value } = await waitUntil(
    () => appearanceSelection(page),
    (selection) =>
      Object.entries(expected).every(([key, want]) => selection[key] === want),
    5000
  );
  return value;
}

const studioIsOpen = async (page) => (await studio(page).count()) > 0;

// Appearance work must never be lost by accident: switching layouts keeps
// style and remembers each layout's geometry, Reset can be undone, and
// Cancel/Esc ask before discarding unsaved changes. All through real clicks
// and keys, as an admin would.
async function exerciseAppearanceSafety(page) {
  await openChapter(page, "appearance");
  const initial = await appearanceSelection(page);

  await selectTileOrThrow(page, "Pattern", "dots");
  await selectTileOrThrow(page, "Tile size", "large");

  await selectTileOrThrow(page, "Layout", "list");
  let shown = await appearanceSelectionReaches(page, {
    layout: "list",
    pattern: "dots",
    size: "small"
  });
  recordCheck(
    "switching layout keeps style settings",
    shown.layout === "list" && shown.pattern === "dots",
    { layout: shown.layout, pattern: shown.pattern }
  );
  recordCheck(
    "switching layout applies the new layout's geometry",
    shown.size === "small",
    { size: shown.size }
  );

  await selectTileOrThrow(page, "Layout", "grid");
  shown = await appearanceSelectionReaches(page, {
    layout: "grid",
    size: "large"
  });
  recordCheck(
    "switching back restores that layout's remembered geometry",
    shown.layout === "grid" && shown.size === "large",
    { layout: shown.layout, size: shown.size }
  );

  const undoButton = page
    .locator(APPEARANCE)
    .getByRole("button", { name: "Undo" })
    .first();
  await page.getByRole("button", { name: "Reset appearance" }).first().click();
  const undoOffered = await reaches(undoButton, "visible", 10000);
  shown = await appearanceSelectionReaches(page, {
    pattern: "none",
    size: "small"
  });
  await page.screenshot({
    path: join(ARTIFACT_DIR, "07-reset-undo.png"),
    fullPage: true
  });
  recordCheck(
    "Reset appearance restores defaults and offers Undo",
    shown.pattern === "none" && shown.size === "small" && undoOffered,
    { pattern: shown.pattern, size: shown.size, undoOffered }
  );

  await undoButton.click();
  const undoWithdrawn = await reaches(undoButton, "hidden", 10000);
  shown = await appearanceSelectionReaches(page, {
    pattern: "dots",
    size: "large"
  });
  recordCheck(
    "Undo restores exactly what Reset replaced",
    shown.pattern === "dots" && shown.size === "large" && undoWithdrawn,
    { pattern: shown.pattern, size: shown.size, undoWithdrawn }
  );

  await page.getByRole("button", { name: "Reset appearance" }).first().click();
  await reaches(undoButton, "visible", 10000);
  await selectTileOrThrow(page, "Pattern", "lines");
  recordCheck(
    "Undo is withdrawn once the admin makes another change",
    await reaches(undoButton, "hidden", 10000)
  );

  await page
    .getByRole("button", { name: /^Cancel$/ })
    .last()
    .click();
  const askedOnCancel = await reaches(discardPrompt(page), "visible", 10000);
  await page.screenshot({
    path: join(ARTIFACT_DIR, "08-discard-question.png"),
    fullPage: true
  });
  recordCheck(
    "Cancel with unsaved changes asks before discarding",
    askedOnCancel && (await studioIsOpen(page))
  );
  await page.getByRole("button", { name: "Keep editing" }).first().click();
  const promptGone = await reaches(discardPrompt(page), "hidden", 10000);
  shown = await appearanceSelection(page);
  recordCheck(
    "Keep editing leaves the work intact",
    promptGone && shown.pattern === "lines",
    { pattern: shown.pattern }
  );

  const { value: focusedLabel } = await waitUntil(
    () =>
      page.evaluate(() => {
        let node = document.activeElement;
        while (node?.shadowRoot?.activeElement)
          node = node.shadowRoot.activeElement;
        return (node?.textContent || "").trim();
      }),
    (label) => label === "Cancel",
    5000
  );
  recordCheck(
    "Keep editing returns focus to Cancel",
    focusedLabel === "Cancel",
    {
      focusedLabel
    }
  );

  await page.locator(".newton-chapter__title").first().click();
  await page.keyboard.press("Escape");
  const afterEsc = {
    promptVisible: await reaches(discardPrompt(page), "visible", 10000),
    studioOpen: await studioIsOpen(page)
  };
  recordCheck(
    "Esc with unsaved changes asks instead of closing",
    afterEsc.promptVisible && afterEsc.studioOpen,
    afterEsc
  );
  await page.keyboard.press("Escape");
  recordCheck(
    "a second Esc dismisses the question and keeps the modal open",
    (await reaches(discardPrompt(page), "hidden", 10000)) &&
      (await studioIsOpen(page))
  );

  await page
    .getByRole("button", { name: /^Cancel$/ })
    .last()
    .click();
  await discardPrompt(page).waitFor({ state: "visible", timeout: 10000 });
  await page.getByRole("button", { name: "Discard changes" }).first().click();
  recordCheck(
    "Discard changes closes the modal",
    await reaches(studio(page).first(), "detached", 30000)
  );

  await openModalFromPanel(page);
  shown = await appearanceSelection(page);
  recordCheck(
    "after discarding, reopening shows the original configuration",
    shown.layout === initial.layout &&
      shown.pattern === initial.pattern &&
      shown.size === initial.size,
    { initial, reopened: shown }
  );

  // No changes: Cancel must close straight away, without a needless prompt.
  await page
    .getByRole("button", { name: /^Cancel$/ })
    .last()
    .click();
  const closed = await reaches(studio(page).first(), "detached", 30000);
  recordCheck(
    "Cancel with no changes closes without asking",
    closed &&
      !(await discardPrompt(page)
        .isVisible()
        .catch(() => false))
  );
  await openModalFromPanel(page);
}

// A custom Minimum column width survives a click on the Size tile that is
// already selected: only picking another size resets it.
async function exerciseSizeRepickKeepsWidth(page) {
  await openChapter(page, "appearance");
  const appearance = page.locator(APPEARANCE);
  const slider = appearance.getByRole("slider", {
    name: "Minimum column width"
  });
  await assertVisible(slider, "Minimum column width slider");
  // The width the card shows next to its "Minimum column width" heading.
  const shownWidth = async () => {
    const text = await appearance.innerText().catch(() => "");
    const match = text.match(/Minimum column width\s*\n\s*(\d+(?:\.\d+)? rem)/);
    return match ? match[1] : "";
  };
  const { size } = await appearanceSelection(page);
  const before = await shownWidth();
  await slider.focus();
  for (let i = 0; i < 4; i += 1) await page.keyboard.press("ArrowRight");
  const { value: custom } = await waitUntil(
    shownWidth,
    (width) => width && width !== before,
    5000
  );
  const { selected } = await selectTile(page, "Tile size", size);
  // A reset shows within a moment; give it time to happen.
  const { value: after } = await waitUntil(
    shownWidth,
    (width) => width !== custom,
    3000
  );
  recordCheck(
    "clicking the selected Size tile keeps a custom Minimum column width",
    Boolean(size && before && custom) &&
      custom !== before &&
      selected &&
      after === custom &&
      (await slider.inputValue()) === custom.replace(/ rem$/, ""),
    {
      size,
      widthBefore: before,
      customWidth: custom,
      widthAfterSizeClick: after,
      sliderValue: await slider.inputValue()
    }
  );
}

// Selectors saved with a WHERE clause the filter builder refuses (typed in
// Manual mode before it did) must block Save as soon as the editor opens,
// before the admin touches anything. Closes each modal without changes.
// `loginUrl` signs in only once, so later loads use the Flow Builder URL it
// led to, which this returns.
async function exerciseSavedWhereBlocksSave(page, loginUrl) {
  let builderUrl = loginUrl;
  for (const { field, whereClause, message, check } of SAVED_WHERE_SELECTORS) {
    await openCpeModal(page, builderUrl, SAVED_WHERE_SCREEN_LABEL, field);
    builderUrl = page.url();
    await studio(page).first().waitFor({ state: "attached", timeout: 60000 });
    const whereBuilder = page
      .locator("c-newton-selector-flow-cpe-where-builder")
      .first();
    const condition = whereBuilder
      .locator("article")
      .filter({
        has: page.getByRole("button", {
          name: "Remove condition",
          exact: true
        })
      })
      .first();
    const { met, value } = await waitUntil(
      async () => ({
        saveDisabled: await (await modalSaveButton(page)).isDisabled(),
        saveStatusText: await readModalStatus(page),
        manualMode:
          (await whereBuilder.getByText("Manual WHERE clause").count()) > 0,
        conditionMessages: await conditionMessages(condition)
      }),
      (state) =>
        state.saveDisabled &&
        state.conditionMessages.some((line) => message.test(line)),
      30000
    );
    await page.screenshot({
      path: join(ARTIFACT_DIR, `00-saved-filter-${field}.png`),
      fullPage: true
    });
    recordCheck(check, met, { savedWhereClause: whereClause, ...value });

    await page
      .getByRole("button", { name: /^Cancel$/ })
      .last()
      .click();
    if (await reaches(discardPrompt(page), "visible", 3000)) {
      await page
        .getByRole("button", { name: "Discard changes" })
        .first()
        .click();
    }
    await studio(page).first().waitFor({ state: "detached", timeout: 60000 });
  }
  return builderUrl;
}

async function openBuilderAndConfigure(page, loginUrl) {
  const builderUrl = await exerciseSavedWhereBlocksSave(page, loginUrl);
  await openCpeModal(page, builderUrl);
  await exerciseChapterTabs(page);
  await exerciseTileUniformity(page);
  await exerciseSizeRepickKeepsWidth(page);
  await exerciseAppearanceSafety(page);
  await exerciseAllConfigChapters(page);

  const saveButton = await modalSaveButton(page);
  assert(
    !(await saveButton.isDisabled()),
    "Config modal Save button is disabled after option sweep."
  );
  await saveButton.click();
  await studio(page).first().waitFor({ state: "detached", timeout: 60000 });
  const panel = page.locator("c-newton-selector-flow-cpe").first();
  await panel
    .getByText("Current configuration")
    .first()
    .waitFor({ state: "visible", timeout: 60000 });
  const summaryText = await panel.innerText();
  const leakedValues = summaryText.match(
    /at below|none icon|\b(top|radial|diagonal) surface|subtle elevation|hidden globally|selected brand\)|\(neutral/gi
  );
  recordCheck(
    "the Flow Builder summary uses the editor's own words, not stored values",
    !leakedValues && summaryText.length > 0,
    { leakedValues, summaryText: summaryText.slice(0, 600) }
  );

  const doneButtons = page.getByRole("button", { name: /^Done$/ });
  await clickFirstVisible(doneButtons, "screen editor Done button", 60000);
  const { met: editorClosed } = await waitUntil(
    async () => {
      const count = await doneButtons.count();
      for (let i = 0; i < count; i += 1) {
        if (
          await doneButtons
            .nth(i)
            .isVisible()
            .catch(() => false)
        ) {
          return false;
        }
      }
      return true;
    },
    Boolean,
    60000
  );
  assert(editorClosed, "The screen editor did not close after Done");

  // Flow Builder disables Save while it saves ("Saving...") and after; the
  // save has gone through once "Last saved" shows instead.
  const builderSaveButton = page
    .getByRole("button", { name: /^Save$/ })
    .first();
  await builderSaveButton.click({ timeout: 30000 });
  const { met: saved } = await waitUntil(
    async () =>
      (await builderSaveButton.isDisabled()) &&
      !(await page
        .getByText(/^Saving/)
        .first()
        .isVisible()) &&
      (await page
        .getByText(/^Last saved/)
        .first()
        .isVisible()),
    Boolean,
    120000
  );
  await page.screenshot({ path: screenshots.afterSave, fullPage: true });
  assert(
    saved,
    `Flow Builder Save did not complete. See ${screenshots.afterSave}`
  );
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
  await clickFirstVisible(
    page.getByRole("button", { name: /^Debug$/ }),
    "Flow Builder Debug button",
    60000
  );
  // The Debug options panel adds its own Run button after the toolbar's.
  const runButtons = page.getByRole("button", { name: /^Run$/ });
  const visibleRunButtons = async () => {
    const visible = [];
    const count = await runButtons.count();
    for (let i = 0; i < count; i += 1) {
      if (
        await runButtons
          .nth(i)
          .isVisible()
          .catch(() => false)
      ) {
        visible.push(runButtons.nth(i));
      }
    }
    return visible;
  };
  const { met, value } = await waitUntil(
    visibleRunButtons,
    (visible) => visible.length >= 2,
    60000
  );
  assert(met, "The Debug options panel did not show its Run button");
  await value[value.length - 1].click({ timeout: 30000 });
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

  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    // Re-listed each pass: the runtime's frame may attach after the first.
    for (const frameOrPage of [candidate, ...candidate.frames()]) {
      const text = await frameOrPage
        .locator("body")
        .innerText({ timeout: 3000 })
        .catch(() => "");
      if (/E2E Rating Selector/i.test(text)) {
        return { page: candidate, context: frameOrPage };
      }
      // Flow refuses to run a screen whose saved inputs don't validate
      // (for example sourceRecords bound to a collection of another type).
      const invalid = text.match(
        /The "[^"]+" element in your flow has validation errors\./
      );
      if (invalid) {
        throw new Error(`Debug run stopped before the screen: ${invalid[0]}`);
      }
    }
    await pause(1000);
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

  // The selector whose label reads exactly `label`, and its option tile.
  const selectorNamed = (label) =>
    runtimeScope.locator("c-newton-selector-data-selector").filter({
      has: runtimeScope.getByText(label, { exact: true })
    });
  const tileIn = (label, text) =>
    selectorNamed(label)
      .locator("c-newton-selector-choice-tile")
      .filter({ hasText: text })
      .first();

  // E2E_Default_Value holds "custom-beta", so Beta starts selected.
  const startingSelection = {};
  for (const label of [
    "E2E Custom Alpha",
    "E2E Custom Beta",
    "E2E Custom Gamma"
  ]) {
    startingSelection[label] = await tileIn(EDITED_LABEL, label)
      .getByRole("radio")
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

  // One pick per selector (two in the SOQL one, so the last pick wins).
  const picks = [
    [EDITED_LABEL, "E2E Custom Alpha"],
    ["E2E Rating Selector", "Hot"],
    ["E2E SOQL Lead Selector", LEAD_ALPHA],
    ["E2E SOQL Lead Selector", LEAD_BETA],
    ["E2E Collection Lead Selector", LEAD_ALPHA]
  ];
  for (const [label, text] of picks) {
    const tile = tileIn(label, text);
    await tile.locator("label").first().click({ timeout: 30000 });
    const { met } = await waitUntil(
      () => tile.getByRole("radio").isChecked(),
      Boolean,
      10000
    );
    assert(met, `Picking "${text}" in "${label}" did not select it`);
  }

  const nextButton = runtimeScope
    .getByRole("button", { name: /^Next$/ })
    .last();
  await clickFirstVisible(nextButton, "Flow runtime Next button", 60000);
  const doneText = await assertPageText(
    runtimeScope,
    /E2E Flow completed/i,
    "debug completion screen"
  );
  await runtimePage.screenshot({ path: screenshots.done, fullPage: true });
  const lines = doneText.split("\n").map((line) => line.trim());
  const expectedLines = [
    "Custom: E2E Custom Alpha",
    "Rating: Hot",
    `SOQL: ${LEAD_BETA}`,
    `Collection: ${LEAD_ALPHA}`
  ];
  recordCheck(
    "the debug run's Done screen shows the label picked in each selector",
    expectedLines.every((line) => lines.includes(line)),
    {
      expectedLines,
      shownLines: lines.filter((line) =>
        /^(Custom|Rating|SOQL|Collection):/.test(line)
      )
    }
  );
}

mkdirSync(ARTIFACT_DIR, { recursive: true });

let browser;
let page;
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
    page = await context.newPage();
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
  if (page) {
    await page
      .screenshot({ path: screenshots.fatal, fullPage: true })
      .catch(() => {});
  }
  writeResults(error);
} finally {
  writeDiagnostics();
  if (browser) {
    await browser.close().catch(() => {});
  }
  deleteTemporaryLeads();
  removeFlowFixture();
}
