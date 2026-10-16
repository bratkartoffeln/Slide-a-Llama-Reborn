import { Updater, STATE, atomicJSON } from './core.mjs';
import { mkdir } from 'node:fs/promises';
import { setTimeout as wait } from 'node:timers/promises';
const once=process.argv.includes('--once');
const dryRun=process.argv.includes('--dry-run');
const updater=new Updater({dryRun});
async function tick(){
  try {await updater.poll();await atomicJSON(STATE+'/heartbeat.json',{time:new Date().toISOString(),ok:true});}
  catch(e){updater.log('Poll failed: '+e.message);await atomicJSON(STATE+'/heartbeat.json',{time:new Date().toISOString(),ok:false,error:e.message});if(once)process.exitCode=1;}
}
await mkdir(STATE,{recursive:true});
let stopping=false;
const stopWait=new AbortController();
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopping=true;stopWait.abort();});
if(once)await tick();
else {while(!stopping){await tick();if(!stopping)try{await wait(300000,undefined,{signal:stopWait.signal});}catch{}}}
