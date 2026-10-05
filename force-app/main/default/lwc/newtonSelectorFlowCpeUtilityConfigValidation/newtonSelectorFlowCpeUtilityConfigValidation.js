import { SECTIONS } from "c/newtonSelectorFlowCpeUtilityConfigOptions";

// Messages say what needs attention and how to fix it, in the editor's own
// words. The Flow Builder panel reuses them, so both surfaces read the same.
export const CHOOSE_COLLECTION_MESSAGE =
  "Choose the record collection variable.";

function listPositions(positions) {
  if (positions.length === 1) return String(positions[0]);
  return `${positions.slice(0, -1).join(", ")} and ${positions[positions.length - 1]}`;
}

export function sectionIssues(key, config, refs = {}) {
  const errors = [];
  const warnings = [];
  const c = config || {};
  const dataSource = c.dataSource;

  if (key === "data") {
    if (!dataSource) {
      errors.push("Choose a data source.");
    } else if (dataSource === "picklist") {
      if (!c.picklist?.objectApiName)
        errors.push("Choose the object that has the picklist field.");
      if (!c.picklist?.fieldApiName) errors.push("Choose the picklist field.");
    } else if (dataSource === "collection") {
      if (!refs.sourceRecordsRef) errors.push(CHOOSE_COLLECTION_MESSAGE);
      if (!c.collection?.fieldMap?.label)
        errors.push("Choose the field to show as each option's label.");
    } else if (dataSource === "sobject") {
      if (!c.sobject?.sObjectApiName)
        errors.push("Choose the object to query.");
      if (refs.whereIncomplete)
        errors.push("Finish or remove the highlighted filter condition.");
    } else if (dataSource === "custom") {
      const items = c.custom?.items || [];
      if (items.length === 0 && !c.manualInput?.enabled) {
        errors.push("Add at least one option.");
      }
      const unlabeled = items
        .map((item, index) => (item.label ? null : index + 1))
        .filter(Boolean);
      if (unlabeled.length) {
        warnings.push(
          `${unlabeled.length === 1 ? "Option" : "Options"} ${listPositions(unlabeled)} ${unlabeled.length === 1 ? "needs" : "need"} a label.`
        );
      }
    }
  } else if (key === "behavior") {
    const min = Number(c.minSelections || 0);
    const max =
      c.maxSelections === null ||
      c.maxSelections === undefined ||
      c.maxSelections === ""
        ? null
        : Number(c.maxSelections);
    const manual = c.manualInput || {};
    const manualMin = Number(manual.minLength || 0);
    const manualMax =
      manual.maxLength === null || manual.maxLength === undefined
        ? null
        : Number(manual.maxLength);
    if (c.selectionMode === "multi" && max != null && max < Math.max(min, 1)) {
      errors.push(
        "Maximum selections must be at least the minimum, and at least 1."
      );
    }
    if (manual.enabled) {
      if (!manual.label || !String(manual.label).trim()) {
        errors.push("Give the manual input option a label.");
      }
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

function buildIssue(level, message, index) {
  return {
    key: `${level}-${index}-${message}`,
    level,
    message,
    icon: level === "error" ? "circle-alert" : "triangle-alert",
    className: `newton-studio__issue newton-studio__issue_${level}`
  };
}
