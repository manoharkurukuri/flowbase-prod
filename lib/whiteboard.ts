export type WhiteboardScene = {
  type: string;
  version?: number;
  source?: string;
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
};

export type WhiteboardRecord = {
  id: number;
  name: string;
  color: WhiteboardColor;
  scene: WhiteboardScene;
  createdAt: string;
  updatedAt: string;
};

export const EMPTY_WHITEBOARD_SCENE: WhiteboardScene = {
  type: "excalidraw",
  version: 2,
  source: "flowbase",
  elements: [],
  appState: {
    viewBackgroundColor: "#FFFDF7",
  },
  files: {},
};

export const WHITEBOARD_COLORS = [
  { value: "#EC4899", label: "Pink", bg: "#FDF2F8", border: "#FBCFE8" },
  { value: "#8B5CF6", label: "Violet", bg: "#F5F3FF", border: "#DDD6FE" },
  { value: "#3B82F6", label: "Blue", bg: "#EFF6FF", border: "#BFDBFE" },
  { value: "#06B6D4", label: "Cyan", bg: "#ECFEFF", border: "#A5F3FC" },
  { value: "#10B981", label: "Emerald", bg: "#ECFDF5", border: "#A7F3D0" },
  { value: "#F97316", label: "Orange", bg: "#FFF7ED", border: "#FED7AA" },
  { value: "#EAB308", label: "Amber", bg: "#FEFCE8", border: "#FEF08A" },
] as const;

export const STICKY_NOTE_COLORS = [
  { value: "#FEF08A", label: "Lemon", text: "#713F12", border: "#FDE047" },
  { value: "#FBCFE8", label: "Rose", text: "#831843", border: "#F9A8D4" },
  { value: "#DDD6FE", label: "Lavender", text: "#4C1D95", border: "#C4B5FD" },
  { value: "#BAE6FD", label: "Sky", text: "#075985", border: "#7DD3FC" },
  { value: "#BBF7D0", label: "Mint", text: "#14532D", border: "#86EFAC" },
  { value: "#FED7AA", label: "Peach", text: "#7C2D12", border: "#FDBA74" },
] as const;

export type WhiteboardColor = (typeof WHITEBOARD_COLORS)[number]["value"];
export type StickyNoteColor = (typeof STICKY_NOTE_COLORS)[number]["value"];

export function getWhiteboardColorMeta(color: string) {
  return WHITEBOARD_COLORS.find((option) => option.value === color) ?? WHITEBOARD_COLORS[0];
}

export function getStickyNoteColorMeta(color: string) {
  return STICKY_NOTE_COLORS.find((option) => option.value === color) ?? STICKY_NOTE_COLORS[0];
}
