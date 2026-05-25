import { fetchKanbanBoards } from "@/lib/actions/kanban";
import { KanbanPageClient } from "./kanban-page-client";

export default async function KanbanPage() {
  const boards = await fetchKanbanBoards();

  return <KanbanPageClient initialBoards={boards} />;
}
