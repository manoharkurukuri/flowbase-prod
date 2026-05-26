"use client";

import { BarChart3, Check, ChevronRight, Circle, Plus, Tag } from "lucide-react";
import { GeneratedTemplateIcon } from "@/components/generated-template-icon";
import { cn } from "@/lib/utils";
import {
  DEFAULT_TEMPLATE_COLOR,
  type GeneratedTemplateComponent,
  type GeneratedTemplateJson,
  type GeneratedTemplateSection,
} from "@/lib/templates";

type GeneratedAppPreviewProps = {
  template: GeneratedTemplateJson;
  compact?: boolean;
  className?: string;
};

function colorWithAlpha(color: string, alpha: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : `${DEFAULT_TEMPLATE_COLOR}${alpha}`;
}

function textColor(color: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_TEMPLATE_COLOR;
}

export function GeneratedAppPreview({ template, compact = false, className }: GeneratedAppPreviewProps) {
  const sections = template.sections ?? [];
  const looseComponents = template.components ?? [];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm",
        className
      )}
    >
      <div
        className={cn(
          "border-b border-slate-100 px-4 py-4 sm:px-5",
          compact ? "py-3" : "sm:py-5"
        )}
        style={{ background: `linear-gradient(135deg, ${colorWithAlpha(template.color, "14")}, #ffffff)` }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/70 shadow-sm"
            style={{
              backgroundColor: colorWithAlpha(template.color, "18"),
              color: textColor(template.color),
            }}
          >
            <GeneratedTemplateIcon name={template.icon} size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                className={cn(
                  "min-w-0 truncate font-bold tracking-tight text-indigo-950",
                  compact ? "text-[15px]" : "text-[21px]"
                )}
              >
                {template.appName}
              </h2>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                style={{ backgroundColor: colorWithAlpha(template.color, "18"), color: textColor(template.color) }}
              >
                {template.layout}
              </span>
            </div>
            <p className={cn("mt-1 text-slate-500", compact ? "text-[11px]" : "text-[13px]")}>
              {template.description}
            </p>
          </div>
        </div>
      </div>

      <div className={cn("space-y-5 p-4 sm:p-5", compact && "space-y-4 p-3 sm:p-4")}>
        {looseComponents.length > 0 && (
          <ComponentGrid components={looseComponents} color={template.color} compact={compact} />
        )}

        {sections.map((section) => (
          <PreviewSection
            key={section.id}
            section={section}
            color={template.color}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

function PreviewSection({
  section,
  color,
  compact,
}: {
  section: GeneratedTemplateSection;
  color: string;
  compact: boolean;
}) {
  return (
    <section>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-bold text-indigo-950 sm:text-[14px]">
            {section.title}
          </h3>
          {section.description && !compact && (
            <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{section.description}</p>
          )}
        </div>
        <ChevronRight size={14} className="mt-0.5 shrink-0 text-slate-300" />
      </div>
      <ComponentGrid components={section.components} color={color} compact={compact} />
    </section>
  );
}

function ComponentGrid({
  components,
  color,
  compact,
}: {
  components: GeneratedTemplateComponent[];
  color: string;
  compact: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {components.map((component) => (
        <ComponentCard
          key={component.id}
          component={component}
          color={color}
          compact={compact}
        />
      ))}
    </div>
  );
}

function ComponentCard({
  component,
  color,
  compact,
}: {
  component: GeneratedTemplateComponent;
  color: string;
  compact: boolean;
}) {
  return (
    <article className="min-w-0 rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-[12px] font-bold text-slate-800">{component.title}</h4>
          {component.description && !compact && (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
              {component.description}
            </p>
          )}
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]"
          style={{ backgroundColor: colorWithAlpha(color, "14"), color: textColor(color) }}
        >
          {component.type}
        </span>
      </div>

      {component.type === "stats" && <StatsBlock component={component} color={color} />}
      {component.type === "list" && <ListBlock component={component} color={color} />}
      {component.type === "checklist" && <ChecklistBlock component={component} color={color} />}
      {component.type === "table" && <TableBlock component={component} color={color} />}
      {component.type === "form" && <FormBlock component={component} color={color} />}
      {component.type === "progress" && <ProgressBlock component={component} color={color} />}
      {component.type === "buttons" && <ButtonsBlock component={component} color={color} />}
      {component.type === "tags" && <TagsBlock component={component} color={color} />}
      {component.type === "chart" && <ChartBlock component={component} color={color} />}
    </article>
  );
}

function StatsBlock({ component, color }: { component: GeneratedTemplateComponent; color: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(component.stats ?? []).map((stat) => (
        <div
          key={stat.id}
          className="min-w-0 rounded-lg border border-slate-100 p-3"
          style={{ backgroundColor: colorWithAlpha(color, "0D") }}
        >
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            {stat.label}
          </p>
          <p className="mt-1 truncate text-[22px] font-bold leading-none" style={{ color: textColor(color) }}>
            {stat.value}
          </p>
          {stat.helper && <p className="mt-1 truncate text-[10px] text-slate-400">{stat.helper}</p>}
        </div>
      ))}
    </div>
  );
}

function ListBlock({ component, color }: { component: GeneratedTemplateComponent; color: string }) {
  return (
    <div className="space-y-2">
      {(component.items ?? []).map((item) => (
        <div key={item.id} className="flex items-start gap-2 rounded-lg border border-slate-100 px-3 py-2">
          <Circle size={8} className="mt-1.5 shrink-0" style={{ color: textColor(color) }} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-slate-700">{item.label}</p>
            {item.detail && <p className="line-clamp-2 text-[11px] text-slate-400">{item.detail}</p>}
          </div>
          {item.tag && (
            <span className="shrink-0 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500">
              {item.tag}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function ChecklistBlock({ component, color }: { component: GeneratedTemplateComponent; color: string }) {
  return (
    <div className="space-y-2">
      {(component.items ?? []).map((item) => (
        <div key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2">
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
            style={{
              backgroundColor: item.checked ? textColor(color) : "#ffffff",
              borderColor: item.checked ? textColor(color) : "#E2E8F0",
              color: "#ffffff",
            }}
          >
            {item.checked && <Check size={11} />}
          </span>
          <span className={cn("min-w-0 flex-1 truncate text-[12px]", item.checked ? "text-slate-400 line-through" : "text-slate-700")}>
            {item.label}
          </span>
          {item.tag && <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500">{item.tag}</span>}
        </div>
      ))}
    </div>
  );
}

function TableBlock({ component, color }: { component: GeneratedTemplateComponent; color: string }) {
  const columns = component.columns ?? [];
  const rows = component.rows ?? [];

  return (
    <div className="overflow-hidden rounded-lg border border-slate-100">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[11px]">
          <thead style={{ backgroundColor: colorWithAlpha(color, "0F") }}>
            <tr>
              {columns.map((column) => (
                <th key={column} className="whitespace-nowrap px-3 py-2 font-bold text-slate-500">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column} className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {row[column] ?? "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FormBlock({ component, color }: { component: GeneratedTemplateComponent; color: string }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {(component.fields ?? []).map((field) => (
          <label key={field.id} className="min-w-0 space-y-1 text-[11px] font-semibold text-slate-500">
            <span className="block truncate">{field.label}</span>
            {field.type === "select" ? (
              <select
                disabled
                className="h-9 w-full rounded-lg border border-slate-100 bg-slate-50 px-3 text-[12px] text-slate-500"
                defaultValue={field.value ?? field.options?.[0] ?? ""}
              >
                {(field.options?.length ? field.options : [field.value ?? "Option"]).map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            ) : field.type === "checkbox" ? (
              <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 text-[12px] text-slate-500">
                <span className="h-3.5 w-3.5 rounded border border-slate-300 bg-white" />
                <span className="truncate">{field.value ?? field.placeholder ?? "Enabled"}</span>
              </div>
            ) : (
              <input
                readOnly
                type={field.type === "number" ? "text" : field.type}
                value={field.value ?? ""}
                placeholder={field.placeholder ?? field.label}
                className="h-9 w-full rounded-lg border border-slate-100 bg-slate-50 px-3 text-[12px] text-slate-500 placeholder:text-slate-300"
              />
            )}
          </label>
        ))}
      </div>
      <ButtonsBlock component={component} color={color} />
    </div>
  );
}

function ProgressBlock({ component, color }: { component: GeneratedTemplateComponent; color: string }) {
  const value = component.value ?? 0;
  const max = component.max ?? 100;
  const percent = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-500">
        <span className="truncate">{component.label ?? "Progress"}</span>
        <span style={{ color: textColor(color) }}>{percent}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: textColor(color) }} />
      </div>
    </div>
  );
}

function ButtonsBlock({ component, color }: { component: GeneratedTemplateComponent; color: string }) {
  const actions = component.actions ?? [];
  if (!actions.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-semibold transition-colors",
            action.variant === "primary"
              ? "border-transparent text-white"
              : action.variant === "ghost"
                ? "border-transparent bg-transparent text-slate-500"
                : "border-slate-100 bg-slate-50 text-slate-600"
          )}
          style={action.variant === "primary" ? { backgroundColor: textColor(color) } : undefined}
        >
          <Plus size={12} />
          {action.label}
        </button>
      ))}
    </div>
  );
}

function TagsBlock({ component, color }: { component: GeneratedTemplateComponent; color: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(component.tags ?? []).map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ backgroundColor: colorWithAlpha(color, "14"), color: textColor(color) }}
        >
          <Tag size={11} />
          {tag}
        </span>
      ))}
    </div>
  );
}

function ChartBlock({ component, color }: { component: GeneratedTemplateComponent; color: string }) {
  const rows = component.sampleData ?? [];
  const bars = rows.length ? rows.slice(0, 6) : [{ value: "40" }, { value: "72" }, { value: "58" }, { value: "86" }];

  return (
    <div className="rounded-lg border border-slate-100 p-3" style={{ backgroundColor: colorWithAlpha(color, "0A") }}>
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
        <BarChart3 size={13} style={{ color: textColor(color) }} />
        <span className="truncate">{component.chartType ?? "chart"} preview</span>
      </div>
      <div className="flex h-32 items-end gap-2">
        {bars.map((bar, index) => {
          const rawValue = Object.values(bar)[1] ?? Object.values(bar)[0] ?? "40";
          const height = Math.min(100, Math.max(18, Number.parseInt(String(rawValue), 10) || 40));

          return (
            <div key={index} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-lg"
                style={{ height: `${height}%`, backgroundColor: colorWithAlpha(color, index % 2 ? "99" : "CC") }}
              />
              <span className="w-full truncate text-center text-[9px] text-slate-400">
                {Object.values(bar)[0] ?? index + 1}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
