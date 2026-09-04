# Konversi "RALAT PER GURU UTARA_SEPTEMBER.pdf" (aSc per-guru, 35 halaman)
# menjadi xlsx siap-import aplikasi:
#   Guru | Hari | Jam Ke | Mapel/Kegiatan | Kelas
#   (kolom Waktu tidak disertakan — waktu tampil otomatis dari jam ke & hari)
#
# Konvensi jam slot = kolom MAPEL (bukan kolom kelas) — terverifikasi lewat
# skrip analisis-konvensi-jam.py (H0: hanya 2 slot jam 9 vs H1: 28; konflik
# kelas H0 hanya Tahfidz co-teaching asli).
#
# PDF memuat 3 slot Tahfidz co-teaching (1 kelas diampu 2 guru di hari+jam
# sama). Aplikasi tidak mendukung dua guru di kelas+slot yang sama, jadi baris
# duplikat kelas-slot dibuang (guru pertama yang muncul di PDF yang menang:
# B1/C1/H2 memegang slot, R2 melepas) → 306 baris impor tanpa bentrok.
import json
import re
from pypdf import PdfReader
from openpyxl import Workbook

PDF = "contoh_jadwal/RALAT PER GURU UTARA_SEPTEMBER.pdf"
OUT = "contoh_jadwal/Jadwal_Guru_Utara_September_Terstruktur.xlsx"

NAMA_HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
LABEL_HARI = {"Se", "Ra", "Ka", "Ju", "Sa"}
TINGKAT = {"VII", "VIII", "IX"}
RE_KELAS = re.compile(r"^(VII|VIII|IX)\s+([A-Z])$")

# Tabel lonceng dari PDF sendiri (identik di 35 halaman & dengan file Selatan).
WAKTU = {
    1: "6:50 - 7:55",
    2: "7:55 - 8:35",
    3: "8:35 - 9:15",
    4: "9:15 - 9:55",
    5: "10:10 - 10:50",
    6: "10:50 - 11:30",
    7: "11:30 - 12:10",
    8: "12:40 - 13:20",
    9: "13:20 - 14:00",
}


def extract_words(page):
    """Kata dengan koordinat asli PDF: [{x0, x1, y, t}] (y kecil = atas)."""
    raw = []

    def visitor(text, cm, tm, font_dict, font_size):
        if not text or not text.strip():
            return
        raw.append((tm[4], tm[5], text, tm[0] if tm[0] else 1.0))

    page.extract_text(visitor_text=visitor)
    raw.sort(key=lambda c: (-c[1], c[0]))
    words = []
    cur = None
    for (x, y, text, sx) in raw:
        w = len(text) * max(sx, 0.1)
        if cur is None or abs(y - cur["y"]) > 3.0 or x > cur["x1"] + 2.0:
            if cur:
                words.append(cur)
            cur = {"x0": x, "x1": x + w, "y": y, "t": text}
        else:
            cur["x1"] = max(cur["x1"], x + w)
            cur["t"] += text
    if cur:
        words.append(cur)
    return words


def kolom_dari_x(x_mid, centers):
    """Kolom 1..9 dari posisi x memakai batas titik tengah antar center kolom."""
    bounds = [centers[0] - (centers[1] - centers[0]) / 2]
    for i in range(len(centers) - 1):
        bounds.append((centers[i] + centers[i + 1]) / 2)
    bounds.append(centers[-1] + (centers[-1] - centers[-2]) / 2)
    for i in range(len(bounds) - 1):
        if bounds[i] <= x_mid < bounds[i + 1]:
            return i + 1
    return None


def frasa_mapel(tokens):
    """Gabung token berjarak dekat jadi frasa (satu mapel)."""
    out = []
    for w in tokens:
        if out and w["x0"] - out[-1]["x1"] <= 10:
            out[-1]["t"] += " " + w["t"]
            out[-1]["x1"] = max(out[-1]["x1"], w["x1"])
        else:
            out.append({"t": w["t"], "x0": w["x0"], "x1": w["x1"]})
    return out


def kelas_dari_tokens(tokens):
    """Daftar kelas {t, x0, x1} dari token tingkat+huruf (gabung atau terpisah)."""
    kelas = []
    used = set()
    for i, w in enumerate(tokens):
        if i in used:
            continue
        m = RE_KELAS.match(w["t"])
        if m:
            kelas.append({"t": f"{m.group(1)} {m.group(2)}", "x0": w["x0"], "x1": w["x1"]})
            used.add(i)
    for i, w in enumerate(tokens):
        if i in used or w["t"] not in TINGKAT:
            continue
        for j in range(i + 1, len(tokens)):
            if j in used:
                continue
            if re.fullmatch(r"[A-Z]", tokens[j]["t"]) and tokens[j]["x0"] - w["x1"] <= 30:
                kelas.append({"t": f"{w['t']} {tokens[j]['t']}", "x0": w["x0"], "x1": tokens[j]["x1"]})
                used.add(i)
                used.add(j)
                break
            if tokens[j]["x0"] - w["x1"] > 30:
                break
    return kelas


def parse_semua():
    reader = PdfReader(PDF)
    rows = []
    warnings = []
    dropped = []
    seenSlot = set()  # (kelas, hari, jam) yang sudah diambil guru lain
    for pi in range(len(reader.pages)):
        words = extract_words(reader.pages[pi])
        if not words:
            warnings.append(f"hal {pi+1}: kosong")
            continue
        baris = []
        for w in sorted(words, key=lambda w: (w["y"], w["x0"])):
            if baris and abs(w["y"] - baris[-1]["y"]) <= 5.0:
                baris[-1]["w"].append(w)
            else:
                baris.append({"y": w["y"], "w": [w]})
        for b in baris:
            b["w"].sort(key=lambda w: w["x0"])

        guru = kode = None
        for b in baris:
            teks = " ".join(w["t"] for w in b["w"])
            m = re.search(r"Teacher\s+(.+?)\s*\(([A-Z]+[0-9]+)\)", teks)
            if m:
                guru = re.sub(r"\s+", " ", m.group(1)).strip()
                kode = m.group(2)
                break
        if not guru or not kode:
            warnings.append(f"hal {pi+1}: guru/kode tidak ditemukan")
            continue

        # Baris waktu → center kolom 1..9
        waktu = None
        for b in baris:
            teks = " ".join(w["t"] for w in b["w"])
            if "6:50" in teks and "7:55" in teks:
                waktu = b
                break
        if not waktu:
            warnings.append(f"hal {pi+1} ({kode}): baris waktu tidak ditemukan")
            continue
        centers = []
        for w in waktu["w"]:
            for m in re.finditer(r"\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}", w["t"]):
                sp = m.end() - m.start()
                fr = (m.start() + sp / 2) / len(w["t"])
                centers.append(w["x0"] + fr * (w["x1"] - w["x0"]))
        if len(centers) < 9:
            warnings.append(f"hal {pi+1} ({kode}): hanya {len(centers)} kolom waktu")
            continue

        hariCounter = -1
        labelHari = 0
        pendingMapel = None
        for b in baris:
            if b is waktu:
                continue
            teks = " ".join(w["t"] for w in b["w"])
            if teks.startswith("Menghasilkan") or "aSc Timetables" in teks:
                continue
            if "Teacher" in teks or teks.strip() == "IKA MATSDA":
                continue
            if re.fullmatch(r"[\d\s]+", teks):
                continue  # baris nomor kolom 1..9

            first = b["w"][0] if b["w"] else None
            isLabel = first is not None and first["t"] in LABEL_HARI and first["x0"] < 120
            if isLabel:
                hariCounter += 1
                labelHari += 1
            sisa = b["w"][1:] if isLabel else b["w"]

            kls = kelas_dari_tokens(sisa)
            if kls:
                hari = NAMA_HARI[hariCounter] if 0 <= hariCounter < 6 else f"?{hariCounter+1}"
                if pendingMapel:
                    if len(pendingMapel) != len(kls):
                        warnings.append(f"hal {pi+1} ({kode}) {hari}: {len(pendingMapel)} mapel vs {len(kls)} kelas")
                    for i in range(min(len(pendingMapel), len(kls))):
                        mcol = kolom_dari_x((pendingMapel[i]["x0"] + pendingMapel[i]["x1"]) / 2, centers)
                        if mcol is None or mcol not in WAKTU:
                            warnings.append(f"hal {pi+1} ({kode}) {hari}: mapel '{pendingMapel[i]['t']}' di luar kolom 1..9 (x→kolom {mcol})")
                            continue
                        slot = (kls[i]["t"], hari, mcol)
                        if slot in seenSlot:
                            # Co-teaching (Tahfidz 2 guru di kelas+jam sama) —
                            # app hanya menerima 1 guru per kelas-slot.
                            dropped.append({
                                "guru": f"{guru} ({kode})", "hari": hari, "jam": mcol,
                                "mapel": pendingMapel[i]["t"], "kelas": kls[i]["t"],
                            })
                            continue
                        seenSlot.add(slot)
                        rows.append({
                            "guru": f"{guru} ({kode})",
                            "hari": hari,
                            "jam": mcol,
                            "waktu": WAKTU[mcol],
                            "mapel": pendingMapel[i]["t"],
                            "kelas": kls[i]["t"],
                        })
                else:
                    warnings.append(f"hal {pi+1} ({kode}) {hari}: kelas tanpa mapel sebelumnya")
                pendingMapel = None
            else:
                mp = [w for w in sisa if w["t"] not in LABEL_HARI]
                if mp:
                    pendingMapel = frasa_mapel(mp)

        if labelHari != 6:
            warnings.append(f"hal {pi+1} ({kode}): label hari {labelHari}/6")
    return rows, warnings, dropped


def main():
    rows, warnings, dropped = parse_semua()
    print(f"TOTAL BARIS: {len(rows)}")
    print(f"WARNING: {len(warnings)}")
    for w in warnings[:30]:
        print("  WARN:", w)
    print(f"CO-TEACH DIBUANG (duplikat kelas-slot): {len(dropped)}")
    for d in dropped:
        print(f"  - {d['guru']} | {d['hari']} | jam {d['jam']} | {d['mapel']} | {d['kelas']}")

    wb = Workbook()
    ws = wb.active
    ws.title = "Jadwal"
    ws.append(["Guru", "Hari", "Jam Ke", "Mapel/Kegiatan", "Kelas"])
    for r in rows:
        ws.append([r["guru"], r["hari"], r["jam"], r["mapel"], r["kelas"]])
    widths = [38, 10, 9, 20, 10]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = w
    wb.save(OUT)
    print(f"OK → {OUT}")
    print(f"Guru unik: {len(set(r['guru'] for r in rows))}")


if __name__ == "__main__":
    main()
