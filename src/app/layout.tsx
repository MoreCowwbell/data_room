import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CookieConsent } from "@/components/CookieConsent";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpenVault",
  description: "Secure document sharing with analytics, watermarking, and NDA enforcement",
};

const themeInitScript = `
(() => {
  try {
    const storedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = storedTheme === 'dark' || (storedTheme !== 'light' && prefersDark);
    document.documentElement.classList.toggle('dark', isDark);
  } catch {}
})();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
