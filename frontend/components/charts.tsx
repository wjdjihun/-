'use client';
import {useId} from 'react';
import {ResponsiveContainer,ComposedChart,CartesianGrid,XAxis,YAxis,Tooltip,Area,Line,ReferenceLine,BarChart,Bar,Cell} from 'recharts';
import type {BasketItem, Dataset, Product, ModelMetrics} from '@/types';
import {totals} from '@/lib/basket';
import {won,dateLabel} from '@/lib/utils';
interface ChartPoint {date:string;actual?:number;projected?:number;band?:number[];}
export function ForecastChart({data,items,product,days=30}:{data:Dataset;items:BasketItem[];product?:Product;days?:number}){
 const id=useId().replaceAll(':','');
 const date=data.reference_date;
 const points:ChartPoint[]=[];
 const summary=totals(items,data.products);
 const current=product?product.price:summary.current;
 const future=product?product.forecast:summary.future;
 const lower=product?product.lower:summary.lower;
 const upper=product?product.upper:summary.upper;
 const dates=(product?data.history[product.id]:data.history[data.products[0]?.id])||[];
 const selected=dates.slice(product?0:-8);
 for(const [i,o] of selected.entries()){
 let price=0;
 if(product)price=o.price;
 else for(const item of items){const p=data.products.find(p=>p.id===item.product_id);const h=data.history[item.product_id]?.find(v=>v.date===o.date);if(p&&h)price+=Math.round(h.price/p.price*item.current_price)*item.quantity;}
 points.push({date:o.date,actual:i===selected.length-1?current:price,...(i===selected.length-1?{projected:current,band:[current,current]}:{})});
 }
 for(let d=product?3:2;d<=days;d+=product?3:2){const dt=new Date(date+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()+d);const t=d/30;
 points.push({date:dt.toISOString().slice(0,10),projected:Math.round(current+(future-current)*t),band:[Math.round(current+(lower-current)*t),Math.round(current+(upper-current)*t)]});}
 return <div className="forecast-chart" role="img" aria-label={`${product?.name||'장바구니'} 가격 그래프. 현재 ${won(current)}원, 30일 후 시연 예상 ${won(future)}원. 범위 ${won(lower)}원부터 ${won(upper)}원.`}>
 <ResponsiveContainer width="100%" height="100%" minWidth={0}>
 <ComposedChart data={points} margin={{top:24,right:20,left:product?0:12,bottom:5}}>
 <defs><linearGradient id={`chart-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3168ef" stopOpacity={.16}/><stop offset="100%" stopColor="#3168ef" stopOpacity={.035}/></linearGradient></defs>
 <CartesianGrid stroke="#e9edf4" vertical={false} strokeDasharray="3 4"/>
 <XAxis dataKey="date" axisLine={false} tickLine={false} minTickGap={45} tick={{fill:'#8a95a8',fontSize:11}} tickFormatter={dateLabel} dy={10}/>
 <YAxis domain={['auto','auto']} axisLine={false} tickLine={false} tick={{fill:'#8a95a8',fontSize:11}} width={65} tickFormatter={v=>won(v)} tickCount={5}/>
 <Tooltip labelFormatter={v=>`${v} · ${String(v)>date?(data.mode==='demo'?'시연 예측':'모델 예측'):(data.mode==='demo'?'합성 관측값':'실제 관측값')}`} formatter={(v,name)=>[Array.isArray(v)?`${won(Number(v[0]))} ~ ${won(Number(v[1]))}원`:`${won(Number(v))}원`,name==='band'?'예측 범위':name==='actual'?'관측 가격':'예측 가격']} contentStyle={{border:'1px solid #e9edf4',borderRadius:12,fontSize:12,boxShadow:'0 8px 25px #18345910'}}/>
 <ReferenceLine x={date} stroke="#aebad0" strokeDasharray="4 4" label={{value:'예측 시작',position:'insideTopRight',fill:'#8a95a8',fontSize:11}}/>
 <Area dataKey="band" type="monotone" stroke="none" fill={`url(#chart-${id})`} isAnimationActive={false}/>
 <Line dataKey="actual" type="monotone" stroke="#3067e9" strokeWidth={2.6} dot={false} isAnimationActive={false}/>
 <Line dataKey="projected" type="monotone" stroke="#3067e9" strokeWidth={2.6} strokeDasharray="5 4" dot={false} isAnimationActive={false}/>
 </ComposedChart></ResponsiveContainer></div>;
}
export function NewsVolumeChart({data}:{data:Dataset}){
 const values=data.products.map(p=>({name:p.name,count:data.news.filter(n=>n.product_ids.includes(p.id)).length})).filter(p=>p.count);
 return <div className="volume-chart" role="img" aria-label="품목별 예시 뉴스 언급량"><ResponsiveContainer width="100%" height="100%"><BarChart data={values} margin={{top:12,right:10,left:-25,bottom:0}}><CartesianGrid vertical={false} stroke="#edf0f6"/><XAxis dataKey="name" tick={{fontSize:11,fill:'#7b879b'}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fontSize:11,fill:'#7b879b'}} axisLine={false} tickLine={false}/><Tooltip formatter={v=>[`${v}건`,'예시 기사 수']}/><Bar dataKey="count" radius={[5,5,0,0]} maxBarSize={36}>{values.map((_,i)=><Cell key={i} fill={i%2?'#adc5ff':'#4d7df2'}/>)}</Bar></BarChart></ResponsiveContainer></div>;
}
export function BacktestChart({points}:{points:NonNullable<ModelMetrics['backtest']>}){
 return <div className="forecast-chart" role="img" aria-label="테스트 기간의 실제 가격과 모델 예측 가격 비교"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={points} margin={{top:20,right:25,left:10,bottom:10}}><CartesianGrid vertical={false} stroke="#edf0f6"/><XAxis dataKey="date" tickFormatter={dateLabel} tick={{fontSize:10,fill:'#91a0b6'}} minTickGap={45} tickLine={false} axisLine={false}/><YAxis domain={['auto','auto']} tickFormatter={v=>won(v)} tick={{fontSize:10,fill:'#91a0b6'}} width={65} tickLine={false} axisLine={false}/><Tooltip formatter={(v,name)=>[`${won(Number(v))}원`,name==='actual'?'실제 가격':'예측 가격']}/><Line dataKey="actual" stroke="#3068ee" strokeWidth={2} dot={false} isAnimationActive={false}/><Line dataKey="predicted" stroke="#7dbba2" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false}/></ComposedChart></ResponsiveContainer></div>;
}
