const prisma = require('../prisma/client');
const { satkerTotals, latestUploadIds, inputsAt, refDate, pct, round2 } = require('./rekapSummary');

/*
 * Rekap khusus satker BRMP Perkebunan: baris Program, RO, Komponen dan Sub-komponen dari file Akrual dan SP2D terbaru.
 *  - Pagu Efektif, Realisasi Akrual, %, Sisa Anggaran : file Akrual
 *  - Realisasi SP2D dan %                             : file SP2D
 *  - Pagu Total dan % Target SP2D                     : input manual per baris (PAGU_REKAP, TARGET_REKAP)
 *  - Gap                                              : % SP2D - % Target SP2D
 * Kode seperti 051 muncul di banyak induk, jadi tiap baris dikenali dari jalur kodenya (mis. HA|SDA.003|051|051.0A).
 */

const SATKER_NAME = 'BRMP Perkebunan';
const SHOWN = ['PROGRAM', 'RO', 'KOMPONEN', 'SUBKOMPONEN'];
// Kedalaman tiap jenis baris. LAINNYA (mis. EBA.Z03) dipakai sebagai RO untuk jalur kode saja dan tidak ditampilkan.
const DEPTH = { PROGRAM: 0, KEGIATAN: 1, KRO: 2, RO: 3, LAINNYA: 3, KOMPONEN: 4, SUBKOMPONEN: 5 };
const PATH_DEPTHS = [0, 3, 4, 5]; // Program, RO, Komponen, Sub-komponen

const has = (v) => v !== null && v !== undefined;
const r2 = (v) => (has(v) ? round2(Number(v)) : null);

async function findSatker() {
  const rows = await prisma.$queryRaw`
    SELECT id, name FROM satker WHERE LOWER(TRIM(name)) = LOWER(${SATKER_NAME}) ORDER BY id LIMIT 1`;
  return rows[0] || null;
}

// Baris hierarki satu upload, lengkap dengan jalur kodenya
async function hierarchy(uploadId) {
  const data = await prisma.$queryRaw`
    SELECT r.kode, r.tipe::text AS tipe, r.uraian,
           r.pagu_revisi::float8 AS pagu, r.sampai_periode::float8 AS sampai,
           r.persentase::float8 AS persen, r.sisa_anggaran::float8 AS sisa
    FROM rekap_data r
    WHERE r.upload_id = ${uploadId}
      AND (r.tipe::text IN ('TOTAL', 'PROGRAM', 'KEGIATAN', 'KRO', 'RO', 'KOMPONEN', 'SUBKOMPONEN')
           OR (r.tipe::text = 'LAINNYA' AND r.kode ~ '^[A-Z]{3}[.][0-9A-Z]{3}$'))
    ORDER BY r.sheet_name, r.row_number`;

  let total = null;
  const rows = [];
  let stack = [];
  for (const r of data) {
    if (r.tipe === 'TOTAL') {
      if (!total) total = r;
      continue;
    }
    const d = DEPTH[r.tipe];
    stack = stack.slice(0, d);
    stack[d] = r.kode;
    if (!SHOWN.includes(r.tipe)) continue;
    const level = PATH_DEPTHS.indexOf(d);
    const key = PATH_DEPTHS.slice(0, level + 1).map((x) => stack[x]).filter(Boolean).join('|');
    rows.push({ key, level: r.tipe, kode: r.kode, uraian: r.uraian, pagu: r.pagu, sampai: r.sampai, persen: r.persen, sisa: r.sisa });
  }
  return { rows, total };
}

async function brmpRekap({ range, dateTo } = {}) {
  const ref = refDate(dateTo);
  const satker = await findSatker();
  if (!satker) return { satker: null, ref, top: null, rows: [] };

  const satkerId = satker.id;
  const [akIds, spIds] = await Promise.all([
    latestUploadIds({ satkerId, kategori: 'AKRUAL', range }),
    latestUploadIds({ satkerId, kategori: 'SP2D', range }),
  ]);
  const [ak, sp, summary, paguIn, targetIn] = await Promise.all([
    akIds[0] ? hierarchy(akIds[0]) : null,
    spIds[0] ? hierarchy(spIds[0]) : null,
    satkerTotals({ satkerId, range, dateTo }),
    inputsAt({ ref, satkerId, jenis: 'PAGU_REKAP' }),
    inputsAt({ ref, satkerId, jenis: 'TARGET_REKAP' }),
  ]);

  const pagu = new Map(paguIn.map((i) => [i.kode, i.nilai]));
  const target = new Map(targetIn.map((i) => [i.kode, i.nilai]));

  // Susunan baris mengikuti file Akrual; baris yang hanya ada di file SP2D ditambahkan di akhir
  const map = new Map();
  const slot = (r) => {
    if (!map.has(r.key)) {
      map.set(r.key, {
        key: r.key, level: r.level, kode: r.kode, uraian: r.uraian,
        pagu_efektif: null, realisasi_akrual: null, persentase_akrual: null, sisa_anggaran: null,
        realisasi_sp2d: null, persentase_sp2d: null,
      });
    }
    return map.get(r.key);
  };
  (ak?.rows || []).forEach((r) => {
    const e = slot(r);
    e.pagu_efektif = r2(r.pagu);
    e.realisasi_akrual = r2(r.sampai);
    e.persentase_akrual = has(r.persen) ? r2(r.persen) : pct(r.sampai, r.pagu);
    e.sisa_anggaran = r2(r.sisa);
  });
  (sp?.rows || []).forEach((r) => {
    const e = slot(r);
    e.realisasi_sp2d = r2(r.sampai);
    e.persentase_sp2d = has(r.persen) ? r2(r.persen) : pct(r.sampai, has(e.pagu_efektif) ? e.pagu_efektif : r.pagu);
  });

  const rows = [...map.values()].map((e) => {
    const t = target.has(e.key) ? target.get(e.key) : null;
    return {
      ...e,
      pagu_total: pagu.has(e.key) ? pagu.get(e.key) : null,
      target_sp2d: t,
      gap: has(t) && has(e.persentase_sp2d) ? round2(e.persentase_sp2d - t) : null,
    };
  });

  // Baris judul (satker): angka yang sama dengan tabel Rekap per satker
  const s = summary.rows[0] || {};
  const top = {
    pagu_total: s.pagu_total ?? null,
    pagu_efektif: s.pagu_efektif ?? null,
    realisasi_akrual: s.realisasi_akrual ?? null,
    persentase_akrual: s.persentase_akrual ?? null,
    sisa_anggaran: ak?.total ? r2(ak.total.sisa) : null,
    realisasi_sp2d: s.realisasi_sp2d ?? null,
    persentase_sp2d: s.persentase_sp2d ?? null,
    target_sp2d: s.target_sp2d ?? null,
    gap: s.gap ?? null,
    upload_akrual: s.upload_akrual || null,
    upload_sp2d: s.upload_sp2d || null,
  };

  return { satker, ref, top, rows };
}

module.exports = { brmpRekap, SATKER_NAME };