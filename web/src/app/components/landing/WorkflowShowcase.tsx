'use client';

import Image from 'next/image';
import Link from 'next/link';
import Reveal from './Reveal';

type Product = {
  id: string;
  eyebrow: string;
  title: string;
  copy: string;
  image: string;
  alt: string;
  cta?: { label: string; href: string };
};

/**
 * The four TradeLore products, rendered as numbered scroll-reveal blocks.
 * Layout alternates image/text side each row; Trade Replay is included here
 * so the whole workflow shares one motion treatment.
 */
const products: Product[] = [
  {
    id: 'p-sync',
    eyebrow: 'Automated broker sync',
    title: 'Your brokers, synced automatically.',
    copy: 'Sync your broker once to auto-log the day’s trades, or import CSVs whenever you need. TradeLore matches fills into completed trades with costs included, so your dashboard is ready when the market closes.',
    image: '/tradelore-dashboard.png',
    alt: 'TradeLore dashboard with P&L charts, stat cards, and a calendar',
  },
  {
    id: 'p-journal',
    eyebrow: 'Powerful and automated journaling',
    title: 'Journaling that stays beside the trade.',
    copy: 'Capture bias, capital, levels, news, post-market notes, risk, sizing, emotions, and playbook usage right beside the trades they explain. Pre-market plans and post-market reviews never drift apart.',
    image: '/tradelore-journal.png',
    alt: 'TradeLore journal screen with pre-market plan and post-trade review',
  },
  {
    id: 'p-replay',
    eyebrow: 'Trade replay',
    title: 'Zoom into the exact trade, not just the summary.',
    copy: 'Review direction, quantity, entry, exit, order legs, and chart markers together. The outcome becomes easier to explain when the evidence sits in one place.',
    image: '/tradelore-trade-detail.png',
    alt: 'TradeLore trade detail view with chart and order summary',
    cta: { label: 'Open your journal', href: '/login?next=/dashboard' },
  },
  {
    id: 'p-analytics',
    eyebrow: 'Cost-aware analytics',
    title: 'Analytics that surface your real edge.',
    copy: 'Track net P&L, win rate, profit factor, averages, and streaks, then break performance down by weekday, month, trade time, holding duration, instrument, and playbook — without spreadsheet work.',
    image: '/tradelore-reports.png',
    alt: 'TradeLore reports screen with performance breakdowns',
  },
];

export default function WorkflowShowcase() {
  return (
    <div className="workflow-showcase" id="product">
      {products.map((product, index) => (
        <Reveal
          as="section"
          key={product.id}
          className={`workflow-row ${index % 2 === 1 ? 'is-reversed' : ''}`}
        >
          <div className="workflow-copy" id={product.id}>
            <span className="workflow-number" aria-hidden="true">
              {index + 1}
            </span>
            <span className="workflow-eyebrow">{product.eyebrow}</span>
            <h3>{product.title}</h3>
            <p>{product.copy}</p>
            {product.cta && (
              <Link className="landing-primary-btn" href={product.cta.href}>
                {product.cta.label}
              </Link>
            )}
          </div>
          <div className="workflow-visual">
            <div className="hero-browser-bar">
              <span />
              <span />
              <span />
              <b>tradelore.app</b>
            </div>
            <Image src={product.image} alt={product.alt} width={2048} height={1078} />
          </div>
        </Reveal>
      ))}
    </div>
  );
}
