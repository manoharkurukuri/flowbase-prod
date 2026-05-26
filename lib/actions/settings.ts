"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { calendarItems, kanbanBoards, kanbanTasks, notes, userSettings } from "@/db/schema";
import { syncUser } from "@/lib/actions/sync-user";
import {
  createCategoryForUser,
  deleteCategoryForUser,
  ensureUserSettings,
  ensureUserSubscription,
  getCategoryGroupsForUser,
  getCategoryOptionsForUser,
  getSettingsPageData,
  getUserExportData,
  normalizeSettingsUpdate,
  updateCategoryForUser,
} from "@/lib/settings-data";
import {
  type CategoryFormInput,
  type CategoryScope,
  type SettingsPageData,
  type UserSettingsUpdateInput,
} from "@/lib/settings";

async function getAppUser(required = true) {
  const user = await syncUser();

  if (!user && required) {
    throw new Error("You need to be signed in to manage settings.");
  }

  return user;
}

function parseLabelIds(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((label): label is string => typeof label === "string") : [];
  } catch {
    return value
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean);
  }
}

async function removeKanbanLabelFromOwnedBoards(userId: number, labelKey: string) {
  const boards = await db
    .select({ id: kanbanBoards.id })
    .from(kanbanBoards)
    .where(eq(kanbanBoards.userId, userId));

  const boardIds = boards.map((board) => board.id);
  if (boardIds.length === 0) return;

  const tasks = await db
    .select({ id: kanbanTasks.id, labelIds: kanbanTasks.labelIds })
    .from(kanbanTasks)
    .where(inArray(kanbanTasks.boardId, boardIds));

  await Promise.all(
    tasks.map((task) => {
      const nextLabels = parseLabelIds(task.labelIds).filter((label) => label !== labelKey);
      if (JSON.stringify(nextLabels) === task.labelIds) return Promise.resolve();

      return db
        .update(kanbanTasks)
        .set({ labelIds: JSON.stringify(nextLabels), updatedAt: new Date() })
        .where(eq(kanbanTasks.id, task.id));
    })
  );
}

async function reassignDeletedCategory(
  userId: number,
  scope: CategoryScope,
  categoryKey: string,
  defaultKey: string
) {
  if (scope === "calendar") {
    await db
      .update(calendarItems)
      .set({ category: defaultKey, updatedAt: new Date() })
      .where(
        and(
          eq(calendarItems.userId, userId),
          eq(calendarItems.itemType, "task"),
          eq(calendarItems.category, categoryKey)
        )
      );
    return;
  }

  if (scope === "reminders") {
    await db
      .update(calendarItems)
      .set({ category: defaultKey, updatedAt: new Date() })
      .where(
        and(
          eq(calendarItems.userId, userId),
          eq(calendarItems.itemType, "reminder"),
          eq(calendarItems.category, categoryKey)
        )
      );
    return;
  }

  if (scope === "notes") {
    await db
      .update(notes)
      .set({ category: defaultKey, updatedAt: new Date() })
      .where(and(eq(notes.userId, userId), eq(notes.category, categoryKey)));
    return;
  }

  await removeKanbanLabelFromOwnedBoards(userId, categoryKey);
}

export async function fetchSettingsPageData(): Promise<SettingsPageData | null> {
  const user = await getAppUser(false);
  if (!user) return null;

  return getSettingsPageData(user);
}

export async function fetchCalendarPagePreferences() {
  const user = await getAppUser(false);
  if (!user) {
    return null;
  }

  const [settings, categories] = await Promise.all([
    ensureUserSettings(user.id),
    getCategoryGroupsForUser(user.id),
  ]);

  return {
    settings,
    calendarCategories: categories.calendar,
    reminderCategories: categories.reminders,
  };
}

export async function fetchKanbanPagePreferences() {
  const user = await getAppUser(false);
  if (!user) {
    return null;
  }

  const settings = await ensureUserSettings(user.id);
  return {
    defaultTaskPriority: settings.defaultTaskPriority,
  };
}

export async function fetchNotesPagePreferences() {
  const user = await getAppUser(false);
  if (!user) {
    return null;
  }

  const [settings, categories] = await Promise.all([
    ensureUserSettings(user.id),
    getCategoryOptionsForUser(user.id, "notes"),
  ]);

  return {
    autoSaveEnabled: settings.autoSaveEnabled,
    categories,
  };
}

export async function fetchSidebarSubscriptionLabel() {
  const user = await getAppUser(false);
  if (!user) return "Free Plan";

  const subscription = await ensureUserSubscription(user.id);
  return subscription.planName;
}

export async function updateUserSettings(input: UserSettingsUpdateInput) {
  const user = await getAppUser();
  await ensureUserSettings(user!.id);
  const values = normalizeSettingsUpdate(input);

  if (Object.keys(values).length === 0) {
    return ensureUserSettings(user!.id);
  }

  const [updated] = await db
    .update(userSettings)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(userSettings.userId, user!.id))
    .returning();

  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/kanban");
  revalidatePath("/notes");

  return {
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function createUserCategory(input: CategoryFormInput) {
  const user = await getAppUser();
  const category = await createCategoryForUser(user!.id, input);

  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/kanban");
  revalidatePath("/notes");

  return category;
}

export async function updateUserCategory(id: number, input: Omit<CategoryFormInput, "scope">) {
  const user = await getAppUser();
  const category = await updateCategoryForUser(user!.id, id, input);

  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/kanban");
  revalidatePath("/notes");

  return category;
}

export async function deleteUserCategory(id: number) {
  const user = await getAppUser();
  const deleted = await deleteCategoryForUser(user!.id, id);

  await reassignDeletedCategory(user!.id, deleted.scope, deleted.key, deleted.defaultKey);

  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/kanban");
  revalidatePath("/notes");

  return deleted;
}

export async function exportUserData() {
  const user = await getAppUser();
  const data = await getUserExportData(user!);
  const today = new Date().toISOString().slice(0, 10);

  return {
    filename: `flowbase-export-${today}.json`,
    content: JSON.stringify(data, null, 2),
  };
}
