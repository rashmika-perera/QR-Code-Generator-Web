import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QR Studio — Professional QR Code Generator",
  description:
    "Generate beautiful, customizable QR codes for URLs, text, email, phone, SMS, Wi-Fi, vCard, location and events. Download PNG or SVG instantly.",
  keywords: "QR code generator, QR studio, free QR code, custom QR code, WiFi QR, vCard QR",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0A0C1E" />
      </head>
      <body>{children}</body>
    </html>
  );
}
