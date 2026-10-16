import { readFile, writeFile, rename, mkdir, rm, rmdir, readdir, lstat, cp } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { join } from 'node:path';

const exec = promisify(execFile);
export const REPOSITORY = 'bratkartoffeln/Slide-a-Llama-Reborn';
export const PROJECT = 'slide-a-lama'; // Existing NAS project; do not rename.
export const GAME = 'slide-a-lama-game-1';
export const BASE = '/share/Container/slide-a-llama';
export const APP = BASE + '/app';
export const STATE = BASE + '/.slide-updater';
export const PUBLIC_URL = 'https://flusensieb.dns.navy:9443';
const API = 'https://api.github.com/repos/' + REPOSITORY;
const SHA = /^[0-9a-f]{40}$/;
const protectedNames = new Set(['secrets', 'skins', 'data', 'deploy', '.git', '.vscode', '.agents', 'node_modules', 'dist', '.nas-update.lock']);
export function protectedEntry(name) {
  return protectedNames.has(name) || name === '.env' || (name.startsWith('.env.') && name !== '.env.example') || name.startsWith('compose.') || name.startsWith('Caddyfile');
}
export function validSHA(value) { return typeof value === 'string' && SHA.test(value); }
export function retryableError(error) {
  return error?.retryable === true || ['TimeoutError','AbortError'].includes(error?.name) || /HTTP (401|403|429|5\d\d)|fetch failed|i\/o timeout|ENOTFOUND|EAI_AGAIN|TLS handshake timeout|network is unreachable|temporary failure|ECONNRESET|context deadline exceeded/i.test(error?.message??'');
}
export function verifiedRun(runs, sha) {
  const matches = runs.filter(r => r.head_sha === sha && r.head_branch === 'main' && r.event === 'push').sort((a,b) => b.id-a.id);
  return matches[0]?.status === 'completed' && matches[0]?.conclusion === 'success';
}
export function idleHealth(value) {
  return value?.ready === true && Number.isSafeInteger(value.rooms) && value.rooms === 0;
}
export function archivePathsOK(listing) {
  const paths = listing.split('\n').filter(Boolean);
  const roots = new Set();
  for (const name of paths) {
    const parts = name.split('/');
    if (name.startsWith('/') || name.includes('\\') || parts.includes('..') || parts.includes('.')) return false;
    roots.add(parts[0]);
  }
  return paths.length > 0 && roots.size === 1;
}
export async function atomicJSON(path, value) {
  await writeFile(path+'.new', JSON.stringify(value,null,2)+'\n', {mode:0o600});
  await rename(path+'.new',path);
}
async function jsonFile(path, fallback) {
  try { return JSON.parse(await readFile(path,'utf8')); } catch(e) { if(e.code==='ENOENT')return fallback; throw e; }
}
const wait = ms => new Promise(r=>setTimeout(r,ms));
export class Updater {
  constructor({dryRun=false, log=console.log,stateRoot=STATE}={}) { this.dryRun=dryRun; this.stateRoot=stateRoot; this.log=message=>log(new Date().toISOString()+' '+message); }
  async token() {
    try { return (await readFile(this.stateRoot+'/github-deploy.token','utf8')).trim(); }
    catch(e) { if(e.code==='ENOENT')return '';throw e; }
  }
  async request(path,{method='GET',body}={}) {
    const token=await this.token();
    const headers={'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'slide-a-llama-qnap-updater'};
    if(token)headers.Authorization='Bearer '+token;
    if(body)headers['Content-Type']='application/json';
    const response=await fetch(API+path,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error('GitHub API '+method+' '+path.split('?')[0]+': HTTP '+response.status);
    return response.json();
  }
  async docker(args,options={}) {
    const {stdout}=await exec('docker',args,{timeout:180000,maxBuffer:4*1024*1024,...options});return stdout.trim();
  }
  async inspect() {
    const data=JSON.parse(await this.docker(['inspect',GAME]))[0];
    if(data.Name!=='/'+GAME || data.Config.Labels?.['com.docker.compose.project']!==PROJECT || data.Config.Labels?.['com.docker.compose.service']!=='game')throw new Error('Target container identity mismatch');
    return data;
  }
  async health(container=GAME,path='/ready',method='GET') {
    const script=`const r=await fetch('http://127.0.0.1:2568'+process.argv[1],{method:process.argv[2],signal:AbortSignal.timeout(5000)});let body;try{body=await r.json()}catch{}console.log(JSON.stringify({status:r.status,body}));`;
    return JSON.parse(await this.docker(['exec',container,'node','--input-type=module','-e',script,path,method],{timeout:15000}));
  }
  async deployment(sha,runId) {
    if(!await this.token())return null;
    try {
      const data=await this.request('/deployments',{method:'POST',body:{ref:sha,auto_merge:false,required_contexts:[],environment:'production',task:runId?'qnap-manual':'qnap-auto',production_environment:true,description:'Slide-a-Llama QNAP update',payload:runId?{workflow_run_id:String(runId)}:{}}});
      await this.report(data.id,'in_progress');return data.id;
    } catch(e) { this.log('GitHub deployment reporting unavailable: '+e.message);return null; }
  }
  async report(id,state) {
    if(!id)return;
    await this.request('/deployments/'+id+'/statuses',{method:'POST',body:{state,environment_url:PUBLIC_URL,auto_inactive:false,description:'QNAP: '+state}});
  }
  async download(sha,destination) {
    let url=API+'/tarball/'+sha;
    const token=await this.token();
    for(let n=0;n<6;n++) {
      const headers={'User-Agent':'slide-a-llama-qnap-updater','Accept':'application/vnd.github+json'};
      if(new URL(url).hostname==='api.github.com' && token)headers.Authorization='Bearer '+token;
      const response=await fetch(url,{headers,redirect:'manual',signal:AbortSignal.timeout(120000)});
      if(response.status>=300&&response.status<400) {
        url=new URL(response.headers.get('location'),url).href;
        if(!['api.github.com','codeload.github.com','github.com'].includes(new URL(url).hostname))throw new Error('Unexpected archive redirect');
        continue;
      }
      if(!response.ok||!response.body)throw new Error('Source download failed: HTTP '+response.status);
      await pipeline(Readable.fromWeb(response.body),createWriteStream(destination,{mode:0o600}));return;
    }
    throw new Error('Too many source redirects');
  }
  async safeSource(source) {
    for(const entry of await readdir(source,{withFileTypes:true})) {
      const path=join(source,entry.name);
      if((await lstat(path)).isSymbolicLink())throw new Error('Source symlinks are not supported by this updater');
      if(entry.isDirectory())await this.safeSource(path);
    }
  }
  async build(source,image,sha) {
    const logfile=this.stateRoot+'/logs/build-'+sha+'.log';
    for(let attempt=1;attempt<=3;attempt++) {
      const file=createWriteStream(logfile,{mode:0o600});
      const code=await new Promise((yes,no)=>{
        const child=spawn('docker',['build','--label','org.opencontainers.image.revision='+sha,'-t',image,source],{stdio:['ignore','pipe','pipe']});
        child.stdout.pipe(file,{end:false});child.stderr.pipe(file,{end:false});
        child.on('error',error=>{file.end();no(error);});child.on('close',code=>file.end(()=>yes(code)));
      });
      if(code===0)return;
      const details=(await readFile(logfile,'utf8')).slice(-20000);
      const error=new Error('Image build failed; see '+logfile);
      error.retryable=retryableError(new Error(details));
      if(!error.retryable || attempt===3)throw error;
      this.log('Temporary build network failure; retry '+(attempt+1)+'/3.');await wait(15000);
    }
  }
  async candidate(image,sha) {
    const name='slide-a-llama-check-'+sha.slice(0,12);
    await this.docker(['run','-d','--name',name,'--network','none','--label','slide.updater.candidate=true',image]);
    try {
      for(let n=0;n<30;n++) {
        try { const health=await this.health(name);if(health.status===200&&idleHealth(health.body))return; } catch {}
        await wait(1000);
      }
      throw new Error('Candidate image did not become ready');
    } finally { await this.docker(['rm','-f',name]); }
  }
  async snapshotSources(destination) {
    await mkdir(destination,{recursive:true});
    for(const name of await readdir(APP))if(!protectedEntry(name))await cp(join(APP,name),join(destination,name),{recursive:true,dereference:false});
  }
  async replaceSources(source) {
    for(const name of await readdir(APP))if(!protectedEntry(name))await rm(join(APP,name),{recursive:true,force:true});
    for(const name of await readdir(source))if(!protectedEntry(name))await cp(join(source,name),join(APP,name),{recursive:true,dereference:false});
  }
  async compose(image) {
    const override=this.stateRoot+'/active-image.json';
    await atomicJSON(override,{services:{game:{image}}});
    await this.docker(['compose','-p',PROJECT,'-f',APP+'/compose.yaml','-f',APP+'/compose.https.yaml','-f',override,'up','-d','--no-deps','--no-build','--force-recreate','--wait','--wait-timeout','120','game']);
  }
  async acquireMaintenance() {
    const health=await this.health();
    if(health.status!==200||!idleHealth(health.body))return {acquired:false};
    const result=await this.health(GAME,'/internal/maintenance/enter','POST');
    if(result.status===200&&result.body?.maintenance===true)return {acquired:true,legacy:false};
    if(result.status===409)return {acquired:false};
    if(result.status!==404&&result.status!==405)throw new Error('Maintenance request failed: HTTP '+result.status);
    // Legacy 0.1.0 has no maintenance route. Check again immediately before
    // replacement. Later releases use the atomic room-creation guard above.
    const again=await this.health();
    return {acquired:again.status===200&&idleHealth(again.body),legacy:true};
  }
  async releaseMaintenance() {
    try { await this.health(GAME,'/internal/maintenance/exit','POST'); } catch(e) { this.log('Maintenance release failed: '+e.message); }
  }
  async poll() {
    await mkdir(this.stateRoot+'/logs',{recursive:true});
    await mkdir(this.stateRoot+'/staging',{recursive:true});
    await mkdir(this.stateRoot+'/backups',{recursive:true});
    let locked=false;
    try {
      try { await mkdir(APP+'/.nas-update.lock');locked=true; } catch(e) {if(e.code==='EEXIST'){this.log('Another Slide update is active; deferred.');return;}throw e;}
      const state=await jsonFile(this.stateRoot+'/state.json',{});
      const commit=await this.request('/commits/main');const sha=commit.sha;
      if(!validSHA(sha))throw new Error('Invalid GitHub commit SHA');
      let runId=null;
      try {
        const runs=await this.request('/actions/workflows/deploy-request.yml/runs?branch=main&event=workflow_dispatch&per_page=30');
        const pending=runs.workflow_runs.filter(r=>r.head_sha===sha&&r.head_branch==='main'&&r.event==='workflow_dispatch'&&Number.isSafeInteger(r.id)&&r.id>(state.last_manual_run??0)&&(r.status==='in_progress'||r.conclusion==='success')).sort((a,b)=>b.id-a.id);
        runId=pending[0]?.id??null;
      } catch(e) { if(!e.message.includes('HTTP 404'))this.log('Manual request lookup unavailable: '+e.message); }
      if(!state.observed_sha) {
        if(!this.dryRun){state.observed_sha=sha;await atomicJSON(this.stateRoot+'/state.json',state);}
        this.log('Initial main baseline recorded; existing installation retained.');return;
      }
      if(state.installed_sha===sha || (state.observed_sha===sha && !runId)) {
        if(runId && state.installed_sha===sha && !this.dryRun) {
          const id=await this.deployment(sha,runId);
          if(id){await this.report(id,'success');state.last_manual_run=runId;await atomicJSON(this.stateRoot+'/state.json',state);}
        }
        this.log('No new main update.');return;
      }
      if(state.failed_sha===sha && state.failed_run===runId){this.log('This failed build is held; new commit or manual request required.');return;}
      const runs=await this.request('/actions/workflows/verify.yml/runs?branch=main&event=push&per_page=100');
      if(!verifiedRun(runs.workflow_runs,sha)){this.log('Waiting for successful verify.yml for '+sha);return;}
      const current=await this.inspect();
      const ready=await this.health();
      if(ready.status!==200||!idleHealth(ready.body)){this.log('Rooms active or health unknown; update deferred.');return;}
      if(this.dryRun){this.log('Dry run: verified idle update available: '+sha);return;}
      await this.perform({sha,runId,state,current});
    } finally {if(locked)await rmdir(APP+'/.nas-update.lock');}
  }
  async prepare(sha) {
    const source=this.stateRoot+'/staging/'+sha+'/source';
    const archive=this.stateRoot+'/staging/'+sha+'.tar.gz';
    await this.download(sha,archive);
    const {stdout:listing}=await exec('tar',['-tzf',archive],{maxBuffer:16*1024*1024});
    if(!archivePathsOK(listing))throw new Error('Unsafe source archive paths');
    await mkdir(source,{recursive:true});
    await exec('tar',['-xzf',archive,'-C',source,'--strip-components=1','--no-same-owner','--no-same-permissions']);
    await this.safeSource(source);
    const pkg=JSON.parse(await readFile(source+'/package.json','utf8'));
    if(!['slide-a-lama-reborn','slide-a-llama-reborn'].includes(pkg.name))throw new Error('Downloaded project identity does not match Slide-a-Llama');
    await readFile(source+'/Dockerfile');await readFile(source+'/package-lock.json');
    return {source,pkg};
  }
  async perform({sha,runId,state,current}) {
    const image='slide-a-lama-game:'+sha;
    const backup=this.stateRoot+'/backups/'+Date.now()+'-'+sha.slice(0,12);
    let entered=false,changed=false,sourceChanged=false,id=null;
    try {
      this.log('Downloading checked commit '+sha);
      const {source,pkg}=await this.prepare(sha);
      this.log('Building and checking candidate '+sha);
      await this.build(source,image,sha);
      await this.candidate(image,sha);
      const maintenance=await this.acquireMaintenance();
      if(!maintenance.acquired){this.log('Players arrived during build; candidate retained, activation deferred.');return;}
      entered=!maintenance.legacy;
      if(maintenance.legacy)this.log('Legacy server: final empty-room check passed; atomic maintenance starts with the next release.');
      await mkdir(backup,{recursive:true});
      await atomicJSON(backup+'/rollback.json',{image:current.Image,sha:state.installed_sha??null,created:new Date().toISOString()});
      await this.docker(['image','tag',current.Image,'slide-a-lama-game:rollback']);
      await this.snapshotSources(backup+'/source');
      const finalGate=await this.acquireMaintenance();
      if(!finalGate.acquired){this.log('Final room check is busy; activation deferred.');return;}
      id=await this.deployment(sha,runId);
      changed=true;await this.compose(image);
      const health=await this.health();
      if(health.status!==200||health.body?.version!==pkg.version)throw new Error('Activated game version failed verification');
      sourceChanged=true;await this.replaceSources(source);
      await this.docker(['image','tag',image,'slide-a-lama-game:latest']);
      state.installed_sha=sha;state.observed_sha=sha;state.installed_version=pkg.version;
      state.failed_sha=null;state.failed_run=null;state.last_success=new Date().toISOString();state.backup=backup;
      await atomicJSON(this.stateRoot+'/state.json',state);
      changed=false;
      try {
        if(id){await this.report(id,'success');if(runId){state.last_manual_run=runId;await atomicJSON(this.stateRoot+'/state.json',state);}}
      } catch(e){this.log('Installed successfully; GitHub receipt will be retried: '+e.message);}
      this.log('Update successful: '+sha+' version '+pkg.version);
    } catch(e) {
      this.log('Update failed: '+e.message);
      if(changed) {
        await this.compose(current.Image);
        if(sourceChanged)await this.replaceSources(backup+'/source');
        this.log('Previous Slide image and sources restored.');
      }
      state.failed_sha=retryableError(e)?null:sha;state.failed_run=runId;state.last_error=e.message;
      await atomicJSON(this.stateRoot+'/state.json',state);
      if(id)try{await this.report(id,'failure');}catch{}
      throw e;
    } finally {if(entered)await this.releaseMaintenance();}
  }
}
