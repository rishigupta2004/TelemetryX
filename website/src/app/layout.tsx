import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { CustomCursor } from "@/components/ui/CustomCursor";
import { SmoothScrolling } from "@/components/ui/SmoothScrolling";
import { Preloader } from "@/components/ui/Preloader";
import { Altimeter } from "@/components/ui/Altimeter";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TelemetryX | Pro-Grade F1 Telemetry",
  description: "Advanced, high-performance platform for real-time Formula 1 telemetry, race strategy, and data visualization.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans bg-black text-white antialiased overflow-x-hidden`}
      >
        <SmoothScrolling>
          <Preloader />
          <CustomCursor />
          <Altimeter />
          {children}
        </SmoothScrolling>
      </body>
    </html>
  );
}
