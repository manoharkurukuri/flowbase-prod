export const CALENDAR_ITEM_TYPES = ["task", "reminder"] as const;

export const CALENDAR_CATEGORY_OPTIONS = [
  {
    value: "Work",
    label: "Work",
    color: "#3B82F6",
    bg: "#EFF6FF",
    border: "#BFDBFE",
  },
  {
    value: "Personal",
    label: "Personal",
    color: "#EC4899",
    bg: "#FDF2F8",
    border: "#FBCFE8",
  },
  {
    value: "Meeting",
    label: "Meeting",
    color: "#8B5CF6",
    bg: "#F5F3FF",
    border: "#DDD6FE",
  },
  {
    value: "Deadline",
    label: "Deadline",
    color: "#F97316",
    bg: "#FFF7ED",
    border: "#FED7AA",
  },
  {
    value: "Reminder",
    label: "Reminder",
    color: "#06B6D4",
    bg: "#ECFEFF",
    border: "#A5F3FC",
  },
  {
    value: "Focus",
    label: "Focus",
    color: "#10B981",
    bg: "#ECFDF5",
    border: "#A7F3D0",
  },
] as const;

export const DEFAULT_CALENDAR_CATEGORY = "Work";

export type CalendarItemType = (typeof CALENDAR_ITEM_TYPES)[number];
export type CalendarCategory = (typeof CALENDAR_CATEGORY_OPTIONS)[number]["value"];

export type CalendarItemRecord = {
  id: number;
  title: string;
  description: string | null;
  itemType: CalendarItemType;
  category: CalendarCategory;
  scheduledDate: string | null;
  scheduledTime: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CalendarItemFormInput = {
  title: string;
  description?: string | null;
  itemType: CalendarItemType;
  category: CalendarCategory;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
};

export function getCalendarCategoryMeta(category: string) {
  return (
    CALENDAR_CATEGORY_OPTIONS.find((option) => option.value === category) ??
    CALENDAR_CATEGORY_OPTIONS[0]
  );
}
