"use client";

/**
 * <select> yang langsung berpindah halaman saat dipilih.
 * Client component — dipakai di Server Component untuk filter berbasis URL
 * (server component tidak boleh punya event handler onChange).
 * Semua query param yang sudah ada di URL dipertahankan, hanya `param` yang diganti.
 */
export function SelectNavigasi({
  param,
  value,
  options,
  className = "input",
}: {
  param: string;
  value: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      name={param}
      value={value}
      className={className}
      onChange={(e) => {
        const url = new URL(window.location.href);
        url.searchParams.set(param, e.target.value);
        window.location.href = url.toString();
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}