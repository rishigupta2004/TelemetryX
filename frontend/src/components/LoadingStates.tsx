import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export function LoadingSpinner({ size = 'md', text }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2 className={`animate-spin text-red-600 ${sizeClasses[size]}`} />
      {text && <p className="text-slate-400 text-sm">{text}</p>}
    </div>
  );
}

export function LoadingCard() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 animate-pulse">
      <div className="h-4 bg-slate-800 rounded w-1/3 mb-4"></div>
      <div className="h-8 bg-slate-800 rounded w-2/3"></div>
    </div>
  );
}

export function LoadingPage({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}
