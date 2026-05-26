import { fetchSettingsPageData } from "@/lib/actions/settings";
import { SettingsPageClient } from "./settings-page-client";

export default async function SettingsPage() {
  const data = await fetchSettingsPageData();

  return <SettingsPageClient initialData={data} />;
}
