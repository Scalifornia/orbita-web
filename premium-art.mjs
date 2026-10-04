import {drawThreat,drawOfficePlayer} from './office-art.mjs?v=20261005b';
import {BOSSES} from './missions.mjs?v=20261005b';
/** Bounded environmental storytelling; the centre is deliberately quiet. */
export class PremiumArt{
 constructor(){this.background=new Image();this.background.src=new URL('./assets/office-cinematic.webp',import.meta.url);this.pixels=document.createElement('canvas');this.pixels.width=320;this.pixels.height=180;this.pc=this.pixels.getContext('2d');this.sprite=document.createElement('canvas');this.sprite.width=this.sprite.height=64;this.sc=this.sprite.getContext('2d');}
 drawRetroThreat(c,args){const p=this.sc;p.clearRect(0,0,64,64);p.save();p.translate(32,32);p.scale(.5,.5);drawThreat(p,args);p.restore();c.save();c.imageSmoothingEnabled=false;c.shadowBlur=0;c.drawImage(this.sprite,-64,-64,128,128);c.restore();}
 drawRetroPlayer(c,{x,y,time,shooting,reducedMotion}){const p=this.sc;p.clearRect(0,0,64,64);p.save();p.translate(32,32);p.scale(.5,.5);drawOfficePlayer(p,time,shooting,reducedMotion);p.restore();c.save();c.imageSmoothingEnabled=false;c.drawImage(this.sprite,x-64,y-64,128,128);c.restore();}
 draw(c,{width:w,height:h,time:t,level,retro,reducedMotion,combo,boss}){
  if(reducedMotion)t=0;
  if(retro){
   const p=this.pc;p.fillStyle='#12182f';p.fillRect(0,0,320,180);
   for(let i=0;i<8;i++){p.fillStyle=i%2?'#293867':'#283f5b';p.fillRect(i*40+3,12,34,64);p.fillStyle='#101b30';for(let k=0;k<4;k++)p.fillRect(i*40+4+k*9,50-(i*13+k*7)%25,7,26+(i*13+k*7)%25);p.fillStyle='#cfaf70';p.fillRect(i*40+19,12,2,64);}
   p.fillStyle='#233649';p.fillRect(0,100,320,80);p.strokeStyle='#304962';
   for(let i=0;i<8;i++){p.beginPath();p.moveTo(160,100);p.lineTo(i*50-15,180);p.stroke();p.fillStyle='#a78b64';p.fillRect(i*48,96,38,3);p.fillStyle='#64aaa8';p.fillRect(i*48+9,87,14,9);}
   p.fillStyle='#a4daca';for(let i=0;i<14;i++)p.fillRect((i*37+Math.floor(t*6))%320,(i*23+Math.floor(t*4))%100,1,2);
   c.save();c.imageSmoothingEnabled=false;c.drawImage(this.pixels,0,0,w,h);c.restore();
  }else if(this.background.complete&&this.background.naturalWidth){
   c.save();const scale=Math.max(w/this.background.width,h/this.background.height);const iw=this.background.width*scale,ih=this.background.height*scale;c.drawImage(this.background,(w-iw)/2,(h-ih)/2,iw,ih);c.fillStyle=['#0c18295c','#29192d66','#17383155','#38251355','#08173877','#39102966'][(level-1)%6];c.fillRect(0,0,w,h);c.restore();
  }
  // Rain, steam, papers, and a passing colleague stay outside the word lanes.
  if(!reducedMotion){
   c.save();c.strokeStyle='#a8d4ea30';c.lineWidth=1;for(let i=0;i<16;i++){const x=(i*73+w*.04)%w,y=(i*39+t*(25+i))%(h*.5);c.beginPath();c.moveTo(x,y);c.lineTo(x-2,y+8);c.stroke();}
   c.fillStyle='#afc6c422';const colleagueX=(t*12)%(w+150)-75;c.fillRect(colleagueX,h*.59,11,25);c.beginPath();c.arc(colleagueX+5,h*.59-4,5,0,Math.PI*2);c.fill();
   if(combo>=50)for(let i=0;i<8;i++){const x=i%2?w-18:18,y=(t*30+i*43)%h;c.save();c.translate(x,y);c.rotate(t+i);c.fillStyle='#ede4cb88';c.fillRect(-4,-3,8,6);c.restore();}
   c.restore();
  }
  if(boss){c.save();c.translate(w*.86,Math.min(h*.22,95));c.scale(2,2);const args={world:'office',id:BOSSES[boss.id].art,time:reducedMotion?0:t,active:true};if(retro)this.drawRetroThreat(c,args);else drawThreat(c,args);c.restore();}
 }
}
export function dangerLevel(enemies){return Math.min(1,Math.max(0,...enemies.map(e=>e.y)));}
