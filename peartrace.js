import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Hypercore from 'hypercore';

// A deliberately narrow, deterministic schema for synthetic public fixtures.
// Hashing authenticates neither the origin nor the truth of a record.
export function encodeFixture(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'id,kind,values,version' ||
      value.version !== 1 || value.kind !== 'synthetic' ||
      typeof value.id !== 'string' || !/^[a-z0-9_-]{1,64}$/.test(value.id) ||
      !Array.isArray(value.values) || value.values.length > 64 ||
      !value.values.every(v => Number.isSafeInteger(v))) {
    throw new TypeError('Invalid synthetic fixture v1');
  }
  return Buffer.from(JSON.stringify({version:1,id:value.id,kind:'synthetic',values:value.values}));
}
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function manifestFor(fixtures) {
  if (!Array.isArray(fixtures) || fixtures.length === 0 || fixtures.length > 32)
    throw new TypeError('Expected 1..32 fixtures');
  const records = fixtures.map((fixture,index) => {
    const block = encodeFixture(fixture);
    return {index,id:fixture.id,bytes:block.length,sha256:sha256(block)};
  });
  if (new Set(records.map(r=>r.id)).size !== records.length) throw new TypeError('Duplicate fixture id');
  return {version:1,records};
}
export function inspectBlock(block, expected) {
  if (!expected || !Number.isSafeInteger(expected.bytes) || !/^[a-f0-9]{64}$/.test(expected.sha256))
    throw new TypeError('Invalid expected record');
  let parsed;
  try { parsed=JSON.parse(block.toString('utf8')); encodeFixture(parsed); }
  catch { return {ok:false,reason:'invalid-schema'}; }
  if(parsed.id !== expected.id) return {ok:false,reason:'id-mismatch'};
  if(block.length!==expected.bytes || sha256(block)!==expected.sha256)
    return {ok:false,reason:'digest-mismatch'};
  return {ok:true,reason:'exact-bytes-match'};
}
// Two real Hypercores use in-process replication streams; there is no DHT,
// external network peer, wallet, or arbitrary file input in this experiment.
export async function withLocalCores(run) {
  const root=await mkdtemp(join(tmpdir(),'peartrace-'));
  let writer,reader,left,right;
  try {
    writer=new Hypercore(join(root,'writer'));
    await writer.ready();
    reader=new Hypercore(join(root,'reader'),writer.key);
    await reader.ready();
    const connect=()=>{
      if(left || right) throw Error('Already connected');
      left=writer.replicate(true);right=reader.replicate(false);
      left.pipe(right).pipe(left);
    };
    const disconnect=()=>{left?.destroy();right?.destroy();left=null;right=null;};
    return await run({writer,reader,connect,disconnect});
  } finally {
    left?.destroy();right?.destroy();
    await Promise.allSettled([reader?.close(),writer?.close()]);
    await rm(root,{recursive:true,force:true});
  }
}
export async function replicateFixtures(fixtures) {
  const manifest=manifestFor(fixtures);
  return withLocalCores(async({writer,reader,connect})=>{
    await writer.append(fixtures.map(encodeFixture));
    connect();
    const results=[];
    for (const record of manifest.records) {
      const block=await reader.get(record.index,{timeout:5000});
      results.push({index:record.index,...inspectBlock(block,record)});
    }
    return {transport:'in-process Hypercore replication streams',
      externalNetworkTested:false,readerWritable:reader.writable,
      manifest,results,ok:results.every(r=>r.ok)};
  });
}
