import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { RTL_LOCALES, routing } from "../../i18n/routing";
import "../globals.css";

/* ---------------- Fonts ---------------- */
const headingFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "700"],
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

/* ---------------- i18n params ---------------- */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/* ---------------- Metadata (SEO only) ---------------- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: candidateLocale } = await params;

  const locale = hasLocale(routing.locales, candidateLocale)
    ? candidateLocale
    : routing.defaultLocale;

  const t = await getTranslations({ locale, namespace: "metadata" });

  const languages = Object.fromEntries(
    routing.locales.map((l) => [l, `/${l}`]),
  );

  return {
    title: t("title"),
    description: t("description"),

    metadataBase: new URL("https://flint.arthurp.fr"),

    alternates: {
      canonical: `/${locale}`,
      languages,
    },

    applicationName: t("title"),

    icons: {
      icon: [
        { url: "/favicon.ico" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/android-chrome-192x192.png", sizes: "192x192" },
        { url: "/android-chrome-512x512.png", sizes: "512x512" },
      ],
      apple: "/apple-touch-icon.png",
    },

    appleWebApp: {
      capable: true,
      title: t("title"),
      statusBarStyle: "default",
    },

    openGraph: {
      type: "website",
      locale,
      url: `/${locale}`,
      title: t("title"),
      description: t("description"),
      siteName: t("title"),
    },

    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
    },

    robots: {
      index: true,
      follow: true,
    },
  };
}

/* ---------------- Viewport (UI/mobile only) ---------------- */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

/* ---------------- Layout ---------------- */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  const direction = RTL_LOCALES.includes(locale as (typeof RTL_LOCALES)[number])
    ? "rtl"
    : "ltr";

  return (
    <html lang={locale} dir={direction}>
      <body
        className={`${headingFont.variable} ${monoFont.variable} antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
