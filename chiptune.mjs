/** Original eight-bar melody, pulse bass and deterministic percussion. */
export function createChiptune(context){
 const rate=22050,duration=16,buffer=context.createBuffer(1,rate*duration,rate),out=buffer.getChannelData(0);
 const melody=[64,67,71,69,67,64,62,59,64,67,72,71,69,67,64,62,60,64,67,69,67,64,60,59,62,65,69,67,65,62,59,57];
 for(let i=0;i<out.length;i++){const time=i/rate,step=Math.floor(time/.5)%32,within=time%.5,note=melody[step],freq=440*2**((note-69)/12),bass=440*2**(((step<16?40:36)-69)/12);
  const envelope=Math.min(1,within/.008)*Math.exp(-within*7);const lead=(Math.sin(2*Math.PI*freq*time)>0?1:-1)*.075*envelope;
  const low=(2*((time*bass)%1)-1)*.045*Math.exp(-within*4);const beat=time%.25,noise=Math.sin(i*12.9898)*Math.sin(i*.37);const percussion=noise*.022*Math.exp(-beat*80)+(step%2===0?Math.sin(2*Math.PI*(75-30*beat)*beat)*.035*Math.exp(-beat*30):0);
  out[i]=lead+low+percussion;
 }
 return buffer;
}
