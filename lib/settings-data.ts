import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  calendarItems,
  generatedApps,
  kanbanBoards,
  kanbanColumns,
  kanbanTasks,
  notes,
  userCategories,
  userSettings,
  userSubscriptions,
  type User,
  type UserCategory,
  type UserSettings,
  type UserSubscription,
} from "@/db/schema";
import {
  AI_BEHAVIOR_OPTIONS,
  AI_MODEL_OPTIONS,
  AI_TONE_OPTIONS,
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_OPTIONS,
  CATEGORY_SCOPES,
  DEFAULT_CATEGORIES,
  DEFAULT_USAGE_LIMITS,
  SETTINGS_CALENDAR_VIEW_OPTIONS,
  SETTINGS_TASK_PRIORITY_OPTIONS,
  SETTINGS_THEME_OPTIONS,
  type CategoryFormInput,
  type CategoryOption,
  type CategoryScope,
  type SettingsUsageLimit,
  type SettingsPageData,
  type UserCategoryRecord,
  type UserSettingsRecord,
  type UserSettingsUpdateInput,
  type UserSubscriptionRecord,
  getDefaultCategoryKey,
  isCategoryScope,
  toCategoryOption,
} from "@/lib/settings";

function toIso(value: Date) {
  return value.toISOString();
}

function toSettingsRecord(settings: UserSettings): UserSettingsRecord {
  return {
    ...settings,
    createdAt: toIso(settings.createdAt),
    updatedAt: toIso(settings.updatedAt),
  };
}

function normalizeUsageLimits(value: unknown): Record<string, SettingsUsageLimit> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_USAGE_LIMITS };
  }

  return {
    ...DEFAULT_USAGE_LIMITS,
    ...(value as Record<string, SettingsUsageLimit>),
  };
}

function toSubscriptionRecord(
  subscription: UserSubscription,
  usageLimits: Record<string, SettingsUsageLimit>
): UserSubscriptionRecord {
  return {
    ...subscription,
    usageLimits,
    createdAt: toIso(subscription.createdAt),
    updatedAt: toIso(subscription.updatedAt),
  };
}

function toCategoryRecord(category: UserCategory): UserCategoryRecord {
  return {
    ...category,
    scope: isCategoryScope(category.scope) ? category.scope : "notes",
    createdAt: toIso(category.createdAt),
    updatedAt: toIso(category.updatedAt),
  };
}

function cleanText(value: string | null | undefined, maxLength: number) {
  const text = value?.trim() ?? "";
  return text ? text.slice(0, maxLength) : null;
}

function normalizeColor(value: string | null | undefined) {
  const color = value?.trim() ?? "";
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color.toUpperCase();
  }

  return CATEGORY_COLOR_OPTIONS[0].value;
}

function normalizeIcon(value: string | null | undefined) {
  if (CATEGORY_ICON_OPTIONS.includes(value as (typeof CATEGORY_ICON_OPTIONS)[number])) {
    return value!;
  }

  return "Sparkles";
}

function slugifyCategoryName(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "category"
  );
}

async function getUniqueCategoryKey(userId: number, scope: CategoryScope, name: string) {
  const base = slugifyCategoryName(name);
  let candidate = base;
  let index = 2;

  while (true) {
    const existing = await db.query.userCategories.findFirst({
      where: and(
        eq(userCategories.userId, userId),
        eq(userCategories.scope, scope),
        eq(userCategories.key, candidate)
      ),
    });

    if (!existing) return candidate;

    candidate = `${base}-${index}`;
    index += 1;
  }
}

export function normalizeSettingsUpdate(input: UserSettingsUpdateInput) {
  const next: Partial<typeof userSettings.$inferInsert> = {};

  if (
    input.themePreference &&
    (SETTINGS_THEME_OPTIONS as readonly string[]).includes(input.themePreference)
  ) {
    next.themePreference = input.themePreference;
  }

  if (typeof input.notificationsEnabled === "boolean") {
    next.notificationsEnabled = input.notificationsEnabled;
  }

  if (typeof input.emailNotifications === "boolean") {
    next.emailNotifications = input.emailNotifications;
  }

  if (typeof input.desktopNotifications === "boolean") {
    next.desktopNotifications = input.desktopNotifications;
  }

  if (
    input.defaultCalendarView &&
    (SETTINGS_CALENDAR_VIEW_OPTIONS as readonly string[]).includes(input.defaultCalendarView)
  ) {
    next.defaultCalendarView = input.defaultCalendarView;
  }

  if (
    input.defaultTaskPriority &&
    (SETTINGS_TASK_PRIORITY_OPTIONS as readonly string[]).includes(input.defaultTaskPriority)
  ) {
    next.defaultTaskPriority = input.defaultTaskPriority;
  }

  if (typeof input.autoSaveEnabled === "boolean") {
    next.autoSaveEnabled = input.autoSaveEnabled;
  }

  if (input.aiModel && AI_MODEL_OPTIONS.some((option) => option.value === input.aiModel)) {
    next.aiModel = input.aiModel;
  }

  if (input.aiBehavior && (AI_BEHAVIOR_OPTIONS as readonly string[]).includes(input.aiBehavior)) {
    next.aiBehavior = input.aiBehavior;
  }

  if (input.aiTone && (AI_TONE_OPTIONS as readonly string[]).includes(input.aiTone)) {
    next.aiTone = input.aiTone;
  }

  if (typeof input.aiRefineEnabled === "boolean") {
    next.aiRefineEnabled = input.aiRefineEnabled;
  }

  if (typeof input.aiAssistantEnabled === "boolean") {
    next.aiAssistantEnabled = input.aiAssistantEnabled;
  }

  if (typeof input.aiTemplateBuilderEnabled === "boolean") {
    next.aiTemplateBuilderEnabled = input.aiTemplateBuilderEnabled;
  }

  if (typeof input.aiDiagramEnabled === "boolean") {
    next.aiDiagramEnabled = input.aiDiagramEnabled;
  }

  if (typeof input.privacyAnalyticsEnabled === "boolean") {
    next.privacyAnalyticsEnabled = input.privacyAnalyticsEnabled;
  }

  if (typeof input.securityAlertsEnabled === "boolean") {
    next.securityAlertsEnabled = input.securityAlertsEnabled;
  }

  return next;
}

export async function ensureUserSettings(userId: number) {
  const existing = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });

  if (existing) return toSettingsRecord(existing);

  const [created] = await db.insert(userSettings).values({ userId }).returning();
  return toSettingsRecord(created);
}

async function buildUsageLimits(userId: number, subscription: UserSubscription) {
  const [[noteCount], [boardCount], [appCount]] = await Promise.all([
    db.select({ value: count() }).from(notes).where(eq(notes.userId, userId)),
    db.select({ value: count() }).from(kanbanBoards).where(eq(kanbanBoards.userId, userId)),
    db.select({ value: count() }).from(generatedApps).where(eq(generatedApps.userId, userId)),
  ]);
  const stored = normalizeUsageLimits(subscription.usageLimits);

  return {
    ...stored,
    notes: {
      ...(stored.notes ?? DEFAULT_USAGE_LIMITS.notes),
      used: Number(noteCount?.value ?? 0),
    },
    boards: {
      ...(stored.boards ?? DEFAULT_USAGE_LIMITS.boards),
      used: Number(boardCount?.value ?? 0),
    },
    aiCredits: {
      ...(stored.aiCredits ?? DEFAULT_USAGE_LIMITS.aiCredits),
      used: Number(appCount?.value ?? 0),
    },
  };
}

export async function ensureUserSubscription(userId: number) {
  const existing = await db.query.userSubscriptions.findFirst({
    where: eq(userSubscriptions.userId, userId),
  });

  if (existing) {
    return toSubscriptionRecord(existing, await buildUsageLimits(userId, existing));
  }

  const [created] = await db
    .insert(userSubscriptions)
    .values({ userId, usageLimits: DEFAULT_USAGE_LIMITS })
    .returning();

  return toSubscriptionRecord(created, await buildUsageLimits(userId, created));
}

export async function ensureDefaultCategories(userId: number) {
  const existing = await db
    .select()
    .from(userCategories)
    .where(eq(userCategories.userId, userId))
    .orderBy(asc(userCategories.scope), asc(userCategories.position), asc(userCategories.name));

  const existingKeys = new Set(existing.map((category) => `${category.scope}:${category.key}`));
  const missing = CATEGORY_SCOPES.flatMap((scope) =>
    DEFAULT_CATEGORIES[scope]
      .filter((category) => !existingKeys.has(`${scope}:${category.key}`))
      .map((category, index) => ({
        userId,
        scope,
        key: category.key,
        name: category.name,
        color: category.color,
        icon: category.icon,
        position: index,
      }))
  );

  if (missing.length > 0) {
    await db.insert(userCategories).values(missing).onConflictDoNothing();
  }

  return db
    .select()
    .from(userCategories)
    .where(eq(userCategories.userId, userId))
    .orderBy(asc(userCategories.scope), asc(userCategories.position), asc(userCategories.name));
}

export async function getCategoryGroupsForUser(userId: number) {
  const categories = await ensureDefaultCategories(userId);
  const groups = CATEGORY_SCOPES.reduce<Record<CategoryScope, CategoryOption[]>>((acc, scope) => {
    acc[scope] = [];
    return acc;
  }, {} as Record<CategoryScope, CategoryOption[]>);

  for (const category of categories) {
    if (!isCategoryScope(category.scope)) continue;
    groups[category.scope].push(toCategoryOption(toCategoryRecord(category)));
  }

  return groups;
}

export async function getCategoryOptionsForUser(userId: number, scope: CategoryScope) {
  const groups = await getCategoryGroupsForUser(userId);
  return groups[scope];
}

export async function getSettingsPageData(user: User): Promise<SettingsPageData> {
  const [settings, subscription, categories] = await Promise.all([
    ensureUserSettings(user.id),
    ensureUserSubscription(user.id),
    getCategoryGroupsForUser(user.id),
  ]);

  return {
    settings,
    subscription,
    categories,
  };
}

export async function createCategoryForUser(userId: number, input: CategoryFormInput) {
  const scope = input.scope;
  const name = cleanText(input.name, 36);

  if (!name) {
    throw new Error("Categories need a name.");
  }

  const key = await getUniqueCategoryKey(userId, scope, name);
  const categories = await getCategoryOptionsForUser(userId, scope);
  const [created] = await db
    .insert(userCategories)
    .values({
      userId,
      scope,
      key,
      name,
      color: normalizeColor(input.color),
      icon: normalizeIcon(input.icon),
      position: categories.length,
    })
    .returning();

  return toCategoryOption(toCategoryRecord(created));
}

export async function updateCategoryForUser(
  userId: number,
  id: number,
  input: Omit<CategoryFormInput, "scope">
) {
  const existing = await db.query.userCategories.findFirst({
    where: and(eq(userCategories.id, id), eq(userCategories.userId, userId)),
  });

  if (!existing || !isCategoryScope(existing.scope)) {
    throw new Error("Category not found.");
  }

  const name = cleanText(input.name, 36);
  if (!name) {
    throw new Error("Categories need a name.");
  }

  const [updated] = await db
    .update(userCategories)
    .set({
      name,
      color: normalizeColor(input.color),
      icon: normalizeIcon(input.icon),
      updatedAt: new Date(),
    })
    .where(and(eq(userCategories.id, id), eq(userCategories.userId, userId)))
    .returning();

  return toCategoryOption(toCategoryRecord(updated));
}

export async function deleteCategoryForUser(userId: number, id: number) {
  const existing = await db.query.userCategories.findFirst({
    where: and(eq(userCategories.id, id), eq(userCategories.userId, userId)),
  });

  if (!existing || !isCategoryScope(existing.scope)) {
    throw new Error("Category not found.");
  }

  const defaultKey = getDefaultCategoryKey(existing.scope);
  if (existing.key === defaultKey) {
    throw new Error("The default category cannot be deleted.");
  }

  await db.delete(userCategories).where(and(eq(userCategories.id, id), eq(userCategories.userId, userId)));

  return {
    id,
    scope: existing.scope,
    key: existing.key,
    defaultKey,
  };
}

export async function getUserExportData(user: User) {
  const [settingsData, calendarRecords, noteRecords, boardRecords, appRecords] = await Promise.all([
    getSettingsPageData(user),
    db.select().from(calendarItems).where(eq(calendarItems.userId, user.id)),
    db.select().from(notes).where(eq(notes.userId, user.id)),
    db.select().from(kanbanBoards).where(eq(kanbanBoards.userId, user.id)),
    db.select().from(generatedApps).where(eq(generatedApps.userId, user.id)),
  ]);

  const boardIds = boardRecords.map((board) => board.id);
  const [columnRecords, taskRecords] =
    boardIds.length > 0
      ? await Promise.all([
          db.select().from(kanbanColumns).where(inArray(kanbanColumns.boardId, boardIds)),
          db.select().from(kanbanTasks).where(inArray(kanbanTasks.boardId, boardIds)),
        ])
      : [[], []];

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    settings: settingsData.settings,
    subscription: settingsData.subscription,
    categories: settingsData.categories,
    calendarItems: calendarRecords,
    notes: noteRecords,
    kanban: {
      boards: boardRecords,
      columns: columnRecords,
      tasks: taskRecords,
    },
    generatedApps: appRecords,
  };
}
