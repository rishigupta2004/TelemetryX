import { Navbar } from "@/components/sections/Navbar";
import { Hero } from "@/components/sections/Hero";
import { AppPreview } from "@/components/sections/AppPreview";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { ChartShowcase } from "@/components/sections/ChartShowcase";
import { CodeShowcase } from "@/components/sections/CodeShowcase";
import { PerformanceSection } from "@/components/sections/PerformanceSection";
import { Footer } from "@/components/sections/Footer";
import { HomeScrollAnimations } from "@/components/sections/HomeScrollAnimations";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-[var(--telemetry-blue)] selection:text-black">
      <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20 mix-blend-overlay" />
      
      <Navbar />
      <Hero />
      <AppPreview />
      <FeatureGrid />
      <ChartShowcase />
      <CodeShowcase />
      <PerformanceSection />
      <Footer />
      <HomeScrollAnimations />
    </main>
  );
}
