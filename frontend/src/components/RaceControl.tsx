import React from 'react';
import { Flag, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface RaceControlMessage {
  Time: string; // Timestamp
  Category: string; // Flag, SafetyCar, Penalty, etc.
  Message: string;
  Driver?: string;
  Lap?: number;
}

interface RaceControlProps {
  messages: RaceControlMessage[];
}

export const RaceControl: React.FC<RaceControlProps> = ({ messages }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-[500px]">
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <h3 className="text-slate-400 text-sm font-bold uppercase flex items-center gap-2">
          <Flag size={16} /> Race Control
        </h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, idx) => {
          let icon = <Info size={16} className="text-blue-400" />;
          let borderClass = "border-l-4 border-blue-500";
          
          if (msg.Category === "Flag") {
             if (msg.Message.includes("YELLOW")) {
                 icon = <Flag size={16} className="text-yellow-400" />;
                 borderClass = "border-l-4 border-yellow-500";
             } else if (msg.Message.includes("RED")) {
                 icon = <Flag size={16} className="text-red-500" />;
                 borderClass = "border-l-4 border-red-600";
             } else if (msg.Message.includes("GREEN")) {
                 icon = <Flag size={16} className="text-green-500" />;
                 borderClass = "border-l-4 border-green-500";
             }
          } else if (msg.Category === "SafetyCar") {
              icon = <AlertTriangle size={16} className="text-orange-500" />;
              borderClass = "border-l-4 border-orange-500";
          }
          
          return (
            <div key={idx} className={`bg-slate-800/50 p-3 rounded-r ${borderClass} flex gap-3`}>
              <div className="mt-0.5">{icon}</div>
              <div>
                <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-500">{msg.Time.split(' ')[1]?.split('.')[0] || msg.Time}</span>
                    {msg.Lap && <span className="text-xs bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">L{msg.Lap}</span>}
                </div>
                <p className="text-sm text-slate-200 font-medium">{msg.Message}</p>
              </div>
            </div>
          );
        })}
        
        {messages.length === 0 && (
            <div className="text-center text-slate-500 py-10">
                No race control messages found
            </div>
        )}
      </div>
    </div>
  );
};
