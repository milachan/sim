import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
try {
  // Cek otorisasi per role via data nyata — tanpa login network, verifikasi model
  const users = await prisma.user.findMany({ include:{ guru:true } });
  for (const u of users) {
    console.log(`${u.username} ${u.role} guruId=${u.guruId?u.guru.nama:"-"} aktif=${u.aktif}`);
  }
  // Cek jadwal per guru
  const jadwalByGuru = await prisma.jadwal.groupBy({ by:['guruId'], _count:{ guruId:true } });
  console.log("\nJadwal per guru:");
  for (const r of jadwalByGuru) {
    const g = await prisma.guru.findUnique({ where:{id:r.guruId} });
    console.log(`  ${g?.nama} (${g?.kode}) : ${r._count.guruId} jadwal`);
  }
  // Cek bentrok detail (kelas bentrok 2)
  const jadwal = await prisma.jadwal.findMany({ include:{ guru:true, kelas:true, mapel:true, semester:true } });
  console.log(`\nTotal jadwal: ${jadwal.length}`);
  // Detail 2 bentrok kelas (kelas sama overlap)
  const overlap=(a1,a2,b1,b2)=> !(a2 < b1 || b2 < a1);
  for (let i=0;i<jadwal.length;i++) for(let k=i+1;k<jadwal.length;k++){
    const a=jadwal[i], b=jadwal[k];
    if(a.semesterId!==b.semesterId || a.hari!==b.hari || a.kelasId!==b.kelasId) continue;
    if(!overlap(a.jamKeMulai,a.jamKeSelesai,b.jamKeMulai,b.jamKeSelesai)) continue;
    console.log(`BENTROK KELAS: ${a.kelas.nama} ${a.hari} ${a.jamKeMulai}-${a.jamKeSelesai} (${a.mapel.nama}/${a.guru.nama}) vs ${b.jamKeMulai}-${b.jamKeSelesai} (${b.mapel.nama}/${b.guru.nama})`);
  }
} catch(e){ console.error(e); process.exit(1);} finally{ await prisma.$disconnect(); }
