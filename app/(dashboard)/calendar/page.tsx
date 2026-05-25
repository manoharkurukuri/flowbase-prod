import { fetchCalendarItems } from "@/lib/actions/calendar-items";
import { CalendarPageClient } from "./calendar-page-client";

export default async function CalendarPage() {
  const items = await fetchCalendarItems();

  return <CalendarPageClient initialItems={items} />;
}
