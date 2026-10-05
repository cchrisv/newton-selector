import {
  activeSectionIssueList,
  sectionIssues
} from "c/newtonSelectorFlowCpeUtilityConfigValidation";
import { mergeSelectorConfig } from "c/newtonSelectorUtilityConfigDefaults";

const BASE_CONFIG = {
  dataSource: "custom",
  selectionMode: "single",
  custom: { items: [{ label: "One", value: "one" }] }
};

describe("c-newton-selector-flow-cpe-utility-config-validation", () => {
  it("allows custom mode without static items when manual input is enabled", () => {
    const config = mergeSelectorConfig({
      ...BASE_CONFIG,
      custom: { items: [] },
      manualInput: {
        enabled: true,
        label: "Other",
        minLength: 1,
        maxLength: 20
      }
    });

    expect(sectionIssues("data", config).errors).not.toContain(
      "Add at least one option."
    );
  });

  it("blocks invalid manual input character ranges", () => {
    const config = mergeSelectorConfig({
      ...BASE_CONFIG,
      manualInput: {
        enabled: true,
        label: "Other",
        minLength: 5,
        maxLength: 3
      }
    });

    expect(sectionIssues("behavior", config).errors).toContain(
      "Maximum characters must be at least the minimum, and at least 1."
    );
  });

  it("reports an unlabeled custom option as a warning", () => {
    const config = mergeSelectorConfig({
      ...BASE_CONFIG,
      custom: { items: [{ label: "", value: "missing-label" }] }
    });

    expect(activeSectionIssueList("data", config)[0]).toEqual(
      expect.objectContaining({
        levelLabel: "Warning: ",
        message: "Option 1 needs a label."
      })
    );
  });
});
