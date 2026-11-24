import { useCallback, useEffect, useState } from 'react';
import api, { errMsg } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import Field from '../components/Field';
import Select from '../components/Select';
import DatePicker from '../components/DatePicker';
import { Skeleton, SkeletonRows } from '../components/Skeleton';
import { IconButton } from '../components/ActionIcon';
import { fmtNum, fmtPct, fmtShortDate, fmtDateTime } from '../utils/format';
import { btnGhost, btnPrimary, card, input, inputInvalid, td, th } from '../utils/ui';

/*
 * Input manual: pagu total (satker, program, belanja) dan % target SP2D.
 * Setiap perubahan menambah riwayat dengan tanggal berlaku; Dashboard memakai nilai yang berlaku
 * pada tanggal acuan filternya. Pengguna hanya dapat mengubah satkernya sendiri (Admin: semua).
 */

const todayWib = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

const dash = <span className="text-slate-400">-</span>;

// Teks isian angka: rupiah diberi titik ribuan, koma untuk desimal. Persen tanpa titik ribuan.
function maskNumber(raw, grouped) {
  const clean = String(raw).replace(/[^\d,]/g, '');
  const [int, ...rest] = clean.split(',');
  const dec = rest.join('').slice(0, 2);
  const intText = grouped ? int.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.') : int;
  return rest.length ? `${intText},${dec}` : intText;
}

const parseNumber = (text) => {
  const n = Number(String(text).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

// Isian angka bawaan untuk formulir ubah (nilai lama, atau kosong)
const toText = (n, grouped) => (n === null || n === undefined ? '' : maskNumber(String(n).replace('.', ','), grouped));

const JENIS_LABEL = {
  PAGU_SATKER: 'Pagu total satker',
  PAGU_PROGRAM: 'Pagu total program',
  PAGU_BELANJA: 'Pagu total belanja',
  TARGET_SP2D: '% Target SP2D',
};

const money = (n) => (n === null || n === undefined ? dash : fmtNum(n, 2));

/* ------------------------------------------------------------------ */
/* KOMPONEN KECIL                                                      */
/* ------------------------------------------------------------------ */

// Satu nilai input dengan keterangan "berlaku sejak" dan pengubah
function ValueMeta({ input: i }) {
  if (!i) return <span className="text-xs text-slate-400">Belum diinput</span>;
  return (
    <span className="text-xs text-slate-400">
      Berlaku sejak {fmtShortDate(i.berlaku_mulai)} · {i.diubah_oleh}
    </span>
  );
}

function Actions({ canEdit, onEdit, onHistory }) {
  return (
    <div className="flex justify-center gap-1.5">
      {canEdit && <IconButton icon="edit" label="Ubah" onClick={onEdit} />}
      <IconButton icon="history" label="Riwayat" onClick={onHistory} />
    </div>
  );
}

function Notice({ tone = 'amber', children }) {
  const cls = tone === 'amber' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800';
  return (
    <div role="status" className={`rounded-lg px-4 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HALAMAN                                                             */
/* ------------------------------------------------------------------ */

export default function PaguTarget() {
  const { user } = useAuth();

  const [satkers, setSatkers] = useState([]);
  const [satkerId, setSatkerId] = useState(user.satker ? String(user.satker.id) : '');
  const [tanggal, setTanggal] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // modal: { type: 'edit', jenis, kode, label, value, uraian } | { type: 'program' } | { type: 'history', jenis, kode, label }
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ nilai: '', berlaku_mulai: '', kode: '', uraian: '' });
  const [formErrors, setFormErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState('');
  const [history, setHistory] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Daftar satker; Admin (tanpa satker) otomatis memilih satker pertama
  useEffect(() => {
    api
      .get('/satker')
      .then((r) => {
        setSatkers(r.data.data);
        setSatkerId((cur) => cur || (r.data.data[0] ? String(r.data.data[0].id) : ''));
      })
      .catch((e) => setError(errMsg(e)));
  }, []);

  const load = useCallback(async () => {
    if (!satkerId) return;
    setLoading(true);
    try {
      const params = { satker_id: satkerId };
      if (tanggal) params.tanggal = tanggal;
      const res = await api.get('/pagu', { params });
      setData(res.data);
      setError('');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [satkerId, tanggal]);

  useEffect(() => {
    load();
  }, [load]);

  const canEdit = Boolean(data?.can_edit);

  /* ---------- modal ubah / tambah ---------- */

  const closeModal = () => {
    setModal(null);
    setModalError('');
    setFormErrors({});
    setHistory(null);
    setConfirmDeleteId(null);
  };

  const openEdit = (jenis, kode, label, current, uraian = '') => {
    setForm({
      nilai: toText(current?.nilai, jenis !== 'TARGET_SP2D'),
      berlaku_mulai: todayWib(),
      kode,
      uraian,
    });
    setFormErrors({});
    setModalError('');
    setModal({ type: 'edit', jenis, kode, label, uraian });
  };

  const openProgram = () => {
    setForm({ nilai: '', berlaku_mulai: todayWib(), kode: '', uraian: '' });
    setFormErrors({});
    setModalError('');
    setModal({ type: 'program', jenis: 'PAGU_PROGRAM', label: 'Tambah program' });
  };

  const openHistory = async (jenis, kode, label) => {
    setModal({ type: 'history', jenis, kode, label });
    setHistory(null);
    setModalError('');
    setConfirmDeleteId(null);
    try {
      const res = await api.get('/pagu/riwayat', { params: { satker_id: satkerId, jenis, kode } });
      setHistory(res.data.data);
    } catch (e) {
      setModalError(errMsg(e));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    const isTarget = modal.jenis === 'TARGET_SP2D';

    if (modal.type === 'program' && !/^[A-Za-z]{2}$/.test(form.kode.trim())) errs.kode = 'Kode program harus 2 huruf, mis. EC.';
    const n = parseNumber(form.nilai);
    if (!form.nilai.trim() || Number.isNaN(n)) errs.nilai = 'Nilai wajib diisi dengan angka.';
    else if (isTarget && n > 100) errs.nilai = 'Persentase target tidak boleh lebih dari 100.';
    if (!form.berlaku_mulai) errs.berlaku_mulai = 'Tanggal berlaku wajib diisi.';

    setFormErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    setModalError('');
    try {
      await api.put('/pagu', {
        satker_id: Number(satkerId),
        jenis: modal.jenis,
        kode: modal.type === 'program' ? form.kode.trim().toUpperCase() : modal.kode || '',
        uraian: modal.type === 'program' ? form.uraian.trim() : undefined,
        nilai: n,
        berlaku_mulai: form.berlaku_mulai,
      });
      setNotice('Data berhasil disimpan. Perubahan tercatat di riwayat.');
      closeModal();
      load();
    } catch (err) {
      setModalError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const removeHistory = async (id) => {
    try {
      await api.delete(`/pagu/${id}`);
      const res = await api.get('/pagu/riwayat', {
        params: { satker_id: satkerId, jenis: modal.jenis, kode: modal.kode },
      });
      setHistory(res.data.data);
      setConfirmDeleteId(null);
      load();
    } catch (err) {
      setModalError(errMsg(err));
    }
  };

  /* ---------- peringatan selisih ---------- */

  const warnings = [];
  if (data?.pagu_satker) {
    const base = data.pagu_satker.nilai;
    if (data.sum_programs > 0 && Math.abs(data.sum_programs - base) > 0.5) {
      warnings.push(`Jumlah pagu program (${fmtNum(data.sum_programs, 2)}) berbeda dengan pagu total satker (${fmtNum(base, 2)}).`);
    }
    if (data.sum_belanja > 0 && Math.abs(data.sum_belanja - base) > 0.5) {
      warnings.push(`Jumlah pagu belanja (${fmtNum(data.sum_belanja, 2)}) berbeda dengan pagu total satker (${fmtNum(base, 2)}).`);
    }
  }

  const satkerOptions = satkers.map((s) => ({ value: String(s.id), label: s.name }));
  const isTargetModal = modal?.jenis === 'TARGET_SP2D';

  return (
    <div className="space-y-6" aria-busy={loading}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Pagu & Target</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pagu total (satker, program, belanja) dan persentase target SP2D diinput manual. Setiap perubahan tersimpan
          di riwayat sehingga filter tanggal di Dashboard memakai nilai yang berlaku saat itu.
        </p>
      </div>

      {/* FILTER */}
      <div className={`${card} flex flex-wrap items-center gap-3 p-4`}>
        <Select
          className="w-full sm:w-80"
          ariaLabel="Satker"
          searchable
          searchPlaceholder="Cari satker..."
          options={satkerOptions}
          value={satkerId}
          onChange={(v) => {
            setSatkerId(v);
            setNotice('');
          }}
        />

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-500">Nilai yang berlaku pada</span>
          <DatePicker
            className="w-full sm:w-44"
            ariaLabel="Tanggal acuan"
            placeholder="Hari ini"
            align="right"
            value={tanggal}
            onChange={setTanggal}
          />
          {tanggal && (
            <button type="button" className={btnGhost} onClick={() => setTanggal('')}>
              Hari ini
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="shrink-0 font-semibold hover:underline">
            Tutup
          </button>
        </div>
      )}

      {data && !canEdit && (
        <Notice>Anda hanya dapat melihat satker ini. Perubahan hanya dapat dilakukan untuk satker Anda sendiri.</Notice>
      )}

      {warnings.map((w) => (
        <Notice key={w}>{w}</Notice>
      ))}

      {/* PAGU TOTAL SATKER DAN TARGET SP2D */}
      <section className="grid gap-4 md:grid-cols-2">
        {[
          { jenis: 'PAGU_SATKER', title: 'Pagu total satker (Rp)', value: data?.pagu_satker, show: (n) => `Rp ${fmtNum(n, 2)}` },
          { jenis: 'TARGET_SP2D', title: '% Target SP2D', value: data?.target_sp2d, show: (n) => fmtPct(n) },
        ].map((c) => (
          <div key={c.jenis} className={`${card} flex items-start justify-between gap-4 p-5`}>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-500">{c.title}</p>
              <p className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-900">
                {loading && !data ? <Skeleton as="span" className="h-8 w-40" /> : c.value ? c.show(c.value.nilai) : dash}
              </p>
              <p className="mt-1.5">{loading && !data ? <Skeleton as="span" className="h-4 w-48" /> : <ValueMeta input={c.value} />}</p>
            </div>
            <Actions
              canEdit={canEdit}
              onEdit={() => openEdit(c.jenis, '', c.title, c.value)}
              onHistory={() => openHistory(c.jenis, '', c.title)}
            />
          </div>
        ))}
      </section>

      {/* PAGU TOTAL PER PROGRAM */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Pagu total per program</h2>
            <p className="mt-1 text-sm text-slate-500">
              Program diambil dari file terbaru satker. Program yang belum ada di file dapat ditambah manual.
            </p>
          </div>
          {canEdit && (
            <button type="button" className={btnPrimary} onClick={openProgram}>
              Tambah program
            </button>
          )}
        </div>

        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed divide-y divide-slate-100">
              <colgroup>
                <col style={{ width: '6%' }} />
                <col style={{ width: '36%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className={`${th} text-center`}>No</th>
                  <th className={`${th} text-left`}>Program</th>
                  <th className={`${th} text-center`}>Pagu Total (Rp)</th>
                  <th className={`${th} text-center`}>Berlaku Sejak</th>
                  <th className={`${th} text-left`}>Diubah Oleh</th>
                  <th className={`${th} text-center`}>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && !data && <SkeletonRows rows={3} cols={6} />}
                {data && data.programs.length === 0 && (
                  <tr>
                    <td colSpan={6} className={`${td} py-8 text-center text-slate-500`}>
                      Belum ada program. Upload file satker ini atau tambah program manual.
                    </td>
                  </tr>
                )}
                {data?.programs.map((p, i) => (
                  <tr key={p.kode} className="transition hover:bg-slate-50">
                    <td className={`${td} text-center`}>{i + 1}</td>
                    <td className={`${td} text-left`}>
                      <span className="font-medium text-slate-900">{p.uraian || p.kode}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">{p.kode}</span>
                    </td>
                    <td className={`${td} whitespace-nowrap text-center`}>{money(p.input?.nilai)}</td>
                    <td className={`${td} whitespace-nowrap text-center`}>{p.input ? fmtShortDate(p.input.berlaku_mulai) : dash}</td>
                    <td className={`${td} truncate text-left`}>{p.input ? p.input.diubah_oleh : dash}</td>
                    <td className={td}>
                      <Actions
                        canEdit={canEdit}
                        onEdit={() => openEdit('PAGU_PROGRAM', p.kode, `Pagu total program ${p.kode}`, p.input, p.uraian || '')}
                        onHistory={() => openHistory('PAGU_PROGRAM', p.kode, `Pagu total program ${p.kode}`)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              {data && data.programs.length > 0 && (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
                    <td className={`${td} text-left`} colSpan={2}>Jumlah</td>
                    <td className={`${td} whitespace-nowrap text-center`}>{fmtNum(data.sum_programs, 2)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </section>

      {/* PAGU TOTAL PER BELANJA */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Pagu total per jenis belanja</h2>
          <p className="mt-1 text-sm text-slate-500">Belanja Pegawai (51), Barang (52), dan Modal (53).</p>
        </div>

        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed divide-y divide-slate-100">
              <colgroup>
                <col style={{ width: '6%' }} />
                <col style={{ width: '36%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className={`${th} text-center`}>No</th>
                  <th className={`${th} text-left`}>Jenis Belanja</th>
                  <th className={`${th} text-center`}>Pagu Total (Rp)</th>
                  <th className={`${th} text-center`}>Berlaku Sejak</th>
                  <th className={`${th} text-left`}>Diubah Oleh</th>
                  <th className={`${th} text-center`}>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && !data && <SkeletonRows rows={3} cols={6} />}
                {data?.belanja.map((b, i) => (
                  <tr key={b.kode} className="transition hover:bg-slate-50">
                    <td className={`${td} text-center`}>{i + 1}</td>
                    <td className={`${td} text-left`}>
                      <span className="font-medium text-slate-900">{b.label}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">Akun {b.kode}xxxx</span>
                    </td>
                    <td className={`${td} whitespace-nowrap text-center`}>{money(b.input?.nilai)}</td>
                    <td className={`${td} whitespace-nowrap text-center`}>{b.input ? fmtShortDate(b.input.berlaku_mulai) : dash}</td>
                    <td className={`${td} truncate text-left`}>{b.input ? b.input.diubah_oleh : dash}</td>
                    <td className={td}>
                      <Actions
                        canEdit={canEdit}
                        onEdit={() => openEdit('PAGU_BELANJA', b.kode, `Pagu total ${b.label}`, b.input)}
                        onHistory={() => openHistory('PAGU_BELANJA', b.kode, `Pagu total ${b.label}`)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              {data && (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
                    <td className={`${td} text-left`} colSpan={2}>Jumlah</td>
                    <td className={`${td} whitespace-nowrap text-center`}>{fmtNum(data.sum_belanja, 2)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </section>

      {/* POPUP UBAH / TAMBAH PROGRAM */}
      {(modal?.type === 'edit' || modal?.type === 'program') && (
        <ConfirmModal
          title={modal.type === 'program' ? 'Tambah program' : `Ubah ${modal.label}`}
          variant="primary"
          confirmLabel="Simpan"
          busyLabel="Menyimpan..."
          busy={busy}
          error={modalError}
          onConfirm={submit}
          onCancel={closeModal}
        >
          <div className="space-y-4">
            {modal.type === 'program' && (
              <>
                <Field label="Kode program" error={formErrors.kode} hint="2 huruf, mis. EC.">
                  <input
                    name="kode"
                    maxLength={2}
                    className={`${formErrors.kode ? inputInvalid : input} uppercase`}
                    value={form.kode}
                    onChange={(e) => setForm((f) => ({ ...f, kode: e.target.value.replace(/[^A-Za-z]/g, '') }))}
                  />
                </Field>
                <Field label="Nama program (opsional)">
                  <input
                    name="uraian"
                    className={input}
                    value={form.uraian}
                    onChange={(e) => setForm((f) => ({ ...f, uraian: e.target.value }))}
                  />
                </Field>
              </>
            )}

            <Field
              label={isTargetModal ? 'Persentase target (%)' : 'Pagu total (Rp)'}
              error={formErrors.nilai}
              hint="Gunakan koma untuk desimal."
            >
              <input
                name="nilai"
                inputMode="decimal"
                autoComplete="off"
                className={formErrors.nilai ? inputInvalid : input}
                placeholder={isTargetModal ? 'Contoh: 25,5' : 'Contoh: 1.200.000.000'}
                value={form.nilai}
                onChange={(e) => setForm((f) => ({ ...f, nilai: maskNumber(e.target.value, !isTargetModal) }))}
              />
            </Field>

            <Field
              label="Berlaku mulai tanggal"
              error={formErrors.berlaku_mulai}
              hint="Nilai ini dipakai untuk tanggal tersebut dan sesudahnya. Tanggal yang sama menimpa nilai pada tanggal itu."
            >
              <DatePicker
                ariaLabel="Berlaku mulai tanggal"
                value={form.berlaku_mulai}
                onChange={(v) => setForm((f) => ({ ...f, berlaku_mulai: v }))}
              />
            </Field>
          </div>
        </ConfirmModal>
      )}

      {/* POPUP RIWAYAT */}
      {modal?.type === 'history' && (
        <ConfirmModal
          title={`Riwayat: ${modal.label}`}
          variant="primary"
          confirmLabel="Tutup"
          onConfirm={(e) => {
            e.preventDefault();
            closeModal();
          }}
          onCancel={closeModal}
          error={modalError}
        >
          {history === null && !modalError && <Skeleton className="h-24 w-full" />}
          {history && history.length === 0 && <p className="text-sm text-slate-500">Belum ada riwayat.</p>}
          {history && history.length > 0 && (
            <ul className="divide-y divide-slate-100 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      {modal.jenis === 'TARGET_SP2D' ? fmtPct(h.nilai) : `Rp ${fmtNum(h.nilai, 2)}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      Berlaku sejak {fmtShortDate(h.berlaku_mulai)} · {h.diubah_oleh} · {fmtDateTime(h.updated_at)}
                    </p>
                  </div>
                  {canEdit &&
                    (confirmDeleteId === h.id ? (
                      <div className="flex shrink-0 gap-1.5">
                        <button type="button" className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white" onClick={() => removeHistory(h.id)}>
                          Ya, hapus
                        </button>
                        <button type="button" className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700" onClick={() => setConfirmDeleteId(null)}>
                          Batal
                        </button>
                      </div>
                    ) : (
                      <IconButton icon="trash" label="Hapus riwayat" variant="danger" onClick={() => setConfirmDeleteId(h.id)} />
                    ))}
                </li>
              ))}
            </ul>
          )}
        </ConfirmModal>
      )}
    </div>
  );
}
