---
target: cpe
total_score: 18
max_score: 40
na_heuristics:
p0_count: 1
p1_count: 2
target_identity: "file:D:\\projectSalesforce\\newtonSelector\\force-app\\main\\default\\lwc\\newtonSelectorFlowCpe"
timestamp: 2026-10-04T18-51-27Z
slug: force-app-main-default-lwc-newtonselectorflowcpe
---

Method: dual-agent (A: design review sub-agent · B: detector + browser sub-agent)

## Design Health Score

| #         | Heuristic                       | Score     | Key Issue                                                                                                                                               |
| --------- | ------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Visibility of System Status     | 2         | Live preview is strong; validation issues show only at the top of the active chapter (not sticky, no aria-live); the tab status is a 7px color-only dot |
| 2         | Match System / Real World       | 2         | "SObject", "No none", "7.5 rem", celebrity sample data; picker glyphs that don't depict the option                                                      |
| 3         | User Control and Freedom        | 1         | Changing Layout style or pressing the reset icon replaces all appearance settings, with no confirm or undo; Cancel/Esc discard the session unprompted   |
| 4         | Consistency and Standards       | 2         | Toggle polarity flips (Visible/Hidden vs Hidden/Shown); summary vs studio names differ; "Medium · Default" while Small is the real default              |
| 5         | Error Prevention                | 1         | Destructive layout switch; three conflicting width dials (Tile size, Column count, Minimum column width)                                                |
| 6         | Recognition Rather Than Recall  | 3         | Labeled tiles and the "Grid · Single" head help; custom options titled "Option · 0", not by label                                                       |
| 7         | Flexibility and Efficiency      | 2         | Tabs help; no presets, no copy-from-another-selector, cards can't collapse, summary rows don't deep-link to a chapter                                   |
| 8         | Aesthetic and Minimalist Design | 1         | Appearance is ~20 equal-weight cards and ~230 visible choices; helptext repeats card subtitles                                                          |
| 9         | Error Recovery                  | 2         | Plain messages, but nothing inline at the field; error rows render as warnings (class mismatch)                                                         |
| 10        | Help and Documentation          | 2         | ~30 helptexts, mostly restating subtitles; a truncated placeholder                                                                                      |
| **Total** |                                 | **18/40** | **Poor**                                                                                                                                                |

## Design Specificity Verdict

LLM assessment: the skeleton is specific, the skin is generic. Pickers are built from the product's own choice tiles and the preview renders the real selector with forced Populated/Empty/Error states, so what the admin sees is what users get. On top sit ~30 identical grey-banded cards and generic Lucide glyphs that don't show the option (Pulse = message bubble, Raised = upload arrow, Dots = network), plus celebrity sample data. Only Tile size and Aspect ratio draw their outcome; every visual picker should.

Deterministic scan: 42 findings, nearly all false positives. 36 design-system-color (11 are bare-template rgb(0,0,0) text on .html with no CSS applied; 25 are hex fallbacks inside var(--slds-g-…, #hex), which DESIGN.md permits), 4 radius (also token fallbacks / calc), 2 side-tab warnings on .newton-studio**custom-row::before and .newton-studio**spec-sheet::before (UtilityConfigStyles.css:1227, :1408) that later blocks set to display:none. CLI exited 0 despite findings.

Visual overlays: the detector was injected into the live Flow Builder page (after disabling Chrome's local-network-access block), but it walks light DOM only and cannot see into the CPE's shadow roots; its 2 findings (bounce easing, padding transition) are on Salesforce's own Flow Builder chrome. Headless run; no human-visible overlay.

## Overall Impression

The live preview built from the real component is the best idea here and the peak of the experience. The studio around it is a long, flat wall of equally weighted controls with one silent data-loss trap and errors that hide at the moment of Save. Biggest opportunity: let the tiles depict the choices and rank the Appearance chapter (presets first, advanced behind disclosure).

## What's Working

1. Built from its own product: pickers are real ChoiceTiles with fieldset/legend semantics; the preview is the real DataSelector with forced Empty/Error states.
2. The inline Flow Builder summary is plain language and native ("Single select, required", "Custom items · 3 items"), wired to Flow's validate(), with brand blue only on the CTA and labels.
3. Data chapter keeps each source's settings when switching sources; conditional cards (Aspect ratio, custom error message) appear only when relevant.

## Priority Issues

[P0] Changing Layout style (or the unlabeled reset icon) silently erases all appearance work — handleLayoutTileChange replaces gridConfig with defaultGridConfig(layout) (newtonSelectorFlowCpeAppearanceConfig.js:423-437). Comparing layouts is the obvious first move and destroys up to ~40 settings; only escape is Cancel, which also loses Data/Content work. Fix: merge, keep tone/pattern/badge/icon/corner across layouts and re-apply only geometry; remember per-layout geometry; labeled "Reset appearance" with an Undo toast. Command: /impeccable harden

[P1] Errors are hard to find and the reason Save is disabled is hidden — issues list only for the active chapter at the top of the scroll, not sticky, no aria-live (ConfigModal.html:22-36); error rows styled as warnings (Validation.js:107 emits newton-studio\_\_issue_error, CSS targets li.error at UtilityConfigStyles.css:1021); tab status is a color-only dot; Save's reason lives in title on a disabled button. Fix: footer status beside Save ("2 errors · Data: Select a Salesforce object") with links that scroll and focus; inline slds-has-error at the field; sticky aria-live banner; fix the class names; add a count to the tab pip. Command: /impeccable clarify then /impeccable harden

[P1] Appearance is an unranked wall of ~230 choices with overlapping width controls — ~20 equal cards, 4×9 tone matrices for Surface and Pattern (still rendered when Pattern is None), 11-option spacing rows up to 44 per side, and three width dials that contradict the preview. Fix: lead with 3–4 named presets rendered as live mini-tiles; put surface/pattern/corner/icon treatment behind "Customize"; collapse per-state tones to "Selected tone" with "Advanced states"; merge width into one control; consider moving Layout style (an interaction model) to Behavior. Command: /impeccable distill then /impeccable layout

[P2] Keyboard and screen-reader semantics are broken — tab clicks don't move focus to the chapter; radiogroups wrap aria-pressed buttons; the segmented toggle uses role="radio" without arrow keys or roving tabindex; option row buttons say "Delete"/"Move up" without naming the option; ~150 tone-chip tab stops. Breaks AGENTS.md WCAG 2.1 AA. Fix: focus the chapter heading after a jump; true radio groups with roving tabindex; named button labels. Command: /impeccable audit then /impeccable harden

[P2] Pickers and preview don't depict what's being chosen — generic glyphs (some duplicated: Radio and Multi-select share list-checks); no Hover/Disabled preview state although four states are styled; celebrity sample data; the default "soft" icon style draws dashed boxes that read as missing images. Fix: render each Appearance option as a thumbnail tile carrying that modifier; add Rest/Hover/Selected/Disabled to the preview head; seed samples from picklist values or neutral Option A/B/C. Command: /impeccable bolder then /impeccable clarify

## Persona Red Flags

Alex (power user): trying another layout wipes styling; no presets or copy-from-selector; custom options are permanently expanded (7 fields each); summary rows don't open the modal at their chapter; ~20 Appearance cards to reach Padding; Esc discards without a prompt.

Sam (screen reader / keyboard): tab bar doesn't move focus; radiogroup/aria-pressed mismatch and toggles without arrow keys; Save's disabled reason only in title; issues not announced; unnamed Delete/Duplicate; ~150 chip tab stops; splitter can hide a whole pane via Home/End.

Jordan (first-time flow builder): "Picklist" is both a data source and a layout; jargon (SOQL, SObject, merge field); SOQL preview sits above the controls that build it; "Custom items setup" card only says "look below"; celebrity names in an Account selector preview; "Medium · Default" while Small is selected.

## Minor Observations

- Summary copy bug "Badge at below"; leaked enum fragments ("frame indicator", "top surface").
- Summary muted/mono lines are 10px (newtonSelectorFlowCpe.css:383).
- Two parallel hairlines under the modal header; Icon combobox is pill-shaped while other inputs are 4px; plain text fields carry a magnifier icon.
- ~30 brand-blue card glyphs spend the single accent on decoration.
- Off-state segmented toggles read as "nothing selected".
- validate() message asks the admin to "Reopen Configure and save again" to work around an internal glitch.
- DESIGN.md drift: says Checkmark/Medium are defaults (code: Frame/Small) and promises a 4-state preview switcher that doesn't exist.

## Questions to Consider

1. If the product is a visual tile, why is any Appearance option chosen from an icon instead of a live thumbnail of the tile?
2. Does a required single-select screen need per-state hover and disabled pattern tones, or are 72 chips serving 1% while 99% scroll past?
3. Is Layout style appearance at all, or the first decision in Behavior, gating which Appearance cards exist?
4. What if Save were never disabled, but saved with a clear list of blocking issues that the inline panel then surfaced in Flow Builder?
