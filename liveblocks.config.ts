import {
  getAvatarColor,
  getInitials,
  type CollaborationRole,
} from "@/lib/collaboration";

export type KanbanPresence = {
  mode: "viewing" | "commenting";
  activeTaskId: number | null;
  status: string | null;
};

export type KanbanUserInfo = {
  name: string;
  email: string;
  avatar: string;
  initials: string;
  color: string;
};

export type KanbanRoomEvent =
  | {
      type: "KANBAN_BOARD_CHANGED";
      boardId: number;
      actorId: string;
      mutation: string;
      timestamp: number;
    }
  | {
      type: "KANBAN_MEMBERS_CHANGED";
      boardId: number;
      actorId: string;
      timestamp: number;
    };

export type KanbanThreadMetadata = {
  kind: "kanban-task";
  boardId: number;
  taskId: number;
};

declare global {
  interface Liveblocks {
    Presence: KanbanPresence;
    UserMeta: {
      id: string;
      info: KanbanUserInfo;
    };
    RoomEvent: KanbanRoomEvent;
    ThreadMetadata: KanbanThreadMetadata;
  }
}

export async function resolveLiveblocksUsers({ userIds }: { userIds: string[] }) {
  const response = await fetch("/api/liveblocks-users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userIds }),
  });

  if (!response.ok) {
    return userIds.map((userId) => ({
      name: "Collaborator",
      email: "",
      avatar: "",
      initials: getInitials(null, userId),
      color: getAvatarColor(userId),
    }));
  }

  return (await response.json()) as KanbanUserInfo[];
}

export type { CollaborationRole };

export {};
