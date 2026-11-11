import Stripe from 'stripe';
import {directoryCall} from './accounts.mjs';
import {PLANS,LEGACY_PLANS,planFor} from './plans.mjs';
import {boundedJson,boundedText,json,onlyKeys,reject} from './policy.mjs';
import {POLICY_VERSION} from './policies.mjs';

export const BILLING_EVENTS=['checkout.session.completed','checkout.session.async_payment_succeeded','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed','charge.refunded','charge.dispute.created','radar.early_fraud_warning.created'];
const id=value=>typeof value==='string'?value:value?.id;
function priceMap(value){
  try{return JSON.parse(value??'{}')??{};}
  catch{return {};}
}
export function billingConfig(env){
  const prices=priceMap(env.STRIPE_PRICES_V2);
  const legacyPrices=priceMap(env.STRIPE_PRICES);
  const priceIds=PLANS.map(plan=>prices[plan.id]);
  const ready=Boolean(env.STRIPE_SECRET_KEY&&env.STRIPE_WEBHOOK_SECRET&&env.STRIPE_PORTAL_CONFIGURATION_V2&&
    priceIds.every(price=>typeof price==='string'&&/^price_[a-zA-Z0-9]+$/.test(price))&&
    new Set(priceIds).size===PLANS.length&&priceIds.every(price=>!Object.values(legacyPrices).includes(price)));
  return {prices,legacyPrices,ready};
}
export function stripeClient(env){if(!env.STRIPE_SECRET_KEY)reject('BILLING_UNAVAILABLE','Billing is temporarily unavailable.',503);return new Stripe(env.STRIPE_SECRET_KEY,{apiVersion:'2026-09-30.endive',httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:2,timeout:15000});}
export class BillingService{
  constructor(env,{client}={}){this.env=env;this.client=client??stripeClient(env);this.config=billingConfig(env);}
  plan(price){
    const priceId=id(price);
    if(!priceId)return;
    return PLANS.find(plan=>this.config.prices[plan.id]===priceId)
      ??LEGACY_PLANS.find(plan=>this.config.legacyPrices[plan.id]===priceId);
  }
  async validatePrice(plan){const price=await this.client.prices.retrieve(this.config.prices[plan.id],{expand:['product']});if(!price.active||price.currency!=='usd'||price.unit_amount!==plan.amount||price.recurring?.interval!=='month'||price.recurring?.interval_count!==1||price.recurring?.usage_type!=='licensed'||price.product?.metadata?.app!=='aihackr'||price.product?.metadata?.plan!==plan.id)reject('BILLING_CONFIGURATION','The selected plan is not configured correctly. Please contact support.',503);return price;}
  async owner(customer){return customer?directoryCall(this.env,'customerOwner',id(customer)):null;}
  async customer(user){
    let customer=await directoryCall(this.env,'billingCustomer',user.id);
    if(!customer){const created=await this.client.customers.create({email:user.email,metadata:{app:'aihackr',user_id:user.id}},{idempotencyKey:'aihackr-customer-v1-'+user.id});customer=await directoryCall(this.env,'billingCustomer',user.id,created.id);}
    return customer;
  }
  async subscription(subscription){
    const observedAt=Date.now();
    const sub=await this.client.subscriptions.retrieve(id(subscription)),userId=await this.owner(sub.customer);if(!userId)return;
    const item=sub.items?.data?.find(item=>this.plan(item.price));if(!item||sub.items.data.length!==1)return;
    const plan=this.plan(item.price);
    await directoryCall(this.env,'billingUpdate',userId,{plan:plan.id,monthlyAmount:plan.amount,monthlyCredits:plan.credits,status:sub.status,subscription:sub.id,subscriptionCreated:sub.created,periodStart:item.current_period_start*1000,periodEnd:item.current_period_end*1000,cancelAtPeriodEnd:sub.cancel_at_period_end,updated:observedAt});
    return {userId,customer:id(sub.customer),subscription:sub.id};
  }
  async invoice(invoiceId){
    const invoice=await this.client.invoices.retrieve(id(invoiceId)),userId=await this.owner(invoice.customer);if(!userId)return;
    const subscription=id(invoice.parent?.subscription_details?.subscription);if(!subscription)return;
    const ownership=await this.subscription(subscription);if(ownership?.userId!==userId||ownership.customer!==id(invoice.customer))return;
    if(invoice.status!=='paid')return;
    // Price and service periods come from the paid invoice, never a redirect or
    // the customer's current plan. Replayed and old invoices cannot reset usage.
    const lines=await this.client.invoices.listLineItems(invoice.id,{limit:100});if(lines.has_more)throw new Error('Unexpected invoice line count');
    let total=0,expiresAt=0,startsAt=Infinity;
    for(const line of lines.data){
      const plan=this.plan(line.pricing?.price_details?.price);if(!plan)continue;
      if(line.quantity!==1||line.subscription&&id(line.subscription)!==subscription)throw new Error('Unexpected subscription quantity');
      const prorated=line.parent?.subscription_item_details?.proration??false;
      if(prorated){total+=plan.credits*line.amount/plan.amount;}else if(line.amount>=0){total+=plan.credits;}
      expiresAt=Math.max(expiresAt,(line.period?.end??0)*1000);
      startsAt=Math.min(startsAt,(line.period?.start??0)*1000);
    }
    total=Math.max(0,Math.floor(total+1e-7));if(!total||!expiresAt)return;
    return directoryCall(this.env,'creditGrant',userId,{id:invoice.id,invoice:invoice.id,label:invoice.billing_reason==='subscription_update'?'Paid plan adjustment':'Monthly plan credits',total,startsAt,expiresAt});
  }
  async refresh(user){
    const customer=await directoryCall(this.env,'billingCustomer',user.id);if(!customer)return;
    const subs=await this.client.subscriptions.list({customer,status:'all',limit:20});
    const own=subs.data.filter(s=>s.items.data.some(i=>this.plan(i.price))).sort((a,b)=>b.created-a.created);
    if(own[0])await this.subscription(own[0].id);
    const invoices=await this.client.invoices.list({customer,status:'paid',limit:12});
    for(const invoice of invoices.data)await this.invoice(invoice.id);
  }
  async checkout(user,planId,origin,acceptedTermsVersion){
    if(!this.config.ready)reject('BILLING_UNAVAILABLE','Billing setup is not complete yet.',503);
    const plan=planFor(planId);if(!plan)reject('INVALID_INPUT','Choose an AIHackr plan.');
    await this.validatePrice(plan);
    const customer=await this.customer(user),subscriptions=await this.client.subscriptions.list({customer,status:'all',limit:100});
    if(subscriptions.has_more)reject('BILLING_REVIEW','Contact support to review your billing account.',409);
    if(subscriptions.data.some(s=>!['canceled','incomplete_expired'].includes(s.status)))return this.portal(user,origin);
    if(acceptedTermsVersion!==POLICY_VERSION)reject('POLICY_ACCEPTANCE_REQUIRED','Review and accept the current Terms and Cancellation & Refund Policy before subscribing.',400);
    await directoryCall(this.env,'recordBillingConsent',user.id,POLICY_VERSION);
    const previous=await directoryCall(this.env,'checkoutPending',user.id);
    if(previous?.session){const session=await this.client.checkout.sessions.retrieve(previous.session);if(id(session.customer)!==customer)reject('BILLING_CONFLICT','Checkout ownership mismatch.',403);if(['expired','complete'].includes(session.status))await directoryCall(this.env,'checkoutPending',user.id,previous.id,null);}
    const attempt=await directoryCall(this.env,'checkoutAttempt',user.id,planId,this.config.prices[planId]);
    const suffix=attempt.suffix??attempt.id.replace(/[^a-z]/g,'').padEnd(8,'a').slice(0,8);
    const session=await this.client.checkout.sessions.create({mode:'subscription',customer,line_items:[{price:this.config.prices[planId],quantity:1}],client_reference_id:user.id,metadata:{app:'aihackr',user_id:user.id,terms_version:POLICY_VERSION},subscription_data:{billing_mode:{type:'flexible'},metadata:{app:'aihackr',user_id:user.id,terms_version:POLICY_VERSION}},custom_text:{submit:{message:'Your AIHackr subscription renews monthly until cancelled. [Terms]('+origin+'/terms) and [Cancellation & Refund Policy]('+origin+'/refunds) apply. No automatic overage charges.'}},automatic_tax:{enabled:false},integration_identifier:'aihackr_launch_'+suffix,success_url:origin+'/dashboard?checkout=success',cancel_url:origin+'/dashboard?checkout=cancelled',expires_at:Math.floor(attempt.createdAt/1000)+1860},{idempotencyKey:'aihackr-checkout-'+attempt.id});
    await directoryCall(this.env,'checkoutPending',user.id,attempt.id,session.id);
    return {url:session.url};
  }
  async closeCheckout(user){const attempt=await directoryCall(this.env,'checkoutPending',user.id);if(!attempt)return {success:true};if(!attempt.session)reject('CHECKOUT_PENDING','Checkout is being created. Try again shortly.',409);const customer=await directoryCall(this.env,'billingCustomer',user.id),session=await this.client.checkout.sessions.retrieve(attempt.session);if(id(session.customer)!==customer)reject('BILLING_CONFLICT','Checkout ownership mismatch.',403);if(session.status==='complete')reject('CHECKOUT_COMPLETE','Checkout completed. Check payment status or manage your subscription.',409);if(session.status==='open')await this.client.checkout.sessions.expire(session.id);await directoryCall(this.env,'checkoutPending',user.id,attempt.id,null);return {success:true};}
  async portal(user,origin){
    const customer=await directoryCall(this.env,'billingCustomer',user.id);
    if(!customer)reject('NOT_FOUND','Choose your first plan below.',404);
    const subscriptions=await this.client.subscriptions.list({customer,status:'all',limit:100});
    const legacy=Object.values(this.config.legacyPrices);
    const hasLegacySubscription=subscriptions.data.some(sub=>
      !['canceled','incomplete_expired'].includes(sub.status)&&sub.items.data.some(item=>legacy.includes(id(item.price))));
    const configuration=hasLegacySubscription?this.env.STRIPE_PORTAL_CONFIGURATION:this.env.STRIPE_PORTAL_CONFIGURATION_V2;
    if(!configuration)reject('BILLING_UNAVAILABLE','Billing is temporarily unavailable.',503);
    const session=await this.client.billingPortal.sessions.create({customer,configuration,return_url:origin+'/dashboard'});
    return {url:session.url};
  }
  async risk(object,type){
    const chargeId=type==='charge.refunded'?object.id:id(object.charge);if(!chargeId)return;
    const charge=await this.client.charges.retrieve(chargeId),userId=await this.owner(charge.customer);if(!userId)return;
    const paymentIntent=id(charge.payment_intent);if(!paymentIntent)return;
    let after;do{
      const payments=await this.client.invoicePayments.list({payment:{type:'payment_intent',payment_intent:paymentIntent},limit:100,...(after?{starting_after:after}:{})});
      for(const payment of payments.data){const invoice=await this.client.invoices.retrieve(id(payment.invoice)),subscription=invoice.parent?.subscription_details?.subscription;if(!subscription)continue;const sub=await this.client.subscriptions.retrieve(id(subscription));if(id(sub.customer)!==id(charge.customer)||!sub.items.data.some(item=>this.plan(item.price)))continue;
        await directoryCall(this.env,'billingRisk',userId,invoice.id,type==='charge.refunded'?'Payment refunded':type==='charge.dispute.created'?'Payment disputed':'Payment risk review');
      }
      after=payments.has_more?payments.data.at(-1)?.id:null;
    }while(after);
  }
  async event(event){
    if(!BILLING_EVENTS.includes(event.type))return;
    if(await directoryCall(this.env,'billingEvent',event.id))return;
    const object=event.data.object;
    if(event.type.startsWith('customer.subscription.'))await this.subscription(object.id,event.created);
    else if(event.type==='invoice.paid')await this.invoice(object.id);
    else if(event.type==='invoice.payment_failed'){const invoice=await this.client.invoices.retrieve(object.id);const sub=invoice.parent?.subscription_details?.subscription;if(sub)await this.subscription(sub,event.created);}
    else if(event.type.startsWith('checkout.session.')){const session=await this.client.checkout.sessions.retrieve(object.id);if(session.payment_status==='paid'&&session.subscription){await this.subscription(session.subscription,event.created);if(session.invoice)await this.invoice(session.invoice);}}
    else await this.risk(object,event.type);
    await directoryCall(this.env,'billingEvent',event.id,true);
  }
}
export async function billingWebhook(request,env){
  if(request.method!=='POST')reject('NOT_FOUND','Unknown route.',404);
  if(!env.STRIPE_WEBHOOK_SECRET)reject('BILLING_UNAVAILABLE','Billing is not configured.',503);
  const service=new BillingService(env);let event;
  try{event=await service.client.webhooks.constructEventAsync(await boundedText(request,262144),request.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET,300,Stripe.createSubtleCryptoProvider());}catch{reject('INVALID_SIGNATURE','Invalid webhook signature.',400);}
  if(event.livemode!==!env.STRIPE_SECRET_KEY.includes('_test_'))reject('INVALID_MODE','Webhook environment mismatch.',400);
  await service.event(event);return json({received:true});
}
export async function billingRoute(request,env,identity){
  if(identity.kind!=='session')reject('AUTH_REQUIRED','Sign in on the website to manage billing.',403);
  const service=new BillingService(env),url=new URL(request.url);
  if(request.method!=='POST')reject('NOT_FOUND','Unknown billing route.',404);
  await directoryCall(env,'billingThrottle',identity.id);
  if(url.pathname==='/api/billing/checkout'){const body=await boundedJson(request,2048);onlyKeys(body,['plan','acceptedTermsVersion']);return json(await service.checkout(identity,body.plan,url.origin,body.acceptedTermsVersion));}
  if(url.pathname==='/api/billing/portal')return json(await service.portal(identity,url.origin));
  if(url.pathname==='/api/billing/refresh'){await service.refresh(identity);return json(await directoryCall(env,'creditSummary',identity.id));}
  if(url.pathname==='/api/billing/close-checkout')return json(await service.closeCheckout(identity));
  reject('NOT_FOUND','Unknown billing route.',404);
}
