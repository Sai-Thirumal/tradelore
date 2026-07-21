import type { Metadata } from "next";
import { requirePageAuth } from "@/lib/auth/page";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requirePageAuth();
  return <>{children}</>;
}
