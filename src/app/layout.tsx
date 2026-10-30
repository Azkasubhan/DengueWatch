import type { Metadata } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "DengueWatch",
    template: "%s | DengueWatch",
  },
  description:
    "Platform komunitas untuk pelaporan lingkungan dan tindak lanjut pencegahan dengue yang terverifikasi.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="id">
      <body>{children}</body>
    </html>
  );
}
