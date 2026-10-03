'use strict';
const $=id=>document.getElementById(id);
const icons={home:'M3 11 12 3l9 8M5 10v11h14V10M9 21v-8h6v8',book:'M12 5v16M3 4q6-2 9 1 3-3 9-1v16q-6-2-9 1-3-3-9-1Z',jar:'M8 3h8M8 6h8M7 6c0 3-4 4-4 9 0 5 3 6 9 6s9-1 9-6c0-5-4-6-4-9M4 13h16M8 17h8',lamp:'M12 2v3M6 5h12l3 12H3ZM9 17v4h6v-4M12 7v8',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M10 2h4l1 3 3 1 3-1 2 4-2 3v3l2 2-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-2v-3L1 9l2-4 3 1 3-1Z',leaf:'M4 20C2 9 8 3 21 3c0 14-7 19-17 17ZM4 20 16 8',sun:'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2',steam:'M4 15h16v5H4ZM7 12c-4-3 4-5 0-8M12 12c-4-3 4-5 0-8M17 12c-4-3 4-5 0-8',coin:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M9 9h6v6H9Z',grain:'M12 22V3M12 9C5 9 5 4 5 4c7 0 7 5 7 5ZM12 15C5 15 5 10 5 10c7 0 7 5 7 5ZM12 12c7 0 7-5 7-5-7 0-7 5-7 5Z',arrow:'M4 12h16M14 6l6 6-6 6',stir:'M6 5 17 16M4 14c0 5 16 5 16 0M4 13v5c0 5 16 5 16 0v-5',hand:'M8 12V5a2 2 0 0 1 4 0v7-8a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v9c0 6-10 8-13 4l-5-6c-2-3 1-5 3-2l3 3'};
function icon(name){return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[name]||icons.jar}"/></svg>`}
const titles=['今日','米与酒','酒谱','人手','本季','器物'];
const stations=[['水田','三块田 · 白糯灌浆'],['浸缸','淘浸 · 每批 2 工时'],['蒸甑','亲手掌三段火候'],['摊席','摊凉 · 雨天收至檐下'],['曲案','人手拌曲 · 每批 1 份'],['发酵房','看缸 · 到点搅一下'],['压榨','人手压榨 · 每批 2 工时'],['澄清槽','清酒专用 · 2 级开放'],['酒窖','一批占一个窖位'],['调配案','桂花酿 · 3 级开放'],['前柜','有人站柜才能成交']];
let s,view='home',drawerPage=null,selectedStation='',toastTimer,previousFocus;
const modal=$('modal');
function initial(){return{time:0,money:160,reputation:15,art:0,stock:4,shelf:0,tier:'平价',sales:[],left:[],waitingGuests:[],stirred:false,missed:false,Aphase:'ferment',Aage:2.5,Atimer:0,Aproduct:0,Aquality:90,Bphase:'waiting',Bpath:null,Btimer:0,Bdefects:[],handmade:false,roles:{阿禾:'蒸甑',阿青:'前柜'},pending:{},closed:false,fireEye:false,big:false,motion:false,light:'昼光',goals:[false,false,false],visitedForecast:false};}
function reset(){s=initial();view='home';drawerPage=null;modal.close();document.body.classList.remove('big-text','reduced-motion');render();}
const price=()=>Math.round(14*(.7+.6*.42)*({让利:.85,平价:1,讲究:1.25}[s.tier])*1.1);
const canStir=()=>s.Aphase==='ferment'&&!s.stirred&&s.Aage>=2.5&&s.Aage<3.5&&!s.closed;
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500);}
function phaseB(){return{waiting:s.Bpath?'待掌火':'待选酒路',steam:'正在蒸饭',cool:'正在摊凉',mix_wait:'待人手拌曲',mix:'正在拌曲',ferment_wait:'等发酵缸腾出',ferment:'正在发酵'}[s.Bphase]||s.Bphase;}
function phaseA(){return{ferment:'发酵房',press_wait:'压榨口 · 等人手',press:'正在压榨',cellar:'酒窖短陈',done:'后仓'}[s.Aphase];}
function leftA(){return s.Aphase==='ferment'?Math.ceil(6-s.Aage):Math.ceil(s.Atimer);}
function render(){
 document.body.classList.toggle('big-text',s.big);document.body.classList.toggle('reduced-motion',s.motion);
 $('dayplate').innerHTML=`<b>${icon('sun')} 第 1 日 · ${s.time<5?'晴昼':s.time<6?'傍晚':'入夜'}</b><small>${s.closed?'今日已收工':`第 ${Math.min(8,Math.floor(s.time)+1)} 工时 / 共 8 工时`}　·　距圩日 5 日</small>`;
 $('resources').innerHTML=`<div class="resource secondary" title="声望"><span>${icon('leaf')}</span><b>${s.reputation}</b><small>声望</small></div><div class="resource secondary" title="酿艺点"><span>${icon('grain')}</span><b>${s.art}</b><small>酿艺点</small></div><div class="resource"><span>${icon('coin')}</span><b>${s.money}</b><small>文</small></div>`;
 const scene=view==='steam'?'素材/蒸甑特写.png':view==='ferment'?'素材/看缸特写.png':'素材/酒坊全院.png';
 if($('scene').getAttribute('src')!==scene)$('scene').src=scene;
 $('scene').alt=view==='steam'?'木甑里的糯米饭床与轻薄蒸汽':view==='ferment'?'敞开的深褐陶缸、发酵米粒与木搅棒':'江南酒坊院：三块水田、灶棚、陶缸、前柜与河埠';
 $('scene').style.filter=s.light==='灯下'||s.time>=6?'brightness(.77) sepia(.13) saturate(.86)':s.light==='暮色'||s.time>=5?'brightness(.87) sepia(.14)':'none';
 $('nav-home').classList.toggle('selected',view==='home'&&!drawerPage);
 $('back').hidden=view==='home';document.querySelector('.rail').hidden=view!=='home';
 $('view-caption').textContent={home:'水乡微光 · 暖坛',steam:'一甑米，火候由你定',ferment:'缸沿亮了，搅一下',counter:'前柜 · 把自家的酒递给街坊',station:`酒坊 · ${selectedStation}`}[view];
 renderPoints();renderAttention();renderDetail();
 const dots=Array.from({length:8},(_,i)=>`<span class="${i<s.time?'done':''}"></span>`).join('');
 $('time-control').innerHTML=`<div><div class="time-dots" aria-hidden="true">${dots}</div><small>${s.closed?'开销已结清':`已过 ${Number(s.time.toFixed(1))} / 8 工时 · 按推进才走`}</small></div><button class="quiet" data-action="close-day">${s.closed?'查看日结':'收工'}</button><button class="primary" data-action="advance" ${s.closed||view==='steam'?'disabled':''}>推进 ${icon('arrow')}<small>空格</small></button>`;
 if(drawerPage)renderDrawer();
 document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
}
function renderPoints(){
 if(view!=='home'){$('world-points').innerHTML='';return;}
 const apos=s.Aphase==='ferment'?{x:22,y:39,title:'发酵房',symbol:'缸'}:s.Aphase==='cellar'?{x:15,y:56,title:'酒窖',symbol:'窖'}:s.Aphase==='done'?{x:37,y:71,title:'后仓',symbol:'酒'}:{x:34,y:47,title:'压榨',symbol:'榨'};
 const bpos=['waiting','steam'].includes(s.Bphase)?{x:67,y:30,title:'蒸甑',symbol:'甑'}:s.Bphase==='cool'?{x:62,y:55,title:'摊席',symbol:'席'}:['mix_wait','mix'].includes(s.Bphase)?{x:77,y:52,title:'曲案',symbol:'曲'}:{x:22,y:39,title:'发酵房',symbol:'缸'};
 const pts=[{x:31,y:19,title:'壹号田',desc:s.closed?'白糯 · 黄熟，品相优良':'白糯 · 灌浆，今日已照料',action:'station',name:'水田',cls:'minor',symbol:'田'},{...bpos,desc:s.Bphase==='waiting'?(s.Bpath?'批 B · 酒路已选，待掌火':'批 B · 先选酒路'):`批 B · ${phaseB()}`,action:'steam'},{...apos,desc:canStir()?'批 A · 该搅了':s.Aphase!=='ferment'?`批 A · ${phaseA()}`:s.stirred?'批 A · 已搅过':s.missed?'批 A · 误了搅缸':`批 A · ${phaseA()}`,action:'ferment',cls:canStir()?'urgent':''},{x:62,y:55,title:'摊席',desc:s.Bphase==='cool'?'批 B · 正在摊凉':'晴天 · 露天摊凉',action:'station',name:'摊席',cls:'minor',symbol:'席'},{x:37,y:71,title:'前柜',desc:`${Object.keys(s.roles).filter(n=>s.roles[n]==='前柜').join('、')||'暂无人手'}在柜 · ${s.shelf} / 4 展位`,action:'counter',symbol:'柜'}];
 $('world-points').innerHTML=pts.map(p=>`<button class="world-point ${p.cls||''}" style="left:${p.x}%;top:${p.y}%" data-action="${p.action}" data-name="${p.name||''}" aria-label="${p.title}：${p.desc}"><span class="point-circle">${p.symbol}</span><span>${p.title}<small>${p.desc}</small></span></button>`).join('');
}
function renderAttention(){
 let aDesc=s.Aphase!=='ferment'?`在${phaseA()}${leftA()>0?`，还剩 ${leftA()} 工时`:''}`:canStir()?'还剩 1 工时的搅缸机会':s.stirred?'这缸已搅，安心让它酿':s.missed?'错过窗口，酒仍继续酿':`在${phaseA()}，${s.Aphase==='done'?'已装坛':`还剩 ${leftA()} 工时`}`;
 $('attention').innerHTML=`<div class="attention-title">今日要紧的事 <small>壹 / 夏秋</small></div><button class="task-card ${canStir()?'urgent':''}" data-action="ferment"><strong>${icon('stir')} ${canStir()?'这缸该搅了':s.stirred&&s.Aphase==='ferment'?'这缸已照看':'白糯米酒'}</strong><small>批 A · 完美白糯 · 米酒</small><em>${aDesc}</em></button><button class="task-card" data-action="steam"><strong>${icon('steam')} ${s.Bphase==='waiting'?'一批米等你掌火':phaseB()}</strong><small>批 B · 普通白糯 · 2 斗</small><em>${s.Bphase==='waiting'?(canSteam()?(s.Bpath?`${s.Bpath}已选，去掌火 →`:'阿禾在灶边，先定酒路 →'):'蒸甑暂无人手，先派工 →'):`${s.Bpath} · ${phaseB()}`}</em></button><button class="task-card" data-action="counter"><strong>${icon('jar')} ${s.shelf?'酒已上柜':'柜上还空着'}</strong><small>后仓甜酒酿 ${s.stock} 瓶 · 展位 ${s.shelf} 瓶</small><em>${Object.values(s.roles).includes('前柜')?'有人在柜，街坊会来买':'柜上暂时没有人手'} →</em></button><div class="note">${s.closed?'今天的事都收进账册了。':'阿禾：“别急着推进。先看看这一缸。”'}</div>`;
}
let draft=[.45,.55,.50];
function preview(){const hard=draft[0]<.33-1e-8||draft[1]<.43-1e-8;const scorch=draft[0]>.57+1e-8||draft[1]>.67+1e-8||draft[2]>.62+1e-8;const sticky=draft[2]<.38-1e-8;return{hard,scorch,sticky,good:!hard&&!scorch&&!sticky};}
function fireFeedback(){const p=preview();const result=$('fire-result');if(!result)return;const label=p.good?'○ 饭心已透，三段火候正好':[p.hard?'◇ 饭粒仍散，可能夹生':'',p.scorch?'▰ 边缘发硬，可能焦糊':'',p.sticky?'≈ 收火不足，表面回黏':''].filter(Boolean).join('；');result.className='fire-result'+(p.good?'':' warn');result.textContent=label;$('rice-state').hidden=p.good;$('rice-state').className='rice-state'+(p.scorch?' scorch':p.hard?' hard':p.sticky?' sticky':'');draft.forEach((v,i)=>{const el=$('fire-value-'+i);if(el)el.textContent=Math.round(v*100)+'%';});}
function renderDetail(){
 const panel=$('detail');panel.hidden=view==='home';panel.className='detail paper'+(view==='steam'?' steam':'');$('rice-state').hidden=true;
 if(view==='home')return;
 if(view==='steam'){
 if(s.Bphase!=='waiting'){panel.innerHTML=`<div class="detail-head"><div><small>批 B · ${s.Bpath} · 2 斗白糯</small><h2>${phaseB()}</h2></div><span class="pill">${s.handmade?'亲手火候':'已定火候'}</span></div><p class="description">${s.Bphase==='steam'?'火候已经定好，推进 1 工时蒸完。':s.Bphase==='cool'?'米已蒸好，正在摊席上凉下来。':s.Bphase==='mix_wait'?'下一步是拌曲，需把人手派到曲案。':s.Bphase==='ferment_wait'?'这批已拌曲，等发酵房的缸腾出来。':'各站按推进一起做活。'}</p><div class="row"><button class="porcelain" data-action="ledger" data-page="人手">查看人手</button><button class="primary" data-action="home">回到全院</button></div>`;return;}
 if(!s.Bpath){panel.innerHTML=`<div class="detail-head"><div><small>批 B · 白糯 · 普通 · 2 斗</small><h2>这批酿成什么？</h2></div><span class="pill">先选酒路</span></div><p class="description">${canSteam()?'人手已在灶边烧火。选好酒路，再把饭蒸到心里透。':'蒸甑暂无人手。先定酒路，再派人烧火。'}</p><div class="row"><button class="porcelain" data-action="path" data-path="甜酒酿">甜酒酿<small>短发酵 · 装瓶</small></button><button class="porcelain" data-action="path" data-path="米酒">米酒<small>压榨 · 入窖</small></button></div><p class="small-description" style="margin-top:16px">清酒在酒坊 2 级开放，桂花酿在 3 级开放。</p>`;return;}
 panel.innerHTML=`<div class="detail-head"><div><small>批 B · 白糯 · ${s.Bpath} · 2 斗</small><h2>掌这一甑的火</h2></div><span class="pill">特写不走工时</span></div><p class="small-description">拖动三段火候，看饭粒与提示。${s.fireEye?'已学“火候眼”：青色带是合适范围。':'还没学“火候眼”，先看饭的变化。'}</p>${['起火','稳火','收火'].map((name,i)=>`<div class="fire-row"><label for="fire-${i}">${name}</label><div class="fire-track">${s.fireEye?`<span class="target-band" style="left:${[33,43,38][i]}%;width:24%"></span>`:''}<input id="fire-${i}" type="range" min="0" max="1" step="0.05" value="${draft[i]}" aria-label="${name}"></div><span class="fire-value" id="fire-value-${i}"></span></div>`).join('')}<div id="fire-result" role="status" aria-live="polite"></div><div class="row"><button class="porcelain" data-action="change-path">改酒路</button><button class="wood" data-action="delegate" ${!canSteam()?'disabled':''}>交给人手</button><button class="primary" data-action="confirm-steam" ${!canSteam()?'disabled':''}>${icon('hand')} 确认火候</button></div><p class="small-description" style="margin-top:14px">${canSteam()?'确认后才开始蒸；退出保留这批米，不写入火候。':'蒸甑没有人手，请先在账册里派工。'}</p>`;fireFeedback();return;
 }
 if(view==='ferment'){
 const open=canStir();panel.innerHTML=`<div class="detail-head"><div><small>批 A · 完美白糯 · 米酒</small><h2>${open?'缸沿亮了，搅一下':s.stirred?'这一缸，照看过了':s.missed?'误了搅缸，也能继续':'白糯米酒'}</h2></div><span class="pill ${s.missed?'warn':''}">${open?'搅缸窗口':s.stirred?'已搅过':s.missed?'误了搅缸':phaseA()}</span></div><p class="description">${open?'米粒间的气泡密了一点。趁现在搅一次，不用一直守在缸边。':s.stirred?'搅缸提醒已收起。该做的做过，下一站仍要等这缸发酵完成。':s.missed?'这缸会更浊，账册记下了原因。酒不会被倒掉。':`当前在${phaseA()}。${s.Aphase==='press_wait'?'派人去压榨，才能继续。':''}`}</p><div class="row"><button class="porcelain" data-action="home">回到全院</button><button class="wood" data-action="stir" ${!open?'disabled':''}>${icon('stir')} ${open?'搅一下':s.stirred?'已搅过':'窗口已过'}</button></div>`;return;
 }
 if(view==='counter'){
 panel.innerHTML=`<div class="detail-head"><div><small>前柜 · ${Object.keys(s.roles).filter(n=>s.roles[n]==='前柜').join('、')||'暂时无人'}</small><h2>把酒摆给街坊看</h2></div><span class="pill">4 个展位</span></div><div class="slots">${Array.from({length:4},(_,i)=>`<button class="slot ${i<s.shelf?'filled':'empty'}" data-action="${i<s.shelf?'unshelf':'shelf'}" ${s.closed||(i>=s.shelf&&!s.stock)?'disabled':''} aria-label="${i<s.shelf?'收回一瓶甜酒酿':'上架一瓶甜酒酿'}">${icon('jar')}<small>${i<s.shelf?'甜酒酿':'空展位'}</small></button>`).join('')}</div><div class="counter-quantity"><span>后仓：${s.stock} 瓶甜酒酿</span><small>成色 42 · 普通白糯</small></div><div class="price-tiers" aria-label="标价档">${['让利','平价','讲究'].map(t=>`<button class="${s.tier===t?'active':''}" data-action="tier" data-tier="${t}" ${s.closed?'disabled':''}>${t}<small>${Math.round(14*.952*({让利:.85,平价:1,讲究:1.25}[t])*1.1)} 文</small></button>`).join('')}</div><div class="row"><button class="porcelain" data-action="shelf" ${!s.stock||s.shelf>=4||s.closed?'disabled':''}>上架一瓶</button><button class="primary" data-action="advance" ${s.closed?'disabled':''}>推进，等街坊来</button></div><p class="small-description" style="margin-top:14px">${s.tier==='讲究'?'街坊接受让利和平价。讲究档会让他们离开。':'街坊只看展位，后仓里的酒要先摆出来。'}　${s.sales.length?`已成交 ${s.sales.length} 瓶。`:''}</p>`;return;
 }
 const station=stations.find(x=>x[0]===selectedStation);
 const extra={水田:'壹号田处于灌浆，今天已经浇过水。贰、叁号田留待下次播种。明日壹号田黄熟，品相优良。',浸缸:'批 B 浸缸已完成，停在蒸甑前。这一站可接下一批。',摊席:s.Bphase==='cool'?'批 B 正在摊凉。晴天需要 1 工时，凉透后再去曲案。':'现在没有米在摊凉。雨天席会收到檐下。',曲案:'拌曲必须有人手在岗，每批开始时用 1 份家曲。开局有 4 份。',压榨:`批 A ${s.Aphase==='press_wait'?'正在等人手压榨':'还没到压榨口'}。米酒必须经过压榨再入窖。`,澄清槽:'清酒专用，酒坊 2 级开放。米酒不走这一站。',酒窖:`开局 2 个窖位。每批占 1 位，短陈 4 工时，长陈 8 工时。${s.Aphase==='cellar'?'批 A 正在短陈。':''}`,调配案:'酒坊 3 级解锁桂花酿。这一站才加桂花，蒸饭和拌曲不加。'};
 panel.innerHTML=`<div class="detail-head"><div><small>同一进酒坊院</small><h2>${selectedStation}</h2></div><span class="pill">${station?.[1]||''}</span></div><p class="description">${extra[selectedStation]||'这处工位与院里的其他工位一起推进。'}</p><div class="row"><button class="porcelain" data-action="ledger" data-page="今日">看在制批次</button><button class="primary" data-action="home">回到全院</button></div>`;
}
function canSteam(){return Object.values(s.roles).includes('蒸甑')&&!s.closed;}
function openDrawer(page){drawerPage=page;$('drawer').hidden=false;renderDrawer();$('drawer').querySelector('[data-action="close-drawer"]').focus();}
function renderDrawer(){
 $('drawer-title').textContent=drawerPage;$('book-tabs').innerHTML=titles.map(t=>`<button data-action="book-page" data-page="${t}" class="${t===drawerPage?'active':''}" aria-current="${t===drawerPage?'page':'false'}">${t}</button>`).join('');
 let html='';
 if(drawerPage==='今日'){s.visitedForecast=true;html=`<section><h3>今天晴，田已经照料过</h3><p class="note">明天壹号田黄熟，可派阿青去割稻。</p><div class="forecast" style="margin-top:15px">${[2,3,4].map(d=>`<div>${icon('sun')} 晴<small>第 ${d} 日</small></div>`).join('')}</div><p class="note" style="margin-top:12px">本样板固定后三日为晴，示范提前三日看预报。</p></section><section><h3>院里的两批</h3><div class="list-row"><div><b>批 A · 白糯 · 米酒</b><small>${phaseA()} · ${s.Aphase==='press_wait'?'等待派工':s.Aphase==='done'?'已完成':`剩 ${leftA()} 工时`}</small>${s.missed?'<span class="pill warn">◇ 误了搅缸</span>':s.stirred?'<span class="pill">○ 已搅</span>':''}</div><button class="porcelain" data-action="ferment">看缸</button></div><div class="list-row"><div><b>批 B · 白糯 · ${s.Bpath||'酒路未定'}</b><small>${phaseB()}${s.Btimer>0?` · 剩 ${Math.ceil(s.Btimer)} 工时`:''}</small></div><button class="porcelain" data-action="steam">查看</button></div></section><section><h3>今日来客</h3><p class="note">两位街坊在第 2、4 工时到柜，各买一瓶甜酒酿。${s.sales.length?`已成交 ${s.sales.length} 瓶。`:''}${s.left.length?`离开 ${s.left.length} 位，见下方记录。`:''}</p>${s.sales.map(x=>`<div class="list-row"><span>${x.name}带走甜酒酿</span><span>+${x.price} 文</span></div>`).join('')}${s.left.map(x=>`<div class="list-row"><span>${x.name}离开</span><small>${x.reason}</small></div>`).join('')}</section><section><h3>十一处工位</h3><div class="station-grid">${stations.map(x=>`<button data-action="station" data-name="${x[0]}">${x[0]}<small>${x[1]}</small></button>`).join('')}</div></section>`;}
 if(drawerPage==='米与酒'){html=`<section><h3>米与曲</h3><div class="list-row"><span>米囤</span><span>0 / 16 斗</span></div><div class="list-row"><span>待蒸白糯</span><span>2 斗 · 批 B</span></div><div class="list-row"><span>家曲</span><span>${['mix','ferment_wait','ferment'].includes(s.Bphase)?3:4} 份</span></div><p class="note" style="margin-top:14px">桂花 3 级开放。老周第 2 日起到河埠卖米，首日不来。</p></section><section><h3>后仓与展位</h3><div class="list-row"><div><b>甜酒酿</b><small>白糯 · 普通 · 成色 42</small></div><span>后仓 ${s.stock} 瓶<br>柜上 ${s.shelf} 瓶</span></div><div class="list-row"><span>已售甜酒酿</span><span>${s.sales.length} 瓶</span></div>${s.Aproduct?`<div class="list-row"><span>白糯米酒</span><span>${s.Aproduct} 坛 · 成色 ${s.Aquality}</span></div>`:''}<button class="primary" data-action="counter" style="width:100%;margin-top:18px">到前柜上架</button></section><div class="box-note">成品与展位分开记。一件酒不会同时留在后仓和前柜。</div>`;}
 if(drawerPage==='酒谱'){html=`<div class="wine-visual">${icon('jar')}</div><div class="wine-title"><h3>甜酒酿</h3><span class="stamp">普通</span></div><p class="note">白糯 · 人手蒸 · 乳白瓶装</p><div class="taste-bars">${['香','甜','醇','净','韵'].map((n,i)=>`<div class="taste-bar"><span>${n}</span><i style="--value:${[40,60,36,32,44][i]}%"></i><small>${[40,60,36,32,44][i]}</small></div>`).join('')}</div><p>成色 <strong>42</strong>　·　街坊偏爱这一口甜</p><div class="locked-wines">米酒已开放，酿出后收录。<br>清酒 · 酒坊 2 级开放<br>桂花酿 · 酒坊 3 级开放</div><div class="box-note">封签有朱、石青、月白三色，便于认自家的酒。它们不代表品相。</div>`;}
 if(drawerPage==='人手'){html=`<p class="note">换岗从下一个整点开始。你是当家，亲手蒸、搅缸、照料田，不代替人手站柜。</p>${['阿禾','阿青'].map(n=>`<section style="margin-top:25px"><h3>${n} <span class="stamp">${s.roles[n]}</span></h3><p class="note">${n==='阿禾'?'人在发酵房时，到窗口会自动搅缸。':'人在水田时，1 工时可割 2 块。'}</p><label for="role-${n}" class="note">派往工位</label><select id="role-${n}" data-role="${n}" ${s.closed?'disabled':''}>${['蒸甑','前柜','水田','曲案','发酵房','压榨','调配案'].map(st=>`<option ${st===(s.pending[n]||s.roles[n])?'selected':''}>${st}</option>`).join('')}</select>${s.pending[n]?`<p class="note" style="margin-top:8px">已安排去${s.pending[n]}，下个整点到岗。</p>`:''}</section>`).join('')}<div class="box-note">老周是来报价的酒商，不在派工名单里。伙计要到 3 级才可雇。</div>`;}
 if(drawerPage==='本季'){html=`<h3>这一季，慢慢做三件事</h3>${['酿出一批亲手掌火的米酒','让街坊带走两瓶甜酒酿','照看壹号田，收下一茬糯稻'].map((g,i)=>`<div class="settings-row"><label for="goal-${i}">${g}</label><input id="goal-${i}" type="checkbox" data-goal="${i}" ${s.goals[i]?'checked':''}></div>`).join('')}<div class="box-note">三个目标是当家的自记清单。酒坊升级仍按钱与声望判断。</div><section><h3>下一步：酒坊 2 级</h3><p>需要 280 文，声望 25。<br>解锁清酒、香糯和紫糯。</p></section><p class="note" style="margin-top:18px">首发为一季夏秋，共 28 日。本样板展示首日界面，不模拟整季成长。</p>`;}
 if(drawerPage==='器物'){html=`<h3>水乡微光 · 暖坛</h3><p class="note">暖褐木、月白布、深褐坛。纸灯在入夜才明显。</p>${[['昼光','sun','粉墙是亮的，稻色饭色清楚'],['暮色','lamp','暖光收在檐下，埠头影子拉长'],['灯下','lamp','纸灯亮起，陶坛仍看得清']].map(([n,ic,desc])=>`<button class="lamp-choice ${s.light===n?'active':''}" data-action="light" data-light="${n}">${icon(ic)}<span><strong>${n}</strong><small>${desc}</small></span></button>`).join('')}<div class="box-note">这三档只预览灯色，不走工时、不扣钱。器物价格在原文档里尚待确定，这里不另定价。</div><section><h3>摆放边界</h3><p class="note">灯和矮植物放田埂外；窄架和帘放檐廊两侧。米囤、甑前、搅缸站位、展位与河埠通道保持空着。</p></section><div class="locked-wines">暖窑、白瓷、夜泉留作以后。首发器物只用水乡微光。</div>`;}
 $('drawer-content').innerHTML=html;
}
function closeDrawer(){drawerPage=null;$('drawer').hidden=true;}
function showModal(html){previousFocus=document.activeElement;$('modal-content').innerHTML=html;modal.showModal();}
function modalClose(){modal.close();if(previousFocus&&previousFocus.isConnected)previousFocus.focus();}
function settings(){showModal(`<div class="modal-head"><h2>让这院子看得舒心</h2><button class="icon-button" data-action="close-modal" aria-label="关闭设置">×</button></div><div class="settings-row"><label for="setting-big">放大文字<small>账册、提醒和操作字更大</small></label><input id="setting-big" type="checkbox" ${s.big?'checked':''}></div><div class="settings-row"><label for="setting-motion">减少动效<small>收起呼吸光与过渡，提示仍保留</small></label><input id="setting-motion" type="checkbox" ${s.motion?'checked':''}></div><div class="settings-row"><label for="setting-eye">预览已学“火候眼”<small>只看目标带样式，不花酿艺点</small></label><input id="setting-eye" type="checkbox" ${s.fireEye?'checked':''}></div><p class="note" style="margin-top:18px">空格推进，Esc 退出特写或关闭面板，Tab 打开账册。滑杆可用方向键微调。静音也能看清重要状态。</p><div class="row settings-reset"><button class="porcelain" data-action="reset-confirm">重新体验首日</button><button class="primary" data-action="close-modal">回到酒坊</button></div>`);}
function startSteam(hand){if(s.Bphase!=='waiting'||!s.Bpath||!canSteam())return;const p=hand?preview():{hard:false,scorch:false,sticky:false,good:true};s.Bdefects=[...(p.hard?['夹生']:[]),...(p.scorch?['焦糊']:[])];s.handmade=hand&&p.good;s.art+=hand?(p.good?2:1):0;s.Bphase='steam';s.Btimer=1;view='home';closeDrawer();render();toast(hand?(p.good?'火候正好，酿艺点 +2。这甑开始蒸了。':'已记下这甑的火候。酿艺点 +1。'):'交给人手按稳妥的火候蒸，没有亲手加成。');}
function tryWork(){if(s.Aphase==='press_wait'&&Object.values(s.roles).includes('压榨')){s.Aphase='press';s.Atimer=2;}if(s.Bphase==='mix_wait'&&Object.values(s.roles).includes('曲案')){s.Bphase='mix';s.Btimer=1;}if(s.Bphase==='ferment_wait'&&s.Aphase!=='ferment'){s.Bphase='ferment';s.Btimer=s.Bpath==='甜酒酿'?3:6;}}
function advance(silent=false){
 if(s.closed||view==='steam'&&!silent)return;tryWork();
 const steps=[Math.floor(s.time+1+1e-8)-s.time,8-s.time];
 if(s.Aphase==='ferment'){if(s.Aage<3.5)steps.push(3.5-s.Aage);steps.push(6-s.Aage);}
 if(['press','cellar'].includes(s.Aphase))steps.push(s.Atimer);
 if(['steam','cool','mix','ferment'].includes(s.Bphase))steps.push(s.Btimer);
 const delta=Math.min(...steps.filter(x=>x>1e-7));if(!Number.isFinite(delta))return;
 const before=s.time;s.time=Number((s.time+delta).toFixed(4));
 if(s.Aphase==='ferment'){
 s.Aage+=delta;
 if(s.Aage>=3.5-1e-8&&!s.stirred){if(s.roles.阿禾==='发酵房'){s.stirred=true;}else{s.missed=true;s.Aquality=78;if(!silent)toast('这批误了搅缸，仍继续发酵。账册已记下原因。');}}
 if(s.Aage>=6-1e-8){s.Aphase='press_wait';s.Atimer=0;}
 }else if(['press','cellar'].includes(s.Aphase)){if(Object.values(s.roles).includes('压榨')||s.Aphase==='cellar')s.Atimer-=delta;if(s.Atimer<=1e-8){if(s.Aphase==='press'){s.Aphase='cellar';s.Atimer=4;}else{s.Aphase='done';s.Aproduct=2;}}}
 if(['steam','cool','mix','ferment'].includes(s.Bphase)){
 const requires=s.Bphase==='steam'?'蒸甑':s.Bphase==='mix'?'曲案':null;
 if(!requires||Object.values(s.roles).includes(requires))s.Btimer-=delta;
 if(s.Btimer<=1e-8){if(s.Bphase==='steam'){s.Bphase='cool';s.Btimer=1;}else if(s.Bphase==='cool'){s.Bphase='mix_wait';s.Btimer=0;}else if(s.Bphase==='mix'){s.Bphase='ferment_wait';s.Btimer=0;}else{s.Bphase='成品出口';s.Btimer=0;}}
 }
 if(Math.abs(s.time-Math.round(s.time))<1e-8){Object.assign(s.roles,s.pending);s.pending={};}
 const sellGuest=(name,allowWait)=>{let reason='';if(!Object.values(s.roles).includes('前柜')){if(allowWait){s.waitingGuests.push({name,deadline:s.time+1});if(!silent)toast(`${name}到了，柜上没有人，会再等 1 工时。`);return;}reason='柜上没有人';}else if(!s.shelf)reason='柜上没有甜酒酿';else if(s.tier==='讲究')reason='标价不合';if(reason){s.left.push({name,reason});if(!silent)toast(`${name}离开：${reason}。`);}else{const amount=price();s.shelf--;s.money+=amount;s.reputation++;s.sales.push({name,price:amount});if(!silent)toast(`${name}带走一瓶甜酒酿，+${amount} 文。`);}};
 const due=s.waitingGuests.filter(g=>s.time>=g.deadline-1e-8);s.waitingGuests=s.waitingGuests.filter(g=>s.time<g.deadline-1e-8);due.forEach(g=>sellGuest(g.name,false));
 for(const [t,name] of [[1,'陈婶'],[3,'河埠街坊']])if(before<t&&s.time>=t)sellGuest(name,true);
 tryWork();if(s.time>=8)settle();render();
 if(s.closed&&!silent)showBill();
}
function closeDay(){if(s.closed){showBill();return;}const risks=[canStir()?'这一缸还没搅，窗口会过去。':'',s.sales.length+s.left.length<2?'还没成交的街坊会继续到柜，柜上若无人或无酒会离开。':''].filter(Boolean);showModal(`<div class="modal-head"><h2>把今天收进账册？</h2><button class="icon-button" data-action="close-modal" aria-label="取消收工">×</button></div><p class="modal-text">收工会把余下工时一起推进。${risks.length?'<br>'+risks.join('<br>'):'今天该搅的已搅，该来的客人也已记账。'}<br>最后结清 8 文开销。</p><div class="row"><button class="porcelain" data-action="close-modal">再看一眼院子</button><button class="primary" data-action="finish-day">确认收工</button></div>`);}
function settle(){if(s.closed)return;s.closed=true;s.money=Math.max(0,s.money-8);}
function billLines(){return['壹号田到了黄熟，品相优良。贰、叁号田仍空着。',`${s.missed?'批 A 误了搅缸；':s.stirred?'批 A 搅缸照看过；':''}${s.Aphase==='done'?'米酒已装好 2 坛。':`仍在${phaseA()}${leftA()>0?`，剩 ${leftA()} 工时`:'，等待派工'}。`}批 B ${s.Bphase==='waiting'?'仍待蒸':phaseB()}。`,`${s.sales.length?`街坊带走 ${s.sales.length} 瓶甜酒酿。`:'今天没有成交。'}${s.left.map(x=>`${x.name}离开：${x.reason}。`).join('')}`];}
function showBill(){const lines=billLines(),income=s.sales.reduce((sum,x)=>sum+x.price,0);showModal(`<div class="modal-head"><div><small>第 1 日 · 夏秋 · 晴</small><h2>米入缸，酒入账</h2></div><button class="icon-button" data-action="close-modal" aria-label="关闭日结">×</button></div><div class="bill-three">${lines.map((l,i)=>`<div><b>${['田','酒','柜'][i]}</b><p>${l}</p></div>`).join('')}</div><div class="bill-total"><div><small>今日收入</small><strong>${income}<small>文</small></strong></div><div><small>今日开销</small><strong>8<small>文</small></strong></div><div><small>余钱</small><strong>${s.money}<small>文</small></strong></div></div><p class="note" style="margin-top:18px">只记今天真正发生的事，开销已结清。正式游戏明日接着开坊。</p><div class="row"><button class="porcelain" data-action="export-bill">保存今日账页</button><button class="primary" data-action="close-modal">回看酒坊</button></div>`);}
function exportBill(){const income=s.sales.reduce((v,x)=>v+x.price,0);const content=`糯酿 · 第1日账页\n\n${billLines().map((x,i)=>['田','酒','柜'][i]+'：'+x).join('\n')}\n\n今日收入：${income} 文\n今日开销：8 文\n余钱：${s.money} 文\n声望：${s.reputation}\n酿艺点：${s.art}\n\n独立界面样板记录\n`;const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='糯酿_第1日账页.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function action(name,el){
 if(name==='home'){view='home';draft=[.45,.55,.5];closeDrawer();render();return;}
 if(name==='ledger'){openDrawer(el.dataset.page||'今日');return;}
 if(name==='book-page'){drawerPage=el.dataset.page;renderDrawer();return;}
 if(name==='close-drawer'){closeDrawer();return;}
 if(name==='settings'){settings();return;}
 if(name==='close-modal'){modalClose();return;}
 if(name==='steam'){closeDrawer();view='steam';draft=[.45,.55,.5];render();return;}
 if(name==='path'){s.Bpath=el.dataset.path;renderDetail();return;}
 if(name==='change-path'){s.Bpath=null;renderDetail();return;}
 if(name==='confirm-steam'){startSteam(true);return;}
 if(name==='delegate'){startSteam(false);return;}
 if(name==='ferment'){closeDrawer();if(s.Aphase==='ferment'){view='ferment';}else{view='station';selectedStation=s.Aphase==='cellar'?'酒窖':'压榨';}render();return;}
 if(name==='stir'){if(canStir()){s.stirred=true;s.art++;render();toast('搅过了，酿艺点 +1。这一缸不用再搅。');}return;}
 if(name==='counter'){closeDrawer();view='counter';render();return;}
 if(name==='shelf'){if(s.stock>0&&s.shelf<4&&!s.closed){s.stock--;s.shelf++;render();toast('一瓶甜酒酿摆上前柜。');}return;}
 if(name==='unshelf'){if(s.shelf>0&&!s.closed){s.shelf--;s.stock++;render();toast('一瓶甜酒酿收回后仓。');}return;}
 if(name==='tier'){if(!s.closed){s.tier=el.dataset.tier;render();}return;}
 if(name==='advance'){advance();return;}
 if(name==='close-day'){closeDay();return;}
 if(name==='finish-day'){modalClose();view='home';let safety=0;while(!s.closed&&safety++<40)advance(true);render();showBill();return;}
 if(name==='station'){closeDrawer();const st=el.dataset.name;if(st==='蒸甑'){view='steam';}else if(st==='发酵房'){view='ferment';}else if(st==='前柜'){view='counter';}else{view='station';selectedStation=st;}render();return;}
 if(name==='light'){s.light=el.dataset.light;render();return;}
 if(name==='reset-confirm'){modalClose();showModal('<div class="modal-head"><h2>重新体验首日？</h2></div><p class="modal-text">本次样板操作会清空，回到 160 文与四瓶甜酒酿的开局。</p><div class="row"><button class="porcelain" data-action="close-modal">保留本次</button><button class="primary" data-action="reset">重新开始</button></div>');return;}
 if(name==='reset'){reset();return;}
 if(name==='export-bill'){exportBill();}
}
document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(el&&!el.disabled)action(el.dataset.action,el);});
document.addEventListener('input',e=>{if(e.target.id.startsWith('fire-')){const i=Number(e.target.id.split('-')[1]);if(Number.isInteger(i)){draft[i]=Number(e.target.value);fireFeedback();}}});
document.addEventListener('change',e=>{const el=e.target;if(el.id==='setting-big'){s.big=el.checked;render();}if(el.id==='setting-motion'){s.motion=el.checked;render();}if(el.id==='setting-eye'){s.fireEye=el.checked;render();}if(el.dataset.role){s.pending[el.dataset.role]=el.value;renderDrawer();toast('换岗已安排，下个整点开始。');}if(el.dataset.goal)s.goals[Number(el.dataset.goal)]=el.checked;});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(modal.open)return;if(drawerPage){closeDrawer();e.preventDefault();return;}if(view!=='home'){view='home';draft=[.45,.55,.5];render();e.preventDefault();}return;}if(e.key==='Tab'&&!modal.open&&!['INPUT','SELECT','BUTTON'].includes(document.activeElement.tagName)){e.preventDefault();drawerPage?closeDrawer():openDrawer('今日');return;}if(e.code==='Space'&&!modal.open&&!drawerPage&&!['BUTTON','INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();advance();}});
modal.addEventListener('close',()=>{if(previousFocus?.isConnected)previousFocus.focus();});
reset();
