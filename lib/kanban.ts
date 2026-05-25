export const MAX_KANBAN_COLUMNS = 5;

export const DEFAULT_KANBAN_COLUMNS = ["Todo", "In Progress", "Done"] as const;

export const KANBAN_PRIORITIES = ["Low", "Medium", "High"] as const;

export const KANBAN_BOARD_COLORS = [
  "#F97316",
  "#8B5CF6",
  "#06B6D4",
  "#10B981",
  "#EC4899",
  "#EAB308",
  "#3B82F6",
] as const;

export const KANBAN_LABELS = [
  {
    id: "design",
    label: "Design",
    color: "#EC4899",
    bg: "#FDF2F8",
    border: "#FBCFE8",
  },
  {
    id: "planning",
    label: "Planning",
    color: "#8B5CF6",
    bg: "#F5F3FF",
    border: "#DDD6FE",
  },
  {
    id: "focus",
    label: "Focus",
    color: "#10B981",
    bg: "#ECFDF5",
    border: "#A7F3D0",
  },
  {
    id: "urgent",
    label: "Urgent",
    color: "#F97316",
    bg: "#FFF7ED",
    border: "#FED7AA",
  },
  {
    id: "research",
    label: "Research",
    color: "#06B6D4",
    bg: "#ECFEFF",
    border: "#A5F3FC",
  },
  {
    id: "personal",
    label: "Personal",
    color: "#EAB308",
    bg: "#FEFCE8",
    border: "#FEF08A",
  },
] as const;

export type KanbanPriority = (typeof KANBAN_PRIORITIES)[number];
export type KanbanLabelId = (typeof KANBAN_LABELS)[number]["id"];

export type KanbanTaskRecord = {
  id: number;
  boardId: number;
  columnId: number;
  calendarItemId: number | null;
  title: string;
  description: string | null;
  dueDate: string;
  priority: KanbanPriority;
  labelIds: KanbanLabelId[];
  position: number;
  syncToCalendar: boolean;
  linkedToNotes: boolean;
  createdAt: string;
  updatedAt: string;
};

export type KanbanColumnRecord = {
  id: number;
  boardId: number;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  tasks: KanbanTaskRecord[];
};

export type KanbanBoardRecord = {
  id: number;
  name: string;
  color: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  columns: KanbanColumnRecord[];
};

export type KanbanBoardFormInput = {
  name: string;
  color: string;
};

export type KanbanColumnFormInput = {
  boardId: number;
  name: string;
};

export type KanbanTaskFormInput = {
  columnId: number;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority: KanbanPriority;
  labelIds: string[];
  syncToCalendar: boolean;
  linkedToNotes: boolean;
};

export type KanbanMoveColumnPayload = {
  columnId: number;
  taskIds: number[];
};

export function getKanbanLabelMeta(labelId: string) {
  return KANBAN_LABELS.find((label) => label.id === labelId);
}

export function getPriorityMeta(priority: string) {
  if (priority === "High") {
    return {
      label: "High",
      color: "#EF4444",
      bg: "#FEF2F2",
      border: "#FECACA",
    };
  }

  if (priority === "Medium") {
    return {
      label: "Medium",
      color: "#F97316",
      bg: "#FFF7ED",
      border: "#FED7AA",
    };
  }

  return {
    label: "Low",
    color: "#10B981",
    bg: "#ECFDF5",
    border: "#A7F3D0",
  };
}
