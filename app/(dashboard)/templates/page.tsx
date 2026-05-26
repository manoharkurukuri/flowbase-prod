import { fetchGeneratedApps } from "@/lib/actions/templates";
import { TemplatesPageClient } from "./templates-page-client";

export default async function TemplatesPage() {
  const apps = await fetchGeneratedApps();

  return <TemplatesPageClient initialApps={apps} />;
}
