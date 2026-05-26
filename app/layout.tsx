import { ClerkProvider } from '@clerk/nextjs';
import { syncUser } from "@/lib/actions/sync-user";
import { Plus_Jakarta_Sans } from "next/font/google";
import "@liveblocks/react-ui/styles.css";
import "@excalidraw/excalidraw/index.css";
import "./globals.css";
import type { Metadata } from "next";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FlowBase — Your Intelligent Workspace",
  description: "A modern productivity workspace combining notes, kanban, whiteboard, and AI tools.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await syncUser();

  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${font.variable} font-sans antialiased`}
          style={{ margin: 0, padding: 0, fontFamily: "var(--font-jakarta), Inter, system-ui, sans-serif" }}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
