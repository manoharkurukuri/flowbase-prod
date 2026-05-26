import { fetchWhiteboards } from "@/lib/actions/whiteboard";
import { WhiteboardPageClient } from "./whiteboard-page-client";

export default async function WhiteboardPage() {
  const whiteboards = await fetchWhiteboards();

  return <WhiteboardPageClient initialWhiteboards={whiteboards} />;
}
