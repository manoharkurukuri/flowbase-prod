import { fetchNotes } from "@/lib/actions/notes";
import { fetchNotesPagePreferences } from "@/lib/actions/settings";
import { DEFAULT_CATEGORIES, toCategoryOption } from "@/lib/settings";
import { NotesPageClient } from "./notes-page-client";

export default async function NotesPage() {
  const [notes, preferences] = await Promise.all([
    fetchNotes(),
    fetchNotesPagePreferences(),
  ]);
  const fallbackCategories = DEFAULT_CATEGORIES.notes.map((category, index) =>
    toCategoryOption({
      id: index,
      userId: 0,
      scope: "notes",
      key: category.key,
      name: category.name,
      color: category.color,
      icon: category.icon,
      position: index,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    })
  );

  return (
    <NotesPageClient
      initialNotes={notes}
      categories={preferences?.categories ?? fallbackCategories}
      autoSaveEnabled={preferences?.autoSaveEnabled ?? true}
    />
  );
}
