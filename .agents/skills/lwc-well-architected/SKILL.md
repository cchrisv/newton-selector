---
name: lwc-well-architected
description: "Atomic design framework for scalable LWC development. Use when: creating new Lightning Web Components, refactoring existing LWC, reviewing LWC code, determining component level (atom/molecule/organism/template/page/utility/flow), enforcing unidirectional data flow, adding accessibility or SLDS compliance, migrating god components, or building Flow-reactive screen components."
argument-hint: "Component name or task, e.g. 'create atom for toggle switch' or 'review newtonSelectorDataSelector'"
---

# LWC Well-Architected Framework

Atomic design for scalable, maintainable Salesforce interfaces. Build **systems of reusable components**, not pages.

## When to Use

- Creating a new LWC component (determines level, naming, file structure)
- Refactoring an existing LWC (identifies anti-patterns, enforces level boundaries)
- Code-reviewing LWC pull requests (checklist-driven)
- Determining what level a component should be
- Building Flow CPE (Custom Property Editor) components
- Migrating legacy monolithic components to atomic design

## Procedure

### 1. Determine Component Level

Use this decision tree — evaluate top-to-bottom, first match wins:

1. **Cross-cutting technical concern?** (caching, formatting, validation) → **Utility**
2. **Fetches Salesforce data?** (wire, imperative Apex, LDS) →
   - Complete user journey with navigation? → **Page**
   - Domain-specific with business rules? → **Organism**
3. **Combines child components with logic?**
   - Business logic or data transformation? → **Organism**
   - Simple coordination of 2-5 children? → **Molecule**
4. **Pure presentational, no children?** → **Atom**
5. **Slot-based layout, no content/logic?** → **Template**
6. **Wraps organisms for Flow runtime?** → **Flow**

> Reference: [Level definitions with examples](./references/levels.md)

### 2. Name the Component

**Format:** `{appPrefix}{PascalName}`

For Newton Selector, component level is an architectural classification, not part
of the public LWC bundle name. Keep `Utility` only for technical modules where it
clarifies the purpose.

| Level    | Pattern              | Example                               |
|----------|----------------------|---------------------------------------|
| Atom     | `{app}{Name}`        | `newtonSelectorFlowCpeToggle`         |
| Molecule | `{app}{Name}`        | `newtonSelectorFlowCpeIconSelector`   |
| Organism | `{app}{Name}`        | `newtonSelectorDataSelector`          |
| Template | `{app}{Name}`        | `newtonSelectorFlowCpeStudio`         |
| Utility  | `{app}Utility{Name}` | `newtonSelectorFlowCpeUtilityHelpers` |
| Flow     | `{app}Flow{Name}`    | `newtonSelectorFlowScreen`            |

Newton Selector has no Page-level bundle; it runs inside Flow screens.

- `{app}` = project/team prefix (e.g., `newton`, `core`, `admissions`)
- Name describes **what** the component does, not **how**

### 3. Create the Component

Apply level-specific rules strictly:

**Atoms** — Zero data, zero state, zero dependencies.
- Only `@api` properties in, `CustomEvent` dispatch out
- No `@wire`, no Apex imports, no `@track` internal state
- JSDoc every `@api` property with `@type` and `@default`

**Molecules** — Coordinate 2-5 child atoms/molecules.
- Transform child events into meaningful parent events
- Local coordination state only (e.g., search term filtering)
- **Never** fetch data. Receive everything via `@api`

**Organisms** — Own a data domain and business rules.
- Centralize all data fetching (wire/Apex) at this level
- Handle **all** states: loading, error, empty, populated
- Enforce FLS/sharing at the Apex layer
- Support cross-context rendering (desktop, mobile, Experience Cloud)
- Use connected flag pattern for safe lifecycle:
  ```javascript
  connectedCallback() {
      this._connected = true;
      this.loadData();
  }
  disconnectedCallback() {
      this._connected = false;
      // Clear timers, cancel pending work
  }
  ```

**Templates** — Layout via `<slot>` only.
- Responsive (SLDS grid or CSS custom properties)
- No content, no logic, no data

**Pages** — Orchestrate organisms within a template.
- Own navigation (`NavigationMixin`)
- Coordinate data flow between organisms
- Complete user journey from entry to exit

**Utilities** — Pure JS modules (not LWC components).
- Stateless exports (or module-level caches with clear invalidation)
- Importable by any level: `import { normalizePicklist } from 'c/newtonSelectorUtilityDataSources'`
- Single technical concern per module

**Flow Components** — Thin wrappers around organisms.
- Delegate all logic to composed organisms
- Bridge Flow ↔ LWC with `FlowAttributeChangeEvent`:
  ```javascript
  this.dispatchEvent(new FlowAttributeChangeEvent('value', newVal));
  ```
- Implement `@api validate()` for Flow navigation gates

### 4. Enforce Core Principles

1. **Unidirectional Data** — `@api` down, events up. Never mutate parent data.
2. **Deep Components** — Encapsulate complete experiences behind simple interfaces. Avoid coordinating many shallow children.
3. **Rule of Three** — 1st use: inline → 2nd use: copy → 3rd use: extract component.
4. **Self-Documenting** — JSDoc all `@api` properties (`@type`, `@default`, `@fires`). Names tell stories.
5. **Performance-First**:
   - Centralize fetching in organisms (not atoms/molecules)
   - Use LDS caching, batch queries, pagination
   - No Apex in loops; debounce expensive operations
   - Deduplicate in-flight requests (Map-based pattern)
   - Always show loading states

### 5. Review with Checklist

> Full checklist: [Code review checklist](./references/review-checklist.md)

**Universal (all levels):**
- [ ] App prefix present in component name
- [ ] Single responsibility — does one thing well
- [ ] All `@api` properties have JSDoc
- [ ] All dispatched events documented (`@fires`)
- [ ] Error handling present and user-visible
- [ ] Accessibility: ARIA attributes, keyboard navigation, focus management
- [ ] SLDS design tokens and components used
- [ ] Private fields use `_` prefix convention

**Level-specific spot checks:**
- Atom dispatches events? ✓ No data fetching? ✓
- Molecule has 2-5 children? ✓ Transforms events? ✓
- Organism handles loading/error/empty? ✓ FLS/sharing? ✓
- Flow component uses `FlowAttributeChangeEvent`? ✓ Has `validate()`? ✓

### 6. Verify

Follow `AGENTS.md` ("Testing philosophy"): verify behavior end to end by
extending the E2E script that covers it (`scripts/e2e/`). Do not add a Jest
test per component. Add an isolated test only when AGENTS' justification steps
are met. Details: [Testing reference](./references/testing.md)

### 7. Detect Anti-Patterns

| Anti-Pattern              | Symptom                                      | Fix                                        |
|---------------------------|----------------------------------------------|--------------------------------------------|
| **God Component**         | 500+ lines, mixed data/UI/logic              | Split by level and domain                  |
| **Prop Drilling**         | Passing data through 3+ layers               | Organisms fetch; LMS for cross-hierarchy   |
| **Premature Abstraction** | Extracted component used only once            | Rule of Three — inline until 3rd use       |
| **Shallow Components**    | Parent coordinates many tiny children         | Deep components with simple interfaces     |
| **Mixed Levels**          | Atom fetches data, molecule has business logic| Strictly follow level responsibilities     |
| **Missing App Prefix**    | `customButton` instead of `newtonSelectorChoiceTile` | Always: `{app}{PurposeName}`               |
| **Bidirectional Data**    | Child mutates `@api` property directly        | Events up, props down — always             |

## Migration Procedure (Legacy → Atomic)

1. **Audit** — List all components, classify current level, identify violations
2. **Extract Atoms** — Repeated UI primitives become atoms
3. **Identify Molecules** — Groups of atoms that always appear together
4. **Refactor Organisms** — Centralize scattered data fetching and business logic
5. **Create Templates** — Extract common layouts into slot-based components
6. **Wire Pages** — Compose templates + organisms for complete journeys

## Related Standards

- Apex and LWC code standards: `AGENTS.md` ("Code standards")
