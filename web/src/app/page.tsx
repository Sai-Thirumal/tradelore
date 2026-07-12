import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { BarChart3, BookOpenText, CandlestickChart, FileSpreadsheet, LineChart, ShieldCheck } from 'lucide-react';
import JsonLd from './components/JsonLd';
import { socialImageAlt, socialImageSize } from './social-image';
import { createClient } from '@/lib/supabase/server';

const title = 'TradeLore — Your Trading Companion for Journaling & Analytics';
const description = 'Plan, journal and review your trades while TradeLore turns your trading data into insights that help you improve.';
const url = 'https://www.tradelore.co.in';
const socialImage = {
  url: `${url}/social/opengraph-image`,
  ...socialImageSize,
  alt: socialImageAlt,
};
const twitterImage = {
  ...socialImage,
  url: `${url}/social/twitter-image`,
};

export const metadata: Metadata = {
  title: {
    absolute: title,
  },
  description,
  alternates: {
    canonical: url,
  },
  openGraph: {
    type: 'website',
    siteName: 'TradeLore',
    url,
    title,
    description,
    images: [socialImage],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [twitterImage],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${url}/#organization`,
      name: 'TradeLore',
      url,
      logo: `${url}/tradelore-icon.svg`,
    },
    {
      '@type': 'WebSite',
      '@id': `${url}/#website`,
      url,
      name: 'TradeLore',
      publisher: {
        '@id': `${url}/#organization`,
      },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${url}/#software`,
      name: 'TradeLore',
      url,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      description,
      publisher: {
        '@id': `${url}/#organization`,
      },
    },
  ],
} as const;

const productShots = [
  {
    title: 'Dashboard',
    eyebrow: 'Know the month in one glance',
    copy: 'Net P&L, win rate, profit factor, daily bars, cumulative curves, and a calendar that makes good and bad periods obvious.',
    image: '/tradelore-dashboard.png',
  },
  {
    title: 'Journal',
    eyebrow: 'Plan before, review after',
    copy: 'Capture bias, capital, levels, news, post-market notes, risk, sizing, emotions, and playbook usage right beside the trades.',
    image: '/tradelore-journal.png',
  },
  {
    title: 'Trade Log',
    eyebrow: 'Every execution, organized',
    copy: 'Broker CSV imports become clean month, day, and trade groupings with average entry, exit, net P&L, orders, and journal links.',
    image: '/tradelore-trade-log.png',
  },
  {
    title: 'Reports',
    eyebrow: 'Find your repeatable edge',
    copy: 'Spot best days, weak sessions, win-rate pockets, instrument behavior, duration patterns, and risk habits without spreadsheet work.',
    image: '/tradelore-reports.png',
  },
];

const features = [
  {
    icon: FileSpreadsheet,
    title: 'CSV to clarity',
    copy: 'Import broker files and let TradeLore match fills into completed trades with costs included.',
  },
  {
    icon: BookOpenText,
    title: 'Built-in journaling',
    copy: 'Pre-market plans and post-market reviews stay attached to the trades they explain.',
  },
  {
    icon: LineChart,
    title: 'Cost-aware analytics',
    copy: 'Track net P&L, win rate, profit factor, averages, streaks, and day-by-day performance.',
  },
  {
    icon: CandlestickChart,
    title: 'Trade replay context',
    copy: 'Review entries and exits on the chart with order legs and journal context in one view.',
  },
  {
    icon: BarChart3,
    title: 'Pattern reports',
    copy: 'Understand what works by weekday, month, trade time, holding duration, instrument, and playbook.',
  },
  {
    icon: ShieldCheck,
    title: 'Private by design',
    copy: 'Broker data is used for journaling and analytics. TradeLore does not place, modify, or cancel orders.',
  },
];

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

async function isSignedIn() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return Boolean(data.user);
  } catch {
    return false;
  }
}

export default async function LandingPage() {
  if (await isSignedIn()) {
    redirect('/dashboard');
  }

  return (
    <main className="landing-page">
      <JsonLd data={jsonLd} />
      <header className="landing-header">
        <Link className="landing-brand" href="/" aria-label="TradeLore home">
          <TradeLoreMark />
          <span>TradeLore</span>
        </Link>
        <nav className="landing-nav" aria-label="Landing navigation">
          <a href="#product">Product</a>
        </nav>
        <div className="landing-header-actions">
          <Link className="landing-link-btn" href="/dashboard">Log in</Link>
          <Link className="landing-primary-btn small" href="/dashboard">Start journaling</Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <div className="landing-pill">Trade. Journal. Improve.</div>
          <h1>The perfect trading companion to build your edge.</h1>
          <p>
            Sync your broker to auto-log the day&apos;s trades, or import CSVs whenever you need. TradeLore pairs
            cost-aware P&L, journals, chart reviews, and performance reports so every session sharpens your edge.
          </p>
          <div className="landing-cta-row">
            <Link className="landing-primary-btn" href="/dashboard">Get started</Link>
            <a className="landing-secondary-btn" href="#product">See the product</a>
          </div>
        </div>

        <div className="landing-hero-visual" aria-label="TradeLore dashboard preview">
          <div className="hero-browser-bar">
            <span />
            <span />
            <span />
            <b>tradelore.co.in</b>
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

      <section className="landing-section landing-feature-strip" aria-label="TradeLore features">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <article key={feature.title} className="landing-feature-card">
              <Icon size={22} aria-hidden="true" />
              <h2>{feature.title}</h2>
              <p>{feature.copy}</p>
            </article>
          );
        })}
      </section>

      <section className="landing-section landing-showcase" id="product">
        <div className="landing-section-heading">
          <span>Product tour</span>
          <h2>A workflow that follows the trading day.</h2>
          <p>From pre-market intent to post-market review, every screen is built around the actual work traders repeat.</p>
        </div>
        <div className="showcase-grid">
          {productShots.map((shot) => (
            <article key={shot.title} className="showcase-card">
              <div>
                <span>{shot.eyebrow}</span>
                <h3>{shot.title}</h3>
                <p>{shot.copy}</p>
              </div>
              <Image
                src={shot.image}
                alt={`TradeLore ${shot.title.toLowerCase()} screen`}
                width={2048}
                height={1078}
              />
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-trade-detail">
        <div className="trade-detail-copy">
          <span>Trade replay</span>
          <h2>Zoom into the exact trade, not just the summary.</h2>
          <p>
            Review direction, quantity, entry, exit, order legs, and chart markers together. The outcome becomes easier
            to explain when the evidence sits in one place.
          </p>
          <Link className="landing-primary-btn" href="/dashboard">Open your journal</Link>
        </div>
        <div className="trade-detail-image">
          <Image
            src="/tradelore-trade-detail.png"
            alt="TradeLore trade detail view with chart and order summary"
            width={2048}
            height={1078}
          />
        </div>
      </section>

      <section className="landing-final-cta">
        <span>Ready when the market closes.</span>
        <h2>Turn today’s trades into tomorrow’s playbook.</h2>
        <Link className="landing-primary-btn" href="/dashboard">Start with TradeLore</Link>
      </section>
    </main>
  );
}
