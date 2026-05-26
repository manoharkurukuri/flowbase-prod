"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import {
  collaborationMembers,
  pageComments,
  pageTaskLinks,
  pages,
  spaces,
  users,
  type CollaborationMember,
  type Page,
  type Space,
  type User,
} from "@/db/schema";
import { syncUser } from "@/lib/actions/sync-user";
import {
  getAvatarColor,
  getInitials,
  isValidCollaborationEmail,
  normalizeCollaborationEmail,
} from "@/lib/collaboration";
import {
  EMPTY_PAGE_CONTENT,
  PAGE_TEMPLATES,
  SPACE_COLORS,
  SPACE_RESOURCE_TYPE,
  getTemplatePlainText,
  getTemplateStarterContent,
  type MemberAvatarRecord,
  type PageContent,
  type PageDetailRecord,
  type PageFormInput,
  type PageListRecord,
  type PageTemplateId,
  type PageUpdateInput,
  type PageUserRecord,
  type SpaceColor,
  type SpaceDetailRecord,
  type SpaceFormInput,
  type SpaceSummaryRecord,
} from "@/lib/pages";

const SPACE_COLOR_VALUES = SPACE_COLORS.map((color) => color.value);
const PAGE_TEMPLATE_VALUES = PAGE_TEMPLATES.map((template) => template.id);

async function getAppUser(required = true) {
  const user = await syncUser();

  if (!user && required) {
    throw new Error("You need to be signed in to manage pages and spaces.");
  }

  return user;
}

function cleanText(value: string | null | undefined, maxLength: number) {
  const text = value?.trim() ?? "";
  return text ? text.slice(0, maxLength) : null;
}

function requireText(value: string | null | undefined, maxLength: number, message: string) {
  const text = cleanText(value, maxLength);

  if (!text) {
    throw new Error(message);
  }

  return text;
}

function normalizeSpaceColor(color: string | null | undefined): SpaceColor {
  if (SPACE_COLOR_VALUES.includes(color as SpaceColor)) {
    return color as SpaceColor;
  }

  return SPACE_COLORS[0].value;
}

function normalizeTemplate(template: string | null | undefined): PageTemplateId {
  if (PAGE_TEMPLATE_VALUES.includes(template as PageTemplateId)) {
    return template as PageTemplateId;
  }

  return "blank";
}

function normalizeContent(content: PageContent | null | undefined): PageContent {
  if (!content || typeof content !== "object" || content.type !== "doc") {
    return { ...EMPTY_PAGE_CONTENT };
  }

  const serialized = JSON.stringify(content);
  if (serialized.length > 900_000) {
    throw new Error("This page is too large to save.");
  }

  return content;
}

function normalizeRole(role: string): "owner" | "editor" {
  return role === "owner" ? "owner" : "editor";
}

function toIso(date: Date | null | undefined) {
  return date?.toISOString() ?? null;
}

function newestDate(...dates: (Date | null | undefined)[]) {
  return dates.reduce<Date | null>((latest, date) => {
    if (!date) return latest;
    if (!latest || date.getTime() > latest.getTime()) return date;
    return latest;
  }, null);
}

function toPageUserRecord(user: Pick<User, "id" | "name" | "email">): PageUserRecord {
  const name = user.name || user.email;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    initials: getInitials(name, user.email),
    avatarColor: getAvatarColor(user.id),
  };
}

function toMemberRecord(
  member: CollaborationMember,
  userById: Map<number, Pick<User, "id" | "name" | "email">>
): MemberAvatarRecord {
  const linkedUser = member.userId ? userById.get(member.userId) : null;
  const name = linkedUser?.name ?? null;
  const email = linkedUser?.email ?? member.email;

  return {
    id: member.id,
    userId: member.userId,
    name,
    email,
    role: normalizeRole(member.role),
    initials: getInitials(name, email),
    avatarColor: getAvatarColor(member.userId ?? email),
  };
}

function toOwnerFallbackMember(owner: Pick<User, "id" | "name" | "email">): MemberAvatarRecord {
  return {
    id: -owner.id,
    userId: owner.id,
    name: owner.name,
    email: owner.email,
    role: "owner",
    initials: getInitials(owner.name, owner.email),
    avatarColor: getAvatarColor(owner.id),
  };
}

async function ensureSpaceOwnerMembership(space: Space, owner: User) {
  const email = normalizeCollaborationEmail(owner.email);
  const now = new Date();

  await db
    .insert(collaborationMembers)
    .values({
      resourceType: SPACE_RESOURCE_TYPE,
      resourceId: space.id,
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

async function getSpaceAccess(spaceId: number, userId: number) {
  const space = await db.query.spaces.findFirst({
    where: eq(spaces.id, spaceId),
  });

  if (!space) {
    throw new Error("Space not found.");
  }

  const member = await db.query.collaborationMembers.findFirst({
    where: and(
      eq(collaborationMembers.resourceType, SPACE_RESOURCE_TYPE),
      eq(collaborationMembers.resourceId, spaceId),
      eq(collaborationMembers.userId, userId)
    ),
  });

  if (member) {
    return { space, role: normalizeRole(member.role), member };
  }

  if (space.userId === userId) {
    const owner = await db.query.users.findFirst({ where: eq(users.id, userId) });

    if (owner) {
      await ensureSpaceOwnerMembership(space, owner);
      const fallbackMember = await db.query.collaborationMembers.findFirst({
        where: and(
          eq(collaborationMembers.resourceType, SPACE_RESOURCE_TYPE),
          eq(collaborationMembers.resourceId, spaceId),
          eq(collaborationMembers.userId, userId)
        ),
      });

      if (fallbackMember) {
        return { space, role: "owner" as const, member: fallbackMember };
      }
    }
  }

  throw new Error("Space not found.");
}

async function assertSpaceOwner(spaceId: number, userId: number) {
  const access = await getSpaceAccess(spaceId, userId);

  if (access.role !== "owner") {
    throw new Error("Only the space owner can manage this space.");
  }

  return access;
}

async function assertPageAccess(pageId: number, userId: number) {
  const page = await db.query.pages.findFirst({
    where: eq(pages.id, pageId),
  });

  if (!page) {
    throw new Error("Page not found.");
  }

  const access = await getSpaceAccess(page.spaceId, userId);
  return { page, space: access.space, role: access.role };
}

async function getUsersById(userIds: number[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return new Map<number, Pick<User, "id" | "name" | "email">>();
  }

  const records = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(inArray(users.id, uniqueIds));

  return new Map(records.map((user) => [user.id, user]));
}

async function getMembersBySpaceId(spaceIds: number[]) {
  const uniqueIds = Array.from(new Set(spaceIds));

  if (uniqueIds.length === 0) {
    return new Map<number, MemberAvatarRecord[]>();
  }

  const members = await db
    .select()
    .from(collaborationMembers)
    .where(
      and(
        eq(collaborationMembers.resourceType, SPACE_RESOURCE_TYPE),
        inArray(collaborationMembers.resourceId, uniqueIds)
      )
    )
    .orderBy(desc(collaborationMembers.role), asc(collaborationMembers.createdAt));

  const userById = await getUsersById(
    members.map((member) => member.userId).filter((id): id is number => Boolean(id))
  );
  const bySpaceId = new Map<number, MemberAvatarRecord[]>();

  for (const member of members) {
    const current = bySpaceId.get(member.resourceId) ?? [];
    current.push(toMemberRecord(member, userById));
    bySpaceId.set(member.resourceId, current);
  }

  return bySpaceId;
}

async function getPageStats(pageIds: number[]) {
  const uniqueIds = Array.from(new Set(pageIds));
  const commentsCountByPageId = new Map<number, number>();
  const linkedTasksCountByPageId = new Map<number, number>();

  if (uniqueIds.length === 0) {
    return { commentsCountByPageId, linkedTasksCountByPageId };
  }

  const [comments, taskLinks] = await Promise.all([
    db.select({ pageId: pageComments.pageId }).from(pageComments).where(inArray(pageComments.pageId, uniqueIds)),
    db.select({ pageId: pageTaskLinks.pageId }).from(pageTaskLinks).where(inArray(pageTaskLinks.pageId, uniqueIds)),
  ]);

  for (const comment of comments) {
    commentsCountByPageId.set(comment.pageId, (commentsCountByPageId.get(comment.pageId) ?? 0) + 1);
  }

  for (const link of taskLinks) {
    linkedTasksCountByPageId.set(
      link.pageId,
      (linkedTasksCountByPageId.get(link.pageId) ?? 0) + 1
    );
  }

  return { commentsCountByPageId, linkedTasksCountByPageId };
}

function toSpaceSummary(
  space: Space,
  pageRecords: Page[],
  members: MemberAvatarRecord[],
  role: "owner" | "editor"
): SpaceSummaryRecord {
  const activePages = pageRecords.filter((page) => !page.archivedAt);
  const latestPageDate = newestDate(...activePages.map((page) => page.updatedAt));
  const updatedAt = newestDate(space.updatedAt, latestPageDate) ?? space.updatedAt;

  return {
    id: space.id,
    name: space.name,
    description: space.description,
    color: normalizeSpaceColor(space.color),
    isFavorite: space.isFavorite,
    archivedAt: toIso(space.archivedAt),
    lastOpenedAt: toIso(space.lastOpenedAt),
    createdAt: space.createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    pageCount: activePages.length,
    pageSearchText: activePages.map((page) => `${page.name} ${page.description ?? ""}`).join(" "),
    members,
    role,
  };
}

function toPageRecord(
  page: Page,
  updatedBy: PageUserRecord | null,
  commentsCount: number,
  linkedTasksCount: number
): PageListRecord {
  return {
    id: page.id,
    spaceId: page.spaceId,
    userId: page.userId,
    name: page.name,
    description: page.description,
    template: normalizeTemplate(page.template),
    isFavorite: page.isFavorite,
    archivedAt: toIso(page.archivedAt),
    lastOpenedAt: toIso(page.lastOpenedAt),
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
    updatedBy,
    commentsCount,
    linkedTasksCount,
  };
}

async function buildSpaceSummaries(
  spaceRows: Space[],
  viewerUserId: number,
  pagesBySpaceId?: Map<number, Page[]>
) {
  const spaceIds = spaceRows.map((space) => space.id);
  const membersBySpaceId = await getMembersBySpaceId(spaceIds);
  const ownerById = await getUsersById(spaceRows.map((space) => space.userId));
  const memberships = await db
    .select()
    .from(collaborationMembers)
    .where(
      and(
        eq(collaborationMembers.resourceType, SPACE_RESOURCE_TYPE),
        eq(collaborationMembers.userId, viewerUserId)
      )
    );
  const roleBySpaceId = new Map(
    memberships.map((member) => [member.resourceId, normalizeRole(member.role)])
  );
  const pageMap = pagesBySpaceId ?? new Map<number, Page[]>();

  return spaceRows.map((space) => {
    const role = space.userId === viewerUserId ? "owner" : roleBySpaceId.get(space.id) ?? "editor";
    const members = [...(membersBySpaceId.get(space.id) ?? [])];
    const owner = ownerById.get(space.userId);
    const hasOwnerMember = members.some(
      (member) => member.role === "owner" || member.userId === space.userId
    );

    if (owner && !hasOwnerMember) {
      members.unshift(toOwnerFallbackMember(owner));
    }

    return toSpaceSummary(space, pageMap.get(space.id) ?? [], members, role);
  });
}

export async function fetchSpaces() {
  const user = await getAppUser(false);

  if (!user) {
    return [];
  }

  const memberships = await db
    .select()
    .from(collaborationMembers)
    .where(
      and(
        eq(collaborationMembers.resourceType, SPACE_RESOURCE_TYPE),
        eq(collaborationMembers.userId, user.id)
      )
    );
  const memberSpaceIds = memberships.map((member) => member.resourceId);
  const where =
    memberSpaceIds.length > 0
      ? or(eq(spaces.userId, user.id), inArray(spaces.id, memberSpaceIds))
      : eq(spaces.userId, user.id);

  const spaceRows = await db
    .select()
    .from(spaces)
    .where(where)
    .orderBy(desc(spaces.updatedAt), desc(spaces.createdAt));

  const spaceIds = spaceRows.map((space) => space.id);
  const pageRows =
    spaceIds.length > 0
      ? await db.select().from(pages).where(inArray(pages.spaceId, spaceIds))
      : [];
  const pagesBySpaceId = new Map<number, Page[]>();

  for (const page of pageRows) {
    const current = pagesBySpaceId.get(page.spaceId) ?? [];
    current.push(page);
    pagesBySpaceId.set(page.spaceId, current);
  }

  return buildSpaceSummaries(spaceRows, user.id, pagesBySpaceId);
}

export async function fetchSpace(spaceId: number): Promise<SpaceDetailRecord> {
  const user = await getAppUser();
  const access = await getSpaceAccess(spaceId, user!.id);
  const pageRows = await db
    .select()
    .from(pages)
    .where(eq(pages.spaceId, access.space.id))
    .orderBy(desc(pages.isFavorite), desc(pages.updatedAt), desc(pages.createdAt));
  const summaries = await buildSpaceSummaries(
    [access.space],
    user!.id,
    new Map([[access.space.id, pageRows]])
  );
  const { commentsCountByPageId, linkedTasksCountByPageId } = await getPageStats(
    pageRows.map((page) => page.id)
  );
  const userById = await getUsersById(
    pageRows.map((page) => page.updatedByUserId).filter((id): id is number => Boolean(id))
  );
  const pageRecords = pageRows.map((page) => {
    const updatedBySource = page.updatedByUserId ? userById.get(page.updatedByUserId) : null;
    return toPageRecord(
      page,
      updatedBySource ? toPageUserRecord(updatedBySource) : null,
      commentsCountByPageId.get(page.id) ?? 0,
      linkedTasksCountByPageId.get(page.id) ?? 0
    );
  });

  return {
    ...summaries[0],
    pages: pageRecords,
  };
}

export async function fetchPage(spaceId: number, pageId: number): Promise<PageDetailRecord> {
  const user = await getAppUser();
  const access = await getSpaceAccess(spaceId, user!.id);
  const page = await db.query.pages.findFirst({
    where: and(eq(pages.id, pageId), eq(pages.spaceId, access.space.id)),
  });

  if (!page) {
    throw new Error("Page not found.");
  }

  const space = await fetchSpace(spaceId);
  const listRecord = space.pages.find((item) => item.id === page.id);

  if (!listRecord) {
    throw new Error("Page not found.");
  }

  return {
    ...listRecord,
    content: normalizeContent(page.content as PageContent),
    plainText: page.plainText,
    space,
  };
}

export async function createSpace(input: SpaceFormInput) {
  const user = await getAppUser();

  const [space] = await db
    .insert(spaces)
    .values({
      userId: user!.id,
      name: requireText(input.name, 90, "Spaces need a name."),
      description: cleanText(input.description, 220),
      color: normalizeSpaceColor(input.color),
      lastOpenedAt: new Date(),
    })
    .returning();

  await ensureSpaceOwnerMembership(space, user!);
  revalidatePath("/pages");

  const summaries = await fetchSpaces();
  return (
    summaries.find((item) => item.id === space.id) ??
    toSpaceSummary(space, [], [toOwnerFallbackMember(user!)], "owner")
  );
}

export async function updateSpace(spaceId: number, input: Partial<SpaceFormInput>) {
  const user = await getAppUser();
  await getSpaceAccess(spaceId, user!.id);

  const values: Partial<typeof spaces.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) {
    values.name = requireText(input.name, 90, "Spaces need a name.");
  }

  if (input.description !== undefined) {
    values.description = cleanText(input.description, 220);
  }

  if (input.color !== undefined) {
    values.color = normalizeSpaceColor(input.color);
  }

  await db.update(spaces).set(values).where(eq(spaces.id, spaceId));
  revalidatePath("/pages");
  revalidatePath(`/pages/${spaceId}`);

  return fetchSpace(spaceId);
}

export async function toggleSpaceFavorite(spaceId: number) {
  const user = await getAppUser();
  const { space } = await getSpaceAccess(spaceId, user!.id);

  await db
    .update(spaces)
    .set({
      isFavorite: !space.isFavorite,
      updatedAt: new Date(),
    })
    .where(eq(spaces.id, space.id));

  revalidatePath("/pages");
  revalidatePath(`/pages/${spaceId}`);
  return fetchSpace(spaceId);
}

export async function archiveSpace(spaceId: number, archived = true) {
  const user = await getAppUser();
  await assertSpaceOwner(spaceId, user!.id);

  await db
    .update(spaces)
    .set({
      archivedAt: archived ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(spaces.id, spaceId));

  revalidatePath("/pages");
  revalidatePath(`/pages/${spaceId}`);
  return { id: spaceId };
}

export async function deleteSpace(spaceId: number) {
  const user = await getAppUser();
  await assertSpaceOwner(spaceId, user!.id);

  await db.delete(spaces).where(eq(spaces.id, spaceId));
  revalidatePath("/pages");
  return { id: spaceId };
}

export async function duplicateSpace(spaceId: number) {
  const user = await getAppUser();
  const { space } = await getSpaceAccess(spaceId, user!.id);
  const pageRows = await db.select().from(pages).where(eq(pages.spaceId, space.id));

  const [createdSpace] = await db
    .insert(spaces)
    .values({
      userId: user!.id,
      name: `Copy of ${space.name}`.slice(0, 90),
      description: space.description,
      color: normalizeSpaceColor(space.color),
      lastOpenedAt: new Date(),
    })
    .returning();

  if (pageRows.length > 0) {
    await db.insert(pages).values(
      pageRows.map((page) => ({
        spaceId: createdSpace.id,
        userId: user!.id,
        updatedByUserId: user!.id,
        name: page.name,
        description: page.description,
        template: normalizeTemplate(page.template),
        content: normalizeContent(page.content as PageContent),
        plainText: page.plainText,
        isFavorite: false,
        archivedAt: page.archivedAt,
      }))
    );
  }

  await ensureSpaceOwnerMembership(createdSpace, user!);
  revalidatePath("/pages");
  return fetchSpace(createdSpace.id);
}

export async function inviteSpaceCollaborator(spaceId: number, emailInput: string) {
  const user = await getAppUser();
  await assertSpaceOwner(spaceId, user!.id);

  const email = normalizeCollaborationEmail(emailInput);

  if (!isValidCollaborationEmail(email)) {
    throw new Error("Add a valid email address.");
  }

  const existingMember = await db.query.collaborationMembers.findFirst({
    where: and(
      eq(collaborationMembers.resourceType, SPACE_RESOURCE_TYPE),
      eq(collaborationMembers.resourceId, spaceId),
      eq(collaborationMembers.email, email)
    ),
  });

  if (existingMember) {
    throw new Error("That email already has access to this space.");
  }

  const targetUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  const now = new Date();

  await db.insert(collaborationMembers).values({
    resourceType: SPACE_RESOURCE_TYPE,
    resourceId: spaceId,
    userId: targetUser?.id ?? null,
    email,
    role: "editor",
    invitedByUserId: user!.id,
    acceptedAt: targetUser ? now : null,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/pages");
  revalidatePath(`/pages/${spaceId}`);
  return fetchSpace(spaceId);
}

export async function recordSpaceOpened(spaceId: number) {
  const user = await getAppUser();
  await getSpaceAccess(spaceId, user!.id);

  await db
    .update(spaces)
    .set({
      lastOpenedAt: new Date(),
    })
    .where(eq(spaces.id, spaceId));

  return { id: spaceId };
}

export async function createPage(input: PageFormInput) {
  const user = await getAppUser();
  await getSpaceAccess(input.spaceId, user!.id);

  const name = requireText(input.name, 120, "Pages need a name.");
  const template = normalizeTemplate(input.template);
  const content = getTemplateStarterContent(template, name);

  const [page] = await db
    .insert(pages)
    .values({
      spaceId: input.spaceId,
      userId: user!.id,
      updatedByUserId: user!.id,
      name,
      template,
      content,
      plainText: getTemplatePlainText(template, name),
      lastOpenedAt: new Date(),
    })
    .returning();

  await db
    .update(spaces)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(spaces.id, input.spaceId));

  revalidatePath("/pages");
  revalidatePath(`/pages/${input.spaceId}`);
  return fetchPage(page.spaceId, page.id);
}

export async function updatePage(pageId: number, input: PageUpdateInput) {
  const user = await getAppUser();
  const { page } = await assertPageAccess(pageId, user!.id);

  const values: Partial<typeof pages.$inferInsert> = {
    updatedByUserId: user!.id,
    updatedAt: new Date(),
  };

  if (input.name !== undefined) {
    values.name = requireText(input.name, 120, "Pages need a name.");
  }

  if (input.description !== undefined) {
    values.description = cleanText(input.description, 700);
  }

  if (input.content !== undefined) {
    values.content = normalizeContent(input.content);
  }

  if (input.plainText !== undefined) {
    values.plainText = cleanText(input.plainText, 6000);
  }

  await db.update(pages).set(values).where(eq(pages.id, page.id));
  await db
    .update(spaces)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(spaces.id, page.spaceId));

  revalidatePath("/pages");
  revalidatePath(`/pages/${page.spaceId}`);
  revalidatePath(`/pages/${page.spaceId}/${page.id}`);
  return fetchPage(page.spaceId, page.id);
}

export async function renamePage(pageId: number, name: string) {
  return updatePage(pageId, { name });
}

export async function movePage(pageId: number, targetSpaceId: number) {
  const user = await getAppUser();
  const { page } = await assertPageAccess(pageId, user!.id);
  await getSpaceAccess(targetSpaceId, user!.id);

  await db
    .update(pages)
    .set({
      spaceId: targetSpaceId,
      updatedByUserId: user!.id,
      updatedAt: new Date(),
    })
    .where(eq(pages.id, page.id));

  await Promise.all([
    db.update(spaces).set({ updatedAt: new Date() }).where(eq(spaces.id, page.spaceId)),
    db.update(spaces).set({ updatedAt: new Date() }).where(eq(spaces.id, targetSpaceId)),
  ]);

  revalidatePath("/pages");
  revalidatePath(`/pages/${page.spaceId}`);
  revalidatePath(`/pages/${targetSpaceId}`);
  return fetchPage(targetSpaceId, page.id);
}

export async function duplicatePage(pageId: number) {
  const user = await getAppUser();
  const { page } = await assertPageAccess(pageId, user!.id);

  const [created] = await db
    .insert(pages)
    .values({
      spaceId: page.spaceId,
      userId: user!.id,
      updatedByUserId: user!.id,
      name: `Copy of ${page.name}`.slice(0, 120),
      description: page.description,
      template: normalizeTemplate(page.template),
      content: normalizeContent(page.content as PageContent),
      plainText: page.plainText,
    })
    .returning();

  await db.update(spaces).set({ updatedAt: new Date() }).where(eq(spaces.id, page.spaceId));
  revalidatePath("/pages");
  revalidatePath(`/pages/${page.spaceId}`);
  return fetchPage(created.spaceId, created.id);
}

export async function togglePageFavorite(pageId: number) {
  const user = await getAppUser();
  const { page } = await assertPageAccess(pageId, user!.id);

  await db
    .update(pages)
    .set({
      isFavorite: !page.isFavorite,
      updatedByUserId: user!.id,
      updatedAt: new Date(),
    })
    .where(eq(pages.id, page.id));

  revalidatePath("/pages");
  revalidatePath(`/pages/${page.spaceId}`);
  revalidatePath(`/pages/${page.spaceId}/${page.id}`);
  return fetchPage(page.spaceId, page.id);
}

export async function archivePage(pageId: number, archived = true) {
  const user = await getAppUser();
  const { page } = await assertPageAccess(pageId, user!.id);

  await db
    .update(pages)
    .set({
      archivedAt: archived ? new Date() : null,
      updatedByUserId: user!.id,
      updatedAt: new Date(),
    })
    .where(eq(pages.id, page.id));

  revalidatePath("/pages");
  revalidatePath(`/pages/${page.spaceId}`);
  revalidatePath(`/pages/${page.spaceId}/${page.id}`);
  return { id: page.id, spaceId: page.spaceId };
}

export async function deletePage(pageId: number) {
  const user = await getAppUser();
  const { page } = await assertPageAccess(pageId, user!.id);

  await db.delete(pages).where(eq(pages.id, page.id));
  await db.update(spaces).set({ updatedAt: new Date() }).where(eq(spaces.id, page.spaceId));
  revalidatePath("/pages");
  revalidatePath(`/pages/${page.spaceId}`);
  return { id: page.id, spaceId: page.spaceId };
}

export async function recordPageOpened(pageId: number) {
  const user = await getAppUser();
  const { page } = await assertPageAccess(pageId, user!.id);

  await db
    .update(pages)
    .set({
      lastOpenedAt: new Date(),
    })
    .where(eq(pages.id, page.id));

  await db
    .update(spaces)
    .set({
      lastOpenedAt: new Date(),
    })
    .where(eq(spaces.id, page.spaceId));

  return { id: page.id };
}

export async function exportPage(pageId: number) {
  const user = await getAppUser();
  const { page, space } = await assertPageAccess(pageId, user!.id);
  const content = [
    `# ${page.name}`,
    "",
    `Space: ${space.name}`,
    `Template: ${page.template}`,
    page.description ? `Description: ${page.description}` : null,
    "",
    page.plainText || "",
  ]
    .filter((item): item is string => item !== null)
    .join("\n");

  return {
    filename: `${page.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "page"}.md`,
    content,
  };
}
