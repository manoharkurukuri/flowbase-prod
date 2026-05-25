"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  calendarItems,
  kanbanBoards,
  kanbanColumns,
  kanbanTasks,
  type KanbanBoard,
  type KanbanColumn,
  type KanbanTask,
} from "@/db/schema";
import { syncUser } from "@/lib/actions/sync-user";
import {
  DEFAULT_KANBAN_COLUMNS,
  KANBAN_BOARD_COLORS,
  KANBAN_LABELS,
  KANBAN_PRIORITIES,
  MAX_KANBAN_COLUMNS,
  type KanbanBoardFormInput,
  type KanbanBoardRecord,
  type KanbanColumnFormInput,
  type KanbanColumnRecord,
  type KanbanLabelId,
  type KanbanMoveColumnPayload,
  type KanbanPriority,
  type KanbanTaskFormInput,
  type KanbanTaskRecord,
} from "@/lib/kanban";

const labelValues = KANBAN_LABELS.map((label) => label.id);

async function getAppUser(required = true) {
  const user = await syncUser();

  if (!user && required) {
    throw new Error("You need to be signed in to manage Kanban boards.");
  }

  return user;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cleanText(value: string | null | undefined, maxLength: number) {
  const text = value?.trim() ?? "";
  return text ? text.slice(0, maxLength) : null;
}

function requireText(value: string | null | undefined, maxLength: number, message: string) {
  const text = cleanText(value, maxLength);

  if (!text) {
    throw new Error(message);
  }

  return text;
}

function normalizeBoardColor(color: string | null | undefined) {
  if (KANBAN_BOARD_COLORS.includes(color as (typeof KANBAN_BOARD_COLORS)[number])) {
    return color!;
  }

  return KANBAN_BOARD_COLORS[0];
}

function normalizePriority(priority: string | null | undefined): KanbanPriority {
  if (KANBAN_PRIORITIES.includes(priority as KanbanPriority)) {
    return priority as KanbanPriority;
  }

  return "Medium";
}

function normalizeDate(value: string | null | undefined) {
  const date = value || toDateKey(new Date());

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Use a valid due date.");
  }

  return date;
}

function normalizeLabelIds(labels: string[] | null | undefined): KanbanLabelId[] {
  const seen = new Set<KanbanLabelId>();

  for (const label of labels ?? []) {
    if (labelValues.includes(label as KanbanLabelId)) {
      seen.add(label as KanbanLabelId);
    }
  }

  return Array.from(seen).slice(0, 4);
}

function parseLabelIds(value: string): KanbanLabelId[] {
  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return normalizeLabelIds(parsed);
    }
  } catch {
    return normalizeLabelIds(value.split(","));
  }

  return [];
}

function normalizeTaskInput(input: KanbanTaskFormInput) {
  return {
    title: requireText(input.title, 120, "Tasks need a title."),
    description: cleanText(input.description, 700),
    dueDate: normalizeDate(input.dueDate),
    priority: normalizePriority(input.priority),
    labelIds: normalizeLabelIds(input.labelIds),
    syncToCalendar: Boolean(input.syncToCalendar),
    linkedToNotes: Boolean(input.linkedToNotes),
  };
}

function toTaskRecord(task: KanbanTask): KanbanTaskRecord {
  return {
    id: task.id,
    boardId: task.boardId,
    columnId: task.columnId,
    calendarItemId: task.calendarItemId,
    title: task.title,
    description: task.description,
    dueDate: task.dueDate,
    priority: normalizePriority(task.priority),
    labelIds: parseLabelIds(task.labelIds),
    position: task.position,
    syncToCalendar: task.syncToCalendar,
    linkedToNotes: task.linkedToNotes,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function toColumnRecord(column: KanbanColumn, tasks: KanbanTask[]): KanbanColumnRecord {
  return {
    id: column.id,
    boardId: column.boardId,
    name: column.name,
    position: column.position,
    createdAt: column.createdAt.toISOString(),
    updatedAt: column.updatedAt.toISOString(),
    tasks: tasks.map(toTaskRecord),
  };
}

function toBoardRecord(
  board: KanbanBoard,
  columns: KanbanColumn[],
  tasksByColumnId: Map<number, KanbanTask[]>
): KanbanBoardRecord {
  return {
    id: board.id,
    name: board.name,
    color: board.color,
    position: board.position,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
    columns: columns.map((column) => toColumnRecord(column, tasksByColumnId.get(column.id) ?? [])),
  };
}

async function assertOwnedBoard(boardId: number, userId: number) {
  const board = await db.query.kanbanBoards.findFirst({
    where: and(eq(kanbanBoards.id, boardId), eq(kanbanBoards.userId, userId)),
  });

  if (!board) {
    throw new Error("Kanban board not found.");
  }

  return board;
}

async function assertOwnedColumn(columnId: number, userId: number) {
  const column = await db.query.kanbanColumns.findFirst({
    where: eq(kanbanColumns.id, columnId),
  });

  if (!column) {
    throw new Error("Kanban column not found.");
  }

  await assertOwnedBoard(column.boardId, userId);
  return column;
}

async function assertOwnedTask(taskId: number, userId: number) {
  const task = await db.query.kanbanTasks.findFirst({
    where: eq(kanbanTasks.id, taskId),
  });

  if (!task) {
    throw new Error("Kanban task not found.");
  }

  await assertOwnedBoard(task.boardId, userId);
  return task;
}

async function getNextBoardPosition(userId: number) {
  const [lastBoard] = await db
    .select({ position: kanbanBoards.position })
    .from(kanbanBoards)
    .where(eq(kanbanBoards.userId, userId))
    .orderBy(desc(kanbanBoards.position))
    .limit(1);

  return (lastBoard?.position ?? -1) + 1;
}

async function getNextColumnPosition(boardId: number) {
  const [lastColumn] = await db
    .select({ position: kanbanColumns.position })
    .from(kanbanColumns)
    .where(eq(kanbanColumns.boardId, boardId))
    .orderBy(desc(kanbanColumns.position))
    .limit(1);

  return (lastColumn?.position ?? -1) + 1;
}

async function getNextTaskPosition(columnId: number) {
  const [lastTask] = await db
    .select({ position: kanbanTasks.position })
    .from(kanbanTasks)
    .where(eq(kanbanTasks.columnId, columnId))
    .orderBy(desc(kanbanTasks.position))
    .limit(1);

  return (lastTask?.position ?? -1) + 1;
}

async function createCalendarItemForTask(
  userId: number,
  values: ReturnType<typeof normalizeTaskInput>
) {
  const [created] = await db
    .insert(calendarItems)
    .values({
      userId,
      title: values.title,
      description: values.description?.slice(0, 400) ?? null,
      itemType: "task",
      category: "Work",
      scheduledDate: values.dueDate,
      scheduledTime: null,
    })
    .returning({ id: calendarItems.id });

  return created.id;
}

async function upsertCalendarItemForTask(
  calendarItemId: number | null,
  userId: number,
  values: ReturnType<typeof normalizeTaskInput>
) {
  if (!calendarItemId) {
    return createCalendarItemForTask(userId, values);
  }

  const [updated] = await db
    .update(calendarItems)
    .set({
      title: values.title,
      description: values.description?.slice(0, 400) ?? null,
      itemType: "task",
      category: "Work",
      scheduledDate: values.dueDate,
      scheduledTime: null,
      updatedAt: new Date(),
    })
    .where(and(eq(calendarItems.id, calendarItemId), eq(calendarItems.userId, userId)))
    .returning({ id: calendarItems.id });

  if (updated) {
    return updated.id;
  }

  return createCalendarItemForTask(userId, values);
}

async function deleteCalendarItemForTask(calendarItemId: number | null, userId: number) {
  if (!calendarItemId) return;

  await db
    .delete(calendarItems)
    .where(and(eq(calendarItems.id, calendarItemId), eq(calendarItems.userId, userId)));
}

export async function fetchKanbanBoards() {
  const user = await getAppUser(false);

  if (!user) {
    return [];
  }

  const boards = await db
    .select()
    .from(kanbanBoards)
    .where(eq(kanbanBoards.userId, user.id))
    .orderBy(asc(kanbanBoards.position), asc(kanbanBoards.createdAt));

  const boardIds = boards.map((board) => board.id);

  if (boardIds.length === 0) {
    return [];
  }

  const columns = await db
    .select()
    .from(kanbanColumns)
    .where(inArray(kanbanColumns.boardId, boardIds))
    .orderBy(asc(kanbanColumns.position), asc(kanbanColumns.createdAt));

  const tasks = await db
    .select()
    .from(kanbanTasks)
    .where(inArray(kanbanTasks.boardId, boardIds))
    .orderBy(asc(kanbanTasks.position), asc(kanbanTasks.createdAt));

  const columnsByBoardId = new Map<number, KanbanColumn[]>();
  const tasksByColumnId = new Map<number, KanbanTask[]>();

  for (const column of columns) {
    const current = columnsByBoardId.get(column.boardId) ?? [];
    current.push(column);
    columnsByBoardId.set(column.boardId, current);
  }

  for (const task of tasks) {
    const current = tasksByColumnId.get(task.columnId) ?? [];
    current.push(task);
    tasksByColumnId.set(task.columnId, current);
  }

  return boards.map((board) =>
    toBoardRecord(board, columnsByBoardId.get(board.id) ?? [], tasksByColumnId)
  );
}

export async function createKanbanBoard(input: KanbanBoardFormInput) {
  const user = await getAppUser();
  const position = await getNextBoardPosition(user!.id);

  const [board] = await db
    .insert(kanbanBoards)
    .values({
      userId: user!.id,
      name: requireText(input.name, 80, "Boards need a name."),
      color: normalizeBoardColor(input.color),
      position,
    })
    .returning();

  const columns = await db
    .insert(kanbanColumns)
    .values(
      DEFAULT_KANBAN_COLUMNS.map((name, index) => ({
        boardId: board.id,
        name,
        position: index,
      }))
    )
    .returning();

  revalidatePath("/kanban");
  return toBoardRecord(board, columns, new Map());
}

export async function createKanbanColumn(input: KanbanColumnFormInput) {
  const user = await getAppUser();
  await assertOwnedBoard(input.boardId, user!.id);

  const currentColumns = await db
    .select({ id: kanbanColumns.id })
    .from(kanbanColumns)
    .where(eq(kanbanColumns.boardId, input.boardId));

  if (currentColumns.length >= MAX_KANBAN_COLUMNS) {
    throw new Error(`Boards can have up to ${MAX_KANBAN_COLUMNS} columns.`);
  }

  const [column] = await db
    .insert(kanbanColumns)
    .values({
      boardId: input.boardId,
      name: requireText(input.name, 40, "Columns need a name."),
      position: await getNextColumnPosition(input.boardId),
    })
    .returning();

  revalidatePath("/kanban");
  return toColumnRecord(column, []);
}

export async function updateKanbanColumn(columnId: number, name: string) {
  const user = await getAppUser();
  const column = await assertOwnedColumn(columnId, user!.id);

  const [updated] = await db
    .update(kanbanColumns)
    .set({
      name: requireText(name, 40, "Columns need a name."),
      updatedAt: new Date(),
    })
    .where(eq(kanbanColumns.id, column.id))
    .returning();

  revalidatePath("/kanban");
  return toColumnRecord(updated, []);
}

export async function deleteKanbanColumn(columnId: number) {
  const user = await getAppUser();
  const column = await assertOwnedColumn(columnId, user!.id);

  const tasks = await db
    .select({ calendarItemId: kanbanTasks.calendarItemId })
    .from(kanbanTasks)
    .where(eq(kanbanTasks.columnId, column.id));

  const calendarIds = tasks
    .map((task) => task.calendarItemId)
    .filter((id): id is number => Boolean(id));

  if (calendarIds.length > 0) {
    await db
      .delete(calendarItems)
      .where(and(inArray(calendarItems.id, calendarIds), eq(calendarItems.userId, user!.id)));
  }

  await db.delete(kanbanColumns).where(eq(kanbanColumns.id, column.id));

  revalidatePath("/kanban");
  revalidatePath("/calendar");
  return { id: column.id };
}

export async function createKanbanTask(input: KanbanTaskFormInput) {
  const user = await getAppUser();
  const column = await assertOwnedColumn(input.columnId, user!.id);
  const values = normalizeTaskInput(input);
  const calendarItemId = values.syncToCalendar
    ? await createCalendarItemForTask(user!.id, values)
    : null;

  const [task] = await db
    .insert(kanbanTasks)
    .values({
      boardId: column.boardId,
      columnId: column.id,
      calendarItemId,
      title: values.title,
      description: values.description,
      dueDate: values.dueDate,
      priority: values.priority,
      labelIds: JSON.stringify(values.labelIds),
      position: await getNextTaskPosition(column.id),
      syncToCalendar: values.syncToCalendar,
      linkedToNotes: values.linkedToNotes,
    })
    .returning();

  revalidatePath("/kanban");
  if (values.syncToCalendar) revalidatePath("/calendar");

  return toTaskRecord(task);
}

export async function updateKanbanTask(taskId: number, input: KanbanTaskFormInput) {
  const user = await getAppUser();
  const task = await assertOwnedTask(taskId, user!.id);
  const column = await assertOwnedColumn(input.columnId, user!.id);

  if (column.boardId !== task.boardId) {
    throw new Error("Tasks can only move inside their board.");
  }

  const values = normalizeTaskInput(input);
  const calendarItemId = values.syncToCalendar
    ? await upsertCalendarItemForTask(task.calendarItemId, user!.id, values)
    : null;

  if (!values.syncToCalendar) {
    await deleteCalendarItemForTask(task.calendarItemId, user!.id);
  }

  const [updated] = await db
    .update(kanbanTasks)
    .set({
      columnId: column.id,
      calendarItemId,
      title: values.title,
      description: values.description,
      dueDate: values.dueDate,
      priority: values.priority,
      labelIds: JSON.stringify(values.labelIds),
      syncToCalendar: values.syncToCalendar,
      linkedToNotes: values.linkedToNotes,
      updatedAt: new Date(),
    })
    .where(eq(kanbanTasks.id, task.id))
    .returning();

  revalidatePath("/kanban");
  revalidatePath("/calendar");
  return toTaskRecord(updated);
}

export async function deleteKanbanTask(taskId: number) {
  const user = await getAppUser();
  const task = await assertOwnedTask(taskId, user!.id);

  await deleteCalendarItemForTask(task.calendarItemId, user!.id);
  await db.delete(kanbanTasks).where(eq(kanbanTasks.id, task.id));

  revalidatePath("/kanban");
  if (task.calendarItemId) revalidatePath("/calendar");

  return { id: task.id };
}

export async function moveKanbanTask(
  taskId: number,
  targetColumnId: number,
  columns: KanbanMoveColumnPayload[]
) {
  const user = await getAppUser();
  const task = await assertOwnedTask(taskId, user!.id);
  const targetColumn = await assertOwnedColumn(targetColumnId, user!.id);

  if (targetColumn.boardId !== task.boardId) {
    throw new Error("Tasks can only move inside their board.");
  }

  const boardColumns = await db
    .select({ id: kanbanColumns.id })
    .from(kanbanColumns)
    .where(eq(kanbanColumns.boardId, task.boardId));

  const boardTasks = await db
    .select({ id: kanbanTasks.id })
    .from(kanbanTasks)
    .where(eq(kanbanTasks.boardId, task.boardId));

  const validColumnIds = new Set(boardColumns.map((column) => column.id));
  const validTaskIds = new Set(boardTasks.map((currentTask) => currentTask.id));
  const seenTaskIds = new Set<number>();

  for (const column of columns) {
    if (!validColumnIds.has(column.columnId)) {
      throw new Error("That column does not belong to this board.");
    }

    for (const orderedTaskId of column.taskIds) {
      if (!validTaskIds.has(orderedTaskId) || seenTaskIds.has(orderedTaskId)) {
        throw new Error("Could not save that task order.");
      }

      seenTaskIds.add(orderedTaskId);
    }
  }

  if (!seenTaskIds.has(task.id)) {
    throw new Error("The moved task is missing from the new order.");
  }

  for (const column of columns) {
    for (const [position, orderedTaskId] of column.taskIds.entries()) {
      await db
        .update(kanbanTasks)
        .set({
          columnId: column.columnId,
          position,
          updatedAt: new Date(),
        })
        .where(and(eq(kanbanTasks.id, orderedTaskId), eq(kanbanTasks.boardId, task.boardId)));
    }
  }

  revalidatePath("/kanban");
  return { id: task.id, columnId: targetColumn.id };
}
