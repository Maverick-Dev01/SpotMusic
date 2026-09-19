const {test}=require('node:test');
const assert=require('node:assert/strict');
const Queue=require('../src/js/playbackQueue');
const spotify=require('../src/services/spotify');
test('next, previous, repeat-one and end of queue',()=>{
 const q=new Queue();q.set([{id:'a'},{id:'b'},{id:'c'}],'a');
 assert.equal(q.next().id,'b');assert.equal(q.previous().id,'a');
 q.repeat='one';assert.equal(q.next(false).id,'a');assert.equal(q.next(true).id,'b');
 q.repeat='off';q.next();assert.equal(q.next(false),null);
 q.repeat='all';assert.equal(q.next(false).id,'a');
});
test('shuffle visits each remaining song once and bulk removal cleans queue',()=>{
 const q=new Queue();q.set(Array.from({length:10},(_,i)=>({id:i})),0);q.shuffle=true;
 const visited=[0];for(let i=0;i<9;i++)visited.push(q.next(false).id);
 assert.equal(new Set(visited).size,10);assert.equal(q.next(false),null);
 q.remove(new Set([0,1,2]));assert.equal(q.tracks.length,7);
 assert.equal(q.tracks.some(t=>t.id===0),false);
});
test('playlist import requests all 1000 items without a total hint',async()=>{
 const offsets=[];spotify.makeHttpRequest=async ({path})=>{
 if(!path.includes('/items?'))return {id:'test',name:'Large playlist',images:[]};
 const offset=Number(new URL('https://api.spotify.com'+path).searchParams.get('offset'));offsets.push(offset);
 return {items:Array.from({length:50},(_,i)=>({item:{id:String(offset+i),name:'Song '+(offset+i),artists:[{name:'Artist'}],duration_ms:180000}})),next:offset<950?'next':null};
 };
 const data=await spotify.fetchPlaylistWithApi('test','fake');
 assert.equal(data.tracks.length,1000);assert.equal(data.partial,false);assert.equal(offsets.length,20);
});
test('Spotify PKCE validates state and exchanges code without a client secret',async()=>{
 const vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
 let opened,request;
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync('src/services/spotifyAuth.js','utf8'),{module,URL,URLSearchParams,Date,AbortSignal,
  require:key=>key==='electron'?{app:{getPath:()=>'/tmp/unused-test-session'},shell:{openExternal:async url=>{opened=url}},safeStorage:{isEncryptionAvailable:()=>false}}:require(key),
  fetch:async(url,options)=>{request=options;return {ok:true,json:async()=>({access_token:'test-token',expires_in:3600,refresh_token:'test-refresh'})}}
 });
 const auth=module.exports;
 await auth.connect('test-client');const url=new URL(opened);
 assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 assert.equal(url.searchParams.get('code_challenge'),crypto.createHash('sha256').update(auth.pending.verifier).digest('base64url'));
 await assert.rejects(auth.callback('spotmusic-login://callback?state=wrong&code=code'),/vencida/);
 await auth.callback('spotmusic-login://callback?state='+url.searchParams.get('state')+'&code=test-code');
 assert.equal(request.body.get('client_secret'),null);assert.equal(await auth.accessToken(),'test-token');
});
