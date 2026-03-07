import { Navbar } from "@/components/sections/Navbar";
import { Hero } from "@/components/sections/Hero";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { ChartShowcase } from "@/components/sections/ChartShowcase";
import { PerformanceSection } from "@/components/sections/PerformanceSection";
import { Footer } from "@/components/sections/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      <Navbar />
      <Hero />
      <FeatureGrid />
      <ChartShowcase />
      <PerformanceSection />
      <Footer />
    </main>
  );
}
