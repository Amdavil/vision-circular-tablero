/* Tablero de Resultados Estratégicos — Visión Circular. Lógica de la página. */
(function(){
"use strict";
const C=window.VC, API=(window.VC_CONFIG||{}).api||'';
const {ANIOS,PARTES,VARS,K,RES,RE_NOTE,TEMAS,TITULARES,COMPLEMENTARIOS,CONTEXTO,FREQ_DIAS}=C;
const HOY=new Date(), HOY_ISO=new Date(HOY.getTime()-HOY.getTimezoneOffset()*6e4).toISOString().slice(0,10), ANIO_ACT=HOY.getFullYear();
const RANKED=TITULARES.concat(COMPLEMENTARIOS);
const W0={A:25,R:25,D:15,C:20,T:15};

/* ---------------- estado ---------------- */
const S={codigo:'',rol:null,nombre:'',party:null,reportes:[],valid:{},metas:{},live:false,error:null,
  year:Math.min(ANIO_ACT,ANIOS[ANIOS.length-1]),rYear:Math.min(ANIO_ACT,ANIOS[ANIOS.length-1]),incluirPend:true,tab:'inicio',w:Object.assign({},W0),tzFilter:'Todos',repVar:null};
const ls={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}},del:k=>{try{localStorage.removeItem(k)}catch(e){}}};
S.codigo=ls.get('vc-codigo')||'';S.nombre=ls.get('vc-nombre')||'';
const sp=ls.get('vc-party');if(sp&&PARTES[sp])S.party=sp;
try{const w=JSON.parse(ls.get('vc-w')||'null');if(w&&typeof w.A==='number')S.w=w;}catch(e){}
const TABS=['inicio','tablero','reportar','validar','metodologia'];
const h0=location.hash.slice(1);if(TABS.indexOf(h0)>=0)S.tab=h0;

/* ---------------- utilidades ---------------- */
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=(v,d)=>Number(v).toLocaleString('es-CO',{maximumFractionDigits:d==null?(Math.abs(v)<100?1:0):d});
function fmt(v,u){
  if(v==null||!isFinite(v))return '—';
  if(u==='%')return nf(v,1)+' %';
  if(u==='COP')return Math.abs(v)>=1e9?'$'+nf(v/1e6,0)+' M':'$'+nf(v,0);
  if(u==='COP/t')return '$'+nf(v,0)+' por t';
  if(u==='$ por $1')return '$'+v.toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2})+' por $1';
  return nf(v)+' '+u;
}
function fmtNum(v,u){
  if(v==null||!isFinite(v))return '—';
  if(u==='%')return nf(v,1);
  if(u==='COP')return Math.abs(v)>=1e9?'$'+nf(v/1e6,0):'$'+nf(v,0);
  if(u==='COP/t')return '$'+nf(v,0);
  if(u==='$ por $1')return '$'+v.toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2});
  return nf(v);
}
function unitLabel(u,v){if(u==='COP')return v!=null&&Math.abs(v)>=1e9?'millones de pesos':'pesos';if(u==='$ por $1')return 'por cada $1 de VC';if(u==='COP/t')return 'por tonelada';return u;}
const fecha=iso=>{if(!iso)return '—';const d=new Date(iso.length===10?iso+'T12:00:00':iso);return isNaN(d)?'—':d.toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'});};
const dias=iso=>Math.round((HOY-new Date(iso.length===10?iso+'T12:00:00':iso))/864e5);
function desagTxt(r){const a=[];if(r.material)a.push(r.material);if(r.linea)a.push(r.linea);if(r.territorio)a.push(r.territorio);if(r.nivel)a.push(r.nivel);if(r.cat)a.push(r.cat);if(r.metodo)a.push('Método: '+r.metodo);if(r.incluido)a.push('ya incluida en Traza');return a.join(' · ')||'Sin desagregar';}
function estadoDe(r){const v=S.valid[r.id];return v?v.estado:'pendiente';}
function chipEstado(e){return e==='validado'?'<span class="chip c-ok">Validado</span>':e==='observado'?'<span class="chip c-bad">Observado</span>':e==='reemplazado'?'<span class="chip c-none">Reemplazado</span>':'<span class="chip c-pend">Pendiente</span>';}
const areaN=q=>PARTES[q]?PARTES[q].n:(q||'');
const ORDEN=TEMAS.reduce((a,t)=>a.concat(t.ks),[]);
const numK=k=>ORDEN.indexOf(k)+1;
function quienReportaK(k){const a=new Set();varsDeK(k).forEach(v=>VARS[v].q.forEach(p=>a.add(p)));return Array.from(a).map(areaN);}

/* ---------------- API ---------------- */
async function api(path,body){
  const opt={method:body?'POST':'GET',headers:{'X-Codigo':S.codigo}};
  if(body){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(body);}
  let r;try{r=await fetch(API+path,opt);}catch(e){const er=new Error('No hay conexión con la base de datos. Revisa tu internet e intenta de nuevo.');er.code='red';throw er;}
  let j=null;try{j=await r.json();}catch(e){}
  if(!r.ok){const er=new Error((j&&j.mensaje)||('Error '+r.status));er.code=(j&&j.error)||r.status;er.status=r.status;throw er;}
  return j;
}
function clean(x){if(!x||!VARS[x.v]||typeof x.valor!=='number'||!isFinite(x.valor)||typeof x.anio!=='number')return null;x.corte=x.corte||'';x.ts=x.ts||'';return x;}
async function cargar(){
  const d=await api('/api/estado');
  S.rol=d.rol;S.reportes=(d.reportes||[]).map(clean).filter(Boolean);
  const v={};Object.keys(d.validaciones||{}).forEach(id=>{const x=d.validaciones[id];if(x.estado==='validado'||x.estado==='observado')v[id]=x;});S.valid=v;
  const m={};Object.keys(d.metas||{}).forEach(id=>{const x=d.metas[id];if(typeof x.valor==='number')m[id]=x;});S.metas=m;
  S.live=true;S.error=null;S.ultimaCarga=new Date();
}
async function refrescar(){
  if(!S.codigo)return;
  try{await cargar();}catch(e){if(e.status===401){salir('El código guardado ya no es válido. Ingrésalo de nuevo.');return;}S.error=e.message;}
  renderTodo();
}
async function ingresar(code,msgEl){
  const prev=S.codigo;S.codigo=code.trim().toUpperCase();
  try{await cargar();ls.set('vc-codigo',S.codigo);renderTodo();}
  catch(e){S.codigo=prev;msgEl.innerHTML='<div class="msg bad">'+esc(e.status===401?'Ese código no es válido. Revísalo o pídelo a Sistemas de Información.':e.message)+'</div>';}
}
function salir(msg){S.codigo='';S.rol=null;S.live=false;S.reportes=[];S.valid={};S.metas={};ls.del('vc-codigo');S.lockMsg=msg||'';renderTodo();}

/* ---------------- motor de cálculo ---------------- */
function superseded(){return new Set(S.reportes.filter(r=>r.corrige).map(r=>r.corrige));}
function efectivos(){const sup=superseded();return S.reportes.filter(r=>!sup.has(r.id)).map(r=>Object.assign({},r,{estado:estadoDe(r)})).filter(r=>r.estado!=='observado'&&(S.incluirPend||r.estado==='validado'));}
function keyOf(r){return [r.material||'',r.linea||'',r.territorio||'',r.cat||'',r.nivel||'',r.metodo||''].join('|');}
function varsDeK(k){const c=K[k].calc;if(c.t==='k01')return['V01','V02'];if(c.t==='var')return[c.v];if(c.t==='ratio')return[c.num,c.den];if(c.t==='red')return[c.a,c.b];if(c.t==='multi')return c.vs.concat([c.extra]);return[];}
function valVar(v,y,recs){
  const def=VARS[v];const rs=recs.filter(r=>r.v===v&&r.anio===y);if(!rs.length)return null;
  const by={};for(const r of rs){const k=keyOf(r),c=by[k];if(!c||r.corte>c.corte||(r.corte===c.corte&&r.ts>c.ts))by[k]=r;}
  let list=Object.values(by);
  if(def.agg==='last')list=[list.slice().sort((a,b)=>(b.corte+b.ts).localeCompare(a.corte+a.ts))[0]];
  else{const spc=list.filter(r=>keyOf(r)!=='|||||');if(spc.length)list=spc;}
  if(def.ds.indexOf('material')>=0){const np=list.filter(r=>r.material&&r.material!=='Plástico'&&r.material!=='No plástico (agregado)');if(np.length)list=list.filter(r=>r.material!=='No plástico (agregado)');}
  const cuenta=list.filter(r=>!r.incluido),atr=list.filter(r=>r.incluido);
  let total=null;if(cuenta.length){const s=cuenta.reduce((a,r)=>a+r.valor,0);total=def.agg==='prom'?s/cuenta.length:s;}
  return {v,total,list,cuenta,atrib:atr.reduce((a,r)=>a+r.valor,0),natrib:atr.length,pend:list.some(r=>r.estado!=='validado'),corte:list.reduce((m,r)=>r.corte>m?r.corte:m,'')};
}
const grupo=m=>m==='Plástico'?'Plástico':'No plástico';
function calcK(k,y,recs){
  const c=K[k].calc;let out=null;
  if(c.t==='var'){const a=valVar(c.v,y,recs);if(!a)return null;out={valor:a.total,parts:[a],atrib:a.atrib,natrib:a.natrib};}
  else if(c.t==='ratio'){const n=valVar(c.num,y,recs),d=valVar(c.den,y,recs);if(!n&&!d)return null;out={valor:(n&&d&&n.total!=null&&d.total)?n.total/d.total*c.m:null,parts:[n,d].filter(Boolean),falta:!n?c.num:!d?c.den:null};}
  else if(c.t==='red'){const a=valVar(c.a,y,recs),b=valVar(c.b,y,recs);if(!a&&!b)return null;out={valor:(a&&b&&a.total)?(a.total-b.total)/a.total*100:null,parts:[a,b].filter(Boolean),falta:!a?c.a:!b?c.b:null};}
  else if(c.t==='multi'){const ps=c.vs.map(v=>valVar(v,y,recs));const ex=valVar(c.extra,y,recs);if(ps.every(p=>!p)&&!ex)return null;
    const ok=ps.filter(p=>p&&p.total!=null);out={valor:ok.length?ok.reduce((s,p)=>s+p.total,0):null,parts:ps.concat([ex]).filter(Boolean),sub:ps.map((p,i)=>({v:c.vs[i],val:p?p.total:null})),extra:ex?ex.total:null,incompleto:ps.some(p=>!p)};}
  else if(c.t==='k01'){const n=valVar('V01',y,recs),m=valVar('V02',y,recs);if(!n&&!m)return null;
    const g={};const add=(r,f)=>{const gk=grupo(r.material);g[gk]=g[gk]||{n:0,m:0,hn:false,hm:false};g[gk][f]+=r.valor;g[gk]['h'+f]=true;};
    if(n)n.cuenta.forEach(r=>add(r,'n'));if(m)m.cuenta.forEach(r=>add(r,'m'));
    const grupos=['Plástico','No plástico'].filter(x=>g[x]).map(x=>({k:x,n:g[x].n,m:g[x].m,p:(g[x].hn&&g[x].hm&&g[x].m>0)?g[x].n/g[x].m*100:null}));
    const conP=grupos.filter(x=>x.p!=null);const tn=n?n.total:null,tm=m?m.total:null;
    out={valor:conP.length?Math.min.apply(null,conP.map(x=>x.p)):null,grupos,total:(tn!=null&&tm)?tn/tm*100:null,parts:[n,m].filter(Boolean),falta:!n?'V01':!m?'V02':null};}
  if(!out)return null;
  out.pend=out.parts.some(p=>p.pend);out.corte=out.parts.reduce((a,p)=>p.corte>a?p.corte:a,'');
  return out;
}
const serie=(k,recs)=>ANIOS.map(y=>{const r=calcK(k,y,recs);return {y,v:r?r.valor:null,pend:r?r.pend:false};});
function ultimo(k,recs,y){for(let i=ANIOS.indexOf(y);i>=0;i--){const r=calcK(k,ANIOS[i],recs);if(r&&r.valor!=null)return {y:ANIOS[i],r};}return null;}
function metaDe(k,y){const m=S.metas[k+'-'+y];if(m&&typeof m.valor==='number')return m.valor;if(k==='K01')return 100;return null;}
function semaforo(k,val,y){const meta=metaDe(k,y);if(meta==null||val==null)return null;const p=K[k].pol>0?val/meta:(val?meta/val:0);return p>=1?'ok':p>=.85?'warn':'bad';}

/* ---------------- gráficos ---------------- */
function sparkline(pts,u){
  const p=pts.filter(x=>x.v!=null);if(p.length<2)return '';
  const W=112,H=34,pad=4,xs=ANIOS.length-1;const vals=p.map(x=>x.v);let lo=Math.min.apply(null,vals),hi=Math.max.apply(null,vals);if(lo===hi){lo-=1;hi+=1;}
  const X=y=>pad+(ANIOS.indexOf(y)/xs)*(W-2*pad),Y=v=>H-pad-((v-lo)/(hi-lo))*(H-2*pad);
  const d=p.map((x,i)=>(i?'L':'M')+X(x.y).toFixed(1)+' '+Y(x.v).toFixed(1)).join(' ');
  const area=d+' L'+X(p[p.length-1].y).toFixed(1)+' '+(H-pad)+' L'+X(p[0].y).toFixed(1)+' '+(H-pad)+' Z';const last=p[p.length-1];
  return '<svg class="spark" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" aria-hidden="true"><line x1="'+pad+'" x2="'+(W-pad)+'" y1="'+(H-pad)+'" y2="'+(H-pad)+'" stroke="var(--rule)"/><path d="'+area+'" fill="var(--s1)" fill-opacity=".1"/><path d="'+d+'" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'+
    p.map(x=>'<circle cx="'+X(x.y).toFixed(1)+'" cy="'+Y(x.v).toFixed(1)+'" r="'+(x===last?4:2.5)+'" fill="'+(x===last?'var(--s1)':'var(--surface)')+'" stroke="'+(x===last?'var(--surface)':'var(--s1)')+'" stroke-width="'+(x===last?2:1.5)+'" data-tip="'+esc(x.y+': '+fmt(x.v,u))+'"/>').join('')+'</svg>';
}
function niceMax(v){if(v<=0)return 1;const e=Math.pow(10,Math.floor(Math.log10(v)));const f=v/e;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e;}
const HATCH=id=>'<defs><pattern id="'+id+'" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--s1)" fill-opacity=".25"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--s1)" stroke-width="2.5"/></pattern></defs>';
function columnas(pts,u,meta){
  const W=640,H=220,L=60,R=12,T=16,B=28;const vals=pts.filter(p=>p.v!=null).map(p=>p.v);
  if(!vals.length)return '<p class="muted small">Todavía no hay datos para graficar.</p>';
  const lo=Math.min(0,Math.min.apply(null,vals)),hi=niceMax(Math.max.apply(null,vals.concat(meta!=null?[meta]:[]).concat([0])));
  const iw=W-L-R,ih=H-T-B,band=iw/pts.length,bw=Math.min(24,band*.5);const Y=v=>T+ih-((v-lo)/(hi-lo))*ih;
  let g=HATCH('hatch');
  for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4,y=Y(v);g+='<line class="grid" x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'"/><text x="'+(L-6)+'" y="'+(y+4)+'" text-anchor="end">'+esc(fmtNum(v,u))+'</text>';}
  pts.forEach((p,i)=>{const cx=L+band*i+band/2;g+='<text x="'+cx+'" y="'+(H-8)+'" text-anchor="middle">'+p.y+'</text>';if(p.v==null)return;
    const y0=Y(Math.max(0,lo)),y1=Y(p.v),top=Math.min(y0,y1),h=Math.max(1,Math.abs(y0-y1)),r=Math.min(4,h/2),x=cx-bw/2;
    const path=p.v>=0?'M'+x+' '+(top+h)+' V'+(top+r)+' Q'+x+' '+top+' '+(x+r)+' '+top+' H'+(x+bw-r)+' Q'+(x+bw)+' '+top+' '+(x+bw)+' '+(top+r)+' V'+(top+h)+' Z':'M'+x+' '+top+' H'+(x+bw)+' V'+(top+h-r)+' Q'+(x+bw)+' '+(top+h)+' '+(x+bw-r)+' '+(top+h)+' H'+(x+r)+' Q'+x+' '+(top+h)+' '+x+' '+(top+h-r)+' Z';
    g+='<path d="'+path+'" fill="'+(p.pend?'url(#hatch)':'var(--s1)')+'" data-tip="'+esc(p.y+': '+fmt(p.v,u)+(p.pend?' · incluye datos pendientes':''))+'"/><text class="val-lab" x="'+cx+'" y="'+(p.v>=0?top-5:top+h+13)+'" text-anchor="middle">'+esc(fmtNum(p.v,u))+'</text>';});
  if(meta!=null){const y=Y(meta);g+='<line class="ref2" x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'"/><text x="'+(W-R)+'" y="'+(y-5)+'" text-anchor="end">Meta '+esc(fmtNum(meta,u))+'</text>';}
  return '<svg class="chart-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Valor por año">'+g+'</svg><div class="legend"><span><i style="background:var(--s1)"></i>Validado</span><span><i style="background:var(--s1);opacity:.45"></i>Incluye pendientes (rayado)</span>'+(meta!=null?'<span><i style="background:var(--green)"></i>Meta</span>':'')+'</div>';
}
function barrasK01(res,y){
  const rows=res.grupos.filter(g=>g.p!=null);
  if(!rows.length)return '<p class="muted small">Falta '+(res.falta==='V01'?'el dato de toneladas certificadas':'la meta del año')+' para calcular el cumplimiento de '+y+'.</p>';
  const W=560,L=104,R=56,rowH=40,T=24,H=T+rows.length*rowH+24;const metaI=S.metas['K01-'+y]?S.metas['K01-'+y].valor:null;
  const mx=Math.max(150,niceMax(Math.max.apply(null,rows.map(r=>r.p).concat(metaI?[metaI]:[]))));const X=v=>L+(v/mx)*(W-L-R);
  let g=HATCH('hatchk');
  [0,mx/4,mx/2,mx*3/4,mx].forEach(t=>{g+='<line class="grid" x1="'+X(t)+'" x2="'+X(t)+'" y1="'+(T-6)+'" y2="'+(H-22)+'"/><text x="'+X(t)+'" y="'+(H-6)+'" text-anchor="middle">'+nf(t,0)+' %</text>';});
  rows.forEach((r,i)=>{const yc=T+i*rowH+rowH/2,bh=22,x0=X(0),x1=X(r.p),rr=Math.min(4,(x1-x0)/2);const col=r.k==='Plástico'?'var(--s1)':'var(--s2)';
    g+='<text x="'+(L-10)+'" y="'+(yc+4)+'" text-anchor="end" style="fill:var(--ink);font-weight:600">'+esc(r.k)+'</text>';
    g+='<path d="M'+x0+' '+(yc-bh/2)+' H'+(x1-rr)+' Q'+x1+' '+(yc-bh/2)+' '+x1+' '+(yc-bh/2+rr)+' V'+(yc+bh/2-rr)+' Q'+x1+' '+(yc+bh/2)+' '+(x1-rr)+' '+(yc+bh/2)+' H'+x0+' Z" fill="'+(res.pend?'url(#hatchk)':col)+'" data-tip="'+esc(r.k+': '+nf(r.n,0)+' t certificadas de '+nf(r.m,0)+' t de meta')+'"/>';
    g+='<text class="val-lab" x="'+(x1+6)+'" y="'+(yc+4)+'">'+nf(r.p,0)+' %</text>';});
  g+='<line class="ref" x1="'+X(100)+'" x2="'+X(100)+'" y1="'+(T-12)+'" y2="'+(H-22)+'"/><text x="'+X(100)+'" y="'+(T-14)+'" text-anchor="middle" style="fill:var(--ink);font-size:11px">Meta legal</text>';
  if(metaI&&metaI!==100)g+='<line class="ref2" x1="'+X(metaI)+'" x2="'+X(metaI)+'" y1="'+(T-6)+'" y2="'+(H-22)+'"/>';
  return '<svg class="chart-svg" viewBox="0 0 '+W+' '+(H+4)+'" role="img" aria-label="Cumplimiento por grupo de material">'+g+'</svg><div class="legend"><span><i style="background:var(--s1)"></i>Plástico</span><span><i style="background:var(--s2)"></i>No plástico</span><span><i style="background:var(--ink)"></i>Meta legal (100 %)</span>'+(metaI&&metaI!==100?'<span><i style="background:var(--green)"></i>Meta interna '+nf(metaI,0)+' %</span>':'')+(res.pend?'<span>Rayado: incluye datos pendientes</span>':'')+'</div>';
}

/* ---------------- acceso ---------------- */
function lockHTML(which){
  const need=which==='validar'?'el código de validación de Sistemas de Información':'el código del equipo';
  return '<div class="lock"><h2>Ingresa '+esc(need)+'</h2><p class="small muted" style="margin:0">'+(which==='validar'?'Validar y fijar metas está reservado a Sistemas de Información.':'Los datos del programa son de uso interno. Pide el código a Sistemas de Información o al equipo consultor.')+'</p>'+
    (S.lockMsg?'<div class="msg warn">'+esc(S.lockMsg)+'</div>':'')+
    '<form class="row" data-login><input type="password" autocomplete="off" placeholder="VC-XXXXXX-XXXX-XXXX" aria-label="Código de acceso" required><button class="btn primary" type="submit">Entrar</button></form><div data-login-msg></div></div>';
}
function renderAcceso(){
  const ok=!!S.rol;
  $$('[data-needs="codigo"]').forEach(el=>{el.hidden=!ok;});
  $$('.lock-slot').forEach(el=>{const w=el.dataset.lock;const show=!ok||(w==='validar'&&S.rol!=='validador'&&false);el.hidden=!show;if(show)el.innerHTML=lockHTML(w);});
  const vn=$('#val-note');vn.hidden=!(ok&&S.rol!=='validador');
  if(ok&&S.rol!=='validador')vn.innerHTML='Entraste con el código de equipo: puedes ver la bitácora. Para validar y fijar metas, <a href="#" data-cambiar>entra con el código de validación</a>.';
  $('#acc').innerHTML=ok?'<span class="dot'+(S.error?'':' live')+'"></span><span>'+(S.rol==='validador'?'Validación':'Equipo')+(S.nombre?' · '+esc(S.nombre):'')+'</span><button class="btn small" type="button" data-salir>Salir</button>':'<button class="btn small primary" type="button" data-go="reportar">Ingresar</button>';
}

/* ---------------- INICIO ---------------- */
function renderInicio(){
  const fun=[[180,'registros en la Matriz de Disponibilidad','var(--ink-3)'],[46,'marcados como trazadores','var(--sky)'],[19,'indicadores en el catálogo (12 titulares + 7 complementarios)','var(--green)'],[12,'indicadores en el tablero de Junta','var(--brand)']];
  $('#funnel').innerHTML=fun.map(f=>'<div class="frow"><div class="lab"><span>'+esc(f[1])+'</span><b>'+f[0]+'</b></div><div class="track"><div class="fill" style="width:'+Math.max(4,f[0]/180*100).toFixed(1)+'%;background:'+f[2]+'"></div></div></div>').join('');
  $('#prior-list').innerHTML=TEMAS.map(t=>'<div class="theme"><div class="theme-h"><h3>'+esc(t.n)+'</h3><span>'+esc(t.d)+'</span></div>'+t.ks.map(k=>{const d=K[k];
    const chip=d.brecha?'<span class="chip c-warn">En brecha</span>':d.rol==='Ancla REP'?'<span class="chip c-acc">Ancla REP</span>':d.rol==='Titular propuesto'?'<span class="chip c-green">Propuesto</span>':'';
    return '<button class="kitem" type="button" data-k="'+k+'"><span class="num">'+numK(k)+'</span><span><span class="nm">'+esc(d.n)+'</span><span class="qq" style="display:block">'+esc(d.q)+'</span><span class="who" style="display:block">Lo reporta: '+esc(quienReportaK(k).join(' · '))+'</span></span><span class="side"><span class="re-tag">'+esc(d.re==='ANCLA'?'Ancla':d.re)+'</span>'+chip+'</span></button>';}).join('')+'</div>').join('');
  $('#comp-list').innerHTML=COMPLEMENTARIOS.map(k=>'<button type="button" data-k="'+k+'">'+esc(K[k].n)+'</button>').join('');
  $('#areas').innerHTML=Object.keys(PARTES).map(p=>{const vs=Object.keys(VARS).filter(v=>VARS[v].q.indexOf(p)>=0);
    return '<div class="area"><h3>'+esc(PARTES[p].n)+'</h3><p>'+esc(PARTES[p].d)+'</p><ul>'+vs.map(v=>'<li>'+esc(VARS[v].n)+' <span class="muted small">('+VARS[v].fr.toLowerCase()+')</span></li>').join('')+'</ul><button class="btn small" type="button" data-area="'+p+'">Reportar como esta área</button></div>';}).join('');
}

/* ---------------- TABLERO ---------------- */
function statusChip(k,res,y,ult){
  if(res&&res.valor!=null){const sm=semaforo(k,res.valor,y);let h=res.pend?'<span class="chip c-pend">Pendiente</span>':'<span class="chip c-ok">Validado</span>';
    if(sm)h+=' <span class="chip c-'+sm+'">'+(sm==='ok'?'En meta':sm==='warn'?'Cerca de la meta':'Bajo la meta')+'</span>';return h;}
  if(K[k].brecha)return '<span class="chip c-warn">Brecha de método</span>';
  if(res&&res.falta)return '<span class="chip c-warn">Falta un dato</span>';
  return '<span class="chip c-none">Sin dato '+y+'</span>';
}
function cardHTML(k,recs,y){
  const d=K[k];const r=calcK(k,y,recs);const u=(!r||r.valor==null)?ultimo(k,recs,y):null;let num,cmp='';
  if(r&&r.valor!=null){num=fmtNum(r.valor,d.u);const prev=calcK(k,y-1,recs);
    if(prev&&prev.valor!=null&&prev.valor!==0&&!r.incompleto&&!prev.incompleto){
      if((r.corte||'').slice(5)>='12-31'){const dv=(r.valor-prev.valor)/Math.abs(prev.valor)*100;cmp=(dv>=0?'▲ ':'▼ ')+nf(Math.abs(dv),0)+' % frente a '+(y-1);}
      else cmp='Corte '+fecha(r.corte)+' · '+(y-1)+' completo: '+fmt(prev.valor,d.u);}
    const meta=metaDe(k,y);if(meta!=null&&k!=='K01')cmp+=(cmp?' · ':'')+'meta '+fmt(meta,d.u);
    if(r.atrib)cmp+=(cmp?' · ':'')+nf(r.atrib,0)+' '+d.u+' atribuidas a líneas';
    if(k==='K05'&&r.extra!=null)cmp+=(cmp?' · ':'')+nf(r.extra,0)+' municipios';
    if(r.incompleto)cmp+=(cmp?' · ':'')+'falta parte de la red en '+y;}
  else if(u){num='—';cmp='Último dato: '+fmt(u.r.valor,d.u)+' ('+u.y+')';}
  else{num='—';cmp=r&&r.falta?'Falta: '+VARS[r.falta].n.toLowerCase():r&&r.atrib?nf(r.atrib,0)+' '+d.u+' reportadas solo como atribución':'Nadie ha reportado este dato todavía';}
  return '<button class="card" type="button" data-k="'+k+'"><div class="top"><span class="re-tag">'+numK(k)+' · '+esc(d.re==='ANCLA'?'Ancla':d.re)+'</span>'+statusChip(k,r,y,u)+'</div>'+
    '<div><h3>'+esc(d.n)+'</h3><div class="q">'+esc(d.q)+'</div></div>'+
    '<div><div class="big">'+esc(num)+(num!=='—'?'<span class="u">'+esc(unitLabel(d.u,r&&r.valor))+'</span>':'')+'</div><div class="cmp">'+esc(cmp)+'</div></div>'+
    '<div class="foot"><div class="base">Punto de partida: <b>'+esc(d.baseRef||'—')+'</b></div>'+sparkline(serie(k,recs),d.u)+'</div></button>';
}
function renderTablero(){
  if(!S.rol)return;
  const recs=efectivos(),y=S.year;
  $('#status-line').innerHTML='<span class="dot'+(S.error?'':' live')+'"></span><span>'+esc(S.error?S.error:'Datos en vivo · '+S.reportes.length+' reportes · actualizado '+(S.ultimaCarga?S.ultimaCarga.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}):''))+'</span> <button class="btn small" type="button" data-refrescar>Actualizar</button>';
  $('#ctx').innerHTML=CONTEXTO.map(k=>{const d=K[k];let r=calcK(k,y,recs),yy=y;if(!r||r.valor==null){const u=ultimo(k,recs,y);if(u){r=u.r;yy=u.y;}}
    const v=r&&r.valor!=null?fmt(r.valor,d.u):'—';const sub=r&&r.valor!=null?('Dato '+yy+(r.pend?' · pendiente':' · validado')):(d.baseRef?'Referencia: '+d.baseRef:'Sin datos todavía');
    return '<button class="item" type="button" data-k="'+k+'"><span class="lab">'+esc(d.n)+'</span><span class="val">'+esc(v)+'</span><span class="sub">'+esc(sub)+'</span></button>';}).join('');
  let r1=calcK('K01',y,recs),y1=y;if(!r1||r1.valor==null){const u=ultimo('K01',recs,y);if(u){r1=u.r;y1=u.y;}}
  $('#anchor').innerHTML='<div><span class="re-tag">1 · ANCLA REP</span><h2 style="margin-top:4px">¿Estamos cumpliendo la meta de aprovechamiento?</h2>'+
    '<div class="hero-num">'+(r1&&r1.valor!=null?nf(r1.valor,0)+'<small> %</small>':'—')+'</div>'+
    '<p class="small muted" style="margin:0 0 8px">'+(r1&&r1.valor!=null?'Cumplimiento del grupo de material más rezagado en '+y1+(y1!==y?' (último dato; '+y+' aún sin reporte)':'')+'.':'Sin toneladas certificadas y meta para '+y+'.')+'</p>'+
    '<div style="display:flex;flex-wrap:wrap;gap:6px">'+statusChip('K01',r1,y1)+'</div>'+
    '<p class="small muted" style="margin:12px 0 0">La norma se evalúa grupo por grupo: basta que uno quede bajo la meta para incumplir.'+(r1&&r1.total!=null?' Ambos grupos juntos: '+nf(r1.total,0)+' %.':'')+'</p>'+
    '<button class="btn small" type="button" data-k="K01" style="margin-top:12px">Ver fórmula y datos</button></div>'+
    '<div>'+(r1?barrasK01(r1,y1):'<p class="muted small">Cuando Implementación reporte toneladas certificadas y Línea Base la meta del año, aquí aparece el avance por grupo de material.</p>')+'</div>';
  $('#themes').innerHTML=TEMAS.map(t=>{const ks=t.ks.filter(k=>k!=='K01');if(!ks.length)return '';return '<div class="tsec"><div class="sec-head"><div><h2>'+esc(t.n)+'</h2><p class="small muted" style="margin:2px 0 0">'+esc(t.d)+'</p></div></div><div class="cards">'+ks.map(k=>cardHTML(k,recs,y)).join('')+'</div></div>';}).join('');
  $('#comp-body').innerHTML=COMPLEMENTARIOS.map(k=>{const d=K[k];const r=calcK(k,y,recs);const u=(!r||r.valor==null)?ultimo(k,recs,y):null;
    const val=r&&r.valor!=null?fmt(r.valor,d.u):u?fmt(u.r.valor,d.u):'—';const yy=r&&r.valor!=null?y:u?u.y:'—';
    return '<tr class="click" data-k="'+k+'"><td><b>'+esc(d.n)+'</b></td><td class="small">'+esc(RES[d.re])+'</td><td class="num">'+esc(val)+'</td><td>'+yy+'</td><td>'+statusChip(k,r,y,u)+'</td><td class="small">'+esc(d.baseRef||'—')+'</td></tr>';}).join('');
  renderSalud(recs);
}
function renderSalud(recs){
  const y=S.year,all=S.reportes,sup=superseded();
  const pend=all.filter(r=>!sup.has(r.id)&&estadoDe(r)==='pendiente').length,obs=all.filter(r=>!sup.has(r.id)&&estadoDe(r)==='observado').length;
  const conDato=TITULARES.filter(k=>{const r=calcK(k,y,recs);return r&&r.valor!=null;}).length,val=all.filter(r=>estadoDe(r)==='validado').length;
  $('#health').innerHTML='<div class="h"><b>'+conDato+' de 12</b><span>indicadores con dato en '+y+'</span></div><div class="h"><b>'+pend+'</b><span>reportes por validar</span></div><div class="h"><b>'+obs+'</b><span>reportes observados por corregir</span></div><div class="h"><b>'+(all.length?nf(val/all.length*100,0)+' %':'—')+'</b><span>de los reportes ya validados</span></div>';
  $('#fresh-body').innerHTML=Object.keys(PARTES).map(p=>{const mine=all.filter(r=>r.quien===p);const minF=Object.keys(VARS).filter(v=>VARS[v].q.indexOf(p)>=0).map(v=>VARS[v].fr).sort((a,b)=>FREQ_DIAS[a]-FREQ_DIAS[b])[0]||'Anual';
    if(!mine.length)return '<tr><td>'+esc(PARTES[p].n)+'</td><td>—</td><td>—</td><td>'+minF+'</td><td><span class="chip c-none">Sin reportes</span></td></tr>';
    const lastTs=mine.reduce((m,r)=>r.ts>m?r.ts:m,''),lastC=mine.reduce((m,r)=>r.corte>m?r.corte:m,'');const age=dias(lastC);
    return '<tr><td>'+esc(PARTES[p].n)+'</td><td>'+fecha(lastTs)+'</td><td>'+fecha(lastC)+'</td><td>'+minF+'</td><td>'+(age<=FREQ_DIAS[minF]?'<span class="chip c-ok">Al día</span>':'<span class="chip c-warn">Atrasada '+nf(age-FREQ_DIAS[minF],0)+' días</span>')+'</td></tr>';}).join('');
}

/* ---------------- detalle / ficha ---------------- */
function fichaDL(k){const d=K[k];const rows=[['Pregunta',d.q],['Fórmula',d.f],['Unidad',d.u],['Resultado estratégico',(d.re==='CTX'?'Contexto':d.re+' · '+RES[d.re])+(RE_NOTE[d.re]?' ('+RE_NOTE[d.re]+')':'')],['Rol',d.rol],['Periodicidad',d.per],['Responsable',d.resp],['Fuente',d.fuente],['Desagregación',d.desag],['Regla',d.regla],['Datos que lo alimentan',varsDeK(k).map(v=>VARS[v].n+' ('+VARS[v].q.map(areaN).join(', ')+')').join(' · ')],['Registros de la matriz',d.matriz],['Disponibilidad en la matriz',d.disp],['Equivalencia en la Ruta del Dato',d.ruta],['Comparabilidad',d.comp]];
  return '<dl class="f">'+rows.filter(r=>r[1]).map(r=>'<dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd>').join('')+'</dl>';}
function abrirDetalle(k){
  const d=K[k];$('#dlg-title-wrap').innerHTML='<span class="re-tag">'+(numK(k)>0?'Indicador '+numK(k)+' · ':'')+esc(d.rol)+' · '+esc(d.re==='CTX'?'Contexto':d.re+' '+RES[d.re])+'</span><h2 id="dlg-title" style="margin-top:2px">'+esc(d.n)+'</h2><p class="small muted" style="margin:2px 0 0">'+esc(d.q)+'</p>';
  let h='';
  if(S.rol){const recs=efectivos();let y=S.year,r=calcK(k,y,recs);const pts=serie(k,recs);
    if(!r||r.valor==null){const u=ultimo(k,recs,y);if(u){h+='<div class="msg info">No hay dato para '+y+'. Se muestra '+u.y+', el último año con dato.</div>';y=u.y;r=u.r;}}
    const prev=calcK(k,y-1,recs),meta=metaDe(k,y);
    h+='<div class="kpis"><div><b>'+esc(r&&r.valor!=null?fmt(r.valor,d.u):'—')+'</b><span>Valor '+y+(r&&r.pend?' · incluye pendientes':'')+'</span></div><div><b>'+esc(prev&&prev.valor!=null?fmt(prev.valor,d.u):'—')+'</b><span>Valor '+(y-1)+'</span></div><div><b>'+esc(meta!=null?fmt(meta,d.u):'Por definir')+'</b><span>Meta '+y+'</span></div><div><b>'+esc(d.baseRef||'—')+'</b><span>Punto de partida</span></div></div>';
    if(k==='K01'&&r&&r.grupos&&r.grupos.length)h+='<div>'+barrasK01(r,y)+'</div>';
    h+='<div><h3 style="margin-bottom:8px">Evolución por año</h3>'+columnas(pts,d.u,meta)+'</div>';
    h+='<div><h3 style="margin-bottom:8px">Cómo se calcula</h3><div class="formula">'+esc(d.f)+'</div><div class="tw" style="margin-top:10px"><table><thead><tr><th>Dato</th><th>Lo reporta</th><th class="num">Valor '+y+'</th><th>Reportes que entran</th></tr></thead><tbody>'+
      varsDeK(k).map(v=>{const a=valVar(v,y,recs);return '<tr><td>'+esc(VARS[v].n)+'</td><td class="small">'+esc(VARS[v].q.map(areaN).join(', '))+'</td><td class="num">'+esc(a&&a.total!=null?fmt(a.total,VARS[v].u):'—')+'</td><td class="small">'+(a?a.list.length+(a.natrib?' ('+a.natrib+' como atribución)':''):'0')+'</td></tr>';}).join('')+'</tbody></table></div></div>';
    const vs=varsDeK(k),sup=superseded();const orig=S.reportes.filter(x=>vs.indexOf(x.v)>=0&&x.anio===y).sort((a,b)=>b.ts.localeCompare(a.ts));
    h+='<div><h3 style="margin-bottom:8px">Reportes de origen ('+y+')</h3>'+(orig.length?'<div class="tw"><table><thead><tr><th>Dato</th><th>Corte</th><th class="num">Valor</th><th>Detalle</th><th>Fuente y evidencia</th><th>Quién</th><th>Estado</th></tr></thead><tbody>'+
      orig.map(x=>'<tr><td class="small">'+esc(VARS[x.v].n)+'</td><td>'+fecha(x.corte)+'</td><td class="num">'+esc(fmt(x.valor,VARS[x.v].u))+'</td><td class="small">'+esc(desagTxt(x))+'</td><td class="small">'+esc(x.fuente||'')+(x.evidencia?'<br><span class="muted">'+esc(x.evidencia)+'</span>':'')+(x.nota?'<br><span class="muted">'+esc(x.nota)+'</span>':'')+'</td><td class="small">'+esc(x.por||'')+'<br><span class="muted">'+esc(areaN(x.quien))+'</span></td><td>'+chipEstado(sup.has(x.id)?'reemplazado':estadoDe(x))+'</td></tr>').join('')+'</tbody></table></div>':'<p class="small muted">No hay reportes para '+y+'.</p>')+'</div>';
  } else h+='<div class="msg info">Para ver las cifras vivas, ingresa con el código del equipo. La ficha está abajo.</div>';
  if(d.base&&d.base.length)h+='<div><h3 style="margin-bottom:8px">Cifras de partida</h3><div class="tw"><table><tbody>'+d.base.map(b=>'<tr><td>'+esc(b[0])+'</td><td class="num">'+esc(b[1])+'</td></tr>').join('')+'</tbody></table></div><p class="small muted" style="margin:6px 0 0">'+esc(d.baseFu)+(d.junta?' '+esc(d.junta):'')+'</p></div>';
  h+='<div><h3 style="margin-bottom:8px">Ficha</h3><div class="tw">'+fichaDL(k)+'</div></div>';
  $('#dlg-body').innerHTML=h;abrir('#dlg');
}
function abrir(sel){const d=$(sel);try{if(!d.open)d.showModal();}catch(e){d.setAttribute('open','');}}
function cerrar(sel){const d=$(sel);try{d.close();}catch(e){d.removeAttribute('open');}}

/* ---------------- REPORTAR ---------------- */
const opts=(arr,sel)=>arr.map(a=>'<option'+(a===sel?' selected':'')+'>'+esc(a)+'</option>').join('');
function initReportar(){
  $('#parties').innerHTML=Object.keys(PARTES).map(p=>'<button type="button" class="party" data-p="'+p+'" aria-pressed="'+(S.party===p)+'">'+esc(PARTES[p].n)+'</button>').join('');
  const yrs=ANIOS.slice().reverse().map(a=>'<option'+(a===S.rYear?' selected':'')+'>'+a+'</option>').join('');
  $('#r-anio').innerHTML=yrs;$('#f-anio').innerHTML=yrs;$('#sel-anio').innerHTML=ANIOS.slice().reverse().map(a=>'<option'+(a===S.year?' selected':'')+'>'+a+'</option>').join('');
  $('#f-material').innerHTML=opts(C.MATERIALES);$('#f-linea').innerHTML=opts(C.LINEAS);$('#f-nivel').innerHTML='<option value="">Sin especificar</option>'+opts(C.NIVELES);
  $('#dl-terr').innerHTML=C.TERR.map(t=>'<option value="'+esc(t)+'">').join('');
  $('#f-nombre').value=S.nombre;
}
function estadoDato(v,area,y){
  const sup=superseded();const rs=S.reportes.filter(r=>r.v===v&&r.quien===area&&r.anio===y&&!sup.has(r.id)).sort((a,b)=>(b.corte+b.ts).localeCompare(a.corte+a.ts));
  if(!rs.length)return {st:'falta'};const last=rs[0];
  if(y<ANIO_ACT)return {st:'ok',last,n:rs.length};
  return {st:dias(last.corte)<=FREQ_DIAS[VARS[v].fr]?'ok':'vencido',last,n:rs.length};
}
function renderReportar(){
  $$('.party').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.p===S.party)));
  $('#ws2').classList.toggle('off',!S.party);
  if(!S.party){$('#ws2-title').textContent='Lo que te toca reportar';$('#ws2-sub').textContent='Elige tu área arriba para ver tu lista.';$('#todo-body').innerHTML='<tr><td colspan="5" class="empty">Elige tu área para ver los datos que te corresponden.</td></tr>';}
  else{const y=S.rYear;const vs=Object.keys(VARS).filter(v=>VARS[v].q.indexOf(S.party)>=0);
    $('#ws2-title').textContent='Lo que le toca reportar a '+PARTES[S.party].n;$('#ws2-sub').textContent=vs.length+' datos. Toca "Reportar" en cada uno; cada dato alimenta uno o varios indicadores.';
    $('#todo-body').innerHTML=vs.map(v=>{const e=estadoDato(v,S.party,y);const ks=C.TITULARES.concat(C.COMPLEMENTARIOS,C.CONTEXTO).filter(k=>varsDeK(k).indexOf(v)>=0);
      const st=e.st==='falta'?'<span class="chip c-warn">Sin reporte '+y+'</span>':e.st==='vencido'?'<span class="chip c-warn">Toca actualizar</span>':'<span class="chip c-ok">Al día</span>';
      return '<tr><td><b>'+esc(VARS[v].n)+'</b><br><span class="small muted">Alimenta: '+esc(ks.map(k=>K[k].n).join(' · '))+'</span></td><td class="small">'+VARS[v].fr+'</td><td class="small">'+(e.last?esc(fmt(e.last.valor,VARS[v].u))+'<br><span class="muted">corte '+fecha(e.last.corte)+(e.n>1?' · '+e.n+' reportes':'')+'</span>':'—')+'</td><td>'+st+(e.last?' '+chipEstado(estadoDe(e.last)):'')+'</td><td><button class="btn small primary" type="button" data-rep="'+v+'">Reportar</button></td></tr>';}).join('');}
  const mine=S.reportes.filter(r=>S.nombre&&r.por===S.nombre).sort((a,b)=>b.ts.localeCompare(a.ts)).slice(0,15);const sup=superseded();
  $('#mine-body').innerHTML=mine.length?mine.map(r=>'<tr><td>'+fecha(r.ts)+'</td><td>'+esc(VARS[r.v].n)+'</td><td>'+r.anio+' · '+fecha(r.corte)+'</td><td class="num">'+esc(fmt(r.valor,VARS[r.v].u))+'</td><td class="small">'+esc(desagTxt(r))+'</td><td>'+chipEstado(sup.has(r.id)?'reemplazado':estadoDe(r))+(S.valid[r.id]&&S.valid[r.id].comentario?'<br><span class="small muted">'+esc(S.valid[r.id].comentario)+'</span>':'')+'</td></tr>').join(''):'<tr><td colspan="6" class="empty">'+(S.nombre?'Aún no has enviado reportes con el nombre "'+esc(S.nombre)+'".':'Escribe tu nombre arriba para ver tus reportes.')+'</td></tr>';
}
function abrirReporte(v){
  const def=VARS[v];if(!def)return;
  if(!S.nombre){$('#f-nombre').focus();$('#f-nombre').setAttribute('placeholder','Escribe tu nombre antes de reportar');return;}
  S.repVar=v;$('#rep-code').textContent=PARTES[S.party].n;$('#rep-title').textContent=def.n;
  const ks=C.TITULARES.concat(C.COMPLEMENTARIOS,C.CONTEXTO).filter(k=>varsDeK(k).indexOf(v)>=0);
  $('#rep-explain').innerHTML='<div><b>Qué es:</b> '+esc(def.def)+'</div><div><b>Ejemplo:</b> '+esc(def.ej)+'</div><div class="small muted">Unidad: '+esc(def.u)+' · Frecuencia: '+esc(def.fr.toLowerCase())+' · Alimenta: '+esc(ks.map(k=>K[k].n).join(', '))+'</div>';
  ['material','linea','territorio','nivel','cat','metodo','incluido'].forEach(f=>{$('#w-'+f).hidden=def.ds.indexOf(f)<0;});
  if(def.cat)$('#f-cat').innerHTML='<option value="">Sin desagregar</option>'+opts(def.cat);
  $('#f-anio').value=String(S.rYear);$('#f-corte').value=S.rYear<ANIO_ACT?S.rYear+'-12-31':HOY_ISO;$('#f-corte').max=HOY_ISO;
  $('#f-valor').value='';$('#f-unit').textContent=def.u;$('#f-fuente').value=def.fu;$('#f-evid').value='';$('#f-nota').value='';$('#f-territorio').value='';$('#f-metodo').value='';$('#f-incluido').checked=false;
  if(S.party==='IMP'&&v==='V03')$('#f-linea').value='Consolidado del colectivo (Traza)';
  fillCorrige();$('#rep-msg').innerHTML='';$('#btn-send').disabled=false;$('#btn-send').textContent='Enviar reporte';
  abrir('#dlg-rep');setTimeout(()=>{try{$('#f-valor').focus();}catch(e){}},50);
}
function fillCorrige(){
  const v=S.repVar,a=+$('#f-anio').value,sup=superseded();
  const prev=S.reportes.filter(r=>r.v===v&&r.anio===a&&!sup.has(r.id)).sort((x,y)=>y.ts.localeCompare(x.ts));
  $('#f-corrige').innerHTML='<option value="">No, es un reporte nuevo</option>'+prev.map(r=>'<option value="'+esc(r.id)+'">'+esc(fecha(r.corte)+' · '+fmt(r.valor,VARS[r.v].u)+' · '+desagTxt(r)+' · '+(r.por||'')+' · '+estadoDe(r))+'</option>').join('');
}
async function enviar(e){
  e.preventDefault();const msg=$('#rep-msg'),v=S.repVar,def=VARS[v];
  const valor=parseFloat(String($('#f-valor').value).replace(',','.')),anio=+$('#f-anio').value,corte=$('#f-corte').value,fuente=$('#f-fuente').value.trim();
  const errs=[];
  if(!isFinite(valor))errs.push('Escribe el valor como número, sin puntos de miles.');else if(valor<0&&!def.neg)errs.push('Este dato no puede ser negativo.');
  if(!corte)errs.push('Indica la fecha de corte.');else if(corte>HOY_ISO)errs.push('La fecha de corte no puede ser futura.');else if(+corte.slice(0,4)<anio)errs.push('La fecha de corte es anterior al año del dato.');
  if(!fuente)errs.push('Indica la fuente.');
  if(errs.length){msg.innerHTML='<div class="msg bad">'+errs.map(esc).join('<br>')+'</div>';return;}
  const o={v,anio,corte,valor,quien:S.party,fuente,por:S.nombre};const put=(f,val)=>{if(val!==''&&val!=null&&val!==false)o[f]=val;};
  if(def.ds.indexOf('material')>=0)put('material',$('#f-material').value);
  if(def.ds.indexOf('linea')>=0)put('linea',$('#f-linea').value);
  if(def.ds.indexOf('territorio')>=0)put('territorio',$('#f-territorio').value.trim());
  if(def.ds.indexOf('nivel')>=0)put('nivel',$('#f-nivel').value);
  if(def.ds.indexOf('cat')>=0)put('cat',$('#f-cat').value);
  if(def.ds.indexOf('metodo')>=0)put('metodo',$('#f-metodo').value.trim());
  if(def.ds.indexOf('incluido')>=0)put('incluido',$('#f-incluido').checked);
  put('evidencia',$('#f-evid').value.trim());put('nota',$('#f-nota').value.trim());put('corrige',$('#f-corrige').value);
  let aviso='';const pv=valVar(v,anio-1,efectivos());if(pv){const same=pv.list.find(r=>keyOf(r)===keyOf(o));if(same&&same.valor&&Math.abs(valor-same.valor)/Math.abs(same.valor)>.5&&!o.nota)aviso='Este valor cambia más de 50 % frente a '+(anio-1)+' ('+fmt(same.valor,def.u)+'). Si no es un error, explica el cambio en una corrección.';}
  $('#btn-send').disabled=true;$('#btn-send').textContent='Enviando…';
  try{await api('/api/reportes',o);await cargar();renderTodo();
    msg.innerHTML='<div class="msg ok">Listo: reporte enviado. Queda pendiente de validación y ya cuenta en el tablero como dato pendiente.</div>'+(aviso?'<div class="msg warn" style="margin-top:8px">'+esc(aviso)+'</div>':'')+'<div class="toolbar" style="margin-top:10px"><button class="btn primary" type="button" data-close="dlg-rep">Volver a mi lista</button></div>';
    $('#btn-send').textContent='Enviado';
  }catch(err){msg.innerHTML='<div class="msg bad">'+esc(err.message)+'</div>';$('#btn-send').disabled=false;$('#btn-send').textContent='Enviar reporte';}
}

/* ---------------- VALIDAR ---------------- */
function renderValidar(){
  const sup=superseded();const pend=S.reportes.filter(r=>!sup.has(r.id)&&estadoDe(r)==='pendiente').sort((a,b)=>b.ts.localeCompare(a.ts));
  const c=$('#cnt-pend');c.hidden=!pend.length||!S.rol;c.textContent=pend.length;
  if(!S.rol)return;
  $('#pend-count').textContent=pend.length?pend.length+' por revisar':'';const dis=S.rol==='validador'?'':' disabled';
  $('#pend-body').innerHTML=pend.length?pend.map(r=>'<tr><td>'+fecha(r.ts)+'</td><td class="small">'+esc(r.por||'')+'<br><span class="muted">'+esc(areaN(r.quien))+'</span></td><td>'+esc(VARS[r.v].n)+(r.corrige?'<br><span class="small muted">Corrige un reporte anterior</span>':'')+'</td><td>'+r.anio+' · '+fecha(r.corte)+'</td><td class="num">'+esc(fmt(r.valor,VARS[r.v].u))+'</td><td class="small">'+esc(desagTxt(r))+'</td><td class="small">'+esc(r.fuente||'')+(r.evidencia?'<br><span class="muted">'+esc(r.evidencia)+'</span>':'<br><span class="chip c-warn">Sin evidencia</span>')+(r.nota?'<br><span class="muted">'+esc(r.nota)+'</span>':'')+'</td><td><div style="display:grid;gap:6px;min-width:180px"><input type="text" id="obs-'+esc(r.id)+'" placeholder="Comentario (obligatorio para observar)" aria-label="Comentario de validación"'+dis+'><div style="display:flex;gap:6px"><button class="btn small ok" type="button" data-val="validado" data-id="'+esc(r.id)+'"'+dis+'>Validar</button><button class="btn small bad" type="button" data-val="observado" data-id="'+esc(r.id)+'"'+dis+'>Observar</button></div></div></td></tr>').join(''):'<tr><td colspan="8" class="empty">No hay reportes pendientes.</td></tr>';
  $('#metas-body').innerHTML=TITULARES.concat(COMPLEMENTARIOS).map(k=>{const d=K[k];return '<tr><td><b>'+esc(d.n)+'</b></td><td class="small">'+esc(d.u)+'</td><td class="small">'+(d.pol>0?'Más es mejor':'Menos es mejor')+'</td>'+[2026,2027].map(a=>{const m=S.metas[k+'-'+a];return '<td class="num"><input type="number" step="any" style="width:120px;text-align:right" data-meta="'+k+'-'+a+'" value="'+(m?m.valor:'')+'" placeholder="'+(k==='K01'?'100':'—')+'" aria-label="Meta '+esc(d.n)+' '+a+'"'+dis+'></td>';}).join('')+'</tr>';}).join('');
  const all=S.reportes.slice().sort((a,b)=>b.ts.localeCompare(a.ts));
  $('#log-body').innerHTML=all.length?all.map(r=>{const v=S.valid[r.id];return '<tr><td>'+fecha(r.ts)+'</td><td class="small">'+esc(r.por||'')+'<br><span class="muted">'+esc(areaN(r.quien))+'</span></td><td>'+esc(VARS[r.v].n)+(r.corrige?'<br><span class="small muted">Corrige un reporte anterior</span>':'')+'</td><td>'+r.anio+' · '+fecha(r.corte)+'</td><td class="num">'+esc(fmt(r.valor,VARS[r.v].u))+'</td><td>'+chipEstado(sup.has(r.id)?'reemplazado':estadoDe(r))+'</td><td class="small">'+(v?esc(v.por||'')+' · '+fecha(v.ts)+(v.comentario?'<br><span class="muted">'+esc(v.comentario)+'</span>':''):'—')+'</td></tr>';}).join(''):'<tr><td colspan="7" class="empty">La bitácora está vacía.</td></tr>';
}
async function validar(id,estado,btn){
  const inp=document.getElementById('obs-'+id),com=inp?inp.value.trim():'';
  if(estado==='observado'&&!com){if(inp){inp.focus();inp.placeholder='Escribe qué hay que corregir';}return;}
  btn.disabled=true;
  try{await api('/api/validaciones',{id,estado,comentario:com,por:S.nombre||'Sistemas de Información'});await cargar();renderTodo();}
  catch(e){btn.disabled=false;const n=$('#val-note');n.hidden=false;n.className='msg bad';n.textContent=e.message;}
}
async function guardarMeta(id,raw,el){
  const val=raw===''?null:parseFloat(String(raw).replace(',','.'));if(val!==null&&!isFinite(val))return;
  try{await api('/api/metas',{id,valor:val,por:S.nombre||'Sistemas de Información'});await cargar();renderTablero();el.style.borderColor='var(--ok)';}
  catch(e){el.style.borderColor='var(--bad)';const n=$('#val-note');n.hidden=false;n.className='msg bad';n.textContent=e.message;}
}

/* ---------------- METODOLOGÍA ---------------- */
function score(k){const s=K[k].s,w=S.w,tw=w.A+w.R+w.D+w.C+w.T;return tw?(s.A*w.A+s.R*w.R+s.D*w.D+s.C*w.C+s.T*w.T)/(5*tw)*100:0;}
function renderMetodologia(){
  $('#findings').innerHTML=C.FINDINGS.map(f=>'<div class="finding"><h3>'+esc(f[0])+'</h3><p>'+esc(f[1])+'</p><span class="k">'+esc(f[2].replace(/K(\d\d)/g,(m,n)=>K[m]&&numK(m)>0?'#'+numK(m)+' '+K[m].n:K[m]?K[m].n:m))+'</span></div>').join('');
  let t='<thead><tr><th>Línea y visión</th>'+C.COT_COLS.map(c=>'<th title="'+esc(RES[c])+'">'+c+'<br><span style="text-transform:none;letter-spacing:0;font-family:var(--body);font-weight:600">'+esc(RES[c])+'</span></th>').join('')+'</tr></thead><tbody>';
  t+=C.LINEAS_J.map(l=>'<tr><td class="ln"><b>'+esc(l.n)+'</b><br><span class="small muted">'+esc(l.v)+'</span></td>'+C.COT_COLS.map(c=>{const x=l.c[c];if(!x)return '<td class="muted">—</td>';return '<td class="'+(x.g?'gap':x.j?'hit':'')+'">'+(x.j?'<span class="j">'+esc(x.j)+'</span>':'')+(x.m?'<span class="m">'+esc(x.m)+'</span>':'')+'</td>';}).join('')+'</tr>').join('');
  t+='<tr><td class="ln"><b>Indicador titular propuesto</b></td>'+C.COT_COLS.map(c=>{const ks=TITULARES.filter(k=>K[k].re===c);return '<td><span class="j">'+esc(ks.map(k=>'#'+numK(k)).join(' · ')||'—')+'</span><span class="m">'+esc(ks.map(k=>K[k].n).join(' / '))+'</span></td>';}).join('')+'</tr></tbody>';
  $('#cotejo').innerHTML=t;
  const lab={A:'Alineación con la visión',R:'Relevancia REP y ANLA',D:'Disponibilidad del dato',C:'Comparabilidad',T:'Atribución sin doble conteo'};
  $('#weights').innerHTML=Object.keys(lab).map(c=>'<label for="w-'+c+'"><span>'+c+' · '+lab[c]+'<output id="wo-'+c+'">'+S.w[c]+'</output></span><input type="range" id="w-'+c+'" min="0" max="40" step="5" value="'+S.w[c]+'" data-w="'+c+'"></label>').join('');
  renderRank();renderTZ();renderFichas();
  $('#dic-body').innerHTML=Object.keys(VARS).map(v=>{const d=VARS[v];const ks=TITULARES.concat(COMPLEMENTARIOS,CONTEXTO).filter(k=>varsDeK(k).indexOf(v)>=0);return '<tr><td class="code">'+v+'</td><td><b>'+esc(d.n)+'</b><br><span class="small muted">'+esc(d.def)+'</span></td><td class="small">'+esc(d.u)+'</td><td class="small">'+esc(d.q.map(areaN).join(', '))+'</td><td class="small">'+d.fr+'</td><td class="small">'+esc(d.ds.map(x=>({material:'material',linea:'línea',territorio:'territorio',nivel:'nivel de jerarquía',cat:(d.cat||[]).join(' / '),metodo:'método',incluido:'¿incluida en Traza?'})[x]).join(' · ')||'—')+'</td><td class="small">'+esc(ks.map(k=>K[k].n).join(' · '))+'</td></tr>';}).join('');
}
function renderRank(){
  const rows=RANKED.map(k=>({k,s:score(k)})).sort((a,b)=>b.s-a.s);
  $('#rank-body').innerHTML=rows.map((r,i)=>{const d=K[r.k];const rc=d.brecha?'c-warn':d.rol==='Complementario'?'c-none':'c-acc';
    return '<tr class="click" data-k="'+r.k+'"><td class="num">'+(i+1)+'</td><td><b>'+esc(d.n)+'</b></td><td class="small">'+esc(d.re==='ANCLA'?'Ancla REP':d.re)+'</td><td><span class="chip '+rc+'">'+esc(d.rol)+'</span></td>'+['A','R','D','C','T'].map(c=>'<td><span class="sc sc'+d.s[c]+'">'+d.s[c]+'</span></td>').join('')+'<td><div class="bar-score"><i style="width:'+Math.round(r.s*0.8)+'px"></i><span class="mono small">'+nf(r.s,0)+'</span></div></td><td class="small muted">'+esc(d.pq)+'</td></tr>';}).join('');
}
function renderTZ(){
  const decs=['Todos','Titular','Complementario','Insumo','Desagregación','Fusionar','Ajustar','Operativo','Sale de RE','Contexto','Nuevo trazador'];
  $('#tz-filters').innerHTML=decs.map(d=>{const n=d==='Todos'?C.TZ.length:C.TZ.filter(r=>r[7]===d).length;return n?'<button class="filt" type="button" data-f="'+esc(d)+'" aria-pressed="'+(S.tzFilter===d)+'">'+esc(d)+' '+n+'</button>':'';}).join('');
  const cls={Titular:'c-acc',Complementario:'c-green','Nuevo trazador':'c-warn','Sale de RE':'c-bad',Operativo:'c-none'};
  const dest=s=>s.replace(/K(\d\d)|X\d/g,m=>K[m]?K[m].n:m);
  $('#tz-body').innerHTML=C.TZ.filter(r=>S.tzFilter==='Todos'||r[7]===S.tzFilter).map(r=>'<tr><td class="code">'+esc(r[0])+'</td><td class="small">'+esc(C.HOJAS[r[1]])+'</td><td>'+esc(r[2])+'</td><td class="code">'+esc(r[4])+'</td><td class="small">'+esc(r[5])+'</td><td class="small">'+esc(dest(r[6]))+'</td><td><span class="chip '+(cls[r[7]]||'c-pend')+'">'+esc(r[7])+'</span></td><td class="small muted">'+esc(r[8])+'</td></tr>').join('');
}
function renderFichas(){
  const q=($('#f-buscar').value||'').toLowerCase();
  const ks=TITULARES.concat(COMPLEMENTARIOS,CONTEXTO).filter(k=>!q||(K[k].n+' '+K[k].matriz+' '+(RES[K[k].re]||'')+' '+K[k].q).toLowerCase().indexOf(q)>=0);
  $('#fichas').innerHTML=ks.length?ks.map(k=>{const d=K[k];return '<details class="ficha"><summary><span class="re-tag">'+(numK(k)>0?'#'+numK(k):d.rol==='Complementario'?'Comp.':'Ctx.')+'</span><span class="nm">'+esc(d.n)+'</span><span class="chip '+(d.rol==='Contexto'?'c-none':d.rol==='Complementario'?'c-green':'c-acc')+'">'+esc(d.rol)+'</span></summary>'+fichaDL(k)+'</details>';}).join(''):'<p class="muted">Ningún indicador coincide con la búsqueda.</p>';
}

/* ---------------- CSV ---------------- */
function exportarCSV(){
  const sup=superseded();const head=['id','fecha_reporte','area','persona','dato_codigo','dato','unidad','anio','fecha_corte','valor','material','linea','territorio','nivel_jerarquia','desagregacion','incluida_en_traza','metodo','fuente','evidencia','nota','estado','validado_por','fecha_validacion','comentario_validacion','corrige_a'];
  const q=s=>{s=String(s==null?'':s);return /[";\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
  const lines=[head.join(';')].concat(S.reportes.slice().sort((a,b)=>a.ts.localeCompare(b.ts)).map(r=>{const v=S.valid[r.id]||{};return [r.id,r.ts,areaN(r.quien),r.por,r.v,VARS[r.v].n,VARS[r.v].u,r.anio,r.corte,String(r.valor).replace('.',','),r.material,r.linea,r.territorio,r.nivel,r.cat,r.incluido?'sí':'',r.metodo,r.fuente,r.evidencia,r.nota,sup.has(r.id)?'reemplazado':estadoDe(r),v.por,v.ts,v.comentario,r.corrige].map(q).join(';');}));
  const blob=new Blob(['﻿'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='vision-circular-reportes-'+HOY_ISO+'.csv';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);
}

/* ---------------- navegación y eventos ---------------- */
function setTab(t,anchor){if(TABS.indexOf(t)<0)t='inicio';S.tab=t;$$('.tab-btn').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===t)));$$('section.tab').forEach(s=>{s.hidden=s.id!=='tab-'+t;});
  try{history.replaceState(null,'','#'+t);}catch(e){}
  if(anchor){const el=document.getElementById(anchor);if(el)setTimeout(()=>el.scrollIntoView({block:'start'}),30);}else window.scrollTo(0,0);}
function renderTodo(){renderAcceso();renderTablero();renderReportar();renderValidar();}
document.addEventListener('click',e=>{
  const t=e.target;
  const close=t.closest('[data-close]');if(close){cerrar('#'+close.dataset.close);return;}
  const tb=t.closest('.tab-btn');if(tb){setTab(tb.dataset.tab);return;}
  const go=t.closest('[data-go]');if(go){e.preventDefault();cerrar('#dlg');setTab(go.dataset.go,go.dataset.anchor);return;}
  const ar=t.closest('[data-area]');if(ar){S.party=ar.dataset.area;ls.set('vc-party',S.party);renderReportar();setTab('reportar');return;}
  const pb=t.closest('.party');if(pb){S.party=pb.dataset.p;ls.set('vc-party',S.party);renderReportar();return;}
  const rp=t.closest('[data-rep]');if(rp){abrirReporte(rp.dataset.rep);return;}
  const vb=t.closest('[data-val]');if(vb){validar(vb.dataset.id,vb.dataset.val,vb);return;}
  const fb=t.closest('.filt');if(fb){S.tzFilter=fb.dataset.f;renderTZ();return;}
  if(t.closest('[data-salir]')){salir();return;}
  if(t.closest('[data-cambiar]')){e.preventDefault();salir('Ingresa el código de validación.');setTab('validar');return;}
  if(t.closest('[data-refrescar]')){refrescar();return;}
  const kb=t.closest('[data-k]');if(kb){abrirDetalle(kb.dataset.k);return;}
});
document.addEventListener('submit',e=>{const f=e.target.closest('[data-login]');if(f){e.preventDefault();const inp=f.querySelector('input');ingresar(inp.value,f.parentNode.querySelector('[data-login-msg]'));}});
$('#rep-form').addEventListener('submit',enviar);
$('#f-anio').addEventListener('change',fillCorrige);
$('#f-nombre').addEventListener('change',e=>{S.nombre=e.target.value.trim();ls.set('vc-nombre',S.nombre);renderAcceso();renderReportar();});
$('#r-anio').addEventListener('change',e=>{S.rYear=+e.target.value;renderReportar();});
$('#sel-anio').addEventListener('change',e=>{S.year=+e.target.value;renderTablero();});
$('#chk-pend').addEventListener('change',e=>{S.incluirPend=e.target.checked;renderTablero();});
$('#btn-csv').addEventListener('click',exportarCSV);
$('#f-buscar').addEventListener('input',renderFichas);
$('#weights').addEventListener('input',e=>{const c=e.target.dataset.w;if(!c)return;S.w[c]=+e.target.value;$('#wo-'+c).textContent=S.w[c];ls.set('vc-w',JSON.stringify(S.w));renderRank();});
$('#btn-wreset').addEventListener('click',()=>{S.w=Object.assign({},W0);ls.set('vc-w',JSON.stringify(S.w));renderMetodologia();});
document.addEventListener('change',e=>{const m=e.target.dataset&&e.target.dataset.meta;if(m&&S.rol==='validador')guardarMeta(m,e.target.value,e.target);});
$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)cerrar('#'+d.id);}));
const tip=$('#tip');
document.addEventListener('pointermove',e=>{const t=e.target.closest&&e.target.closest('[data-tip]');if(!t){tip.hidden=true;return;}tip.textContent=t.getAttribute('data-tip');tip.hidden=false;const x=Math.min(e.clientX+14,window.innerWidth-tip.offsetWidth-8),y=e.clientY+16+tip.offsetHeight>window.innerHeight?e.clientY-tip.offsetHeight-10:e.clientY+16;tip.style.left=x+'px';tip.style.top=y+'px';});
window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(TABS.indexOf(h)>=0&&h!==S.tab)setTab(h);});
setInterval(()=>{if(S.rol&&!document.hidden&&!$('#dlg-rep').open)refrescar();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.rol&&S.ultimaCarga&&(new Date()-S.ultimaCarga)>60000)refrescar();});

/* ---------------- arranque ---------------- */
initReportar();renderInicio();renderMetodologia();setTab(S.tab);renderTodo();
if(S.codigo)refrescar();
})();
