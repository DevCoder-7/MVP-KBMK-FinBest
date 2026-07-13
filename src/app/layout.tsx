import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "FinBest AI — Asisten Manajemen Investasi Berbasis AI",
  description:
    "FinBest AI: asisten investasi non-diskrisioner dengan deteksi bias kognitif, Friction-by-Design, edukasi adaptif, dan panduan ESG. Didukung RAG + data pasar IDX bertimestamp.",
  keywords: [
    "FinBest AI",
    "investasi",
    "non-diskrisioner",
    "AI Mentor",
    "RAG",
    "Friction-by-Design",
    "Bias Detection",
    "ESG",
    "IDX",
    "OJK",
    "Indonesia",
  ],
  authors: [{ name: "Tim FinBest AI" }],
  icons: { icon: "/logo.svg" },
  openGraph: {
    title: "FinBest AI — Asisten Manajemen Investasi Berbasis AI",
    description:
      "Platform investasi non-diskrisioner dengan AI Mentor, Bias Detection, dan RAG untuk investor Gen Z Indonesia.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <SonnerToaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
