const cedis = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  maximumFractionDigits: 0,
});

/** Formats an amount of whole cedis, e.g. `GH₵35`. */
export function formatCedis(value: number) {
  return cedis.format(Math.round(value));
}

/**
 * Normalises a Ghanaian phone number to `+233XXXXXXXXX`, accepting `024…`,
 * `24…` and `+233 24…`. Returns null when it is not a valid Ghana number.
 */
export function normalizeGhanaPhone(input: string) {
  const digits = input.replace(/\D/g, "");
  let national: string;
  if (digits.length === 12 && digits.startsWith("233")) national = digits.slice(3);
  else if (digits.length === 10 && digits.startsWith("0")) national = digits.slice(1);
  else if (digits.length === 9) national = digits;
  else return null;
  return /^[235]\d{8}$/.test(national) ? `+233${national}` : null;
}
