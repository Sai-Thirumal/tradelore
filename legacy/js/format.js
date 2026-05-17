function fmtINR(n, showSign = true) {
  const abs = Math.abs(n);
  const str = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(abs);
  if (!showSign) return '₹' + str;
  return (n < 0 ? '−' : '+') + '₹' + str;
}

function fmtPrice(n) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
}

function fmtDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
}

function fmtDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function fmtDateChart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}
