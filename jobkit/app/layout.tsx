import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// 폰트는 저장소의 로컬 파일만 사용 (외부 CDN 금지)
const kr = localFont({
  src: [
    { path: '../assets/fonts/NotoSansKR-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../assets/fonts/NotoSansKR-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-kr',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: 'jobkit',
  description: '구직 서류 자동 생성',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={kr.variable}>
      <head>
        <meta name="robots" content="noindex, nofollow, noarchive" />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
