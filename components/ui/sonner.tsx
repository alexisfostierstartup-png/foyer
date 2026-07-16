"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // top-right : en bas à gauche les toasts (surtout les erreurs) passaient
      // inaperçus — coin mort de l'écran (retour Alexis 2026-07-16).
      position="top-right"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
          // Erreurs : rouge franc + plus grand — sinon elles se fondent dans le
          // même style neutre que les autres toasts et passent inaperçues.
          error: "!bg-red-600 !text-white !border-red-700 !text-[15px] !py-4 [&_[data-icon]]:!text-white",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
