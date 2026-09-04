import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
try {
  const gurus = await prisma.guru.findMany({ select:{id:true,nama:true,kode:true,status:true,deletedAt:true,jenisGuru:true} });
  const users = await prisma.user.findMany({ select:{id:true,username:true,nama:true,role:true,aktif:true,guruId:true} });
  const kelas = await prisma.kelas.findMany({ select:{id:true,nama:true,tingkat:true,waliKelasId:true} });
  const siswa = await prisma.siswa.count();
  const jadwal = await prisma.jadwal.findMany({ select:{id:true,guruId:true,kelasId:true,mapelId:true,semesterId:true,hari:true,jamKeMulai:true,jamKeSelesai:true} });
  const mapel = await prisma.mataPelajaran.findMany({ select:{id:true,nama:true} });
  const semester = await prisma.semester.findMany({ include:{tahunAjaran:true} });
  const pertemuan = await prisma.pertemuan.count();
  const jurnal = await prisma.jurnal.count();
  const absensiHarian = await prisma.absensiHarian.count();

  // Cek jadwal jam pertama
  const jamPertama = jadwal.filter(j=>j.jamKeMulai===1);
  // Cek duplikasi jadwal (kelas+hari+jam+mapel per semester)
  const seen=new Map(); let dup=0;
  for(const j of jadwal){ const k=`${j.kelasId}|${j.hari}|${j.jamKeMulai}-${j.jamKeSelesai}|${j.mapelId}|${j.semesterId}`; if(seen.has(k)) dup++; else seen.set(k,true); }
  // Bentrok guru / kelas via validasiJadwal logic overlap
  const overlap=(a1,a2,b1,b2)=> !(a2 < b1 || b2 < a1);
  let bentrokGuru=0, bentrokKelas=0;
  // Group by hari+semester
  const byHari=new Map();
  for(const j of jadwal){ const k=`${j.semesterId}|${j.hari}`; if(!byHari.has(k)) byHari.set(k,[]); byHari.get(k).push(j); }
  for(const list of byHari.values()){
    for(let i=0;i<list.length;i++) for(let k=i+1;k<list.length;k++){
      const a=list[i], b=list[k];
      if(!overlap(a.jamKeMulai,a.jamKeSelesai,b.jamKeMulai,b.jamKeSelesai)) continue;
      if(a.guruId===b.guruId) bentrokGuru++;
      if(a.kelasId===b.kelasId) bentrokKelas++;
    }
  }
  // Guru tanpa akun, akun tanpa guru
  const guruIds=new Set(gurus.map(g=>g.id));
  const userGuruIds=new Set(users.filter(u=>u.guruId).map(u=>u.guruId));
  const guruTanpaAkun=gurus.filter(g=> !users.some(u=>u.guruId===g.id));
  const akunGuruWakaTanpaGuruId=users.filter(u=> (u.role==="GURU"||u.role==="WAKA") && !u.guruId);
  const dupUsername=new Map(); for(const u of users) dupUsername.set(u.username,(dupUsername.get(u.username)||0)+1);
  const dups=[...dupUsername.entries()].filter(([,c])=>c>1);

  console.log(JSON.stringify({
    gurus: { total:gurus.length, aktif:gurus.filter(g=>g.status&&!g.deletedAt).length, items:gurus.map(g=>({nama:g.nama,kode:g.kode,jenisGuru:g.jenisGuru,status:g.status,deletedAt:!!g.deletedAt})) },
    users: { total:users.length, byRole: Object.fromEntries([...new Set(users.map(u=>u.role))].map(r=>[r, users.filter(u=>u.role===r).length])), items: users.map(u=>({username:u.username,nama:u.nama,role:u.role,aktif:u.aktif,guruId:u.guruId? "linked":"null"})) },
    kelas: kelas.map(k=>({nama:k.nama,tingkat:k.tingkat,waliKelasId: k.waliKelasId? "ada":"null"})),
    siswa, jadwalCount: jadwal.length, jamPertamaCount: jamPertama.length, pertemuan, jurnal, absensiHarian,
    mapelCount: mapel.length, semester: semester.map(s=>({nama:s.nama, tahunAjaran:s.tahunAjaran.nama, aktif:s.aktif})),
    dupJadwal: dup, bentrokGuru, bentrokKelas,
    guruTanpaAkun: guruTanpaAkun.map(g=>({nama:g.nama,kode:g.kode})),
    akunGuruWakaTanpaGuruId: akunGuruWakaTanpaGuruId.map(u=>({username:u.username,role:u.role})),
    dupUsername: dups,
    jadwalSample: jadwal.slice(0,5).map(j=>({hari:j.hari, jam:`${j.jamKeMulai}-${j.jamKeSelesai}`, kelasId:j.kelasId, guruId:j.guruId})),
  }, null, 2));
} catch(e){ console.error(e); process.exit(1);} finally{ await prisma.$disconnect(); }
