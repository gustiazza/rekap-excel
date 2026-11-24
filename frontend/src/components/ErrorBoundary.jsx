import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import { btnGhost, btnPrimary, card } from '../utils/ui';

/**
 * Menangkap error saat render di komponen anak, lalu menampilkan layar pengganti
 * alih-alih halaman putih kosong.
 *
 * Props:
 *  - fullPage : true untuk pembungkus paling luar (layar penuh, di luar Layout/Router)
 *  - resetKey : jika nilainya berubah (misalnya path halaman), error otomatis dihapus
 *  - onError  : (error, info) => void, untuk mengirim error ke layanan pemantauan
 *
 * Catatan: error boundary TIDAK menangkap error di event handler, setTimeout, atau
 * promise (async). Itu tetap ditangani dengan try/catch di tempat pemanggilannya.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info?.componentStack);
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { fullPage = false } = this.props;

    const content = (
      <div
        role="alert"
        className={`${card} mx-auto w-full max-w-lg p-8 text-center ${fullPage ? 'shadow-sm' : ''}`}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle size={28} />
        </div>

        <h1 className="mt-5 text-xl font-bold text-slate-900">
          {fullPage ? 'Aplikasi mengalami kesalahan' : 'Halaman ini gagal ditampilkan'}
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Terjadi masalah tak terduga saat menampilkan halaman. Data Anda tidak hilang. Coba lagi, atau muat ulang
          halaman jika masalah berlanjut.
        </p>

        {import.meta.env.DEV && (
          <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-slate-50 p-3 text-left text-xs text-red-700">
            {String(error?.message || error)}
          </pre>
        )}

        <div className="mt-6 flex flex-col-reverse justify-center gap-2 sm:flex-row">
          {fullPage ? (
            <a href="/" className={btnGhost}>
              Ke beranda
            </a>
          ) : (
            <button type="button" className={btnGhost} onClick={this.reset}>
              Coba lagi
            </button>
          )}

          <button type="button" className={btnPrimary} onClick={() => window.location.reload()}>
            Muat ulang halaman
          </button>
        </div>
      </div>
    );

    if (!fullPage) return content;

    return <div className="grid min-h-screen place-items-center bg-slate-50 p-6">{content}</div>;
  }
}