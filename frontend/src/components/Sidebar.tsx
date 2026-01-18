import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Timer, Car, Users, Settings, Flag } from 'lucide-react';

const sidebarLinks = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/races', icon: Flag, label: 'Races' },
  { path: '/drivers', icon: Users, label: 'Drivers' },
  { path: '/telemetry', icon: Timer, label: 'Telemetry' },
  { path: '/comparisons', icon: Car, label: 'Comparisons' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 min-h-screen flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white">TelemetryX</h1>
        <p className="text-sm text-slate-400">F1 Analytics</p>
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {sidebarLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <li key={link.path}>
                <Link
                  to={link.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-red-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon size={20} />
                  <span>{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
