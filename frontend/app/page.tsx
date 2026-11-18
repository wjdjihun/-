import ObservedPrices from "@/components/observed-prices";
import PriceRadar from "@/components/price-radar";
import { API_URL } from "@/lib/api";

export default function Home() {
  return API_URL ? <PriceRadar /> : <ObservedPrices />;
}
