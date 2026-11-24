const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Setiap rule mengembalikan pesan error, atau '' jika valid
export const rules = {
  required: (label) => (v) => (String(v ?? '').trim() ? '' : `${label} wajib diisi.`),
  email: () => (v) => (EMAIL_RE.test(String(v ?? '').trim()) ? '' : 'Format email tidak valid.'),
  // NIP hanya berupa angka, 5-25 digit
  nip: () => (v) => (/^\d{5,25}$/.test(String(v ?? '').trim()) ? '' : 'NIP harus berupa angka (5-25 digit).'),
  minLength: (n, label) => (v) => (String(v ?? '').length >= n ? '' : `${label} minimal ${n} karakter.`),
  // Hanya diperiksa jika kolom diisi (untuk kolom opsional)
  minLengthIfFilled: (n, label) => (v) => (!v || String(v).length >= n ? '' : `${label} minimal ${n} karakter.`),
  match: (otherField, message) => (v, values) => (v === values[otherField] ? '' : message),
};

// schema: { namaField: [rule, rule, ...] } -> { namaField: 'pesan pertama yang gagal' }
export function validate(values, schema) {
  const errors = {};
  for (const [field, list] of Object.entries(schema)) {
    for (const rule of list) {
      const message = rule(values[field], values);
      if (message) {
        errors[field] = message;
        break;
      }
    }
  }
  return errors;
}

// Fokuskan kolom pertama yang bermasalah (berdasarkan atribut name pada input)
export function focusFirstError(formElement, errors) {
  const name = Object.keys(errors)[0];
  if (name && formElement?.elements) formElement.elements.namedItem(name)?.focus();
}
