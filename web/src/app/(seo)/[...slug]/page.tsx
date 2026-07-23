import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/app/components/JsonLd";
import { getSeoPage, seoPages, siteUrl } from "../seo-pages";

type PageProps = {
  params: Promise<{
    slug: string[];
  }>;
};

function pathFrom(slug: string[]) {
  return slug.join("/");
}

export function generateStaticParams() {
  return seoPages.map((page) => ({
    slug: page.slug.split("/"),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const page = getSeoPage(pathFrom((await params).slug));
  if (!page) return {};

  return {
    title: page.title,
    description: page.description,
    alternates: {
      canonical: `/${page.slug}`,
    },
    openGraph: {
      type: "website",
      siteName: "TradeLore",
      url: `${siteUrl}/${page.slug}`,
      title: `${page.title} | TradeLore`,
      description: page.description,
      images: page.image ? [{ url: page.image.src, alt: page.image.alt }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${page.title} | TradeLore`,
      description: page.description,
      images: page.image ? [page.image.src] : undefined,
    },
  };
}

export default async function SeoPageRoute({ params }: PageProps) {
  const page = getSeoPage(pathFrom((await params).slug));
  if (!page) notFound();

  const url = `${siteUrl}/${page.slug}`;
  const crumbs = page.slug.split("/").map((part, index, parts) => ({
    name: part.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" "),
    url: `${siteUrl}/${parts.slice(0, index + 1).join("/")}`,
  }));
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
          ...crumbs.map((crumb, index) => ({
            "@type": "ListItem",
            position: index + 2,
            name: crumb.name,
            item: crumb.url,
          })),
        ],
      },
      {
        "@type": "SoftwareApplication",
        name: "TradeLore",
        url,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        description: page.description,
      },
      ...(page.faqs ? [{
        "@type": "FAQPage",
        mainEntity: page.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      }] : []),
    ],
  };

  return (
    <main className="seo-page">
      <JsonLd data={jsonLd} />
      <header className="seo-header">
        <Link className="seo-brand" href="/">TradeLore</Link>
        <nav className="seo-nav" aria-label="SEO pages">
          <Link href="/product">Product</Link>
          <Link href="/brokers">Brokers</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/security">Security</Link>
          <Link className="seo-cta" href="/login?next=/dashboard">Get started</Link>
        </nav>
      </header>

      <article className="seo-article">
        <nav className="seo-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          {crumbs.map((crumb) => (
            <span key={crumb.url}>/ {crumb.name}</span>
          ))}
        </nav>

        <section className="seo-hero">
          <div>
            <p className="seo-eyebrow">TradeLore — Trading Journal for Indian Traders</p>
            <h1>{page.h1}</h1>
            <p>{page.intro}</p>
            <Link className="seo-primary" href="/login?next=/dashboard">Start journaling</Link>
          </div>
          {page.image && (
            <div className={`seo-image ${page.image.portrait ? "seo-image-portrait" : ""}`}>
              <Image
                src={page.image.src}
                alt={page.image.alt}
                width={page.image.width ?? 1200}
                height={page.image.height ?? 720}
                priority
              />
            </div>
          )}
        </section>

        <div className="seo-sections">
          {page.sections.map((section) => (
            <section className="seo-section" key={section.heading}>
              <h2>{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>

        {page.faqs && (
          <section className="seo-faq">
            <h2>Frequently Asked Questions</h2>
            {page.faqs.map((faq) => (
              <details key={faq.question}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </section>
        )}

        <section className="seo-final">
          <h2>Ready to review your next trading day?</h2>
          <p>Import your trades, journal the decisions, and use reports to find the patterns worth acting on.</p>
          <Link className="seo-primary" href="/login?next=/dashboard">Create your TradeLore account</Link>
        </section>
      </article>
    </main>
  );
}
