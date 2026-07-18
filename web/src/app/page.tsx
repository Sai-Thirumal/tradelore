import Link from 'next/link';
import Image from 'next/image';
import LandingNav from './components/landing/LandingNav';
import WorkflowShowcase from './components/landing/WorkflowShowcase';
import LandingFooter from './components/landing/LandingFooter';

// The brokers TradeLore auto-syncs with today. Kept factual — no invented metrics.
const brokers = [
  { name: 'Zerodha', short: 'Z' },
  { name: 'Delta Exchange', short: 'Δ' },
];

const products = ['Automated broker sync', 'Journaling', 'Trade replays', 'Analytics'];

export default function LandingPage() {
  return (
    <main className="landing-page">
      <LandingNav />

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <div className="landing-pill">Trade. Journal. Improve.</div>
          <h1>The perfect trading companion to build your edge.</h1>
          <p>
            Sync your broker to auto-log the day&apos;s trades, or import CSVs whenever you need. TradeLore pairs
            cost-aware P&amp;L, journals, chart reviews, and performance reports so every session sharpens your edge.
          </p>
          <div className="landing-cta-row">
            <Link className="landing-primary-btn" href="/login?next=/dashboard">Get started</Link>
            <a className="landing-secondary-btn" href="#product">See the product</a>
          </div>
        </div>

        <div className="landing-hero-visual" aria-label="TradeLore dashboard preview">
          <div className="hero-browser-bar">
            <span />
            <span />
            <span />
            <b>tradelore.app</b>
          </div>
          <Image
            src="/tradelore-dashboard.png"
            alt="TradeLore dashboard with P&L charts, stat cards, and calendar"
            width={2048}
            height={1078}
            priority
          />
          <div className="hero-float-card profit">
            <span>Trade win %</span>
            <strong>40.7%</strong>
          </div>
          <div className="hero-float-card sync">
            <span>Broker data</span>
            <strong>Synced</strong>
          </div>
        </div>
      </section>

      <section className="landing-brokers" id="brokers" aria-label="Brokers integrated">
        <span className="landing-brokers-label">Auto-syncs with</span>
        <div className="landing-broker-logos">
          {brokers.map((broker) => (
            <span className="landing-broker" key={broker.name}>
              <i aria-hidden="true">{broker.short}</i>
              {broker.name}
            </span>
          ))}
          <span className="landing-broker muted">+ more coming</span>
        </div>
      </section>

      <section className="landing-hub" id="hub">
        <span className="landing-hub-eyebrow">All your tools</span>
        <h2>
          Four products. <em>One hub.</em>
        </h2>
        <p>Automated broker sync, journaling, trade replays, and analytics — built around the actual trading day.</p>
        <div className="landing-hub-chips">
          {products.map((product) => (
            <span className="landing-hub-chip" key={product}>{product}</span>
          ))}
        </div>
      </section>

      <section className="landing-section landing-workflow" aria-label="Product tour">
        <div className="landing-section-heading">
          <span>Product tour</span>
          <h2>A workflow that follows the trading day.</h2>
          <p>From pre-market intent to post-market review, every screen is built around the actual work traders repeat.</p>
        </div>
        <WorkflowShowcase />
      </section>

      <section className="landing-final-cta" id="get-started">
        <span>Ready when the market closes.</span>
        <h2>Turn today&rsquo;s trades into tomorrow&rsquo;s playbook.</h2>
        <Link className="landing-primary-btn" href="/login?next=/dashboard">Start with TradeLore</Link>
      </section>

      <LandingFooter />
    </main>
  );
}
