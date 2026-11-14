export type Page = 'dashboard' | 'basket' | 'news' | 'outlook' | 'model';
export interface Product { id:string; name:string; category:string; unit:string; price:number; forecast:number; change:number; emoji:string; spec:string; grade:string; region:string; reference_date:string; reason:string; lower:number; upper:number; default_quantity:number; source:string; mode:string; }
export interface BasketItem { product_id:string; quantity:number; current_price:number; }
export interface News { id:string; title:string; summary:string; publisher:string; published_at:string; product_ids:string[]; event:string; direction:string; strength:string; lag_days:number; tag:string; original_url:string|null; mode:string; }
export interface Observation {date:string; price:number}
export interface Dataset {mode:string; reference_date:string; products:Product[]; history:Record<string,Observation[]>; news:News[]; indicators:{name:string;value:string;unit:string;change:string;direction:string}[];}
export interface Totals {current:number; future:number; difference:number; change:number; lower:number; upper:number;}
export interface ModelMetrics {status:string;data_mode?:string;models:Record<string,{MAE:number;RMSE:number;MAPE:number;count:number}>;rows?:number;period?:string;news_improvement_mape?:number;feature_importance?:Record<string,number>;backtest?:{date:string;actual:number;predicted:number;product_id:string}[];}
