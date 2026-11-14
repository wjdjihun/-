import raw from "./demo.json";
import type { BasketItem, Dataset } from "@/types";
export const demo = raw as Dataset;
// TODO[APP-01] [D] 루트 .env의 NEXT_PUBLIC_API_URL을 FastAPI 주소로 설정하고 프론트엔드를 재빌드하세요.
// API 주소만 공개 설정에 넣습니다. 외부 API 키는 프로젝트 루트 .env에 보관하고 서버에서만 읽습니다.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(
  /\/$/,
  "",
);
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`API 요청 실패 (${response.status})`);
  return response.json();
}
export async function loadData(): Promise<Dataset> {
  if (!API_URL) return demo;
  const [products, news, health] = await Promise.all([
    request<Dataset["products"]>("/api/products"),
    request<Dataset["news"]>("/api/news"),
    request<{ reference_date: string; mode: string }>("/api/health"),
  ]);
  const observations = await Promise.all(
    products.map(
      async (p) =>
        [
          p.id,
          await request<Dataset["history"][string]>(
            `/api/products/${p.id}/history`,
          ),
        ] as const,
    ),
  );
  return {
    products,
    news,
    history: Object.fromEntries(observations),
    mode: health.mode,
    reference_date: health.reference_date,
    // TODO[APP-02] [A/D] 실제 모드의 상단 경제지표는 아직 미연결입니다. 공식 지표 응답과 화면을 연결하세요.
    indicators: health.mode === "demo" ? demo.indicators : [],
  };
}
export const saveBasketAPI = (items: BasketItem[]) =>
  request("/api/basket", { method: "POST", body: JSON.stringify({ items }) });
export const getBasketAPI = () =>
  request<{ items: BasketItem[] }>("/api/basket");
