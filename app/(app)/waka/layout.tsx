import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function WakaLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!["WAKA", "ADMIN", "SUPERADMIN"].includes(user.role)) redirect("/");
  return <>{children}</>;
}