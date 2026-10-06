import React from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ModalProvider } from "@/contexts/ModalContext";
import SlaHeartbeat from "@/components/sla/SlaHeartbeat";

export const metadata: Metadata = {
  title: "Localend - Futuristic Community Platform",
  description: "Hyperlocal Community Help & Favor Exchange Platform",
  openGraph: {
    title: "Localend - Community Help",
    description: "Hyperlocal Community Help & Favor Exchange Platform",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#f8fafc] text-slate-900">
        <AuthProvider>
          <ModalProvider>
            <SlaHeartbeat />
            {children}
          </ModalProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
