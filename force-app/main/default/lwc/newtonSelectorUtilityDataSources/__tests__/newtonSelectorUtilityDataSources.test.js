import {
  normalizePicklist,
  normalizeCollection,
  normalizeSObjectDTO,
  normalizeCustom,
  filterItems,
  applyOverrides,
  formatLabel
} from "c/newtonSelectorUtilityDataSources";

describe("newtonSelectorUtilityDataSources", () => {
  describe("formatLabel", () => {
    it("fills placeholders by index so a translation can reorder them", () => {
      expect(formatLabel("{1} de {0}", 3, "Alpha, Beta")).toBe(
        "Alpha, Beta de 3"
      );
    });
  });

  describe("normalizePicklist", () => {
    it("returns [] for bad input", () => {
      expect(normalizePicklist(null)).toEqual([]);
      expect(normalizePicklist({})).toEqual([]);
    });

    it("maps getPicklistValues output to items", () => {
      const input = {
        values: [
          { label: "Hot", value: "Hot" },
          { label: "Cold", value: "Cold" }
        ]
      };
      const items = normalizePicklist(input);
      expect(items).toHaveLength(2);
      expect(items[0].label).toBe("Hot");
      expect(items[0].value).toBe("Hot");
      expect(items[0].disabled).toBe(false);
    });
  });

  describe("normalizeCollection", () => {
    it("uses fieldMap to pull label/sublabel/icon", () => {
      const records = [
        { Id: "001", Name: "Acme", Industry: "Technology" },
        { Id: "002", Name: "Beta", Industry: "Finance" }
      ];
      const map = { label: "Name", sublabel: "Industry" };
      const items = normalizeCollection(records, map);
      expect(items).toHaveLength(2);
      expect(items[0].label).toBe("Acme");
      expect(items[0].sublabel).toBe("Technology");
      expect(items[0].value).toBe("001");
    });

    it("gives rows a non-empty label when the mapped field is missing", () => {
      const items = normalizeCollection([{ Id: "001" }], { label: "Missing" });
      expect(items[0].label).toBeTruthy();
    });

    it("keeps the source record on each item", () => {
      const record = { Id: "001", Name: "Acme" };
      const items = normalizeCollection([record], { label: "Name" });
      expect(items[0].record).toBe(record);
    });
  });

  describe("normalizeSObjectDTO", () => {
    it("uses the id as value when the DTO has none and keeps its record", () => {
      const record = { Id: "001" };
      const items = normalizeSObjectDTO([{ id: "001", label: "A", record }]);
      expect(items[0].value).toBe("001");
      expect(items[0].record).toBe(record);
    });
  });

  describe("normalizeCustom", () => {
    it("generates distinct id/value fallbacks and attaches no record", () => {
      const items = normalizeCustom([{ label: "X" }, { label: "Y" }]);
      expect(items[0].id).toBeTruthy();
      expect(items[0].id).not.toBe(items[1].id);
      expect(items[0].value).not.toBe(items[1].value);
      expect(items[0].record).toBeUndefined();
    });

    it("preserves caller-provided fields", () => {
      const items = normalizeCustom([
        {
          label: "Alpha",
          value: "a",
          badge: "New",
          helpText: "hint"
        }
      ]);
      expect(items[0].badge).toBe("New");
      expect(items[0].helpText).toBe("hint");
    });

    it("filters hidden custom items", () => {
      const items = normalizeCustom([
        { label: "Visible", value: "visible" },
        { label: "Hidden", value: "hidden", hidden: true }
      ]);
      expect(items).toHaveLength(1);
      expect(items[0].value).toBe("visible");
    });
  });

  describe("filterItems", () => {
    it("matches across label + sublabel + helpText", () => {
      const items = [
        { label: "Alpha", sublabel: "", helpText: "", value: "1" },
        { label: "Beta", sublabel: "math", helpText: "", value: "2" },
        { label: "Gamma", sublabel: "", helpText: "needle", value: "3" }
      ];
      expect(filterItems(items, "alph")).toHaveLength(1);
      expect(filterItems(items, "math")).toHaveLength(1);
      expect(filterItems(items, "needle")).toHaveLength(1);
      expect(filterItems(items, "")).toHaveLength(3);
    });
  });

  describe("applyOverrides", () => {
    it("applies override fields by value key", () => {
      const items = [
        { value: "a", label: "A", icon: "" },
        { value: "b", label: "B", icon: "" }
      ];
      const out = applyOverrides(items, {
        a: { icon: "building-2", badge: "New" }
      });
      expect(out[0].icon).toBe("building-2");
      expect(out[0].badge).toBe("New");
      expect(out[1].icon).toBe("");
    });

    it("ignores empty override values", () => {
      const items = [{ value: "a", icon: "file" }];
      const out = applyOverrides(items, { a: { icon: "" } });
      expect(out[0].icon).toBe("file");
    });

    it("filters items with hidden overrides", () => {
      const items = [
        { value: "a", label: "A" },
        { value: "b", label: "B" }
      ];
      const out = applyOverrides(items, { b: { hidden: true } });
      expect(out).toEqual([{ value: "a", label: "A" }]);
    });
  });
});
