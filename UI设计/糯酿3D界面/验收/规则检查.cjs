const fs=require('node:fs');const vm=require('node:vm');const assert=require('node:assert/strict');const path=require('node:path');
const elements=new Map();const classList={add(){},remove(){},toggle(){}};
function element(){return{innerHTML:'',textContent:'',hidden:false,style:{},classList,dataset:{},open:false,getAttribute(){return ''},setAttribute(){},querySelector(){return{focus(){}}},focus(){},close(){this.open=false},showModal(){this.open=true},addEventListener(){}};}
const context=vm.createContext({console,URL,Blob,setTimeout:()=>1,clearTimeout(){},document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},body:{classList},querySelector:()=>element(),querySelectorAll:()=>[],addEventListener(){},activeElement:{tagName:'BODY',isConnected:false}}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),context);
const run=code=>vm.runInContext(code,context);let passed=0;
function check(name,code){run('reset();');run(code);passed++;console.log('通过：'+name);}
context.assert=assert;
check('开局与售价来自文档',`assert.equal(s.money,160);assert.equal(s.reputation,15);assert.equal(s.stock,4);assert.equal(price(),15);s.tier='让利';assert.equal(price(),12);s.tier='讲究';assert.equal(price(),18);`);
check('火候正好、夹生、焦糊、低收火与混合瑕疵',`draft=[.45,.55,.5];assert.equal(preview().good,true);draft=[0,.55,.5];assert.equal(preview().hard,true);draft=[.45,.55,1];assert.equal(preview().scorch,true);draft=[.45,.55,0];assert.equal(preview().sticky,true);assert.equal(preview().hard,false);draft=[0,1,.5];assert.equal(preview().hard,true);assert.equal(preview().scorch,true);`);
check('目标带边界是合格的',`draft=[.33,.43,.38];assert.equal(preview().good,true);draft=[.57,.67,.62];assert.equal(preview().good,true);`);
check('搅缸不能重复领点',`action('stir',{});assert.equal(s.art,1);action('stir',{});assert.equal(s.art,1);assert.equal(s.stirred,true);`);
check('未确认退出蒸甑，不消耗工时',`view='steam';s.Bpath='米酒';draft=[1,0,0];action('home',{});assert.equal(s.Bphase,'waiting');assert.equal(s.time,0);assert.equal(s.art,0);assert.equal(s.Bdefects.length,0);`);
check('亲手蒸合格批次，确认一次生效',`s.Bpath='米酒';draft=[.45,.55,.5];startSteam(true);assert.equal(s.art,2);assert.equal(s.handmade,true);assert.equal(s.Btimer,1);startSteam(true);assert.equal(s.art,2);advance();assert.equal(s.Bphase,'cool');`);
check('人手蒸不获得亲手加成',`s.Bpath='米酒';draft=[0,1,1];startSteam(false);assert.equal(s.handmade,false);assert.equal(s.art,0);assert.equal(s.Bdefects.length,0);`);
check('没有人手不能亲手蒸',`s.roles.阿禾='曲案';s.Bpath='米酒';startSteam(true);assert.equal(s.Bphase,'waiting');assert.equal(s.art,0);`);
check('上架回收与库存守恒',`for(let i=0;i<5;i++)action('shelf',{});assert.equal(s.shelf,4);assert.equal(s.stock,0);action('unshelf',{});assert.equal(s.stock,1);assert.equal(s.shelf,3);assert.equal(s.stock+s.shelf+s.sales.length,4);`);
check('完整首日：搅缸、掌火、两瓶成交、收工不重复扣钱',`action('stir',{});s.Bpath='米酒';draft=[.45,.55,.5];startSteam(true);action('shelf',{});action('shelf',{});let safety=0;while(!s.closed&&safety++<40)advance(true);assert.equal(s.sales.length,2);assert.equal(s.money,182);assert.equal(s.reputation,17);assert.equal(s.art,3);assert.equal(s.stock,2);assert.equal(s.shelf,0);assert.equal(s.missed,false);assert.equal(s.closed,true);settle();showBill();assert.equal(s.money,182);`);
check('讲究档让街坊离开，日结收入为零',`action('shelf',{});s.tier='讲究';advance();assert.equal(s.sales.length,0);assert.equal(s.left[0].reason,'标价不合');let n=0;while(!s.closed&&n++<40)advance(true);assert.equal(s.money,152);assert.equal(s.stock+s.shelf,4);`);
check('错过窗口仍然发酵，成色降十二',`advance();assert.equal(s.missed,true);assert.equal(s.Aphase,'ferment');assert.equal(s.Aquality,78);action('stir',{});assert.equal(s.art,0);`);
check('换岗下个整点生效，柜无人时再等一个工时',`s.pending.阿青='水田';action('shelf',{});advance();assert.equal(s.roles.阿青,'水田');assert.equal(s.waitingGuests.length,1);assert.equal(s.left.length,0);advance();assert.equal(s.waitingGuests.length,0);assert.equal(s.left[0].reason,'柜上没有人');`);
check('柜无人时回岗可完成等待中的买卖',`s.pending.阿青='水田';action('shelf',{});advance();s.pending.阿青='前柜';advance();assert.equal(s.sales.length,1);assert.equal(s.money,175);assert.equal(s.left.length,0);`);
console.log('合计 '+passed+' 项通过。');
