import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../lib/basket.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {totals,defaultBasket,predictedPrice,parseBasket}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const {products}=JSON.parse(readFileSync(new URL('../lib/demo.json',import.meta.url),'utf8'));
test('기본 장바구니는 각 단가 × 고정 수량의 합과 일치한다',()=>{
 const items=defaultBasket(products), result=totals(items,products);
 assert.equal(result.current,124000);
 assert.equal(result.future,products.reduce((s,p)=>s+p.forecast*p.default_quantity,0));
 assert.equal(result.difference,result.future-result.current);
 assert.ok(result.lower<=result.future && result.upper>=result.future);
});
test('수량 네 배는 현재·미래 비용과 범위를 정확히 네 배로 바꾼다',()=>{
 const item={product_id:'eggs',quantity:1,current_price:7000};
 const first=totals([item],products),fourth=totals([{...item,quantity:4}],products);
 for(const k of ['current','future','lower','upper'])assert.equal(fourth[k],first[k]*4);
 assert.equal(first.change,fourth.change);
});
test('직접 입력한 단가에는 원래 시연 예측 비율을 적용해 원 단위 반올림한다',()=>{
 const p=products.find(p=>p.id==='cabbage');
 assert.equal(predictedPrice(p,5000),Math.round(5000*p.forecast/p.price));
});
test('빈 장바구니는 0 비용과 0 변동률을 반환한다',()=>{
 assert.deepEqual(totals([],products),{current:0,future:0,difference:0,change:0,lower:0,upper:0});
});
test('저장소의 잘못된 품목·중복·음수·소수 수량을 거부한다',()=>{
 const item={product_id:'rice',quantity:1,current_price:32900};
 assert.deepEqual(parseBasket([item],products),[item]);
 for(const bad of [[item,item],[{...item,quantity:-1}],[{...item,quantity:1.5}],[{...item,product_id:'unknown'}],[{...item,current_price:0}],{}])assert.equal(parseBasket(bad,products),null);
});
