import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Select from '../components/Select';
import Field from '../components/Field';
import { btnGhost, btnPrimary, card } from '../utils/ui';

const MAX_MB = 10;

const KATEGORI = [
  { value: 'AKRUAL', label: 'Akrual', hint: 'Dipakai untuk Pagu Efektif dan Realisasi Akrual.' },
  { value: 'SP2D', label: 'SP2D', hint: 'Dipakai untuk Realisasi SP2D.' },
];

/**
 * Satu kotak upload untuk satu kategori. Tiap kategori punya file, progres, dan hasil sendiri,
 * sehingga file Akrual dan SP2D dapat diunggah terpisah dan tidak saling menimpa.
 */
function UploadBox({ kategori, label, hint, admin, satkerId, onNeedSatker }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const pick = (f) => {
    setResult(null);
    setError('');
    if (!f) return setFile(null);
    if (/\.xls$/i.test(f.name)) {
      setFile(null);
      return setError('Format .xls lama tidak didukung. Simpan ulang file sebagai .xlsx lalu upload kembali.');
    }
    if (!/\.xlsx$/i.test(f.name)) {
      setFile(null);
      return setError('File harus berupa Excel (.xlsx).');
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setFile(null);
      return setError(`Ukuran file melebihi ${MAX_MB} MB.`);
    }
    setFile(f);
  };

  const submit = async () => {
    if (!file) return;
    if (admin && !satkerId) return onNeedSatker();
    setBusy(true);
    setProgress(0);
    setResult(null);
    setError('');
    const form = new FormData();
    form.append('kategori', kategori);
    if (admin) form.append('satker_id', satkerId);
    form.append('file', file);
    try {
      const res = await api.post('/uploads', form, {
        onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
      });
      setResult(res.data);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${card} flex flex-col p-6`}>
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-900">File {label}</h2>
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files[0]);
        }}
        className={`rounded-lg border-2 border-dashed p-8 text-center transition ${
          dragging ? 'border-amber-400 bg-amber-50' : 'border-slate-300'
        }`}
      >
        <p className="break-all font-medium text-slate-800">{file ? file.name : `Tarik file ${label} ke sini`}</p>
        <p className="mt-1 text-sm text-slate-500">
          {file ? `${(file.size / 1024).toFixed(0)} KB` : `Format .xlsx, maksimal ${MAX_MB} MB`}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          aria-label={`Pilih file ${label}`}
          onChange={(e) => pick(e.target.files[0])}
        />
        <button type="button" className={`${btnGhost} mt-4`} onClick={() => inputRef.current?.click()} disabled={busy}>
          Pilih file
        </button>
      </div>

      {busy && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-amber-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {progress < 100 ? `Mengunggah ${progress}%` : 'Membaca file dan mengenali kode uraian…'}
          </p>
        </div>
      )}

      <button className={`${btnPrimary} mt-5 w-full`} onClick={submit} disabled={!file || busy}>
        {busy ? 'Memproses…' : `Proses file ${label}`}
      </button>

      {error && (
        <div role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800">{result.message}</p>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-emerald-700">Total baris</dt>
              <dd className="font-bold text-slate-900">{result.summary.total_rows}</dd>
            </div>
            <div>
              <dt className="text-emerald-700">Direkap</dt>
              <dd className="font-bold text-slate-900">{result.summary.processed_rows}</dd>
            </div>
            <div>
              <dt className="text-emerald-700">Tidak dikenali</dt>
              <dd className="font-bold text-slate-900">{result.summary.skipped_rows}</dd>
            </div>
          </dl>
          <Link to={`/pelaporan/${result.upload.id}`} className={`${btnPrimary} mt-4`}>
            Lihat detail
          </Link>
        </div>
      )}
    </div>
  );
}

export default function Upload() {
  const { user } = useAuth();
  const admin = user.role === 'ADMIN';
  const [satkers, setSatkers] = useState([]);
  const [satkerId, setSatkerId] = useState('');
  const [satkerError, setSatkerError] = useState('');

  // Admin tidak terikat satker, jadi memilih satker tujuan upload
  useEffect(() => {
    if (!admin) return;
    api
      .get('/satker')
      .then((r) => setSatkers(r.data.data))
      .catch(() => {});
  }, [admin]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Upload Excel</h1>
        <p className="text-sm text-slate-500">
          Unggah file Akrual dan file SP2D sesuai kategorinya. Keduanya boleh diunggah terpisah. Upload baru tidak
          menghapus upload lama; dashboard memakai file terbaru tiap satker pada masing-masing kategori
          {user.satker ? `, atas nama ${user.satker.name}` : ''}.
        </p>
      </div>

      {admin && (
        <div className={`${card} p-6`}>
          <Field label="Satker tujuan" error={satkerError}>
            <Select
              className="w-full"
              ariaLabel="Satker tujuan"
              searchable
              searchPlaceholder="Cari satker..."
              options={[{ value: '', label: 'Pilih satker' }, ...satkers.map((s) => ({ value: String(s.id), label: s.name }))]}
              value={satkerId}
              onChange={(v) => {
                setSatkerId(v);
                setSatkerError('');
              }}
            />
          </Field>
        </div>
      )}

      <div className="grid items-start gap-6 md:grid-cols-2">
        {KATEGORI.map((k) => (
          <UploadBox
            key={k.value}
            kategori={k.value}
            label={k.label}
            hint={k.hint}
            admin={admin}
            satkerId={satkerId}
            onNeedSatker={() => setSatkerError('Pilih satker tujuan upload.')}
          />
        ))}
      </div>
    </div>
  );
}
