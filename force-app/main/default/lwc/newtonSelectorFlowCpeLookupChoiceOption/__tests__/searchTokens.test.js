import { buildTokens } from "../searchTokens";

describe("buildTokens", () => {
  it.each([
    ["text is empty", "", "foo"],
    ["term is empty", "Account Name", ""],
    ["term is only whitespace", "Account Name", "   "],
    ["there is no match", "Account Name", "xyz"]
  ])("returns one plain token when %s", (_, text, term) => {
    expect(buildTokens(text, term)).toEqual([
      { key: "token-0", text, isHighlight: false }
    ]);
  });

  it("splits around a single match preserving surrounding text", () => {
    const tokens = buildTokens("Account Name", "count");
    expect(tokens).toEqual([
      { key: "token-0", text: "Ac", isHighlight: false },
      { key: "token-1", text: "count", isHighlight: true },
      { key: "token-2", text: " Name", isHighlight: false }
    ]);
  });

  it("matches case-insensitively while preserving original casing", () => {
    const tokens = buildTokens("Hello World", "WORLD");
    expect(tokens).toEqual([
      { key: "token-0", text: "Hello ", isHighlight: false },
      { key: "token-1", text: "World", isHighlight: true }
    ]);
  });

  it("highlights multiple non-overlapping matches", () => {
    const tokens = buildTokens("ababab", "ab");
    expect(tokens).toEqual([
      { key: "token-0", text: "ab", isHighlight: true },
      { key: "token-1", text: "ab", isHighlight: true },
      { key: "token-2", text: "ab", isHighlight: true }
    ]);
  });

  it("handles a match at the very start of the text", () => {
    const tokens = buildTokens("abc def", "abc");
    expect(tokens[0]).toEqual({
      key: "token-0",
      text: "abc",
      isHighlight: true
    });
    expect(tokens[1]).toEqual({
      key: "token-1",
      text: " def",
      isHighlight: false
    });
  });

  it("handles a match at the very end of the text", () => {
    const tokens = buildTokens("abc def", "def");
    expect(tokens).toEqual([
      { key: "token-0", text: "abc ", isHighlight: false },
      { key: "token-1", text: "def", isHighlight: true }
    ]);
  });
});
