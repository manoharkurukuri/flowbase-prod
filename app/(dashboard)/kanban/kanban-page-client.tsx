"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
  useEventListener,
  useMyPresence,
  useOthers,
  useSelf,
  useThreads,
} from "@liveblocks/react/suspense";
import { Composer, Thread } from "@liveblocks/react-ui";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock3,
  Columns3,
  Edit3,
  FileText,
  Flag,
  GripVertical,
  KanbanSquare,
  Layers3,
  ListPlus,
  Mail,
  MessageCircle,
  Palette,
  Plus,
  Save,
  Send,
  Settings,
  Share2,
  Sparkles,
  Tags,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  createKanbanBoard,
  createKanbanColumn,
  createKanbanTask,
  deleteKanbanColumn,
  deleteKanbanTask,
  fetchKanbanBoardCollaboration,
  fetchKanbanBoards,
  inviteKanbanBoardCollaborator,
  moveKanbanTask,
  updateKanbanColumn,
  updateKanbanTask,
} from "@/lib/actions/kanban";
import {
  isValidCollaborationEmail,
  normalizeCollaborationEmail,
  type CollaborationSummaryRecord,
} from "@/lib/collaboration";
import {
  KANBAN_BOARD_COLORS,
  KANBAN_LABELS,
  KANBAN_PRIORITIES,
  MAX_KANBAN_COLUMNS,
  getKanbanLabelMeta,
  getPriorityMeta,
  type KanbanBoardRecord,
  type KanbanColumnRecord,
  type KanbanPriority,
  type KanbanTaskFormInput,
  type KanbanTaskRecord,
} from "@/lib/kanban";
import { cn } from "@/lib/utils";
import { resolveLiveblocksUsers } from "@/liveblocks.config";

type BoardFormState = {
  name: string;
  color: string;
};

type ColumnDialogState =
  | {
      mode: "create";
      boardId: number;
      name: string;
    }
  | {
      mode: "edit";
      columnId: number;
      name: string;
    };

type TaskDialogState =
  | {
      mode: "create";
      columnId: number;
    }
  | {
      mode: "edit";
      task: KanbanTaskRecord;
    };

type TaskDialogTab = "details" | "comments";

type TaskFormState = {
  columnId: number;
  title: string;
  description: string;
  dueDate: string;
  priority: KanbanPriority;
  labelIds: string[];
  syncToCalendar: boolean;
  linkedToNotes: boolean;
};

type DropTarget = {
  columnId: number;
  taskId: number | null;
  position: "before" | "after";
};

type KanbanPageClientProps = {
  initialBoards: KanbanBoardRecord[];
};

type CollaborationPanelState = CollaborationSummaryRecord & {
  inviteEmail: string;
  error: string | null;
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDueDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function getEmptyTaskForm(columnId: number): TaskFormState {
  return {
    columnId,
    title: "",
    description: "",
    dueDate: toDateKey(new Date()),
    priority: "Medium",
    labelIds: [],
    syncToCalendar: false,
    linkedToNotes: false,
  };
}

function getTaskForm(task: KanbanTaskRecord): TaskFormState {
  return {
    columnId: task.columnId,
    title: task.title,
    description: task.description ?? "",
    dueDate: task.dueDate,
    priority: task.priority,
    labelIds: task.labelIds,
    syncToCalendar: task.syncToCalendar,
    linkedToNotes: task.linkedToNotes,
  };
}

function getBoardTaskCount(board: KanbanBoardRecord) {
  return board.columns.reduce((total, column) => total + column.tasks.length, 0);
}

function updateTaskOnBoard(
  board: KanbanBoardRecord,
  updatedTask: KanbanTaskRecord
): KanbanBoardRecord {
  return {
    ...board,
    columns: board.columns.map((column) => {
      const withoutTask = column.tasks.filter((task) => task.id !== updatedTask.id);

      if (column.id !== updatedTask.columnId) {
        return { ...column, tasks: withoutTask };
      }

      const existingIndex = column.tasks.findIndex((task) => task.id === updatedTask.id);
      const nextTasks = [...withoutTask];
      nextTasks.splice(existingIndex >= 0 ? existingIndex : nextTasks.length, 0, updatedTask);

      return {
        ...column,
        tasks: nextTasks.map((task, position) => ({ ...task, position, columnId: column.id })),
      };
    }),
  };
}

function removeTaskFromBoard(board: KanbanBoardRecord, taskId: number): KanbanBoardRecord {
  return {
    ...board,
    columns: board.columns.map((column) => ({
      ...column,
      tasks: column.tasks
        .filter((task) => task.id !== taskId)
        .map((task, position) => ({ ...task, position })),
    })),
  };
}

function moveTaskOnBoard(
  board: KanbanBoardRecord,
  taskId: number,
  target: DropTarget
): KanbanBoardRecord {
  const taskToMove = board.columns
    .flatMap((column) => column.tasks)
    .find((task) => task.id === taskId);

  if (!taskToMove) {
    return board;
  }

  let columns = board.columns.map((column) => {
    const tasks = column.tasks.filter((task) => task.id !== taskId);

    return { ...column, tasks };
  });

  const targetColumnIndex = columns.findIndex((column) => column.id === target.columnId);

  if (targetColumnIndex === -1) {
    return board;
  }

  const targetColumn = columns[targetColumnIndex];
  const targetTasks = [...targetColumn.tasks];
  let insertIndex = targetTasks.length;

  if (target.taskId && target.taskId !== taskId) {
    const hoveredIndex = targetTasks.findIndex((task) => task.id === target.taskId);

    if (hoveredIndex >= 0) {
      insertIndex = hoveredIndex + (target.position === "after" ? 1 : 0);
    }
  }

  targetTasks.splice(insertIndex, 0, { ...taskToMove, columnId: target.columnId });
  columns[targetColumnIndex] = { ...targetColumn, tasks: targetTasks };

  columns = columns.map((column) => ({
    ...column,
    tasks: column.tasks.map((task, position) => ({
      ...task,
      columnId: column.id,
      position,
    })),
  }));

  return { ...board, columns };
}

export function KanbanPageClient({ initialBoards }: KanbanPageClientProps) {
  const [boards, setBoards] = useState(initialBoards);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(
    initialBoards[0]?.id ?? null
  );
  const [boardDialogOpen, setBoardDialogOpen] = useState(false);
  const [boardForm, setBoardForm] = useState<BoardFormState>({
    name: "",
    color: KANBAN_BOARD_COLORS[0],
  });
  const [columnDialog, setColumnDialog] = useState<ColumnDialogState | null>(null);
  const [columnToDelete, setColumnToDelete] = useState<KanbanColumnRecord | null>(null);
  const [taskDialog, setTaskDialog] = useState<TaskDialogState | null>(null);
  const [taskDialogTab, setTaskDialogTab] = useState<TaskDialogTab>("details");
  const [taskForm, setTaskForm] = useState<TaskFormState>(() => getEmptyTaskForm(0));
  const [collaborationPanel, setCollaborationPanel] =
    useState<CollaborationPanelState | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedBoard = useMemo(() => {
    return boards.find((board) => board.id === selectedBoardId) ?? boards[0] ?? null;
  }, [boards, selectedBoardId]);

  function updateBoard(boardId: number, updater: (board: KanbanBoardRecord) => KanbanBoardRecord) {
    setBoards((current) =>
      current.map((board) => (board.id === boardId ? updater(board) : board))
    );
  }

  function refreshBoardsFromServer() {
    startTransition(async () => {
      try {
        const nextBoards = await fetchKanbanBoards();
        setBoards(nextBoards);
        setSelectedBoardId((current) => {
          if (current && nextBoards.some((board) => board.id === current)) {
            return current;
          }

          return nextBoards[0]?.id ?? null;
        });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not refresh the board.");
      }
    });
  }

  function openBoardDialog() {
    setBoardForm({ name: "", color: KANBAN_BOARD_COLORS[0] });
    setError(null);
    setBoardDialogOpen(true);
  }

  function handleCreateBoard() {
    if (!boardForm.name.trim()) {
      setError("Add a board name first.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const board = await createKanbanBoard({
          name: boardForm.name,
          color: boardForm.color,
        });
        setBoards((current) => [...current, board]);
        setSelectedBoardId(board.id);
        setBoardDialogOpen(false);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not create the board.");
      }
    });
  }

  function openCreateColumnDialog() {
    if (!selectedBoard) return;

    if (selectedBoard.columns.length >= MAX_KANBAN_COLUMNS) {
      setError(`Boards can have up to ${MAX_KANBAN_COLUMNS} columns.`);
      return;
    }

    setError(null);
    setColumnDialog({ mode: "create", boardId: selectedBoard.id, name: "" });
  }

  function openEditColumnDialog(column: KanbanColumnRecord) {
    setError(null);
    setColumnDialog({ mode: "edit", columnId: column.id, name: column.name });
  }

  function handleSaveColumn() {
    if (!columnDialog?.name.trim()) {
      setError("Add a column name first.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        if (columnDialog.mode === "create") {
          const column = await createKanbanColumn({
            boardId: columnDialog.boardId,
            name: columnDialog.name,
          });
          updateBoard(columnDialog.boardId, (board) => ({
            ...board,
            columns: [...board.columns, column],
          }));
        } else {
          const column = await updateKanbanColumn(columnDialog.columnId, columnDialog.name);
          updateBoard(column.boardId, (board) => ({
            ...board,
            columns: board.columns.map((currentColumn) =>
              currentColumn.id === column.id
                ? { ...currentColumn, name: column.name, updatedAt: column.updatedAt }
                : currentColumn
            ),
          }));
        }

        setColumnDialog(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not save the column.");
      }
    });
  }

  function handleDeleteColumn() {
    if (!columnToDelete) return;

    const column = columnToDelete;
    const previousBoards = boards;
    setColumnToDelete(null);
    updateBoard(column.boardId, (board) => ({
      ...board,
      columns: board.columns.filter((currentColumn) => currentColumn.id !== column.id),
    }));

    startTransition(async () => {
      try {
        await deleteKanbanColumn(column.id);
      } catch (caught) {
        setBoards(previousBoards);
        setError(caught instanceof Error ? caught.message : "Could not delete the column.");
      }
    });
  }

  function openCreateTaskDialog(columnId: number) {
    setTaskForm(getEmptyTaskForm(columnId));
    setTaskDialog({ mode: "create", columnId });
    setTaskDialogTab("details");
    setError(null);
  }

  function openEditTaskDialog(task: KanbanTaskRecord) {
    setTaskForm(getTaskForm(task));
    setTaskDialog({ mode: "edit", task });
    setTaskDialogTab("details");
    setError(null);
  }

  function openTaskComments(task: KanbanTaskRecord) {
    setTaskForm(getTaskForm(task));
    setTaskDialog({ mode: "edit", task });
    setTaskDialogTab("comments");
    setError(null);
  }

  function getTaskPayload(): KanbanTaskFormInput {
    return {
      columnId: taskForm.columnId,
      title: taskForm.title,
      description: taskForm.description,
      dueDate: taskForm.dueDate,
      priority: taskForm.priority,
      labelIds: taskForm.labelIds,
      syncToCalendar: taskForm.syncToCalendar,
      linkedToNotes: taskForm.linkedToNotes,
    };
  }

  function handleSaveTask() {
    if (!taskDialog) return;

    if (!taskForm.title.trim()) {
      setError("Add a task title first.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        if (taskDialog.mode === "create") {
          const task = await createKanbanTask(getTaskPayload());
          updateBoard(task.boardId, (board) => ({
            ...board,
            columns: board.columns.map((column) =>
              column.id === task.columnId
                ? { ...column, tasks: [...column.tasks, task] }
                : column
            ),
          }));
        } else {
          const task = await updateKanbanTask(taskDialog.task.id, getTaskPayload());
          updateBoard(task.boardId, (board) => updateTaskOnBoard(board, task));
        }

        setTaskDialog(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not save the task.");
      }
    });
  }

  function handleDeleteTask() {
    if (!taskDialog || taskDialog.mode !== "edit") return;

    const task = taskDialog.task;
    const previousBoards = boards;
    updateBoard(task.boardId, (board) => removeTaskFromBoard(board, task.id));
    setTaskDialog(null);

    startTransition(async () => {
      try {
        await deleteKanbanTask(task.id);
      } catch (caught) {
        setBoards(previousBoards);
        setError(caught instanceof Error ? caught.message : "Could not delete the task.");
      }
    });
  }

  function handleDragStart(event: React.DragEvent, task: KanbanTaskRecord) {
    event.dataTransfer.setData("application/x-flowbase-kanban-task", String(task.id));
    event.dataTransfer.effectAllowed = "move";
    setDraggingTaskId(task.id);
    setDropTarget({
      columnId: task.columnId,
      taskId: task.id,
      position: "after",
    });
  }

  function handleTaskDragOver(
    event: React.DragEvent,
    columnId: number,
    taskId: number
  ) {
    event.preventDefault();
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setDropTarget({ columnId, taskId, position });
  }

  function handleColumnDragOver(event: React.DragEvent, columnId: number) {
    event.preventDefault();

    if (!dropTarget || dropTarget.columnId !== columnId) {
      setDropTarget({ columnId, taskId: null, position: "after" });
    }
  }

  function handleDrop(event: React.DragEvent, fallbackColumnId: number) {
    event.preventDefault();

    if (!selectedBoard || !draggingTaskId) {
      setDraggingTaskId(null);
      setDropTarget(null);
      return;
    }

    const target = dropTarget ?? {
      columnId: fallbackColumnId,
      taskId: null,
      position: "after" as const,
    };
    const taskId = draggingTaskId;
    const previousBoards = boards;
    const movedBoard = moveTaskOnBoard(selectedBoard, taskId, target);
    const nextBoards = boards.map((board) =>
      board.id === selectedBoard.id ? movedBoard : board
    );

    setBoards(nextBoards);
    setDraggingTaskId(null);
    setDropTarget(null);

    const columns = movedBoard.columns.map((column) => ({
      columnId: column.id,
      taskIds: column.tasks.map((task) => task.id),
    }));

    startTransition(async () => {
      try {
        await moveKanbanTask(taskId, target.columnId, columns);
      } catch (caught) {
        setBoards(previousBoards);
        setError(caught instanceof Error ? caught.message : "Could not move the task.");
      }
    });
  }

  function toggleLabel(labelId: string) {
    setTaskForm((current) => ({
      ...current,
      labelIds: current.labelIds.includes(labelId)
        ? current.labelIds.filter((id) => id !== labelId)
        : [...current.labelIds, labelId],
    }));
  }

  function openCollaborationPanel() {
    if (!selectedBoard) return;

    setCollaborationPanel({
      boardId: selectedBoard.id,
      members: [],
      inviteEmail: "",
      error: null,
    });

    startTransition(async () => {
      try {
        const collaboration = await fetchKanbanBoardCollaboration(selectedBoard.id);
        setCollaborationPanel({
          ...collaboration,
          inviteEmail: "",
          error: null,
        });
      } catch (caught) {
        setCollaborationPanel((current) =>
          current
            ? {
                ...current,
                error:
                  caught instanceof Error
                    ? caught.message
                    : "Could not load collaboration settings.",
              }
            : current
        );
      }
    });
  }

  function updateInviteEmail(email: string) {
    setCollaborationPanel((current) =>
      current
        ? {
            ...current,
            inviteEmail: email,
            error: null,
          }
        : current
    );
  }

  function handleInviteCollaborator() {
    if (!collaborationPanel) return;

    const email = normalizeCollaborationEmail(collaborationPanel.inviteEmail);

    if (!isValidCollaborationEmail(email)) {
      setCollaborationPanel({
        ...collaborationPanel,
        error: "Add a valid email address.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const collaboration = await inviteKanbanBoardCollaborator(
          collaborationPanel.boardId,
          email
        );
        setCollaborationPanel({
          ...collaboration,
          inviteEmail: "",
          error: null,
        });
      } catch (caught) {
        setCollaborationPanel((current) =>
          current
            ? {
                ...current,
                error: caught instanceof Error ? caught.message : "Could not send that invite.",
              }
            : current
        );
      }
    });
  }

  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks-auth" resolveUsers={resolveLiveblocksUsers}>
    <div className="min-h-full p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <KanbanSquare size={17} className="text-orange-500" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-500">
                Task / Kanban
              </span>
            </div>
            <h1 className="text-[26px] font-bold text-indigo-950">Shape the day into lanes</h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-6 text-slate-400">
              Keep active work visible, move tasks as momentum changes, and sync dated work
              back to your calendar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedBoard && (
              <button
                onClick={openCreateColumnDialog}
                disabled={selectedBoard.columns.length >= MAX_KANBAN_COLUMNS}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-100 bg-white px-3.5 py-2 text-[11.5px] font-semibold text-violet-600 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Columns3 size={14} />
                Add column
              </button>
            )}
            <button
              onClick={openBoardDialog}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2 text-[11.5px] font-semibold text-white shadow-sm transition hover:bg-violet-700"
            >
              <Plus size={14} />
              New board
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] font-medium text-rose-600">
            {error}
          </div>
        )}

        <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="min-w-0 overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <Layers3 size={15} className="text-violet-500" />
                  <h2 className="text-[14px] font-bold text-indigo-950">Boards</h2>
                </div>
                <p className="text-[11px] text-slate-400">{boards.length} saved boards</p>
              </div>
              <button
                onClick={openBoardDialog}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-500 transition hover:bg-orange-100"
                aria-label="Create board"
              >
                <Plus size={15} />
              </button>
            </div>

            <div className="flex max-h-[calc(100vh-260px)] flex-col gap-2 overflow-y-auto p-3">
              {boards.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <Sparkles size={18} className="mx-auto mb-2 text-orange-400" />
                  <p className="text-[12px] font-semibold text-slate-600">No boards yet</p>
                  <button
                    onClick={openBoardDialog}
                    className="mx-auto mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-[11.5px] font-semibold text-white shadow-sm transition hover:bg-violet-700"
                  >
                    <Plus size={13} />
                    Create board
                  </button>
                </div>
              ) : (
                boards.map((board) => {
                  const isSelected = selectedBoard?.id === board.id;

                  return (
                    <button
                      key={board.id}
                      onClick={() => setSelectedBoardId(board.id)}
                      className={cn(
                        "group flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 text-left transition",
                        isSelected
                          ? "border-violet-200 bg-violet-50 shadow-sm"
                          : "border-slate-100 bg-white hover:border-violet-100 hover:bg-slate-50"
                      )}
                    >
                      <span
                        className="h-8 w-2 rounded-full shadow-sm"
                        style={{ backgroundColor: board.color }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-bold text-slate-700">
                          {board.name}
                        </span>
                        <span className="mt-0.5 block text-[10.5px] font-medium text-slate-400">
                          {board.columns.length} columns / {getBoardTaskCount(board)} tasks
                        </span>
                      </span>
                      {isSelected && (
                        <Check size={14} className="shrink-0 text-violet-600" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {selectedBoard ? (
            <RoomProvider
              key={selectedBoard.roomId}
              id={selectedBoard.roomId}
              initialPresence={{
                mode: "viewing",
                activeTaskId: null,
                status: "Viewing board",
              }}
            >
              <ClientSideSuspense fallback={<KanbanBoardLoadingSection board={selectedBoard} />}>
                <KanbanRoomBridge
                  boardId={selectedBoard.id}
                  onRemoteBoardChange={refreshBoardsFromServer}
                >
                  <KanbanBoardRoomSection
                    board={selectedBoard}
                    draggingTaskId={draggingTaskId}
                    dropTarget={dropTarget}
                    onAddColumn={openCreateColumnDialog}
                    onOpenCollaboration={openCollaborationPanel}
                    onAddTask={openCreateTaskDialog}
                    onEditColumn={openEditColumnDialog}
                    onDeleteColumn={setColumnToDelete}
                    onDragStart={handleDragStart}
                    onTaskDragOver={handleTaskDragOver}
                    onColumnDragOver={handleColumnDragOver}
                    onDrop={handleDrop}
                    onEditTask={openEditTaskDialog}
                    onOpenTaskComments={openTaskComments}
                  />

                  {taskDialog && (
                    <TaskDialogModal
                      boardId={selectedBoard.id}
                      taskDialog={taskDialog}
                      taskDialogTab={taskDialogTab}
                      taskForm={taskForm}
                      error={error}
                      isPending={isPending}
                      onSetTaskForm={setTaskForm}
                      onSetTaskDialogTab={setTaskDialogTab}
                      onClose={() => setTaskDialog(null)}
                      onToggleLabel={toggleLabel}
                      onDeleteTask={handleDeleteTask}
                      onSaveTask={handleSaveTask}
                    />
                  )}
                </KanbanRoomBridge>
              </ClientSideSuspense>
            </RoomProvider>
          ) : (
            <EmptyKanbanBoardSection onNewBoard={openBoardDialog} />
          )}
        </div>
      </div>

      {boardDialogOpen && (
        <DialogShell
          title="New Kanban board"
          description="Name the board and give it a color."
          icon={<Palette size={16} className="text-orange-500" />}
          onClose={() => setBoardDialogOpen(false)}
        >
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Board name
              </span>
              <input
                value={boardForm.name}
                onChange={(event) => setBoardForm({ ...boardForm, name: event.target.value })}
                placeholder="Launch plan"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              />
            </label>

            <div>
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Board color
              </span>
              <div className="flex flex-wrap gap-2">
                {KANBAN_BOARD_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setBoardForm({ ...boardForm, color })}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl border border-white shadow-sm ring-offset-2 transition hover:scale-105",
                      boardForm.color === color && "ring-2 ring-violet-400"
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Use ${color} board color`}
                  >
                    {boardForm.color === color && <Check size={14} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {error && <DialogError message={error} />}

            <DialogActions
              onCancel={() => setBoardDialogOpen(false)}
              onSave={handleCreateBoard}
              saveLabel="Create board"
              disabled={isPending}
            />
          </div>
        </DialogShell>
      )}

      {columnDialog && (
        <DialogShell
          title={columnDialog.mode === "create" ? "New column" : "Edit column"}
          description="Column names stay compact so the board remains easy to scan."
          icon={<Columns3 size={16} className="text-violet-500" />}
          onClose={() => setColumnDialog(null)}
        >
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Column name
              </span>
              <input
                value={columnDialog.name}
                onChange={(event) =>
                  setColumnDialog({ ...columnDialog, name: event.target.value })
                }
                placeholder="Review"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              />
            </label>

            {error && <DialogError message={error} />}

            <DialogActions
              onCancel={() => setColumnDialog(null)}
              onSave={handleSaveColumn}
              saveLabel={columnDialog.mode === "create" ? "Create column" : "Save column"}
              disabled={isPending}
            />
          </div>
        </DialogShell>
      )}

      {columnToDelete && (
        <DialogShell
          title="Delete column"
          description="Tasks inside this column will also be deleted."
          icon={<AlertTriangle size={16} className="text-rose-500" />}
          onClose={() => setColumnToDelete(null)}
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] leading-5 text-rose-600">
              Delete <strong>{columnToDelete.name}</strong> and its{" "}
              <strong>{columnToDelete.tasks.length}</strong> tasks?
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={() => setColumnToDelete(null)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[11.5px] font-semibold text-slate-500 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteColumn}
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-3.5 py-2 text-[11.5px] font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-60"
              >
                <Trash2 size={13} />
                Delete column
              </button>
            </div>
          </div>
        </DialogShell>
      )}

      {collaborationPanel && selectedBoard && (
        <CollaborationPanel
          board={selectedBoard}
          collaboration={collaborationPanel}
          isPending={isPending}
          onClose={() => setCollaborationPanel(null)}
          onInviteEmailChange={updateInviteEmail}
          onInvite={handleInviteCollaborator}
        />
      )}
    </div>
    </LiveblocksProvider>
  );
}

function KanbanRoomBridge({
  boardId,
  onRemoteBoardChange,
  children,
}: {
  boardId: number;
  onRemoteBoardChange: () => void;
  children: React.ReactNode;
}) {
  const [, updateMyPresence] = useMyPresence();

  useEffect(() => {
    updateMyPresence({
      mode: "viewing",
      activeTaskId: null,
      status: "Viewing board",
    });
  }, [boardId, updateMyPresence]);

  useEventListener(({ event }: { event: { type: string; boardId?: number } }) => {
    if (
      (event.type === "KANBAN_BOARD_CHANGED" || event.type === "KANBAN_MEMBERS_CHANGED") &&
      event.boardId === boardId
    ) {
      onRemoteBoardChange();
    }
  });

  return <>{children}</>;
}

function KanbanBoardLoadingSection({ board }: { board: KanbanBoardRecord }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
      <div className="flex min-h-[560px] items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-500 shadow-sm">
            <Users size={22} />
          </div>
          <h2 className="text-[18px] font-bold text-indigo-950">{board.name}</h2>
          <p className="mt-2 text-[12px] leading-5 text-slate-400">
            Opening the collaboration room...
          </p>
        </div>
      </div>
    </section>
  );
}

function EmptyKanbanBoardSection({ onNewBoard }: { onNewBoard: () => void }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
      <div className="flex min-h-[560px] items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 shadow-sm">
            <KanbanSquare size={22} />
          </div>
          <h2 className="text-[20px] font-bold text-indigo-950">Create your first board</h2>
          <p className="mt-2 text-[13px] leading-6 text-slate-400">
            Boards keep related tasks together with custom colors, columns, labels, and calendar
            sync.
          </p>
          <button
            onClick={onNewBoard}
            className="mx-auto mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-violet-700"
          >
            <Plus size={14} />
            New board
          </button>
        </div>
      </div>
    </section>
  );
}

function KanbanBoardRoomSection({
  board,
  draggingTaskId,
  dropTarget,
  onAddColumn,
  onOpenCollaboration,
  onAddTask,
  onEditColumn,
  onDeleteColumn,
  onDragStart,
  onTaskDragOver,
  onColumnDragOver,
  onDrop,
  onEditTask,
  onOpenTaskComments,
}: {
  board: KanbanBoardRecord;
  draggingTaskId: number | null;
  dropTarget: DropTarget | null;
  onAddColumn: () => void;
  onOpenCollaboration: () => void;
  onAddTask: (columnId: number) => void;
  onEditColumn: (column: KanbanColumnRecord) => void;
  onDeleteColumn: (column: KanbanColumnRecord) => void;
  onDragStart: (event: React.DragEvent, task: KanbanTaskRecord) => void;
  onTaskDragOver: (event: React.DragEvent, columnId: number, taskId: number) => void;
  onColumnDragOver: (event: React.DragEvent, columnId: number) => void;
  onDrop: (event: React.DragEvent, fallbackColumnId: number) => void;
  onEditTask: (task: KanbanTaskRecord) => void;
  onOpenTaskComments: (task: KanbanTaskRecord) => void;
}) {
  const { threads } = useThreads({
    query: {
      metadata: {
        kind: "kanban-task",
        boardId: board.id,
      },
    },
  });
  const commentCounts = useMemo(() => {
    const counts = new Map<number, number>();

    for (const thread of threads) {
      const taskId = Number(thread.metadata?.taskId);
      if (!Number.isInteger(taskId)) continue;

      counts.set(taskId, (counts.get(taskId) ?? 0) + (thread.comments?.length ?? 0));
    }

    return counts;
  }, [threads]);

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: board.color }} />
            <h2 className="truncate text-[18px] font-bold text-indigo-950">{board.name}</h2>
            {board.role === "editor" && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-600">
                Shared
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            {board.columns.length} of {MAX_KANBAN_COLUMNS} columns / {getBoardTaskCount(board)}{" "}
            active tasks
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ActiveCollaborators />
          <button
            onClick={onOpenCollaboration}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3.5 py-2 text-[11.5px] font-semibold text-violet-600 transition hover:border-violet-200 hover:bg-violet-100"
          >
            <Settings size={14} />
            Collaboration
          </button>
          <button
            onClick={onAddColumn}
            disabled={board.columns.length >= MAX_KANBAN_COLUMNS}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-3.5 py-2 text-[11.5px] font-semibold text-orange-600 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ListPlus size={14} />
            Add column
          </button>
        </div>
      </div>

      <div className="min-w-0 overflow-x-auto p-4">
        <div className="flex min-h-[560px] w-max min-w-full gap-4 pb-2">
          {board.columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              commentCounts={commentCounts}
              draggingTaskId={draggingTaskId}
              dropTarget={dropTarget}
              onAddTask={() => onAddTask(column.id)}
              onEditColumn={() => onEditColumn(column)}
              onDeleteColumn={() => onDeleteColumn(column)}
              onDragStart={onDragStart}
              onTaskDragOver={onTaskDragOver}
              onColumnDragOver={onColumnDragOver}
              onDrop={onDrop}
              onEditTask={onEditTask}
              onOpenTaskComments={onOpenTaskComments}
            />
          ))}

          {board.columns.length < MAX_KANBAN_COLUMNS && (
            <button
              onClick={onAddColumn}
              className="flex min-h-[180px] w-[280px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 p-4 text-[12px] font-semibold text-orange-500 transition hover:border-orange-300 hover:bg-orange-50"
            >
              <Plus size={18} />
              Add another column
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function ActiveCollaborators() {
  const self = useSelf();
  const others = useOthers();
  const collaborators = [
    self
      ? {
          id: self.id,
          info: self.info,
          presence: self.presence,
          isSelf: true,
        }
      : null,
    ...others.map((other: any) => ({
      id: other.id,
      info: other.info,
      presence: other.presence,
      isSelf: false,
    })),
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-2.5 py-1.5 shadow-sm">
      <div className="flex -space-x-2">
        {collaborators.slice(0, 5).map((collaborator) => {
          if (!collaborator) return null;

          const label = collaborator.isSelf
            ? `${collaborator.info.name} (you)`
            : collaborator.info.name;

          return (
            <span
              key={`${collaborator.id}-${collaborator.isSelf ? "self" : "other"}`}
              title={`${label} - ${collaborator.presence.status ?? "Active"}`}
              className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[10.5px] font-bold text-white shadow-sm"
              style={{ backgroundColor: collaborator.info.color }}
            >
              {collaborator.info.initials}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" />
            </span>
          );
        })}
      </div>
      <span className="whitespace-nowrap text-[11px] font-semibold text-slate-500">
        {collaborators.length} active
      </span>
    </div>
  );
}

function KanbanColumn({
  column,
  commentCounts,
  draggingTaskId,
  dropTarget,
  onAddTask,
  onEditColumn,
  onDeleteColumn,
  onDragStart,
  onTaskDragOver,
  onColumnDragOver,
  onDrop,
  onEditTask,
  onOpenTaskComments,
}: {
  column: KanbanColumnRecord;
  commentCounts: Map<number, number>;
  draggingTaskId: number | null;
  dropTarget: DropTarget | null;
  onAddTask: () => void;
  onEditColumn: () => void;
  onDeleteColumn: () => void;
  onDragStart: (event: React.DragEvent, task: KanbanTaskRecord) => void;
  onTaskDragOver: (event: React.DragEvent, columnId: number, taskId: number) => void;
  onColumnDragOver: (event: React.DragEvent, columnId: number) => void;
  onDrop: (event: React.DragEvent, fallbackColumnId: number) => void;
  onEditTask: (task: KanbanTaskRecord) => void;
  onOpenTaskComments: (task: KanbanTaskRecord) => void;
}) {
  const isColumnDropTarget = dropTarget?.columnId === column.id;

  return (
    <div
      onDragOver={(event) => onColumnDragOver(event, column.id)}
      onDrop={(event) => onDrop(event, column.id)}
      className={cn(
        "flex w-[280px] shrink-0 flex-col rounded-2xl border bg-slate-50/80 transition",
        isColumnDropTarget ? "border-orange-200 ring-4 ring-orange-100" : "border-slate-100"
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-bold text-indigo-950">{column.name}</h3>
          <p className="mt-0.5 text-[10.5px] font-medium text-slate-400">
            {column.tasks.length} tasks
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onAddTask}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-orange-500 shadow-sm transition hover:bg-orange-50"
            aria-label={`Add task to ${column.name}`}
          >
            <Plus size={13} />
          </button>
          <button
            onClick={onEditColumn}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-violet-500 shadow-sm transition hover:bg-violet-50"
            aria-label={`Edit ${column.name}`}
          >
            <Edit3 size={12} />
          </button>
          <button
            onClick={onDeleteColumn}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-rose-400 shadow-sm transition hover:bg-rose-50 hover:text-rose-500"
            aria-label={`Delete ${column.name}`}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div className="flex min-h-[440px] flex-1 flex-col gap-2 p-3">
        {column.tasks.length === 0 && (
          <button
            onClick={onAddTask}
            className="flex min-h-[116px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-center text-[11.5px] font-semibold text-slate-400 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-500"
          >
            <Plus size={16} className="mb-1" />
            Add task
          </button>
        )}

        {column.tasks.map((task) => (
          <div key={task.id}>
            {dropTarget?.columnId === column.id &&
              dropTarget.taskId === task.id &&
              dropTarget.position === "before" && <DropLine />}
            <TaskCard
              task={task}
              commentCount={commentCounts.get(task.id) ?? 0}
              isDragging={draggingTaskId === task.id}
              onDragStart={onDragStart}
              onDragOver={(event) => onTaskDragOver(event, column.id, task.id)}
              onClick={() => onEditTask(task)}
              onCommentClick={() => onOpenTaskComments(task)}
            />
            {dropTarget?.columnId === column.id &&
              dropTarget.taskId === task.id &&
              dropTarget.position === "after" && <DropLine />}
          </div>
        ))}

        {dropTarget?.columnId === column.id && dropTarget.taskId === null && <DropLine />}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  commentCount,
  isDragging,
  onDragStart,
  onDragOver,
  onClick,
  onCommentClick,
}: {
  task: KanbanTaskRecord;
  commentCount: number;
  isDragging: boolean;
  onDragStart: (event: React.DragEvent, task: KanbanTaskRecord) => void;
  onDragOver: (event: React.DragEvent) => void;
  onClick: () => void;
  onCommentClick: () => void;
}) {
  const priority = getPriorityMeta(task.priority);

  return (
    <div
      draggable
      onDragStart={(event) => onDragStart(event, task)}
      onDragOver={onDragOver}
      onClick={onClick}
      className={cn(
        "group cursor-pointer rounded-xl border border-slate-100 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-100 hover:shadow-md",
        isDragging && "opacity-50"
      )}
    >
      <div className="mb-2 flex items-start gap-2">
        <GripVertical
          size={15}
          className="mt-0.5 shrink-0 cursor-grab text-slate-300 group-active:cursor-grabbing"
        />
        <div className="min-w-0 flex-1">
          <h4 className="break-words text-[12.5px] font-bold leading-5 text-slate-700">
            {task.title}
          </h4>
          {task.description && (
            <p className="mt-1 line-clamp-2 break-words text-[11px] leading-5 text-slate-400">
              {task.description}
            </p>
          )}
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10.5px] font-semibold"
          style={{
            borderColor: priority.border,
            backgroundColor: priority.bg,
            color: priority.color,
          }}
        >
          <Flag size={10} />
          {priority.label}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-[10.5px] font-semibold text-slate-400">
          <CalendarDays size={10} />
          {formatDueDate(task.dueDate)}
        </span>
      </div>

      {task.labelIds.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {task.labelIds.map((labelId) => {
            const label = getKanbanLabelMeta(labelId);
            if (!label) return null;

            return (
              <span
                key={label.id}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold"
                style={{
                  borderColor: label.border,
                  backgroundColor: label.bg,
                  color: label.color,
                }}
              >
                <Tags size={9} />
                {label.label}
              </span>
            );
          })}
        </div>
      )}

      {(task.syncToCalendar || task.linkedToNotes) && (
        <div className="flex flex-wrap gap-1.5 border-t border-slate-50 pt-2">
          {task.syncToCalendar && (
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-semibold text-cyan-600">
              <CalendarDays size={9} />
              Calendar
            </span>
          )}
          {task.linkedToNotes && (
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-1 text-[10px] font-semibold text-yellow-600">
              <FileText size={9} />
              Notes
            </span>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-slate-50 pt-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onCommentClick();
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10.5px] font-semibold transition",
            commentCount > 0
              ? "bg-violet-50 text-violet-600 hover:bg-violet-100"
              : "bg-slate-50 text-slate-400 hover:bg-violet-50 hover:text-violet-600"
          )}
          aria-label={`Open comments for ${task.title}`}
        >
          <MessageCircle size={10} />
          {commentCount}
        </button>
        <span className="text-[10px] font-medium text-slate-300">Discuss</span>
      </div>
    </div>
  );
}

function DropLine() {
  return <div className="my-1 h-2 rounded-full bg-orange-300/80 shadow-sm" />;
}

function TaskDialogModal({
  boardId,
  taskDialog,
  taskDialogTab,
  taskForm,
  error,
  isPending,
  onSetTaskForm,
  onSetTaskDialogTab,
  onClose,
  onToggleLabel,
  onDeleteTask,
  onSaveTask,
}: {
  boardId: number;
  taskDialog: TaskDialogState;
  taskDialogTab: TaskDialogTab;
  taskForm: TaskFormState;
  error: string | null;
  isPending: boolean;
  onSetTaskForm: React.Dispatch<React.SetStateAction<TaskFormState>>;
  onSetTaskDialogTab: (tab: TaskDialogTab) => void;
  onClose: () => void;
  onToggleLabel: (labelId: string) => void;
  onDeleteTask: () => void;
  onSaveTask: () => void;
}) {
  const canShowComments = taskDialog.mode === "edit";

  return (
    <DialogShell
      title={taskDialog.mode === "create" ? "New task" : "Task details"}
      description={
        taskDialogTab === "comments"
          ? "Discuss this task with everyone on the board."
          : "Add the details that should stay visible on the card."
      }
      icon={
        taskDialogTab === "comments" ? (
          <MessageCircle size={16} className="text-violet-500" />
        ) : (
          <Flag size={16} className="text-orange-500" />
        )
      }
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        {canShowComments && (
          <div className="grid grid-cols-2 rounded-xl bg-slate-50 p-1">
            <button
              onClick={() => onSetTaskDialogTab("details")}
              className={cn(
                "rounded-lg px-3 py-2 text-[11.5px] font-bold transition",
                taskDialogTab === "details"
                  ? "bg-white text-violet-600 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              Details
            </button>
            <button
              onClick={() => onSetTaskDialogTab("comments")}
              className={cn(
                "rounded-lg px-3 py-2 text-[11.5px] font-bold transition",
                taskDialogTab === "comments"
                  ? "bg-white text-violet-600 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              Comments
            </button>
          </div>
        )}

        {taskDialogTab === "comments" && canShowComments ? (
          <TaskComments boardId={boardId} task={taskDialog.task} />
        ) : (
          <>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Title
              </span>
              <input
                value={taskForm.title}
                onChange={(event) =>
                  onSetTaskForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Draft weekly review"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Description
              </span>
              <textarea
                value={taskForm.description}
                onChange={(event) =>
                  onSetTaskForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Notes, links, or next steps"
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] leading-5 text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Due date
                </span>
                <input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(event) =>
                    onSetTaskForm((current) => ({ ...current, dueDate: event.target.value }))
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Priority
                </span>
                <select
                  value={taskForm.priority}
                  onChange={(event) =>
                    onSetTaskForm((current) => ({
                      ...current,
                      priority: event.target.value as KanbanPriority,
                    }))
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                >
                  {KANBAN_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Labels
              </span>
              <div className="flex flex-wrap gap-2">
                {KANBAN_LABELS.map((label) => {
                  const selected = taskForm.labelIds.includes(label.id);

                  return (
                    <button
                      key={label.id}
                      onClick={() => onToggleLabel(label.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition",
                        selected && "shadow-sm"
                      )}
                      style={{
                        borderColor: label.border,
                        backgroundColor: selected ? label.bg : "#ffffff",
                        color: label.color,
                      }}
                    >
                      {selected && <Check size={11} />}
                      {label.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ToggleRow
                checked={taskForm.syncToCalendar}
                icon={<CalendarDays size={14} className="text-cyan-500" />}
                title="Sync with Calendar"
                onChange={() =>
                  onSetTaskForm((current) => ({
                    ...current,
                    syncToCalendar: !current.syncToCalendar,
                  }))
                }
              />
              <ToggleRow
                checked={taskForm.linkedToNotes}
                icon={<FileText size={14} className="text-yellow-500" />}
                title="Link with Notes"
                onChange={() =>
                  onSetTaskForm((current) => ({
                    ...current,
                    linkedToNotes: !current.linkedToNotes,
                  }))
                }
              />
            </div>
          </>
        )}

        {error && <DialogError message={error} />}

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {taskDialog.mode === "edit" && (
              <button
                onClick={onDeleteTask}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[11.5px] font-semibold text-rose-500 transition hover:bg-rose-50 disabled:opacity-60"
              >
                <Trash2 size={13} />
                Delete
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[11.5px] font-semibold text-slate-500 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={onSaveTask}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2 text-[11.5px] font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
            >
              <Save size={13} />
              Save task
            </button>
          </div>
        </div>
      </div>
    </DialogShell>
  );
}

function TaskComments({ boardId, task }: { boardId: number; task: KanbanTaskRecord }) {
  const [, updateMyPresence] = useMyPresence();
  const { threads } = useThreads({
    query: {
      metadata: {
        kind: "kanban-task",
        boardId,
        taskId: task.id,
      },
    },
  });

  useEffect(() => {
    updateMyPresence({
      mode: "commenting",
      activeTaskId: task.id,
      status: `Commenting on ${task.title}`,
    });

    return () => {
      updateMyPresence({
        mode: "viewing",
        activeTaskId: null,
        status: "Viewing board",
      });
    };
  }, [task.id, task.title, updateMyPresence]);

  return (
    <div className="space-y-3">
      {threads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-violet-100 bg-violet-50/50 px-4 py-6 text-center">
          <MessageCircle size={18} className="mx-auto mb-2 text-violet-500" />
          <p className="text-[12px] font-bold text-indigo-950">No comments yet</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-400">
            Start a focused thread for this task.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((thread: any) => (
            <div key={thread.id} className="rounded-2xl border border-slate-100 bg-white p-2">
              <Thread thread={thread} showComposer="collapsed" />
            </div>
          ))}
        </div>
      )}

      {threads.length === 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-2">
          <Composer
            metadata={{
              kind: "kanban-task",
              boardId,
              taskId: task.id,
            }}
          />
        </div>
      )}
    </div>
  );
}

function CollaborationPanel({
  board,
  collaboration,
  isPending,
  onClose,
  onInviteEmailChange,
  onInvite,
}: {
  board: KanbanBoardRecord;
  collaboration: CollaborationPanelState;
  isPending: boolean;
  onClose: () => void;
  onInviteEmailChange: (email: string) => void;
  onInvite: () => void;
}) {
  const canInvite = board.role === "owner";
  const activeMembers = collaboration.members.filter((member) => member.status === "active");
  const pendingMembers = collaboration.members.filter((member) => member.status === "pending");

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-indigo-950/20 p-3 backdrop-blur-sm sm:p-4">
      <aside className="flex h-full w-full max-w-md flex-col overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <Share2 size={16} className="text-violet-500" />
              <h2 className="text-[16px] font-bold text-indigo-950">Settings / Collaboration</h2>
            </div>
            <p className="text-[11px] leading-5 text-slate-400">
              Manage who can collaborate on {board.name}.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
            aria-label="Close collaboration panel"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Shared with
              </h3>
              <span className="rounded-full bg-violet-50 px-2 py-1 text-[10.5px] font-bold text-violet-600">
                {collaboration.members.length} people
              </span>
            </div>

            <div className="space-y-2">
              {activeMembers.map((member) => (
                <CollaboratorRow key={member.id} member={member} />
              ))}
              {pendingMembers.length > 0 && (
                <div className="pt-2">
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
                    <Clock3 size={12} />
                    Pending
                  </div>
                  <div className="space-y-2">
                    {pendingMembers.map((member) => (
                      <CollaboratorRow key={member.id} member={member} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-violet-500 shadow-sm">
                <UserPlus size={15} />
              </span>
              <div>
                <h3 className="text-[13px] font-bold text-indigo-950">Invite by email</h3>
                <p className="text-[11px] text-slate-400">Editors can update tasks and comments.</p>
              </div>
            </div>

            {canInvite ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative min-w-0 flex-1">
                  <Mail
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
                  />
                  <input
                    value={collaboration.inviteEmail}
                    onChange={(event) => onInviteEmailChange(event.target.value)}
                    placeholder="teammate@example.com"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  />
                </label>
                <button
                  onClick={onInvite}
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2 text-[11.5px] font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
                >
                  <Send size={13} />
                  Invite
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-100 bg-white px-3 py-3 text-[12px] leading-5 text-slate-500">
                Only the board owner can invite more collaborators.
              </div>
            )}

            {collaboration.error && (
              <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-600">
                {collaboration.error}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function CollaboratorRow({
  member,
}: {
  member: CollaborationSummaryRecord["members"][number];
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm"
        style={{ backgroundColor: member.avatarColor }}
      >
        {member.initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-bold text-slate-700">
          {member.name || member.email}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-slate-400">{member.email}</span>
      </span>
      <span
        className={cn(
          "rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em]",
          member.role === "owner"
            ? "bg-orange-50 text-orange-600"
            : member.status === "pending"
              ? "bg-slate-50 text-slate-400"
              : "bg-emerald-50 text-emerald-600"
        )}
      >
        {member.role === "owner" ? "Owner" : member.status}
      </span>
    </div>
  );
}

function DialogShell({
  title,
  description,
  icon,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/20 p-4 backdrop-blur-sm">
      <div
        className={cn(
          "max-h-[calc(100vh-32px)] w-full overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-lg",
          wide ? "max-w-2xl" : "max-w-lg"
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              {icon}
              <h2 className="text-[16px] font-bold text-indigo-950">{title}</h2>
            </div>
            <p className="text-[11px] leading-5 text-slate-400">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[calc(100vh-128px)] overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

function DialogActions({
  onCancel,
  onSave,
  saveLabel,
  disabled,
}: {
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
      <button
        onClick={onCancel}
        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[11.5px] font-semibold text-slate-500 transition hover:bg-slate-50"
      >
        Cancel
      </button>
      <button
        onClick={onSave}
        disabled={disabled}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2 text-[11.5px] font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
      >
        <Save size={13} />
        {saveLabel}
      </button>
    </div>
  );
}

function DialogError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-600">
      {message}
    </div>
  );
}

function ToggleRow({
  checked,
  icon,
  title,
  onChange,
}: {
  checked: boolean;
  icon: React.ReactNode;
  title: string;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition",
        checked
          ? "border-violet-200 bg-violet-50 shadow-sm"
          : "border-slate-100 bg-white hover:bg-slate-50"
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
          {icon}
        </span>
        <span className="truncate text-[12px] font-semibold text-slate-700">{title}</span>
      </span>
      <span
        className={cn(
          "flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition",
          checked ? "bg-violet-600" : "bg-slate-200"
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-white shadow-sm transition",
            checked && "translate-x-4"
          )}
        />
      </span>
    </button>
  );
}
