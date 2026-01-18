import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function GlassCard({ children, className = '', onClick }: GlassCardProps) {
  return (
    <div
      className={`glass-card ${onClick ? 'cursor-pointer hover:bg-surface-hover transition-colors' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-f1-red hover:bg-f1-red-light text-white',
    secondary: 'bg-surface hover:bg-surface-hover text-white border border-white/10',
    ghost: 'hover:bg-white/5 text-white/80',
  };

  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={`rounded-lg font-medium transition-colors ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

interface SelectProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Select({ value, options, onChange, placeholder, disabled = false, className = '' }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-white 
        focus:outline-none focus:border-f1-red/50 disabled:opacity-50 ${className}`}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`flex items-center justify-center`}>
      <div
        className={`${sizes[size]} border-2 border-white/10 border-t-f1-red rounded-full animate-spin`}
      />
    </div>
  );
}

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className = '', width, height }: SkeletonProps) {
  return (
    <div
      className={`bg-surface animate-pulse rounded ${className}`}
      style={{ width, height }}
    />
  );
}

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  variant?: 'filled' | 'outline';
  className?: string;
}

export function Badge({ children, color = '#e10600', variant = 'filled', className = '' }: BadgeProps) {
  const styles = variant === 'filled'
    ? { backgroundColor: color, color: '#fff' }
    : { borderColor: color, color, border: '1px solid' };

  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded ${className}`}
      style={styles}
    >
      {children}
    </span>
  );
}

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <div className="relative group inline-block">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 
        bg-surface text-white text-xs rounded opacity-0 group-hover:opacity-100 
        transition-opacity whitespace-nowrap pointer-events-none z-50">
        {content}
      </div>
    </div>
  );
}
