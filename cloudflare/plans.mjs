export const PLANS=Object.freeze([
  {id:'starter',name:'Starter',amount:900,credits:1000,currency:'usd',interval:'month',description:'For personal projects and small automations.'},
  {id:'builder',name:'Builder',amount:2900,credits:5000,currency:'usd',interval:'month',description:'For growing apps and regular data workflows.',recommended:true},
  {id:'scale',name:'Scale',amount:7900,credits:20000,currency:'usd',interval:'month',description:'For teams running larger data pipelines.'},
]);
export const planFor=id=>PLANS.find(plan=>plan.id===id);
export const CREDIT_COSTS={scrape:1,map:1,extract:5,crawl:1};
