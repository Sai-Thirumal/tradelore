import Link from 'next/link';

function TradeLoreMark() {
  return (
    <svg width="22" height="26" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <line x1="10" y1="2" x2="10" y2="7" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 7H12.5L17 11.5V17H3V7Z" fill="#f97316" />
      <line x1="10" y1="17" x2="10" y2="22" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// NOTE: update these two handles to TradeLore's real profiles when available.
const SOCIALS = {
  twitter: 'https://x.com/tradelore',
  instagram: 'https://instagram.com/tradelore',
};

const columns: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Automated broker sync', href: '/#p-sync' },
      { label: 'Journaling', href: '/#p-journal' },
      { label: 'Trade replay', href: '/#p-replay' },
      { label: 'Analytics', href: '/#p-analytics' },
      { label: 'Product tour', href: '/#product' },
    ],
  },
  {
    title: 'Brokers',
    links: [
      { label: 'Supported brokers', href: '/#brokers' },
      { label: 'Zerodha', href: '/#brokers' },
      { label: 'Upstox', href: '/#brokers' },
      { label: 'Dhan', href: '/#brokers' },
      { label: 'Angel One', href: '/#brokers' },
      { label: 'Delta Exchange', href: '/#brokers' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Log in', href: '/login' },
      { label: 'Get started', href: '/login?next=/dashboard' },
    ],
  },
];

export default function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-inner">
        <div className="landing-footer-brand">
          <Link className="landing-footer-logo" href="/" aria-label="TradeLore home">
            <TradeLoreMark />
            <span>TradeLore</span>
          </Link>
          <p className="landing-footer-disclaimer">
            TradeLore is a trading journal and analytics companion. Trading involves substantial risk and is not
            appropriate for everyone. Nothing here is investment advice, and past performance is not a guarantee of
            future results. TradeLore does not place, modify, or cancel orders on your behalf.
          </p>
          <div className="landing-footer-socials">
            <a href={SOCIALS.twitter} aria-label="TradeLore on X" target="_blank" rel="noreferrer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
              </svg>
            </a>
            <a href={SOCIALS.instagram} aria-label="TradeLore on Instagram" target="_blank" rel="noreferrer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="2.5" y="2.5" width="19" height="19" rx="5.4" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="17.3" cy="6.7" r="1.3" fill="currentColor" />
              </svg>
            </a>
          </div>
        </div>

        <div className="landing-footer-cols">
          {columns.map((col) => (
            <div className="landing-footer-col" key={col.title}>
              <span className="landing-footer-col-title">{col.title}</span>
              {col.links.map((link) => (
                <Link key={link.label} className="landing-footer-link" href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="landing-footer-bar">
        <span>© {new Date().getFullYear()} TradeLore. All rights reserved.</span>
        <Link className="landing-footer-bar-link" href="/#brokers">
          Browse supported brokers &amp; integrations ↗
        </Link>
      </div>
    </footer>
  );
}
