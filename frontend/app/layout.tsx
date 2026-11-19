import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "PriceRadar AI | 다음 달 장바구니를 미리 읽다",
  description:
    "KAMIS 소매가격과 AI 예측으로 선택한 달의 식자재 지출을 계산하고 작년 같은 달과 비교합니다.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
