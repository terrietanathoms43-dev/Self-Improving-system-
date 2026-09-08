import { describe, expect, it } from "vitest";
import { resolveAppUrl } from "./app-url";

describe("application URL resolution", () => {
  it("uses an explicitly configured URL first", () => {
    expect(
      resolveAppUrl({
        NEXT_PUBLIC_APP_URL: "https://carebridge.example/path",
        VERCEL_PROJECT_PRODUCTION_URL: "fallback.vercel.app",
      }),
    ).toBe("https://carebridge.example");
  });

  it("uses the official Vercel production domain", () => {
    expect(
      resolveAppUrl({
        VERCEL_PROJECT_PRODUCTION_URL: "self-improving-system.vercel.app",
      }),
    ).toBe("https://self-improving-system.vercel.app");
  });

  it("uses the deployment domain as a final fallback", () => {
    expect(resolveAppUrl({ VERCEL_URL: "preview.vercel.app" })).toBe(
      "https://preview.vercel.app",
    );
  });

  it("returns null outside a configured environment", () => {
    expect(resolveAppUrl({})).toBeNull();
  });
});
