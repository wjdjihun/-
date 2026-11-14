import type { BasketItem, Product, Totals } from "@/types";
export function defaultBasket(products: Product[]): BasketItem[] {
  return products.map((p) => ({
    product_id: p.id,
    quantity: p.default_quantity,
    current_price: p.price,
  }));
}
export function predictedPrice(p: Product, current: number) {
  return Math.round((current * p.forecast) / p.price);
}
export function totals(items: BasketItem[], products: Product[]): Totals {
  let current = 0,
    future = 0,
    lower = 0,
    upper = 0;
  for (const item of items) {
    const p = products.find((p) => p.id === item.product_id);
    if (!p) continue;
    current += item.current_price * item.quantity;
    future += predictedPrice(p, item.current_price) * item.quantity;
    lower +=
      Math.round((item.current_price * p.lower) / p.price) * item.quantity;
    upper +=
      Math.round((item.current_price * p.upper) / p.price) * item.quantity;
  }
  return {
    current,
    future,
    difference: future - current,
    change: current ? ((future - current) / current) * 100 : 0,
    lower,
    upper,
  };
}
export function parseBasket(
  value: unknown,
  products: Product[],
): BasketItem[] | null {
  if (!Array.isArray(value) || value.length > products.length) return null;
  const seen = new Set<string>();
  for (const v of value) {
    if (
      !v ||
      !products.some((p) => p.id === v.product_id) ||
      seen.has(v.product_id) ||
      !Number.isInteger(v.quantity) ||
      v.quantity < 1 ||
      v.quantity > 999 ||
      !Number.isInteger(v.current_price) ||
      v.current_price < 1 ||
      v.current_price > 10000000
    )
      return null;
    seen.add(v.product_id);
  }
  return value;
}
