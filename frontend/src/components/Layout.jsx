import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABEL } from '../utils/format';

const ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/upload', label: 'Upload Excel' },
  { to: '/pagu', label: 'Pagu & Target' },
  { to: '/pelaporan', label: 'Pelaporan' },
  { to: '/users', label: 'Kelola Pengguna', admin: true },
  { to: '/profil', label: 'Profil' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linkCls = ({ isActive }) =>
    `block border-l-4 px-5 py-2.5 text-sm font-medium transition ${
      isActive ? 'border-amber-400 bg-slate-800 text-white' : 'border-transparent text-slate-300 hover:bg-slate-800/60 hover:text-white'
    }`;

  return (
    <div className="min-h-screen lg:flex">
      {open && <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-0.5 px-5 py-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
            <img src="/logo-kementan.svg" alt="Logo" className="h-8 w-8" />
          </div>
          <div>
            <p className="text-base font-bold leading-tight text-white">Realisasi Anggaran</p>
            <p className="text-xs text-slate-400">Lingkup BRMP Perkebunan</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 py-2">
          {ITEMS.filter((i) => !i.admin || user.role === 'ADMIN').map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={linkCls} onClick={() => setOpen(false)}>
              {i.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <p className="truncate text-sm font-semibold text-white">{user.name}</p>
          <p className="text-xs text-slate-400">{ROLE_LABEL[user.role]}</p>
          <p className="mb-3 truncate text-xs text-slate-500" title={user.satker?.name}>
            {user.satker ? user.satker.name : 'Semua satker'}
          </p>
          <button onClick={handleLogout} className="w-full rounded-lg border border-slate-700 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800">
            Logout
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Buka menu" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
            Menu
          </button>
          <span className="font-bold text-slate-900">RekapXL</span>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
