import {
  activeSectionIssueList,
  sectionIssues,
  sectionStatus,
  totalIssueCount
} from "c/newtonSelectorFlowCpeUtilityConfigValidation";

const BASE_CONFIG = {
  dataSource: "custom",
  selectionMode: "single",
  custom: { items: [{ label: "One", value: "one" }] },
  manualInput: {
    enabled: false,
    label: "Other",
    minLength: 0,
    maxLength: null
  },
  collection: { fieldMap: { label: "Name" } },
  picklist: { objectApiName: "Account", fieldApiName: "Type" },
  sobject: { sObjectApiName: "Account", labelField: "Name" }
};

describe("c-newton-selector-flow-cpe-utility-config-validation", () => {
  it("blocks collection mode without a Flow collection binding", () => {
    const issues = sectionIssues("data", {
      ...BASE_CONFIG,
      dataSource: "collection"
    });

    expect(issues.errors).toContain("Choose the record collection variable.");
    expect(
      sectionStatus("data", { ...BASE_CONFIG, dataSource: "collection" })
    ).toBe("error");
  });

  it("blocks collection mode without a label field map", () => {
    const config = {
      ...BASE_CONFIG,
      dataSource: "collection",
      collection: { fieldMap: { label: "" } }
    };
    const refs = { sourceRecordsRef: "{!records}" };

    const issues = sectionIssues("data", config, refs);

    expect(issues.errors).toContain(
      "Choose the field to show as each option's label."
    );
    expect(totalIssueCount(config, refs, "errors")).toBe(1);
  });

  it("blocks custom mode without items and still warns about incomplete rows", () => {
    const emptyConfig = {
      ...BASE_CONFIG,
      dataSource: "custom",
      custom: { items: [] }
    };
    const incompleteConfig = {
      ...BASE_CONFIG,
      dataSource: "custom",
      custom: { items: [{ label: "", value: "missing-label" }] }
    };

    expect(sectionIssues("data", emptyConfig).errors).toContain(
      "Add at least one option."
    );
    expect(sectionIssues("data", incompleteConfig).warnings).toContain(
      "Option 1 needs a label."
    );
  });

  it("allows custom mode without static items when manual input is enabled", () => {
    const config = {
      ...BASE_CONFIG,
      dataSource: "custom",
      custom: { items: [] },
      manualInput: {
        enabled: true,
        label: "Other",
        minLength: 1,
        maxLength: 20
      }
    };

    expect(sectionIssues("data", config).errors).not.toContain(
      "Add at least one option."
    );
  });

  it("blocks invalid manual input character ranges", () => {
    const config = {
      ...BASE_CONFIG,
      manualInput: {
        enabled: true,
        label: "Other",
        minLength: 5,
        maxLength: 3
      }
    };

    expect(sectionIssues("behavior", config).errors).toContain(
      "Maximum characters must be at least the minimum, and at least 1."
    );
  });

  it("returns renderable active issue metadata for blocking and warning issues", () => {
    const config = {
      ...BASE_CONFIG,
      dataSource: "custom",
      custom: { items: [{ label: "", value: "missing-label" }] },
      selectionMode: "multi",
      minSelections: 3,
      maxSelections: 1
    };

    const dataIssues = activeSectionIssueList("data", config);
    const behaviorIssues = activeSectionIssueList("behavior", config);

    expect(dataIssues[0]).toEqual(
      expect.objectContaining({
        level: "warn",
        message: "Option 1 needs a label."
      })
    );
    expect(behaviorIssues[0]).toEqual(
      expect.objectContaining({
        level: "error",
        message: expect.stringContaining("Maximum selections")
      })
    );
  });
});
