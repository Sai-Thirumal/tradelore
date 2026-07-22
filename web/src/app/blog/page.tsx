import type { Metadata } from "next";
import Link from "next/link";
import { blogUrl, publishedBlogPosts } from "./blog-posts";

export const metadata: Metadata = {
  title: "Trading Journal and Analytics Blog",
  description: "Practical guidance for planning, journaling, replaying, and reviewing trades with TradeLore.",
  alternates: { canonical: blogUrl() },
  openGraph: {
    type: "website",
    siteName: "TradeLore",
    url: blogUrl(),
    title: "Trading Journal and Analytics Blog | TradeLore",
    description: "Practical guidance for planning, journaling, replaying, and reviewing trades with TradeLore.",
  },
};

export default function BlogIndexPage() {
  return (
    <main className="blog-page">
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
          <Link href="/">Home</Link><span aria-hidden="true">/</span><span>Blog</span>
        </nav>
        <header className="blog-index-hero">
          <p className="blog-eyebrow">TradeLore journal</p>
          <h1>Ideas for a more deliberate trading review</h1>
          <p>Practical notes on planning, journaling, replaying, and analysing your trading process.</p>
        </header>

        <section className="blog-list" aria-labelledby="latest-articles">
          <h2 id="latest-articles">Latest articles</h2>
          {publishedBlogPosts.length ? publishedBlogPosts.map((post) => (
            <article className="blog-card" key={post.slug}>
              <div>
                <p className="blog-card-meta">{post.category} · {post.publishedAt}</p>
                <h3><Link href={`/blog/${post.slug}`}>{post.title}</Link></h3>
                <p>{post.description}</p>
              </div>
              <Link className="blog-read-link" href={`/blog/${post.slug}`}>Read article</Link>
            </article>
          )) : <p className="blog-empty">New articles are being prepared. Check back soon.</p>}
        </section>
      </div>
    </main>
  );
}
