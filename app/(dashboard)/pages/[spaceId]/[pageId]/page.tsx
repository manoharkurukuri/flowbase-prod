import { notFound } from "next/navigation";
import { fetchPage, fetchSpaces, recordPageOpened } from "@/lib/actions/pages";
import { PageEditorClient } from "./page-editor-client";

type PageDetailProps = {
  params: Promise<{ spaceId: string; pageId: string }>;
};

export default async function PageDetailPage({ params }: PageDetailProps) {
  const { pageId, spaceId } = await params;
  const numericSpaceId = Number(spaceId);
  const numericPageId = Number(pageId);

  if (
    !Number.isInteger(numericSpaceId) ||
    numericSpaceId <= 0 ||
    !Number.isInteger(numericPageId) ||
    numericPageId <= 0
  ) {
    notFound();
  }

  try {
    await recordPageOpened(numericPageId);
    const [page, spaces] = await Promise.all([
      fetchPage(numericSpaceId, numericPageId),
      fetchSpaces(),
    ]);

    return <PageEditorClient initialPage={page} availableSpaces={spaces} />;
  } catch {
    notFound();
  }
}
