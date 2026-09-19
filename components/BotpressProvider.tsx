'use client';

import Script from "next/script";

const BOTPRESS_INJECT_URL =
  "https://cdn.botpress.cloud/webchat/v3.7/inject.js";
const BOTPRESS_CONFIG_URL =
  "https://files.bpcontent.cloud/2026/07/12/16/20260712163416-V9EJYWEN.js";

export default function BotpressProvider() {
  return (
    <>
      <Script
        src={BOTPRESS_INJECT_URL}
        strategy="afterInteractive"
      />
      <Script
        src={BOTPRESS_CONFIG_URL}
        strategy="afterInteractive"
      />
    </>
  );
}
