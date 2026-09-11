import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import TopNav from "@/components/top-nav";
import "./globals.css";

const sans = Public_Sans({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
  variable: "--font-archivo",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hộ chiếu Việt Nam đi đâu?",
  description:
    "Bản đồ chính sách nhập cảnh cho hộ chiếu phổ thông Việt Nam — 176 quốc gia và vùng lãnh thổ, tô màu theo mức thủ tục phải làm trước chuyến đi.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className={`${sans.variable} ${archivo.variable} ${mono.variable}`}>
        <TopNav />
        {children}
        <p className="site-credit">© 2026 Vuvgo.com</p>
      </body>
    </html>
  );
}
