"use client";

import type { ComponentType, CSSProperties } from "react";
import {
  Apple,
  BookOpen,
  Brain,
  Briefcase,
  CalendarCheck,
  ChartNoAxesColumn,
  ClipboardList,
  Coffee,
  Dumbbell,
  Flame,
  GraduationCap,
  Heart,
  Home,
  ListChecks,
  Music,
  Palette,
  PiggyBank,
  Plane,
  ShoppingCart,
  Sparkles,
  Target,
  Timer,
  Trophy,
  Utensils,
  Wallet,
  type LucideProps,
} from "lucide-react";
import { type GeneratedTemplateIcon } from "@/lib/templates";

const iconMap: Record<GeneratedTemplateIcon, ComponentType<LucideProps>> = {
  Sparkles,
  Flame,
  Wallet,
  PiggyBank,
  Utensils,
  Apple,
  BookOpen,
  GraduationCap,
  Brain,
  CalendarCheck,
  ClipboardList,
  ListChecks,
  Target,
  Trophy,
  Timer,
  Dumbbell,
  Heart,
  Home,
  Briefcase,
  Plane,
  ShoppingCart,
  Music,
  Palette,
  Coffee,
  ChartNoAxesColumn,
};

type GeneratedTemplateIconProps = {
  name: GeneratedTemplateIcon;
  size?: number;
  className?: string;
  style?: CSSProperties;
};

export function GeneratedTemplateIcon({
  name,
  size = 16,
  className,
  style,
}: GeneratedTemplateIconProps) {
  const Icon = iconMap[name] ?? Sparkles;
  return <Icon size={size} className={className} style={style} />;
}
