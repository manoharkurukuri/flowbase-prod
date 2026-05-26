import { fetchCalendarItems } from "@/lib/actions/calendar-items";
import { fetchCalendarPagePreferences } from "@/lib/actions/settings";
import { DEFAULT_CATEGORIES, toCategoryOption } from "@/lib/settings";
import { CalendarPageClient } from "./calendar-page-client";

export default async function CalendarPage() {
  const [items, preferences] = await Promise.all([
    fetchCalendarItems(),
    fetchCalendarPagePreferences(),
  ]);
  const fallbackCalendarCategories = DEFAULT_CATEGORIES.calendar.map((category, index) =>
    toCategoryOption({
      id: index,
      userId: 0,
      scope: "calendar",
      key: category.key,
      name: category.name,
      color: category.color,
      icon: category.icon,
      position: index,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    })
  );
  const fallbackReminderCategories = DEFAULT_CATEGORIES.reminders.map((category, index) =>
    toCategoryOption({
      id: index,
      userId: 0,
      scope: "reminders",
      key: category.key,
      name: category.name,
      color: category.color,
      icon: category.icon,
      position: index,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    })
  );
  const initialView = preferences?.settings.defaultCalendarView === "week" ? "week" : "month";

  return (
    <CalendarPageClient
      initialItems={items}
      initialView={initialView}
      calendarCategories={preferences?.calendarCategories ?? fallbackCalendarCategories}
      reminderCategories={preferences?.reminderCategories ?? fallbackReminderCategories}
    />
  );
}