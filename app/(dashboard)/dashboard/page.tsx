import {
  Bot,
  Calendar,
  FileText,
  KanbanSquare,
  PenLine,
  TrendingUp,
  Sparkles,
  Clock,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Static data                                                         */
/* ------------------------------------------------------------------ */

const quickActions = [
  { label: "New Note",    icon: FileText,     color: "#EAB308", bg: "#FEFCE8" },
  { label: "AI Chat",     icon: Bot,          color: "#8B5CF6", bg: "#F5F3FF" },
  { label: "New Task",    icon: KanbanSquare, color: "#F97316", bg: "#FFF7ED" },
  { label: "Whiteboard",  icon: PenLine,      color: "#EC4899", bg: "#FDF2F8" },
  { label: "Schedule",    icon: Calendar,     color: "#06B6D4", bg: "#ECFEFF" },
];

const stats = [
  {
    label: "Active Tasks",
    value: "12",
    change: "+3 this week",
    color: "#F97316",
    from: "from-orange-50",
    to: "to-amber-50",
    border: "border-orange-100",
    icon: KanbanSquare,
  },
  {
    label: "AI Sessions",
    value: "5",
    change: "2 in progress",
    color: "#8B5CF6",
    from: "from-violet-50",
    to: "to-purple-50",
    border: "border-violet-100",
    icon: Bot,
  },
  {
    label: "Notes Today",
    value: "3",
    change: "Last at 11:42 am",
    color: "#EAB308",
    from: "from-yellow-50",
    to: "to-amber-50",
    border: "border-yellow-100",
    icon: FileText,
  },
];

const recentActivity = [
  {
    label: 'Edited "Product Roadmap" note',
    time: "2m ago",
    color: "#EAB308",
    icon: FileText,
  },
  {
    label: "AI Assistant generated a content summary",
    time: "1h ago",
    color: "#8B5CF6",
    icon: Bot,
  },
  {
    label: '"Design Review" task marked complete',
    time: "3h ago",
    color: "#F97316",
    icon: KanbanSquare,
  },
  {
    label: "New whiteboard session started",
    time: "Yesterday",
    color: "#EC4899",
    icon: PenLine,
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-violet-400" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-violet-400">
            FlowBase
          </span>
        </div>
        <h1 className="text-[26px] font-bold tracking-tight" style={{ color: "#1E1B4B" }}>
          Good morning, John 👋
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "#94A3B8" }}>
          Here&apos;s what&apos;s happening in your workspace today — {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}.
        </p>
      </div>

      {/* Quick Actions */}
      <section className="mb-8">
        <h2 className="text-[9.5px] font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: "#CBD5E1" }}>
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-100 bg-white hover:border-violet-200 hover:shadow-sm text-[11.5px] font-medium text-slate-600 hover:text-slate-800 transition-all duration-150 active:scale-95"
              >
                <Icon size={13} style={{ color: action.color }} />
                {action.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`rounded-2xl border ${stat.border} bg-gradient-to-br ${stat.from} ${stat.to} p-5 hover:shadow-md transition-all duration-200`}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-medium text-slate-400">{stat.label}</p>
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: stat.color + "18" }}
                >
                  <Icon size={14} style={{ color: stat.color }} />
                </div>
              </div>
              <p className="text-[32px] font-bold leading-none mb-1" style={{ color: stat.color }}>
                {stat.value}
              </p>
              <p className="text-[10.5px] text-slate-400 flex items-center gap-1">
                <TrendingUp size={10} />
                {stat.change}
              </p>
            </div>
          );
        })}
      </section>

      {/* Recent Activity */}
      <section>
        <h2 className="text-[9.5px] font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: "#CBD5E1" }}>
          Recent Activity
        </h2>
        <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden divide-y divide-slate-50">
          {recentActivity.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors duration-100 cursor-pointer"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: item.color + "18" }}
                >
                  <Icon size={13} style={{ color: item.color }} />
                </div>
                <span className="text-[12px] text-slate-600 flex-1 leading-snug">
                  {item.label}
                </span>
                <span className="text-[10.5px] text-slate-300 flex items-center gap-1 shrink-0">
                  <Clock size={9} />
                  {item.time}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
