import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errMsg } from '../services/api';
import { focusFirstError, rules, validate } from '../utils/validate';
import Field from '../components/Field';
import PasswordInput from '../components/PasswordInput';
import NipInput from '../components/NipInput';
import { btnPrimary } from '../utils/ui';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [nip, setNip] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const clearField = (key) => setFieldErrors((errs) => (errs[key] ? { ...errs, [key]: '' } : errs));

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    const found = validate(
      { nip, password },
      {
        nip: [rules.required('NIP'), rules.nip()],
        password: [rules.required('Password')],
      }
    );
    setFieldErrors(found);
    if (Object.keys(found).length) return focusFirstError(e.currentTarget, found);

    setBusy(true);
    try {
      await login(nip, password);
      navigate('/');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-slate-900 p-12 lg:flex">
        <div className="flex items-center gap-0.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
            <img src="/logo-kementan.svg" alt="Logo" className="h-8 w-8" />
          </div>
          <span className="text-lg font-bold text-white">Laporan Realisasi Anggaran</span>
        </div>
        <div>
          <h1 className="max-w-md text-3xl font-bold leading-snug text-white">
            Unggah laporan realisasi anggaran satker Anda, dan biarkan sistem merekapnya.
          </h1>
          <p className="mt-4 max-w-md text-slate-400">
            Hasil rekap setiap satuan kerja dihimpun dalam satu database terpusat, lengkap per program dan per belanja.
          </p>
        </div>
        <p className="text-xs text-slate-500">Sistem Laporan Realisasi Anggaran</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} noValidate className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Masuk</h2>
            <p className="mt-1 text-sm text-slate-500">Gunakan akun yang diberikan admin.</p>
          </div>

          {error && <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <Field label="NIP" error={fieldErrors.nip}>
            <NipInput
              name="nip"
              autoComplete="username"
              placeholder="Masukkan NIP (angka)"
              invalid={Boolean(fieldErrors.nip)}
              value={nip}
              onChange={(v) => {
                setNip(v);
                clearField('nip');
              }}
            />
          </Field>

          <Field label="Password" error={fieldErrors.password}>
            <PasswordInput
              name="password"
              autoComplete="current-password"
               placeholder="Masukkan Password"
              invalid={Boolean(fieldErrors.password)}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearField('password');
              }}
            />
          </Field>

          <button className={`${btnPrimary} w-full`} disabled={busy}>
            {busy ? 'Memproses…' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
