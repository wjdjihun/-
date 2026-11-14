import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const won = (n: number) =>
  new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(n);
export const percent = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
export const dateLabel = (s: string) => s.slice(5).replace("-", ".");
