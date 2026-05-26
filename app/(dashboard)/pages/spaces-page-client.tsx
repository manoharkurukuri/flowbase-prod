"use client";

import { useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Archive,
  Copy,
  Folder,
  Grid2X2,
  List,
  MoreHorizontal,
  Palette,
  Plus,
  Search,
  Share2,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import {
  archiveSpace,
  createSpace,
  deleteSpace,
  duplicateSpace,
  inviteSpaceCollaborator,
  toggleSpaceFavorite,
  updateSpace,
} from "@/lib/actions/pages";
import {
  SPACE_COLORS,
  formatWorkspaceRelativeTime,
  getSpaceColorMeta,
  type SpaceColor,
  type SpaceSummaryRecord,
} from "@/lib/pages";
import { cn } from "@/lib/utils";

type SpacesPageClientProps = {
  initialSpaces: SpaceSummaryRecord[];
};

type FilterTab = "all" | "favorites" | "recent" | "archived";
type ViewMode = "grid" | "list";
type SortMode = "recently-updated" | "name" | "most-pages" | "favorites";

const filterTabs: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All Spaces" },
  { id: "favorites", label: "Favorites" },
  { id: "recent", label: "Recently Opened" },
  { id: "archived", label: "Archived" },
];

const sortOptions: { value: SortMode; label: string }[] = [
  { value: "recently-updated", label: "Recently Updated" },
  { value: "name", label: "Name" },
  { value: "most-pages", label: "Most Pages" },
  { value: "favorites", label: "Favorites" },
];

function sortSpaces(spaces: SpaceSummaryRecord[], sortMode: SortMode) {
  const next = [...spaces];

  if (sortMode === "name") {
    return next.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (sortMode === "most-pages") {
    return next.sort((a, b) => b.pageCount - a.pageCount || a.name.localeCompare(b.name));
  }

  if (sortMode === "favorites") {
    return next.sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || a.name.localeCompare(b.name));
  }

  return next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function SpacesPageClient({ initialSpaces }: SpacesPageClientProps) {
  const [spaces, setSpaces] = useState(initialSpaces);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortMode, setSortMode] = useState<SortMode>("recently-updated");
  const [newSpaceOpen, setNewSpaceOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    color: SPACE_COLORS[0].value as SpaceColor,
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleSpaces = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = spaces.filter((space) => {
      if (filter !== "archived" && space.archivedAt) return false;
      if (filter === "archived" && !space.archivedAt) return false;
      if (filter === "favorites" && !space.isFavorite) return false;
      if (filter === "recent" && !space.lastOpenedAt) return false;

      if (!query) return true;

      return `${space.name} ${space.description ?? ""} ${space.pageSearchText}`
        .toLowerCase()
        .includes(query);
    });

    return sortSpaces(filtered, sortMode);
  }, [filter, search, sortMode, spaces]);

  const activeCount = spaces.filter((space) => !space.archivedAt).length;

  function updateLocalSpace(updated: SpaceSummaryRecord) {
    setSpaces((current) => current.map((space) => (space.id === updated.id ? updated : space)));
  }

  function handleCreateSpace() {
    if (!form.name.trim()) {
      setError("Add a space name first.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const created = await createSpace(form);
        setSpaces((current) => [created, ...current]);
        setForm({ name: "", description: "", color: SPACE_COLORS[0].value });
        setNewSpaceOpen(false);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not create the space.");
      }
    });
  }

  function handleRename(space: SpaceSummaryRecord) {
    const nextName = window.prompt("Rename space", space.name);
    if (nextName === null) return;

    startTransition(async () => {
      try {
        const updated = await updateSpace(space.id, { name: nextName });
        updateLocalSpace(updated);
        setActiveMenuId(null);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not rename the space.");
      }
    });
  }

  function handleChangeColor(space: SpaceSummaryRecord) {
    const currentIndex = SPACE_COLORS.findIndex((color) => color.value === space.color);
    const nextColor = SPACE_COLORS[(currentIndex + 1) % SPACE_COLORS.length].value;

    startTransition(async () => {
      try {
        const updated = await updateSpace(space.id, { color: nextColor });
        updateLocalSpace(updated);
        setActiveMenuId(null);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not update the color.");
      }
    });
  }

  function handleToggleFavorite(space: SpaceSummaryRecord) {
    startTransition(async () => {
      try {
        const updated = await toggleSpaceFavorite(space.id);
        updateLocalSpace(updated);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not update the favorite.");
      }
    });
  }

  function handleDuplicate(space: SpaceSummaryRecord) {
    startTransition(async () => {
      try {
        const duplicated = await duplicateSpace(space.id);
        setSpaces((current) => [duplicated, ...current]);
        setActiveMenuId(null);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not duplicate the space.");
      }
    });
  }

  function handleInvite(space: SpaceSummaryRecord) {
    const email = window.prompt("Invite collaborator by email");
    if (email === null) return;

    startTransition(async () => {
      try {
        const updated = await inviteSpaceCollaborator(space.id, email);
        updateLocalSpace(updated);
        setActiveMenuId(null);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not invite that collaborator.");
      }
    });
  }

  function handleArchive(space: SpaceSummaryRecord) {
    startTransition(async () => {
      try {
        await archiveSpace(space.id, !space.archivedAt);
        setSpaces((current) =>
          current.map((item) =>
            item.id === space.id
              ? { ...item, archivedAt: space.archivedAt ? null : new Date().toISOString() }
              : item
          )
        );
        setActiveMenuId(null);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not archive the space.");
      }
    });
  }

  function handleDelete(space: SpaceSummaryRecord) {
    const confirmed = window.confirm(`Delete "${space.name}" and all of its pages?`);
    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deleteSpace(space.id);
        setSpaces((current) => current.filter((item) => item.id !== space.id));
        setActiveMenuId(null);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not delete the space.");
      }
    });
  }

  return (
    <div className="min-h-full px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="rounded-2xl border border-violet-100 bg-white px-5 py-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Folder size={16} className="text-violet-500" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-500">
                  Pages & Spaces
                </span>
              </div>
              <h1 className="text-[26px] font-bold tracking-normal text-indigo-950">All Spaces</h1>
              <p className="mt-1 text-[13px] font-medium text-slate-400">
                {activeCount} {activeCount === 1 ? "space" : "spaces"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setError(null);
                setNewSpaceOpen(true);
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-[12px] font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
              disabled={isPending}
            >
              <Plus size={15} />
              New Space
            </button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
            <label className="relative block">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search spaces or pages..."
                className="h-11 w-full rounded-xl border border-slate-100 bg-slate-50 pl-10 pr-3 text-[12px] font-medium text-slate-600 outline-none transition placeholder:text-slate-300 focus:border-violet-200 focus:bg-white focus:ring-4 focus:ring-violet-100"
              />
            </label>

            <div className="flex h-11 items-center rounded-xl border border-slate-100 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition",
                  viewMode === "grid" && "bg-white text-violet-600 shadow-sm"
                )}
              >
                <Grid2X2 size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-label="List view"
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition",
                  viewMode === "list" && "bg-white text-violet-600 shadow-sm"
                )}
              >
                <List size={16} />
              </button>
            </div>

            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-11 rounded-xl border border-slate-100 bg-slate-50 px-3 text-[12px] font-semibold text-slate-500 outline-none transition focus:border-violet-200 focus:bg-white focus:ring-4 focus:ring-violet-100"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={cn(
                  "h-9 shrink-0 rounded-xl px-3 text-[11.5px] font-semibold transition",
                  filter === tab.id
                    ? "bg-violet-600 text-white shadow-sm"
                    : "bg-slate-50 text-slate-400 hover:bg-violet-50 hover:text-violet-600"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-600">
            {error}
          </div>
        )}

        {visibleSpaces.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-violet-200 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">
              <Sparkles size={24} />
            </div>
            <h2 className="text-[20px] font-bold text-indigo-950">
              {spaces.length === 0 ? "Create your first space" : "No matching spaces"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-slate-400">
              {spaces.length === 0
                ? "Spaces keep related pages together for planning, research, projects, and personal workflows."
                : "Try a different search, filter, or sort to find the space you need."}
            </p>
            {spaces.length === 0 && (
              <button
                type="button"
                onClick={() => setNewSpaceOpen(true)}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-[12px] font-semibold text-white shadow-sm transition hover:bg-violet-700"
              >
                <Plus size={15} />
                New Space
              </button>
            )}
          </div>
        ) : (
          <section
            className={cn(
              viewMode === "grid"
                ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
                : "flex flex-col gap-3"
            )}
          >
            {visibleSpaces.map((space) => (
              <SpaceCard
                key={space.id}
                activeMenuId={activeMenuId}
                disabled={isPending}
                onArchive={handleArchive}
                onChangeColor={handleChangeColor}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onInvite={handleInvite}
                onRename={handleRename}
                onToggleFavorite={handleToggleFavorite}
                onToggleMenu={setActiveMenuId}
                space={space}
                viewMode={viewMode}
              />
            ))}
          </section>
        )}
      </div>

      {newSpaceOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-indigo-950/20 backdrop-blur-sm">
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-violet-100 bg-white p-5 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-500">
                  Create Space
                </p>
                <h2 className="text-[22px] font-bold text-indigo-950">New Space</h2>
              </div>
              <button
                type="button"
                onClick={() => setNewSpaceOpen(false)}
                className="rounded-xl px-3 py-2 text-[12px] font-semibold text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-slate-400">
                  Space Name
                </span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 text-[13px] font-semibold text-slate-700 outline-none transition focus:border-violet-200 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  placeholder="Product workspace"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-slate-400">
                  Description
                </span>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  className="min-h-28 w-full resize-none rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-[13px] font-medium leading-6 text-slate-600 outline-none transition focus:border-violet-200 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  placeholder="What belongs in this space?"
                />
              </label>

              <div>
                <span className="mb-2 block text-[11px] font-semibold text-slate-400">
                  Color
                </span>
                <div className="grid grid-cols-7 gap-2">
                  {SPACE_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, color: color.value }))}
                      aria-label={color.label}
                      className={cn(
                        "h-9 rounded-xl border-2 transition",
                        form.color === color.value ? "border-indigo-950" : "border-transparent"
                      )}
                      style={{ backgroundColor: color.value }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateSpace}
                disabled={isPending}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-[12px] font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
              >
                <Plus size={15} />
                Create Space
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SpaceCard({
  activeMenuId,
  disabled,
  onArchive,
  onChangeColor,
  onDelete,
  onDuplicate,
  onInvite,
  onRename,
  onToggleFavorite,
  onToggleMenu,
  space,
  viewMode,
}: {
  activeMenuId: number | null;
  disabled: boolean;
  onArchive: (space: SpaceSummaryRecord) => void;
  onChangeColor: (space: SpaceSummaryRecord) => void;
  onDelete: (space: SpaceSummaryRecord) => void;
  onDuplicate: (space: SpaceSummaryRecord) => void;
  onInvite: (space: SpaceSummaryRecord) => void;
  onRename: (space: SpaceSummaryRecord) => void;
  onToggleFavorite: (space: SpaceSummaryRecord) => void;
  onToggleMenu: (id: number | null) => void;
  space: SpaceSummaryRecord;
  viewMode: ViewMode;
}) {
  const color = getSpaceColorMeta(space.color);
  const menuOpen = activeMenuId === space.id;

  return (
    <article
      className={cn(
        "group relative rounded-2xl border border-violet-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md",
        viewMode === "grid" ? "p-4" : "p-3"
      )}
    >
      <div className={cn("flex gap-4", viewMode === "list" && "items-center")}>
        <Link
          href={`/pages/${space.id}`}
          className={cn("flex min-w-0 flex-1 gap-4", viewMode === "grid" ? "flex-col" : "items-center")}
        >
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-2xl",
              viewMode === "grid" ? "h-12 w-12" : "h-10 w-10"
            )}
            style={{ backgroundColor: color.bg, color: color.value }}
          >
            <Folder size={viewMode === "grid" ? 24 : 20} fill={color.value + "22"} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <h2 className="truncate text-[15px] font-bold text-indigo-950">{space.name}</h2>
              {space.archivedAt && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                  Archived
                </span>
              )}
            </div>
            <p className="line-clamp-2 min-h-[38px] text-[12px] leading-5 text-slate-400">
              {space.description || "No description yet."}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-400">
              <AvatarStack members={space.members} />
              <span>{space.pageCount} {space.pageCount === 1 ? "Page" : "Pages"}</span>
              <span>
                {formatWorkspaceRelativeTime(space.updatedAt, {
                  emptyLabel: "No updates yet",
                  prefix: "Updated",
                })}
              </span>
            </div>
          </div>
        </Link>

        <div className="flex shrink-0 items-start gap-1">
          <button
            type="button"
            onClick={() => onToggleFavorite(space)}
            disabled={disabled}
            aria-label={space.isFavorite ? "Remove favorite" : "Add favorite"}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 transition hover:bg-violet-50 hover:text-violet-600 disabled:opacity-60"
          >
            <Star
              size={16}
              className={space.isFavorite ? "fill-amber-400 text-amber-400" : undefined}
            />
          </button>
          <button
            type="button"
            onClick={() => onToggleMenu(menuOpen ? null : space.id)}
            aria-label="More space actions"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 transition hover:bg-violet-50 hover:text-violet-600"
          >
            <MoreHorizontal size={17} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="absolute right-3 top-12 z-20 w-52 rounded-2xl border border-violet-100 bg-white p-1.5 shadow-lg">
          <MenuButton icon={<Folder size={13} />} label="Rename Space" onClick={() => onRename(space)} />
          <MenuButton icon={<Palette size={13} />} label="Change Color" onClick={() => onChangeColor(space)} />
          <MenuButton icon={<Plus size={13} />} label="Add Page" href={`/pages/${space.id}`} />
          <MenuButton icon={<Share2 size={13} />} label="Invite Collaborators" onClick={() => onInvite(space)} />
          <MenuButton icon={<Copy size={13} />} label="Duplicate" onClick={() => onDuplicate(space)} />
          <MenuButton
            icon={<Archive size={13} />}
            label={space.archivedAt ? "Restore" : "Archive"}
            onClick={() => onArchive(space)}
          />
          <MenuButton danger icon={<Trash2 size={13} />} label="Delete" onClick={() => onDelete(space)} />
        </div>
      )}
    </article>
  );
}

function AvatarStack({ members }: { members: SpaceSummaryRecord["members"] }) {
  if (members.length === 0) {
    return <span className="text-[11px] text-slate-300">No members</span>;
  }

  return (
    <div className="flex -space-x-2">
      {members.slice(0, 4).map((member) => (
        <span
          key={member.id}
          title={member.name || member.email}
          className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white shadow-sm"
          style={{ backgroundColor: member.avatarColor }}
        >
          {member.initials}
        </span>
      ))}
      {members.length > 4 && (
        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[9px] font-bold text-slate-400">
          +{members.length - 4}
        </span>
      )}
    </div>
  );
}

function MenuButton({
  danger,
  href,
  icon,
  label,
  onClick,
}: {
  danger?: boolean;
  href?: string;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  const className = cn(
    "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[11.5px] font-semibold transition",
    danger
      ? "text-rose-500 hover:bg-rose-50"
      : "text-slate-500 hover:bg-violet-50 hover:text-violet-700"
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {icon}
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {icon}
      {label}
    </button>
  );
}
