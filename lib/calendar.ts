import { DEFAULT_CATEGORIES, getColorMeta, type CategoryOption } from "@/lib/settings";

export const CALENDAR_ITEM_TYPES = ["task", "reminder"] as const;

export const CALENDAR_CATEGORY_OPTIONS = DEFAULT_CATEGORIES.calendar.map((category) => {
  const color = getColorMeta(category.color);

  return {
    value: category.key,
    label: category.name,
    color: category.color,
    bg: color.bg,
    border: color.border,
  };
});

export const DEFAULT_CALENDAR_CATEGORY = "Work";

export type CalendarItemType = (typeof CALENDAR_ITEM_TYPES)[number];
export type CalendarCategory = string;

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

export function getCalendarCategoryMeta(category: string, options?: CategoryOption[]) {
  if (options?.length) {
    return (
      options.find((option) => option.key === category) ??
      options[0]
    );
  }

  return (
    CALENDAR_CATEGORY_OPTIONS.find((option) => option.value === category) ??
    CALENDAR_CATEGORY_OPTIONS[0]
  );
}
