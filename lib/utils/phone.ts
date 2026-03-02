export function normalizePhoneDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

export function formatPhoneNumberInput(value: string): string {
  const digits = normalizePhoneDigits(value).slice(0, 15);
  if (!digits) return '';
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)} ${digits.slice(10)}`;
}

export function formatPhoneNumberDisplay(value: string | null | undefined): string {
  const raw = value?.trim() ?? '';
  if (!raw) return '';
  const digits = normalizePhoneDigits(raw);
  if (digits.length === 10) return formatPhoneNumberInput(digits);
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 ${formatPhoneNumberInput(digits.slice(1))}`;
  }
  return raw;
}
