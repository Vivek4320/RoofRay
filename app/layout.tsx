import type { Metadata } from 'next';
import { Outfit, Plus_Jakarta_Sans, DM_Mono } from 'next/font/google';
// TypeScript: allow side-effect global CSS import without explicit type declarations
// @ts-ignore
import './globals.css';
import RoofRayChat from '@/components/RoofRayChat';

const outfit = Outfit({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const jakarta = Plus_Jakarta_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const dmMono = DM_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'RoofRay — Is Your Roof Worth Going Solar?',
  description:
    'AI-powered rooftop analysis using your location and sunlight data to calculate real solar savings.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${jakarta.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-white focus:shadow-lg">
          Skip to content
        </a>
        {children}
        <RoofRayChat />
      </body>
    </html>
  );
}
