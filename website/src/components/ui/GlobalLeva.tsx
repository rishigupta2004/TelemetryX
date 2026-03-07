"use client";
import { Leva } from "leva";

export function GlobalLeva() {
  return (
    <div className="hidden lg:block">
      <Leva 
        theme={{
          colors: {
            elevation1: '#000000',
            elevation2: '#050505',
            elevation3: '#18181b',
            accent1: 'var(--telemetry-blue)',
            accent2: 'var(--telemetry-blue)',
            accent3: 'var(--telemetry-green)',
            highlight1: '#ffffff',
            highlight2: '#a1a1aa',
            highlight3: 'var(--telemetry-red)',
            vivid1: 'var(--telemetry-yellow)'
          },
          fonts: {
            mono: 'var(--font-jetbrains-mono)',
            sans: 'var(--font-space-grotesk)',
          },
          radii: {
            xs: '0px',
            sm: '0px',
            lg: '0px',
          },
          borderWidths: {
            focus: '1px',
            folder: '1px',
            active: '1px',
            hover: '1px',
          }
        }}
        titleBar={{ title: "SYS_CTRL", drag: true, filter: false }}
        collapsed={true}
        flat={true}
      />
    </div>
  );
}
