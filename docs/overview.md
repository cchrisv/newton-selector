# Newton Selector: overview

Newton Selector (shown in Flow Builder as **Professor Flow | Newton Selector**) is a Flow screen component that replaces plain picklists and radio buttons with a visual choice selector. Options appear as tiles, rows, a ribbon, a dropdown or a two-panel mover, and a Salesforce admin sets all of it up in Flow Builder with clicks. No code and no formula fields.

This page is for anyone who wants to know what it does and whether it fits: admins, Flow builders, business owners, and the people who fill in the screens.

## What it looks like to the person filling in a screen

Instead of a drab list of radio buttons, they see choices designed for the task:

- **Pick a service** from tiles, each with an icon, a short description and a badge such as "Popular".
- **Choose a few topics** from a list, with a search box to narrow it down.
- **Move products** from an "Available" column to a "Selected" column.
- **Pick a status** from a compact dropdown when space is tight.

They click or tap a tile to choose it. In single-choice mode they can have the Flow move on automatically. If an answer is required and they skip it, the screen tells them. If none of the options fit, an optional **Other** choice lets them type their own.

See [Using a Newton Selector](guide-using-the-selector.md) for the full end-user guide.

## What it gives the Flow builder

You choose where the options come from, and the component handles fetching, formatting and display:

| Data source        | Use it when                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| **Picklist**       | Options are the values of a picklist field (with record type support)       |
| **Collection**     | You already have records in a Flow variable (from Get Records, for example) |
| **SOQL query**     | You want a live, filtered list of records from the org                      |
| **Custom options** | The list is short and stable and does not live in your data model           |

You then decide how it behaves (single or multi-select, required, search, a "None" choice, an "Other" choice) and how it looks (seven layouts, tile size, icons, badges, colors, selection style). A live preview in the editor shows the result as you work.

When the user chooses, the Flow gets outputs it can use right away: the selected value(s), label(s), how many were selected, and the lists of everything on offer. See [How to use the outputs](howto-use-outputs-in-a-flow.md).

## The seven layouts

| Layout           | Best for                                                                 |
| ---------------- | ------------------------------------------------------------------------ |
| **Grid**         | Visual, icon-forward choices in a responsive tile grid                   |
| **List**         | Dense option sets as stacked rows                                        |
| **Horizontal**   | Steps, statuses or any scrollable ribbon                                 |
| **Dropdown**     | Compact dropdown for tight screens                                       |
| **Radio**        | Card-styled radio group, accessibility first                             |
| **Columns**      | Move cards between "Available" and "Selected", by click or drag and drop |
| **Dual listbox** | Two panels with Add and Remove buttons                                   |

## What it is built on

- Salesforce **Lightning Web Components** and **Apex**, API version 66.0.
- **SLDS 2** styling, so it follows the org's theme and supports dark mode.
- Query access always runs **as the logged-in user**, so people only see records and fields they are allowed to see. See [the security model](explanation-security-model.md).

## Who should read what

| You are...                                       | Start here                                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Someone filling in a screen that uses a selector | [Using a Newton Selector](guide-using-the-selector.md)                                        |
| An admin building your first selector            | [Tutorial: your first selector](tutorial-first-selector.md)                                   |
| An admin with a specific task                    | The how-to guides in the [docs index](README.md)                                              |
| An admin who needs every option explained        | [Configuration reference](reference-configuration.md)                                         |
| A developer extending the code                   | [Architecture](architecture.md) and [How to develop and test](howto-develop-and-test.md)      |
| Someone evaluating risk                          | [Security model](explanation-security-model.md) and [Known limitations](known-limitations.md) |

## Installing it

Deploy the `force-app` folder to your org with the Salesforce CLI, assign the `Newton_Selector_User` permission set to people who run the Flow (and `Newton_Selector_Admin` to people who build it), then drag the component onto a Flow screen. Steps are in the [tutorial](tutorial-first-selector.md#step-1-deploy-the-component).

## Known rough edges

A few behaviors need workarounds today (for example SOQL date literals). They are listed with fixes in [Known limitations](known-limitations.md).
