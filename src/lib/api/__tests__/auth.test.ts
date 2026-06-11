import { describe, it, expect } from "vitest";
import { translateAiError } from "../auth.server";

describe("translateAiError", () => {
  it("returns 429 for a rate-limit error message", () => {
    const result = translateAiError(new Error("upstream 429 Too Many Requests"));
    expect(result).toEqual({ status: 429, message: "הגעת למגבלת קצב." });
  });

  it("returns 402 for a payment-required error message", () => {
    const result = translateAiError(new Error("402 Payment Required"));
    expect(result).toEqual({ status: 402, message: "אזלו קרדיטי ה-AI." });
  });

  it("returns 500 with the error message for a generic Error", () => {
    const result = translateAiError(new Error("Something went wrong"));
    expect(result).toEqual({ status: 500, message: "Something went wrong" });
  });

  it("returns 500 with stringified value for a non-Error", () => {
    const result = translateAiError("raw string error");
    expect(result).toEqual({ status: 500, message: "raw string error" });
  });
});
