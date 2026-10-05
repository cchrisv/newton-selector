---
name: Newton Selector
description: A visual choice selector for Salesforce Flow Screens, built natively on SLDS 2 styling hooks.
colors:
  brand: "#0176d3"
  brand-strong: "#0b5cab"
  brand-deep: "#014486"
  brand-weak: "#eaf3ff"
  success: "#3baa6f"
  warning: "#b25900"
  error: "#ba0517"
  error-weak: "#fdeef0"
  violet: "#6d42c1"
  pink: "#c9257b"
  teal: "#0f7b82"
  ink: "#181818"
  ink-body: "#2e2e2e"
  ink-soft: "#444444"
  ink-weak: "#5c5c5c"
  ink-muted: "#747474"
  ink-disabled: "#9a9a9a"
  border: "#c9c9c9"
  hairline: "#e5e5e5"
  surface: "#ffffff"
  surface-soft: "#f9f9f9"
  canvas: "#f3f3f3"
  surface-sunk: "#ececec"
  on-accent: "#ffffff"
typography:
  tile-title:
    fontFamily: "inherit (SLDS Salesforce Sans stack)"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
  tile-subtitle:
    fontFamily: "inherit (SLDS Salesforce Sans stack)"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.25
  badge:
    fontFamily: "inherit (SLDS Salesforce Sans stack)"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.06em"
  chapter-title:
    fontFamily: "inherit (SLDS Salesforce Sans stack)"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0"
  card-title:
    fontFamily: "inherit (SLDS Salesforce Sans stack)"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0"
  control-label:
    fontFamily: "inherit (SLDS Salesforce Sans stack)"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.02em"
  section-label:
    fontFamily: "inherit (SLDS Salesforce Sans stack)"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0"
  api-string:
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.375
rounded:
  sm: "0.25rem"
  md: "0.5rem"
  lg: "0.75rem"
  pill: "999px"
  round: "50%"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.25rem"
  2xl: "1.5rem"
components:
  choice-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "1rem"
  choice-tile-hover:
    backgroundColor: "{colors.surface}"
  choice-tile-selected:
    backgroundColor: "{colors.brand-weak}"
  choice-tile-disabled:
    textColor: "{colors.ink-disabled}"
  tile-badge:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.badge}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.5rem"
  selection-check:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.round}"
    size: "1.5rem"
  search-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
  tone-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-body}"
    rounded: "{rounded.md}"
    padding: "0.1875rem 0.5rem"
  tone-chip-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-accent}"
  studio-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "0.75rem"
  segmented-option-on:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.lg}"
    height: "1.5rem"
---

# Design System: Newton Selector

## Overview

**Creative North Star: "The Native Upgrade"**

Newton Selector is what SLDS 2 choice controls would be if they had been designed as visual objects: a tile you can read at a glance, not a radio button with a label. It must disappear into whatever org theme it lands in. Every color, radius, space and size is an `--slds-g-*` styling hook with a literal fallback, so dark mode, branding themes and density settings reach it without a single override. The system takes no identity of its own. Its craft shows in the details: crisp hairlines, a decisive selected state, disciplined eases.

There are two surfaces and one voice. The **runtime selector** (a grid, list, ribbon, picklist, radio-card, column or transfer layout of `ChoiceTile`s) is the product. The **Custom Property Editor studio** (a live preview beside four chapters of controls) is the tool an admin uses to dial it in, and it is built from the same hooks and the same tiles, so what the admin sees is what the user gets. Both are quiet and flat at rest: white surface, neutral ink, one brand-blue accent. Color is a _setting the admin chooses_ (nine tones, four states), never decoration the system imposes.

The feel is crisp and confident. Borders are one pixel, corners are 8px on tiles and inputs and 12px on studio cards, transitions run 120-240ms on a single ease, and a selected tile announces itself unmistakably (brand border, brand-tinted surface, a check badge) without moving the layout.

**Key Characteristics:**

- SLDS 2 hooks end to end; hex values in this file are the fallbacks, the hooks are the truth.
- Flat at rest. Elevation is an admin option (six levels), not a default.
- One accent (brand blue) in the chrome. Nine tones are _content_, chosen per tile state.
- Selected state never changes tile dimensions.
- No inline styles: appearance is BEM modifier classes plus CSS variables.
- Honors `prefers-reduced-motion` everywhere motion exists.

### Editor voice and terms

Plain words an admin building a screen flow already uses. Messages say what needs attention and how to fix it ("Choose the object to query."), never internal names or values.

- **Option:** one choice a user can pick (an option can be hidden, overridden, required). Never "item" or "card" in editor copy.
- **Tile:** how an option looks in the tile layouts. Appearance settings talk about tiles.
- **Data source:** Picklist, Collection, SOQL query or Custom options. "Picklist" names only the data source; the compact layout is **Dropdown**, and the two-panel layout is **Dual listbox**.
- **Selection mode:** Single or Multi. "Multi-select" is not a layout name.
- Sentence case for every label and heading. Summary lines reuse the exact tile labels.

## Colors

A neutral SLDS ink-and-paper palette with a single brand blue; semantic and decorative tones exist as admin-selectable content colors.

### Primary

- **Brand Blue** (#0176d3, `--slds-g-color-brand-base-50`): The only accent in chrome. Selected tile border, selection check, focus outlines in the studio, active segmented option, active chapter tab, splitter hover, section labels in the Flow Builder sidebar. Always read from the hook so org branding re-colors it.
- **Brand Wash** (#eaf3ff, `brand-base-95`): The selected-tile surface and the quiet background behind brand glyphs and icon buttons.
- **Brand Strong** (#0b5cab, `brand-base-40`): The pressed and emphasis step. Sidebar button hover, the On toggle's edge ring and the toggle focus outline, the SOQL preview label and keyword tokens.
- **Brand Deep** (#014486, `brand-base-30`): Brand ink on light brand surfaces. Brand-toned tile badges, the selected icon-catalog cell, the SOQL filter builder's selected segment and count. Every file uses the same fallback for a given brand hook.

### Tertiary (admin-selectable content tones)

Each tone is a hue the admin can assign per tile state (normal, hover, selected, disabled) and to badges, icons, patterns and surfaces.

- **Success Green** (#3baa6f), **Warning Amber** (#b25900), **Error Red** (#ba0517): Semantic tones, from `success|warning|error-base-50`.
- **Violet** (#6d42c1), **Pink** (#c9257b), **Teal** (#0f7b82): Decorative tones from `palette-purple|pink|teal-50`.
- **Neutral** (#747474): The default tone. Quiet, never competes with content.
- **Custom**: Any hex, entered with a color picker. The only place a literal color enters the system; it does not follow dark mode.

### Neutral

- **Ink** (#181818): Tile titles, studio headings, the active tone chip.
- **Ink Body** (#2e2e2e): Sidebar summary lines, tone chip labels, the active Off option.
- **Ink Soft** (#444444, `neutral-base-30`): Neutral badge ink, inactive segmented options, icon catalog copy.
- **Ink Weak** (#5c5c5c): Tile subtitles, hints, secondary studio copy.
- **Ink Muted** (#747474) and **Ink Disabled** (#9a9a9a): Muted supporting lines in the sidebar summary, and the tone disabled tiles take (disabled tiles are also dimmed to 62% opacity).
- **Border** (#c9c9c9, `--slds-g-color-border-1`; #444 in dark mode): Tile and input borders, the segmented well, row edges on hover. **Hairline** (#e5e5e5, `neutral-base-90`; #181818 in dark mode): Dividers, card outlines, splitter.
- **Surface** (#ffffff), **Surface Soft** (#f9f9f9), **Canvas** (#f3f3f3), **Sunk** (#ececec): The studio's layered grounds; cards sit on canvas, card headers and wells use the soft surface.

### Named Rules

**The Hook-First Rule.** Never write a literal color where an `--slds-g-*` hook exists. A literal hex is permitted only for admin-chosen Custom tones and for hues SLDS has no hook for.
**The One Accent Rule.** In chrome, brand blue is the only accent. Hue variety belongs to the tile content an admin configures, not to the editor's own furniture.
**The One-Token-Source Rule.** Studio tokens (`--newton-studio-*`) are defined once, in the CSS-only module `newtonSelectorFlowCpeUtilityTokens`; every studio stylesheet `@import`s it. Change a token there, never redeclare it in a component.
**The Tint-Not-Fill Rule.** State surfaces are `color-mix(in oklab)` tints of the tone (3% rest, 6% hover, 12% selected) over the base surface. Full-strength fills are reserved for the Fill selection style and for check badges.

## Typography

**Display Font:** none. **Body Font:** inherited SLDS stack (Salesforce Sans), never declared. **Mono:** system monospace stack, only for machine values (`Lead.Rating`, `{!myVar}`, SOQL, hex codes, numeric setting readouts) so code reads as code.

**Character:** Utilitarian and compact. Hierarchy comes from weight (400/600/700) and a tight size scale, not from a second typeface. Sizes are SLDS font-scale hooks, which scale with the user's density setting.

### Hierarchy

- **Chapter Title** (700, 1rem, 1.25): The four studio chapter headings and the live preview title.
- **Card Title** (700, 0.875rem, 1.25): Studio section card titles and Appearance sub-chapter headings. The Flow Builder summary card title is one step smaller (0.8125rem).
- **Tile Title** (600, 0.875rem, 1.25): The option label. Wraps with `overflow-wrap: anywhere`; never truncates silently.
- **Control Label** (700, 0.8125rem, 1, +0.02em): Axis and field labels in the studio.
- **Tile Subtitle** (400, 0.75rem, 1.25, ink-weak; 0.6875rem on small tiles): Secondary line under a tile title.
- **Badge** (700, 0.6875rem, 1, +0.06em, uppercase; 0.625rem on small tiles): Corner and inline badges.
- **Section Label** (700, 0.75rem, 1.25, brand): The label column of the Flow Builder sidebar summary.
- **API String** (400, 0.75rem, 1.375, monospace): Field paths, merge fields, SOQL preview.

### Named Rules

**The Weight-Not-Size Rule.** Differentiate within a tile by weight and ink color before size. Title and subtitle differ by 2px and a weight step.
**The Mono-For-Machines Rule.** Monospace marks values a machine will read. It is never a decorative eyebrow or label voice.

## Layout

Runtime layouts are driven by CSS variables the editor writes (`--newton-group-gap-x|y`, `--newton-group-min-w`, `--newton-tile-pad-*`, margins per side). The Grid uses fixed-width columns (`repeat(auto-fill, minmax(min(100%, W), W))`), left-aligned: tiles keep their chosen size (Small 7.5rem, Medium 12rem, Large 16rem) and leftover space stays on the right rather than stretching tiles. `min(100%, W)` keeps very narrow containers from overflowing. Aspect ratios (1:1, 4:3, 16:9, 3:4) apply to Grid and Horizontal only; List is full-width rows with auto height. Gap inside a tile is half the top padding with a 0.25rem floor, so padding is the single dial.

Spacing follows SLDS tokens 1-9 (4px to 48px); the default tile gap is 0.5rem and default padding 1rem. The editor studio is a two-pane grid: live preview (45-50%) beside controls (50-55%), separated by a 0.375rem draggable splitter, 78vh tall with a 34rem floor. Controls scroll in a single column and query their own width (`container-type: inline-size`). Every choice-tile picker in the studio (data source, layout, sizes, patterns, gaps, padding...) uses one tile box, 7.5rem by 6.5rem, in left-aligned 7.5rem columns with a 0.5rem gap; inside, the visual sits in a fixed 2.5rem row and the title and up to two lines of description sit below it. Every picker draws its visual in the same framed cell, neutral at rest and brand when selected, with the same surface, padding and selection state; only the Icon style and Icon shading pickers show the icon treatment itself in that cell, because the treatment is the option. Below 56rem the studio stacks, preview over controls, and the splitter disappears. The runtime Group collapses its multi-panel layouts at 48rem.

### Named Rules

**The Padding-Is-The-Dial Rule.** Internal tile rhythm derives from one padding value. Do not add per-layout hardcoded gaps.
**The Fixed-Column Rule.** Grid tiles never grow to fill the row. Predictable size beats full-bleed fill.
**The One-Tile-Family Rule.** Studio pickers never size tiles per group. A picker that needs a different shape changes the glyph or shape drawn inside the framed cell, never the tile's size, surface, padding or selection style.

## Elevation & Depth

Flat by default, with a hybrid for options. At rest the tile is a white surface with a 1px border; depth is an admin choice among six elevation styles. Studio chrome is flat at rest: cards, override rows and wells carry a hairline and no resting shadow. The hook shadow (`--slds-g-shadow-1`, fallback `0 1px 2px` ink at 6%) marks only the preview head, an expanded override row, the active column chip and the sidebar button on hover; the preview frame sits one step up on `--slds-g-shadow-2` (fallback `0 2px 8px` ink at 12%).

### Shadow Vocabulary

- **Plain**: No border, no shadow; surface only.
- **Subtle**: Base tinted to neutral-95 with an 18% neutral hairline.
- **Outlined**: Border only; on hover `0 2px 12px` ink at 8% and a 1px lift.
- **Raised**: Rest `0 2px 12px` ink at 10%; hover `0 8px 20px` at 13%; 1px lift.
- **Floating**: Rest `0 12px 24px` ink at 14%; hover `0 16px 40px` at 16%; 2px lift.
- **Inset**: Rest 1px inset ring at 18%; hover 2px at 22%; no lift.
- **Selection indicator shadow** (layered above elevation): Frame is a 2px inset ring at 74% plus a 4px inset halo at 10%.

### Named Rules

**The State-Driven Lift Rule.** Tiles move at most 1-2px, and only on hover, and only for Outlined, Raised and Floating. Selection never translates or resizes a tile.
**The Ink-Shadow Rule.** Shadows are `color-mix` of neutral ink with transparent, never pure black or brand-colored. The check badge follows it too.

## Shapes

Rectilinear with small, consistent radii. Tiles, inputs, square badges and the studio's small controls (glyph chips, tone chips, tone rows, icon buttons) use 8px (`radius-border-2`); studio cards, override rows, spec sheets, the query preview, the preview head and frame, the runtime empty and error panels, and the segmented control use 12px (`radius-border-3`); 4px (`radius-border-1`) is kept for small inner marks such as a tile's geometric shape outline, the SOQL code block and the filter builder. Pill badges use the pill hook; the selection check is a circle. Borders are 1px (hairline) and thicken to 2px for focus, hover on Inset, and the frame selection style. The only decorative geometry lives in admin-optional layers: corner flourishes (trim, brackets, dots), the ribbon's folded triangular corner (`clip-path`), and eight tile patterns (dots, lines, diagonal, grid, glow, noise, paper, waves). A 3px brand rule on the leading edge marks the bulk-edit card in the studio.

## Components

### Choice Tile

Character: a flat card you tap, not a control you aim at.

- **Shape:** 8px radius, 1px border (#c9c9c9), 1rem padding, center-aligned stack of icon, title, subtitle.
- **Hover:** border to ink-muted, tone tint to 6%, elevation shadow shifts to its hover value (160-200ms, `cubic-bezier(.2,.8,.2,1)`).
- **Selected:** border to brand, surface tinted 12% toward the selected tone, and the chosen indicator: Checkmark (default, 1.5rem circle, top-right, scales in), Fill, Bar (4px leading edge), Frame (inset ring), Ribbon (folded corner, 1.5-2.5rem), or Pulse (1.8s breathing halo, off under reduced motion).
- **Direction:** in right-to-left languages the layout mirrors: the Ribbon indicator's folded corner, the Dropdown layout's inset selection shadow and directional gradient surfaces flip to the other side with the text.
- **Focus:** the native radio/checkbox is visually hidden; `:focus-visible` draws a 2px outline at 2px offset on the tile surface.
- **Disabled:** 62% opacity, ink-disabled, no pointer events.
- **Parts:** optional icon in four decorations (ring, halo, medal, square) and four styles (filled, outlined, soft, glow), drawn in a 2.5rem decoration (3rem for halo and soft, 3.5rem for glow); badge in corner or inline, pill or square; optional geometric shape in place of an icon, in a 2.5rem cell (3rem on large tiles).
- **Framed visual** (`framed-visual`): draws the icon in the plain shape cell instead of an icon decoration, so icon and shape tiles match.
- **Host hooks:** `--newton-tile-block-size` fixes the tile height over its aspect ratio; `--newton-tile-figure-display: grid` with `--newton-tile-figure-rows` puts the visual in a fixed row and the text below it. `--newton-tile-visual-size` pins the shape cell. Unset, the tile is the runtime's centered stack.

### Search Bar and Inputs

- **Style:** every text field, picker trigger and search box in the editor is the SLDS 2 standard input: white fill, 1px neutral border, 8px radius, 2rem tall, 0.8125rem text. Components never restyle a field's edge, fill or height, so a dropdown trigger, a resource picker, the option icon picker and a plain input look identical. Fields placed side by side share a top edge. The runtime search bar above a tile group matches: 8px radius, 1px border, 0.5rem by 0.75rem padding.
- **Search icon:** only a box that searches a list (object search, field search, the overrides filter, the icon catalog filter) leads with a magnifier. A resource picker holds a value or a Flow resource, so it is a plain text input with none; once a resource is chosen it shows that resource's icon in a small brand cell with a trailing chevron. The icon picker trigger shows the chosen icon in a brand-outlined cell.
- **Focus / Error:** inherits SLDS focus behavior; errors use the error hook pair (50 border, 95 wash, 30 ink).

### Segmented Toggle (On/Off)

A 2-option control in a neutral-95 well with a 1px border, 12px radius and an inset hairline shadow. Off-active is a raised white pill; On-active fills brand with white ink and a brand-strong edge. 1.5rem tall, 0.75rem bold labels.

### Tone Chip

An 8px-radius chip (0.6875rem, 600) with a leading color dot, white surface and hairline border. Active inverts to an ink fill with white text and a 2px brand ring. Disabled chips stay legible but unclickable. The Custom chip's dot is a conic rainbow so it reads as "any color".

### Studio Card and Chapter Header

Cards sit on the canvas flat at rest: white, hairline, 12px radius, no resting shadow and no entrance animation; hover and focus leave the edge unchanged. The header is a soft-surface band with a 1.5rem glyph chip, the title and description sharing a line when they fit, and a hairline divider; the body pads 0.75rem. A chapter opens with a plain heading: a 1rem bold title over a hairline, with the chapter name kept for screen readers only. Appearance sub-chapters are a 0.875rem bold title over a hairline, with an optional Show icons or Show badges toggle at the end.

### Override Rows and Bulk Edit

- **Override row:** one per picklist or SOQL value, a 12px-radius hairline row with a soft-surface head. Hover strengthens the edge to the border color.
- **Expanded:** lifts on the hook shadow with the stronger border; the chevron turns 180° to brand and the body reveals in 240ms (off under reduced motion).
- **Selected for bulk edit:** brand border, head tinted 12% brand, body 3%, held on hover, like a selected tile.
- **Bulk-edit card:** an action panel shown only while options are selected: border mixed 35% toward brand, body tinted 3%, header 8%, and a 3px brand rule on the leading edge, all kept on hover and focus.

### SOQL Query Preview

A 12px-radius hairline panel holding the generated query in a 4px-radius monospace block on the soft surface, with brand-strong keywords. The validation status below carries a 1px leading rule: the success border hook with success ink when the query validates, the error border hook with error ink when it does not.

### Live Preview Panel

Not a mockup: it renders the real `DataSelector` with neutral sample options (or the admin's own Custom options). A head card holds the title and a Populated/Empty/Error state switcher; the frame below shows the selector in that state.

### Flow Builder Sidebar Summary

A single white card (hairline, 8px radius) in a 0.5rem-padded stack on the canvas: a title, then sections of plain-language lines divided by hairlines, each with a brand section label in a narrow leading column. The component name is kept for screen readers only. No numerals, no chapter colors. Brand blue is the only accent.

## Do's and Don'ts

### Do:

- **Do** read every color, radius, space and size from an `--slds-g-*` hook with a literal fallback; keep literals only for admin-chosen Custom tones.
- **Do** express appearance as BEM modifier classes plus CSS variables; keep new options on the same state model (normal, hover, selected, disabled).
- **Do** keep selected state dimension-stable and visible without color alone (a check, bar, frame, ribbon or fill shape accompanies the tint).
- **Do** use 1px hairlines, 8px tile and input radius and 12px card radius, and the single ease `cubic-bezier(0.2, 0.8, 0.2, 1)` at 120-240ms.
- **Do** wrap every animation in `prefers-reduced-motion` and give interactive tiles a `:focus-visible` outline.
- **Do** use monospace only for machine values: API names, merge fields, SOQL, hex codes and numeric readouts.

### Don't:

- **Don't** introduce a new accent in chrome. One brand blue; hue variety belongs to admin-selected tile tones.
- **Don't** use per-chapter or per-section colors; chapters and section cards use brand blue only.
- **Don't** hardcode hex or `rgba()` in component CSS where a hook or `color-mix` of one exists.
- **Don't** use `lightning-icon` or the SLDS sprite; icons are local Lucide SVG via `newtonSelectorIcon`.
- **Don't** let hover or selection translate more than 2px or change tile size.
- **Don't** stack heavy combinations (pattern plus gradient plus corner flourish) as defaults; flourishes stay opt-in.

## Known Drift

None open. When a scan finds drift from this document, record it here so future work resolves it rather than copying it.
