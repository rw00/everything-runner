import { resolveParams } from "../../domain/script";
import { sortTextScript } from "../../application/scripts/sort_text";

describe("sortTextScript", () => {
  test("should sort lines alphabetically in ascending order by default", () => {
    const text = "Hello\nWorld\nUnbelievable\n1000";
    const params = resolveParams(sortTextScript.params);

    const result = sortTextScript.run(text, params);

    expect(result).toBe("1000\nHello\nUnbelievable\nWorld");
  });

  test("should sort lines in descending order", () => {
    const text = "Apple\nCherry\nBanana";
    const params = resolveParams(sortTextScript.params, { ascending: false });

    const result = sortTextScript.run(text, params);

    expect(result).toBe("Cherry\nBanana\nApple");
  });

  test("should normalize CRLF line endings when splitting by newline", () => {
    const text = "Charlie\r\nAlpha\r\nBravo";
    const params = resolveParams(sortTextScript.params);

    const result = sortTextScript.run(text, params);

    expect(result).toBe("Alpha\nBravo\nCharlie");
  });

  test("should support custom split delimiter and join separator", () => {
    const text = "z, a, m";
    const params = resolveParams(sortTextScript.params, {
      splitDelimiter: ",\\s*",
      joinSeparator: " | "
    });

    const result = sortTextScript.run(text, params);

    expect(result).toBe("a | m | z");
  });

  test("should leave empty input unchanged", () => {
    const params = resolveParams(sortTextScript.params);

    const result = sortTextScript.run("", params);

    expect(result).toBe("");
  });
});
