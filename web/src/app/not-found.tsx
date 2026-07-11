import Link from "next/link";

function TradeLoreMark() {
  return (
    <svg
      width="20"
      height="24"
      viewBox="0 0 20 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="landing-logo-mark"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="10" y1="2" x2="10" y2="7" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 7H12.5L17 11.5V17H3V7Z" fill="#f97316" />
      <line x1="10" y1="17" x2="10" y2="22" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function NotFound() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <Link className="landing-brand" href="/" aria-label="TradeLore home">
          <TradeLoreMark />
          <span>TradeLore</span>
        </Link>
      </header>
      <section className="landing-final-cta">
        <span>404</span>
        <h1>Page not found.</h1>
        <p>The page you are looking for could not be found.</p>
        <Link className="landing-primary-btn" href="/">Back to homepage</Link>
      </section>
    </main>
  );
}
