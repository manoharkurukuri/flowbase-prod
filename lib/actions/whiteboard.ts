"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { whiteboards, type Whiteboard } from "@/db/schema";
import { syncUser } from "@/lib/actions/sync-user";
import {
  EMPTY_WHITEBOARD_SCENE,
  WHITEBOARD_COLORS,
  type WhiteboardColor,
  type WhiteboardRecord,
  type WhiteboardScene,
} from "@/lib/whiteboard";

const WHITEBOARD_COLOR_VALUES = WHITEBOARD_COLORS.map((color) => color.value);
const MAX_SCENE_JSON_LENGTH = 8_000_000;

async function getAppUser(required = true) {
  const user = await syncUser();

  if (!user && required) {
    throw new Error("You need to be signed in to manage whiteboards.");
  }

  return user;
}

function normalizeName(name: string | null | undefined) {
  const value = name?.trim().slice(0, 120);
  return value || "Untitled whiteboard";
}

function normalizeColor(color: string | null | undefined): WhiteboardColor {
  if (WHITEBOARD_COLOR_VALUES.includes(color as WhiteboardColor)) {
    return color as WhiteboardColor;
  }

  return WHITEBOARD_COLORS[0].value;
}

function normalizeScene(scene: WhiteboardScene | null | undefined): WhiteboardScene {
  if (!scene || typeof scene !== "object" || !Array.isArray(scene.elements)) {
    return { ...EMPTY_WHITEBOARD_SCENE };
  }

  const appState =
    scene.appState && typeof scene.appState === "object" && !Array.isArray(scene.appState)
      ? scene.appState
      : EMPTY_WHITEBOARD_SCENE.appState;

  const files =
    scene.files && typeof scene.files === "object" && !Array.isArray(scene.files)
      ? scene.files
      : EMPTY_WHITEBOARD_SCENE.files;

  const normalized: WhiteboardScene = {
    type: typeof scene.type === "string" ? scene.type : "excalidraw",
    version: typeof scene.version === "number" ? scene.version : 2,
    source: typeof scene.source === "string" ? scene.source : "flowbase",
    elements: scene.elements,
    appState,
    files,
  };

  if (JSON.stringify(normalized).length > MAX_SCENE_JSON_LENGTH) {
    throw new Error("This whiteboard is too large to save.");
  }

  return normalized;
}

function toWhiteboardRecord(whiteboard: Whiteboard): WhiteboardRecord {
  return {
    id: whiteboard.id,
    name: whiteboard.name,
    color: normalizeColor(whiteboard.color),
    scene: normalizeScene(whiteboard.scene as WhiteboardScene),
    createdAt: whiteboard.createdAt.toISOString(),
    updatedAt: whiteboard.updatedAt.toISOString(),
  };
}

async function assertOwnedWhiteboard(id: number, userId: number) {
  const whiteboard = await db.query.whiteboards.findFirst({
    where: and(eq(whiteboards.id, id), eq(whiteboards.userId, userId)),
  });

  if (!whiteboard) {
    throw new Error("Whiteboard not found.");
  }

  return whiteboard;
}

export async function fetchWhiteboards() {
  const user = await getAppUser(false);

  if (!user) {
    return [];
  }

  const records = await db
    .select()
    .from(whiteboards)
    .where(eq(whiteboards.userId, user.id))
    .orderBy(desc(whiteboards.updatedAt), desc(whiteboards.createdAt));

  return records.map(toWhiteboardRecord);
}

export async function createWhiteboard(input?: { name?: string | null; color?: string | null }) {
  const user = await getAppUser();

  const [created] = await db
    .insert(whiteboards)
    .values({
      userId: user!.id,
      name: normalizeName(input?.name),
      color: normalizeColor(input?.color),
      scene: { ...EMPTY_WHITEBOARD_SCENE },
    })
    .returning();

  revalidatePath("/whiteboard");
  return toWhiteboardRecord(created);
}

export async function renameWhiteboard(id: number, name: string) {
  const user = await getAppUser();
  await assertOwnedWhiteboard(id, user!.id);

  const [updated] = await db
    .update(whiteboards)
    .set({
      name: normalizeName(name),
      updatedAt: new Date(),
    })
    .where(and(eq(whiteboards.id, id), eq(whiteboards.userId, user!.id)))
    .returning();

  revalidatePath("/whiteboard");
  return toWhiteboardRecord(updated);
}

export async function deleteWhiteboard(id: number) {
  const user = await getAppUser();
  await assertOwnedWhiteboard(id, user!.id);

  await db
    .delete(whiteboards)
    .where(and(eq(whiteboards.id, id), eq(whiteboards.userId, user!.id)));

  revalidatePath("/whiteboard");
  return { id };
}

export async function updateWhiteboardScene(id: number, scene: WhiteboardScene) {
  const user = await getAppUser();
  await assertOwnedWhiteboard(id, user!.id);

  const [updated] = await db
    .update(whiteboards)
    .set({
      scene: normalizeScene(scene),
      updatedAt: new Date(),
    })
    .where(and(eq(whiteboards.id, id), eq(whiteboards.userId, user!.id)))
    .returning();

  revalidatePath("/whiteboard");
  return toWhiteboardRecord(updated);
}

export async function updateWhiteboardColor(id: number, color: string) {
  const user = await getAppUser();
  await assertOwnedWhiteboard(id, user!.id);

  const [updated] = await db
    .update(whiteboards)
    .set({
      color: normalizeColor(color),
      updatedAt: new Date(),
    })
    .where(and(eq(whiteboards.id, id), eq(whiteboards.userId, user!.id)))
    .returning();

  revalidatePath("/whiteboard");
  return toWhiteboardRecord(updated);
}
