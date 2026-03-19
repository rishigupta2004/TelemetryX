import type { Metadata } from "next";
import type { CSSProperties } from "react";
import "./globals.css";
import { CustomCursor } from "@/components/ui/CustomCursor";
import { SmoothScrolling } from "@/components/ui/SmoothScrolling";
import { Preloader } from "@/components/ui/Preloader";
import { Altimeter } from "@/components/ui/Altimeter";
import { SystemHUD } from "@/components/ui/SystemHUD";
import { GlobalLeva } from "@/components/ui/GlobalLeva";
import { F1CarModel } from "@/components/three/F1Car";

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
        className="font-sans bg-black text-white antialiased overflow-x-hidden"
        style={
          {
            "--font-space-grotesk":
              "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            "--font-jetbrains-mono":
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
          } as CSSProperties
        }
      >
        <SmoothScrolling>
          <F1CarModel className="fixed inset-0 z-[-1] pointer-events-none" />
          <Preloader />
          <GlobalLeva />
          <CustomCursor />
          <Altimeter />
          <SystemHUD />
          {children}
        </SmoothScrolling>
      </body>
    </html>
  );
}
