/** Observed input only: no finger inference, documents or telemetry. */
const bounded=(n,lo=0,hi=1e9)=>Math.max(lo,Math.min(hi,Number(n)||0));
export const PROFILE_KEY='boring-office.profile.v2';
export function emptyProfile(){return {version:2,sessions:[],keys:{},patterns:{},confusions:{},achievements:[],trophies:[],perfectLevels:0,calibrated:false};}
export function migrateProfile(raw){
 const p=emptyProfile();if(!raw||![1,2].includes(raw.version))return p;
 p.sessions=Array.isArray(raw.sessions)?raw.sessions.filter(s=>s&&Number.isFinite(s.wpm)&&s.wpm>=0&&s.wpm<1000&&Number.isFinite(s.accuracy)&&s.accuracy>=0&&s.accuracy<=100&&Number.isFinite(s.seconds)).slice(-60).map(s=>({...s,seconds:bounded(s.seconds,0,86400)})):[];
 for(const name of ['keys','patterns','confusions'])for(const [key,value] of Object.entries(raw[name]||{}).slice(0,600)){
  if(!/^.{1,5}$/u.test(key)||['__proto__','constructor','prototype'].includes(key)||!value||typeof value!=='object')continue;
  p[name][key]={attempts:bounded(value.attempts),errors:bounded(value.errors,0,bounded(value.attempts)),latency:bounded(value.latency),samples:bounded(value.samples),due:bounded(value.due,0,1e15)};
 }
 for(const name of ['achievements','trophies'])p[name]=Array.isArray(raw[name])?[...new Set(raw[name].filter(x=>typeof x==='string'&&x.length<50))].slice(0,40):[];
 p.perfectLevels=bounded(raw.perfectLevels);p.calibrated=Boolean(raw.calibrated);return p;
}
export function loadProfile(storage){try{return migrateProfile(JSON.parse(storage.getItem(PROFILE_KEY)||storage.getItem('boring-office.profile.v1')||'null'));}catch{return emptyProfile();}}
export function saveProfile(p,storage){try{storage.setItem(PROFILE_KEY,JSON.stringify(p));return true;}catch{return false;}}
function entry(table,key){if(!Object.hasOwn(table,key))table[key]={attempts:0,errors:0,latency:0,samples:0,due:0};return table[key];}
export class SkillSession{
 constructor({now=Date.now(),profile=emptyProfile(),mode='campaign'}={}){this.profile=profile;this.mode=mode;this.started=now;this.attempts=0;this.errors=0;this.correct=0;this.corrections=0;this.reactions=[];this.latencies=[];this.window=[];this.keys={};this.patterns={};this.confusions={};this.previous='';this.lastTime=null;this.lastWord=null;this.bosses=[];}
 record({typed,expected,correct,time,wordId,reaction=null}){
  if(Number.isFinite(reaction)&&reaction>=0&&reaction<30000){this.reactions.push(reaction);if(this.reactions.length>100)this.reactions.shift();}
  this.attempts++;this.errors+=correct?0:1;this.correct+=correct?1:0;
  if(wordId!==this.lastWord){this.previous='';this.lastTime=null;this.lastWord=wordId;}
  const latency=this.lastTime===null?null:time-this.lastTime;this.lastTime=time;
  if(latency>0&&latency<=2000){this.latencies.push(latency);if(this.latencies.length>100)this.latencies.shift();}
  this.window.push({correct,time});if(this.window.length>50)this.window.shift();
  if(expected&&Array.from(expected).length===1){
   const key=entry(this.keys,expected);key.attempts++;if(!correct)key.errors++;
   if(latency>0&&latency<=2000){key.latency+=latency;key.samples++;}
   if(!correct&&typed!==expected){const pair=entry(this.confusions,`${expected}→${typed}`);pair.attempts++;pair.errors++;}
   for(let size=2;size<=3;size++){const pattern=(this.previous+expected).slice(-size);if(pattern.length===size){const stat=entry(this.patterns,pattern);stat.attempts++;if(!correct)stat.errors++;}}
   if(correct)this.previous=(this.previous+expected).slice(-2);
  }
 }
 correction(){this.corrections++;}
 get rollingAccuracy(){return this.window.length?this.window.filter(x=>x.correct).length/this.window.length:1;}
 pressure(current,dt,{fixed=false,mobile=false}={}){
  if(fixed)return 1;
  const recent=this.window.length>=15;const accuracy=this.rollingAccuracy;
  const median=this.latencies.length?[...this.latencies].sort((a,b)=>a-b)[Math.floor(this.latencies.length/2)]:300;
  const target=(recent?(accuracy<.8?.72:accuracy<.92?.9:median<220?1.16:1):1)*(mobile?.82:1);
  return Math.max(.65,Math.min(1.2,current+Math.max(-.035*dt,Math.min(.035*dt,target-current))));
 }
 finish({seconds,score=0,combo=0,won=false,date=new Date().toISOString()}){
  const p=this.profile,wpm=seconds>0?this.correct/5/(seconds/60):0,accuracy=this.attempts?100*this.correct/this.attempts:100;
  const previous=p.sessions.filter(s=>s.mode===this.mode).at(-1);
  const result={date,mode:this.mode,wpm,rawWpm:seconds>0?this.attempts/5/(seconds/60):0,accuracy,seconds,score,combo,correct:this.correct,errors:this.errors,corrections:this.corrections,reactionMs:this.reactions.length?this.reactions.reduce((a,b)=>a+b,0)/this.reactions.length:null,won,delta:previous?wpm-previous.wpm:null};
  for(const table of ['keys','patterns','confusions'])for(const [key,stat]of Object.entries(this[table])){const total=entry(p[table],key);for(const field of ['attempts','errors','latency','samples'])total[field]+=stat[field];total.due=Date.parse(date)+(stat.errors?86400000:3*86400000);}
  for(const table of ['keys','patterns','confusions']){const rows=Object.entries(p[table]);if(rows.length>600)p[table]=Object.fromEntries(rows.sort((a,b)=>b[1].attempts-a[1].attempts).slice(0,600));}
  p.sessions.push(result);p.sessions=p.sessions.slice(-60);if(this.mode==='calibration'&&seconds>=45&&this.attempts>=20)p.calibrated=true;
  p.trophies=[...new Set([...p.trophies,...this.bosses])];return result;
 }
}
export function weakPatterns(profile,now=Date.now()){
 return Object.entries(profile.patterns).filter(([pattern,s])=>s.attempts>=3&&s.errors>0&&s.due<=now).sort((a,b)=>(b[1].errors/b[1].attempts)-(a[1].errors/a[1].attempts)).slice(0,3).map(([pattern])=>pattern);
}
export function practiceWords(words,profile,now=Date.now()){
 const weak=weakPatterns(profile,now);if(!weak.length)return words;
 const boosted=words.filter(w=>weak.some(pattern=>w.toLowerCase().includes(pattern.toLowerCase())));
 // At most one targeted word in four; never rewrite personal documents.
 return words.flatMap((word,index)=>index%4===3&&boosted.length?[word,boosted[index%boosted.length]]:[word]);
}
export const ACHIEVEMENTS=[{id:'perfect',name:'SEM ERROS',test:p=>p.perfectLevels>=1},{id:'flow',name:'CAFÉ NAS VEIAS',test:p=>p.sessions.some(s=>s.combo>=50)},{id:'speed',name:'TECLADO HUMANO',test:p=>p.sessions.some(s=>s.wpm>=60&&s.accuracy>=95&&s.seconds>=30&&s.correct>=30)},{id:'daily',name:'RELATÓRIO ENTREGUE',test:p=>p.sessions.some(s=>s.mode==='daily'&&s.won)},{id:'printer',name:'PAPEL ENCRAVADO? NÃO.',test:p=>p.trophies.includes('printer')},{id:'monday',name:'HOJE NÃO, SEGUNDA-FEIRA',test:p=>p.trophies.includes('monday')},{id:'retro',name:'1993 LIGOU',test:p=>p.sessions.some(s=>s.mode==='retro'&&s.correct>=100)}];
export function unlockAchievements(p){const added=ACHIEVEMENTS.filter(a=>!p.achievements.includes(a.id)&&a.test(p));p.achievements.push(...added.map(a=>a.id));return added;}
export function career(p){const good=p.sessions.filter(s=>s.correct>=30&&s.accuracy>=90&&s.seconds>=30);const best=Math.max(0,...good.map(s=>s.wpm));const rank=p.trophies.includes('monday')?4:best>=60?3:best>=40?2:good.length?1:0;return {rank,bestWpm:best,title:['ESTAGIÁRIO DO CAOS','OPERADOR DE EMAIL','FUGITIVO DAS REUNIÕES','ESPECIALISTA DO TECLADO','DESTRUIDOR DE SEGUNDAS'][rank],next:['30 teclas · 90% precisão','40 WPM · 90% precisão','60 WPM · 90% precisão','Derrota a Segunda-feira','Domina o teu próximo recorde'][rank]};}
