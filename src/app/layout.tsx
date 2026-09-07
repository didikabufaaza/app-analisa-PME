import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "didikpme — Evaluasi Z-Score & PME Laboratorium",
  description:
    "Sistem otomatis untuk membaca, memvalidasi, dan mengevaluasi hasil Pemantapan Mutu Eksternal (PME) laboratorium klinik dari berkas laporan.",
  keywords: ["PME", "Z-score", "laboratorium klinik", "proficiency testing", "EQAS", "evaluasi mutu"],
  authors: [{ name: "didikpme" }],
  icons: {
    icon: "/logo.svg",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
