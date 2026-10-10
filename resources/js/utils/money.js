// Philippine peso formatting, shared so every screen shows money the same
// way: "₱12,500.00". Returns `fallback` for empty / non-numeric input.
const PESO = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export function formatPeso(amount, fallback = '—') {
    if (amount === null || amount === undefined || amount === '') return fallback;
    const n = Number(amount);
    return Number.isFinite(n) ? PESO.format(n) : fallback;
}
