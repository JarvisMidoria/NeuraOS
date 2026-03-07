export type WorkspaceMode = "LIVE" | "SIMULATION";

export const WORKSPACE_COOKIE = "neura_workspace_mode";

export function normalizeWorkspaceMode(value: string | null | undefined): WorkspaceMode {
  return value === "SIMULATION" ? "SIMULATION" : "LIVE";
}
