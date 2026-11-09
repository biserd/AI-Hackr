document.querySelectorAll('.sample').forEach(sample=>{const button=sample.querySelector('.copy-code');if(!button||!navigator.clipboard)return;button.hidden=false;button.onclick=async()=>{try{await navigator.clipboard.writeText(sample.querySelector('code').textContent);button.textContent='Copied';setTimeout(()=>{button.textContent='Copy';},1800);}catch{button.textContent='Select the code to copy';}};});
const input=document.getElementById('docs-search');
if(input){
  const results=document.getElementById('docs-results'),original=results.innerHTML,status=document.getElementById('search-status');let indexPromise;
  input.addEventListener('input',async()=>{
    const query=input.value.trim().toLocaleLowerCase();if(!query){results.innerHTML=original;status.textContent='';return;}
    try{indexPromise??=fetch('/docs-search.json').then(response=>{if(!response.ok)throw new Error('Search unavailable');return response.json();});const index=await indexPromise;if(input.value.trim().toLocaleLowerCase()!==query)return;
      const words=query.split(/\s+/).filter(Boolean),matches=index.filter(item=>words.every(word=>(item.title+' '+item.description+' '+item.text).toLocaleLowerCase().includes(word)));
      const grid=document.createElement('div');grid.className='content-grid';
      for(const item of matches){const a=document.createElement('a');a.href=item.path;a.className='content-card';const title=document.createElement('h2');title.textContent=item.title;const description=document.createElement('p');description.textContent=item.description;a.append(title,description);grid.append(a);}results.replaceChildren(grid);status.textContent=matches.length?matches.length+' guide'+(matches.length===1?'':'s')+' found.':'No matching guides. Try a shorter query.';
    }catch{results.innerHTML=original;status.textContent='Search is unavailable. Browse all guides below.';}
  });
}
