import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { extractBearer } from "../server/auth";

function req(authorization?: string): Request {
  return { headers: { authorization } } as Request;
}

describe("extractBearer", () => {
  it("returns null when header missing", () => {
    expect(extractBearer(req())).toBeNull();
    expect(extractBearer(req(undefined))).toBeNull();
  });

  it("parses Bearer token (case-insensitive scheme)", () => {
    expect(extractBearer(req("Bearer abc.def.ghi"))).toBe("abc.def.ghi");
    expect(extractBearer(req("bearer tok"))).toBe("tok");
    expect(extractBearer(req("  Bearer  spaced  "))).toBe("spaced");
  });

  it("returns null for malformed Authorization", () => {
    expect(extractBearer(req("Basic xxx"))).toBeNull();
    expect(extractBearer(req("Bearer"))).toBeNull();
  });
});
