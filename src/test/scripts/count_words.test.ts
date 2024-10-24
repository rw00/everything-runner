import { ScriptOutput } from "../../domain/script";
import { countWordsScript } from "../../application/scripts/count_words";

describe("countWordsScript", () => {
  test("should count words, characters, and lines in multiline text", () => {
    const text = "Hello World!\nThis is interesting!\nCool\nCool\nCool...";

    const result = countWordsScript.run(text, {}) as ScriptOutput;
    const data = result.data;

    expect(data?.count).toBe(8);
    expect(data?.characters).toBe(text.length);
    expect(data?.charactersNoSpaces).toBe(44);
    expect(data?.lines).toBe(5);
  });

  test("should return zeroes for empty input", () => {
    const result = countWordsScript.run("", {}) as ScriptOutput;
    const data = result.data;

    expect(data?.count).toBe(0);
    expect(data?.characters).toBe(0);
    expect(data?.charactersNoSpaces).toBe(0);
    expect(data?.lines).toBe(0);
  });

  test("should handle whitespace-only input", () => {
    const result = countWordsScript.run("   \n\t  ", {}) as ScriptOutput;
    const data = result.data;

    expect(data?.count).toBe(0);
    expect(data?.characters).toBe(7);
    expect(data?.charactersNoSpaces).toBe(0);
    expect(data?.lines).toBe(2);
  });
});
