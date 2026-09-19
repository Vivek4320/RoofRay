'use client';

export default function BotpressProvider() {
  // Botpress is loaded directly in app/layout.tsx so the official
  // blocking inject script always runs before the deferred config script.
  return null;
}
