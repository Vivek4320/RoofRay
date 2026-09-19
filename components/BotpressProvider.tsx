'use client';

import Script from "next/script";

declare global {
  interface Window {
    botpress?: {
      open?: () => void;
      close?: () => void;
      sendEvent?: (event: unknown) => void;
      sendMessage?: (message: unknown) => void;
    };
    botpressWebChat?: {
      open?: () => void;
      close?: () => void;
      sendEvent?: (event: unknown) => void;
      sendMessage?: (message: unknown) => void;
      init?: (config: Record<string, unknown>) => void;
    };
  }
}

export default function BotpressProvider() {
  return (
    <>
      <Script
        id="roofray-botpress-v37"
        src="https://cdn.botpress.cloud/webchat/v3.7/inject.js"
        strategy="afterInteractive"
      />

      <Script
        id="roofray-botpress-config"
        src="https://files.bpcontent.cloud/2026/07/12/16/20260712163416-V9EJYWEN.js"
        strategy="afterInteractive"
        onLoad={() => {
          window.dispatchEvent(new CustomEvent("roofray_botpress_ready"));
        }}
      />
    </>
  );
}
