import { useState } from 'react';
import api, { errMsg } from '../services/api';
import ConfirmModal from './ConfirmModal';
import Field from './Field';
import DatePicker from './DatePicker';
import { Skeleton } from './Skeleton';
import { IconButton } from './ActionIcon';
import { fmtNum, fmtPct, fmtShortDate, fmtDateTime } from '../utils/format';
import { input, inputInvalid } from '../utils/ui';

/*
 * Pengubah nilai input manual (pagu total dan % target SP2D) yang dipakai langsung dari tabel rekap.
 *
 *   const manual = useManualInput({ onSaved: (msg) => ... });
 *   manual.edit({ satkerId, jenis, kode, label, current })   -> popup ubah
 *   manual.history({ satkerId, jenis, kode, label })         -> popup riwayat
 *   manual.addProgram(satkerId)                              -> popup tambah program
 *   {manual.element}                                         -> taruh sekali di halaman
 *
 * Setiap simpan menambah riwayat dengan tanggal berlaku. Hak ubah tetap diperiksa di server.
 */

export const todayWib = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

// Isian angka: rupiah diberi titik ribuan, koma untuk desimal. Persen tanpa titik ribuan.
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

const toText = (n, grouped) => (n === null || n === undefined ? '' : maskNumber(String(n).replace('.', ','), grouped));

// Jenis yang nilainya persentase (tanpa titik ribuan, maksimal 100)
const isPct = (jenis) => jenis === 'TARGET_SP2D' || jenis === 'TARGET_LINGKUP' || jenis === 'TARGET_REKAP';
const EMPTY_FORM = { nilai: '', berlaku_mulai: '', kode: '', uraian: '' };

export default function useManualInput({ onSaved } = {}) {
  // modal: { type: 'edit' | 'program' | 'history', satkerId, jenis, kode, label }
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState('');
  const [history, setHistory] = useState(null);
  const [historyCanEdit, setHistoryCanEdit] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const close = () => {
    setModal(null);
    setModalError('');
    setFormErrors({});
    setHistory(null);
    setConfirmDeleteId(null);
  };

  const edit = ({ satkerId, jenis, kode = '', label, current }) => {
    setForm({ nilai: toText(current, !isPct(jenis)), berlaku_mulai: todayWib(), kode, uraian: '' });
    setFormErrors({});
    setModalError('');
    setModal({ type: 'edit', satkerId, jenis, kode, label });
  };

  const addProgram = (satkerId) => {
    setForm({ ...EMPTY_FORM, berlaku_mulai: todayWib() });
    setFormErrors({});
    setModalError('');
    setModal({ type: 'program', satkerId, jenis: 'PAGU_PROGRAM', kode: '', label: 'Tambah program' });
  };

  const openHistory = async ({ satkerId, jenis, kode = '', label }) => {
    setModal({ type: 'history', satkerId, jenis, kode, label });
    setHistory(null);
    setModalError('');
    setConfirmDeleteId(null);
    try {
      const res = await api.get('/pagu/riwayat', { params: { satker_id: satkerId, jenis, kode } });
      setHistory(res.data.data);
      setHistoryCanEdit(Boolean(res.data.can_edit));
    } catch (e) {
      setModalError(errMsg(e));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    const isTarget = isPct(modal.jenis);

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
        satker_id: modal.satkerId === null || modal.satkerId === undefined ? null : Number(modal.satkerId),
        jenis: modal.jenis,
        kode: modal.type === 'program' ? form.kode.trim().toUpperCase() : modal.kode || '',
        uraian: modal.type === 'program' ? form.uraian.trim() : undefined,
        nilai: n,
        berlaku_mulai: form.berlaku_mulai,
      });
      close();
      if (onSaved) onSaved('Data berhasil disimpan. Perubahan tercatat di riwayat.');
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
        params: { satker_id: modal.satkerId, jenis: modal.jenis, kode: modal.kode },
      });
      setHistory(res.data.data);
      setConfirmDeleteId(null);
      if (onSaved) onSaved('Riwayat berhasil dihapus.');
    } catch (err) {
      setModalError(errMsg(err));
    }
  };

  const isTarget = isPct(modal?.jenis);

  const element = (
    <>
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
          onCancel={close}
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
              label={isTarget ? 'Persentase target (%)' : 'Pagu total (Rp)'}
              error={formErrors.nilai}
              hint="Gunakan koma untuk desimal."
            >
              <input
                name="nilai"
                inputMode="decimal"
                autoComplete="off"
                autoFocus={modal.type === 'edit'}
                className={formErrors.nilai ? inputInvalid : input}
                placeholder={isTarget ? 'Contoh: 25,5' : 'Contoh: 1.200.000.000'}
                value={form.nilai}
                onChange={(e) => setForm((f) => ({ ...f, nilai: maskNumber(e.target.value, !isTarget) }))}
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

            {modal.type === 'edit' && (
              <button
                type="button"
                className="text-sm font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                onClick={() => openHistory(modal)}
              >
                Lihat riwayat perubahan
              </button>
            )}
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
            close();
          }}
          onCancel={close}
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
                      {isPct(modal.jenis) ? fmtPct(h.nilai) : `Rp ${fmtNum(h.nilai, 2)}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      Berlaku sejak {fmtShortDate(h.berlaku_mulai)} · {h.diubah_oleh} · {fmtDateTime(h.updated_at)}
                    </p>
                  </div>
                  {historyCanEdit &&
                    (confirmDeleteId === h.id ? (
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white"
                          onClick={() => removeHistory(h.id)}
                        >
                          Ya, hapus
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700"
                          onClick={() => setConfirmDeleteId(null)}
                        >
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
    </>
  );

  return { edit, history: openHistory, addProgram, element };
}