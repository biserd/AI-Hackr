import {POLICY_VERSION} from '../policies.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {BillingService,billingWebhook} from '../billing.mjs';
import {AccountService,rpcResult} from '../accounts.mjs';
import {Storage} from './storage.mjs';
async function setup(){
  const storage=new Storage(),account=new AccountService(storage);await storage.put('user:u',{id:'u',trialLimit:20,trialReserved:0});await account.billingCustomer('u','cus_aihackr');
  const env={STRIPE_SECRET_KEY:'sk_test_fixture_not_a_real_key',STRIPE_WEBHOOK_SECRET:'whsec_fixture_not_a_real_secret',STRIPE_PRICES:JSON.stringify({starter:'price_starter',builder:'price_builder',scale:'price_scale'}),STRIPE_PORTAL_CONFIGURATION:'bpc_fixture',ACCOUNT_DIRECTORY:{getByName:()=>new Proxy({},{get:(_,method)=>(...args)=>rpcResult(()=>account[method](...args))})}};
  const start=Math.floor(Date.now()/1000),end=start+30*86400;
  const sub={id:'sub_aihackr',created:start,customer:'cus_aihackr',status:'active',cancel_at_period_end:false,items:{data:[{price:{id:'price_starter'},quantity:1,current_period_start:start,current_period_end:end}]}};
  const invoices=new Map([['in_first',{id:'in_first',customer:'cus_aihackr',status:'paid',billing_reason:'subscription_create',parent:{subscription_details:{subscription:sub.id}}}]]);
  const lines=new Map([['in_first',[{quantity:1,amount:900,pricing:{price_details:{price:'price_starter'}},period:{start,end}}]]]);let checkoutParams,portalParams,customerCreates=0;
  const client={prices:{retrieve:async id=>({active:true,currency:'usd',unit_amount:{price_starter:900,price_builder:2900,price_scale:7900}[id],recurring:{interval:'month',interval_count:1,usage_type:'licensed'},product:{metadata:{app:'aihackr',plan:id.replace('price_','')}}})},subscriptions:{retrieve:async()=>structuredClone(sub),list:async()=>({data:[],has_more:false})},invoices:{retrieve:async id=>structuredClone(invoices.get(id)),listLineItems:async id=>({data:structuredClone(lines.get(id)??[]),has_more:false}),list:async()=>({data:[...invoices.values()]})},customers:{create:async()=>{customerCreates++;return{id:'cus_created'};}},checkout:{sessions:{create:async(params)=>{checkoutParams=params;return {id:'cs_fixture',url:'https://checkout.stripe.com/fixture'};},retrieve:async id=>({id,customer:'cus_aihackr',status:'open',payment_status:'unpaid',subscription:sub.id,invoice:'in_first'}),expire:async()=>({status:'expired'})}},billingPortal:{sessions:{create:async params=>{portalParams=params;return {url:'https://billing.stripe.com/fixture'};}}},charges:{retrieve:async()=>({customer:'cus_aihackr',payment_intent:'pi_fixture'})},invoicePayments:{list:async()=>({data:[{invoice:'in_first'}],has_more:false})}};
  const billing=new BillingService(env,{client});return{account,env,billing,client,sub,invoices,lines,start,end,params:()=>({checkoutParams,portalParams,customerCreates})};
}
test('paid canonical invoices grant once across different and replayed webhook events; redirects and unpaid checkout cannot grant',async()=>{
  const s=await setup();await s.billing.event({id:'evt_checkout',type:'checkout.session.completed',created:s.start,data:{object:{id:'cs_unpaid'}}});assert.equal((await s.account.creditSummary('u')).available,20);
  const event={id:'evt_paid',type:'invoice.paid',created:s.start,data:{object:{id:'in_first'}}};await s.billing.event(event);await s.billing.event(event);await s.billing.event({...event,id:'evt_another_delivery'});assert.equal((await s.account.creditSummary('u')).available,1020);
  await s.account.creditReserve('u','request',5);await s.account.creditSettle('u','request',5);await s.billing.refresh({id:'u'});assert.equal((await s.account.creditSummary('u')).available,1015);
});
test('renewals and prorated upgrades add only the paid invoice entitlement; old paid periods stay expired',async()=>{
  const s=await setup();await s.billing.invoice('in_first');
  s.invoices.set('in_upgrade',{id:'in_upgrade',customer:'cus_aihackr',status:'paid',billing_reason:'subscription_update',parent:{subscription_details:{subscription:s.sub.id}}});s.lines.set('in_upgrade',[{quantity:1,amount:-450,pricing:{price_details:{price:'price_starter'}},period:{end:s.end},parent:{subscription_item_details:{proration:true}}},{quantity:1,amount:1450,pricing:{price_details:{price:'price_builder'}},period:{end:s.end},parent:{subscription_item_details:{proration:true}}}]);
  await s.billing.invoice('in_upgrade');assert.equal((await s.account.creditSummary('u')).available,3020);
  s.invoices.set('in_old',{id:'in_old',customer:'cus_aihackr',status:'paid',parent:{subscription_details:{subscription:s.sub.id}}});s.lines.set('in_old',[{quantity:1,amount:7900,pricing:{price_details:{price:'price_scale'}},period:{end:s.start-10}}]);await s.billing.invoice('in_old');assert.equal((await s.account.creditSummary('u')).available,3020);
});
test('other apps, foreign customers and subscription updates alone cannot grant credits',async()=>{
  const s=await setup();await s.billing.subscription(s.sub.id);assert.equal((await s.account.creditSummary('u')).available,20);s.lines.set('in_first',[{quantity:1,amount:999,pricing:{price_details:{price:'price_other_app'}},period:{end:s.end}}]);await s.billing.invoice('in_first');assert.equal((await s.account.creditSummary('u')).available,20);s.invoices.get('in_first').customer='cus_unrelated';await s.billing.invoice('in_first');assert.equal((await s.account.creditSummary('u')).available,20);
});
test('a delayed subscription event reads current canonical state instead of restoring old status',async()=>{
  const s=await setup();await s.billing.subscription(s.sub.id);s.sub.cancel_at_period_end=true;await s.billing.event({id:'evt_delayed',type:'customer.subscription.updated',created:s.start-1000,data:{object:{id:s.sub.id,status:'active',cancel_at_period_end:false}}});assert.equal((await s.account.creditSummary('u')).billing.cancelAtPeriodEnd,true);
});
test('financial risk resolves charge to invoice to subscription and holds credits, replay safely',async()=>{
  const s=await setup();await s.billing.invoice('in_first');const event={id:'evt_refund',type:'charge.refunded',created:s.start,data:{object:{id:'ch_fixture'}}};await s.billing.event(event);await s.billing.event(event);assert.equal((await s.account.creditSummary('u')).available,0);assert.equal((await s.account.creditSummary('u')).billing.hold,true);await assert.rejects(()=>s.account.creditReserve('u','new',1),{code:'BILLING_REVIEW'});
});
test('checkout uses allowlisted server prices, fixed returns, dynamic methods, no tax and one pending attempt',async()=>{
  const s=await setup();await s.billing.checkout({id:'u',email:'test@example.com'},'starter','https://aihackr.com',POLICY_VERSION);const p=s.params().checkoutParams;assert.deepEqual(p.line_items,[{price:'price_starter',quantity:1}]);assert.equal(p.automatic_tax.enabled,false);assert.equal(p.payment_method_types,undefined);assert.match(p.integration_identifier,/aihackr_launch_[a-z]{8}$/);assert.equal(p.success_url,'https://aihackr.com/dashboard?checkout=success');await assert.rejects(()=>s.billing.checkout({id:'u'},'builder','https://aihackr.com',POLICY_VERSION),{code:'CHECKOUT_PENDING'});await assert.rejects(()=>s.billing.checkout({id:'u'},'price_other','https://aihackr.com',POLICY_VERSION),{code:'INVALID_INPUT'});
  s.client.subscriptions.list=async()=>({data:[s.sub],has_more:false});await s.billing.checkout({id:'u'},'builder','https://aihackr.com',POLICY_VERSION);assert.equal(s.params().portalParams.customer,'cus_aihackr');assert.equal(s.params().portalParams.configuration,'bpc_fixture');
});
test('webhook verification rejects unsigned and tampered input and accepts a valid Stripe signature',async()=>{
  const s=await setup(),payload=JSON.stringify({id:'evt_ignored',type:'not.subscribed',livemode:false,data:{object:{}}}),client=new Stripe(s.env.STRIPE_SECRET_KEY,{httpClient:Stripe.createFetchHttpClient()}),signature=await client.webhooks.generateTestHeaderStringAsync({payload,secret:s.env.STRIPE_WEBHOOK_SECRET,cryptoProvider:Stripe.createSubtleCryptoProvider()});
  const request=(body,sig)=>new Request('https://aihackr.com/stripe/webhook',{method:'POST',headers:{'stripe-signature':sig??''},body});await assert.rejects(()=>billingWebhook(request(payload),s.env),{code:'INVALID_SIGNATURE'});await assert.rejects(()=>billingWebhook(request(payload+' ',signature),s.env),{code:'INVALID_SIGNATURE'});assert.equal((await billingWebhook(request(payload,signature),s.env)).status,200);
});
test('unpaid checkout can be closed before choosing a new plan; wrong catalog configuration fails closed',async()=>{
  const s=await setup();await s.billing.checkout({id:'u'},'starter','https://aihackr.com',POLICY_VERSION);await s.billing.closeCheckout({id:'u'});await s.billing.checkout({id:'u'},'builder','https://aihackr.com',POLICY_VERSION);assert.equal(s.params().checkoutParams.line_items[0].price,'price_builder');
  s.client.prices.retrieve=async()=>({active:true,currency:'usd',unit_amount:499,recurring:{interval:'month',interval_count:1,usage_type:'licensed'},product:{metadata:{app:'another-app'}}});await assert.rejects(()=>s.billing.checkout({id:'u'},'scale','https://aihackr.com',POLICY_VERSION),{code:'BILLING_CONFIGURATION'});
});

test('new checkout requires current policy acceptance and records a server timestamp',async()=>{
  const s=await setup();await assert.rejects(()=>s.billing.checkout({id:'u'},'starter','https://aihackr.com'),{code:'POLICY_ACCEPTANCE_REQUIRED'});assert.equal(s.params().checkoutParams,undefined);await s.billing.checkout({id:'u'},'starter','https://aihackr.com',POLICY_VERSION);const consent=await s.account.storage.get('billing-consent:u');assert.equal(consent.version,POLICY_VERSION);assert(consent.acceptedAt>0);assert.equal(s.params().checkoutParams.metadata.terms_version,POLICY_VERSION);assert.equal(s.params().checkoutParams.subscription_data.billing_mode.type,'flexible');
});

test('completed or expired Checkout does not prevent a later subscription; foreign sessions fail closed',async()=>{
  for(const status of ['complete','expired']){
    const s=await setup();await s.billing.checkout({id:'u'},'starter','https://aihackr.com',POLICY_VERSION);
    const previous=await s.account.checkoutPending('u');
    s.client.checkout.sessions.retrieve=async()=>({customer:'cus_aihackr',status});
    await s.billing.checkout({id:'u'},'builder','https://aihackr.com',POLICY_VERSION);
    assert.notEqual((await s.account.checkoutPending('u')).id,previous.id);
    assert.equal(s.params().checkoutParams.line_items[0].price,'price_builder');
  }
  const s=await setup();await s.billing.checkout({id:'u'},'starter','https://aihackr.com',POLICY_VERSION);
  s.client.checkout.sessions.retrieve=async()=>({customer:'cus_other',status:'expired'});
  await assert.rejects(()=>s.billing.checkout({id:'u'},'builder','https://aihackr.com',POLICY_VERSION),{code:'BILLING_CONFLICT'});
});
