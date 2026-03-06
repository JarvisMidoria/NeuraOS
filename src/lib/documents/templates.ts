import type { DocumentTemplateId } from "@/lib/documents/types";

export type TemplatePalette = {
  id: DocumentTemplateId;
  name: string;
  background: [number, number, number];
  ink: [number, number, number];
  muted: [number, number, number];
  accent: [number, number, number];
  border: [number, number, number];
};

export const TEMPLATE_PALETTES: Record<DocumentTemplateId, TemplatePalette> = {
  clean: {
    id: "clean",
    name: "Clean",
    background: [1, 1, 1],
    ink: [0.05, 0.07, 0.11],
    muted: [0.44, 0.48, 0.55],
    accent: [0.2, 0.33, 0.85],
    border: [0.85, 0.87, 0.91],
  },
  compact: {
    id: "compact",
    name: "Compact",
    background: [0.98, 0.99, 1],
    ink: [0.08, 0.1, 0.15],
    muted: [0.38, 0.42, 0.5],
    accent: [0.0, 0.55, 0.45],
    border: [0.78, 0.82, 0.88],
  },
};

export function normalizeTemplateId(input: string | null | undefined): DocumentTemplateId {
  if (input === "compact") return "compact";
  return "clean";
}
