import { useState } from 'react';
import api, { errMsg } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Field from '../components/Field';
import PasswordInput from '../components/PasswordInput';
import { ROLE_LABEL } from '../utils/format';
import { focusFirstError, rules, validate } from '../utils/validate';
import { btnPrimary, card } from '../utils/ui';

const BLANK = { current_password: '', new_password: '', confirm: '' };

export default function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState(BLANK);
  const [fieldErrors, setFieldErrors] = useState({});
  const [msg, setMsg] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(false);

  const update = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((errs) => (errs[key] ? { ...errs, [key]: '' } : errs));
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);

    const found = validate(form, {
      current_password: [rules.required('Password saat ini')],
      new_password: [rules.required('Password baru'), rules.minLength(8, 'Password baru')],
      confirm: [
        rules.required('Konfirmasi password'),
        rules.match('new_password', 'Konfirmasi password tidak sama.'),
      ],
    });
    setFieldErrors(found);
    if (Object.keys(found).length) return focusFirstError(e.currentTarget, found);

    setBusy(true);
    try {
      const res = await api.put('/auth/password', {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      setMsg({ ok: true, text: res.data.message });
      setForm(BLANK);
    } catch (err) {
      setMsg({ ok: false, text: errMsg(err) });
    } finally {
      setBusy(false);
    }
  };

  const info = [
    { label: 'Nama', value: user.name },
    { label: 'NIP', value: user.nip, breakAll: true },
    { label: 'Satker', value: user.satker ? user.satker.name : 'Semua satker (Admin)' },
    { label: 'Role', value: ROLE_LABEL[user.role] },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Profile</h1>

      {/* INFORMASI AKUN */}
      <div className={`${card} p-6`}>
        <h2 className="text-lg font-semibold text-slate-900">Informasi Akun</h2>

        <dl className="mt-4 divide-y divide-slate-100">
          {info.map((item) => (
            <div key={item.label} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-6">
              <dt className="text-sm font-medium text-slate-500 sm:w-28 sm:shrink-0">{item.label}</dt>
              <dd className={`min-w-0 text-base font-semibold text-slate-900 ${item.breakAll ? 'break-all' : ''}`}>
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* UBAH PASSWORD */}
      <form onSubmit={submit} noValidate className={`${card} space-y-5 p-6`}>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Ubah Password</h2>
          <p className="mt-1 text-sm text-slate-500">
            Perbarui password akun Anda secara berkala untuk menjaga keamanan akun.
          </p>
        </div>

        {msg && (
          <div
            role={msg.ok ? 'status' : 'alert'}
            className={`rounded-lg px-4 py-3 text-sm ${
              msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
            }`}
          >
            {msg.text}
          </div>
        )}

        <Field label="Password saat ini" error={fieldErrors.current_password}>
          <PasswordInput
            name="current_password"
            autoComplete="current-password"
            invalid={Boolean(fieldErrors.current_password)}
            value={form.current_password}
            onChange={(e) => update('current_password', e.target.value)}
          />
        </Field>

        <Field label="Password baru (minimal 8 karakter)" error={fieldErrors.new_password}>
          <PasswordInput
            name="new_password"
            autoComplete="new-password"
            invalid={Boolean(fieldErrors.new_password)}
            value={form.new_password}
            onChange={(e) => update('new_password', e.target.value)}
          />
        </Field>

        <Field label="Ulangi password baru" error={fieldErrors.confirm}>
          <PasswordInput
            name="confirm"
            autoComplete="new-password"
            invalid={Boolean(fieldErrors.confirm)}
            value={form.confirm}
            onChange={(e) => update('confirm', e.target.value)}
          />
        </Field>

        <div className="flex justify-end pt-2">
          <button className={btnPrimary} disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan password'}
          </button>
        </div>
      </form>
    </div>
  );
}
