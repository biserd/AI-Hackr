import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountService,digest} from '../accounts.mjs';
import {Storage} from './storage.mjs';

test('review credentials create only an isolated review identity and hash the session',async()=>{
  const storage=new Storage(),now=Date.parse('2026-11-10T12:00:00Z');
  const accounts=new AccountService(storage,{now:()=>now,monthlyFreeCredits:1200});
  const password='test-only-review-password-with-64-characters-123456789abcdefghijk';
  const hash=await digest(password),expiry='2026-12-10T00:00:00Z';
  await storage.put('user:existing',{id:'existing',email:'owner@example.com'});
  const first=await accounts.reviewerLogin('plugin-review@aihackr.com',password,'203.0.113.10',hash,expiry);
  const identity=await accounts.authenticate(first.session);
  assert.equal(identity.email,'plugin-review@aihackr.com');
  assert.notEqual(identity.id,'existing');
  assert.equal((await accounts.creditSummary(identity.id)).available,1200);
  const second=await accounts.reviewerLogin('plugin-review@aihackr.com',password,'203.0.113.10',hash,expiry);
  assert.equal((await accounts.authenticate(second.session)).id,identity.id);
  assert.equal(await storage.get('email:'+await digest('plugin-review@aihackr.com')),undefined);
  const records=JSON.stringify([...storage.data]);
  assert(!records.includes(password));
  assert(!records.includes(first.session));
});

test('review credentials fail closed when absent or expired and cannot select another account',async()=>{
  const storage=new Storage(),now=Date.parse('2026-11-10T12:00:00Z');
  const accounts=new AccountService(storage,{now:()=>now});
  const password='test-only-review-password-with-at-least-32-characters';
  const hash=await digest(password),expiry='2026-12-10T00:00:00Z';
  await assert.rejects(accounts.reviewerLogin('plugin-review@aihackr.com',password,'203.0.113.10',undefined,expiry),{status:404});
  await assert.rejects(accounts.reviewerLogin('plugin-review@aihackr.com',password,'203.0.113.10',hash,'2026-11-01T00:00:00Z'),{status:404});
  await assert.rejects(accounts.reviewerLogin('owner@example.com',password,'203.0.113.10',hash,expiry),{status:401});
  for(let attempt=0;attempt<9;attempt++)await assert.rejects(accounts.reviewerLogin('plugin-review@aihackr.com','x'.repeat(64),'203.0.113.10',hash,expiry),{status:401});
  await assert.rejects(accounts.reviewerLogin('plugin-review@aihackr.com',password,'203.0.113.10',hash,expiry),{status:429});
  assert.equal(await storage.get('reviewer:user-id'),undefined);
});
