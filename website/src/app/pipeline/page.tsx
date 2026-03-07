"use client";
import { useCallback } from 'react';
import ReactFlow, { Background, Controls, Edge, Node, useEdgesState, useNodesState, Position, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";

// Custom node styles to match the pit wall aesthetic
const customNodeStyle = {
  background: '#050505',
  color: '#fff',
  border: '1px solid #27272a',
  borderRadius: '0px',
  fontFamily: 'var(--font-jetbrains-mono)',
  fontSize: '10px',
  textTransform: 'uppercase' as const,
  padding: '10px 15px',
  width: 180,
  boxShadow: '0 0 10px rgba(0,0,0,0.5)',
};

const pythonNode = { ...customNodeStyle, borderLeft: '4px solid var(--telemetry-yellow)' };
const dbNode = { ...customNodeStyle, borderLeft: '4px solid var(--telemetry-red)' };
const socketNode = { ...customNodeStyle, borderLeft: '4px solid var(--telemetry-purple)' };
const workerNode = { ...customNodeStyle, borderLeft: '4px solid var(--telemetry-blue)' };
const renderNode = { ...customNodeStyle, borderLeft: '4px solid var(--telemetry-green)' };

const initialNodes: Node[] = [
  { id: '1', position: { x: 400, y: 50 }, data: { label: 'PARQUET DATA (100GB+)' }, style: dbNode, sourcePosition: Position.Bottom },
  { id: '2', position: { x: 400, y: 150 }, data: { label: 'FASTAPI (PYTHON)' }, style: pythonNode, sourcePosition: Position.Bottom, targetPosition: Position.Top },
  { id: '3', position: { x: 400, y: 250 }, data: { label: 'LOCAL DUCKDB AGGREGATION' }, style: dbNode, sourcePosition: Position.Bottom, targetPosition: Position.Top },
  { id: '4', position: { x: 400, y: 350 }, data: { label: 'WEBSOCKET IPC STREAM' }, style: socketNode, sourcePosition: Position.Bottom, targetPosition: Position.Top },
  
  { id: '5', position: { x: 200, y: 450 }, data: { label: 'CAR POSITIONS WORKER' }, style: workerNode, sourcePosition: Position.Bottom, targetPosition: Position.Top },
  { id: '6', position: { x: 400, y: 450 }, data: { label: 'TELEMETRY WORKER' }, style: workerNode, sourcePosition: Position.Bottom, targetPosition: Position.Top },
  { id: '7', position: { x: 600, y: 450 }, data: { label: 'ML STRATEGY NODE' }, style: pythonNode, sourcePosition: Position.Bottom, targetPosition: Position.Top },
  
  { id: '8', position: { x: 200, y: 550 }, data: { label: 'ZUSTAND STORE (POS)' }, style: socketNode, sourcePosition: Position.Bottom, targetPosition: Position.Top },
  { id: '9', position: { x: 400, y: 550 }, data: { label: 'ZUSTAND STORE (TEL)' }, style: socketNode, sourcePosition: Position.Bottom, targetPosition: Position.Top },
  { id: '10', position: { x: 600, y: 550 }, data: { label: 'ZUSTAND STORE (ML)' }, style: socketNode, sourcePosition: Position.Bottom, targetPosition: Position.Top },
  
  { id: '11', position: { x: 200, y: 650 }, data: { label: 'TRACK MAP (CANVAS)' }, style: renderNode, targetPosition: Position.Top },
  { id: '12', position: { x: 400, y: 650 }, data: { label: 'UPLOT TRACES (90FPS)' }, style: renderNode, targetPosition: Position.Top },
  { id: '13', position: { x: 600, y: 650 }, data: { label: 'STRATEGY PANEL (DOM)' }, style: renderNode, targetPosition: Position.Top },
];

const edgeType = 'smoothstep';
const markerEnd = { type: MarkerType.ArrowClosed, color: 'var(--telemetry-blue)' };
const animatedEdgeStyle = { stroke: 'var(--telemetry-blue)', strokeWidth: 1.5, opacity: 0.6 };

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', type: edgeType, animated: true, style: animatedEdgeStyle, markerEnd },
  { id: 'e2-3', source: '2', target: '3', type: edgeType, animated: true, style: animatedEdgeStyle, markerEnd },
  { id: 'e3-4', source: '3', target: '4', type: edgeType, animated: true, style: animatedEdgeStyle, markerEnd },
  
  { id: 'e4-5', source: '4', target: '5', type: edgeType, animated: true, style: animatedEdgeStyle, markerEnd },
  { id: 'e4-6', source: '4', target: '6', type: edgeType, animated: true, style: animatedEdgeStyle, markerEnd },
  { id: 'e4-7', source: '4', target: '7', type: edgeType, animated: true, style: animatedEdgeStyle, markerEnd },
  
  { id: 'e5-8', source: '5', target: '8', type: edgeType, animated: true, style: animatedEdgeStyle, markerEnd },
  { id: 'e6-9', source: '6', target: '9', type: edgeType, animated: true, style: animatedEdgeStyle, markerEnd },
  { id: 'e7-10', source: '7', target: '10', type: edgeType, animated: true, style: animatedEdgeStyle, markerEnd },
  
  { id: 'e8-11', source: '8', target: '11', type: edgeType, animated: true, style: animatedEdgeStyle, markerEnd },
  { id: 'e9-12', source: '9', target: '12', type: edgeType, animated: true, style: animatedEdgeStyle, markerEnd },
  { id: 'e10-13', source: '10', target: '13', type: edgeType, animated: true, style: animatedEdgeStyle, markerEnd },
];

export default function PipelineInteractive() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <main className="min-h-screen bg-black text-white flex flex-col font-sans">
      <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20 mix-blend-overlay" />
      <Navbar />
      
      <section className="pt-32 pb-6 px-6 max-w-7xl mx-auto w-full border-b border-zinc-900 z-10 relative">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-4">
          INTERACTIVE PIPELINE
        </h1>
        <p className="font-mono text-xs text-zinc-500">Drag nodes to explore the complete TelemetryX data lifecycle, from DuckDB parquets to the 90fps uPlot render boundary.</p>
      </section>

      <div className="flex-1 w-full h-[80vh] relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          className="bg-black"
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#27272a" gap={20} size={1} />
          <Controls className="!bg-[#050505] !border-zinc-800 !text-white fill-white" />
        </ReactFlow>
        
        <div className="absolute bottom-6 left-6 z-10 bg-black/80 p-4 border border-zinc-800 panel-border font-mono text-[10px] space-y-2">
           <div className="text-white mb-2 font-bold uppercase tracking-widest border-b border-zinc-800 pb-1">NODE LEGEND</div>
           <div className="flex items-center gap-2"><span className="w-2 h-2 bg-[var(--telemetry-yellow)]" /> PYTHON / BACKEND</div>
           <div className="flex items-center gap-2"><span className="w-2 h-2 bg-[var(--telemetry-red)]" /> DATABASE (DUCKDB)</div>
           <div className="flex items-center gap-2"><span className="w-2 h-2 bg-[var(--telemetry-purple)]" /> IPC / STORES (ZUSTAND)</div>
           <div className="flex items-center gap-2"><span className="w-2 h-2 bg-[var(--telemetry-blue)]" /> WEB WORKERS</div>
           <div className="flex items-center gap-2"><span className="w-2 h-2 bg-[var(--telemetry-green)]" /> RENDER BOUNDARY (DOM/CANVAS)</div>
        </div>
      </div>
    </main>
  );
}
