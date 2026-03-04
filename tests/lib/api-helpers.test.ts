/// <reference types="vitest" />

import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { ApiError, ensurePermissions } from "@/lib/api-helpers";

describe("ensurePermissions", () => {
  it("throws ApiError when the user lacks a required permission", () => {
    const session = {
      user: {
        permissions: ["VIEW_DASHBOARD"],
      },
    } as unknown as Session;

    expect(() => ensurePermissions(session, ["MANAGE_SALES"])).toThrowError(
      new ApiError(403, "Forbidden"),
    );
  });

  it("allows execution when permission is present", () => {
    const session = {
      user: {
        permissions: ["MANAGE_SALES"],
      },
    } as unknown as Session;

    expect(() => ensurePermissions(session, ["MANAGE_SALES"])).not.toThrow();
  });
});
