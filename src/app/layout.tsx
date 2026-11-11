import type { Metadata } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "@/styles/globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { appOrigin } from "@/lib/http/requestOrigin";

export const metadata: Metadata = {
  // appOrigin() validates APP_BASE_URL; an invalid value must not crash every page.
  metadataBase: new URL(appOrigin() ?? "http://localhost:3000"),
  title: {
    default: "DengueWatch",
    template: "%s | DengueWatch",
  },
  description:
    "Platform komunitas untuk pelaporan lingkungan dan tindak lanjut pencegahan dengue yang terverifikasi.",
  icons: {
    icon: [
      { url: "/brand/logo-mark.png", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/brand/logo-mark.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "DengueWatch",
    description:
      "Platform komunitas untuk pelaporan lingkungan dan tindak lanjut pencegahan dengue yang terverifikasi.",
    images: [
      {
        url: "/brand/logo.png",
        width: 1001,
        height: 254,
        alt: "DengueWatch",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="id">
      <body>
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
