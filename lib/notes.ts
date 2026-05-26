export const EMPTY_NOTE_CONTENT = {
  type: "doc",
  content: [],
};

export const NOTE_COLORS = [
  {
    value: "#EAB308",
    label: "Amber",
    bg: "#FEFCE8",
    border: "#FEF08A",
  },
  {
    value: "#8B5CF6",
    label: "Violet",
    bg: "#F5F3FF",
    border: "#DDD6FE",
  },
  {
    value: "#06B6D4",
    label: "Cyan",
    bg: "#ECFEFF",
    border: "#A5F3FC",
  },
  {
    value: "#10B981",
    label: "Emerald",
    bg: "#ECFDF5",
    border: "#A7F3D0",
  },
  {
    value: "#EC4899",
    label: "Pink",
    bg: "#FDF2F8",
    border: "#FBCFE8",
  },
  {
    value: "#F97316",
    label: "Orange",
    bg: "#FFF7ED",
    border: "#FED7AA",
  },
  {
    value: "#3B82F6",
    label: "Blue",
    bg: "#EFF6FF",
    border: "#BFDBFE",
  },
] as const;

export const AI_REFINE_ACTIONS = [
  "improve-grammar",
  "rephrase",
  "make-shorter",
  "make-longer",
  "simplify-language",
  "change-tone",
] as const;

export type NoteColor = (typeof NOTE_COLORS)[number]["value"];
export type AiRefineAction = (typeof AI_REFINE_ACTIONS)[number];

export type NoteContent = {
  type: string;
  content?: unknown[];
  [key: string]: unknown;
};

export type NoteRecord = {
  id: number;
  title: string;
  content: NoteContent;
  plainText: string | null;
  color: NoteColor;
  category: string;
  isPinned: boolean;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NoteUpdateInput = {
  title?: string | null;
  content?: NoteContent | null;
  plainText?: string | null;
  category?: string | null;
};

export function getNoteColorMeta(color: string) {
  return NOTE_COLORS.find((option) => option.value === color) ?? NOTE_COLORS[0];
}
