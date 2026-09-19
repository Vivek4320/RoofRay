'use client';

import Script from "next/script";

const BOTPRESS_WEBCHAT_ID = process.env.NEXT_PUBLIC_BOTPRESS_WEBCHAT_ID;

declare global {
  interface Window {
    botpressWebChat?: {
      init?: (config: Record<string, unknown>) => void;
    };
  }
}

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
        if (window.botpressWebChat?.init) {
          window.botpressWebChat.init({
            botId: BOTPRESS_WEBCHAT_ID,
          });
        }

        window.dispatchEvent(new CustomEvent("roofray_botpress_ready"));
      }}
    />
  );
}
