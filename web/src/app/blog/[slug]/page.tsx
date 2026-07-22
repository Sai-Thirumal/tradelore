import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/app/components/JsonLd";
import { blogUrl, getPublishedBlogPost, publishedBlogPosts } from "../blog-posts";

type PageProps = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return publishedBlogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = getPublishedBlogPost((await params).slug);
  if (!post) return {};
  const url = blogUrl(post.slug);
  return {
    title: post.title,
    description: post.description,
    authors: [{ name: post.author }],
    alternates: { canonical: url },
    openGraph: { type: "article", siteName: "TradeLore", url, title: post.title, description: post.description, publishedTime: post.publishedAt, modifiedTime: post.modifiedAt, authors: [post.author], section: post.category },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const post = getPublishedBlogPost((await params).slug);
  if (!post) notFound();
  const url = blogUrl(post.slug);
  const related = post.relatedSlugs.map(getPublishedBlogPost).filter(Boolean);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "headline": post.title,
        "description": post.description,
        "url": url,
        "datePublished": post.publishedAt,
        "dateModified": post.modifiedAt,
        "author": { "@type": "Person", name: post.author },
        "publisher": { "@type": "Organization", name: "TradeLore", url: "https://www.tradelore.co.in" },
        "articleSection": post.category,
        "mainEntityOfPage": { "@type": "WebPage", "@id": url },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://www.tradelore.co.in" },
          { "@type": "ListItem", position: 2, name: "Blog", item: blogUrl() },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
      },
    ],
  };

  return (
    <main className="blog-page">
      <JsonLd data={jsonLd} />
      <header className="blog-header">
        <Link className="blog-brand" href="/">TradeLore</Link>
        <nav className="blog-nav" aria-label="Blog navigation">
          <Link href="/product">Product</Link>
          <Link href="/blog">Blog</Link>
          <Link className="blog-cta" href="/login?next=/dashboard">Get started</Link>
        </nav>
      </header>
      <div className="blog-shell">
        <nav className="blog-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link><span aria-hidden="true">/</span><Link href="/blog">Blog</Link><span aria-hidden="true">/</span><span>{post.title}</span>
        </nav>
        <article className="blog-post">
          <header className="blog-post-header">
            <p className="blog-eyebrow">{post.category}</p>
            <h1>{post.title}</h1>
            <p className="blog-intro">{post.intro}</p>
            <p className="blog-byline">By {post.author} · Published {post.publishedAt} · Updated {post.modifiedAt} · {post.readingTime}</p>
          </header>
          <nav className="blog-toc" aria-label="Table of contents">
            <h2>In this article</h2>
            <ol>{post.sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.heading}</a></li>)}</ol>
          </nav>
          <div className="blog-content">
            {post.sections.map((section) => (
              <section id={section.id} key={section.id}>
                <h2>{section.heading}</h2>
                {section.content.map((block, index) => {
                  if (block.type === "paragraphs") return block.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>);
                  if (block.type === "list") return <ul key={index}>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
                  return <div className="blog-table-wrap" key={index}><table><thead><tr>{block.headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{block.rows.map((row) => <tr key={row.join("-")}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>;
                })}
              </section>
            ))}
          </div>
          <section className="blog-links" aria-labelledby="keep-reading">
            <h2 id="keep-reading">Keep reading</h2>
            <ul>{post.internalLinks.map((link) => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul>
            {related.length > 0 && <div><h3>Related articles</h3><ul>{related.map((relatedPost) => relatedPost && <li key={relatedPost.slug}><Link href={`/blog/${relatedPost.slug}`}>{relatedPost.title}</Link></li>)}</ul></div>}
          </section>
          <section className="blog-final-cta">
            <h2>Make review part of your trading day</h2>
            <p>Import your trades, journal the decisions, and review the patterns that repeat.</p>
            <Link className="blog-primary" href="/login?next=/dashboard">Start using TradeLore</Link>
          </section>
        </article>
      </div>
    </main>
  );
}
