'use client';

import Script from "next/script";

const BOTPRESS_WEBCHAT_ID = process.env.NEXT_PUBLIC_BOTPRESS_WEBCHAT_ID;

export default function BotpressProvider() {
  if (!BOTPRESS_WEBCHAT_ID) {
    return null;
  }

  return (
    <Script
      id="roofray-botpress-webchat"
      src="https://cdn.botpress.cloud/webchat/v3.6/inject.js"
      strategy="afterInteractive"
      onLoad={() => {
        // The Botpress embed exposes its Webchat client globally. The
        // location bridge in lib/botpress.ts consumes that client.
        window.dispatchEvent(new CustomEvent("roofray_botpress_ready"));
      }}
    />
  );
}
