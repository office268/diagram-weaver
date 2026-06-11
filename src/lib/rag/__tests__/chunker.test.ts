import { describe, it, expect } from "vitest";
import { chunkText } from "../chunker.server";

describe("chunkText", () => {
  it("returns empty array for empty string", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("returns a single chunk for short text", () => {
    const chunks = chunkText("Hello world.\n\nThis is a short document.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].content).toContain("Hello world");
  });

  it("sets tokenEstimate as ceil(length / 4)", () => {
    const chunks = chunkText("Hello world.");
    expect(chunks[0].tokenEstimate).toBe(Math.ceil(chunks[0].content.length / 4));
  });

  it("assigns sequential index values across multiple chunks", () => {
    // Create text long enough to produce multiple chunks (>2000 chars per chunk)
    const para = "word ".repeat(500); // ~2500 chars per paragraph
    const text = [para, para, para].join("\n\n");
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, i) => expect(chunk.index).toBe(i));
  });
});
