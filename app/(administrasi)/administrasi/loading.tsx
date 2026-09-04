import SkeletonPage from "@/components/ds/skeleton";

// Skeleton halaman Administrasi — komponen bersama, reduced-motion friendly.

export default function AdministrasiLoading() {
  return <SkeletonPage cards={6} />;
}
