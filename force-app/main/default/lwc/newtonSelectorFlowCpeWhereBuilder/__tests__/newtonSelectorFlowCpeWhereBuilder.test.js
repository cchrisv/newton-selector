import {
  operatorsForType,
  parseWhere,
  serializeValue,
  treeToWhere
} from "c/newtonSelectorFlowCpeWhereBuilder";

const values = (options) => options.map((option) => option.value);

describe("operatorsForType", () => {
  it.each([
    [
      ["STRING", "TEXTAREA", "URL", "EMAIL", "PHONE", "", null, "NEWTYPE"],
      ["=", "!=", "LIKE", "IN", "NOT IN"]
    ],
    [
      ["INTEGER", "LONG", "DOUBLE", "CURRENCY", "PERCENT"],
      ["=", "!=", "<", ">", "<=", ">="]
    ],
    [
      ["DATE", "DATETIME", "TIME"],
      ["=", "!=", "<", ">", "<=", ">="]
    ],
    [["BOOLEAN"], ["=", "!="]],
    [
      ["PICKLIST", "REFERENCE", "ID"],
      ["=", "!=", "IN", "NOT IN"]
    ],
    [["MULTIPICKLIST"], ["INCLUDES", "EXCLUDES"]]
  ])("%j → %j", (types, expected) => {
    types.forEach((type) => {
      expect(values(operatorsForType(type))).toEqual(expected);
    });
  });
});

describe("serializeValue", () => {
  it.each([
    ["Acme", "STRING", "=", "'Acme'"],
    ["O'Brien", "STRING", "=", "'O\\'Brien'"],
    ["foo\\bar", "STRING", "=", "'foo\\\\bar'"],
    ["{!myVar}", "STRING", "=", "'{!myVar}'"],
    ["acme", "STRING", "LIKE", "'%acme%'"],
    ["acme%", "STRING", "LIKE", "'acme%'"],
    ["a_me", "STRING", "LIKE", "'a_me'"],
    ["{!searchTerm}", "STRING", "LIKE", "'{!searchTerm}'"],
    ["a , b ,, c ", "STRING", "IN", "('a', 'b', 'c')"],
    ["O'Brien,Smith", "PICKLIST", "NOT IN", "('O\\'Brien', 'Smith')"],
    ["1.5, 2.5", "DOUBLE", "IN", "(1.5, 2.5)"],
    ["Children's, B", "MULTIPICKLIST", "INCLUDES", "('Children\\'s', 'B')"],
    ["42", "INTEGER", "=", "42"],
    ["1000.50", "CURRENCY", "<=", "1000.50"],
    ["0.5", "PERCENT", "!=", "0.5"],
    ["true", "BOOLEAN", "=", "TRUE"],
    ["no", "BOOLEAN", "=", "FALSE"],
    ["{!flag}", "BOOLEAN", "=", "{!flag}"],
    ["2026-04-17", "DATE", "=", "2026-04-17"],
    ["2026-04-17T23:59:59Z", "DATETIME", "<=", "2026-04-17T23:59:59Z"]
  ])("%s as %s with %s → %s", (raw, type, operator, expected) => {
    expect(serializeValue(raw, type, operator)).toBe(expected);
  });
});

describe("parseWhere", () => {
  it.each(["", "   ", null])("returns null for empty input %j", (input) => {
    expect(parseWhere(input)).toBeNull();
  });

  it.each([
    "this is not soql",
    "a = '1' AND b = '2' OR c = '3'",
    "Name NOT LIKE '%test%'",
    "Name = 'unterminated",
    "Account.Name = 'Acme'",
    "Amount <> 5"
  ])("returns null for a clause it can't show visually: %s", (input) => {
    expect(parseWhere(input)).toBeNull();
  });

  it.each([
    ["Name = 'Acme'", { field: "Name", operator: "=", value: "Acme" }],
    ["Name = 'O\\'Brien'", { value: "O'Brien" }],
    ["Name LIKE '%Acme%'", { operator: "LIKE", value: "Acme" }],
    ["Name LIKE 'Acme%'", { value: "Acme%" }],
    [
      "Type IN ('Customer', 'Prospect')",
      { operator: "IN", value: "Customer, Prospect" }
    ],
    ["Topics__c INCLUDES ('A', 'B')", { operator: "INCLUDES", value: "A, B" }],
    ["OwnerId = '{!$User.Id}'", { value: "{!$User.Id}" }],
    ["IsActive__c = TRUE", { value: "TRUE" }]
  ])("reads %s", (input, expected) => {
    expect(parseWhere(input).children[0]).toMatchObject(expected);
  });

  it.each([
    "Name = 'Acme'",
    "Industry = 'Tech' AND Name = 'Acme'",
    "Type = 'Customer' OR Type = 'Prospect'",
    "Name = 'Acme' AND (Industry = 'Technology' OR Rating = 'Hot')",
    "(Name = 'A' OR Name = 'B') AND (Rating = 'Hot' OR Rating = 'Warm')",
    "Type IN ('Customer', 'Prospect') AND Name LIKE '%Acme%'"
  ])("round-trips %s", (clause) => {
    expect(treeToWhere(parseWhere(clause))).toBe(clause);
  });

  it("reads lower-case AND / OR and drops redundant parentheses", () => {
    expect(
      treeToWhere(
        parseWhere("(Name = 'A') and ((Rating = 'Hot') or (Rating = 'Warm'))")
      )
    ).toBe("Name = 'A' AND (Rating = 'Hot' OR Rating = 'Warm')");
  });
});

describe("treeToWhere", () => {
  const condition = (field, operator, value, _fieldType = "STRING") => ({
    type: "condition",
    field,
    operator,
    value,
    _fieldType
  });
  const root = (operator, children) => ({
    id: "root",
    type: "group",
    operator,
    children
  });

  it("leaves out conditions with an error and keeps the valid ones", () => {
    expect(
      treeToWhere(
        root("AND", [
          condition("Industry", "=", ""),
          condition("", "=", "x"),
          condition("Industry", "IN", "{!myCollection}"),
          condition("NumberOfEmployees", ">", "500", "INTEGER"),
          condition("AnnualRevenue", "=", 0, "CURRENCY")
        ])
      )
    ).toBe("NumberOfEmployees > 500 AND AnnualRevenue = 0");
  });
});
