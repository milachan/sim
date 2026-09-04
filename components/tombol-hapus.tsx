"use client";

/**
 * Form hapus dengan dialog konfirmasi.
 * Client component — Server Component tidak boleh punya event handler (onSubmit/onClick),
 * sehingga form hapus yang butuh window.confirm harus diisolasi di komponen ini.
 */
export function TombolHapus({
  action,
  id,
  pesan,
  label = "Hapus",
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  pesan: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(pesan)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="btn-ghost btn-sm !px-2.5 text-rose-600 hover:bg-rose-50">{label}</button>
    </form>
  );
}