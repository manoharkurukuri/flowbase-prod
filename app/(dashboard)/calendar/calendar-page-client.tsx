"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  GripVertical,
  Layers3,
  ListPlus,
  MapPinPlus,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  createDraftCalendarItem,
  createScheduledCalendarItem,
  deleteCalendarItem,
  rescheduleCalendarItem,
  scheduleDraftCalendarItem,
  updateCalendarItem,
} from "@/lib/actions/calendar-items";
import {
  CALENDAR_CATEGORY_OPTIONS,
  DEFAULT_CALENDAR_CATEGORY,
  getCalendarCategoryMeta,
  type CalendarCategory,
  type CalendarItemRecord,
  type CalendarItemType,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";

type CalendarPageClientProps = {
  initialItems: CalendarItemRecord[];
};

type CalendarView = "month" | "week";

type CalendarFormState = {
  title: string;
  description: string;
  itemType: CalendarItemType;
  category: CalendarCategory;
  scheduledDate: string;
  scheduledTime: string;
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function startOfWeek(date: Date) {
  return addDays(date, -date.getDay());
}

function getMonthGrid(cursorDate: Date) {
  const firstOfMonth = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1);
  const lastOfMonth = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 0);
  const gridStart = startOfWeek(firstOfMonth);
  const gridEnd = addDays(lastOfMonth, 6 - lastOfMonth.getDay());
  const days: Date[] = [];

  for (let day = gridStart; day <= gridEnd; day = addDays(day, 1)) {
    days.push(day);
  }

  return days;
}

function getWeekDays(cursorDate: Date) {
  const weekStart = startOfWeek(cursorDate);
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatWeekTitle(days: Date[]) {
  const first = days[0];
  const last = days[days.length - 1];
  const sameMonth = first.getMonth() === last.getMonth();
  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });

  if (sameMonth) {
    return `${monthFormatter.format(first)} ${first.getDate()}-${last.getDate()}, ${last.getFullYear()}`;
  }

  return `${monthFormatter.format(first)} ${first.getDate()} - ${monthFormatter.format(last)} ${last.getDate()}, ${last.getFullYear()}`;
}

function getEmptyForm(dateKey: string, asDraft = false): CalendarFormState {
  return {
    title: "",
    description: "",
    itemType: "task",
    category: DEFAULT_CALENDAR_CATEGORY,
    scheduledDate: asDraft ? "" : dateKey,
    scheduledTime: "",
  };
}

function getItemForm(item: CalendarItemRecord): CalendarFormState {
  return {
    title: item.title,
    description: item.description ?? "",
    itemType: item.itemType,
    category: item.category,
    scheduledDate: item.scheduledDate ?? "",
    scheduledTime: item.scheduledTime ?? "",
  };
}

function formatTime(time: string | null) {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function CalendarPageClient({ initialItems }: CalendarPageClientProps) {
  const todayKey = toDateKey(new Date());
  const [items, setItems] = useState(initialItems);
  const [view, setView] = useState<CalendarView>("month");
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CalendarItemRecord | null>(null);
  const [form, setForm] = useState<CalendarFormState>(() => getEmptyForm(todayKey));
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [placingDraftId, setPlacingDraftId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const scheduledItems = useMemo(
    () => items.filter((item) => Boolean(item.scheduledDate)),
    [items]
  );
  const draftItems = useMemo(
    () => items.filter((item) => !item.scheduledDate),
    [items]
  );

  const itemsByDate = useMemo(() => {
    return scheduledItems.reduce<Record<string, CalendarItemRecord[]>>((grouped, item) => {
      if (!item.scheduledDate) return grouped;
      grouped[item.scheduledDate] = grouped[item.scheduledDate] ?? [];
      grouped[item.scheduledDate].push(item);
      grouped[item.scheduledDate].sort((a, b) => {
        return (a.scheduledTime ?? "99:99").localeCompare(b.scheduledTime ?? "99:99");
      });
      return grouped;
    }, {});
  }, [scheduledItems]);

  const visibleDays = view === "month" ? getMonthGrid(cursorDate) : getWeekDays(cursorDate);
  const title = view === "month" ? formatMonthTitle(cursorDate) : formatWeekTitle(visibleDays);
  const selectedDraft = placingDraftId
    ? draftItems.find((item) => item.id === placingDraftId)
    : null;

  function replaceItem(updated: CalendarItemRecord) {
    setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  function openCreateDialog(dateKey = selectedDate, asDraft = false) {
    setEditingItem(null);
    setForm(getEmptyForm(dateKey, asDraft));
    setError(null);
    setDialogOpen(true);
  }

  function openEditDialog(item: CalendarItemRecord) {
    setEditingItem(item);
    setForm(getItemForm(item));
    setError(null);
    setDialogOpen(true);
  }

  function handleNavigate(direction: -1 | 1) {
    setCursorDate((current) => {
      if (view === "month") return addMonths(current, direction);
      return addDays(current, direction * 7);
    });
  }

  function handleToday() {
    const today = new Date();
    const dateKey = toDateKey(today);
    setCursorDate(today);
    setSelectedDate(dateKey);
  }

  function handleSelectDate(dateKey: string) {
    setSelectedDate(dateKey);

    if (placingDraftId) {
      scheduleItemOnDate(placingDraftId, dateKey);
    }
  }

  function setItemOptimistically(id: number, scheduledDate: string) {
    const previous = items;
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, scheduledDate } : item))
    );
    return previous;
  }

  function scheduleItemOnDate(id: number, dateKey: string) {
    const item = items.find((current) => current.id === id);
    if (!item) return;

    const previous = setItemOptimistically(id, dateKey);
    setPlacingDraftId(null);
    setError(null);

    startTransition(async () => {
      try {
        const updated = item.scheduledDate
          ? await rescheduleCalendarItem(id, dateKey)
          : await scheduleDraftCalendarItem(id, dateKey);
        replaceItem(updated);
      } catch (caught) {
        setItems(previous);
        setError(caught instanceof Error ? caught.message : "Could not move that item.");
      }
    });
  }

  function handleDragStart(event: React.DragEvent, item: CalendarItemRecord) {
    event.dataTransfer.setData("application/x-flowbase-calendar-item", String(item.id));
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(event: React.DragEvent, dateKey: string) {
    event.preventDefault();
    setDragOverDate(null);
    const id = Number(event.dataTransfer.getData("application/x-flowbase-calendar-item"));

    if (id) {
      scheduleItemOnDate(id, dateKey);
    }
  }

  function handleSaveScheduled() {
    if (!form.title.trim()) {
      setError("Add a title before saving.");
      return;
    }

    if (!form.scheduledDate) {
      setError("Choose a date or save this item as a draft.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const payload = {
          ...form,
          title: form.title.trim(),
          description: form.description.trim() || null,
          scheduledTime: form.scheduledTime || null,
        };
        const saved = editingItem
          ? await updateCalendarItem(editingItem.id, payload)
          : await createScheduledCalendarItem(payload);

        if (editingItem) {
          replaceItem(saved);
        } else {
          setItems((current) => [saved, ...current]);
        }

        setDialogOpen(false);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not save the item.");
      }
    });
  }

  function handleSaveDraft() {
    if (!form.title.trim()) {
      setError("Add a title before saving.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const payload = {
          ...form,
          title: form.title.trim(),
          description: form.description.trim() || null,
          scheduledDate: null,
          scheduledTime: null,
        };
        const saved = editingItem
          ? await updateCalendarItem(editingItem.id, payload)
          : await createDraftCalendarItem(payload);

        if (editingItem) {
          replaceItem(saved);
        } else {
          setItems((current) => [saved, ...current]);
        }

        setDialogOpen(false);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not save the draft.");
      }
    });
  }

  function handleDeleteItem() {
    if (!editingItem) return;
    const id = editingItem.id;
    const previous = items;
    setItems((current) => current.filter((item) => item.id !== id));
    setDialogOpen(false);

    startTransition(async () => {
      try {
        await deleteCalendarItem(id);
      } catch (caught) {
        setItems(previous);
        setError(caught instanceof Error ? caught.message : "Could not delete the item.");
      }
    });
  }

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <CalendarDays size={17} className="text-cyan-500" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-500">
                Calendar
              </span>
            </div>
            <h1 className="text-[26px] font-bold tracking-tight text-indigo-950">
              Plan your flow
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-6 text-slate-400">
              Add tasks, keep reminders visible, and park unscheduled ideas in drafts
              until they are ready for the calendar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-violet-100 bg-white p-1 shadow-sm">
              {(["month", "week"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setView(mode)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[11.5px] font-semibold capitalize transition-all",
                    view === mode
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-slate-400 hover:bg-violet-50 hover:text-violet-700"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
            <button
              onClick={handleToday}
              className="rounded-xl border border-violet-100 bg-white px-3 py-2 text-[11.5px] font-semibold text-violet-600 shadow-sm transition hover:border-violet-200 hover:bg-violet-50"
            >
              Today
            </button>
            <button
              onClick={() => openCreateDialog(selectedDate)}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2 text-[11.5px] font-semibold text-white shadow-sm transition hover:bg-violet-700"
            >
              <Plus size={14} />
              Add
            </button>
          </div>
        </header>

        {selectedDraft && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-[12px] text-cyan-800">
            <span>
              Pick a date to schedule <strong>{selectedDraft.title}</strong>.
            </span>
            <button
              onClick={() => setPlacingDraftId(null)}
              className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 font-semibold text-cyan-700 shadow-sm"
            >
              <X size={12} />
              Cancel
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] font-medium text-rose-600">
            {error}
          </div>
        )}

        <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-[18px] font-bold tracking-tight text-indigo-950">
                  {title}
                </h2>
                <p className="mt-1 text-[11px] text-slate-400">
                  {scheduledItems.length} scheduled / {draftItems.length} drafts
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleNavigate(-1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-100 text-slate-400 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                  aria-label={view === "month" ? "Previous month" : "Previous week"}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => handleNavigate(1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-100 text-slate-400 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                  aria-label={view === "month" ? "Next month" : "Next week"}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
              {weekdayLabels.map((label) => (
                <div
                  key={label}
                  className="px-1.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:px-3"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid min-w-0 grid-cols-7">
              {visibleDays.map((day) => {
                const dateKey = toDateKey(day);
                const dayItems = itemsByDate[dateKey] ?? [];
                const isToday = dateKey === todayKey;
                const isSelected = dateKey === selectedDate;
                const isCurrentMonth = day.getMonth() === cursorDate.getMonth();
                const isDropTarget = dragOverDate === dateKey;

                return (
                  <button
                    key={dateKey}
                    onClick={() => handleSelectDate(dateKey)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOverDate(dateKey);
                    }}
                    onDragLeave={() => setDragOverDate(null)}
                    onDrop={(event) => handleDrop(event, dateKey)}
                    className={cn(
                      "group flex min-h-[118px] min-w-0 flex-col border-b border-r border-slate-100 bg-white p-1.5 text-left transition sm:min-h-[132px] sm:p-2.5",
                      !isCurrentMonth && view === "month" && "bg-slate-50/50 text-slate-300",
                      isSelected && "bg-violet-50/70",
                      isDropTarget && "bg-cyan-50 ring-2 ring-inset ring-cyan-300"
                    )}
                  >
                    <div className="mb-1 flex min-w-0 items-center justify-between gap-1">
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                          isToday
                            ? "bg-cyan-500 text-white"
                            : isSelected
                              ? "bg-violet-600 text-white"
                              : "text-slate-500"
                        )}
                      >
                        {day.getDate()}
                      </span>
                      <span
                        onClick={(event) => {
                          event.stopPropagation();
                          openCreateDialog(dateKey);
                        }}
                        className="hidden h-6 w-6 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white hover:text-violet-600 group-hover:flex"
                        title="Add item"
                      >
                        <Plus size={13} />
                      </span>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
                      {dayItems.slice(0, view === "month" ? 3 : 7).map((item) => (
                        <CalendarItemChip
                          key={item.id}
                          item={item}
                          onDragStart={handleDragStart}
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditDialog(item);
                          }}
                        />
                      ))}
                      {dayItems.length > (view === "month" ? 3 : 7) && (
                        <span className="truncate text-[10px] font-semibold text-slate-400">
                          +{dayItems.length - (view === "month" ? 3 : 7)} more
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="min-w-0 rounded-2xl border border-violet-100 bg-white shadow-sm xl:sticky xl:top-6">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <Layers3 size={15} className="text-violet-500" />
                  <h2 className="text-[14px] font-bold text-indigo-950">Draft Task Panel</h2>
                </div>
                <p className="text-[11px] text-slate-400">Drag drafts onto any date.</p>
              </div>
              <button
                onClick={() => openCreateDialog(selectedDate, true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600 transition hover:bg-violet-100"
                aria-label="Add draft"
              >
                <ListPlus size={15} />
              </button>
            </div>

            <div className="flex max-h-[540px] flex-col gap-2 overflow-y-auto p-3">
              {draftItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <Sparkles size={18} className="mx-auto mb-2 text-violet-400" />
                  <p className="text-[12px] font-semibold text-slate-600">No drafts yet</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-400">
                    Save unscheduled tasks here and place them later.
                  </p>
                </div>
              ) : (
                draftItems.map((item) => (
                  <DraftItemCard
                    key={item.id}
                    item={item}
                    isPlacing={placingDraftId === item.id}
                    onDragStart={handleDragStart}
                    onEdit={() => openEditDialog(item)}
                    onPlace={() =>
                      setPlacingDraftId((current) => (current === item.id ? null : item.id))
                    }
                  />
                ))
              )}
            </div>
          </aside>
        </div>
      </div>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/20 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-[16px] font-bold text-indigo-950">
                  {editingItem ? "Edit item" : "New calendar item"}
                </h2>
                <p className="mt-1 text-[11px] text-slate-400">
                  Choose a date now or save it as a draft.
                </p>
              </div>
              <button
                onClick={() => setDialogOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Title
                </span>
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="Draft product review"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Type
                  </span>
                  <select
                    value={form.itemType}
                    onChange={(event) =>
                      setForm({ ...form, itemType: event.target.value as CalendarItemType })
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  >
                    <option value="task">Task</option>
                    <option value="reminder">Reminder</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Category
                  </span>
                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm({ ...form, category: event.target.value as CalendarCategory })
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  >
                    {CALENDAR_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                {CALENDAR_CATEGORY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setForm({ ...form, category: option.value })}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                      form.category === option.value && "shadow-sm"
                    )}
                    style={{
                      borderColor: option.border,
                      backgroundColor: form.category === option.value ? option.bg : "#ffffff",
                      color: option.color,
                    }}
                  >
                    {form.category === option.value && <Check size={11} />}
                    {option.label}
                  </button>
                ))}
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Description
                </span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Notes, links, or context"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] leading-5 text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Date
                  </span>
                  <input
                    type="date"
                    value={form.scheduledDate}
                    onChange={(event) =>
                      setForm({ ...form, scheduledDate: event.target.value })
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Time
                  </span>
                  <input
                    type="time"
                    value={form.scheduledTime}
                    onChange={(event) =>
                      setForm({ ...form, scheduledTime: event.target.value })
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  />
                </label>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-600">
                  {error}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {editingItem && (
                  <button
                    onClick={handleDeleteItem}
                    className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[11.5px] font-semibold text-rose-500 transition hover:bg-rose-50"
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={handleSaveDraft}
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-100 bg-white px-3.5 py-2 text-[11.5px] font-semibold text-violet-600 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 disabled:opacity-60"
                >
                  <Save size={13} />
                  Save as draft
                </button>
                <button
                  onClick={handleSaveScheduled}
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2 text-[11.5px] font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
                >
                  <CalendarDays size={13} />
                  Save scheduled
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarItemChip({
  item,
  onDragStart,
  onClick,
}: {
  item: CalendarItemRecord;
  onDragStart: (event: React.DragEvent, item: CalendarItemRecord) => void;
  onClick: (event: React.MouseEvent) => void;
}) {
  const category = getCalendarCategoryMeta(item.category);
  const time = formatTime(item.scheduledTime);

  return (
    <div
      draggable
      onDragStart={(event) => onDragStart(event, item)}
      onClick={onClick}
      className="flex min-w-0 cursor-grab items-center gap-1 rounded-lg border px-1.5 py-1 text-[10.5px] font-semibold shadow-sm transition active:cursor-grabbing sm:text-[11px]"
      style={{
        borderColor: category.border,
        backgroundColor: category.bg,
        color: category.color,
      }}
      title={item.title}
    >
      {item.itemType === "reminder" ? (
        <Bell size={11} className="shrink-0" />
      ) : (
        <Check size={11} className="shrink-0" />
      )}
      {time && <span className="shrink-0 opacity-80">{time}</span>}
      <span className="min-w-0 truncate">{item.title}</span>
    </div>
  );
}

function DraftItemCard({
  item,
  isPlacing,
  onDragStart,
  onEdit,
  onPlace,
}: {
  item: CalendarItemRecord;
  isPlacing: boolean;
  onDragStart: (event: React.DragEvent, item: CalendarItemRecord) => void;
  onEdit: () => void;
  onPlace: () => void;
}) {
  const category = getCalendarCategoryMeta(item.category);

  return (
    <div
      draggable
      onDragStart={(event) => onDragStart(event, item)}
      className={cn(
        "rounded-2xl border bg-white p-3 shadow-sm transition",
        isPlacing ? "border-cyan-200 ring-4 ring-cyan-100" : "border-slate-100"
      )}
    >
      <div className="mb-2 flex items-start gap-2">
        <GripVertical size={15} className="mt-0.5 shrink-0 cursor-grab text-slate-300" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-bold text-slate-700">{item.title}</p>
          {item.description && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-400">
              {item.description}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10.5px] font-semibold"
            style={{
              borderColor: category.border,
              backgroundColor: category.bg,
              color: category.color,
            }}
          >
            {item.itemType === "reminder" ? <Bell size={10} /> : <Check size={10} />}
            {category.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-[10.5px] font-semibold text-slate-400">
            <Clock size={10} />
            Draft
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onPlace}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg transition",
              isPlacing
                ? "bg-cyan-500 text-white"
                : "bg-cyan-50 text-cyan-600 hover:bg-cyan-100"
            )}
            aria-label="Place draft on calendar"
          >
            <MapPinPlus size={13} />
          </button>
          <button
            onClick={onEdit}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600 transition hover:bg-violet-100"
            aria-label="Edit draft"
          >
            <Edit3 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
