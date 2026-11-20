import type { Metadata, Viewport } from "next";
import RegisterAppWorker from "@/components/register-app-worker";
import "./globals.css";
export const viewport: Viewport = { themeColor: "#12362d" };

export const metadata: Metadata = {
  title: "PriceRadar AI | 다음 달 장바구니를 미리 읽다",
  icons: {
    icon: { url: "/icons/app-192.png", sizes: "192x192", type: "image/png" },
    apple: { url: "/icons/apple-touch.png", sizes: "180x180", type: "image/png" },
  },
  appleWebApp: { capable: true, title: "물가레이더", statusBarStyle: "default" },
  description:
    "KAMIS 소매가격과 AI 예측으로 선택한 달의 식자재 지출을 계산하고 작년 같은 달과 비교합니다.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
      </head>
      <body>
        {children}
        <RegisterAppWorker />
      </body>
    </html>
  );
}
