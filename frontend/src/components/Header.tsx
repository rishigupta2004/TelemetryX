import React from 'react';
import { Bell, Search, User } from 'lucide-react';

export function Header() {
  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search races, drivers..."
            className="w-full bg-slate-800 text-white pl-10 pr-4 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-red-600"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-slate-400 hover:text-white">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <button className="flex items-center gap-2 p-2 text-slate-400 hover:text-white">
          <User size={20} />
        </button>
      </div>
    </header>
  );
}
