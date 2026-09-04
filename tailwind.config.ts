import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Aksen workspace — mengikuti data-workspace shell aktif
        // (jurnal: biru, administrasi: amber, analisis-nilai: violet).
        // Primitive disimpan sebagai triplet HSL (lihat app/globals.css).
        accent: "hsl(var(--workspace-accent-rgb) / <alpha-value>)",
        "accent-hover": "hsl(var(--workspace-accent-hover-rgb) / <alpha-value>)",
        "accent-soft": "hsl(var(--workspace-accent-soft-rgb) / <alpha-value>)",
        "accent-foreground": "hsl(var(--workspace-accent-foreground-rgb) / <alpha-value>)",
        "accent-border": "hsl(var(--workspace-accent-border-rgb) / <alpha-value>)",
        "accent-ring": "hsl(var(--workspace-accent-ring-rgb) / <alpha-value>)",
      },
      // Ramah mata guru tua: text-sm dinaikkan dari 14px → 16px (= ukuran text-base),
      // sehingga seluruh teks isi aplikasi membesar tanpa mengubah 90+ file satu per satu.
      fontSize: {
        sm: ["1rem", { lineHeight: "1.5rem" }],
      },
    },
  },
  plugins: [],
};
export default config;
