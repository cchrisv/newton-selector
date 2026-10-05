# AGENTS.md

## Ground rules

- Prefer the simplest implementation that fully solves the problem.
- No backward compatibility unless explicitly required.
- When changing an interface, update every caller in the same change.
- Do not keep old code "just in case."
- Do not add speculative abstractions, fallbacks, or compatibility layers.
- Never delete databases, persistent data, or reset state without explicit approval.

## Every change, in this order

1. **Understand first:** identify the required behavior, constraints, existing implementation, and relevant docs.
2. **Docs first:** update relevant documentation when behavior or contracts change. Docs and code must not contradict each other.
3. **Tests before implementation:** decide how the behavior will be verified and, when adding tests, write them before production code. Confirm new tests fail for the intended reason.
4. **Smallest implementation:** write only enough code to satisfy the required behavior. Nothing extra.
5. **Verify:** run the relevant tests and inspect the actual output yourself.
6. **Clean up:** remove code, files, dependencies, tests, and docs made obsolete by the change.

## Design System

All designs, components, and UI work in this project MUST match and adhere to **Salesforce Lightning Design System 2.0 (SLDS 2)**.

- Reference: https://lightningdesignsystem.com/2e1ef8501
- Use SLDS 2 design tokens, styling hooks, and component patterns — do not hardcode CSS values (colors, spacing, typography, radii, shadows).
- Prefer SLDS 2 utility classes and BEM class names over custom styles.
- For existing LWC components, run the SLDS linter (`npm run lint:slds`) and fix violations when making visual changes (see the `uplifting-components-to-slds2` skill).
- New components should be built SLDS 2–compliant from the start, including accessibility (WCAG 2.1 AA), RTL support, and dark mode tokens where applicable.

## Code standards

### Apex

- Classes that run queries or describes are `with sharing`; queries run in `AccessLevel.USER_MODE`.
- Bind every value (`Database.queryWithBinds`). Object and field names come from the config only after a describe check, and the SOQL uses the canonical name from describe. Allowlist anything else that enters SOQL text (operators, sort direction).
- No SOQL or DML inside loops. Describe an object once per build, not once per field.
- Expected, user-fixable problems throw `NewtonSelectorException` with a message that names the object, field or value at fault. Never swallow an exception silently.
- Tests use `Assert.*`, run as a standard user through `System.runAs`, and build data with `NewtonSelectorTestDataFactory`.
- Complexity: `sf code-analyzer run --rule-selector pmd:ApexComplexity` (thresholds in `pmd-apex-complexity.xml`) reports nothing for new or changed code.

### LWC

- `@api` down, events up. Pure-JS logic shared by several components lives in a `newtonSelector…Utility…` bundle.
- No `console.*` in shipped code.
- Every failure the user can hit (load errors, bad config, failed searches) is shown in the UI with the real message, never only logged or dropped.
- `npm run lint` passes. No complexity limit is enforced for JavaScript; keep functions small enough that a reviewer can follow them.

## Testing philosophy

### Prefer E2E behavior tests

- Strongly prefer E2E tests as the primary—and when practical, sole—testing mechanism.
- Test externally observable behavior, not implementation details.
- Use E2E tests for complex features and important workflows.
- Every E2E run must produce a verifiable, repeatable artifact: report, trace, screenshot, generated output, or equivalent evidence.
- Record enough information to reproduce the verification: command, setup, inputs/fixtures, expected result, and artifact location.
- "Tests passed" is not sufficient evidence by itself.

### Isolated tests require justification

Do not add unit or other isolated tests merely because code was added or changed.

Add an isolated test only when an important behavior or failure mode cannot be adequately verified through E2E testing.

When isolated testing is necessary:

1. Before implementation, write down the behavior being guaranteed.
2. Enumerate credible ways that behavior could fail, including relevant boundaries and edge cases.
3. Derive tests from those requirements and failure modes—not from the implementation.
4. Run the tests and confirm they fail for the intended reason.
5. Only then implement the change.

**NEVER implement production code and then backfill unit tests for it.**

## Tests must earn their existence

Every test must protect meaningful behavior and be capable of failing when that behavior is wrong.

### Tautological tests are harmful

Do not write tests that:

- Reimplement the production algorithm to calculate the expected result.
- Derive expectations from the output being tested.
- Merely confirm that a mock returns what it was configured to return.
- Exercise code without making a meaningful behavioral assertion.

Expected results must come independently from requirements, contracts, invariants, or known examples.

### Change-detector tests are harmful

Do not write tests whose primary purpose is detecting implementation changes.

Avoid pinning:

- Internal structure.
- Private implementation details.
- Incidental call ordering.
- Exact intermediate representations.
- Snapshots with no meaningful behavioral contract.

A behavior-preserving refactor should not normally require test changes.

If a test fails, it should mean a requirement or contract may have been violated—not merely that the implementation changed.

### Regression tests require a genuine coverage gap

A bug fix does not automatically require a new test.

Before adding a regression test:

1. Identify the behavior that was incorrect.
2. Determine whether existing behavior/E2E tests already cover it.
3. If coverage exists, fix the implementation without duplicating the test.
4. If a genuine behavioral gap exists, prefer extending the appropriate existing test.
5. Add a new test only when that is the clearest way to protect previously untested behavior.

Do not accumulate one-off tests for every historical bug.

## Implementation discipline

### Keep changes small

- Make the smallest change that completely solves the requested problem.
- Do not expand scope because nearby code could also be improved.
- Do not introduce abstractions until the current change actually requires them.
- Prefer straightforward code over clever code.
- Do not create helpers, wrappers, services, factories, or configuration merely in anticipation of future use.
- If existing code can be simplified as a direct consequence of the change, simplify it.

### Replace instead of preserving

When requirements change:

- Change the implementation directly.
- Update all callers in the same change.
- Delete the superseded implementation.
- Delete compatibility shims that are no longer required.
- Delete tests that only protect obsolete behavior.
- Update documentation describing the old behavior.

Do not preserve multiple implementations unless there is a concrete requirement for both.

### Clean up after yourself

Every change should leave the repository simpler or no more complicated than necessary.

After implementation:

- Remove dead code.
- Remove unused imports.
- Remove unused dependencies.
- Remove obsolete configuration.
- Remove superseded files.
- Remove stale comments.
- Remove obsolete documentation.
- Remove tests for behavior that no longer exists.

Do not leave commented-out code or TODOs merely to avoid making a decision.

If you are uncertain whether something is safe to delete, ask rather than silently preserving it forever.

## Documentation

Documentation is part of the implementation.

Before changing behavior:

- Find the documentation that defines or describes it.
- Identify any contracts, examples, or assumptions that will become outdated.

When behavior changes:

- Update relevant documentation in the same change.
- Remove documentation for behavior that no longer exists.
- Ensure examples reflect the actual implementation.
- Do not document speculative future behavior.

Documentation, tests, and production code must agree.

If they disagree, investigate the intended behavior rather than arbitrarily choosing one as correct.

## Verification

Verification means demonstrating that the requested behavior works—not merely demonstrating that a command exits successfully.

Use the highest-level practical verification.

Prefer, in order:

1. E2E verification of observable behavior.
2. Integration-level verification when E2E cannot exercise the behavior adequately.
3. Isolated/unit verification only when the behavior cannot reasonably be verified at a higher level.

When verifying:

- Exercise realistic inputs.
- Verify meaningful outputs and side effects.
- Exercise important failure paths.
- Inspect generated artifacts.
- Read test output yourself.
- Do not infer success solely from an exit code.
- Do not claim something works if you did not actually verify it.

For UI behavior, prefer verifying what the user can actually observe and do rather than internal component state.

For APIs, prefer verifying requests, responses, persistence, and externally visible side effects rather than private method calls.

## E2E artifacts

Complex E2E verification must leave evidence that another developer or agent can inspect and reproduce.

Appropriate artifacts may include:

- HTML test reports.
- Browser traces.
- Screenshots.
- Videos.
- Request/response captures.
- Generated files.
- Structured logs.
- Database/state snapshots when safe and appropriate.

The artifact must make it possible to determine what was tested and whether the expected behavior occurred.

For relevant E2E verification, report:

- The command used.
- Required environment/setup.
- Important inputs or fixtures.
- Expected observable behavior.
- Actual result.
- Artifact location.

Artifacts should be deterministic enough that repeating the documented process produces equivalent evidence.

## Failure handling

When something fails:

1. Read the actual error.
2. Identify which assumption was wrong.
3. Determine whether the failure is in the implementation, test, environment, or requirement.
4. Fix the underlying cause.
5. Rerun the relevant verification.

Do not blindly retry commands or modify unrelated code hoping the failure disappears.

Do not weaken, delete, or skip a legitimate test merely to make the suite pass.

If a test expectation is wrong because the requirement changed, update or remove the test and explain why.

## Don't

- Keep old code "just in case."
- Add backward compatibility that was not requested.
- Add abstractions for hypothetical future requirements.
- Create tests solely to increase coverage.
- Backfill unit tests after implementing production code.
- Test private implementation details without a concrete reason.
- Duplicate implementation logic inside tests.
- Add regression tests automatically for every bug.
- Preserve obsolete tests after behavior changes.
- Claim verification you did not perform.
- Treat a passing command as proof of correct behavior without inspecting its output.
- Delete or reset persistent data without explicit approval.
- Expand the scope of the task unnecessarily.

## Before saying done

- Run the relevant tests.
- Read and inspect the output yourself.
- Verify the requested behavior, not merely the exit code.
- Confirm E2E evidence/artifacts are reproducible where applicable.
- Check important failure paths where appropriate.
- Remove anything the change made obsolete.
- Check for dead code and unused dependencies introduced or exposed by the change.
- Check that docs, tests, and implementation agree.
- State what you changed.
- State what you deleted or simplified.
- State exactly what verification you performed.
- Provide the location of relevant verification artifacts.
- If you did not run a relevant check, say so explicitly.
- Do not say the work is complete if you know relevant verification is still failing.

## When I correct you

Treat corrections as improvements to the operating instructions, not merely fixes for the current task.

When I correct a mistake:

1. Fix the immediate issue.
2. Determine the general rule that would have prevented it.
3. Add that rule under `## Lessons`.
4. Keep the lesson short, specific, and actionable.

Write lessons in this form:

> When X, do Y.

Do not write lessons that merely describe what happened.

Bad:

> I forgot to update the API documentation.

Good:

> When changing an API contract, update its documentation in the same change.

If essentially the same mistake happens twice, the existing lesson is unclear or ineffective. Rewrite the existing lesson instead of adding another version of it.

Do not create multiple lessons expressing the same rule.

If `## Lessons` grows beyond 20 entries:

1. Review all lessons.
2. Merge duplicates and overlapping rules.
3. Delete lessons superseded by stronger rules elsewhere in this file.
4. Remove lessons that are no longer relevant.
5. Show me the resulting cleanup.

## Lessons

<!--
Add project-specific lessons here as corrections occur.

Format:
- When X, do Y.
-->

- When fixing a bug or adding behavior, extend the relevant E2E script (`scripts/e2e/`) to assert it instead of adding a Jest test.
- When Salesforce requires Apex test coverage to deploy, write Apex unit tests; that requirement overrides the E2E-only preference.
- When changing a style or behavior, edit the rule or code where it lives; never append an override block or a new "version/layer" (V1, final layer, supersedes …) on top of the old one, and delete any such layer you find.
