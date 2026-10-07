import AppShell from "./_shell";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { resto_name } = await getSettings();
  return <AppShell shopName={resto_name}>{children}</AppShell>;
}
