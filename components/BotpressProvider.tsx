'use client';

import Script from "next/script";

declare global {
  interface Window {
    botpress?: {
      open?: () => void;
      close?: () => void;
      sendEvent?: (event: unknown) => void;
      sendMessage?: (message: string) => void;
      on?: (event: string, handler: (...args: unknown[]) => void) => (() => void) | void;
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
          // The config script initializes window.botpress. Keep this event
          // available to the rest of RoofRay so buttons can open the chat
          // after Webchat has finished initializing.
          window.dispatchEvent(new CustomEvent("roofray_botpress_ready"));
        }}
      />
    </>
  );
}
