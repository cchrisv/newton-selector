# Using a Newton Selector

A guide for people filling in a Salesforce Flow screen that uses a Newton Selector. No admin knowledge needed. If you build the screens instead, start with the [tutorial](tutorial-first-selector.md).

## The basics

A selector shows you a set of choices. Click or tap a choice to select it. On screens that allow several choices, click a selected option again to deselect it. On a single-choice screen, use **None** (when the screen offers it) or pick a different option.

You can tell something is selected by its highlight. The style depends on how the screen was designed: a checkmark in the corner, a filled background, a thick bar on the edge, an outline, a folded corner or a soft glow.

Above the choices you may see:

- **A label** that says what you are choosing.
- **A small info icon** with extra help when you hover over or focus it.
- **Help text** with more detail.

## Single choice or several

- **Single choice:** picking a new option replaces the old one. Some screens move on to the next page automatically as soon as you choose.
- **Several choices:** pick as many as you like. The screen may limit how few or how many you can pick. Once you reach a maximum, the remaining choices turn gray until you deselect one.

## Searching

If a **search** box is shown, type to narrow the list. The search looks at each option's name, its short description and its help text, ignoring upper and lower case. Clearing the box brings everything back.

When a "Select all" button is shown on a multi-select, it adds the options that match your search to what you already picked and stops at the maximum. A "Clear all" button removes all selections, including None.

## "None" and "Other"

- **None** (shown as `--None--` unless renamed) clears your answer. It is first or last in the list. It does not count as a selection, so on a required question, choosing None still prompts you to pick something.
- **Other** lets you type your own answer when none of the options fit. When you choose it, a text box appears under the choices. Some screens set a minimum or maximum length and show a hint such as "At least 3 characters" or "Up to 40 characters". Your typed text is what gets saved.

## How each layout works

| Layout           | How you use it                                                                                                                                                                                                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Grid**         | Tiles in rows. Click a tile.                                                                                                                                                                                                                                                                                                       |
| **List**         | One option per row. Click a row.                                                                                                                                                                                                                                                                                                   |
| **Horizontal**   | One scrolling row. Swipe or scroll sideways, and tiles snap into place.                                                                                                                                                                                                                                                            |
| **Dropdown**     | A compact box. Click it (or press Enter or Space while it is focused) to open the list. Pick an option. Press Escape to close. Escape or choosing an option returns focus to the box. In multi-select the list stays open while you pick, and the box shows a summary such as "a, b +2 more".                                      |
| **Radio**        | Cards with a round marker (one choice) or a square checkmark (several).                                                                                                                                                                                                                                                            |
| **Columns**      | Two panels, **Available cards** and **Selected cards**. Click a card to move it across, or drag and drop it. In single mode, a new pick replaces the old one, and clicking the selected card does nothing.                                                                                                                         |
| **Dual listbox** | Two panels, **Available** and **Chosen**. Click a row to highlight it (Shift-click extends the highlight; on a single-choice screen one row is highlighted at a time), then use the four buttons: **Move selected to chosen**, **Move all to chosen**, **Remove selected** and **Remove all**. On narrow screens the panels stack. |

## Using a keyboard

Each tile is a real radio button or checkbox underneath, so the usual browser keys work: **Tab** to reach an option and **Space** to select it. When the screen moves on by itself after a choice, the arrow keys still move between options without moving on; press **Space** or **Enter** on the one you want. In the Dropdown layout, **Enter** or **Space** opens the list, **Up** and **Down** arrows move between options, **Home** and **End** jump to the first and last, **Enter** or **Space** chooses the highlighted option, and **Escape** closes the list. In the Dual listbox layout, **Tab** into a list, use **Up**, **Down**, **Home** and **End** to move, **Space** to highlight a row and **Shift+Up** or **Shift+Down** to extend the highlight, then Tab to the buttons. Each move is announced to screen readers.

Screen readers announce the question label as the name of the group, read out help text with each option, announce the length hint of the "Other" text box, and announce loading and error states.

## When something goes wrong

| What you see                                                   | What it means and what to do                                                                                                 |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Gray placeholder cards                                         | The choices are loading. Wait a moment. Screen readers announce "Loading options".                                           |
| "No options available." (or similar)                           | There is nothing to choose from right now. Tell your admin if you expected options.                                          |
| A red message with a **Try again** button                      | The choices could not be loaded from the org. Click **Try again**. If it keeps failing, send the message text to your admin. |
| A red message with no button                                   | The choices could not be loaded. Send the message text to your admin.                                                        |
| "This selector's saved configuration can't be read"            | The screen is set up wrong. Contact your admin and send them the message.                                                    |
| "Please make a selection."                                     | The question is required. Pick an option and click Next again.                                                               |
| "Please select at least N option(s)." / "...no more than N..." | The screen needs a different number of choices. Adjust and click Next again.                                                 |
| "Enter at least N character(s)." / "Enter no more than N..."   | Your "Other" text is too short or too long.                                                                                  |
| "Enter a value for the manual option."                         | You picked "Other" but left the text box empty.                                                                              |
| Your admin may show their own message instead of the above     | On a required question, admins can replace all of these messages with one custom message.                                    |

If an option you expect is missing, you may not have permission to see that record or field. Selectors only show what your Salesforce access allows.

## Related

- [Overview](overview.md)
- [Troubleshooting for admins](howto-troubleshoot.md)
