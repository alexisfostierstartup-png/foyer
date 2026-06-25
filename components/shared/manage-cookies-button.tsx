"use client";

import type { ReactNode } from "react";

type AxeptioSDK = {
  openCookies?: () => void;
  requestConsent?: () => void;
};

declare global {
  interface Window {
    axeptio?: AxeptioSDK;
    _axcb?: Array<(sdk: AxeptioSDK) => void>;
  }
}

/** Rouvre la fenêtre de consentement Axeptio, que le SDK soit déjà prêt ou non. */
function openAxeptioWidget() {
  if (typeof window === "undefined") return;

  const reopen = (sdk: AxeptioSDK) => {
    if (typeof sdk.openCookies === "function") sdk.openCookies();
    else if (typeof sdk.requestConsent === "function") sdk.requestConsent();
  };

  if (window.axeptio) {
    reopen(window.axeptio);
  } else {
    // Le SDK n'est pas encore chargé : on s'enregistre dans la file _axcb.
    window._axcb = window._axcb || [];
    window._axcb.push((sdk) => reopen(sdk));
  }
}

export function ManageCookiesButton({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button type="button" onClick={openAxeptioWidget} className={className}>
      {children ?? "Gérer mes cookies"}
    </button>
  );
}
