import { describe, expect, it } from "vitest";
import { buildProfileSearchOrFilter, escapeIlikePattern, normalizeAdminSearchQuery } from "../server/admin-search.js";

describe("admin-search", () => {
  it("escapes ilike wildcards", () => {
    expect(escapeIlikePattern("50%_off")).toBe("50\\%\\_off");
  });

  it("normalizes search query with minimum length", () => {
    expect(normalizeAdminSearchQuery("a")).toBeNull();
    expect(normalizeAdminSearchQuery("  jo  ")).toBe("jo");
    expect(normalizeAdminSearchQuery("x".repeat(200))?.length).toBe(120);
  });

  it("normalizes array query params", () => {
    expect(normalizeAdminSearchQuery(["  jo  "])).toBe("jo");
  });

  it("quotes profile search or filter for PostgREST", () => {
    expect(buildProfileSearchOrFilter("gmail.com")).toBe(
      'email.ilike."%gmail.com%",full_name.ilike."%gmail.com%"'
    );
    expect(buildProfileSearchOrFilter('say "hi"')).toBe(
      'email.ilike."%say ""hi""%",full_name.ilike."%say ""hi""%"'
    );
  });
});
