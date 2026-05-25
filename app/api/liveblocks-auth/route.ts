import { getLiveblocksServerClient } from "@/lib/liveblocks-server";
import { getKanbanBoardAccess, toLiveblocksUserInfo } from "@/lib/kanban-collaboration";
import { parseKanbanRoomId } from "@/lib/collaboration";
import { syncUser } from "@/lib/actions/sync-user";

export async function POST(request: Request) {
  const user = await syncUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { room } = (await request.json()) as { room?: string };

  if (!room) {
    return new Response("Missing room", { status: 400 });
  }

  const parsedRoom = parseKanbanRoomId(room);

  if (!parsedRoom) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    await getKanbanBoardAccess(parsedRoom.boardId, user.id);

    const session = getLiveblocksServerClient().prepareSession(String(user.id), {
      userInfo: toLiveblocksUserInfo(user),
    });

    session.allow(room, session.FULL_ACCESS);

    const { status, body } = await session.authorize();

    return new Response(body, { status });
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
}
