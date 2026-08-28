import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./redirects";
describe("safeInternalPath", () => {
  it("allows local application paths", () => expect(safeInternalPath("/dashboard/queue?id=1")).toBe("/dashboard/queue?id=1"));
  it.each(["//evil.example", "/%2f%2fevil.example", "https://evil.example", "/\\evil.example", "/%5cevil.example", "/ok\nLocation:https://evil.example"])("blocks unsafe redirect %s", (value) => expect(safeInternalPath(value)).toBe("/dashboard"));
});
