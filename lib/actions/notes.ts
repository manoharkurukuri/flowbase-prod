"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notes, type Note } from "@/db/schema";
import { syncUser } from "@/lib/actions/sync-user";
import { getCategoryOptionsForUser } from "@/lib/settings-data";
import { getDefaultCategoryKey } from "@/lib/settings";
import {
  EMPTY_NOTE_CONTENT,
  NOTE_COLORS,
  type NoteColor,
  type NoteContent,
  type NoteRecord,
  type NoteUpdateInput,
} from "@/lib/notes";

const NOTE_COLOR_VALUES = NOTE_COLORS.map((color) => color.value);

async function getAppUser(required = true) {
  const user = await syncUser();

  if (!user && required) {
    throw new Error("You need to be signed in to manage notes.");
  }

  return user;
}

function cleanText(value: string | null | undefined, maxLength: number) {
  const text = value?.trim() ?? "";
  return text ? text.slice(0, maxLength) : null;
}

function normalizeTitle(title: string | null | undefined) {
  return cleanText(title, 120) ?? "Untitled note";
}

function normalizePlainText(value: string | null | undefined) {
  return cleanText(value, 1200);
}

function normalizeColor(color: string | null | undefined): NoteColor {
  if (NOTE_COLOR_VALUES.includes(color as NoteColor)) {
    return color as NoteColor;
  }

  return NOTE_COLORS[0].value;
}

async function normalizeCategory(userId: number, category: string | null | undefined) {
  const categories = await getCategoryOptionsForUser(userId, "notes");

  if (category && categories.some((option) => option.key === category)) {
    return category;
  }

  return getDefaultCategoryKey("notes");
}

function normalizeContent(content: NoteContent | null | undefined): NoteContent {
  if (!content || typeof content !== "object" || content.type !== "doc") {
    return { ...EMPTY_NOTE_CONTENT };
  }

  const serialized = JSON.stringify(content);
  if (serialized.length > 750_000) {
    throw new Error("This note is too large to save.");
  }

  return content;
}

function toNoteRecord(note: Note): NoteRecord {
  return {
    id: note.id,
    title: note.title,
    content: normalizeContent(note.content as NoteContent),
    plainText: note.plainText,
    color: normalizeColor(note.color),
    category: note.category,
    isPinned: note.isPinned,
    trashedAt: note.trashedAt?.toISOString() ?? null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

async function assertOwnedNote(id: number, userId: number) {
  const note = await db.query.notes.findFirst({
    where: and(eq(notes.id, id), eq(notes.userId, userId)),
  });

  if (!note) {
    throw new Error("Note not found.");
  }

  return note;
}

export async function fetchNotes() {
  const user = await getAppUser(false);

  if (!user) {
    return [];
  }

  const records = await db
    .select()
    .from(notes)
    .where(eq(notes.userId, user.id))
    .orderBy(desc(notes.isPinned), desc(notes.updatedAt), desc(notes.createdAt));

  return records.map(toNoteRecord);
}

export async function createNote(input?: {
  title?: string | null;
  color?: string | null;
  category?: string | null;
}) {
  const user = await getAppUser();

  const [created] = await db
    .insert(notes)
    .values({
      userId: user!.id,
      title: normalizeTitle(input?.title),
      content: { ...EMPTY_NOTE_CONTENT },
      plainText: null,
      color: normalizeColor(input?.color),
      category: await normalizeCategory(user!.id, input?.category),
    })
    .returning();

  revalidatePath("/notes");
  return toNoteRecord(created);
}

export async function updateNote(id: number, input: NoteUpdateInput) {
  const user = await getAppUser();
  await assertOwnedNote(id, user!.id);

  const values: Partial<typeof notes.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.title !== undefined) {
    values.title = normalizeTitle(input.title);
  }

  if (input.content !== undefined) {
    values.content = normalizeContent(input.content);
  }

  if (input.plainText !== undefined) {
    values.plainText = normalizePlainText(input.plainText);
  }

  if (input.category !== undefined) {
    values.category = await normalizeCategory(user!.id, input.category);
  }

  const [updated] = await db
    .update(notes)
    .set(values)
    .where(and(eq(notes.id, id), eq(notes.userId, user!.id)))
    .returning();

  revalidatePath("/notes");
  return toNoteRecord(updated);
}

export async function renameNote(id: number, title: string) {
  const user = await getAppUser();
  await assertOwnedNote(id, user!.id);

  const [updated] = await db
    .update(notes)
    .set({
      title: normalizeTitle(title),
      updatedAt: new Date(),
    })
    .where(and(eq(notes.id, id), eq(notes.userId, user!.id)))
    .returning();

  revalidatePath("/notes");
  return toNoteRecord(updated);
}

export async function duplicateNote(id: number) {
  const user = await getAppUser();
  const source = await assertOwnedNote(id, user!.id);

  const [created] = await db
    .insert(notes)
    .values({
      userId: user!.id,
      title: `Copy of ${source.title}`.slice(0, 120),
      content: source.content,
      plainText: source.plainText,
      color: normalizeColor(source.color),
      category: await normalizeCategory(user!.id, source.category),
      isPinned: false,
    })
    .returning();

  revalidatePath("/notes");
  return toNoteRecord(created);
}

export async function updateNoteColor(id: number, color: string) {
  const user = await getAppUser();
  await assertOwnedNote(id, user!.id);

  const [updated] = await db
    .update(notes)
    .set({
      color: normalizeColor(color),
      updatedAt: new Date(),
    })
    .where(and(eq(notes.id, id), eq(notes.userId, user!.id)))
    .returning();

  revalidatePath("/notes");
  return toNoteRecord(updated);
}

export async function updateNoteCategory(id: number, category: string) {
  const user = await getAppUser();
  await assertOwnedNote(id, user!.id);

  const [updated] = await db
    .update(notes)
    .set({
      category: await normalizeCategory(user!.id, category),
      updatedAt: new Date(),
    })
    .where(and(eq(notes.id, id), eq(notes.userId, user!.id)))
    .returning();

  revalidatePath("/notes");
  return toNoteRecord(updated);
}

export async function toggleNotePinned(id: number, pinned?: boolean) {
  const user = await getAppUser();
  const note = await assertOwnedNote(id, user!.id);

  const [updated] = await db
    .update(notes)
    .set({
      isPinned: pinned ?? !note.isPinned,
      updatedAt: new Date(),
    })
    .where(and(eq(notes.id, id), eq(notes.userId, user!.id)))
    .returning();

  revalidatePath("/notes");
  return toNoteRecord(updated);
}

export async function moveNoteToTrash(id: number) {
  const user = await getAppUser();
  await assertOwnedNote(id, user!.id);

  const [updated] = await db
    .update(notes)
    .set({
      trashedAt: new Date(),
      isPinned: false,
      updatedAt: new Date(),
    })
    .where(and(eq(notes.id, id), eq(notes.userId, user!.id)))
    .returning();

  revalidatePath("/notes");
  return toNoteRecord(updated);
}

export async function restoreNote(id: number) {
  const user = await getAppUser();
  await assertOwnedNote(id, user!.id);

  const [updated] = await db
    .update(notes)
    .set({
      trashedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(notes.id, id), eq(notes.userId, user!.id)))
    .returning();

  revalidatePath("/notes");
  return toNoteRecord(updated);
}

export async function permanentlyDeleteNote(id: number) {
  const user = await getAppUser();
  await assertOwnedNote(id, user!.id);

  await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, user!.id)));

  revalidatePath("/notes");
  return { id };
}
