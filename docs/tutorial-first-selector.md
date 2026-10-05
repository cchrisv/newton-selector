# Tutorial: build your first selector

You will deploy Newton Selector, put it on a Flow screen, configure it with three custom options, and run the Flow to see your choice come back as a value. About 15 minutes.

You will end up with a working "Choose a plan" screen: three tiles with icons and badges, one required choice, and a second screen that shows what the user picked.

## What you'll need

- A Salesforce org you can deploy to (a scratch org, Developer Edition or sandbox) and permission to create Flows.
- The [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf` v2 or later).
- This repository on your machine.

## Step 1: Deploy the component

Log in and deploy the source.

```bash
sf org login web --alias my-org
sf project deploy start --source-dir force-app --target-org my-org
```

The command ends with a table of deployed components and a success status. Then give yourself the editor and runtime access:

```bash
sf org assign permset --name Newton_Selector_Admin --target-org my-org
```

People who only run the Flow need `Newton_Selector_User`.

## Step 2: Add the component to a screen

1. In Setup, search for **Flows** and click **New Flow**.
2. Choose **Screen Flow** and click **Create**.
3. Click **+** on the canvas and add a **Screen** element. Name it `Choose a plan`.
4. In the component list on the left, find **Professor Flow | Newton Selector** under Custom and drag it onto the screen canvas.
5. Click the component. Set its API name to `Plan_Selector`.

The right panel now shows **Not configured yet** and a **Configure selector** button.

## Step 3: Configure it

Click **Configure selector**. A large window titled **Configure Newton Selector** opens. The preview is on the left and four chapters are on the right.

1. In **01 Data**, click the **Custom options** tile. The preview comes alive with your (empty) list.
2. Click **Add option**. Fill in the row:
   - **Label:** `Starter`
   - **Value:** `starter`
   - **Sublabel:** `For individuals`
   - **Badge:** `Free`
3. Click **Add option** again:
   - **Label:** `Team`, **Value:** `team`, **Sublabel:** `Up to 25 users`, **Badge:** `Popular`
4. Click **Add option** a third time:
   - **Label:** `Enterprise`, **Value:** `enterprise`, **Sublabel:** `Unlimited users`, **Badge:** leave blank

   Always fill in **Value**. A blank value stays empty.

Look at the preview. You should see three tiles. Use the **Populated / Empty / Error** tabs to see the other states, then return to **Populated**.

## Step 4: Add a label and make it required

1. In **02 Content**, set **Selector label** to `Choose a plan`.
2. In **03 Behavior**, turn **Required** on. Leave **Mode** on Single.
3. Optional: turn **Auto-advance** on if you want the Flow to move forward as soon as someone clicks a tile.

## Step 5: Pick a look

In **04 Appearance**:

1. Leave **Layout** on Grid. (You can switch later; your styling carries over.)
2. Set **Tile size** to Medium.
3. Set **Selection indicator** to **Checkmark**.

Watch the preview update after each change.

## Step 6: Save

Click **Save** at the bottom. If **Save** is grayed out, hover over it. The tooltip says how many errors to fix, and the error list sits at the top of the right column. When it saves, the window closes and the panel shows a **Current configuration** summary with a **Edit configuration** button.

## Step 7: Show the answer on a second screen

1. Add a second **Screen** after the first. Name it `You chose`.
2. Add a **Display Text** component and enter: `You chose {!Plan_Selector.selectedLabel} (value: {!Plan_Selector.value}).`
3. Connect **Start** → `Choose a plan` → `You chose`.

If the `{!Plan_Selector...}` references do not autocomplete, check that the first screen's component API name is exactly `Plan_Selector`.

## Step 8: Run it

1. Click **Save** on the Flow, give it a name such as `Plan Chooser`, and click **Debug**.
2. Click **Next** without choosing a tile. You should see **Please make a selection.**
3. Click the **Team** tile and then **Next**.

The second screen should read: **You chose Team (value: team).**

## What you built

A Flow screen with a required, three-option selector, configured entirely in the editor, and a second screen that reads two of its outputs. The same pattern works for every data source: only Step 3 changes.

Where to go next:

- Pull options from the org: [How to build a SOQL selector](howto-build-a-soql-selector.md) or [How to use a record collection](howto-use-a-record-collection.md).
- Let people pick several: [How to configure multi-select and validation](howto-multi-select-and-validation.md).
- Change the look: [How to style a selector](howto-style-a-selector.md).
- Use more outputs: [How to use the outputs in a Flow](howto-use-outputs-in-a-flow.md).
- Every setting: [Configuration reference](reference-configuration.md).

## If something goes wrong

| Symptom                                           | Fix                                                                                                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| The component is not in the screen component list | Confirm the deploy succeeded and you are in the same org. Refresh Flow Builder.                                                         |
| **Save** in the editor is disabled                | The line beside **Save** names the first error (for example "1 error to fix · Data: Add at least one option."). Fix it in that chapter. |
| The selector shows the empty message at runtime   | The config was not saved. Reopen the editor and click **Save**, then save the Flow.                                                     |
| `selectedLabel` is blank on screen 2              | The user chose None, or the selector API name in your reference does not match.                                                         |
