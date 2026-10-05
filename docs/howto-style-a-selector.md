# How to style a selector

Change the layout, tile size, icons, badges, colors, selection style and spacing of a Newton Selector. Everything is in the **04 Appearance** chapter of the editor, and the preview updates live.

## Prerequisites

- A Newton Selector with a data source picked. The preview shows sample data until you save.

## Steps

1. **Pick a layout.** Switching layouts keeps your styling; each layout remembers its own tile size and spacing, so you can compare layouts freely. **Reset appearance** returns every appearance setting to its default, and offers **Undo**.

   | Layout       | Choose it for                          |
   | ------------ | -------------------------------------- |
   | Grid         | Icon-forward tiles                     |
   | List         | Long lists, dense rows                 |
   | Horizontal   | Steps or statuses in one scrolling row |
   | Dropdown     | Tight spaces                           |
   | Radio        | Accessibility-first card radios        |
   | Columns      | Moving cards between two panels        |
   | Dual listbox | Two panels with Add and Remove buttons |

2. **Size and shape.** Choose **Tile size** (Small 7.5 rem, Medium 12 rem, Large 16 rem). For Grid and Horizontal, choose an **Aspect ratio** (Square, Landscape, Wide, Portrait). For Grid, optionally fix the **Column count** (1 to 6) instead of Auto.

3. **Tile surface.** Choose an **Elevation** (Plain, Subtle, Outlined, Raised, Floating, Inset) and a **Surface style** (Solid, Top fade, Spotlight, Diagonal, Tint). Set colors per state (Normal, Hover, Selected, Disabled) with the tone chips: Neutral, Brand, Success, Warning, Error, Violet, Pink, Teal, or **Custom** for a color picker and hex box.

4. **Selection indicator.** Choose how a selected tile looks: Checkmark, Fill, Bar, Frame, Ribbon or Pulse.

5. **Decoration.** Add a **Pattern overlay** (Dots, Lines, Diagonal, Grid, Glow, Noise, Paper, Waves) with its own four state colors, and a **Corner flourish** (Trim, Brackets, Dots).

6. **Icons.** Turn **Show icons** on or off. Choose **Icon size** (Auto scales the icon with the tile size; XX-small to Large fix it), **Icon decoration** (None, Ring, Halo, Medal, Square), and, when a decoration is set, the **Icon style** (Filled, Outlined, Soft, Glow), **Icon shading** (only for Filled), **Decoration color** and **Glyph color**.

   Icon names come from your data: a field mapping, a custom option, or an option override. Names are Lucide icon names (for example `user`, `list-checks`); SLDS names such as `utility:user` aren't recognized, and unknown names show a question-mark icon.

7. **Badges.** Turn **Show badges** on or off. Set **Position** (corners or inline), **Color** and **Shape** (Pill or Square). The badge text comes from your data.

8. **Spacing.** Set **Horizontal gap** and **Vertical gap**, **Outer margin** and **Inner tile padding** using Auto, None or tokens 1 to 9 (4 px to 48 px). Use **Link all sides** to keep margin or padding equal on every side. For Grid and Horizontal, **Minimum column width** sets how narrow tiles may get.

9. Click **Save**.

## Verification

Debug the Flow at a normal width and at a narrow one (a phone-sized window). Tiles should wrap or stack, the selected state should be obvious, and text should stay readable on every surface color.

## Tips

- **Start from a layout default** and change a few things. Heavy combinations (pattern plus gradient plus corner flourish) get busy fast.
- **Check contrast.** Custom tones are your responsibility. Choose Glyph color **Contrast** when an icon sits on a strong color.
- **Dark mode.** Neutral, brand and the semantic tones are SLDS tokens and follow the org theme. Custom hex colors do not.
- **Leave gaps on Auto** unless you need a specific look. Each layout has its own tuned preset.
- **One look for every tile.** Appearance settings apply to all tiles. Custom options have no per-option style keys; change an option's icon, badge or text instead.

## Troubleshooting

| Symptom                             | Fix                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| My appearance settings vanished     | You clicked **Reset appearance**. Click **Undo** before making another change. |
| No icons or badges appear           | Check **Show icons** / **Show badges**, and that your data has values.         |
| The aspect ratio control is missing | It shows only for Grid and Horizontal.                                         |

## Related

- [Configuration reference: Appearance](reference-configuration.md#04-appearance)
- [Architecture: Rendering and styling](architecture.md#rendering-and-styling)
