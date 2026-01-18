import React, { useEffect, useState } from 'react';
import { PageWrapper } from '../components/PageWrapper';
import { RaceTrace } from '../components/RaceTrace';
import { RaceControl } from '../components/RaceControl';

export function Races() {
  const [year] = useState(2024);
  const [race] = useState('Bahrain Grand Prix'); // Hardcoded for V1
  
  const [traceData, setTraceData] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        try {
            // In a real implementation, we'd add these to api.ts
            // For now, assuming fetchApi helper or direct fetch
            const traceRes = await fetch(`http://localhost:8000/api/v1/laps/${year}/${race}/gap-analysis`);
            const msgRes = await fetch(`http://localhost:8000/api/v1/races/${year}/${race}/control`);
            
            if (traceRes.ok) setTraceData(await traceRes.json());
            if (msgRes.ok) setMessages(await msgRes.json());
            
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, [year, race]);

  return (
    <PageWrapper
      title="Race Strategy & Control"
      description={`${year} ${race}`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* Left: Race Trace (2 cols) */}
        <div className="lg:col-span-2">
            {loading ? (
                <div className="h-96 flex items-center justify-center text-slate-500">Loading trace...</div>
            ) : traceData && traceData.data ? (
                <RaceTrace data={traceData.data} />
            ) : (
                <div className="h-96 flex items-center justify-center text-slate-500">No race trace available</div>
            )}
        </div>

        {/* Right: Race Control (1 col) */}
        <div className="lg:col-span-1">
             {loading ? (
                <div className="h-96 flex items-center justify-center text-slate-500">Loading feed...</div>
            ) : (
                <RaceControl messages={messages} />
            )}
        </div>
      </div>
    </PageWrapper>
  );
}
