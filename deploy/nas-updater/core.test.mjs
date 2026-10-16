import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Updater, verifiedRun, idleHealth, archivePathsOK, protectedEntry, validSHA, retryableError, PROJECT, REPOSITORY } from './core.mjs';

test('Only the newest successful push verification for the exact main SHA permits deployment',()=>{
  const sha='a'.repeat(40);
  const good={id:1,head_sha:sha,head_branch:'main',event:'push',status:'completed',conclusion:'success'};
  assert.equal(verifiedRun([good],sha),true);
  for(const changed of [{head_sha:'b'.repeat(40)},{head_branch:'feature'},{event:'pull_request'},{status:'in_progress'},{conclusion:'failure'}])assert.equal(verifiedRun([{...good,...changed}],sha),false);
  assert.equal(verifiedRun([good,{...good,id:2,status:'in_progress',conclusion:null}],sha),false);
});
test('Active, malformed or unavailable room statistics fail closed',()=>{
  assert.equal(idleHealth({ready:true,rooms:0}),true);
  for(const value of [null,{}, {ready:false,rooms:0},{ready:true,rooms:1},{ready:true,rooms:-1},{ready:true,rooms:'0'},{ready:true,rooms:0.5}])assert.equal(idleHealth(value),false);
});
test('Source copying protects local TLS, credentials, Compose resources and data',()=>{
  for(const name of ['.env','.env.production','secrets','deploy','skins','data','compose.yaml','compose.https.yaml','Caddyfile.dns','.git','.nas-update.lock'])assert.equal(protectedEntry(name),true,name);
  for(const name of ['server','client','shared','public','package.json','package-lock.json','.env.example'])assert.equal(protectedEntry(name),false,name);
});
test('Archive paths reject traversal, absolute paths and mixed extraction roots',()=>{
  assert.equal(archivePathsOK('repo-abc/\nrepo-abc/package.json\nrepo-abc/server/app.ts\n'),true);
  for(const listing of ['', '/etc/passwd\n','root/../bad\n','root/./bad\n','first/a\nsecond/b\n','root/..\\bad\n'])assert.equal(archivePathsOK(listing),false,listing);
});
test('Updater repository and legacy NAS identity stay separate from RPS',()=>{
  assert.equal(PROJECT,'slide-a-lama');assert.equal(REPOSITORY,'bratkartoffeln/Slide-a-Llama-Reborn');
  assert.equal(validSHA('a'.repeat(40)),true);assert.equal(validSHA('a'.repeat(39)),false);assert.equal(validSHA('../rps-arena'),false);
});
test('Temporary network/API authorization failures can retry; invalid source or tests cannot',()=>{
  for(const message of ['GitHub API: HTTP 403','download HTTP 503','ENOTFOUND registry-1.docker.io','i/o timeout'])assert.equal(retryableError(new Error(message)),true);
  for(const message of ['unsafe archive','application test failed','source identity mismatch'])assert.equal(retryableError(new Error(message)),false);
});
test('Maintenance is acquired only for an idle server and busy responses defer',async()=>{
  const u=new Updater({log:()=>{}});
  const calls=[];
  u.health=async(_container,path='/ready')=>{calls.push(path);return path==='/ready'?{status:200,body:{ready:true,rooms:0}}:{status:200,body:{maintenance:true}};};
  assert.deepEqual(await u.acquireMaintenance(),{acquired:true,legacy:false});
  assert.deepEqual(calls,['/ready','/internal/maintenance/enter']);
  u.health=async()=>({status:200,body:{ready:true,rooms:1}});
  assert.deepEqual(await u.acquireMaintenance(),{acquired:false});
  u.health=async(_container,path='/ready')=>path==='/ready'?{status:200,body:{ready:true,rooms:0}}:{status:409};
  assert.deepEqual(await u.acquireMaintenance(),{acquired:false});
});
test('Legacy fallback rechecks idle state and rejects players arriving after first check',async()=>{
  const u=new Updater({log:()=>{}});let count=0;
  u.health=async(_container,path='/ready')=>path==='/ready'?{status:200,body:{ready:true,rooms:count++===0?0:1}}:{status:404};
  assert.deepEqual(await u.acquireMaintenance(),{acquired:false,legacy:true});
});

async function transaction(t,failAt) {
  const dir=await mkdtemp(join(tmpdir(),'slide-updater-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const events=[];const state={installed_sha:'b'.repeat(40)};
  const u=new Updater({stateRoot:dir,log:()=>{}});
  u.prepare=async()=>({source:'/test-source',pkg:{version:'0.1.2'}});
  u.build=async()=>{events.push('build');if(failAt==='build')throw Error('build failed');};
  u.candidate=async()=>events.push('candidate');
  u.acquireMaintenance=async()=>({acquired:failAt!=='busy',legacy:false});
  u.releaseMaintenance=async()=>events.push('release');
  u.docker=async()=>{};
  u.cleanupDanglingImages=async()=>events.push('cleanup');
  u.snapshotSources=async()=>events.push('backup');
  u.deployment=async()=>null;
  u.compose=async image=>{events.push(image==='old-image'?'rollback':'activate');if(failAt==='activate'&&image!=='old-image')throw Error('activation failed');};
  u.health=async()=>({status:200,body:{version:failAt==='health'?'wrong':'0.1.2'}});
  u.replaceSources=async source=>{events.push(source==='/test-source'?'copy-new':'restore-source');if(failAt==='source'&&source==='/test-source')throw Error('copy interrupted');};
  return {u,dir,state,events,args:{sha:'a'.repeat(40),runId:null,state,current:{Image:'old-image'}}};
}
test('A failed candidate build never changes the live container or sources',async t=>{
  const x=await transaction(t,'build');await assert.rejects(x.u.perform(x.args),/build failed/);
  assert.deepEqual(x.events,['build']);assert.equal(x.state.installed_sha,'b'.repeat(40));
});
test('Players arriving during build defer activation without blocking the commit as failed',async t=>{
  const x=await transaction(t,'busy');await x.u.perform(x.args);
  assert.deepEqual(x.events,['build','candidate']);assert.equal(x.state.failed_sha,undefined);
});
for(const failure of ['activate','health','source'])test('Rollback restores the previous image after '+failure+' failure',async t=>{
  const x=await transaction(t,failure);await assert.rejects(x.u.perform(x.args));
  assert.ok(x.events.includes('rollback'));assert.equal(x.state.installed_sha,'b'.repeat(40));assert.equal(x.events.at(-1),'release');
  if(failure==='source')assert.ok(x.events.includes('restore-source'));
});
test('Installed SHA is persisted only after image health and source installation succeed',async t=>{
  const x=await transaction(t);await x.u.perform(x.args);
  assert.equal(x.state.installed_sha,'a'.repeat(40));assert.equal(x.events.includes('rollback'),false);
  assert.equal(JSON.parse(await readFile(join(x.dir,'state.json'))).installed_sha,'a'.repeat(40));
});

test('Successful update cleans images only after installed state has been saved',async t=>{
  const x=await transaction(t);
  x.u.cleanupDanglingImages=async()=>{
    const saved=JSON.parse(await readFile(join(x.dir,'state.json')));
    assert.equal(saved.installed_sha,x.args.sha);
    assert.ok(x.events.includes('copy-new'));
    x.events.push('cleanup');
  };
  await x.u.perform(x.args);
  assert.deepEqual(x.events,['build','candidate','backup','activate','copy-new','cleanup','release']);
});

test('Cleanup prunes only unused dangling images and logs reclaimed space',async()=>{
  const logs=[];const u=new Updater({log:message=>logs.push(message)});const calls=[];
  u.docker=async args=>{calls.push(args);return 'Total reclaimed space: 123MB';};
  await u.cleanupDanglingImages();
  assert.deepEqual(calls,[['image','prune','--force']]);
  assert.ok(logs.some(message=>message.includes('Total reclaimed space: 123MB')));
});

test('Docker cleanup failure cannot fail or roll back an installed update',async t=>{
  const x=await transaction(t);const logs=[];x.u.log=message=>logs.push(message);
  x.u.cleanupDanglingImages=Updater.prototype.cleanupDanglingImages.bind(x.u);
  x.u.docker=async args=>{if(args[1]==='prune')throw Error('prune already running');};
  await x.u.perform(x.args);
  const saved=JSON.parse(await readFile(join(x.dir,'state.json')));
  assert.equal(saved.installed_sha,x.args.sha);assert.equal(saved.failed_sha,null);
  assert.equal(x.events.includes('rollback'),false);
  assert.ok(logs.some(message=>message.includes('cleanup failed; installed update retained')));
});
