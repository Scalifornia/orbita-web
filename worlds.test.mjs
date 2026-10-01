import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_PRESETS} from './worlds.mjs';
import {Adventure} from './adventure.mjs';
import {stories} from './stories.mjs';
import {documentFromText} from './documentImport.mjs';
test('worlds offer reading breaks, free-target survival and exact writing',()=>{
 assert.equal(WORLD_PRESETS.office.mode,'reading');
 assert.equal(WORLD_PRESETS.space.progression,'endless');
 assert.equal(WORLD_PRESETS.space.mode,'arcade');
 assert.equal(WORLD_PRESETS.earth.advanced,true);
});
test('office jokes remain complete and ordered in all five languages',()=>{
 for(const [language,story] of Object.entries(stories.office)){
  const adventure=new Adventure({getItem:()=>null,setItem:()=>{},removeItem:()=>{}});
  adventure.begin(documentFromText(story.text,story.title),{...WORLD_PRESETS.office,textLanguage:language,world:'office'});
  const normalized=s=>s.replace(/\s+/gu,' ').trim();
  assert.equal(normalized(adventure.campaign.levels.map(l=>l.text).join(' ')),normalized(story.text));
  assert.ok(adventure.campaign.levels.length>=8);
 }
});
