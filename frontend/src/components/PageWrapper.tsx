import React, { ReactNode } from 'react';

interface PageWrapperProps {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function PageWrapper({ title, description, children, actions }: PageWrapperProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {description && <p className="text-slate-400 mt-1">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
