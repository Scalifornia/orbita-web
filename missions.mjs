/** Original office vocabulary and deterministic, backend-free missions. */
export const OFFICE_WORDS={
 en:'email coffee meeting deadline printer report reply urgent budget calendar manager monday spreadsheet invoice password keyboard office overtime agenda attachment notification approval feedback lunch project delivery contract client change silence focus work break',
 pt:'email café reunião prazo impressora relatório resposta urgente orçamento calendário chefe segunda planilha fatura palavra teclado escritório horas agenda anexo notificação aprovação opinião almoço projeto entrega contrato cliente alteração silêncio foco trabalho pausa',
 fr:'email café réunion délai imprimante rapport réponse urgent budget calendrier chef lundi tableau facture passe clavier bureau heures agenda pièce notification accord avis déjeuner projet livraison contrat client changement silence attention travail pause',
 de:'Email Kaffee Meeting Frist Drucker Bericht Antwort dringend Budget Kalender Chef Montag Tabelle Rechnung Passwort Tastatur Büro Überstunden Agenda Anhang Meldung Freigabe Feedback Mittag Projekt Lieferung Vertrag Kunde Änderung Ruhe Fokus Arbeit Pause',
 es:'email café reunión plazo impresora informe respuesta urgente presupuesto calendario jefe lunes tabla factura contraseña teclado oficina horas agenda adjunto notificación aprobación opinión almuerzo proyecto entrega contrato cliente cambio silencio foco trabajo pausa'};
export const RUNS=Object.freeze({campaign:{seconds:0},quick:{seconds:120},coffee:{seconds:300},mission:{seconds:600},endless:{seconds:0},train:{seconds:120},calibration:{seconds:60},daily:{seconds:120},boss:{seconds:0},retro:{seconds:120}});
export function seedHash(text){let n=2166136261;for(const c of String(text)){n^=c.codePointAt(0);n=Math.imul(n,16777619);}return n>>>0;}
export function seededRandom(seed){let n=seed>>>0;return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
export function dailyChallenge(date=new Date(),language='en'){
 const day=date.toISOString().slice(0,10),seed=seedHash('boring-office:'+day),random=seededRandom(seed);
 const words=(OFFICE_WORDS[language]||OFFICE_WORDS.en).split(' ');for(let i=words.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[words[i],words[j]]=[words[j],words[i]];}
 return {day,seed,world:'office',difficulty:'normal',seconds:120,words,random:seededRandom(seed)};
}
export const THREATS=Object.freeze({email:{art:0,speed:1,color:'#83e4ca'},urgent:{art:0,speed:1.22,color:'#ffb77b'},reply:{art:1,speed:.95,color:'#e6a5dd'},deadline:{art:3,speed:1,color:'#ff7e92'},spreadsheet:{art:4,speed:.82,color:'#b8e586'},popup:{art:5,speed:1.15,color:'#b9b7ff'}});
export function threatFor(id,level,word){const types=level<2?['email']:level<4?['email','urgent','spreadsheet']:['email','urgent','reply','deadline','spreadsheet','popup'];return word.length>=10?'spreadsheet':types[(id-1)%types.length];}
export const BOSSES={printer:{name:'A IMPRESSORA DO INFERNO',art:2},meeting:{name:'A REUNIÃO INFINITA',art:5},monday:{name:'SEGUNDA-FEIRA',art:3}};
export function bossLevels(language='en',advanced=false){
 const base=(OFFICE_WORDS[language]||OFFICE_WORDS.en).split(' ');let startWord=0;
 return ['printer','meeting','monday'].flatMap((boss,index)=>[1,2,3].map(phase=>{
  const words=Array.from({length:phase===3?8:6},(_,i)=>base[(i*3+index*7+phase)%base.length]+(advanced&&phase===3?i%2?'!':':':''));const text=words.join(' '),wordCount=words.length;
  const level={title:BOSSES[boss].name,text,wordCount,startWord,endWord:startWord+wordCount,chapterIndex:index,isChapterEnd:phase===3,boss,phase};startWord+=wordCount;return level;
 }));
}
export function shareResult(result,{day='',language='en'}={}){return `BORING OFFICE · by Ivan Gomes\n${day?`DAILY ${day} · ${language.toUpperCase()}`:result.mode.toUpperCase()}\n${Math.round(result.wpm)} WPM · ${result.accuracy.toFixed(1)}% ACC\nCOMBO ${result.combo} · ${result.score} PTS\nhttps://scalifornia.github.io/orbita-web/`;}
