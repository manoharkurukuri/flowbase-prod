import { Liveblocks } from "@liveblocks/node";
import { getKanbanRoomId } from "@/lib/collaboration";

let liveblocksClient: Liveblocks | null = null;

export function getLiveblocksServerClient() {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;

  if (!secret) {
    throw new Error("LIVEBLOCKS_SECRET_KEY is not configured.");
  }

  if (!liveblocksClient) {
    liveblocksClient = new Liveblocks({ secret });
  }

  return liveblocksClient;
}

export async function broadcastKanbanBoardChanged(
  boardId: number,
  actorId: number,
  mutation: string
) {
  if (!process.env.LIVEBLOCKS_SECRET_KEY) {
    return;
  }

  try {
    await getLiveblocksServerClient().broadcastEvent(getKanbanRoomId(boardId), {
      type: "KANBAN_BOARD_CHANGED",
      boardId,
      actorId: String(actorId),
      mutation,
      timestamp: Date.now(),
    });
  } catch {
    // Realtime refresh should not block the durable Postgres mutation.
  }
}

export async function broadcastKanbanMembersChanged(boardId: number, actorId: number) {
  if (!process.env.LIVEBLOCKS_SECRET_KEY) {
    return;
  }

  try {
    await getLiveblocksServerClient().broadcastEvent(getKanbanRoomId(boardId), {
      type: "KANBAN_MEMBERS_CHANGED",
      boardId,
      actorId: String(actorId),
      timestamp: Date.now(),
    });
  } catch {
    // Membership is already persisted; Liveblocks events are best-effort hints.
  }
}
