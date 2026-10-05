# How to develop and test Newton Selector

Set up the repo, run the checks that guard every commit, and run the end-to-end tests against a real org.

## Prerequisites

- Node.js and npm.
- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf` v2 or later).
- A Salesforce org you can deploy to: a scratch org, Developer Edition or sandbox.
- For the browser tests: Playwright's Chromium (installed in step 7).

## Steps

1. Install dependencies.

   ```bash
   npm install
   ```

   The `prepare` script installs Husky git hooks.

2. Deploy the source to an org and assign the permission set.

   ```bash
   sf org login web --alias my-org
   sf project deploy start --source-dir force-app --target-org my-org
   sf org assign permset --name Newton_Selector_Admin --target-org my-org
   ```

   For a scratch org, create one first:

   ```bash
   sf org create scratch --definition-file config/project-scratch-def.json --alias newton-dev --duration-days 30
   sf project deploy start --source-dir force-app --target-org newton-dev
   ```

   `force-app` is the package. Test fixtures live in the separate, non-default `fixtures` package directory; the scripts that need them deploy them (`--source-dir fixtures/...`), so a plain deploy never ships them.

3. Run the LWC unit tests.

   ```bash
   npm run test:unit
   ```

   Variants: `npm run test:unit:watch`, `npm run test:unit:debug`, `npm run test:unit:coverage`. Tests live in `__tests__/` folders inside each component and never deploy (`.forceignore` excludes them). The Jest config maps `lightning/flowSupport` and the config-styles helper to mocks in `force-app/test/jest-mocks/`.

4. Run the Apex tests.

   ```bash
   sf apex run test --target-org my-org --result-format human --wait 10
   ```

5. Lint and format.

   ```bash
   npm run lint
   npm run lint:slds
   npm run prettier:verify
   npm run prettier
   ```

   `lint` runs ESLint on LWC JavaScript. `lint:slds` runs the SLDS linter (`@salesforce-ux/slds-linter`) over `force-app/main/default/lwc`. `prettier` rewrites files; `prettier:verify` only checks.

6. Check Apex complexity (optional).

   ```bash
   sf code-analyzer run --rule-selector pmd:ApexComplexity --target force-app/main/default/classes
   ```

   `code-analyzer.yml` loads `pmd-apex-complexity.xml`: a method is reported at cyclomatic complexity 10 or cognitive complexity 15, a class at 40 and 50, plus PMD's excessive-parameter and excessive-public-count rules.

7. Run the end-to-end tests.

   ```bash
   npm run test:e2e:install
   SF_TARGET_ORG=my-org npm run test:e2e:builder
   SF_TARGET_ORG=my-org npm run test:e2e:runtime
   ```

   Both scripts stop at once if `SF_TARGET_ORG` is not set. `force-app` must already be deployed to that org. Each script generates its Flow into `fixtures/main/default/flows/`, deploys it from there, and deletes the local file when it ends.

   **Builder E2E** (`scripts/e2e/flow-builder-newton-selector-e2e.mjs`):
   1. Creates two Leads and generates a Draft Flow named `Newton_Selector_E2E`.
   2. Deploys the Flow, opens it in Flow Builder, drives the configuration modal and saves.
   3. Retrieves the Flow and asserts the persisted configuration.
   4. Runs a Debug pass and checks the runtime output.

   Output goes to `output/playwright/flow-builder-newton-selector-e2e/<RUN_ID>/`: `results.json` (every check with its outcome and detail), `diagnostics.json` (browser console and page errors), numbered screenshots, measurement JSON files and a `retrieved/` folder with the Flow as saved.

   Variables: `NEWTON_E2E_RUN_ID`, `NEWTON_E2E_SOFT=1` (record a failed check and keep going), `NEWTON_E2E_SETUP_ONLY`, `NEWTON_E2E_EXISTING_LEADS` (reuse two or more existing Leads by LastName), `NEWTON_E2E_SKIP`, `NEWTON_E2E_APPEARANCE_LIMIT`, `NEWTON_E2E_STEP_BUDGET_MS`, `PLAYWRIGHT_HEADLESS`, `PLAYWRIGHT_CHANNEL`, `PLAYWRIGHT_RECORD_VIDEO`.

   **Runtime E2E** (`scripts/e2e/newton-selector-runtime-e2e.mjs`): deploys an active multi-screen Flow named `Newton_Selector_Features` that exercises every layout, selection mode, validation rule, option modifier and data source, drives it in the browser, and asserts the Flow outputs on a results screen. It reads Lead picklist values and Account records, so the org needs at least one Account.

   Output goes to `output/playwright/newton-selector-runtime-e2e/<RUN_ID>/`: `results.json`, `diagnostics.json` and one screenshot per screen (`01-layouts.png` to `04-results.png`).

   Variables: `NEWTON_E2E_RUN_ID`, `NEWTON_E2E_SOFT=1`, `PLAYWRIGHT_HEADLESS`, `PLAYWRIGHT_CHANNEL`.

   Each script prints `N/M checks passed` and exits 1 if any check failed. Open `results.json` to see which.

## What runs on every commit

Husky runs `npm run precommit` (lint-staged) on staged files:

1. `prettier --write` on `cls`, `css`, `html`, `js`, `json`, `md`, `xml`, `yaml` and `yml` files.
2. `eslint` on `**/lwc/**/*.js`.
3. `sfdx-lwc-jest --bail --findRelatedTests --passWithNoTests` on anything under `lwc/`.

Apex tests, the SLDS linter, Code Analyzer, the icon audit and the E2E tests do not run in the hook. Run them yourself before you open a pull request.

## Regenerating icons

Icons are a Lucide catalog compiled into JavaScript. After changing the `lucide-static` version:

```bash
npm run generate:lucide-icons
npm run audit:lucide-icons
```

`generate` reads `lucide-static` and writes `newtonSelectorIcon/lucideIconPaths.js` (exports `DEFAULT_ICON_NAME`, `LUCIDE_ICON_PATHS`, `normalizeIconName`, `resolveIconContent`) and `newtonSelectorFlowCpeIconSelector/iconCatalog.js` (exports `ICONS`, `filterIcons`, `findIconByName`), then runs Prettier. Never edit either file by hand.

`audit` fails (exit 1) if LWC source uses `lightning-icon` or an SLDS icon namespace such as `utility:`, if a `c-newton-selector-icon` has a static name outside Lucide or no `size`, if an `icon: "…"` literal in LWC JavaScript is not a Lucide name, or if a value in the field-type icon maps (`TYPE_ICON_MAP` in `newtonSelectorFlowCpeUtilityHelpers` and the map in `NewtonSelectorFlowCpeDescribeService.cls`) is not a Lucide name. It also fails if it cannot find one of those maps.

## Prove a CSS refactor changes nothing on screen

When restructuring the editor's stylesheets without meaning to change the look, snapshot the computed style of every element before and after and diff them. Each capture deploys the `Newton_Selector_CPE_Lab` Flow from the `fixtures` package directory and takes about 20 minutes.

```bash
CPE_STYLE_SNAPSHOT=output/style-snapshots/before.json SF_TARGET_ORG=<alias> node scripts/e2e/cpe-capture.mjs
```

Deploy the change, capture `after.json` the same way, then:

```bash
node scripts/e2e/style-snapshot-diff.mjs output/style-snapshots/before.json output/style-snapshots/after.json output/style-snapshots/report.json
```

It prints `IDENTICAL` (exit 0) or lists each element whose computed style, `::before`/`::after` style or design tokens changed (exit 1). Hover and focus states aren't captured.

## Verification

- `npm run test:unit` finishes with all suites passing.
- `sf apex run test` reports every test passing.
- `npm run lint` and `npm run prettier:verify` exit 0.
- `npm run audit:lucide-icons` prints `Lucide icon usage audit passed.`
- Each E2E run's `results.json` has `"ok": true`, and its screenshots show the screens it names.

## Troubleshooting

| Symptom                                                   | Fix                                                                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| An E2E script exits with "Set SF_TARGET_ORG …"            | Set `SF_TARGET_ORG` to an alias you have logged in to (`sf org list`).                                |
| Playwright says the browser is missing                    | Run `npm run test:e2e:install`.                                                                       |
| E2E cannot find the component                             | Deploy `force-app` first.                                                                             |
| A Draft flow named `Newton_Selector_E2E` stays in the org | The builder E2E removes its Leads and local fixture but not the Draft Flow. Delete the Flow in Setup. |
| Husky hooks do not run                                    | `npm run prepare`, or confirm `git config core.hooksPath` points at `.husky/_`.                       |

## Related

- [Architecture](architecture.md)
- [Apex API reference](reference-apex-api.md)
- [Known limitations](known-limitations.md)
