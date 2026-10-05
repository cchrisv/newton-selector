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
// Before driving the page it reads the Lead.Rating picklist values and the
// newest Accounts through the sf CLI; the data-source checks compare what the
// selectors render with them. The SOQL selector's 5-row limit is only
// exercised when the org has more than 5 Accounts.
//
// Artifacts in output/playwright/newton-selector-runtime-e2e/<runId>/:
// results.json (every check with its outcome, detail and duration),
// diagnostics.json (browser errors), a screenshot per screen, and close-ups of
// the open Dropdown (01a) and the highlighted Dual listbox row (01b).

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
// The generic load-error text (Custom Label Newton_Selector_ErrorStateDefault).
const GENERIC_LOAD_ERROR = "Could not load options.";

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
    errorStateMessage: GENERIC_LOAD_ERROR,
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
      queryLimit: 10,
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

// Dropdown options with a sublabel, a badge and a None row, so the Dropdown
// rendering check can tell label, sublabel and badge from raw values and ids.
const DROPDOWN_ITEMS = [
  { label: "Alpha", value: "alpha", icon: "circle" },
  {
    label: "Bravo",
    value: "bravo",
    icon: "circle",
    sublabel: "Second pick",
    badge: "Hot"
  },
  { label: "Gamma", value: "gamma", icon: "circle" }
];
const DROPDOWN_NONE_LABEL = "No letter";
const DUAL_NONE_LABEL = "No choice";

const SOQL_LIMIT = 5;
const SOQL_DATE_LIMIT = 3;
const COLLECTION_LIMIT = 4;

const stringInput = (name, value) => `
            <inputParameters>
                <name>${name}</name>
                <value>
                    <stringValue>${escapeXml(value)}</stringValue>
                </value>
            </inputParameters>`;

const referenceInput = (name, reference) => `
            <inputParameters>
                <name>${name}</name>
                <value>
                    <elementReference>${reference}</elementReference>
                </value>
            </inputParameters>`;

function field(name, config, { type = "Account", extraInputs = "" } = {}) {
  return `
        <fields>
            <name>${name}</name>
            <dataTypeMappings>
                <typeName>T</typeName>
                <typeValue>${type}</typeValue>
            </dataTypeMappings>
            <extensionName>c:newtonSelectorFlowScreen</extensionName>
            <fieldType>ComponentInstance</fieldType>${stringInput(
              "selectorConfigJson",
              JSON.stringify(config)
            )}${extraInputs}
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

function assignment(reference, operator, valueXml) {
  return `
        <assignmentItems>
            <assignToReference>${reference}</assignToReference>
            <operator>${operator}</operator>
            <value>${valueXml}</value>
        </assignmentItems>`;
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
  "defaultsAllValues={!B_Defaults.allValues}",
  "defaultsAllLabels={!B_Defaults.allLabels}",
  "preset={!B_Preset.value} presetLabel={!B_Preset.selectedLabel} presetCount={!B_Preset.selectionCount}",
  "presetMultiCount={!B_PresetMulti.selectionCount} presetMultiLabels={!B_PresetMulti.selectedLabels}",
  "staleOpt=[{!B_StaleOpt.value}] staleOptCount={!B_StaleOpt.selectionCount}",
  "ratingLabel={!S_Picklist.selectedLabel}",
  "soqlCount={!S_Soql.selectionCount} soqlLabel={!S_Soql.selectedLabel}",
  "collectionCount={!S_Collection.selectionCount} collectionLabel={!S_Collection.selectedLabel}",
  "collectionNumber={!S_CollectionNumber.value}",
  "presetRecord={!S_PresetRecord.selectedRecord.Name}",
  "presetRecordCount={!S_PresetRecord.selectionCount}",
  "newestAccount={!Get_Newest_Account.Name}",
  "auto={!A_Auto.value}",
  "repick={!A_Repick.value}"
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
        includeNoneOption: true,
        noneOptionLabel: DROPDOWN_NONE_LABEL,
        custom: { items: DROPDOWN_ITEMS }
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
    field(
      "L_Dual_Single",
      baseConfig({
        label: "L Dual Single",
        layout: "dualListbox",
        selectionMode: "single",
        custom: { items: ABC() }
      })
    ),
    // A multi-select Dual listbox whose None option (value "") is the first
    // row, for the Shift-click range check.
    field(
      "L_Dual_None",
      baseConfig({
        label: "L Dual None",
        layout: "dualListbox",
        selectionMode: "multi",
        includeNoneOption: true,
        noneOptionLabel: DUAL_NONE_LABEL,
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
    // Select all / Clear all next to a search filter, a None option and an
    // Other (manual input) option.
    field(
      "B_SelectAll",
      baseConfig({
        label: "B Select All",
        layout: "list",
        selectionMode: "multi",
        showSelectAll: true,
        enableSearch: true,
        includeNoneOption: true,
        noneOptionLabel: "No colour",
        noneOptionPosition: "end",
        manualInput: {
          enabled: true,
          label: "Something else",
          minLength: 0,
          maxLength: null
        },
        custom: { items: items("Red", "Blue", "Green") }
      })
    ),
    // A None option in a transfer layout.
    field(
      "B_NoneColumns",
      baseConfig({
        label: "B None Columns",
        layout: "columns",
        selectionMode: "multi",
        includeNoneOption: true,
        noneOptionLabel: "No fruit",
        custom: { items: items("Kiwi", "Lime") }
      })
    ),
    // Default selections (the value / values inputs) the user never touches.
    field(
      "B_Preset",
      baseConfig({
        label: "B Preset",
        layout: "list",
        custom: { items: ABC() }
      }),
      { extraInputs: stringInput("value", "bravo") }
    ),
    field(
      "B_PresetMulti",
      baseConfig({
        label: "B Preset Multi",
        layout: "list",
        selectionMode: "multi",
        custom: { items: ABC() }
      }),
      { extraInputs: referenceInput("values", "PresetValues") }
    ),
    // Default selections that match no option.
    field(
      "B_StaleOpt",
      baseConfig({
        label: "B Stale Optional",
        layout: "list",
        custom: { items: ABC() }
      }),
      { extraInputs: stringInput("value", "stale") }
    ),
    field(
      "B_Stale",
      baseConfig({
        label: "B Stale",
        layout: "list",
        required: true,
        customErrorMessage: "Stale pick is required.",
        custom: { items: ABC() }
      }),
      { extraInputs: stringInput("value", "stale") }
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
          ...baseConfig({}).sobject,
          sObjectApiName: "Account",
          orderByField: "CreatedDate",
          orderByDirection: "DESC",
          queryLimit: SOQL_LIMIT,
          labelField: "Name",
          sublabelField: "Industry"
        }
      })
    ),
    // A DATETIME filter written as an ISO 8601 / SOQL datetime literal.
    field(
      "S_SoqlDate",
      baseConfig({
        label: "S Soql Date",
        layout: "list",
        dataSource: "sobject",
        sobject: {
          ...baseConfig({}).sobject,
          sObjectApiName: "Account",
          whereClause: "CreatedDate < 2999-01-01T00:00:00Z",
          orderByField: "CreatedDate",
          orderByDirection: "DESC",
          queryLimit: SOQL_DATE_LIMIT,
          labelField: "Name"
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
      { extraInputs: referenceInput("sourceRecords", "Get_Accounts") }
    ),
    // Record collection whose Value field is a Number: 42 is pre-selected
    // and 0 is picked by the user.
    field(
      "S_CollectionNumber",
      baseConfig({
        label: "S Collection Number",
        layout: "picklist",
        dataSource: "collection",
        collection: {
          fieldMap: {
            label: "Name",
            sublabel: "",
            icon: "",
            value: "NumberOfEmployees",
            badge: "",
            helpText: ""
          }
        }
      }),
      {
        extraInputs:
          referenceInput("sourceRecords", "NumberRecords") +
          stringInput("value", "42")
      }
    ),
    // Record collection with a Default selection (the newest Account's Id).
    field(
      "S_PresetRecord",
      baseConfig({
        label: "S Preset Record",
        layout: "list",
        dataSource: "collection",
        collection: {
          fieldMap: {
            label: "Name",
            sublabel: "",
            icon: "",
            value: "Id",
            badge: "",
            helpText: ""
          }
        }
      }),
      {
        extraInputs:
          referenceInput("sourceRecords", "Get_Accounts") +
          referenceInput("value", "Get_Newest_Account.Id")
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

  // Auto-advance with a Default selection: clicking the pre-selected option
  // must advance too.
  const repick = field(
    "A_Repick",
    baseConfig({
      label: "A Repick",
      layout: "grid",
      autoAdvance: true,
      custom: { items: items("Go", "Stop") }
    }),
    { extraInputs: stringInput("value", "go") }
  );

  // Auto-advance on the Flow's last screen, whose only forward action is
  // Finish.
  const finishAuto = field(
    "F_Auto",
    baseConfig({
      label: "F Auto",
      layout: "grid",
      autoAdvance: true,
      custom: { items: items("Done", "Stay") }
    })
  );

  // The label merges a Flow text value that contains double quotes, which
  // makes the resolved selectorConfigJson unreadable.
  const badConfig = field(
    "X_BadConfig",
    baseConfig({
      label: "X Bad Config {!QuoteText}",
      layout: "list",
      custom: { items: ABC() }
    })
  );

  const resultText = `
        <fields>
            <name>Result_Text</name>
            <fieldText>${escapeXml(
              RESULT_LINES.map((line) => `<p>${line}</p>`).join("")
            )}</fieldText>
            <fieldType>DisplayText</fieldType>
        </fields>`;

  const presetAssignments = [
    assignment("PresetValues", "Add", "<stringValue>alpha</stringValue>"),
    assignment("PresetValues", "Add", "<stringValue>gamma</stringValue>"),
    assignment(
      "NumRecA.Name",
      "Assign",
      "<stringValue>Forty Two Co</stringValue>"
    ),
    assignment(
      "NumRecA.NumberOfEmployees",
      "Assign",
      "<numberValue>42.0</numberValue>"
    ),
    assignment("NumRecB.Name", "Assign", "<stringValue>Zero Co</stringValue>"),
    assignment(
      "NumRecB.NumberOfEmployees",
      "Assign",
      "<numberValue>0.0</numberValue>"
    ),
    // The 0 record is second, so a fallback to the row index ("1") cannot
    // look like the right value.
    assignment(
      "NumberRecords",
      "Add",
      "<elementReference>NumRecA</elementReference>"
    ),
    assignment(
      "NumberRecords",
      "Add",
      "<elementReference>NumRecB</elementReference>"
    )
  ].join("");

  const variable = (name, dataType, extra = "") => `
    <variables>
        <name>${name}</name>
        <dataType>${dataType}</dataType>${extra}
        <isInput>false</isInput>
        <isOutput>false</isOutput>
    </variables>`;
  const accountVar = (name, isCollection) =>
    variable(
      name,
      "SObject",
      `
        <isCollection>${isCollection}</isCollection>
        <objectType>Account</objectType>`
    );

  return `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>66.0</apiVersion>
    <assignments>
        <name>Assign_Presets</name>
        <label>Assign Presets</label>
        <locationX>0</locationX>
        <locationY>0</locationY>${presetAssignments}
        <connector>
            <targetReference>Behavior_Screen</targetReference>
        </connector>
    </assignments>
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
            <targetReference>Get_Newest_Account</targetReference>
        </connector>
        <getFirstRecordOnly>false</getFirstRecordOnly>
        <limit>
            <numberValue>${COLLECTION_LIMIT}.0</numberValue>
        </limit>
        <object>Account</object>
        <sortField>CreatedDate</sortField>
        <sortOrder>Desc</sortOrder>
        <storeOutputAutomatically>true</storeOutputAutomatically>
    </recordLookups>
    <recordLookups>
        <name>Get_Newest_Account</name>
        <label>Get Newest Account</label>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <assignNullValuesIfNoRecordsFound>false</assignNullValuesIfNoRecordsFound>
        <connector>
            <targetReference>Sources_Screen</targetReference>
        </connector>
        <getFirstRecordOnly>true</getFirstRecordOnly>
        <object>Account</object>
        <sortField>CreatedDate</sortField>
        <sortOrder>Desc</sortOrder>
        <storeOutputAutomatically>true</storeOutputAutomatically>
    </recordLookups>${screen("Layouts_Screen", "Layouts", layouts, "Assign_Presets")}${screen("Behavior_Screen", "Behavior", behavior, "Get_Accounts")}${screen("Sources_Screen", "Sources", sources, "Auto_Screen")}${screen("Auto_Screen", "Auto advance", auto, "Auto_Repick_Screen")}${screen("Auto_Repick_Screen", "Auto advance repick", repick, "Result_Screen")}${screen("Result_Screen", "Results", resultText + badConfig, "Auto_Finish_Screen")}${screen("Auto_Finish_Screen", "Auto finish", finishAuto)}
    <start>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <connector>
            <targetReference>Layouts_Screen</targetReference>
        </connector>
    </start>
    <status>Active</status>${accountVar("NumberRecords", true)}${accountVar("NumRecA", false)}${accountVar("NumRecB", false)}${variable(
      "PresetValues",
      "String",
      `
        <isCollection>true</isCollection>`
    )}${variable(
      "QuoteText",
      "String",
      `
        <isCollection>false</isCollection>
        <value>
            <stringValue>${escapeXml('Plan "Gold"')}</stringValue>
        </value>`
    )}
</Flow>
`;
}

// ---------------------------------------------------------------------------
// Salesforce CLI helpers
// ---------------------------------------------------------------------------

// execFileSync throws on a non-zero exit (sf's JSON status is its exit code),
// so a returned result always succeeded. A failure is rethrown with the CLI's
// own JSON error text and the subcommand that failed.
function runSf(args) {
  // On Windows sf.cmd runs through the shell, which joins the arguments, so
  // an argument with spaces (a SOQL query) has to be quoted.
  const shellArgs =
    process.platform === "win32"
      ? args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg))
      : args;
  let output;
  try {
    output = execFileSync(SF_COMMAND, shellArgs, {
      encoding: "utf8",
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024
    });
  } catch (error) {
    throw new Error(
      `sf ${args.slice(0, 3).join(" ")} failed: ${error.stdout || error.stderr || error.message}`
    );
  }
  const start = output.indexOf("{");
  if (start < 0) throw new Error(`sf returned no JSON: ${output}`);
  return JSON.parse(output.slice(start));
}

function deployFlow() {
  runSf([
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
  return result.result.url;
}

// The expected data-source contents, read from the org independently of the
// component.
function loadOrgExpectations() {
  const describe = runSf([
    "sobject",
    "describe",
    "--sobject",
    "Lead",
    "--target-org",
    TARGET_ORG,
    "--json"
  ]);
  const rating = describe.result.fields.find((f) => f.name === "Rating");
  const ratingLabels = rating.picklistValues
    .filter((entry) => entry.active)
    .map((entry) => entry.label);

  const query = runSf([
    "data",
    "query",
    "--query",
    "SELECT Id, Name, Industry, CreatedDate FROM Account ORDER BY CreatedDate DESC LIMIT 200",
    "--target-org",
    TARGET_ORG,
    "--json"
  ]);
  const accounts = query.result.records;
  if (!accounts.length) {
    throw new Error(
      `Setup: ${TARGET_ORG} has no Account records; the data-source checks need at least one.`
    );
  }
  return { ratingLabels, accounts };
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

// Runs fn as one check; a thrown error is the failure detail. fn receives an
// object it can fill with what it expected and saw; that goes into the
// check's detail whether it passes or fails.
async function check(name, fn) {
  const started = Date.now();
  const info = {};
  let error = "";
  try {
    await fn(info);
  } catch (caught) {
    error = String(caught?.message || caught).split("\n")[0];
  }
  recordCheck(name, !error, {
    ms: Date.now() - started,
    ...info,
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

const sameList = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Polls fn until it returns a truthy value; throws after timeout.
async function waitUntil(fn, what, timeout = 10000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > deadline) {
      throw new Error(`Timed out after ${timeout} ms waiting for ${what}`);
    }
    await new Promise((done) => setTimeout(done, 200));
  }
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

// Visible text of an element as trimmed, non-empty lines.
const textLines = (text) =>
  String(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

// Waits until a selector has finished loading: it shows its options or an
// error. The load runs into the timeout instead of being hidden.
async function waitForLoaded(selector) {
  await selector
    .locator('c-newton-selector-group, [role="alert"]')
    .first()
    .waitFor({ state: "attached", timeout: 30000 });
}

// Fails with the selector's own error text when it shows one.
async function assertNoLoadError(selector, what) {
  const alert = selector.getByRole("alert");
  if (await alert.count()) {
    throw new Error(`${what} error: ${(await alert.innerText()).trim()}`);
  }
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

// Reads every tile of a record-backed selector: its value (the record Id)
// and its visible text lines.
async function readRecordTiles(selector) {
  const tiles = selector.locator("c-newton-selector-choice-tile");
  const rows = [];
  for (let index = 0; index < (await tiles.count()); index += 1) {
    const node = tiles.nth(index);
    rows.push({
      id: await node.locator("input").inputValue(),
      lines: textLines(await node.innerText())
    });
  }
  return rows;
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
  const { ratingLabels, accounts } = loadOrgExpectations();
  const accountById = new Map(accounts.map((row) => [row.Id, row]));
  // The rows an ORDER BY CreatedDate DESC LIMIT n may return: ties on the
  // n-th CreatedDate can straddle the cut, so the bucket can exceed n.
  const expectedTop = (n) => {
    const cut = accounts[Math.min(n, accounts.length) - 1].CreatedDate;
    return accounts.filter((row) => row.CreatedDate >= cut);
  };

  // Asserts a record-backed selector shows the newest Accounts, newest
  // first, labelled by Name (and Industry as sublabel when asked).
  const assertNewestAccounts = (rows, limit, withIndustry, info) => {
    const allowed = new Set(expectedTop(limit).map((row) => row.Id));
    info.expectedCount = Math.min(accounts.length, limit);
    info.tiles = rows.map((row) => ({
      id: row.id,
      lines: row.lines,
      expectedName: accountById.get(row.id)?.Name ?? null,
      createdDate: accountById.get(row.id)?.CreatedDate ?? null
    }));
    assert(
      rows.length === info.expectedCount,
      `expected ${info.expectedCount} tiles, got ${rows.length}`
    );
    for (const [index, row] of rows.entries()) {
      const account = accountById.get(row.id);
      assert(
        allowed.has(row.id),
        `tile ${index + 1} (${row.id}, ${row.lines[0]}) is not among the ${limit} newest Accounts`
      );
      assert(
        row.lines[0] === account.Name,
        `tile ${index + 1} shows "${row.lines[0]}", expected Name "${account.Name}"`
      );
      if (withIndustry && account.Industry) {
        assert(
          row.lines.includes(account.Industry),
          `tile ${index + 1} does not show Industry "${account.Industry}": ${JSON.stringify(row.lines)}`
        );
      }
      if (index > 0) {
        const previous = accountById.get(rows[index - 1].id);
        assert(
          previous.CreatedDate >= account.CreatedDate,
          `tiles not newest first: ${previous.Name} (${previous.CreatedDate}) before ${account.Name} (${account.CreatedDate})`
        );
      }
    }
  };

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

  // ---- Screen 1: layouts --------------------------------------------------
  console.log("\nScreen 1 - layouts");
  const grid = selectorFor(page, "L Grid");
  const list = selectorFor(page, "L List");
  const horizontal = selectorFor(page, "L Horizontal");
  const picklist = selectorFor(page, "L Picklist");
  const radio = selectorFor(page, "L Radio");
  const columns = selectorFor(page, "L Columns");
  const dual = selectorFor(page, "L Dual");
  const dualSingle = selectorFor(page, "L Dual Single");
  for (const selector of [
    grid,
    list,
    horizontal,
    picklist,
    radio,
    columns,
    dual
  ]) {
    await waitForLoaded(selector);
  }

  // Each layout shows at least one option: a choice tile, or for the
  // Dropdown its closed combobox.
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
      const selector = selectorFor(page, label);
      assert(await selector.isVisible(), `${label} selector not visible`);
      const option =
        label === "L Picklist"
          ? selector.getByRole("combobox")
          : selector.locator("c-newton-selector-choice-tile");
      assert(
        await option.first().isVisible(),
        `${label} rendered no visible ${label === "L Picklist" ? "combobox" : "choice tile"}`
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

  // The Required message goes away as soon as the user picks an option; it
  // does not wait for the next Next.
  await check(
    "required: picking an option clears the required message",
    async (info) => {
      const message = page.getByText("Grid selection is required.");
      const messageVisible = async () => {
        for (let index = 0; index < (await message.count()); index += 1) {
          if (await message.nth(index).isVisible()) return true;
        }
        return false;
      };
      info.visibleBeforePick = await messageVisible();
      assert(info.visibleBeforePick, "the required message is not shown");
      await pickTile(grid, "Alpha");
      assert(await isChecked(grid, "Alpha"), "Alpha not checked");
      await waitUntil(
        async () => !(await messageVisible()),
        "the required message to clear after Alpha is picked",
        5000
      ).catch((error) => {
        info.visibleAfterPick = true;
        throw new Error(
          `"Grid selection is required." is still shown after Alpha was picked (${error.message})`
        );
      });
      info.visibleAfterPick = false;
    }
  );

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
  const picklistTrigger = picklist.getByRole("combobox");
  await check("picklist: open and select option", async () => {
    await picklistTrigger.click();
    await picklist.getByRole("option").filter({ hasText: "Gamma" }).click();
    const label = await picklistTrigger.innerText();
    assert(/Gamma/.test(label), `combobox shows "${label}"`);
  });

  // The Dropdown trigger is named by the selector's question label, not only
  // by its current value.
  await check(
    "dropdown: combobox is named by the question label",
    async (info) => {
      info.ariaLabel = await picklistTrigger.getAttribute("aria-label");
      info.ariaLabelledby =
        await picklistTrigger.getAttribute("aria-labelledby");
      const named = picklist.getByRole("combobox", { name: /L Picklist/ });
      assert(
        (await named.count()) === 1,
        `combobox accessible name does not include "L Picklist" (aria-label "${info.ariaLabel}")`
      );
    }
  );

  // Dropdown options are the selector's own option tiles: label, sublabel,
  // badge and icon as configured, never a raw value or an internal id.
  await check(
    "dropdown: options show label, sublabel, badge and icon, never a raw value or internal id",
    async (info) => {
      await picklistTrigger.click();
      // The open list is named after the question, like its combobox.
      const listbox = picklist.getByRole("listbox", { name: /L Picklist/ });
      await listbox.waitFor({ state: "visible", timeout: 10000 });
      const options = listbox.getByRole("option");
      info.options = [];
      for (let index = 0; index < (await options.count()); index += 1) {
        const option = options.nth(index);
        info.options.push({
          lines: textLines(await option.innerText()),
          ariaSelected: await option.getAttribute("aria-selected"),
          // Lucide "circle" is the only icon the fixture items use.
          circleIconVisible: await option
            .locator("svg circle")
            .first()
            .isVisible()
        });
      }
      await page.screenshot({
        path: join(ARTIFACT_DIR, "01a-dropdown-open.png")
      });
      await page.keyboard.press("Escape");
      if ((await picklistTrigger.getAttribute("aria-expanded")) === "true") {
        await picklistTrigger.click();
      }

      const expectedLabels = [
        DROPDOWN_NONE_LABEL,
        ...DROPDOWN_ITEMS.map((item) => item.label)
      ];
      assert(
        sameList(
          info.options.map((option) => option.lines[0]),
          expectedLabels
        ),
        `option titles ${JSON.stringify(info.options.map((o) => o.lines[0]))}, expected ${JSON.stringify(expectedLabels)}`
      );
      for (const [index, item] of DROPDOWN_ITEMS.entries()) {
        const option = info.options[index + 1];
        const leaked = option.lines.filter(
          (line) => line === item.value || line.includes("__")
        );
        assert(
          !leaked.length,
          `${item.label} option shows raw value or id ${JSON.stringify(leaked)}`
        );
        assert(
          option.circleIconVisible,
          `${item.label} option shows no icon although Show icons is on`
        );
        if (item.sublabel) {
          assert(
            option.lines.includes(item.sublabel),
            `${item.label} option does not show "${item.sublabel}": ${JSON.stringify(option.lines)}`
          );
        }
        // The tile badge is styled text-transform: uppercase, and innerText
        // reports the rendered case, so the badge is matched ignoring case.
        if (item.badge) {
          assert(
            option.lines.some(
              (line) => line.toLowerCase() === item.badge.toLowerCase()
            ),
            `${item.label} option does not show badge "${item.badge}": ${JSON.stringify(option.lines)}`
          );
        }
      }
      const noneLeaks = info.options[0].lines.filter((line) =>
        line.includes("__")
      );
      assert(
        !noneLeaks.length,
        `None option shows internal id ${JSON.stringify(noneLeaks)}`
      );
      assert(
        info.options[3].ariaSelected === "true",
        `chosen option Gamma has aria-selected="${info.options[3].ariaSelected}"`
      );
    }
  );

  await check("radio: single select", async () => {
    await pickTile(radio, "Alpha");
    assert(await isChecked(radio, "Alpha"), "Alpha not checked");
  });
  await check("columns: single select", async () => {
    await pickTile(columns, "Bravo");
    assert(await isChecked(columns, "Bravo"), "Bravo not checked");
  });

  // Single mode: clicking the card already in the Selected panel keeps it
  // picked. Only another pick replaces it.
  await check(
    "columns (single): clicking the selected card keeps it selected",
    async (info) => {
      const selectedCards = columns.getByRole("group", {
        name: "Selected cards",
        exact: true
      });
      const selectedLines = async () =>
        textLines(await selectedCards.innerText());
      info.before = await selectedLines();
      assert(
        info.before.includes("Bravo"),
        `Bravo is not in the Selected cards panel: ${JSON.stringify(info.before)}`
      );
      await pickTile(selectedCards, "Bravo");
      // The card must stay put; give a wrong removal time to show.
      const removed = await waitUntil(
        async () => !(await selectedLines()).includes("Bravo"),
        "Bravo to leave the Selected cards panel",
        2000
      ).catch(() => false);
      info.after = await selectedLines();
      if (removed) {
        // Put Bravo back so the columns output check still sees it.
        await pickTile(columns, "Bravo");
      }
      assert(
        !removed,
        `clicking the selected Bravo removed it; Selected cards now ${JSON.stringify(info.after)}`
      );
      assert(
        await isChecked(selectedCards, "Bravo"),
        "Bravo no longer shows as selected"
      );
    }
  );

  // Dual listbox panels follow the SLDS dueling-picklist pattern: listboxes
  // of options whose aria-selected marks a row highlighted for the next
  // move, and a polite live region that announces the move.
  const liveTexts = (scope) =>
    scope
      .locator('[aria-live="polite"], [role="status"]')
      .evaluateAll((nodes) => nodes.map((node) => node.innerText.trim()));
  await check(
    "dual listbox: listbox panels, highlight state and an announced move",
    async (info) => {
      const available = dual.getByRole("listbox", {
        name: "Available options",
        exact: true
      });
      const chosen = dual.getByRole("listbox", {
        name: "Chosen options",
        exact: true
      });
      await available
        .waitFor({ state: "visible", timeout: 10000 })
        .catch(() => {
          throw new Error('no listbox named "Available options" in L Dual');
        });
      info.multiselectable = [
        await available.getAttribute("aria-multiselectable"),
        await chosen.getAttribute("aria-multiselectable")
      ];
      assert(
        sameList(info.multiselectable, ["true", "true"]),
        `multi-mode panels have aria-multiselectable ${JSON.stringify(info.multiselectable)}`
      );
      const alpha = available.getByRole("option").filter({ hasText: "Alpha" });
      await alpha.click();
      await waitUntil(
        async () => (await alpha.getAttribute("aria-selected")) === "true",
        'Alpha aria-selected="true" after it is clicked'
      );
      await dual.screenshot({
        path: join(ARTIFACT_DIR, "01b-dual-highlight.png")
      });
      const before = await liveTexts(dual);
      await dual
        .getByRole("button", { name: "Move selected to chosen" })
        .click();
      await waitUntil(
        async () =>
          (await chosen
            .getByRole("option")
            .filter({ hasText: "Alpha" })
            .count()) === 1,
        "Alpha in the Chosen options listbox"
      );
      info.chosen = textLines(await chosen.innerText());
      assert(
        (await available
          .getByRole("option")
          .filter({ hasText: "Alpha" })
          .count()) === 0,
        "Alpha is still in Available options"
      );
      info.announcement = await waitUntil(async () => {
        const after = await liveTexts(dual);
        return after.find((text, index) => text && text !== before[index]);
      }, "an aria-live announcement of the move").catch((error) => {
        throw new Error(`move not announced: ${error.message}`);
      });
    }
  );

  await check(
    "dual listbox (single): only one row can be highlighted",
    async (info) => {
      const available = dualSingle.getByRole("listbox", {
        name: "Available options",
        exact: true
      });
      const chosen = dualSingle.getByRole("listbox", {
        name: "Chosen options",
        exact: true
      });
      await available
        .waitFor({ state: "visible", timeout: 10000 })
        .catch(() => {
          throw new Error(
            'no listbox named "Available options" in L Dual Single'
          );
        });
      const option = (label) =>
        available.getByRole("option").filter({ hasText: label });
      await option("Alpha").click();
      await option("Bravo").click();
      await waitUntil(
        async () =>
          (await option("Bravo").getAttribute("aria-selected")) === "true",
        'Bravo aria-selected="true" after it is clicked'
      );
      info.highlighted = textLines(
        (
          await available
            .locator('[role="option"][aria-selected="true"]')
            .allInnerTexts()
        ).join("\n")
      );
      assert(
        sameList(info.highlighted, ["Bravo"]),
        `highlighted rows ${JSON.stringify(info.highlighted)}, expected only Bravo`
      );
      await dualSingle
        .getByRole("button", { name: "Move selected to chosen" })
        .click();
      await waitUntil(
        async () =>
          (await chosen
            .getByRole("option")
            .filter({ hasText: "Bravo" })
            .count()) === 1,
        "Bravo in the Chosen options listbox"
      );
      info.chosen = textLines(await chosen.innerText());
    }
  );

  // With the None row first, a Shift-click before any plain click starts the
  // range at the clicked row: only that row is highlighted, not None and
  // every row down to it.
  await check(
    "dual listbox: a first Shift-click highlights from the clicked row, not from None",
    async (info) => {
      const dualNone = selectorFor(page, "L Dual None");
      const available = dualNone.getByRole("listbox", {
        name: "Available options",
        exact: true
      });
      await available
        .waitFor({ state: "visible", timeout: 10000 })
        .catch(() => {
          throw new Error(
            'no listbox named "Available options" in L Dual None'
          );
        });
      info.rows = textLines(
        (await available.getByRole("option").allInnerTexts()).join("\n")
      );
      assert(
        info.rows[0] === DUAL_NONE_LABEL,
        `the None row "${DUAL_NONE_LABEL}" is not first: ${JSON.stringify(info.rows)}`
      );
      const bravo = available.getByRole("option").filter({ hasText: "Bravo" });
      await bravo.click({ modifiers: ["Shift"] });
      await waitUntil(
        async () => (await bravo.getAttribute("aria-selected")) === "true",
        'Bravo aria-selected="true" after it is Shift-clicked'
      );
      info.highlighted = textLines(
        (
          await available
            .locator('[role="option"][aria-selected="true"]')
            .allInnerTexts()
        ).join("\n")
      );
      assert(
        sameList(info.highlighted, ["Bravo"]),
        `highlighted rows ${JSON.stringify(info.highlighted)}, expected only Bravo`
      );
    }
  );

  // Icon size "Large" renders the glyph at the large size (3rem / 48px) even
  // on small tiles, whose default would be the small glyph.
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
    largeIcons.length === 3 && largeIcons.every((icon) => icon.widthPx >= 48),
    {
      config: { tileSize: "small", iconSize: "large" },
      expectedMinWidthPx: 48,
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
  let previousDescendant = null;
  for (const [key, settled] of [
    ["Enter", (state) => state.expanded === "true"],
    [
      "ArrowDown",
      (state) =>
        state.activeDescendant && state.activeDescendant !== previousDescendant
    ],
    ["Enter", (state) => state.expanded !== "true"]
  ]) {
    await page.keyboard.press(key);
    const readState = async () => ({
      expanded: await keyboardTrigger.getAttribute("aria-expanded"),
      activeDescendant: await keyboardTrigger.getAttribute(
        "aria-activedescendant"
      )
    });
    const state = await waitUntil(
      async () => {
        const current = await readState();
        return settled(current) ? current : null;
      },
      `the combobox to react to ${key}`,
      3000
    ).catch(async () => ({ ...(await readState()), timedOut: true }));
    previousDescendant = state.activeDescendant;
    keySteps.push({ key, ...state });
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
  const multi = selectorFor(page, "B Multi");
  const none = selectorFor(page, "B None");
  const overrides = selectorFor(page, "B Overrides");
  const display = selectorFor(page, "B Display");
  const defaults = selectorFor(page, "B Defaults");
  const empty = selectorFor(page, "B Empty");
  const selectAll = selectorFor(page, "B Select All");
  const noneColumns = selectorFor(page, "B None Columns");
  const stale = selectorFor(page, "B Stale");
  for (const selector of [
    multi,
    none,
    overrides,
    display,
    defaults,
    selectAll,
    noneColumns,
    stale
  ]) {
    await waitForLoaded(selector);
  }

  await check("multi: min selections enforced", async () => {
    await pickTile(multi, "One");
    await clickNext(page);
    await waitForText(page, /at least 2 option/, 15000);
  });
  await check("multi: search filters options", async () => {
    await multi.getByLabel("Filter items").fill("Thr");
    await tile(multi, "Five").waitFor({ state: "hidden", timeout: 5000 });
    assert(await tile(multi, "Three").isVisible(), "Three hidden by search");
    await multi.getByLabel("Filter items").fill("");
    await tile(multi, "Five").waitFor({ state: "visible", timeout: 5000 });
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

  // Select all adds the options the search shows to what is already picked:
  // a pick the search hides and a picked Other both stay.
  const selectAllStates = async () => {
    const states = {};
    for (const label of ["Red", "Blue", "Green", "Something else"]) {
      states[label] = await isChecked(selectAll, label);
    }
    return states;
  };
  await check(
    "multi: Select all adds the filtered options and keeps hidden picks and Other",
    async (info) => {
      await pickTile(selectAll, "Red");
      await pickTile(selectAll, "Something else");
      await selectAll.getByRole("textbox").fill("Teal");
      const filter = selectAll.getByLabel("Filter items");
      await filter.fill("Blu");
      await tile(selectAll, "Green").waitFor({
        state: "hidden",
        timeout: 5000
      });
      await selectAll.getByRole("button", { name: "Select all" }).click();
      await waitUntil(
        () => isChecked(selectAll, "Blue"),
        "Blue to be selected by Select all"
      );
      await filter.fill("");
      await tile(selectAll, "Green").waitFor({
        state: "visible",
        timeout: 5000
      });
      info.states = await selectAllStates();
      assert(
        sameList(info.states, {
          Red: true,
          Blue: true,
          Green: false,
          "Something else": true
        }),
        `after Select all with filter "Blu": ${JSON.stringify(info.states)}`
      );
    }
  );
  await check("multi: Clear all also clears a picked None", async (info) => {
    await selectAll.getByRole("button", { name: "Clear all" }).click();
    await pickTile(selectAll, "No colour");
    await waitUntil(
      () => isChecked(selectAll, "No colour"),
      "No colour to be selected"
    );
    await selectAll.getByRole("button", { name: "Clear all" }).click();
    await waitUntil(
      async () => !(await isChecked(selectAll, "No colour")),
      "Clear all to clear the picked None option",
      5000
    ).catch((error) => {
      info.noneStillSelected = true;
      throw error;
    });
  });

  // A picked None stays visible in a transfer layout: it moves to the
  // Selected panel and goes back when a real option replaces it.
  await check(
    "columns: a picked None option shows in the Selected panel",
    async (info) => {
      const availableCards = noneColumns.getByRole("group", {
        name: "Available cards",
        exact: true
      });
      const selectedCards = noneColumns.getByRole("group", {
        name: "Selected cards",
        exact: true
      });
      const panels = async () => ({
        available: textLines(await availableCards.innerText()),
        selected: textLines(await selectedCards.innerText())
      });
      await pickTile(availableCards, "No fruit");
      await waitUntil(
        async () => (await panels()).selected.includes("No fruit"),
        "No fruit in the Selected cards panel",
        5000
      ).catch(async (error) => {
        info.afterNone = await panels();
        throw new Error(
          `${error.message}; panels ${JSON.stringify(info.afterNone)}`
        );
      });
      info.afterNone = await panels();
      await pickTile(availableCards, "Kiwi");
      await waitUntil(
        async () => (await panels()).selected.includes("Kiwi"),
        "Kiwi in the Selected cards panel",
        5000
      );
      info.afterKiwi = await panels();
      assert(
        !info.afterKiwi.selected.includes("No fruit") &&
          info.afterKiwi.available.includes("No fruit"),
        `picking Kiwi did not return None to Available: ${JSON.stringify(info.afterKiwi)}`
      );
    }
  );

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
      await waitUntil(
        () => isChecked(none, "None of these"),
        "the None tile to show as selected after it is picked",
        5000
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
  await page.screenshot({
    path: join(ARTIFACT_DIR, "02-behavior.png"),
    fullPage: true
  });
  await pickTile(multi, "Three"); // deselect -> 2 selected, within min/max

  // B Stale is Required and its Default selection "stale" matches no option:
  // nothing shows as picked, so Next must be blocked.
  await check(
    "required: a pre-set value that matches no option does not satisfy Required",
    async (info) => {
      await clickNext(page);
      const text = await waitForText(
        page,
        /Stale pick is required\.|S Picklist/,
        30000
      );
      info.blocked = /Stale pick is required\./.test(text);
      assert(
        info.blocked,
        "Next passed the Behavior screen although B Stale shows no selection"
      );
    }
  );
  if (!(await page.getByText("S Picklist").count())) {
    await pickTile(stale, "Alpha");
    await clickNext(page);
  }

  // ---- Screen 3: data sources --------------------------------------------
  console.log("\nScreen 3 - data sources");
  await waitForText(page, /S Picklist/);
  const sPicklist = selectorFor(page, "S Picklist");
  const sSoql = selectorFor(page, "S Soql");
  const sSoqlDate = selectorFor(page, "S Soql Date");
  const sCollection = selectorFor(page, "S Collection");
  const sCollectionNumber = selectorFor(page, "S Collection Number");

  let ratingLabel = "";
  await check("picklist source loads Lead.Rating values", async (info) => {
    await waitForLoaded(sPicklist);
    await assertNoLoadError(sPicklist, "picklist source");
    await sPicklist.getByRole("combobox").click();
    const options = sPicklist.getByRole("option");
    await options.first().waitFor({ state: "visible", timeout: 10000 });
    info.expected = ratingLabels;
    info.actual = (await options.allInnerTexts()).map(
      (text) => textLines(text)[0]
    );
    assert(
      sameList(info.actual, info.expected),
      `options ${JSON.stringify(info.actual)}, expected Lead.Rating ${JSON.stringify(info.expected)}`
    );
    ratingLabel = info.actual[0];
    await options.first().click();
  });

  let soqlName = "";
  await check("SOQL source loads Account records", async (info) => {
    await waitForLoaded(sSoql);
    await assertNoLoadError(sSoql, "SOQL source");
    const rows = await readRecordTiles(sSoql);
    assertNewestAccounts(rows, SOQL_LIMIT, true, info);
    await sSoql.locator("c-newton-selector-choice-tile label").first().click();
    soqlName = rows[0].lines[0];
  });

  await check(
    "SOQL source: a DATETIME literal in WHERE loads rows",
    async (info) => {
      info.whereClause = "CreatedDate < 2999-01-01T00:00:00Z";
      await waitForLoaded(sSoqlDate);
      await assertNoLoadError(sSoqlDate, "SOQL DATETIME filter");
      assertNewestAccounts(
        await readRecordTiles(sSoqlDate),
        SOQL_DATE_LIMIT,
        false,
        info
      );
    }
  );

  let collectionName = "";
  await check(
    "collection source renders Flow record collection",
    async (info) => {
      await waitForLoaded(sCollection);
      await assertNoLoadError(sCollection, "collection source");
      const rows = await readRecordTiles(sCollection);
      assertNewestAccounts(rows, COLLECTION_LIMIT, true, info);
      await sCollection
        .locator("c-newton-selector-choice-tile label")
        .first()
        .click();
      collectionName = rows[0].lines[0];
    }
  );

  // Number values from a record collection stay what they are: 42 matches
  // the Default selection "42", and 0 is a pickable value of its own.
  await check(
    "collection source: Number values select, including the preset 42 and 0",
    async (info) => {
      await waitForLoaded(sCollectionNumber);
      await assertNoLoadError(sCollectionNumber, "collection Number source");
      const trigger = sCollectionNumber.getByRole("combobox");
      info.onLoad = (await trigger.innerText()).trim();
      // Pick 0 before asserting, so the Flow output check below sees the
      // value the component writes for it either way.
      await trigger.click();
      await sCollectionNumber
        .getByRole("option")
        .filter({ hasText: "Zero Co" })
        .click();
      info.afterPick = (await trigger.innerText()).trim();
      assert(
        info.onLoad === "Forty Two Co",
        `Default selection "42" shows "${info.onLoad}", expected "Forty Two Co"`
      );
      assert(
        info.afterPick === "Zero Co",
        `after picking Zero Co the combobox shows "${info.afterPick}"`
      );
    }
  );

  await page.screenshot({
    path: join(ARTIFACT_DIR, "03-sources.png"),
    fullPage: true
  });
  await clickNext(page);

  // ---- Screen 4: auto advance -------------------------------------------
  console.log("\nScreen 4 - auto advance");
  await waitForText(page, /A Auto/);
  await check(
    "auto-advance: arrow keys change the selection without advancing",
    async (info) => {
      const auto = selectorFor(page, "A Auto");
      await waitForLoaded(auto);
      await tile(auto, "Go").locator("input").focus();
      await page.keyboard.press("ArrowRight");
      info.stopChecked = await isChecked(auto, "Stop");
      assert(info.stopChecked, "ArrowRight did not select Stop");
      // Auto-advance fires 150 ms after a pick; wait well past that.
      const advanced = await page
        .getByText("A Repick")
        .first()
        .waitFor({ state: "visible", timeout: 2000 })
        .then(
          () => true,
          () => false
        );
      info.advanced = advanced;
      assert(!advanced, "arrow-key navigation advanced the Flow");
    }
  );
  await check("auto-advance moves to results on select", async () => {
    const auto = selectorFor(page, "A Auto");
    await waitForLoaded(auto);
    await pickTile(auto, "Go");
    await waitForText(page, /A Repick/, 30000);
  });

  await check(
    "auto-advance: clicking the pre-selected option advances",
    async (info) => {
      const repick = selectorFor(page, "A Repick");
      await waitForLoaded(repick);
      info.preselected = await isChecked(repick, "Go");
      assert(info.preselected, "Default selection Go is not shown as selected");
      await pickTile(repick, "Go");
      await waitForText(page, /grid=/, 10000).catch(() => {
        throw new Error(
          "clicking the pre-selected Go did not advance to the results screen"
        );
      });
    }
  );
  if (!(await page.getByText(/grid=/).count())) {
    await clickNext(page);
    await waitForText(page, /grid=/, 30000);
  }

  // ---- Screen 5: output assertions ---------------------------------------
  console.log("\nResults - Flow outputs");
  const text = await bodyText(page);
  const resultLines = text.split("\n").map((line) => line.trim());
  const lineFor = (key) =>
    resultLines.find((line) => line.startsWith(`${key}=`)) ?? null;
  await page.screenshot({
    path: join(ARTIFACT_DIR, "04-results.png"),
    fullPage: true
  });
  const expectOutput = (name, pattern) =>
    check(`output ${name}`, async (info) => {
      info.line = lineFor(pattern.source.split("=")[0]);
      assert(pattern.test(text), `${name} did not match ${pattern}`);
    });
  // Exact comparison with a value that came from org data.
  const expectLine = (name, expected) =>
    check(`output ${name}`, async (info) => {
      info.expected = expected;
      info.line = lineFor(expected.split("=")[0]);
      assert(
        resultLines.includes(expected),
        `results screen has no line "${expected}"`
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
  await check(
    "output allValues and allLabels list the options without the Other sentinel",
    async (info) => {
      info.values = lineFor("defaultsAllValues");
      info.labels = lineFor("defaultsAllLabels");
      assert(
        /\bred\b/.test(info.values) && /\bblue\b/.test(info.values),
        `allValues misses red/blue: "${info.values}"`
      );
      assert(
        /Red/.test(info.labels) &&
          /Blue/.test(info.labels) &&
          info.labels.includes("--None--"),
        `allLabels misses Red/Blue/--None--: "${info.labels}"`
      );
      assert(
        !info.values.includes("__newton_manual_input__"),
        `allValues contains the Other sentinel: "${info.values}"`
      );
      assert(
        !/\bOther\b/.test(info.labels),
        `allLabels contains the Other entry: "${info.labels}"`
      );
    }
  );
  await expectLine(
    "default selection writes label and count",
    "preset=bravo presetLabel=Bravo presetCount=1"
  );
  await expectOutput(
    "default multi selection writes labels and count",
    /presetMultiCount=2 presetMultiLabels=.*Alpha.*Gamma/
  );
  await expectOutput(
    "default selection matching no option is not output",
    /staleOpt=\[\]/
  );
  await check(
    "output default record selection writes selectedRecord and count",
    async (info) => {
      info.newestAccount = lineFor("newestAccount");
      info.presetRecord = lineFor("presetRecord");
      info.presetRecordCount = lineFor("presetRecordCount");
      const newestName = (info.newestAccount || "").slice(
        "newestAccount=".length
      );
      assert(newestName, "the Flow found no newest Account");
      assert(
        info.presetRecord === `presetRecord=${newestName}`,
        `selectedRecord.Name is "${info.presetRecord}", expected "${newestName}"`
      );
      assert(
        info.presetRecordCount === "presetRecordCount=1",
        `selectionCount is "${info.presetRecordCount}"`
      );
    }
  );
  await expectLine("picklist source label", `ratingLabel=${ratingLabel}`);
  await expectLine("SOQL selection count", `soqlCount=1 soqlLabel=${soqlName}`);
  await expectLine(
    "collection selection count",
    `collectionCount=1 collectionLabel=${collectionName}`
  );
  await expectLine("collection numeric value", "collectionNumber=0");
  await expectOutput("auto-advance value", /auto=go/);
  // Re-picking the pre-selected Go keeps its value.
  await expectLine("auto-advance re-pick value", "repick=go");

  // X Bad Config merges a Flow value with double quotes into its label, so
  // the resolved config cannot be read. The error says so instead of the
  // generic load error.
  await check(
    "unreadable selectorConfigJson shows a specific error",
    async (info) => {
      const badConfig = page.locator("c-newton-selector-data-selector").first();
      await waitForLoaded(badConfig);
      info.selectorText = textLines(await badConfig.innerText());
      const alert = badConfig.getByRole("alert");
      assert(
        await alert.count(),
        `no error shown; the selector reads ${JSON.stringify(info.selectorText)}`
      );
      info.alert = (await alert.innerText()).trim();
      assert(info.alert, "the error is empty");
      assert(
        !info.alert.includes(GENERIC_LOAD_ERROR),
        `shows the generic "${GENERIC_LOAD_ERROR}"`
      );
    }
  );

  // ---- Screen 6: auto-advance on the last screen ---------------------------
  console.log("\nScreen 6 - auto-advance finishes the Flow");
  await clickNext(page);
  await waitForText(page, /F Auto/);
  await check(
    "auto-advance on the last screen finishes the Flow",
    async (info) => {
      const finish = selectorFor(page, "F Auto");
      await waitForLoaded(finish);
      await pickTile(finish, "Done");
      // The Flow runtime replaces the screen with an error when the
      // component sends a navigation the screen does not offer. A finished
      // Flow restarts at its first screen, so "F Auto" gone and "L Grid" back
      // is the finished state; a loading spinner in between is neither.
      const outcome = await waitUntil(
        async () => {
          const body = await bodyText(page);
          const runtimeError = textLines(body).find((line) =>
            /Something went wrong|isn't supported on this screen/.test(line)
          );
          if (runtimeError) return { runtimeError };
          return /F Auto/.test(body) || !/L Grid/.test(body)
            ? null
            : { restartedAtFirstScreen: true };
        },
        "the Flow to finish after Done is picked",
        15000
      );
      Object.assign(info, outcome);
      assert(
        !outcome.runtimeError,
        `the Flow did not finish: ${outcome.runtimeError}`
      );
    }
  );
  await page.screenshot({
    path: join(ARTIFACT_DIR, "05-auto-finish.png"),
    fullPage: true
  });

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
