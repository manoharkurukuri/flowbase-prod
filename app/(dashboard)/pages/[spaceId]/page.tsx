import { notFound } from "next/navigation";
import { fetchSpace, fetchSpaces, recordSpaceOpened } from "@/lib/actions/pages";
import { SpaceDetailClient } from "./space-detail-client";

type SpacePageProps = {
  params: Promise<{ spaceId: string }>;
};

export default async function SpacePage({ params }: SpacePageProps) {
  const { spaceId } = await params;
  const numericSpaceId = Number(spaceId);

  if (!Number.isInteger(numericSpaceId) || numericSpaceId <= 0) {
    notFound();
  }

  try {
    await recordSpaceOpened(numericSpaceId);
    const [space, spaces] = await Promise.all([fetchSpace(numericSpaceId), fetchSpaces()]);

    return <SpaceDetailClient initialSpace={space} availableSpaces={spaces} />;
  } catch {
    notFound();
  }
}
