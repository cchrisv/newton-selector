---
name: Newton Selector
description: A visual choice selector for Salesforce Flow Screens, built natively on SLDS 2 styling hooks.
colors:
  brand: "#0176d3"
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
    lineHeight: 1.25
    letterSpacing: "0.06em"
  chapter-title:
    fontFamily: "inherit (SLDS Salesforce Sans stack)"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  card-title:
    fontFamily: "inherit (SLDS Salesforce Sans stack)"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  control-label:
    fontFamily: "inherit (SLDS Salesforce Sans stack)"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.02em"
  eyebrow:
    fontFamily: "inherit (SLDS Salesforce Sans stack)"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.1em"
  api-string:
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  sm: "0.25rem"
  md: "0.5rem"
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
    rounded: "{rounded.sm}"
    padding: "1rem"
  choice-tile-hover:
    backgroundColor: "{colors.surface}"
  choice-tile-selected:
    backgroundColor: "{colors.brand-weak}"
  choice-tile-disabled:
    textColor: "{colors.ink-disabled}"
  tile-badge:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-body}"
    typography: "{typography.badge}"
    rounded: "{rounded.pill}"
    padding: "0.1875rem 0.5rem"
  selection-check:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.round}"
    size: "1.5rem"
  search-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 0.75rem"
  tone-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-body}"
    rounded: "{rounded.pill}"
    padding: "0.1875rem 0.5rem"
  tone-chip-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-accent}"
  studio-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "1rem"
  segmented-option-on:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.sm}"
    height: "1.5rem"
---

# Design System: Newton Selector

## Overview

**Creative North Star: "The Native Upgrade"**

Newton Selector is what SLDS 2 choice controls would be if they had been designed as visual objects: a tile you can read at a glance, not a radio button with a label. It must disappear into whatever org theme it lands in. Every color, radius, space and size is an `--slds-g-*` styling hook with a literal fallback, so dark mode, branding themes and density settings reach it without a single override. The system takes no identity of its own. Its craft shows in the details: crisp hairlines, a decisive selected state, disciplined eases.

There are two surfaces and one voice. The **runtime selector** (a grid, list, ribbon, picklist, radio-card, column or transfer layout of `ChoiceTile`s) is the product. The **Custom Property Editor studio** (a live preview beside four chapters of controls) is the tool an admin uses to dial it in, and it is built from the same hooks and the same tiles, so what the admin sees is what the user gets. Both are quiet and flat at rest: white surface, neutral ink, one brand-blue accent. Color is a _setting the admin chooses_ (nine tones, four states), never decoration the system imposes.

The feel is crisp and confident. Borders are one pixel, corners are 4px on tiles and 8px on cards, transitions run 120-200ms on a single ease, and a selected tile announces itself unmistakably (brand border, brand-tinted surface, a check badge) without moving the layout.

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

- **Brand Blue** (#0176d3, `--slds-g-color-brand-base-50`): The only accent in chrome. Selected tile border, selection check, focus-adjacent affordances, active segmented option, splitter hover, eyebrow text in the Flow Builder sidebar. Always read from the hook so org branding re-colors it.
- **Brand Wash** (#eaf3ff, `brand-base-95`): The selected-tile surface and the quiet background behind brand glyphs and focus rings.
- **Brand Deep** (#014486, `brand-base-30/40`): Badge ink on brand-toned badges and pressed states. See drift note below on its fallback value.

### Tertiary (admin-selectable content tones)

Each tone is a hue the admin can assign per tile state (normal, hover, selected, disabled) and to badges, icons, patterns and surfaces.

- **Success Green** (#3baa6f), **Warning Amber** (#b25900), **Error Red** (#ba0517): Semantic tones, from `success|warning|error-base-50`.
- **Violet** (#6d42c1), **Pink** (#c9257b), **Teal** (#0f7b82): Decorative tones from `palette-purple|pink|teal-50`.
- **Neutral** (#747474): The default tone. Quiet, never competes with content.
- **Custom**: Any hex, entered with a color picker. The only place a literal color enters the system; it does not follow dark mode.

### Neutral

- **Ink** (#181818): Tile titles, studio headings, the active tone chip.
- **Ink Body** (#2e2e2e): Running text in the editor and toggle labels.
- **Ink Weak** (#5c5c5c): Tile subtitles, hints, secondary studio copy.
- **Ink Muted** (#747474) and **Ink Disabled** (#9a9a9a): Eyebrows and disabled tiles (also dimmed to 62% opacity).
- **Border** (#c9c9c9): Tile and input borders. **Hairline** (#e5e5e5): Dividers, card outlines, splitter.
- **Surface** (#ffffff), **Surface Soft** (#f9f9f9), **Canvas** (#f3f3f3), **Sunk** (#ececec): The studio's layered grounds; cards sit on canvas, wells sink below it.

### Named Rules

**The Hook-First Rule.** Never write a literal color where an `--slds-g-*` hook exists. A literal hex is permitted only for admin-chosen Custom tones and for hues SLDS has no hook for.
**The One Accent Rule.** In chrome, brand blue is the only accent. Hue variety belongs to the tile content an admin configures, not to the editor's own furniture.
**The Tint-Not-Fill Rule.** State surfaces are `color-mix(in oklab)` tints of the tone (3% rest, 6% hover, 12% selected) over the base surface. Full-strength fills are reserved for the Fill selection style and for check badges.

## Typography

**Display Font:** none. **Body Font:** inherited SLDS stack (Salesforce Sans), never declared. **Mono:** system monospace stack, only for API-style strings (`Lead.Rating`, `{!myVar}`) so code reads as code.

**Character:** Utilitarian and compact. Hierarchy comes from weight (400/600/700) and a tight size scale, not from a second typeface. Sizes are SLDS font-scale hooks, which scale with the user's density setting.

### Hierarchy

- **Chapter Title** (700, 1.375rem, 1.2, -0.015em): The four studio chapter headings.
- **Card Title** (700, 0.9375rem, 1.3, -0.005em): Flow Builder summary card and studio section cards.
- **Tile Title** (600, 0.875rem, 1.25): The option label. Wraps with `overflow-wrap: anywhere`; never truncates silently.
- **Control Label** (700, 0.8125rem, 1, +0.02em): Axis and field labels in the studio.
- **Tile Subtitle** (400, 0.75rem, 1.25, ink-weak): Secondary line under a tile title.
- **Badge** (700, 0.6875rem, +0.06em, uppercase; 0.625rem on small tiles): Corner and inline badges.
- **Eyebrow** (600, 0.6875rem, +0.1em, uppercase): Section labels in the Flow Builder sidebar.
- **API String** (400, 0.75rem, 1.45, monospace): Field paths, merge fields, SOQL preview.

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

Flat by default, with a hybrid for options. At rest the tile is a white surface with a 1px border; depth is an admin choice among six elevation styles. Studio chrome uses a single hairline plus the hook shadow (`--slds-g-shadow-1`, `0 1px 2px rgba(0,0,0,.06)`) on cards and the preview head, and lifts to `0 4px 12px rgba(0,0,0,.08)` only on interactive emphasis.

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
**The Ink-Shadow Rule.** Shadows are `color-mix` of neutral ink with transparent, never pure black or brand-colored. The single exception today is the check badge (see drift).

## Shapes

Rectilinear with small, consistent radii. Tiles and inputs use 4px (`radius-border-2`); studio cards, the preview head, and the segmented control use 8px (`radius-border-3`); tone chips and pill badges use full 999px; the selection check is a circle. Borders are 1px (hairline) and thicken to 2px for focus, hover on Inset, and the frame selection style. The only decorative geometry lives in admin-optional layers: corner flourishes (trim, brackets, dots), the ribbon's folded triangular corner (`clip-path`), and eight tile patterns (dots, lines, diagonal, grid, glow, noise, paper, waves). A 3px colored left rule marks section cards in the studio.

## Components

### Choice Tile

Character: a flat card you tap, not a control you aim at.

- **Shape:** 4px radius, 1px border (#c9c9c9), 1rem padding, center-aligned stack of icon, title, subtitle.
- **Hover:** border to ink-muted, tone tint to 6%, elevation shadow shifts to its hover value (140-200ms, `cubic-bezier(.2,.8,.2,1)`).
- **Selected:** border to brand, surface tinted 12% toward the selected tone, and the chosen indicator: Checkmark (default, 1.5rem circle, top-right, scales in), Fill, Bar (4px leading edge), Frame (inset ring), Ribbon (folded corner), or Pulse (1.8s breathing halo, off under reduced motion).
- **Focus:** the native radio/checkbox is visually hidden; `:focus-visible` draws a 2px outline at 2px offset on the tile surface.
- **Disabled:** 62% opacity, ink-disabled, no pointer events.
- **Parts:** optional icon in four decorations (ring, halo, medal, square) and four styles (filled, outlined, soft, glow); badge in corner or inline, pill or square; optional geometric shape in place of an icon.
- **Framed visual** (`framed-visual`): draws the icon in the plain shape cell instead of an icon decoration, so icon and shape tiles match.
- **Host hooks:** `--newton-tile-block-size` fixes the tile height over its aspect ratio; `--newton-tile-figure-display: grid` with `--newton-tile-figure-rows` puts the visual in a fixed row and the text below it. `--newton-tile-visual-size` pins the shape cell. Unset, the tile is the runtime's centered stack.

### Search Bar and Inputs

- **Style:** every text field, picker trigger and search box in the editor is the SLDS 2 standard input: white fill, 1px neutral border, 8px radius, 2rem tall, 0.8125rem text. Components never restyle a field's edge, fill or height, so a dropdown trigger, a resource picker and a plain input look identical. Fields placed side by side share a top edge.
- **Focus / Error:** inherits SLDS focus behavior; errors use the error hook pair (50 border, 95 wash, 30 ink).

### Segmented Toggle (On/Off)

A 2-option control in a neutral-95 well with a 1px border, 8px radius and an inset hairline shadow. Off-active is a raised white pill; On-active fills brand with white ink. 1.5rem tall, 0.75rem bold labels.

### Tone Chip

A pill (0.6875rem, 600) with a leading color dot, white surface and hairline border. Active inverts to an ink fill with white text. Disabled chips stay legible but unclickable. The Custom chip's dot is a conic rainbow so it reads as "any color".

### Studio Card and Chapter Header

Cards sit on the canvas: white, hairline, 8px radius, hook shadow, entering with a 280ms rise. Chapters open with a large tabular numeral, a monospace eyebrow, and a 1.375rem title. Section cards may carry a 3px left rule.

### Live Preview Panel

Not a mockup: it renders the real `DataSelector` with neutral sample options (or the admin's own Custom options). A head card holds the title and a Populated/Empty/Error state switcher; the frame below shows the selector in that state.

### Flow Builder Sidebar Summary

A single white card in a 0.75rem-padded stack: eyebrow, title, then sections of plain-language lines divided by hairlines. No numerals, no chapter colors. Brand blue is the only accent.

## Do's and Don'ts

### Do:

- **Do** read every color, radius, space and size from an `--slds-g-*` hook with a literal fallback; keep literals only for admin-chosen Custom tones.
- **Do** express appearance as BEM modifier classes plus CSS variables; keep new options on the same state model (normal, hover, selected, disabled).
- **Do** keep selected state dimension-stable and visible without color alone (a check, bar, frame, ribbon or fill shape accompanies the tint).
- **Do** use 1px hairlines, 4px tile radius and 8px card radius, and the single ease `cubic-bezier(0.2, 0.8, 0.2, 1)` at 120-200ms.
- **Do** wrap every animation in `prefers-reduced-motion` and give interactive tiles a `:focus-visible` outline.
- **Do** use monospace only for API and merge-field strings.

### Don't:

- **Don't** introduce a new accent in chrome. One brand blue; hue variety belongs to admin-selected tile tones.
- **Don't** use per-chapter or per-section colors in new work; chapters use brand blue only, and the last section hues are being retired (see drift).
- **Don't** hardcode hex or `rgba()` in component CSS where a hook or `color-mix` of one exists.
- **Don't** use `lightning-icon` or the SLDS sprite; icons are local Lucide SVG via `newtonSelectorIcon`.
- **Don't** let hover or selection translate more than 2px or change tile size.
- **Don't** stack heavy combinations (pattern plus gradient plus corner flourish) as defaults; flourishes stay opt-in.

## Known Drift

Captured during the scan so future work can resolve rather than copy it:

- **Section hues:** Chapters already use brand blue only, but two Appearance section cards still carry their own accent: Badge (success green) and Spacing (warning amber), in `newtonSelectorFlowCpeUtilityConfigStyles.css`. Direction: brand blue only.
- **Brand Deep fallback:** `brand-base-40` falls back to `#014486` in most files but `#0b5cab` in the Toggle; `brand-base-60` falls back to `#0b5cab`, except `#1b96ff` in the WHERE builder.
- **Check badge shadow:** `0 2px 8px rgba(1, 94, 170, 0.3)` is a literal brand-tinted shadow, breaking the Ink-Shadow Rule.
- **Studio token duplication:** `--newton-studio-*` variables are redeclared in three host blocks (`Studio`, `ConfigPreview`, `UtilityConfigStyles`) with slightly different sets.
