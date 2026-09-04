import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { adalahAdmin } from "@/lib/otorisasi";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!adalahAdmin(user.role)) redirect("/");
  return <>{children}</>;
}