import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  collaborationMembers,
  kanbanBoards,
  users,
  type CollaborationMember,
  type KanbanBoard,
  type User,
} from "@/db/schema";
import {
  KANBAN_RESOURCE_TYPE,
  getAvatarColor,
  getInitials,
  getKanbanRoomId,
  isValidCollaborationEmail,
  normalizeCollaborationEmail,
  type CollaborationMemberRecord,
  type CollaborationRole,
  type CollaborationSummaryRecord,
} from "@/lib/collaboration";

export type KanbanBoardAccess = {
  board: KanbanBoard;
  role: CollaborationRole;
  member: CollaborationMember;
};

export function toLiveblocksUserInfo(user: Pick<User, "id" | "name" | "email">) {
  const name = user.name || user.email;

  return {
    name,
    email: user.email,
    avatar: "",
    initials: getInitials(name, user.email),
    color: getAvatarColor(user.id),
  };
}

function normalizeRole(role: string): CollaborationRole {
  return role === "owner" ? "owner" : "editor";
}

function toMemberRecord(
  member: CollaborationMember,
  userById: Map<number, Pick<User, "id" | "name" | "email">>
): CollaborationMemberRecord {
  const linkedUser = member.userId ? userById.get(member.userId) : null;
  const name = linkedUser?.name ?? null;
  const email = linkedUser?.email ?? member.email;

  return {
    id: member.id,
    userId: member.userId,
    email,
    name,
    role: normalizeRole(member.role),
    status: member.acceptedAt ? "active" : "pending",
    initials: getInitials(name, email),
    avatarColor: getAvatarColor(member.userId ?? email),
    invitedByUserId: member.invitedByUserId,
    acceptedAt: member.acceptedAt?.toISOString() ?? null,
    createdAt: member.createdAt.toISOString(),
  };
}

export async function ensureKanbanOwnerMembership(board: KanbanBoard, owner: User) {
  const email = normalizeCollaborationEmail(owner.email);
  const now = new Date();

  await db
    .insert(collaborationMembers)
    .values({
      resourceType: KANBAN_RESOURCE_TYPE,
      resourceId: board.id,
      userId: owner.id,
      email,
      role: "owner",
      invitedByUserId: owner.id,
      acceptedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        collaborationMembers.resourceType,
        collaborationMembers.resourceId,
        collaborationMembers.email,
      ],
      set: {
        userId: owner.id,
        role: "owner",
        acceptedAt: now,
        updatedAt: now,
      },
    });
}

export async function acceptPendingCollaborationsForUser(user: User) {
  const email = normalizeCollaborationEmail(user.email);

  await db
    .update(collaborationMembers)
    .set({
      userId: user.id,
      acceptedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(collaborationMembers.email, email), isNull(collaborationMembers.userId)));
}

export async function getKanbanBoardAccess(boardId: number, userId: number) {
  const board = await db.query.kanbanBoards.findFirst({
    where: eq(kanbanBoards.id, boardId),
  });

  if (!board) {
    throw new Error("Kanban board not found.");
  }

  const member = await db.query.collaborationMembers.findFirst({
    where: and(
      eq(collaborationMembers.resourceType, KANBAN_RESOURCE_TYPE),
      eq(collaborationMembers.resourceId, boardId),
      eq(collaborationMembers.userId, userId)
    ),
  });

  if (member) {
    return { board, role: normalizeRole(member.role), member };
  }

  if (board.userId === userId) {
    const owner = await db.query.users.findFirst({ where: eq(users.id, userId) });

    if (owner) {
      await ensureKanbanOwnerMembership(board, owner);
      const fallbackMember = await db.query.collaborationMembers.findFirst({
        where: and(
          eq(collaborationMembers.resourceType, KANBAN_RESOURCE_TYPE),
          eq(collaborationMembers.resourceId, boardId),
          eq(collaborationMembers.userId, userId)
        ),
      });

      if (fallbackMember) {
        return { board, role: "owner" as const, member: fallbackMember };
      }
    }
  }

  throw new Error("Kanban board not found.");
}

export async function assertKanbanEditor(boardId: number, userId: number) {
  return getKanbanBoardAccess(boardId, userId);
}

export async function assertKanbanOwner(boardId: number, userId: number) {
  const access = await getKanbanBoardAccess(boardId, userId);

  if (access.role !== "owner") {
    throw new Error("Only the board owner can manage collaboration.");
  }

  return access;
}

export async function listKanbanBoardCollaborators(
  boardId: number,
  viewerUserId: number
): Promise<CollaborationSummaryRecord> {
  await getKanbanBoardAccess(boardId, viewerUserId);

  const members = await db
    .select()
    .from(collaborationMembers)
    .where(
      and(
        eq(collaborationMembers.resourceType, KANBAN_RESOURCE_TYPE),
        eq(collaborationMembers.resourceId, boardId)
      )
    )
    .orderBy(desc(collaborationMembers.role), asc(collaborationMembers.createdAt));

  const userIds = members
    .map((member) => member.userId)
    .filter((id): id is number => Boolean(id));
  const linkedUsers =
    userIds.length > 0
      ? await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];
  const usersById = new Map(linkedUsers.map((user) => [user.id, user]));

  return {
    boardId,
    members: members.map((member) => toMemberRecord(member, usersById)),
  };
}

export async function inviteKanbanCollaboratorByEmail(
  boardId: number,
  inviter: User,
  emailInput: string
) {
  await assertKanbanOwner(boardId, inviter.id);

  const email = normalizeCollaborationEmail(emailInput);

  if (!isValidCollaborationEmail(email)) {
    throw new Error("Add a valid email address.");
  }

  const existingMember = await db.query.collaborationMembers.findFirst({
    where: and(
      eq(collaborationMembers.resourceType, KANBAN_RESOURCE_TYPE),
      eq(collaborationMembers.resourceId, boardId),
      eq(collaborationMembers.email, email)
    ),
  });

  if (existingMember) {
    throw new Error("That email already has access to this board.");
  }

  const targetUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  const now = new Date();

  await db.insert(collaborationMembers).values({
    resourceType: KANBAN_RESOURCE_TYPE,
    resourceId: boardId,
    userId: targetUser?.id ?? null,
    email,
    role: "editor",
    invitedByUserId: inviter.id,
    acceptedAt: targetUser ? now : null,
    createdAt: now,
    updatedAt: now,
  });

  return listKanbanBoardCollaborators(boardId, inviter.id);
}

export function toKanbanBoardRoomMetadata(board: KanbanBoard, role: CollaborationRole) {
  return {
    role,
    roomId: getKanbanRoomId(board.id),
  };
}
