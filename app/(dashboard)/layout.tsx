import { Sidebar } from "@/components/sidebar";
import { fetchSidebarSubscriptionLabel } from "@/lib/actions/settings";
import { fetchSidebarGeneratedApps } from "@/lib/actions/templates";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarApps, subscriptionPlan] = await Promise.all([
    fetchSidebarGeneratedApps(),
    fetchSidebarSubscriptionLabel(),
  ]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#F4F3FF" }}>
      <Sidebar initialGeneratedApps={sidebarApps} initialSubscriptionPlan={subscriptionPlan} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
