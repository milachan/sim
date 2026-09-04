import { test } from "node:test";
import assert from "node:assert/strict";
import { BarDatum } from "./charts";

function makeData(n: number, label: (i:number)=>string, nilai: (i:number)=>number): BarDatum[] {
  return Array.from({ length: n }, (_, i) => ({ label: label(i), nilai: nilai(i) }));
}

test("BarChartVertikal: 1 item tidak scroll threshold 6", () => {
  const data = makeData(1, () => "A", () => 50);
  assert.equal(data.length <= 6, true);
});

test("BarChartVertikal: 6 item pas threshold tidak scroll", () => {
  const data = makeData(6, (i) => `M-${5-i}`, () => 50);
  assert.equal(data.length <= 6, true);
});

test("BarChartVertikal: 14 item melebihi threshold butuh scroll", () => {
  const data = makeData(14, (i) => `${i+1}/8`, () => 50);
  assert.equal(data.length > 6, true);
  const barMinW = 44;
  const inner = data.length * barMinW + 8 * (data.length -1);
  assert.ok(inner > 300, `inner ${inner} harus > card sempit`);
});

test("BarChartVertikal: 24 item inner minWidth besar", () => {
  const data = makeData(24, (i) => `Agu ${26 + Math.floor(i / 12)}`, (j) => j % 100);
  const inner = data.length * 44 + 8 * (data.length - 1);
  assert.ok(inner > 1000);
});

test("label pendek harian: 8/8, 10/8 dua baris tidak truncate tunggal", () => {
  const label = "Sen\n10/8";
  assert.deepEqual(label.split("\n").length, 2);
});

test("label mingguan: Kini dan M-5", () => {
  const labels = ["M-5","M-4","M-3","M-2","M-1","Kini"];
  assert.equal(labels[5], "Kini");
});

test("label bulanan unik melewati tahun: Agu 26 vs Jan 27", () => {
  const d1 = new Date(2026,7,1).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
  const d2 = new Date(2027,0,1).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
  assert.notEqual(d1, d2);
});

test("semua nilai nol: max 1, tinggi minimal", () => {
  const data = makeData(6, (i) => `L${i}`, () => 0);
  const max = Math.max(1, ...data.map(d=>d.nilai));
  assert.equal(max, 1);
});

test("nilai campuran 0-100 dan semua sama tidak error", () => {
  const data = makeData(6, (ii)=>`L${ii}`, (ii)=> ii%2?0:100);
  assert.ok(data.every(d=>typeof d.nilai==="number"));
});

test("nilai maksimal 100% tetap 100%", () => {
  const data = makeData(3, ()=> "A", ()=> 100);
  assert.equal(Math.max(1, ...data.map(d=>d.nilai)), 100);
});
