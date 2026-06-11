import { describe, it, expect } from "vitest";
import { extractJson, normalizeReviewNotes } from "@/lib/spec/output-schema";

describe("extractJson", () => {
  it("returns plain JSON unchanged", () => {
    const input = '{"score":9,"notes":[]}';
    expect(extractJson(input)).toBe(input);
  });

  it("strips triple-backtick json fence", () => {
    const input = '```json\n{"score":7,"notes":[]}\n```';
    expect(extractJson(input)).toBe('{"score":7,"notes":[]}');
  });

  it("strips open fence (truncated response)", () => {
    const input = '```json\n{"score":5,"notes":[]}';
    expect(extractJson(input)).toBe('{"score":5,"notes":[]}');
  });

  it("strips preamble before first {", () => {
    const input = 'Sure! Here is the JSON:\n{"score":8,"notes":[]}';
    expect(extractJson(input)).toBe('{"score":8,"notes":[]}');
  });

  it("handles text with trailing content after }", () => {
    const input = '{"score":6,"notes":[]} some trailing text';
    expect(extractJson(input)).toBe('{"score":6,"notes":[]}');
  });

  it("handles empty string without throwing", () => {
    expect(extractJson("")).toBe("");
  });

  it("handles whitespace-only string without throwing", () => {
    expect(extractJson("   ")).toBe("");
  });
});

describe("normalizeReviewNotes", () => {
  it("returns empty array for non-array input", () => {
    expect(normalizeReviewNotes(null)).toEqual([]);
    expect(normalizeReviewNotes("string")).toEqual([]);
    expect(normalizeReviewNotes(42)).toEqual([]);
  });

  it("converts legacy string notes to ReviewNote objects", () => {
    const result = normalizeReviewNotes(["Fix the login flow", "Add error handling"]);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Fix the login flow");
    expect(result[0].importance).toBe(5);
    expect(result[0].id).toBe("n-1");
  });

  it("normalizes object notes with a text field", () => {
    const result = normalizeReviewNotes([{ id: "abc", text: "Improve UX", importance: 8 }]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("abc");
    expect(result[0].text).toBe("Improve UX");
    expect(result[0].importance).toBe(8);
  });

  it("filters out entries with empty or missing text", () => {
    const result = normalizeReviewNotes(["", "  ", { text: "" }, { text: "valid" }]);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("valid");
  });
});
