import { fetchKanbanBoards } from "@/lib/actions/kanban";
import { fetchKanbanPagePreferences } from "@/lib/actions/settings";
import { KanbanPageClient } from "./kanban-page-client";

export default async function KanbanPage() {
  const [boards, preferences] = await Promise.all([
    fetchKanbanBoards(),
    fetchKanbanPagePreferences(),
  ]);
  const defaultTaskPriority =
    preferences?.defaultTaskPriority === "Low" || preferences?.defaultTaskPriority === "High"
      ? preferences.defaultTaskPriority
      : "Medium";

  return (
    <KanbanPageClient
      initialBoards={boards}
      defaultTaskPriority={defaultTaskPriority}
    />
  );
}
