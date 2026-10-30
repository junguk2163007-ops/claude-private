'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const LINKS = [
  { href: '/apply', label: '지원서 작성' },
  { href: '/history', label: '지원 이력' },
  { href: '/profile', label: '프로필·문구' },
  { href: '/settings', label: '설정' },
];

export default function Nav() {
  const path = usePathname();
  const router = useRouter();
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-[1600px] items-center gap-8 px-6 py-3">
        <Link href="/apply" className="text-lg font-bold text-[#1F4E79]">
          jobkit
        </Link>
        <nav className="flex gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded px-3 py-1.5 text-sm ${path?.startsWith(l.href) ? 'bg-[#1F4E79] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <button onClick={logout} className="ml-auto text-sm text-gray-500 hover:text-gray-900">
          로그아웃
        </button>
      </div>
    </header>
  );
}
