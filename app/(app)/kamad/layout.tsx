import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function KamadLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!["KEPALA", "ADMIN", "SUPERADMIN"].includes(user.role)) redirect("/");
  return <>{children}</>;
}