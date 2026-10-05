# Explanation: design decisions

Why Newton Selector is built the way it is. The repo does not carry written design records, so the reasoning below is read from the code, its comments and its history. Where a reason is inferred rather than stated, the text says so.

## One JSON string instead of many Flow inputs

**The problem.** A Flow screen component declares each design-time property in its `js-meta.xml`. Newton Selector has well over a hundred settings (four data sources, field maps, per-item overrides, color tones per state, spacing per side). Declaring each as a Flow property would make the metadata enormous, force Flow Builder to show a long property list, and make every new option a breaking metadata change.

**The approach.** The component declares two design-time inputs, `selectorConfigJson` and `sourceRecords`, and the Custom Property Editor owns the rest. The whole configuration is one JSON string. On load, `FlowScreen` deep-merges that string over `defaultSelectorConfig()`.

**What it buys you.**

- New options are additive. A Flow saved last year opens with today's defaults filling in whatever it never set.
- The defaults live in one place (`newtonSelectorUtilityConfigDefaults`), shared by runtime, editor and preview.
- Config is easy to diff in version control, and tests can feed the component a config object directly.

**What it costs.**

- Flow Builder cannot validate individual settings. Validation lives in the editor and in `validate()`.
- Hand-editing JSON in Flow XML is possible but unguided. The one key the editor exposes no control for (`showSelectAll`) is reachable only that way. Booleans must be real JSON booleans.
- Merge fields are stored as literal `{!Var}` text inside the string, so they depend on Flow resolving string inputs.

## A custom editor instead of the default Flow property panel

**The problem.** Admins choosing between a picklist, a record collection, a SOQL query and a custom list need object pickers, field pickers, a visual filter builder, per-item overrides and a way to _see_ what they are building. The default property panel offers text boxes and checkboxes.

**The approach.** A Custom Property Editor with a small panel in Flow Builder that opens a large modal. The modal splits into a live preview on the left and four chapters on the right (Data, Content, Behavior, Appearance).

**Why a modal and a split view.** The panel in Flow Builder is narrow. A modal gives room for a side-by-side preview, which is the fastest feedback loop for a visual component. Edits stay on a working copy until Save, so an admin can experiment and cancel; Cancel and Esc ask first when there are unsaved changes.

**Trade-offs.**

- The editor is most of the codebase. Its bundles are several times larger than the runtime bundles.
- The right column is a single scroll with no section navigation. The code tracks the active chapter by scroll position (to show that chapter's issues at the top), but no nav control is rendered.

## The preview runs the real selector

**The problem.** A separate preview implementation drifts from the real one. The admin approves something that does not match what users see.

**The approach.** `newtonSelectorFlowCpeConfigPreview` renders the real `DataSelector`, fed sample data. The editor's own tile pickers are built from the runtime `Group` and `ChoiceTile`.

**Trade-off.** The preview never queries your org, so it cannot show a real SOQL result. It shows neutral sample options (or your real Custom options). **Validate query** is the bridge to real data.

## Only SOQL needs Apex

**The problem.** Apex is the expensive part of a feature: it needs deployment, permissions and tests, and it is where security mistakes happen.

**The approach.** Picklist values come from the Lightning Data Service `getPicklistValues` wire adapter. Record collections and custom items are normalized in the browser. Apex handles only the SOQL source and the editor's object and field search.

**What it buys you.** Three of four sources need no Apex permissions at runtime and respect Lightning Data Service rules automatically.

## Defensive, user-mode Apex for the query path

See [the security model](explanation-security-model.md). In short: validate names against describe, bind every value, parse WHERE text instead of passing it through, clamp the limit, run in `USER_MODE`.

**Why parse the WHERE text at all.** The editor stores the WHERE clause as readable text so admins can paste or tweak it, and so a clause the builder cannot rebuild still works as a manual textarea. The cost is a hand-written parser. The WHERE text is the only filter input; there is no second, structured filter API.

## Icons as local SVG

**The problem.** `lightning-icon` and the SLDS sprite pull icons from a fixed set, load from the network, and look different from the rest of a modern UI.

**The approach.** `newtonSelectorIcon` renders inline SVG from a generated Lucide catalog. Icon names are Lucide names; SLDS names such as `utility:user` are not translated and show the fallback icon. An audit script keeps `lightning-icon` out of the source.

**Trade-off.** The generated catalog is large (about 1,700 icons). It is generated, not hand-edited, so regenerate it with `npm run generate:lucide-icons` instead of changing it by hand.

## Appearance is tokens and classes, not inline styles

The repo requires SLDS 2 compliance (see `AGENTS.md`). Tiles express every visual option as a BEM modifier class on top of `--slds-g-*` styling hooks, with a custom-hex variable only for the one case SLDS has no token for. That keeps dark mode and theming working and lets the SLDS linter check the CSS.

## Changing layout keeps your styling

Each layout wants different geometry (a list wants full width and no aspect ratio; a grid wants a column width and a ratio), but styling (tones, pattern, corners, surface, elevation, icons, badges, selection indicator, spacing) means the same thing in every layout. So switching layout swaps only the geometry (`minWidth`, `size`, `aspectRatio`, `columns`, `gapH`, `gapV`) and keeps the styling. The editor remembers each layout's geometry in `layoutGeometry`, so switching back restores it. Comparing layouts is safe.

## Quality gates in the repo

Husky runs Prettier, ESLint and Jest on changed files at commit. `code-analyzer.yml` loads the PMD ruleset `pmd-apex-complexity.xml` (cyclomatic and cognitive complexity limits), run with `sf code-analyzer run --rule-selector pmd:ApexComplexity`. The coding rules the project holds itself to are in `AGENTS.md`.

## Related

- [Architecture](architecture.md)
- [Security model](explanation-security-model.md)
- [Configuration reference](reference-configuration.md)
