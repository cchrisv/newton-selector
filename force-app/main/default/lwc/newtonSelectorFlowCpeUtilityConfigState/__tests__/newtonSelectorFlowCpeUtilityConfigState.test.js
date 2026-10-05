import { resolveRecordCollectionMetadataFromBuilderContext } from "c/newtonSelectorFlowCpeUtilityConfigState";

describe("c-newton-selector-flow-cpe-utility-config-state", () => {
  it("resolves flow record collections from builder-context record operations", () => {
    const metadata = resolveRecordCollectionMetadataFromBuilderContext(
      {
        recordLookups: [
          {
            name: "Get_Contacts",
            object: "Contact",
            getFirstRecordOnly: "false"
          }
        ]
      },
      "{!Get_Contacts}"
    );

    expect(metadata.objectApiName).toBe("Contact");
  });
});
