import { notFound } from "next/navigation";
import { fetchGeneratedApp } from "@/lib/actions/templates";
import { TemplateDetailClient } from "./template-detail-client";

type TemplateDetailPageProps = {
  params: Promise<{ appId: string }>;
};

export default async function TemplateDetailPage({ params }: TemplateDetailPageProps) {
  const { appId } = await params;
  const numericAppId = Number(appId);

  if (!Number.isInteger(numericAppId) || numericAppId <= 0) {
    notFound();
  }

  const app = await fetchGeneratedApp(numericAppId);

  if (!app) {
    notFound();
  }

  return <TemplateDetailClient initialApp={app} />;
}
