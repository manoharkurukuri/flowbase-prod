import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAvatarColor, getInitials } from "@/lib/collaboration";
import { toLiveblocksUserInfo } from "@/lib/kanban-collaboration";
import { syncUser } from "@/lib/actions/sync-user";

export async function POST(request: Request) {
  const viewer = await syncUser();

  if (!viewer) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { userIds } = (await request.json()) as { userIds?: string[] };
  const requestedIds = Array.isArray(userIds) ? userIds.slice(0, 50) : [];
  const numericIds = requestedIds
    .map((userId) => Number(userId))
    .filter((userId) => Number.isInteger(userId) && userId > 0);

  const records =
    numericIds.length > 0
      ? await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(inArray(users.id, numericIds))
      : [];
  const usersById = new Map(records.map((user) => [String(user.id), user]));

  return Response.json(
    requestedIds.map((userId) => {
      const user = usersById.get(userId);

      if (user) {
        return toLiveblocksUserInfo(user);
      }

      return {
        name: "Collaborator",
        email: "",
        avatar: "",
        initials: getInitials(null, userId),
        color: getAvatarColor(userId),
      };
    })
  );
}
