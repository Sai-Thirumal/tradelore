import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import JsonLd from './components/JsonLd';
import LandingFooter from './components/landing/LandingFooter';
import LandingNav from './components/landing/LandingNav';
import WorkflowShowcase from './components/landing/WorkflowShowcase';
import { socialImageAlt, socialImageSize } from './social-image';
import { createClient } from '@/lib/supabase/server';

const title = 'TradeLore - Your Trading Companion for Journaling & Analytics';
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
      logo: `${url}/tradelore-icon.png`,
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

const brokers = [
  { name: 'Zerodha', short: 'Z' },
  { name: 'Delta Exchange', short: 'D' },
];

const products = ['Automated broker sync', 'Journaling', 'Trade replays', 'Analytics'];

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
            <Link className="landing-primary-btn" href="/login">Get started</Link>
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
        <p>Automated broker sync, journaling, trade replays, and analytics - built around the actual trading day.</p>
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
        <h2>Turn today&apos;s trades into tomorrow&apos;s playbook.</h2>
        <Link className="landing-primary-btn" href="/login?next=/dashboard">Start with TradeLore</Link>
      </section>

      <LandingFooter />
    </main>
  );
}
