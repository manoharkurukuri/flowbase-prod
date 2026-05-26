import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  name: text("name"),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const calendarItems = pgTable("calendar_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  itemType: text("item_type").notNull().default("task"),
  category: text("category").notNull().default("Work"),
  scheduledDate: text("scheduled_date"),
  scheduledTime: text("scheduled_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kanbanBoards = pgTable("kanban_boards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#F97316"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kanbanColumns = pgTable("kanban_columns", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id")
    .notNull()
    .references(() => kanbanBoards.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kanbanTasks = pgTable("kanban_tasks", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id")
    .notNull()
    .references(() => kanbanBoards.id, { onDelete: "cascade" }),
  columnId: integer("column_id")
    .notNull()
    .references(() => kanbanColumns.id, { onDelete: "cascade" }),
  calendarItemId: integer("calendar_item_id").references(() => calendarItems.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: text("due_date").notNull(),
  priority: text("priority").notNull().default("Medium"),
  labelIds: text("label_ids").notNull().default("[]"),
  position: integer("position").notNull().default(0),
  syncToCalendar: boolean("sync_to_calendar").notNull().default(false),
  linkedToNotes: boolean("linked_to_notes").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notes = pgTable(
  "notes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: jsonb("content")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({ type: "doc", content: [] }),
    plainText: text("plain_text"),
    color: text("color").notNull().default("#EAB308"),
    category: text("category").notNull().default("general"),
    isPinned: boolean("is_pinned").notNull().default(false),
    trashedAt: timestamp("trashed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("notes_user_id_idx").on(table.userId),
    index("notes_user_category_idx").on(table.userId, table.category),
    index("notes_user_trash_idx").on(table.userId, table.trashedAt),
    index("notes_user_pinned_idx").on(table.userId, table.isPinned),
  ]
);

export const userSettings = pgTable(
  "user_settings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    themePreference: text("theme_preference").notNull().default("system"),
    notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
    emailNotifications: boolean("email_notifications").notNull().default(true),
    desktopNotifications: boolean("desktop_notifications").notNull().default(false),
    defaultCalendarView: text("default_calendar_view").notNull().default("month"),
    defaultTaskPriority: text("default_task_priority").notNull().default("Medium"),
    autoSaveEnabled: boolean("auto_save_enabled").notNull().default(true),
    aiModel: text("ai_model").notNull().default("llama-3.3-70b-versatile"),
    aiBehavior: text("ai_behavior").notNull().default("balanced"),
    aiTone: text("ai_tone").notNull().default("warm"),
    aiRefineEnabled: boolean("ai_refine_enabled").notNull().default(true),
    aiAssistantEnabled: boolean("ai_assistant_enabled").notNull().default(true),
    aiTemplateBuilderEnabled: boolean("ai_template_builder_enabled").notNull().default(true),
    aiDiagramEnabled: boolean("ai_diagram_enabled").notNull().default(true),
    privacyAnalyticsEnabled: boolean("privacy_analytics_enabled").notNull().default(false),
    securityAlertsEnabled: boolean("security_alerts_enabled").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_settings_user_id_unique").on(table.userId),
    index("user_settings_user_id_idx").on(table.userId),
  ]
);

export const userSubscriptions = pgTable(
  "user_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planName: text("plan_name").notNull().default("Free Plan"),
    status: text("status").notNull().default("active"),
    renewalDate: text("renewal_date"),
    usageLimits: jsonb("usage_limits")
      .$type<Record<string, { used: number; limit: number | null; label: string }>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_subscriptions_user_id_unique").on(table.userId),
    index("user_subscriptions_user_id_idx").on(table.userId),
  ]
);

export const userCategories = pgTable(
  "user_categories",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#8B5CF6"),
    icon: text("icon").notNull().default("Sparkles"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_categories_user_scope_key_unique").on(table.userId, table.scope, table.key),
    index("user_categories_user_scope_idx").on(table.userId, table.scope),
    index("user_categories_user_position_idx").on(table.userId, table.scope, table.position),
  ]
);

export const spaces = pgTable(
  "spaces",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color").notNull().default("#8B5CF6"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    archivedAt: timestamp("archived_at"),
    lastOpenedAt: timestamp("last_opened_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("spaces_user_id_idx").on(table.userId),
    index("spaces_user_archive_idx").on(table.userId, table.archivedAt),
    index("spaces_user_favorite_idx").on(table.userId, table.isFavorite),
    index("spaces_user_updated_idx").on(table.userId, table.updatedAt),
  ]
);

export const pages = pgTable(
  "pages",
  {
    id: serial("id").primaryKey(),
    spaceId: integer("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    updatedByUserId: integer("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    template: text("template").notNull().default("blank"),
    content: jsonb("content")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({ type: "doc", content: [] }),
    plainText: text("plain_text"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    archivedAt: timestamp("archived_at"),
    lastOpenedAt: timestamp("last_opened_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("pages_space_id_idx").on(table.spaceId),
    index("pages_user_id_idx").on(table.userId),
    index("pages_space_archive_idx").on(table.spaceId, table.archivedAt),
    index("pages_space_favorite_idx").on(table.spaceId, table.isFavorite),
    index("pages_space_updated_idx").on(table.spaceId, table.updatedAt),
  ]
);

export const pageComments = pgTable(
  "page_comments",
  {
    id: serial("id").primaryKey(),
    pageId: integer("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    resolved: boolean("resolved").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("page_comments_page_id_idx").on(table.pageId),
    index("page_comments_user_id_idx").on(table.userId),
  ]
);

export const pageTaskLinks = pgTable(
  "page_task_links",
  {
    id: serial("id").primaryKey(),
    pageId: integer("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    taskId: integer("task_id")
      .notNull()
      .references(() => kanbanTasks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("page_task_links_page_task_unique").on(table.pageId, table.taskId),
    index("page_task_links_page_id_idx").on(table.pageId),
    index("page_task_links_task_id_idx").on(table.taskId),
  ]
);

export const whiteboards = pgTable(
  "whiteboards",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#EC4899"),
    scene: jsonb("scene")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({
        type: "excalidraw",
        version: 2,
        source: "flowbase",
        elements: [],
        appState: { viewBackgroundColor: "#FFFDF7" },
        files: {},
      }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("whiteboards_user_id_idx").on(table.userId),
    index("whiteboards_user_updated_idx").on(table.userId, table.updatedAt),
  ]
);

export const generatedApps = pgTable(
  "generated_apps",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    appName: text("app_name").notNull(),
    description: text("description"),
    icon: text("icon").notNull().default("Sparkles"),
    color: text("color").notNull().default("#8B5CF6"),
    layout: text("layout").notNull().default("single-page"),
    templateJson: jsonb("template_json")
      .$type<Record<string, unknown>>()
      .notNull(),
    isInSidebar: boolean("is_in_sidebar").notNull().default(false),
    sidebarPosition: integer("sidebar_position"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("generated_apps_user_id_idx").on(table.userId),
    index("generated_apps_user_created_idx").on(table.userId, table.createdAt),
    index("generated_apps_user_sidebar_idx").on(
      table.userId,
      table.isInSidebar,
      table.sidebarPosition
    ),
  ]
);

export const collaborationMembers = pgTable(
  "collaboration_members",
  {
    id: serial("id").primaryKey(),
    resourceType: text("resource_type").notNull(),
    resourceId: integer("resource_id").notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("editor"),
    invitedByUserId: integer("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("collaboration_members_resource_email_unique").on(
      table.resourceType,
      table.resourceId,
      table.email
    ),
    index("collaboration_members_resource_idx").on(table.resourceType, table.resourceId),
    index("collaboration_members_user_id_idx").on(table.userId),
    index("collaboration_members_email_idx").on(table.email),
  ]
);


export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type CalendarItem = typeof calendarItems.$inferSelect;
export type NewCalendarItem = typeof calendarItems.$inferInsert;
export type KanbanBoard = typeof kanbanBoards.$inferSelect;
export type NewKanbanBoard = typeof kanbanBoards.$inferInsert;
export type KanbanColumn = typeof kanbanColumns.$inferSelect;
export type NewKanbanColumn = typeof kanbanColumns.$inferInsert;
export type KanbanTask = typeof kanbanTasks.$inferSelect;
export type NewKanbanTask = typeof kanbanTasks.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Space = typeof spaces.$inferSelect;
export type NewSpace = typeof spaces.$inferInsert;
export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
export type PageComment = typeof pageComments.$inferSelect;
export type NewPageComment = typeof pageComments.$inferInsert;
export type PageTaskLink = typeof pageTaskLinks.$inferSelect;
export type NewPageTaskLink = typeof pageTaskLinks.$inferInsert;
export type Whiteboard = typeof whiteboards.$inferSelect;
export type NewWhiteboard = typeof whiteboards.$inferInsert;
export type GeneratedApp = typeof generatedApps.$inferSelect;
export type NewGeneratedApp = typeof generatedApps.$inferInsert;
export type CollaborationMember = typeof collaborationMembers.$inferSelect;
export type NewCollaborationMember = typeof collaborationMembers.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type NewUserSubscription = typeof userSubscriptions.$inferInsert;
export type UserCategory = typeof userCategories.$inferSelect;
export type NewUserCategory = typeof userCategories.$inferInsert;
