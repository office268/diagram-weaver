import { describe, it, expect } from "vitest";
import { renderErrorPage } from "../error-page";

describe("renderErrorPage", () => {
  it("returns a string", () => {
    expect(typeof renderErrorPage()).toBe("string");
  });

  it("contains DOCTYPE html declaration", () => {
    expect(renderErrorPage().toLowerCase()).toContain("<!doctype html>");
  });

  it("contains user-facing error message text", () => {
    expect(renderErrorPage()).toContain("Something went wrong");
  });
});
