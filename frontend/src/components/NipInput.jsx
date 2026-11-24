import { input, inputInvalid } from '../utils/ui';

/**
 * Kolom NIP: hanya menerima angka (ketikan huruf/simbol dan hasil paste otomatis dibersihkan).
 * onChange menerima string angka, bukan event.
 */
export default function NipInput({ value, onChange, invalid = false, className = '', ...rest }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={25}
      className={`${invalid ? inputInvalid : input} ${className}`}
      aria-invalid={invalid}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      {...rest}
    />
  );
}
