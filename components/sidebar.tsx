"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Calendar,
  KanbanSquare,
  FileText,
  PenLine,
  BookOpen,
  Wand2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  LogOut,
  User,
  HelpCircle,
  Loader2,
  X,
} from "lucide-react";
import { GeneratedTemplateIcon } from "@/components/generated-template-icon";
import { removeAppFromSidebar } from "@/lib/actions/templates";
import { type GeneratedAppRecord } from "@/lib/templates";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Navigation structure                                                */
/* ------------------------------------------------------------------ */

const navGroups = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        color: "#3B82F6",
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Notes",          href: "/notes",      icon: FileText,      color: "#EAB308" },
      { label: "Pages & Spaces", href: "/pages",      icon: BookOpen,      color: "#10B981" },
      { label: "Whiteboard",     href: "/whiteboard", icon: PenLine,       color: "#EC4899" },
    ],
  },
  {
    label: "Productivity",
    items: [
      { label: "Task / Kanban",  href: "/kanban",   icon: KanbanSquare, color: "#F97316" },
      { label: "Calendar",       href: "/calendar", icon: Calendar,     color: "#06B6D4" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "AI Assistant",        href: "/ai-assistant", icon: Bot,   color: "#8B5CF6" },
      { label: "AI Template Builder", href: "/templates",    icon: Wand2, color: "#A855F7" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings", href: "/settings", icon: Settings, color: "#64748B" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Sidebar component                                                   */
/* ------------------------------------------------------------------ */

type SidebarProps = {
  initialGeneratedApps?: GeneratedAppRecord[];
  initialSubscriptionPlan?: string;
};

export function Sidebar({
  initialGeneratedApps = [],
  initialSubscriptionPlan = "Free Plan",
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [generatedApps, setGeneratedApps] = useState(initialGeneratedApps);
  const [removingAppId, setRemovingAppId] = useState<number | null>(null);
  const { signOut } = useClerk();
  const { user } = useUser();
  const pathname = usePathname();
  const displayName =
    user?.fullName || user?.primaryEmailAddress?.emailAddress || "Account";
  const handleSignOut = () => {
    void signOut({ redirectUrl: "/sign-in" });
  };

  useEffect(() => {
    setGeneratedApps(initialGeneratedApps);
  }, [initialGeneratedApps]);

  async function handleRemoveGeneratedApp(id: number) {
    setRemovingAppId(id);

    try {
      await removeAppFromSidebar(id);
      setGeneratedApps((current) => current.filter((app) => app.id !== id));
    } finally {
      setRemovingAppId(null);
    }
  }

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen bg-white border-r border-violet-100 transition-all duration-300 ease-in-out select-none shrink-0",
        collapsed ? "w-[64px]" : "w-[220px]"
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center gap-2.5 h-14 px-3 border-b border-violet-100 shrink-0",
          collapsed && "justify-center px-0"
        )}
      >
        {/* Logo mark */}
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
          <Zap size={13} className="text-white fill-white" />
        </div>

        {/* App name (hidden when collapsed) */}
        {!collapsed && (
          <div className="flex flex-col leading-tight overflow-hidden">
            <span className="font-bold text-[13px] text-indigo-950 tracking-tight truncate">
              FlowBase
            </span>
            <span className="text-[9px] font-medium text-violet-400 tracking-widest uppercase truncate">
              Workspace
            </span>
          </div>
        )}
      </div>

      {/* ── Collapse / expand toggle ────────────────────────────────── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-[60px] z-20 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-violet-200 shadow-sm text-violet-400 hover:text-violet-600 hover:border-violet-300 hover:scale-110 transition-all duration-150"
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>

      {/* ── Navigation ─────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scroll py-3 px-2 space-y-3">
        {navGroups.map((group) => (
          <div key={group.label}>
            {/* Group label — text when expanded, thin rule when collapsed */}
            {!collapsed ? (
              <p className="px-2 mb-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                {group.label}
              </p>
            ) : (
              <div className="mx-auto w-6 border-t border-slate-100 my-1.5" />
            )}

            <ul className="space-y-[2px]">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg py-1.5 text-[11.5px] font-medium transition-all duration-150 relative group",
                        collapsed
                          ? "justify-center w-10 mx-auto px-0"
                          : "px-2.5",
                        isActive
                          ? "bg-violet-50 text-violet-700"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                      )}
                    >
                      <Icon
                        size={15}
                        className={cn(
                          "shrink-0 transition-colors duration-150",
                          !isActive && "group-hover:opacity-100"
                        )}
                        style={{ color: isActive ? item.color : item.color + "88" }}
                      />

                      {/* Label */}
                      {!collapsed && (
                        <span className="truncate flex-1">{item.label}</span>
                      )}

                      {/* Active indicator dot */}
                      {isActive && !collapsed && (
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {generatedApps.length > 0 && (
          <div>
            {!collapsed ? (
              <p className="px-2 mb-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                Generated
              </p>
            ) : (
              <div className="mx-auto w-6 border-t border-slate-100 my-1.5" />
            )}

            <ul className="space-y-[2px]">
              {generatedApps.map((app) => {
                const href = `/templates/${app.id}`;
                const isActive = pathname === href;

                return (
                  <li key={app.id}>
                    {collapsed ? (
                      <Link
                        href={href}
                        title={app.appName}
                        className={cn(
                          "flex items-center justify-center w-10 mx-auto rounded-lg py-1.5 text-[11.5px] font-medium transition-all duration-150",
                          isActive
                            ? "bg-violet-50 text-violet-700"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                        )}
                      >
                        <GeneratedTemplateIcon
                          name={app.icon}
                          size={15}
                          style={{ color: isActive ? app.color : app.color + "88" }}
                        />
                      </Link>
                    ) : (
                      <div
                        className={cn(
                          "group/generated flex items-center gap-1 rounded-lg transition-all duration-150",
                          isActive
                            ? "bg-violet-50 text-violet-700"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                        )}
                      >
                        <Link
                          href={href}
                          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1.5 pl-2.5 text-[11.5px] font-medium"
                        >
                          <GeneratedTemplateIcon
                            name={app.icon}
                            size={15}
                            className="shrink-0"
                            style={{ color: isActive ? app.color : app.color + "88" }}
                          />
                          <span className="truncate flex-1">{app.appName}</span>
                          {isActive && (
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: app.color }}
                            />
                          )}
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleRemoveGeneratedApp(app.id)}
                          disabled={removingAppId === app.id}
                          aria-label={`Remove ${app.appName} from sidebar`}
                          className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-300 opacity-0 transition hover:bg-white hover:text-rose-400 disabled:opacity-60 group-hover/generated:opacity-100 focus:opacity-100"
                        >
                          {removingAppId === app.id ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <X size={12} />
                          )}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div className="border-t border-violet-100 p-2 space-y-1 shrink-0">
        {/* Help link */}
        <Link
          href="/help"
          title={collapsed ? "Help & Support" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-lg py-1.5 text-[11.5px] font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all",
            collapsed ? "justify-center w-10 mx-auto px-0" : "px-2.5"
          )}
        >
          <HelpCircle size={15} style={{ color: "#0EA5E9" }} className="shrink-0" />
          {!collapsed && <span>Help & Support</span>}
        </Link>

        {/* User card */}
        {collapsed ? (
          <button
            type="button"
            onClick={handleSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 text-slate-300 hover:text-rose-400 hover:border-rose-100 transition-colors"
          >
            <LogOut size={14} />
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-xl py-2 px-2.5 bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center shrink-0 shadow-sm">
              <User size={11} className="text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-slate-700 truncate leading-tight">
                {displayName}
              </p>
              <p className="text-[9.5px] font-medium text-violet-500 truncate leading-tight">
                {initialSubscriptionPlan}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="p-1 -mr-1 rounded-md text-slate-300 hover:bg-white/70 hover:text-rose-400 transition-colors shrink-0"
            >
              <LogOut size={12} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
