import test from 'node:test'
import assert from 'node:assert/strict'
import { answerFor, cardsFor, emptyAnswers, swipeDirection } from './cards.mjs'
test('ongoing attack question is absent while the legacy answer remains valid',()=>{
 assert.equal(cardsFor(emptyAnswers(),false).includes('ongoing'),false)
 assert.equal(emptyAnswers().ongoing,'UNKNOWN')
 assert.deepEqual(cardsFor(emptyAnswers(),false).slice(0,3),['yesterday','today','sleep'])
})
test('swipe rejects short and diagonal drags, down is unknown',()=>{
 assert.equal(swipeDirection(40,20),null); assert.equal(swipeDirection(100,100),null)
 assert.equal(swipeDirection(-120,10),'left');assert.equal(swipeDirection(10,130),'down')
 assert.deepEqual(answerFor('today','down',{}),{today:'UNKNOWN'})
})
test('right swipe accepts the displayed sleep default or a complete custom duration',()=>{
 assert.deepEqual(answerFor('sleep','right',{hours:'',minutes:''}),{sleepMinutes:420})
 assert.deepEqual(answerFor('sleep','right',{}),{sleepMinutes:420})
 assert.throws(()=>answerFor('sleep','right',{hours:'',minutes:'30'}),/Укажите/)
 assert.throws(()=>answerFor('sleep','right',{hours:'7',minutes:''}),/Укажите/)
 assert.throws(()=>answerFor('sleep','right',{hours:'24',minutes:'1'}))
 assert.deepEqual(answerFor('sleep','right',{hours:'7',minutes:'30'}),{sleepMinutes:450})
 assert.deepEqual(answerFor('sleep','left',{}),{sleepMinutes:0,sleepQuality:null})
 assert.deepEqual(answerFor('sleep','down',{}),{sleepMinutes:null,sleepQuality:null})
 assert.equal(cardsFor({sleepMinutes:0},false).includes('quality'),false)
 assert.equal(cardsFor({sleepMinutes:450},true).includes('quality'),true)
})
test('stress follows sleep even when sleep quality is skipped',()=>{
 assert.deepEqual(cardsFor({sleepMinutes:null}).slice(2,5),['sleep','stress','medication'])
 assert.deepEqual(cardsFor({sleepMinutes:0}).slice(2,5),['sleep','stress','medication'])
 assert.deepEqual(cardsFor({sleepMinutes:450}).slice(2,5),['sleep','stress','quality'])
})
test('scales start unset, accept zero stress, either horizontal saves',()=>{
 assert.throws(()=>answerFor('stress','right',{stress:null}),/уровень стресса/)
 assert.throws(()=>answerFor('quality','right',{sleepQuality:null}),/качество сна/)
 assert.deepEqual(answerFor('stress','left',{stress:0}),{stress:0})
 assert.deepEqual(answerFor('quality','right',{sleepQuality:5}),{sleepQuality:5})
 assert.deepEqual(answerFor('quality','down',{}),{sleepQuality:null})
})
test('ordinary survey does not schedule a cycle card from saved answers',()=>{
 assert.deepEqual(cardsFor({sleepMinutes:0, menstruating:'YES', cycleStart:'2026-11-04'}),
  ['yesterday','today','sleep','stress','medication','alcohol'])
})
test('alcohol yesterday is asked and preserves yes, no, and unknown separately',()=>{
 assert.equal(cardsFor({sleepMinutes:0},false).includes('alcohol'),true)
 assert.deepEqual(answerFor('alcohol','right',{}),{alcoholYesterday:'YES'})
 assert.deepEqual(answerFor('alcohol','left',{}),{alcoholYesterday:'NO'})
 assert.deepEqual(answerFor('alcohol','down',{}),{alcoholYesterday:'UNKNOWN'})
})
test('required yes/no cards map to distinct backend answer fields',()=>{
 const cards=cardsFor(emptyAnswers(),false)
 for (const required of ['yesterday','today','medication','alcohol']) assert.ok(cards.includes(required))
 assert.deepEqual(answerFor('yesterday','left',{}),{yesterday:'NO'})
 assert.deepEqual(answerFor('today','right',{}),{today:'YES'})
 assert.deepEqual(answerFor('medication','right',{}),{medicationYesterday:'YES'})
 assert.deepEqual(answerFor('medication','down',{}),{medicationYesterday:'UNKNOWN'})
 assert.deepEqual(answerFor('alcohol','left',{}),{alcoholYesterday:'NO'})
})
