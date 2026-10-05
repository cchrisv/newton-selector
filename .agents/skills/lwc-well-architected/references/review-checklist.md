# Code Review Checklist

## Universal Checks (All Levels)

### Naming & Structure
- [ ] Component name follows `{app}{PascalName}` (`{app}Utility{Name}` for utilities, `{app}Flow{Name}` for Flow components)
- [ ] App prefix is consistent across the project
- [ ] Component responsibilities match its level
- [ ] File structure: `.js`, `.html`, `.css` (if needed), `.js-meta.xml`

### Public API
- [ ] All `@api` properties have JSDoc with `@type` and `@default`
- [ ] All dispatched events documented with `@fires` in class JSDoc
- [ ] `@api` property names are semantic (describe what, not how)
- [ ] No `@api` property is mutated internally (use private `_field` + getter/setter)

### Data Flow
- [ ] Data flows down via `@api` properties
- [ ] Changes communicated up via `CustomEvent`
- [ ] No direct parent reference or `this.template.querySelector` for parent access
- [ ] Event `detail` contains minimal, necessary data

### Error Handling
- [ ] Apex calls have try/catch with user-visible error messages
- [ ] Wire handlers check both `data` and `error`
- [ ] Error messages are actionable, not technical stack traces
- [ ] Connected flag guards async callbacks after unmount

### Accessibility
- [ ] ARIA attributes on interactive elements (`aria-label`, `aria-describedby`)
- [ ] Keyboard navigation supported (Tab, Enter, Escape, Arrow keys as appropriate)
- [ ] Focus management on dynamic content changes
- [ ] Color is not the sole indicator of state
- [ ] Screen reader text for icon-only buttons

### Performance
- [ ] No Apex calls in loops or repeated renders
- [ ] Debounce on search/filter inputs (300ms typical)
- [ ] In-flight request deduplication where applicable
- [ ] Large lists paginated or virtualized
- [ ] Loading states shown during async operations

### Style
- [ ] SLDS design tokens used (no hardcoded colors/spacing)
- [ ] CSS custom properties for configurable styling
- [ ] Private fields use `_` prefix convention
- [ ] Constants in UPPER_SNAKE_CASE

---

## Atom Checklist

- [ ] **No data fetching** — zero `@wire`, zero Apex imports
- [ ] **No internal state** — no `@track` (derive from `@api`)
- [ ] **No child component imports** (Lightning base components OK)
- [ ] **Events emitted** for every user interaction
- [ ] **Event detail** is value-based, not implementation-specific
- [ ] Renders correctly with default/empty `@api` values
- [ ] Purely presentational — no business logic

---

## Molecule Checklist

- [ ] **2-5 direct child components** (atoms or other molecules)
- [ ] **No data fetching** — zero `@wire`, zero Apex imports
- [ ] **Transforms child events** into higher-level semantic events
- [ ] Local coordination state is UI-only (search term, selection, expand/collapse)
- [ ] Receives all data via `@api`
- [ ] Does not duplicate atom responsibilities

---

## Organism Checklist

- [ ] **Data domain ownership** — clear single domain (accounts, contacts, etc.)
- [ ] **All states handled** — loading, error, empty, populated
- [ ] **Connected flag pattern** for safe async lifecycle
- [ ] **Cleanup in disconnectedCallback** — timers, listeners, subscriptions
- [ ] **FLS/sharing enforced** at Apex layer (`with sharing`, queries in `AccessLevel.USER_MODE`)
- [ ] Cross-context tested (desktop, mobile, Experience Cloud if applicable)
- [ ] Normalize data into unified item shape for children
- [ ] Business validation logic present, with its behavior covered by the E2E script

---

## Template Checklist

- [ ] **Slot-based only** — uses `<slot>` and named slots
- [ ] **No content** — zero hardcoded text, labels, or data
- [ ] **No logic** — zero JS methods, zero computed properties beyond layout
- [ ] **Responsive** — SLDS grid or CSS custom properties for breakpoints
- [ ] Works with any content placed in slots

---

## Page Checklist

- [ ] **Uses a template component** for layout
- [ ] **Composes organisms** — does not duplicate organism logic
- [ ] **Owns navigation** — `NavigationMixin` for page transitions
- [ ] **Complete user journey** — handles the full task from start to finish
- [ ] **Cross-organism coordination** — events or shared state between organisms
- [ ] URL parameters handled for deep linking

---

## Utility Checklist

- [ ] **Not an LWC component** — pure JS module with exports
- [ ] **Single technical concern** — formatting OR caching OR validation, not all
- [ ] **Stateless exports** (or cache with clear invalidation API)
- [ ] **Documented exports** — JSDoc on every public function
- [ ] **No side effects** on import — module initializes lazily

---

## Flow Component Checklist

- [ ] **FlowAttributeChangeEvent** dispatched for every `@api` property change
- [ ] **`@api validate()`** implemented with `{ isValid, errorMessage }` return
- [ ] **Delegates to organisms** — minimal logic in the Flow wrapper
- [ ] **`availableActions`** checked before dispatching navigation events
- [ ] **js-meta.xml** has correct `lightning__FlowScreen` target
- [ ] Works in both Screen Flow and Autolaunched Flow contexts
