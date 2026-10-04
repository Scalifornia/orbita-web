/** Original procedural art: silhouettes stay crisp on phones, no asset downloads. */
export const ROOMS = [
  { wall:'#263c58', floor:'#142235', light:'#8ddcf5', accent:'#f2bd75', kind:'studio' },
  { wall:'#493556', floor:'#231b32', light:'#dcb5fa', accent:'#d998bb', kind:'meeting' },
  { wall:'#28514c', floor:'#142e2d', light:'#b4edd8', accent:'#dfbd77', kind:'archive' },
  { wall:'#593e32', floor:'#30251e', light:'#f1d09d', accent:'#9ad4c2', kind:'kitchen' },
  { wall:'#202c52', floor:'#10182c', light:'#86b5ff', accent:'#c598f3', kind:'server' },
  { wall:'#4f2944', floor:'#241527', light:'#ffb3c1', accent:'#e7c58b', kind:'executive' },
];
const TAU=Math.PI*2;
const box=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
const circle=(c,x,y,r,color)=>{c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();};
export function officeRoom(level=1){return ROOMS[(Math.max(1,Math.floor(level)||1)-1)%ROOMS.length];}
export function drawOfficeRoom(c,w,h,level,time){
 const room=officeRoom(level), floor=h*.72;
 const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,room.wall);g.addColorStop(1,room.floor);c.fillStyle=g;c.fillRect(0,0,w,h);
 box(c,0,floor,w,h-floor,room.floor);
 c.strokeStyle=room.light+'18';c.lineWidth=1;
 for(let i=-4;i<=4;i++){c.beginPath();c.moveTo(w/2+i*24,floor);c.lineTo(w/2+i*w*.3,h);c.stroke();}
 for(let i=1;i<5;i++){const y=floor+(h-floor)*(i/5)**2;c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
 const bays=Math.max(2,Math.min(5,Math.floor(w/190))), bw=w/bays;
 for(let i=0;i<bays;i++){
  const x=i*bw+14, width=bw-28, top=46;
  if(['studio','executive'].includes(room.kind)){
   box(c,x,top,width,h*.3,room.light+'44');
   for(let k=0;k<6;k++){const bh=20+((k*37+i*19)%65);box(c,x+k*width/6,top+h*.3-bh,width/7,bh,room.floor+'bb');}
   box(c,x+width/2,top,3,h*.3,room.accent);box(c,x,top+h*.15,width,2,room.accent);
  } else if(room.kind==='archive'){
   box(c,x,top,width,h*.42,'#162b2e');for(let r=0;r<4;r++){box(c,x,top+r*36,width,3,room.accent);for(let b=0;b<5;b++)box(c,x+5+b*width/5,top+5+r*36,width/6,27,[room.light,room.accent,'#b98677'][b%3]);}
  } else if(room.kind==='server'){
   box(c,x,top,width,h*.43,'#111a30');for(let r=0;r<7;r++){box(c,x+5,top+8+r*23,width-10,18,'#304366');circle(c,x+12,top+17+r*23,2,(Math.sin(time+r+i)>0?'#8cf7d1':'#6c83a5'));box(c,x+23,top+14+r*23,width*.4,3,'#607597');}
  } else if(room.kind==='meeting'){
   box(c,x,top,width,h*.28,'#d9d8d2');box(c,x+10,top+15,width*.7,4,room.wall);for(let r=0;r<3;r++)box(c,x+10,top+32+r*19,width*(.35+r*.12),3,'#8b8b99');
   for(let k=0;k<3;k++)box(c,x+8+k*width/3,top+h*.2,15,15,['#ebbd76','#b6b1e6','#9bc8bb'][k]);
  } else {
   box(c,x,top,width,h*.25,'#836751');box(c,x+width/2,top,2,h*.25,room.accent);circle(c,x+width/2-8,top+h*.14,2,room.light);
   box(c,x,floor-65,width,65,'#775b49');box(c,x-3,floor-69,width+6,5,room.light);
   box(c,x+10,floor-100,28,31,'#c3c9bf');circle(c,x+24,floor-85,8,'#324b4c');
  }
 }
 if(room.kind==='meeting'||room.kind==='executive'){
  c.fillStyle=room.accent;c.beginPath();c.ellipse(w*.5,floor+10,w*.29,22,0,0,TAU);c.fill();box(c,w*.35,floor+12,5,35,room.accent);box(c,w*.65,floor+12,5,35,room.accent);
 }else if(room.kind==='studio'){
  for(let i=0;i<bays;i++){const x=i*bw+24;box(c,x,floor,bw-48,6,room.accent);box(c,x+12,floor-31,40,28,'#142c3b');box(c,x+16,floor-27,32,19,room.light+'88');box(c,x+29,floor-3,5,4,room.light);}
 }
 // Architectural light strips and quiet corners leave the word lanes clear.
 box(c,18,16,w-36,3,room.light+'77');box(c,0,floor-2,w,2,room.accent+'66');
}
export function drawOfficePlayer(c,time,shooting,reducedMotion){
 c.save();c.translate(0,reducedMotion?0:Math.sin(time*2)*.6);
 c.fillStyle='#07141b88';c.beginPath();c.ellipse(0,25,54,9,0,0,TAU);c.fill();
 // Seen from behind: headphones, chair and keyboard cannon, never an enemy bust.
 box(c,-26,-12,52,38,'#162d45');box(c,-22,-8,44,28,'#39718b');
 circle(c,0,-29,13,'#ddb18b');circle(c,0,-35,12,'#322b3b');
 c.strokeStyle='#7ee6eb';c.lineWidth=4;c.beginPath();c.arc(0,-32,15,Math.PI,TAU);c.stroke();box(c,-17,-34,5,12,'#7ee6eb');box(c,12,-34,5,12,'#7ee6eb');
 box(c,-53,14,106,7,'#d8ad79');box(c,-48,21,5,15,'#7e604a');box(c,43,21,5,15,'#7e604a');
 box(c,-23,3,46,13,'#112d41');for(let r=0;r<2;r++)for(let k=0;k<8;k++)box(c,-19+k*5,6+r*4,3,2,'#97e6df');
 box(c,-5,-21,10,26,'#65ddd5');box(c,-3,-25,6,7,'#e7ffea');
 box(c,32,0,12,14,'#ffbd76');c.strokeStyle='#ffbd76';c.lineWidth=2;c.strokeRect(43,3,5,7);
 if(shooting){circle(c,0,-30,8,'#a8ffee66');circle(c,0,-29,3,'#ffffff');}
 c.restore();
}
export function drawThreat(c,{world,id,time=0,active=false,flash=false}){
 const variant=((Math.trunc(id)%6)+6)%6;
 const colors=['#f2b68b','#b9a5ec','#80d6c3','#f3cc79','#9cbff0','#ee9bb7'];
 const color=flash?'#ffffff':colors[variant];c.save();c.lineWidth=2;c.strokeStyle=active?'#fff0bc':color;
 c.translate(0,Math.sin(time*1.5+id)*1.2);
 if(world==='office'){
  if(variant===0){ // Angry inbox envelope.
   box(c,-24,-17,48,32,color);c.beginPath();c.moveTo(-24,-17);c.lineTo(0,2);c.lineTo(24,-17);c.stroke();circle(c,22,-17,9,'#df5672');box(c,21,-22,2,7,'#fff');box(c,21,-13,2,2,'#fff');
  }else if(variant===1){ // Paperwork with approval stamp.
   for(let k=2;k>=0;k--)box(c,-17+k*3,-25+k*3,30,40,k===0?'#f4e8cd':'#a4b2bd');for(let r=0;r<4;r++)box(c,-12,-17+r*6,18,2,'#5b6c84');circle(c,7,7,8,'#c85e79');
  }else if(variant===2){ // Possessed printer.
   box(c,-14,-27,28,16,'#e4e6d9');box(c,-25,-13,50,28,color);box(c,-17,2,34,5,'#233b48');box(c,-13,7,26,13,'#eee4d1');circle(c,17,-6,3,'#f26a76');
  }else if(variant===3){ // Deadline clock.
   circle(c,0,-5,23,color);circle(c,0,-5,18,'#263449');c.beginPath();c.moveTo(0,-18);c.lineTo(0,-5);c.lineTo(12,2);c.stroke();box(c,-20,-29,10,5,color);box(c,10,-29,10,5,color);
  }else if(variant===4){ // Spreadsheet monster.
   box(c,-24,-23,48,35,color);box(c,-20,-19,40,23,'#203e4a');for(let r=0;r<3;r++)for(let k=0;k<4;k++)box(c,-17+k*9,-16+r*7,6,4,r===k%3?'#f2bf7a':'#7fc7bd');box(c,-3,12,6,6,color);box(c,-13,18,26,3,color);
  }else{ // Manager with a dramatically different silhouette.
   box(c,-25,4,50,18,'#684967');circle(c,0,-12,17,'#ddb18c');box(c,-19,-31,38,12,'#3d283d');box(c,-19,-16,38,6,'#202c42');box(c,-3,4,6,16,color);box(c,18,9,16,12,color);
  }
 }else if(world==='space'){
  c.fillStyle=color;c.beginPath();const n=variant+3;for(let k=0;k<n*2;k++){const a=k*Math.PI/n-Math.PI/2,r=k%2?12:25;const x=Math.cos(a)*r,y=Math.sin(a)*r;k?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.fill();c.stroke();circle(c,0,0,6,'#15273c');circle(c,0,0,2,'#c8ffff');
 }else{
  box(c,-25,-14,9,34,'#162f35');box(c,16,-14,9,34,'#162f35');box(c,-17,-19,34,36,color);circle(c,0,-3,10,'#365b59');for(let k=0;k<1+variant%3;k++)box(c,-2+(k-(variant%3)/2)*9,-31,4,25,color);if(variant>2){box(c,-33,-7,12,9,color);box(c,21,-7,12,9,color);}
 }
 c.restore();
}
