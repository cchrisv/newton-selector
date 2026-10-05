# LWC Testing Reference

`AGENTS.md` ("Testing philosophy", "Tests must earn their existence") is the
standard. This page only points at the project's tools.

## E2E first

Verify a behavior through the E2E script that covers it, and extend that script
when you fix a bug or add behavior:

| Area                                   | Script                                            | Command                                         |
|----------------------------------------|---------------------------------------------------|-------------------------------------------------|
| Runtime selector inside a Flow screen  | `scripts/e2e/newton-selector-runtime-e2e.mjs`     | `SF_TARGET_ORG=<alias> npm run test:e2e:runtime` |
| Custom property editor in Flow Builder | `scripts/e2e/flow-builder-newton-selector-e2e.mjs` | `SF_TARGET_ORG=<alias> npm run test:e2e:builder` |

Each run writes `results.json`, `diagnostics.json` and screenshots under
`output/playwright/<script>/<RUN_ID>/`. Read them; an exit code alone is not
evidence. Setup and fixtures: `docs/howto-develop-and-test.md`.

## Isolated (Jest) tests

There is no "one `__tests__` folder per component" rule. Add a Jest test only
when an important behavior or failure mode cannot be verified through E2E, and
follow AGENTS' steps: write down the guaranteed behavior, enumerate how it can
fail, write the test from those, confirm it fails for the intended reason, then
implement.

Do not write tests that:

- check that an `@api` value reaches a child (`renders with provided label`);
- assert that a mock returns what it was configured to return;
- recompute the expected result with the production algorithm;
- pin internal structure, call order or snapshots without a behavioral contract.

When a test is justified, it lives in `<bundle>/__tests__/<bundle>.test.js` and
runs with `npm run test:unit`. `jest.config.js` maps `lightning/flowSupport` and
the CSS-only modules `c/newtonSelectorFlowCpeUtilityConfigStyles` and
`c/newtonSelectorFlowCpeUtilityTokens` to mocks in `force-app/test/jest-mocks/`.
