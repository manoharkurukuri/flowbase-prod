export const KANBAN_RESOURCE_TYPE = "kanban_board";
export const KANBAN_ROOM_PREFIX = "flowbase:kanban-board:";

export const COLLABORATION_ROLES = ["owner", "editor"] as const;

export type CollaborationRole = (typeof COLLABORATION_ROLES)[number];

export type CollaborationMemberRecord = {
  id: number;
  userId: number | null;
  email: string;
  name: string | null;
  role: CollaborationRole;
  status: "active" | "pending";
  initials: string;
  avatarColor: string;
  invitedByUserId: number | null;
  acceptedAt: string | null;
  createdAt: string;
};

export type CollaborationSummaryRecord = {
  boardId: number;
  members: CollaborationMemberRecord[];
};

const avatarColors = [
  "#F97316",
  "#8B5CF6",
  "#06B6D4",
  "#10B981",
  "#EC4899",
  "#EAB308",
  "#3B82F6",
  "#EF4444",
];

export function getKanbanRoomId(boardId: number) {
  return `${KANBAN_ROOM_PREFIX}${boardId}`;
}

export function parseKanbanRoomId(roomId: string) {
  if (!roomId.startsWith(KANBAN_ROOM_PREFIX)) {
    return null;
  }

  const boardId = Number(roomId.slice(KANBAN_ROOM_PREFIX.length));

  if (!Number.isInteger(boardId) || boardId <= 0) {
    return null;
  }

  return { boardId };
}

export function normalizeCollaborationEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidCollaborationEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeCollaborationEmail(email));
}

export function getInitials(name: string | null | undefined, email: string | null | undefined) {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2);

  return (parts.map((part) => part[0]).join("") || "?").toUpperCase();
}

export function getAvatarColor(seed: string | number | null | undefined) {
  const value = String(seed ?? "flowbase");
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % avatarColors.length;
  }

  return avatarColors[Math.abs(hash) % avatarColors.length];
}
