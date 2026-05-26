"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { generatedApps, type GeneratedApp } from "@/db/schema";
import { syncUser } from "@/lib/actions/sync-user";
import {
  DEFAULT_TEMPLATE_LAYOUT,
  sanitizeGeneratedTemplate,
  type GeneratedAppRecord,
  type GeneratedTemplateJson,
} from "@/lib/templates";

const SIDEBAR_APP_LIMIT = 3;

async function getAppUser(required = true) {
  const user = await syncUser();

  if (!user && required) {
    throw new Error("You need to be signed in to manage generated apps.");
  }

  return user;
}

function cleanText(value: string | null | undefined, maxLength: number, fallback = "") {
  const text = value?.trim() ?? "";
  return text ? text.slice(0, maxLength) : fallback;
}

function toGeneratedAppRecord(app: GeneratedApp): GeneratedAppRecord {
  const template = sanitizeGeneratedTemplate(app.templateJson, app.prompt);

  return {
    id: app.id,
    prompt: app.prompt,
    appName: cleanText(app.appName, 64, template.appName),
    description: cleanText(app.description, 180, template.description),
    icon: template.icon,
    color: template.color,
    layout: DEFAULT_TEMPLATE_LAYOUT,
    template,
    isInSidebar: app.isInSidebar,
    sidebarPosition: app.sidebarPosition,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
  };
}

export async function fetchGeneratedApps() {
  const user = await getAppUser(false);

  if (!user) {
    return [];
  }

  const apps = await db
    .select()
    .from(generatedApps)
    .where(eq(generatedApps.userId, user.id))
    .orderBy(desc(generatedApps.createdAt));

  return apps.map(toGeneratedAppRecord);
}

export async function fetchSidebarGeneratedApps() {
  const user = await getAppUser(false);

  if (!user) {
    return [];
  }

  const apps = await db
    .select()
    .from(generatedApps)
    .where(and(eq(generatedApps.userId, user.id), eq(generatedApps.isInSidebar, true)))
    .orderBy(asc(generatedApps.sidebarPosition), desc(generatedApps.createdAt));

  return apps.slice(0, SIDEBAR_APP_LIMIT).map(toGeneratedAppRecord);
}

export async function fetchGeneratedApp(id: number) {
  const user = await getAppUser(false);

  if (!user) {
    return null;
  }

  const app = await db.query.generatedApps.findFirst({
    where: and(eq(generatedApps.id, id), eq(generatedApps.userId, user.id)),
  });

  return app ? toGeneratedAppRecord(app) : null;
}

async function assertOwnedGeneratedApp(id: number, userId: number) {
  const app = await db.query.generatedApps.findFirst({
    where: and(eq(generatedApps.id, id), eq(generatedApps.userId, userId)),
  });

  if (!app) {
    throw new Error("Generated app not found.");
  }

  return app;
}

export async function createGeneratedApp(input: {
  prompt: string;
  template: GeneratedTemplateJson;
}) {
  const user = await getAppUser();
  const template = sanitizeGeneratedTemplate(input.template, input.prompt);

  const [created] = await db
    .insert(generatedApps)
    .values({
      userId: user!.id,
      prompt: cleanText(input.prompt, 2000, "Generated app"),
      appName: template.appName,
      description: template.description,
      icon: template.icon,
      color: template.color,
      layout: template.layout,
      templateJson: template,
    })
    .returning();

  revalidatePath("/templates");
  return toGeneratedAppRecord(created);
}

export async function addAppToSidebar(id: number) {
  const user = await getAppUser();
  const app = await assertOwnedGeneratedApp(id, user!.id);

  if (app.isInSidebar) {
    return {
      app: toGeneratedAppRecord(app),
      warning: null,
    };
  }

  const sidebarApps = await db
    .select()
    .from(generatedApps)
    .where(and(eq(generatedApps.userId, user!.id), eq(generatedApps.isInSidebar, true)))
    .orderBy(asc(generatedApps.sidebarPosition), desc(generatedApps.createdAt));

  if (sidebarApps.length >= SIDEBAR_APP_LIMIT) {
    return {
      app: null,
      warning: "You can pin up to 3 generated apps in the sidebar.",
    };
  }

  const nextPosition =
    sidebarApps.reduce((highest, item) => Math.max(highest, item.sidebarPosition ?? 0), 0) + 1;

  const [updated] = await db
    .update(generatedApps)
    .set({
      isInSidebar: true,
      sidebarPosition: nextPosition,
      updatedAt: new Date(),
    })
    .where(and(eq(generatedApps.id, id), eq(generatedApps.userId, user!.id)))
    .returning();

  revalidatePath("/templates");
  revalidatePath(`/templates/${id}`);
  revalidatePath("/", "layout");

  return {
    app: toGeneratedAppRecord(updated),
    warning: null,
  };
}

export async function removeAppFromSidebar(id: number) {
  const user = await getAppUser();
  await assertOwnedGeneratedApp(id, user!.id);

  const [updated] = await db
    .update(generatedApps)
    .set({
      isInSidebar: false,
      sidebarPosition: null,
      updatedAt: new Date(),
    })
    .where(and(eq(generatedApps.id, id), eq(generatedApps.userId, user!.id)))
    .returning();

  revalidatePath("/templates");
  revalidatePath(`/templates/${id}`);
  revalidatePath("/", "layout");

  return toGeneratedAppRecord(updated);
}

export async function deleteGeneratedApp(id: number) {
  const user = await getAppUser();
  await assertOwnedGeneratedApp(id, user!.id);

  await db
    .delete(generatedApps)
    .where(and(eq(generatedApps.id, id), eq(generatedApps.userId, user!.id)));

  revalidatePath("/templates");
  revalidatePath("/", "layout");

  return { id };
}
