import type {Metadata} from 'next';
import './globals.css';
export const metadata: Metadata={title:'PriceRadar AI | 다음 달 장바구니를 미리 읽다',description:'똑같은 장바구니, 달라지는 생활비. 경제뉴스와 가격 흐름으로 살펴보는 미래 생활비 예측 서비스. 데모 데이터로 체험하세요.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ko"><body>{children}</body></html>}
