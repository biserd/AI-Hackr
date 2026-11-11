export const FREE_MONTHLY_CREDITS=1200;
export const PLANS=Object.freeze([
  {id:'starter',name:'Starter',amount:700,credits:3000,currency:'usd',interval:'month',description:'For personal projects and small automations.'},
  {id:'builder',name:'Builder',amount:1500,credits:7500,currency:'usd',interval:'month',description:'For growing apps and regular data workflows.',recommended:true},
  {id:'scale',name:'Scale',amount:2900,credits:20000,currency:'usd',interval:'month',description:'For teams running larger data pipelines.'},
]);
// Stripe can deliver renewals and retries for an earlier price after a catalog change.
export const LEGACY_PLANS=Object.freeze([
  {id:'starter',amount:900,credits:1000},
  {id:'builder',amount:2900,credits:5000},
  {id:'scale',amount:7900,credits:20000},
]);
export const planFor=id=>PLANS.find(plan=>plan.id===id);
export const CREDIT_COSTS={scrape:1,map:1,extract:5,crawl:1};
