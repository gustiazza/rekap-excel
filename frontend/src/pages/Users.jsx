import { useCallback, useEffect, useState } from 'react';
import api, { errMsg } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABEL, fmtShortDate } from '../utils/format';
import { focusFirstError, rules, validate } from '../utils/validate';
import ConfirmModal from '../components/ConfirmModal';
import Field from '../components/Field';
import PasswordInput from '../components/PasswordInput';
import NipInput from '../components/NipInput';
import { btnPrimary, btnSmall, card, input, inputInvalid, td, th } from '../utils/ui';
import { Skeleton } from '../components/Skeleton';
import { ICON_GHOST, IconButton } from '../components/ActionIcon';

// Lebar kolom dikunci (table-fixed) agar posisi kolom sama persis antara skeleton dan data asli.
// Urutan: No, Nama, NIP, Satker, Role, Status, Upload, Dibuat, Aksi (Aksi memakai sisa lebar).
const COL_WIDTHS = ['w-12', 'w-40', 'w-48', 'w-44', 'w-20', 'w-24', 'w-[72px]', 'w-28', ''];
const SKELETON_ROWS = 5;

// Kotak abu-abu berbentuk sama dengan tombol/lencana aslinya (teks transparan)
const ghost = 'bg-slate-200/80 text-transparent motion-safe:animate-pulse';

const BLANK = {
  name: '',
  nip: '',
  satker_id: '',
  password: '',
  role: 'USER',
};

export default function Users() {
  const { user: me } = useAuth();

  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null); // { type: 'form' | 'reset', user }
  const [form, setForm] = useState(BLANK);
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [delTarget, setDelTarget] = useState(null);
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState('');
  const [loading, setLoading] = useState(true);
  const [satkers, setSatkers] = useState([]);

  // true jika sudah ada akun ADMIN
  const adminExists = users.some((u) => u.role === 'ADMIN');

  const load = useCallback(() => {
    api
      .get('/users')
      .then((r) => setUsers(r.data.data || []))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .get('/satker')
      .then((r) => setSatkers(r.data.data || []))
      .catch(() => {});
  }, []);

  const closeModal = () => {
    setModal(null);
    setError('');
    setPassword('');
    setFieldErrors({});
  };

  const openForm = (u) => {
    setForm(
      u
        ? { name: u.name, nip: u.nip, satker_id: u.satker_id ? String(u.satker_id) : '', password: '', role: u.role }
        : { ...BLANK, role: 'USER' }
    );
    setError('');
    setFieldErrors({});
    setModal({ type: 'form', user: u });
  };

  const openReset = (u) => {
    setPassword('');
    setError('');
    setFieldErrors({});
    setModal({ type: 'reset', user: u });
  };

  const updateForm = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((errs) => (errs[key] ? { ...errs, [key]: '' } : errs));
  };

  const cls = (key) => (fieldErrors[key] ? inputInvalid : input);

  const submitForm = async (e) => {
    e.preventDefault();
    const editing = modal.user;

    const found = validate(form, {
      name: [rules.required('Nama')],
      nip: [rules.required('NIP'), rules.nip()],
      // Satker wajib untuk pengguna biasa; Admin tidak terikat satker
      ...(form.role === 'USER' ? { satker_id: [rules.required('Satker')] } : {}),
      ...(editing
        ? {}
        : { password: [rules.required('Password'), rules.minLength(8, 'Password')] }),
    });
    setFieldErrors(found);
    if (Object.keys(found).length) return focusFirstError(e.currentTarget, found);

    setBusy(true);
    setError('');

    try {
      const res = editing
        ? await api.put(`/users/${editing.id}`, {
            name: form.name,
            nip: form.nip,
            satker_id: form.satker_id ? Number(form.satker_id) : undefined,
            role: form.role,
          })
        : await api.post('/users', {
            name: form.name,
            nip: form.nip,
            satker_id: form.satker_id ? Number(form.satker_id) : undefined,
            password: form.password,
            role: adminExists ? 'USER' : form.role,
          });

      setNotice(res.data.message);
      closeModal();
      load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();

    // Kolom boleh kosong (dibuatkan otomatis), tetapi jika diisi minimal 8 karakter
    const found = validate({ password }, { password: [rules.minLengthIfFilled(8, 'Password baru')] });
    setFieldErrors(found);
    if (Object.keys(found).length) return focusFirstError(e.currentTarget, found);

    setBusy(true);
    setError('');

    try {
      const res = await api.put(`/users/${modal.user.id}/password`, { password });

      setNotice(
        res.data.new_password
          ? `Password baru untuk ${modal.user.name}: ${res.data.new_password}`
          : res.data.message
      );
      closeModal();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (u) => {
    try {
      const res = await api.put(`/users/${u.id}/status`, {
        status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
      setNotice(res.data.message);
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const confirmRemove = async () => {
    setDelBusy(true);
    setDelError('');

    try {
      const res = await api.delete(`/users/${delTarget.id}`);
      setNotice(res.data.message);
      setDelTarget(null);
      load();
    } catch (err) {
      setDelError(errMsg(err));
    } finally {
      setDelBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Kelola Pengguna</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tambah, ubah, nonaktifkan, dan reset password pengguna.
          </p>
        </div>

        <button className={btnPrimary} onClick={() => openForm(null)}>
          Tambah pengguna
        </button>
      </div>

      {/* NOTIFIKASI */}
      {notice && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <span className="break-all">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="shrink-0 font-semibold hover:underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* ERROR */}
      {error && !modal && (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* TABEL */}
      <div className={card} aria-busy={loading}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1130px] table-fixed divide-y divide-slate-100">
            <colgroup>
              {COL_WIDTHS.map((w, i) => (
                <col key={i} className={w} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className={`${th} text-center`}>No</th>
                <th className={`${th} text-left`}>Nama</th>
                <th className={`${th} text-center`}>NIP</th>
                <th className={`${th} text-left`}>Satker</th>
                <th className={`${th} text-center`}>Role</th>
                <th className={`${th} text-center`}>Status</th>
                <th className={`${th} text-center`}>Upload</th>
                <th className={`${th} text-center`}>Dibuat</th>
                <th className={`${th} text-center`}>Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading &&
                Array.from({ length: SKELETON_ROWS }, (_, r) => (
                  <tr key={r} aria-hidden="true">
                    <td className={`${td} text-center`}>
                      <Skeleton className="mx-auto h-5 w-4" />
                    </td>
                    <td className={`${td} space-y-0`}>
                      {/* nama panjang umumnya membungkus jadi 2 baris */}
                      <Skeleton className="h-5 w-32 max-w-full" />
                      <Skeleton className="h-5 w-20 max-w-full" />
                    </td>
                    <td className={`${td} text-center`}>
                      <Skeleton className="mx-auto h-5 w-36 max-w-full" />
                    </td>
                    <td className={`${td} text-center`}>
                      <Skeleton className="mx-auto h-5 w-36 max-w-full" />
                      <Skeleton className="mx-auto h-5 w-24 max-w-full" />
                    </td>
                    <td className={`${td} text-center`}>
                      <Skeleton className="mx-auto h-5 w-12" />
                    </td>
                    <td className={`${td} text-center`}>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${ghost}`}>
                        Aktif
                      </span>
                    </td>
                    <td className={`${td} text-center`}>
                      <Skeleton className="mx-auto h-5 w-5" />
                    </td>
                    <td className={`${td} whitespace-nowrap text-center`}>
                      <Skeleton className="mx-auto h-5 w-20" />
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      <div className="flex justify-center gap-1.5">
                        {[0, 1, 2, 3].map((t) => (
                          <span key={t} className={ICON_GHOST} />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={9} className={`${td} py-8 text-center text-slate-500`}>
                    Belum ada pengguna.
                  </td>
                </tr>
              )}
              {users.map((u, i) => {
                const self = u.id === me.id;

                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className={`${td} text-center`}>{i + 1}</td>

                    <td className={`${td} font-medium text-slate-900`}>
                      {u.name}
                      {self && <span className="ml-2 text-xs text-slate-400">(Anda)</span>}
                    </td>

                    <td className={`${td} break-all text-center`}>{u.nip}</td>

                    <td className={`${td} text-left`}>{u.satker ? u.satker.name : <span className="text-slate-400">Semua satker</span>}</td>

                    <td className={`${td} text-center`}>{ROLE_LABEL[u.role]}</td>

                    <td className={`${td} text-center`}>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                            : 'bg-slate-100 text-slate-600 ring-slate-400/30'
                        }`}
                      >
                        {u.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>

                    <td className={`${td} text-center`}>{u._count.uploads}</td>

                    <td className={`${td} whitespace-nowrap text-center`}>
                      {fmtShortDate(u.created_at)}
                    </td>

                    <td className={`${td} whitespace-nowrap`}>
                      <div className="flex justify-center gap-1.5">
                        <IconButton icon="edit" label="Edit" onClick={() => openForm(u)} />

                        <IconButton icon="key" label="Reset password" onClick={() => openReset(u)} />

                        {!self && (
                          <>
                            <IconButton
                              icon={u.status === 'ACTIVE' ? 'deactivate' : 'activate'}
                              label={u.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                              onClick={() => toggle(u)}
                            />

                            <IconButton
                              icon="trash"
                              label="Hapus"
                              variant="danger"
                              onClick={() => {
                                setDelError('');
                                setDelTarget(u);
                              }}
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {loading && (
        <span className="sr-only" role="status">
          Memuat pengguna…
        </span>
      )}

      {/* POPUP TAMBAH / EDIT PENGGUNA */}
      {modal?.type === 'form' && (
        <ConfirmModal
          title={modal.user ? 'Edit pengguna' : 'Tambah pengguna'}
          variant="primary"
          confirmLabel="Simpan"
          busyLabel="Menyimpan..."
          busy={busy}
          error={error}
          onConfirm={submitForm}
          onCancel={closeModal}
        >
          <div className="space-y-4">
            <Field label="Nama" error={fieldErrors.name}>
              <input
                name="name"
                className={cls('name')}
                aria-invalid={Boolean(fieldErrors.name)}
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
              />
            </Field>

            <Field label="NIP" error={fieldErrors.nip} hint="Hanya angka.">
              <NipInput
                name="nip"
                placeholder="Contoh: 198501012010011001"
                invalid={Boolean(fieldErrors.nip)}
                value={form.nip}
                onChange={(v) => updateForm('nip', v)}
              />
            </Field>

            {/* Admin tidak terikat satker */}
            {form.role === 'USER' && (
              <Field label="Satker" error={fieldErrors.satker_id}>
                <select
                  name="satker_id"
                  className={cls('satker_id')}
                  aria-invalid={Boolean(fieldErrors.satker_id)}
                  value={form.satker_id}
                  onChange={(e) => updateForm('satker_id', e.target.value)}
                >
                  <option value="">Pilih satker</option>
                  {satkers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {!modal.user && (
              <Field label="Password" error={fieldErrors.password}>
                <PasswordInput
                  name="password"
                  autoComplete="new-password"
                  placeholder="Minimal 8 karakter"
                  invalid={Boolean(fieldErrors.password)}
                  value={form.password}
                  onChange={(e) => updateForm('password', e.target.value)}
                />
              </Field>
            )}

            {/* Admin sudah ada: role dikunci (tanpa dropdown), baik saat tambah maupun edit */}
            {adminExists ? (
              <Field
                label="Role"
                hint={
                  !modal.user
                    ? 'Admin sudah terdaftar. Pengguna baru otomatis menggunakan role User.'
                    : modal.user.id === me.id
                      ? 'Role akun sendiri tidak dapat diubah.'
                      : 'Admin sudah terdaftar. Role pengguna tidak dapat diubah.'
                }
              >
                <input
                  className={`${input} cursor-not-allowed bg-slate-100 text-slate-500`}
                  value={ROLE_LABEL[form.role]}
                  disabled
                  readOnly
                  aria-label={`Role: ${ROLE_LABEL[form.role]} (tidak dapat diubah)`}
                />
              </Field>
            ) : (
              <Field label="Role">
                <select
                  name="role"
                  className={input}
                  value={form.role}
                  onChange={(e) => updateForm('role', e.target.value)}
                >
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </Field>
            )}
          </div>
        </ConfirmModal>
      )}

      {/* POPUP RESET PASSWORD */}
      {modal?.type === 'reset' && (
        <ConfirmModal
          title="Reset password"
          variant="primary"
          confirmLabel="Reset Password"
          busyLabel="Memproses..."
          busy={busy}
          error={error}
          onConfirm={submitReset}
          onCancel={closeModal}
          detail={
            <>
              {modal.user.name}
              <span className="mt-1 block text-xs font-normal text-slate-500">
                NIP {modal.user.nip}
              </span>
            </>
          }
        >
          <Field
            label="Password baru"
            error={fieldErrors.password}
            hint="Jika dikosongkan, sistem membuat password acak dan menampilkannya setelah proses selesai."
          >
            <PasswordInput
              name="password"
              autoComplete="new-password"
              placeholder="Kosongkan untuk dibuatkan otomatis"
              invalid={Boolean(fieldErrors.password)}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors({});
              }}
            />
          </Field>
        </ConfirmModal>
      )}

      {/* POPUP HAPUS PENGGUNA */}
      {delTarget && (
        <ConfirmModal
          title="Hapus pengguna?"
          confirmLabel="Ya, Hapus Pengguna"
          busy={delBusy}
          error={delError}
          onConfirm={confirmRemove}
          onCancel={() => setDelTarget(null)}
          detail={
            <>
              {delTarget.name}
              <span className="mt-1 block text-xs font-normal text-slate-500">
                NIP {delTarget.nip}
              </span>
            </>
          }
        >
          Pengguna ini akan dihapus. Tindakan ini tidak dapat dibatalkan.
        </ConfirmModal>
      )}
    </div>
  );
}