import {t,translatePage} from './locale.mjs?v=20261005c';
export function setupReader() {
  const $=id=>document.getElementById(id);
  let pages=[],index=0,size=20;
  function render(){
    const page=pages[index];if(!page)return;
    $('readerContent').textContent=page.text;
    $('readerContent').scrollTop=0;
    $('readerSection').value=String(index);
    $('readerPosition').textContent=`${index+1} / ${pages.length}`;
    $('readerPrevious').disabled=index===0;$('readerNext').disabled=index===pages.length-1;
  }
  $('readerSection').addEventListener('change',()=>{index=Number($('readerSection').value);render();});
  $('readerPrevious').addEventListener('click',()=>{if(index>0){index--;render();}});
  $('readerNext').addEventListener('click',()=>{if(index<pages.length-1){index++;render();}});
  for(const [id,delta] of [['readerSmaller',-2],['readerLarger',2]])$(id).addEventListener('click',()=>{size=Math.max(16,Math.min(32,size+delta));$('readerContent').style.fontSize=`${size}px`;});
  return {open(campaign,start=0){
    pages=campaign.levels;index=Math.max(0,Math.min(pages.length-1,start));
    $('readerTitle').textContent=campaign.title;
    $('readerSection').replaceChildren(...pages.map((page,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=`${i+1}. ${page.title}`;return option;}));
    render();translatePage();$('readerDialog').showModal();$('readerContent').focus();
  }};
}
