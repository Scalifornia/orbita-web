import {importDocument,documentFromText} from './documentImport.mjs';
import {createCampaign} from './campaign.mjs';
import {t,translatePage} from './locale.mjs?v=20261004e';
const $=id=>document.getElementById(id);
const messages={emptyDocument:'Não foi encontrado texto legível.',scannedPdf:'Este PDF não contém texto selecionável. O reconhecimento de texto (OCR) ainda não está disponível.',documentTooLarge:'Documento demasiado grande.',documentTooLong:'Documento demasiado grande.',unsupportedFormat:'Formato não suportado.'};
export function setupLibrary({getLanguage,onStart,onDefault,onRead}){
  let selected=null,version=0;
  function status(message){$('customError').textContent=t(message);}
  function clear(){selected=null;$('documentPreview').hidden=true;$('playDocumentButton').disabled=true;$('readDocumentButton').disabled=true;}
  function preview(doc){
    const campaign=createCampaign(doc,{language:getLanguage(),targetWords:20,shortRounds:true});selected=doc;
    $('documentTitle').value=doc.title;$('previewTitle').textContent=doc.title;
    $('previewStats').textContent=`${t('{count} palavras',{count:campaign.totalWords})} · ${t('{count} níveis',{count:campaign.levels.length})}`;
    $('previewText').textContent=doc.sections.map(section=>(section.title?section.title+'\n':'')+section.text).join('\n\n').slice(0,5000);
    $('readDocumentButton').disabled=false;$('documentPreview').hidden=false;$('playDocumentButton').disabled=false;status('Pronto para jogar');translatePage();
  }
  $('documentFile').addEventListener('change',async()=>{
    const file=$('documentFile').files[0];if(!file)return;const current=++version;clear();status('A extrair texto…');$('saveTextButton').disabled=true;
    try {const doc=await importDocument(file);if(current!==version)return;$('customText').value=doc.text;preview(doc);}
    catch(error){if(current===version)status(messages[error.code] || 'Não foi possível importar este documento.');}
    finally{if(current===version)$('saveTextButton').disabled=false;}
  });
  $('customText').addEventListener('input',()=>{version++;clear();$('saveTextButton').disabled=false;status('');});
  $('saveTextButton').addEventListener('click',()=>{try{preview(documentFromText($('customText').value,$('documentTitle').value || t('Documento')));}catch{status('Não foi encontrado texto legível.');}});
  $('playDocumentButton').addEventListener('click',()=>{
    if(!selected)return;selected={...selected,title:$('documentTitle').value.trim()||selected.title};
    try{$('customDialog').close();onStart(selected);}catch{$('customDialog').showModal();status('Não foi encontrado texto legível.');}
  });
  $('readDocumentButton').addEventListener('click',()=>{if(selected)onRead(createCampaign({...selected,title:$('documentTitle').value||selected.title},{language:getLanguage(),targetWords:20,shortRounds:true}));});
  $('defaultTextButton').addEventListener('click',()=>{onDefault();$('customDialog').close();});
  return {open(text=''){version++;clear();$('saveTextButton').disabled=false;$('customText').value=text;status('');$('customDialog').showModal();},selected:()=>selected};
}
