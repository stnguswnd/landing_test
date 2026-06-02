import type { Metadata } from "next";
import { absoluteUrl, siteConfig } from "@/lib/seo";
import "./globals.css";

const ogImageUrl = absoluteUrl(siteConfig.ogImage);

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: siteConfig.title,
  description: siteConfig.description,
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "Janetimes English",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    images: [ogImageUrl],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
