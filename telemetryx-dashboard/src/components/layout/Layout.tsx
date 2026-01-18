import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="h-screen flex flex-col bg-background text-white overflow-hidden">
      {children}
    </div>
  );
}

interface DashboardLayoutProps {
  header: React.ReactNode;
  leaderboard: React.ReactNode;
  map: React.ReactNode;
  panel: React.ReactNode;
}

export function DashboardLayout({ header, leaderboard, map, panel }: DashboardLayoutProps) {
  return (
    <Layout>
      {/* Zone A: Header */}
      <div className="flex-shrink-0">
        {header}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Zone B: Leaderboard (Left Sidebar) */}
        <div className="w-80 flex-shrink-0 border-r border-white/5 overflow-hidden">
          {leaderboard}
        </div>

        {/* Center Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Zone D: 3D Track (Center Background) */}
          <div className="flex-1 relative">
            {map}
          </div>
        </div>

        {/* Zone C: Engineering Deck (Right Sidebar) */}
        <div className="w-96 flex-shrink-0 border-l border-white/5 overflow-hidden">
          {panel}
        </div>
      </div>
    </Layout>
  );
}
