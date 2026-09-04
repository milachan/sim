import { test } from "node:test";
import assert from "node:assert/strict";
import { alamatRumahJurnal, getWorkspaces, tentukanWorkspaceAktif } from "./workspace-config";

test("rumah jurnal GURU berada di / (default guru)", () => {
  assert.equal(alamatRumahJurnal("GURU"), "/");
  const rumah = getWorkspaces({ role: "GURU" });
  assert.equal(rumah[0].id, "JURNAL");
  assert.equal(rumah[0].href, "/");
});

test("rumah jurnal WAKA di /waka, KEPALA di /kamad, ADMIN & SUPERADMIN di /admin", () => {
  assert.equal(alamatRumahJurnal("WAKA"), "/waka");
  assert.equal(alamatRumahJurnal("KEPALA"), "/kamad");
  assert.equal(alamatRumahJurnal("ADMIN"), "/admin");
  assert.equal(alamatRumahJurnal("SUPERADMIN"), "/admin");
});

test("akun PIKET hanya mendapatkan rumah jurnal/absensi", () => {
  const rumah = getWorkspaces({ role: "GURU", isAkunPiket: true });
  assert.equal(rumah.length, 1);
  assert.equal(rumah[0].id, "JURNAL");
  assert.equal(rumah[0].href, "/absensi-harian");
  // PIKET tidak boleh menerima administrasi maupun analisis nilai.
  assert.ok(!rumah.some((r) => r.id === "ADMINISTRASI"));
  assert.ok(!rumah.some((r) => r.id === "ANALISIS_NILAI"));
});

test("role non-piket mendapat tiga rumah dengan urutan Jurnal dulu", () => {
  for (const role of ["GURU", "WAKA", "KEPALA", "ADMIN", "SUPERADMIN"] as const) {
    const rumah = getWorkspaces({ role });
    assert.deepEqual(rumah.map((r) => r.id), ["JURNAL", "ADMINISTRASI", "ANALISIS_NILAI"]);
    assert.ok(rumah[0].href.startsWith("/"));
  }
});

test("Administrasi memakai /administrasi dan Analisis Nilai memakai /analisis-nilai", () => {
  const rumah = getWorkspaces({ role: "GURU" });
  const administrasi = rumah.find((r) => r.id === "ADMINISTRASI")!;
  const analisis = rumah.find((r) => r.id === "ANALISIS_NILAI")!;
  assert.equal(administrasi.href, "/administrasi");
  assert.equal(analisis.href, "/analisis-nilai");
});

test("setiap workspace punya label, deskripsi, icon, tema, dan warna aksen", () => {
  const semua = [
    ...getWorkspaces({ role: "GURU" }),
    ...getWorkspaces({ role: "GURU", isAkunPiket: true }),
  ];
  const tema = new Set<string>();
  const warna = new Set<string>();
  for (const r of semua) {
    assert.ok(r.label.trim().length > 0);
    assert.ok(r.deskripsi.trim().length > 0);
    assert.ok(r.icon != null);
    assert.ok(r.tema.trim().length > 0);
    assert.match(r.warnaAksen, /^#[0-9A-Fa-f]{6}$/);
    tema.add(r.tema);
    warna.add(r.warnaAksen);
  }
  assert.equal(tema.size, 3);
  assert.equal(warna.size, 3);
});

test("href unik dalam satu daftar workspace", () => {
  const rumah = getWorkspaces({ role: "WAKA" });
  const hrefs = rumah.map((r) => r.href);
  assert.deepEqual([...new Set(hrefs)], hrefs);
});

test("fungsi murni: input sama menghasilkan output identik", () => {
  const a = getWorkspaces({ role: "GURU" });
  const b = getWorkspaces({ role: "GURU" });
  assert.deepEqual(a, b);
});

test("switcher: link tiap rumah benar untuk semua role non-piket", () => {
  const harapanJurnal: Record<string, string> = {
    GURU: "/",
    WAKA: "/waka",
    KEPALA: "/kamad",
    ADMIN: "/admin",
    SUPERADMIN: "/admin",
  };
  for (const [role, hrefJurnal] of Object.entries(harapanJurnal)) {
    const rumah = getWorkspaces({ role: role as never });
    const byId = Object.fromEntries(rumah.map((r) => [r.id, r.href]));
    assert.equal(byId.JURNAL, hrefJurnal, `jurnal ${role}`);
    assert.equal(byId.ADMINISTRASI, "/administrasi", `administrasi ${role}`);
    assert.equal(byId.ANALISIS_NILAI, "/analisis-nilai", `analisis ${role}`);
  }
});

test("tentukanWorkspaceAktif: administrasi & analisis dikenali dari pathname", () => {
  const rumah = getWorkspaces({ role: "GURU" });
  assert.equal(tentukanWorkspaceAktif("/administrasi", rumah), "ADMINISTRASI");
  assert.equal(tentukanWorkspaceAktif("/administrasi/surat/12", rumah), "ADMINISTRASI");
  assert.equal(tentukanWorkspaceAktif("/analisis-nilai", rumah), "ANALISIS_NILAI");
  assert.equal(tentukanWorkspaceAktif("/analisis-nilai/kelas/9A", rumah), "ANALISIS_NILAI");
});

test("tentukanWorkspaceAktif: route jurnal dan selain dua rumah = JURNAL (default)", () => {
  const rumahGuru = getWorkspaces({ role: "GURU" });
  for (const p of ["/", "/jadwal", "/jurnal", "/nilai", "/absensi-harian", "/laporan"]) {
    assert.equal(tentukanWorkspaceAktif(p, rumahGuru), "JURNAL");
  }
  // Jurnal tetap default walau pathname kosong.
  assert.equal(tentukanWorkspaceAktif(null, rumahGuru), "JURNAL");
  // Route jurnal WAKA (/waka) juga dikenali sebagai rumah JURNAL miliknya.
  const rumahWaka = getWorkspaces({ role: "WAKA" });
  assert.equal(tentukanWorkspaceAktif("/waka/pemantauan", rumahWaka), "JURNAL");
});
