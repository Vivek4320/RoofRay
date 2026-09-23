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
        {/* Botpress must register the initialized listener BEFORE the config script calls window.botpress.init. */}
        <script src="https://cdn.botpress.cloud/webchat/v3.7/inject.js"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (window.botpress) {
                window.botpress.on('webchat:initialized', function () {
                  console.log('[RoofRay] Botpress initialized');
                });
                window.botpress.on('webchat:opened', function () {
                  const accessToken = window.localStorage.getItem('roofray_access_token');
                  const isLoggedIn = Boolean(accessToken);

                  if (!isLoggedIn) {
                    // Close the Botpress widget immediately and send the user
                    // through RoofRay login before allowing chat access.
                    window.botpress.close?.();
                    window.sessionStorage.setItem('roofray_pending_chat', 'true');

                    // Avoid redirecting repeatedly if the user is already on login.
                    if (window.location.pathname !== '/login') {
                      window.location.href = '/login?redirect=/';
                    }
                    return;
                  }

                  console.log('[RoofRay] Botpress opened for authenticated user');
                });
                window.botpress.on('error', function (error) {
                  console.error('[RoofRay] Botpress error', error);
                });
              }
            `,
          }}
        />
        <script
          src="https://files.bpcontent.cloud/2026/07/12/16/20260712163416-V9EJYWEN.js"
          defer
        />
        {children}
        <RoofRayChat />
      </body>
    </html>
  );
}
