import { describe, expect, it } from "vitest";
import { normalizeWorkspaceMode } from "@/lib/workspace-mode";

describe("normalizeWorkspaceMode", () => {
  it("keeps SIMULATION when requested", () => {
    expect(normalizeWorkspaceMode("SIMULATION")).toBe("SIMULATION");
  });

  it("defaults to LIVE for invalid or empty values", () => {
    expect(normalizeWorkspaceMode("simulation")).toBe("LIVE");
    expect(normalizeWorkspaceMode("UNKNOWN")).toBe("LIVE");
    expect(normalizeWorkspaceMode(undefined)).toBe("LIVE");
    expect(normalizeWorkspaceMode(null)).toBe("LIVE");
  });
});
