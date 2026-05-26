import type { UserCategory, UserSettings, UserSubscription } from "@/db/schema";

export const CATEGORY_SCOPES = ["calendar", "kanban", "notes", "reminders"] as const;
export type CategoryScope = (typeof CATEGORY_SCOPES)[number];

export const CATEGORY_SCOPE_LABELS: Record<CategoryScope, string> = {
  calendar: "Calendar events",
  kanban: "Tasks / Kanban",
  notes: "Notes",
  reminders: "Reminders",
};

export const CATEGORY_COLOR_OPTIONS = [
  { value: "#3B82F6", label: "Blue", bg: "#EFF6FF", border: "#BFDBFE" },
  { value: "#8B5CF6", label: "Violet", bg: "#F5F3FF", border: "#DDD6FE" },
  { value: "#EC4899", label: "Pink", bg: "#FDF2F8", border: "#FBCFE8" },
  { value: "#F97316", label: "Orange", bg: "#FFF7ED", border: "#FED7AA" },
  { value: "#10B981", label: "Emerald", bg: "#ECFDF5", border: "#A7F3D0" },
  { value: "#06B6D4", label: "Cyan", bg: "#ECFEFF", border: "#A5F3FC" },
  { value: "#EAB308", label: "Amber", bg: "#FEFCE8", border: "#FEF08A" },
  { value: "#64748B", label: "Slate", bg: "#F8FAFC", border: "#E2E8F0" },
] as const;

export const CATEGORY_ICON_OPTIONS = [
  "Briefcase",
  "User",
  "CalendarDays",
  "Clock",
  "Target",
  "Sparkles",
  "Bell",
  "FileText",
  "ListChecks",
  "BookOpen",
  "Palette",
  "Heart",
  "Home",
  "Plane",
  "Coffee",
  "Flag",
] as const;

export type CategoryIconName = (typeof CATEGORY_ICON_OPTIONS)[number];

export type CategorySeed = {
  key: string;
  name: string;
  color: string;
  icon: CategoryIconName;
};

export const DEFAULT_CATEGORIES: Record<CategoryScope, CategorySeed[]> = {
  calendar: [
    { key: "Work", name: "Work", color: "#3B82F6", icon: "Briefcase" },
    { key: "Personal", name: "Personal", color: "#EC4899", icon: "User" },
    { key: "Meeting", name: "Meeting", color: "#8B5CF6", icon: "CalendarDays" },
    { key: "Deadline", name: "Deadline", color: "#F97316", icon: "Clock" },
    { key: "Focus", name: "Focus", color: "#10B981", icon: "Target" },
  ],
  kanban: [
    { key: "design", name: "Design", color: "#EC4899", icon: "Palette" },
    { key: "planning", name: "Planning", color: "#8B5CF6", icon: "ListChecks" },
    { key: "focus", name: "Focus", color: "#10B981", icon: "Target" },
    { key: "urgent", name: "Urgent", color: "#F97316", icon: "Flag" },
    { key: "research", name: "Research", color: "#06B6D4", icon: "BookOpen" },
    { key: "personal", name: "Personal", color: "#EAB308", icon: "User" },
  ],
  notes: [
    { key: "general", name: "General", color: "#EAB308", icon: "FileText" },
    { key: "ideas", name: "Ideas", color: "#8B5CF6", icon: "Sparkles" },
    { key: "meeting-notes", name: "Meeting notes", color: "#06B6D4", icon: "CalendarDays" },
    { key: "personal-notes", name: "Personal", color: "#EC4899", icon: "Heart" },
  ],
  reminders: [
    { key: "Reminder", name: "Reminder", color: "#06B6D4", icon: "Bell" },
    { key: "Follow-up", name: "Follow-up", color: "#8B5CF6", icon: "Clock" },
    { key: "Personal", name: "Personal", color: "#EC4899", icon: "User" },
    { key: "Home", name: "Home", color: "#10B981", icon: "Home" },
  ],
};

export const SETTINGS_THEME_OPTIONS = ["system", "light", "dark"] as const;
export type SettingsTheme = (typeof SETTINGS_THEME_OPTIONS)[number];

export const SETTINGS_CALENDAR_VIEW_OPTIONS = ["month", "week"] as const;
export type SettingsCalendarView = (typeof SETTINGS_CALENDAR_VIEW_OPTIONS)[number];

export const SETTINGS_TASK_PRIORITY_OPTIONS = ["Low", "Medium", "High"] as const;
export type SettingsTaskPriority = (typeof SETTINGS_TASK_PRIORITY_OPTIONS)[number];

export const AI_MODEL_OPTIONS = [
  { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
  { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
  { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
] as const;

export const AI_TONE_OPTIONS = ["warm", "concise", "professional", "playful"] as const;
export type AiTone = (typeof AI_TONE_OPTIONS)[number];

export const AI_BEHAVIOR_OPTIONS = ["balanced", "brief", "detailed", "creative"] as const;
export type AiBehavior = (typeof AI_BEHAVIOR_OPTIONS)[number];

export type SettingsUsageLimit = {
  used: number;
  limit: number | null;
  label: string;
};

export type UserSettingsRecord = Omit<UserSettings, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type UserSubscriptionRecord = Omit<UserSubscription, "usageLimits" | "createdAt" | "updatedAt"> & {
  usageLimits: Record<string, SettingsUsageLimit>;
  createdAt: string;
  updatedAt: string;
};

export type UserCategoryRecord = Omit<UserCategory, "scope" | "createdAt" | "updatedAt"> & {
  scope: CategoryScope;
  createdAt: string;
  updatedAt: string;
};

export type CategoryOption = UserCategoryRecord & {
  value: string;
  label: string;
  bg: string;
  border: string;
};

export type UserSettingsUpdateInput = Partial<
  Pick<
    UserSettingsRecord,
    | "themePreference"
    | "notificationsEnabled"
    | "emailNotifications"
    | "desktopNotifications"
    | "defaultCalendarView"
    | "defaultTaskPriority"
    | "autoSaveEnabled"
    | "aiModel"
    | "aiBehavior"
    | "aiTone"
    | "aiRefineEnabled"
    | "aiAssistantEnabled"
    | "aiTemplateBuilderEnabled"
    | "aiDiagramEnabled"
    | "privacyAnalyticsEnabled"
    | "securityAlertsEnabled"
  >
>;

export type CategoryFormInput = {
  scope: CategoryScope;
  name: string;
  color: string;
  icon: string;
};

export type SettingsPageData = {
  settings: UserSettingsRecord;
  subscription: UserSubscriptionRecord;
  categories: Record<CategoryScope, CategoryOption[]>;
};

export const DEFAULT_USAGE_LIMITS: Record<string, SettingsUsageLimit> = {
  aiCredits: { label: "AI credits", used: 0, limit: 100 },
  boards: { label: "Boards", used: 0, limit: 5 },
  notes: { label: "Notes", used: 0, limit: null },
};

export function isCategoryScope(value: string): value is CategoryScope {
  return CATEGORY_SCOPES.includes(value as CategoryScope);
}

export function getDefaultCategoryKey(scope: CategoryScope) {
  return DEFAULT_CATEGORIES[scope][0]?.key ?? "general";
}

export function getColorMeta(color: string) {
  return (
    CATEGORY_COLOR_OPTIONS.find((option) => option.value.toLowerCase() === color.toLowerCase()) ?? {
      value: color,
      label: "Custom",
      bg: `${color}18`,
      border: `${color}33`,
    }
  );
}

export function toCategoryOption(category: UserCategoryRecord): CategoryOption {
  const color = getColorMeta(category.color);

  return {
    ...category,
    value: category.key,
    label: category.name,
    bg: color.bg,
    border: color.border,
  };
}

export function getCategoryMeta(options: CategoryOption[], key: string | null | undefined) {
  return options.find((option) => option.key === key) ?? options[0];
}

export function getAiInstructionContext(settings: Pick<UserSettingsRecord, "aiBehavior" | "aiTone">) {
  return `Default AI behavior: ${settings.aiBehavior}. Preferred response tone/style: ${settings.aiTone}.`;
}
