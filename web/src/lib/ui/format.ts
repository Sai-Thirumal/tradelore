export function fmtINR(n: number, showSign = true) {
  const abs = Math.abs(n);
  const str = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(abs);
  if (!showSign) return '₹' + str;
  return (n < 0 ? '−' : '+') + '₹' + str;
}

export function fmtMoney(n: number, currency = 'INR', showSign = true) {
  const code = (currency || 'INR').toUpperCase();
  if (code === 'INR') return fmtINR(n, showSign);

  const abs = Math.abs(n);
  const maximumFractionDigits = ['BTC', 'ETH'].includes(code) ? 8 : 2;
  const str = new Intl.NumberFormat('en-IN', { maximumFractionDigits }).format(abs);
  const sign = showSign ? (n < 0 ? '−' : '+') : '';
  return `${sign}${str} ${code}`;
}

export function fmtPrice(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
}

export function fmtDateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
}

export function fmtDateShort(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function fmtDateChart(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}
