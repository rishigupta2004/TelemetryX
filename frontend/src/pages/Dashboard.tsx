import { LayoutDashboard } from 'lucide-react';
import { PageWrapper } from '../components/PageWrapper';

export function Dashboard() {
  return (
    <PageWrapper
      title="Dashboard"
      description="Overview of F1 telemetry data"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">{stat.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}

const stats = [
  { label: 'Races This Season', value: '24', icon: LayoutDashboard, color: 'bg-red-600/20 text-red-500' },
  { label: 'Active Drivers', value: '20', icon: LayoutDashboard, color: 'bg-blue-600/20 text-blue-500' },
  { label: 'Teams', value: '10', icon: LayoutDashboard, color: 'bg-green-600/20 text-green-500' },
  { label: 'Lap Records', value: '156', icon: LayoutDashboard, color: 'bg-purple-600/20 text-purple-500' },
];
