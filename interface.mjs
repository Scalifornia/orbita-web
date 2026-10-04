import {t,translatePage} from './locale.mjs?v=20261005c';
export function setupMenu({languages,getLanguage,onLanguage,onOptions}) {
  const select=document.getElementById('menuLanguage');
  for (const [value,label] of Object.entries(languages)) { const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option); }
  select.value=getLanguage();
  select.addEventListener('change',()=>{onLanguage(select.value);translatePage();});
  document.getElementById('optionsButton').addEventListener('click',onOptions);
  return {
    sync({language,summary,resume}) {
      select.value=language;
      document.getElementById('missionSelection').textContent=summary;
      document.getElementById('continueButton').hidden=!resume;
      document.getElementById('continueSummary').textContent=resume || '';
    },
    status(message){document.getElementById('saveStatus')?.replaceChildren(document.createTextNode(t(message)));}
  };
}
