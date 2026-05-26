import { fetchSpaces } from "@/lib/actions/pages";
import { SpacesPageClient } from "./spaces-page-client";

export default async function PagesIndexPage() {
  const spaces = await fetchSpaces();

  return <SpacesPageClient initialSpaces={spaces} />;
}
