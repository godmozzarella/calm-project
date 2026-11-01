import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, rmSync, statSync, readdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import test from 'node:test'

const deploy = fileURLToPath(new URL('../../.github/scripts/deploy-on-server.sh', import.meta.url))
const sha = 'a'.repeat(40)
const fakeDocker = `#!/usr/bin/env node
const fs = require('fs'), zlib = require('zlib');
const args = process.argv.slice(2), root = process.env.TEST_RELEASE_ROOT;
fs.appendFileSync(root+'/commands', JSON.stringify(args)+'\\n');
if(args[0]==='inspect'){
 const format=args[args.indexOf('--format')+1]||'';
 if(format.includes('.Config.WorkingDir'))console.log('/app');
 else if(format.includes('.Config.Entrypoint'))console.log('["java","-jar","app.jar"]');
 else if(format.includes('.Config.Cmd'))console.log('null');
 else if(format.includes('.Config.User'))console.log('');
 else if(format.includes('.Config.Env'))console.log('PATH=/usr/local/bin:/usr/bin\\nMONGO_URI=mongodb://private-test-value');
 else console.log('sha256:'+('backend-container'===args.at(-1)?'b':'f').repeat(64));
 process.exit(0)
}
if(args[0]==='image'&&args[1]==='tag')process.exit(process.env.FAIL_IMAGE_TAG==='YES'?1:0)
if(args[0]==='image'&&args[1]==='inspect')process.exit(0)
if(args[0]==='export'){process.stdout.write('synthetic-root-filesystem');process.exit(0)}
if(args[0]==='import')process.exit(0)
if(args.includes('ps')&&args.some(x=>['-q','-aq','-qa'].includes(x))){if(process.env.NO_PREVIOUS_CONTAINERS!=='YES')console.log(args.at(-1)+'-container');process.exit(0)}
if(args.includes('run')) {
 if(args.some(x=>x.includes('mongodump'))){process.stdout.write(process.env.FAIL_BACKUP==='YES'?Buffer.from('broken'):zlib.gzipSync('synthetic'));process.exit(0)}
 if(args.includes('tar')){process.stdout.write(fs.readFileSync(root+'/avatars.tar.gz'));process.exit(0)}
 if(args.includes('printenv')){console.log('mongodb://test:private-test-value@mongo/calm');process.exit(0)}
 if(args.some(x=>x.includes('mongosh'))){
  if(args.some(x=>x.includes('/scripts/export-shared-risk-training.js'))){console.log('Published synthetic rows');process.exit(0)}
  const input=fs.readFileSync(0,'utf8');
  if(input==='manifest-stub'){
   const path=root+'/manifest-count',count=fs.existsSync(path)?Number(fs.readFileSync(path,'utf8')):0;fs.writeFileSync(path,String(count+1));
   console.log(JSON.stringify({attacks:{count:process.env.FAIL_MANIFEST==='YES'&&count>0?0:43,sha256:'unchanged'}}));process.exit(0)
  }
  if(input==='backfill-stub'){fs.appendFileSync(root+'/commands','MIGRATION\\n');console.log('Backfilled event locations: 1');process.exit(0)}
 }
}
if(args.includes('up')&&!args.some(x=>x.endsWith('rollback-images.yml'))&&process.env.FAIL_NEW_START==='YES')process.exit(1);
if(args.includes('up')&&args.some(x=>x.endsWith('rollback-images.yml'))&&process.env.FAIL_ROLLBACK==='YES')process.exit(1);
process.exit(0);
`

function runRelease(env = {}) {
  const root = mkdtempSync(join(tmpdir(), 'calm-release-test-'))
  try {
    mkdirSync(join(root, 'bin'))
    mkdirSync(join(root, 'backend/scripts'), { recursive: true })
    writeFileSync(join(root, 'backend/scripts/check-prod-training-readiness.sh'), 'exit 0\n')
    writeFileSync(join(root, 'backend/scripts/backfill-event-locations.js'), 'backfill-stub')
    writeFileSync(join(root, 'backend/scripts/release-source-manifest.js'), 'manifest-stub')
    writeFileSync(join(root, 'avatars.tar.gz'), gzipSync(Buffer.alloc(1024)))
    writeFileSync(join(root, 'bin/docker'), fakeDocker)
    writeFileSync(join(root, 'bin/git'), `#!/bin/sh
case "$1" in
 branch) echo main ;;
 rev-parse) echo ${'c'.repeat(40)} ;;
esac
exit 0
`)
    for (const name of ['git', 'docker']) chmodSync(join(root, 'bin', name), 0o700)
    const result = spawnSync('bash', [deploy, sha], { cwd: root, encoding: 'utf8',
      env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}`, TEST_RELEASE_ROOT: root, ...env } })
    const commands = readFileSync(join(root, 'commands'), 'utf8').split('\n').filter(Boolean)
    const output = result.stdout + result.stderr
    assert.doesNotMatch(output, /private-test-value/)
    const backup = join(root, '.release-backups', readdirSync(join(root, '.release-backups'))[0])
    const rollbackFile = join(backup, 'rollback-images.yml')
    const rollbackConfig = existsSync(rollbackFile) ? readFileSync(rollbackFile, 'utf8') : ''
    return { result, commands, output, root, rollbackConfig, cleanup: () => rmSync(root, { recursive: true, force: true }) }
  } catch (e) { rmSync(root, { recursive: true, force: true }); throw e }
}

test('release backs up and checks source before starting updated services and rebuilding all history', () => {
  const run = runRelease()
  try {
    assert.equal(run.result.status, 0, run.output)
    const i = text => run.commands.findIndex(line => line.includes(text))
    assert(i('mongodump') < i('MIGRATION'))
    assert(i('MIGRATION') < i('"caddy"'))
    assert(i('"caddy"') < i('/scripts/export-shared-risk-training.js'))
    const dockerTag = run.commands.findIndex(line => line.includes('"image","tag"'))
    assert(dockerTag >= 0 && dockerTag < i('"build"'))
    assert.match(run.rollbackConfig, /image: "calm-release-rollback-backend:[a-f0-9]{40}"/)
    assert.match(run.rollbackConfig, /image: "calm-release-rollback-frontend:[a-f0-9]{40}"/)
    assert.doesNotMatch(run.rollbackConfig, /sha256:/)
    const backups = join(run.root, '.release-backups')
    assert.equal(statSync(backups).mode & 0o077, 0)
    assert(!run.commands.some(line => line.includes('down') || line.includes('--volumes')))
  } finally { run.cleanup() }
})

for (const [name, failure] of [
  ['corrupt backup prevents migration', 'FAIL_BACKUP'],
  ['changed original data aborts startup', 'FAIL_MANIFEST'],
  ['failed new startup restores previous images', 'FAIL_NEW_START'],
]) test(name, () => {
  const run = runRelease({ [failure]: 'YES' })
  try {
    assert.notEqual(run.result.status, 0)
    assert(run.commands.some(line => line.includes('rollback-images.yml') && line.includes('"up"')))
    assert(!run.commands.some(line => line.includes('/scripts/export-shared-risk-training.js')))
    if (failure === 'FAIL_BACKUP') assert(!run.commands.includes('MIGRATION'))
    if (failure === 'FAIL_MANIFEST') assert(!run.commands.some(line => line.includes('"caddy"')))
    assert.match(run.output, /Previous backend\/frontend images restored/)
  } finally { run.cleanup() }
})

test('failed image rollback falls back to starting existing backend and frontend containers', () => {
  const run = runRelease({ FAIL_NEW_START: 'YES', FAIL_ROLLBACK: 'YES' })
  try {
    assert.notEqual(run.result.status, 0)
    assert(run.commands.some(line => line.includes('rollback-images.yml') && line.includes('"up"')))
    assert(run.commands.some(line => line.includes('"start"') && line.includes('"backend"') && line.includes('"frontend"')))
    assert.match(run.output, /Existing backend\/frontend containers started as a recovery fallback/)
  } finally { run.cleanup() }
})

test('missing prior image metadata is recovered from the existing containers before building', () => {
  const run = runRelease({ FAIL_IMAGE_TAG: 'YES' })
  try {
    assert.equal(run.result.status, 0, run.output)
    const backendExport = run.commands.findIndex(line => line.includes('"export"') && line.includes('backend-container'))
    const frontendExport = run.commands.findIndex(line => line.includes('"export"') && line.includes('frontend-container'))
    const build = run.commands.findIndex(line => line.includes('"build"'))
    assert(backendExport >= 0 && backendExport < build)
    assert(frontendExport >= 0 && frontendExport < build)
    assert.equal(run.commands.some(line => line.includes('"commit"')), false)
    assert(run.commands.some(line => line.includes('"import"') && line.includes('ENV PATH=/usr/local/bin:/usr/bin')))
    assert.match(run.rollbackConfig, /calm-release-rollback-backend:/)
    assert.match(run.rollbackConfig, /calm-release-rollback-frontend:/)
    assert.match(run.output, /Captured existing backend filesystem as a credential-free rollback image/)
    assert.match(run.output, /Captured existing frontend filesystem as a credential-free rollback image/)
  } finally { run.cleanup() }
})

test('release failure without previous containers attempts to start backend, frontend and worker', () => {
  const run = runRelease({ NO_PREVIOUS_CONTAINERS: 'YES', FAIL_BACKUP: 'YES' })
  try {
    assert.notEqual(run.result.status, 0)
    assert(run.commands.some(line => line.includes('"start"') && line.includes('"backend"') &&
      line.includes('"frontend"') && line.includes('"training-worker"')))
    assert.equal(run.rollbackConfig, '')
  } finally { run.cleanup() }
})
