import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import Hypercore from 'hypercore';
import fixtures from './fixtures.js';
import {encodeFixture,manifestFor,inspectBlock,withLocalCores,replicateFixtures} from './peartrace.js';

test('three synthetic records replicate byte-for-byte into a read-only Hypercore',async()=>{
  const result=await replicateFixtures(fixtures);
  assert.equal(result.ok,true);assert.equal(result.results.length,3);
  assert.equal(result.readerWritable,false);assert.equal(result.externalNetworkTested,false);
});
test('canonical encoding does not depend on object key insertion order',()=>{
  assert.deepEqual(encodeFixture(fixtures[1]),encodeFixture({values:[-7,0,42],kind:'synthetic',id:'signed-integers',version:1}));
});
test('an untrusted writer can replicate validly signed but unexpected bytes; manifest detects mismatch',async()=>{
  const expected=manifestFor([fixtures[1]]).records[0];
  await withLocalCores(async({writer,reader,connect})=>{
    await writer.append(encodeFixture({...fixtures[1],values:[-7,0,43]}));connect();
    assert.deepEqual(inspectBlock(await reader.get(0,{timeout:5000}),expected),{ok:false,reason:'digest-mismatch'});
  });
});
test('unknown fields, private-data-like input, floats and duplicate ids are rejected',()=>{
  for(const bad of [{...fixtures[0],secret:'x'},{...fixtures[0],kind:'personal'},{...fixtures[0],values:[0.5]},{...fixtures[0],values:[Infinity]},{...fixtures[0],id:'../file'}])assert.throws(()=>encodeFixture(bad));
  assert.throws(()=>manifestFor([fixtures[0],fixtures[0]]));
  assert.equal(inspectBlock(Buffer.from('not json'),manifestFor([fixtures[0]]).records[0]).reason,'invalid-schema');
});
test('a replica without the writer secret cannot append',async()=>{
  await withLocalCores(async({reader})=>{assert.equal(reader.writable,false);await assert.rejects(reader.append(encodeFixture(fixtures[0])));});
});
test('disconnected local cache reports missing block; reconnect fetches later append',async()=>{
  await withLocalCores(async({writer,reader,connect,disconnect})=>{
    await writer.append(encodeFixture(fixtures[0]));connect();
    assert.deepEqual(await reader.get(0,{timeout:5000}),encodeFixture(fixtures[0]));disconnect();
    await writer.append(encodeFixture(fixtures[1]));
    assert.equal(await reader.get(1,{wait:false}),null);
    connect();assert.deepEqual(await reader.get(1,{timeout:5000}),encodeFixture(fixtures[1]));
  });
});
test('writer data and identity persist across a local close and reopen',async()=>{
  const root=await mkdtemp(join(tmpdir(),'peartrace-persist-'));let core;
  try {core=new Hypercore(root);await core.ready();await core.append(encodeFixture(fixtures[2]));
    const key=Buffer.from(core.key);await core.close();core=new Hypercore(root);await core.ready();
    assert.deepEqual(core.key,key);assert.deepEqual(await core.get(0),encodeFixture(fixtures[2]));
  }finally{await core?.close();await rm(root,{recursive:true,force:true});}
});
