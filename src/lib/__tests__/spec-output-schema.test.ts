import { describe, it, expect } from "vitest";
import { extractJson } from "@/lib/spec/output-schema";

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
