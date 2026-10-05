import { SECTIONS } from "c/newtonSelectorFlowCpeUtilityConfigOptions";

// Messages say what needs attention and how to fix it, in the editor's own
// words. The Flow Builder panel reuses them, so both surfaces read the same.
export const CHOOSE_COLLECTION_MESSAGE =
  "Choose the record collection variable.";

function listPositions(positions) {
  if (positions.length === 1) return String(positions[0]);
  return `${positions.slice(0, -1).join(", ")} and ${positions[positions.length - 1]}`;
}

// "Option 2 needs" / "Options 2 and 4 need"
function optionsPhrase(positions, singularVerb, pluralVerb) {
  return positions.length === 1
    ? `Option ${positions[0]} ${singularVerb}`
    : `Options ${listPositions(positions)} ${pluralVerb}`;
}

// The runtime reads a blank value as the None option and matches selections
// by value, so every visible custom option needs its own non-blank value.
function customValueErrors(items) {
  const blank = [];
  const repeated = [];
  const seen = new Set();
  items.forEach((item, index) => {
    if (item.hidden === true) return;
    const value = String(item.value ?? "");
    if (value === "") blank.push(index + 1);
    else if (seen.has(value)) repeated.push(index + 1);
    else seen.add(value);
  });
  const errors = [];
  if (blank.length) {
    errors.push(`${optionsPhrase(blank, "needs", "need")} a value.`);
  }
  if (repeated.length) {
    errors.push(
      `${optionsPhrase(repeated, "repeats", "repeat")} an earlier option's value.`
    );
  }
  return errors;
}

// config is always a mergeSelectorConfig result, so every key is present.
export function sectionIssues(key, config, refs = {}) {
  const errors = [];
  const warnings = [];
  const c = config;
  const dataSource = c.dataSource;

  if (key === "data") {
    if (!dataSource) {
      errors.push("Choose a data source.");
    } else if (dataSource === "picklist") {
      if (!c.picklist.objectApiName)
        errors.push("Choose the object that has the picklist field.");
      if (!c.picklist.fieldApiName) errors.push("Choose the picklist field.");
    } else if (dataSource === "collection") {
      if (!refs.sourceRecordsRef) errors.push(CHOOSE_COLLECTION_MESSAGE);
      if (!c.collection.fieldMap.label)
        errors.push("Choose the field to show as each option's label.");
    } else if (dataSource === "sobject") {
      if (!c.sobject.sObjectApiName) errors.push("Choose the object to query.");
      if (refs.whereIncomplete)
        errors.push("Finish or remove the highlighted filter condition.");
    } else if (dataSource === "custom") {
      const items = c.custom.items;
      if (items.length === 0 && !c.manualInput.enabled) {
        errors.push("Add at least one option.");
      }
      errors.push(...customValueErrors(items));
      const unlabeled = items
        .map((item, index) => (item.label ? null : index + 1))
        .filter(Boolean);
      if (unlabeled.length) {
        warnings.push(`${optionsPhrase(unlabeled, "needs", "need")} a label.`);
      }
    }
  } else if (key === "behavior") {
    const min = Number(c.minSelections);
    const max = c.maxSelections == null ? null : Number(c.maxSelections);
    const manual = c.manualInput;
    const manualMin = Number(manual.minLength);
    const manualMax =
      manual.maxLength == null ? null : Number(manual.maxLength);
    if (c.selectionMode === "multi" && max != null && max < Math.max(min, 1)) {
      errors.push(
        "Maximum selections must be at least the minimum, and at least 1."
      );
    }
    if (manual.enabled) {
      if (!Number.isFinite(manualMin) || manualMin < 0) {
        errors.push("Minimum characters can't be negative.");
      }
      if (
        manualMax !== null &&
        (!Number.isFinite(manualMax) || manualMax < Math.max(manualMin, 1))
      ) {
        errors.push(
          "Maximum characters must be at least the minimum, and at least 1."
        );
      }
    }
  }

  return { errors, warnings };
}

export function sectionStatus(key, config, refs) {
  const issues = sectionIssues(key, config, refs);
  if (issues.errors.length) return "error";
  if (issues.warnings.length) return "warn";
  return "ok";
}

export function totalIssueCount(config, refs, level) {
  return SECTIONS.reduce((count, section) => {
    const issues = sectionIssues(section.key, config, refs);
    return count + issues[level].length;
  }, 0);
}

export function activeSectionIssueList(key, config, refs) {
  const issues = sectionIssues(key, config, refs);
  return [
    ...issues.errors.map((message, index) =>
      buildIssue("error", message, index)
    ),
    ...issues.warnings.map((message, index) =>
      buildIssue("warn", message, index)
    )
  ];
}

// levelLabel is read by screen readers before the message, so a blocking
// error and a warning don't differ only by icon and color.
function buildIssue(level, message, index) {
  const isError = level === "error";
  return {
    key: `${level}-${index}-${message}`,
    levelLabel: isError ? "Error: " : "Warning: ",
    message,
    icon: isError ? "circle-alert" : "triangle-alert",
    className: `newton-studio__issue_${level}`
  };
}
