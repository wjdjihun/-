import raw from "./demo.json";
import type { BasketItem, Dataset } from "@/types";
export const demo = raw as Dataset;
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
    indicators: health.mode === "demo" ? demo.indicators : [],
  };
}
export const saveBasketAPI = (items: BasketItem[]) =>
  request("/api/basket", { method: "POST", body: JSON.stringify({ items }) });
export const getBasketAPI = () =>
  request<{ items: BasketItem[] }>("/api/basket");
