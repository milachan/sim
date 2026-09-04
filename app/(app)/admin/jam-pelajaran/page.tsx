import { getJamPelajaran } from "@/lib/actions/admin";
import { AdminJamPelajaranClient } from "@/components/admin/jam-pelajaran-client";

export const dynamic = "force-dynamic";

export default async function AdminJamPelajaranPage({
  searchParams,
}: {
  searchParams: { sukses?: string; error?: string };
}) {
  const data = await getJamPelajaran();
  return <AdminJamPelajaranClient data={data} searchParams={searchParams} />;
}
