import type { Metadata, Viewport } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "MediCool Box | Smart Cold Chain",
  description: "ระบบติดตามอุณหภูมิและตำแหน่งกล่องขนส่งสิ่งส่งตรวจแบบเรียลไทม์",
  applicationName: "MediCool Box",
  manifest: `${basePath}/manifest.webmanifest`,
};

export const viewport: Viewport = { themeColor: "#075b68", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
