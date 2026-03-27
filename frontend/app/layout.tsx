import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { SmoothScrollProvider } from "@/components/smooth-scroll-provider";
import { CustomCursor } from "@/components/custom-cursor";
import { LoadingScreen } from "@/components/loading-screen";
import { Navbar } from "@/components/navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  applicationName: "SPECTRAVEIN",
  title: "SPECTRAVEIN · Orbital Mining Intelligence",
  description:
    "Transforming raw JPL spectral data into high-yield financial targets. Asteroid classification, ROI modeling, and mission feasibility scoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} antialiased bg-griflan-black text-white`}
      >
        {/* Loading intro — renders once, animates away after 2.4s */}
        <LoadingScreen />

        {/* Persistent global navigation — fixed, z-40 */}
        <Navbar />

        {/* Framer Motion custom cursor */}
        <CustomCursor />

        {/* Lenis smooth scroll wraps all page content */}
        <SmoothScrollProvider>
          {children}
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
