import { db } from "@/db";
import { users } from "@/db/schema";
import { acceptPendingCollaborationsForUser } from "@/lib/kanban-collaboration";
import { normalizeCollaborationEmail } from "@/lib/collaboration";
import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

export async function syncUser() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  const normalizedEmail = normalizeCollaborationEmail(email);

  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    null;

  // Return existing user if already synced
  const existingUser = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkUser.id),
  });

  if (existingUser) {
    const [updatedUser] = await db
      .update(users)
      .set({ name, email: normalizedEmail })
      .where(eq(users.id, existingUser.id))
      .returning();

    await acceptPendingCollaborationsForUser(updatedUser);
    return updatedUser;
  }

  // Insert new user on first sign-in/sign-up
  const [newUser] = await db
    .insert(users)
    .values({ clerkId: clerkUser.id, name, email: normalizedEmail })
    .returning();

  await acceptPendingCollaborationsForUser(newUser);
  return newUser;
}
