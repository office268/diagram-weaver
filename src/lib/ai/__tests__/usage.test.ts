import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {},
}));

import { countWordsInContent } from "../usage.server";

describe("countWordsInContent", () => {
  it("returns 0 for null", () => {
    expect(countWordsInContent(null)).toBe(0);
  });

  it("returns 0 for undefined", () => {
    expect(countWordsInContent(undefined)).toBe(0);
  });

  it("counts words in a plain string", () => {
    expect(countWordsInContent("hello world foo")).toBe(3);
  });

  it("counts words recursively in nested objects", () => {
    expect(
      countWordsInContent({ title: "my project", overview: "a great idea" }),
    ).toBe(5);
  });

  it("counts words in arrays", () => {
    expect(countWordsInContent(["hello world", "foo bar baz"])).toBe(5);
  });

  it("handles numbers and booleans as single tokens each", () => {
    expect(countWordsInContent({ count: 42, active: true })).toBe(2);
  });

  it("returns 0 for empty object", () => {
    expect(countWordsInContent({})).toBe(0);
  });
});
