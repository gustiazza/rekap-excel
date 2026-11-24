import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { input, inputInvalid } from '../utils/ui';

export default function PasswordInput({ invalid = false, className = '', ...props }) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={show ? 'text' : 'password'}
        aria-invalid={invalid}
        className={`${invalid ? inputInvalid : input} pr-11 ${className}`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-400 hover:text-slate-700 focus-visible:text-slate-700 focus-visible:outline-none"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}