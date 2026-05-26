"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarItems, type CalendarItem } from "@/db/schema";
import { syncUser } from "@/lib/actions/sync-user";
import { getCategoryOptionsForUser } from "@/lib/settings-data";
import {
  CALENDAR_ITEM_TYPES,
  type CalendarCategory,
  type CalendarItemFormInput,
  type CalendarItemRecord,
  type CalendarItemType,
} from "@/lib/calendar";
import { getDefaultCategoryKey } from "@/lib/settings";

async function getAppUser(required = true) {
  const user = await syncUser();

  if (!user && required) {
    throw new Error("You need to be signed in to manage calendar items.");
  }

  return user;
}

function cleanText(value: string | null | undefined, maxLength: number) {
  const text = value?.trim() ?? "";
  return text ? text.slice(0, maxLength) : null;
}

function normalizeTitle(title: string | null | undefined) {
  const cleaned = cleanText(title, 120);

  if (!cleaned) {
    throw new Error("Calendar items need a title.");
  }

  return cleaned;
}

function normalizeItemType(itemType: string | null | undefined): CalendarItemType {
  if (CALENDAR_ITEM_TYPES.includes(itemType as CalendarItemType)) {
    return itemType as CalendarItemType;
  }

  return "task";
}

async function normalizeCategory(
  userId: number,
  itemType: CalendarItemType,
  category: string | null | undefined
): Promise<CalendarCategory> {
  const scope = itemType === "reminder" ? "reminders" : "calendar";
  const categories = await getCategoryOptionsForUser(userId, scope);

  if (category && categories.some((option) => option.key === category)) {
    return category;
  }

  return getDefaultCategoryKey(scope);
}

function normalizeDate(date: string | null | undefined) {
  if (!date) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Use a valid date for calendar scheduling.");
  }

  return date;
}

function normalizeTime(time: string | null | undefined) {
  if (!time) return null;

  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) {
    throw new Error("Use a valid time for calendar scheduling.");
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    throw new Error("Use a valid time for calendar scheduling.");
  }

  return time;
}

function toCalendarRecord(item: CalendarItem): CalendarItemRecord {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    itemType: normalizeItemType(item.itemType),
    category: item.category,
    scheduledDate: item.scheduledDate,
    scheduledTime: item.scheduledTime,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

async function normalizeInput(userId: number, input: CalendarItemFormInput) {
  const itemType = normalizeItemType(input.itemType);

  return {
    title: normalizeTitle(input.title),
    description: cleanText(input.description, 400),
    itemType,
    category: await normalizeCategory(userId, itemType, input.category),
    scheduledDate: normalizeDate(input.scheduledDate),
    scheduledTime: normalizeTime(input.scheduledTime),
  };
}

async function assertOwnedItem(id: number, userId: number) {
  const item = await db.query.calendarItems.findFirst({
    where: and(eq(calendarItems.id, id), eq(calendarItems.userId, userId)),
  });

  if (!item) {
    throw new Error("Calendar item not found.");
  }

  return item;
}

export async function fetchCalendarItems() {
  const user = await getAppUser(false);

  if (!user) {
    return [];
  }

  const items = await db
    .select()
    .from(calendarItems)
    .where(eq(calendarItems.userId, user.id))
    .orderBy(
      asc(calendarItems.scheduledDate),
      asc(calendarItems.scheduledTime),
      desc(calendarItems.createdAt)
    );

  return items.map(toCalendarRecord);
}

export async function createScheduledCalendarItem(input: CalendarItemFormInput) {
  const user = await getAppUser();
  const values = await normalizeInput(user!.id, input);

  if (!values.scheduledDate) {
    throw new Error("Choose a date before scheduling this item.");
  }

  const [created] = await db
    .insert(calendarItems)
    .values({
      ...values,
      userId: user!.id,
    })
    .returning();

  revalidatePath("/calendar");
  return toCalendarRecord(created);
}

export async function createDraftCalendarItem(input: CalendarItemFormInput) {
  const user = await getAppUser();
  const values = await normalizeInput(user!.id, input);

  const [created] = await db
    .insert(calendarItems)
    .values({
      ...values,
      userId: user!.id,
      scheduledDate: null,
      scheduledTime: null,
    })
    .returning();

  revalidatePath("/calendar");
  return toCalendarRecord(created);
}

export async function scheduleDraftCalendarItem(
  id: number,
  scheduledDate: string,
  scheduledTime?: string | null
) {
  const user = await getAppUser();
  await assertOwnedItem(id, user!.id);

  const [updated] = await db
    .update(calendarItems)
    .set({
      scheduledDate: normalizeDate(scheduledDate),
      scheduledTime: normalizeTime(scheduledTime),
      updatedAt: new Date(),
    })
    .where(and(eq(calendarItems.id, id), eq(calendarItems.userId, user!.id)))
    .returning();

  revalidatePath("/calendar");
  return toCalendarRecord(updated);
}

export async function rescheduleCalendarItem(id: number, scheduledDate: string) {
  const user = await getAppUser();
  await assertOwnedItem(id, user!.id);

  const [updated] = await db
    .update(calendarItems)
    .set({
      scheduledDate: normalizeDate(scheduledDate),
      updatedAt: new Date(),
    })
    .where(and(eq(calendarItems.id, id), eq(calendarItems.userId, user!.id)))
    .returning();

  revalidatePath("/calendar");
  return toCalendarRecord(updated);
}

export async function updateCalendarItem(id: number, input: CalendarItemFormInput) {
  const user = await getAppUser();
  await assertOwnedItem(id, user!.id);
  const values = await normalizeInput(user!.id, input);

  const [updated] = await db
    .update(calendarItems)
    .set({
      ...values,
      updatedAt: new Date(),
    })
    .where(and(eq(calendarItems.id, id), eq(calendarItems.userId, user!.id)))
    .returning();

  revalidatePath("/calendar");
  return toCalendarRecord(updated);
}

export async function deleteCalendarItem(id: number) {
  const user = await getAppUser();
  await assertOwnedItem(id, user!.id);

  await db
    .delete(calendarItems)
    .where(and(eq(calendarItems.id, id), eq(calendarItems.userId, user!.id)));

  revalidatePath("/calendar");
  return { id };
}
