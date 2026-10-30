'use client';

import { useEffect, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function Card({ title, children, right, className = '' }: { title?: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center gap-2">
          {title && <h2 className="text-base font-bold">{title}</h2>}
          {right && <div className="ml-auto">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[#1F4E79] text-white hover:bg-[#173d5f] disabled:bg-gray-400',
  secondary: 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:text-gray-400',
  danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
  ghost: 'text-gray-600 hover:bg-gray-100',
};

export function Button({ variant = 'secondary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...p} className={`rounded px-3 py-1.5 text-sm font-medium transition ${VARIANTS[variant]} ${className}`} />;
}

export function LinkButton({ href, children, variant = 'secondary', download, target }: { href: string; children: ReactNode; variant?: Variant; download?: boolean; target?: string }) {
  return (
    <a href={href} download={download} target={target} rel={target ? 'noreferrer noopener' : undefined} className={`inline-block rounded px-3 py-1.5 text-sm font-medium ${VARIANTS[variant]}`}>
      {children}
    </a>
  );
}

export function Field({ label, children, hint, warn, className = '' }: { label: string; children: ReactNode; hint?: ReactNode; warn?: boolean; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className={`mb-1 block text-xs font-medium ${warn ? 'text-amber-700' : 'text-gray-600'}`}>
        {label}
        {warn && ' (비어 있음)'}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

const inputCls = 'w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79]';

export function Input({ warn, className = '', ...p }: InputHTMLAttributes<HTMLInputElement> & { warn?: boolean }) {
  return <input {...p} className={`${inputCls} ${warn ? 'border-amber-400 bg-amber-50' : ''} ${className}`} />;
}

export function Textarea({ className = '', ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={`${inputCls} ${className}`} />;
}

export function Select({ className = '', children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className={`${inputCls} ${className}`}>
      {children}
    </select>
  );
}

export function Badge({ children, color = 'gray' }: { children: ReactNode; color?: 'gray' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'orange' }) {
  const c = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800',
    orange: 'bg-orange-100 text-orange-800',
  }[color];
  return <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${c}`}>{children}</span>;
}

export function Notice({ level = 'info', children }: { level?: 'info' | 'warn' | 'danger' | 'ok'; children: ReactNode }) {
  const c = {
    info: 'border-blue-200 bg-blue-50 text-blue-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
    ok: 'border-green-200 bg-green-50 text-green-900',
  }[level];
  return <div className={`rounded border px-3 py-2 text-sm ${c}`}>{children}</div>;
}

export function splitList(s: string): string[] {
  return s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** 쉼표로 구분한 목록 입력. 입력 중인 원문을 보존한다. */
export function ListInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [raw, setRaw] = useState(value.join(', '));
  useEffect(() => {
    if (splitList(raw).join('\u0000') !== value.join('\u0000')) setRaw(value.join(', '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      className={inputCls}
      value={raw}
      placeholder={placeholder}
      onChange={(e) => {
        setRaw(e.target.value);
        onChange(splitList(e.target.value));
      }}
    />
  );
}
