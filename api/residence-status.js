/**
 * /api/residence-status?wallet=0x...
 * Returns active SSoW listings for a wallet so listed whales can be "Away"
 * and excluded from Credit eligibility.
 *
 * Vercel env var required: RESERVOIR_API_KEY
 * Uses Reservoir's User Tokens endpoint with onlyListed=true.
 */
const CONTRACT='0x88091012eedf8dba59d08e27ed7b22008f5d6fe5';

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=120');
  const wallet=String(req.query?.wallet||'').trim();
  if(!/^0x[a-fA-F0-9]{40}$/.test(wallet)) return res.status(400).json({ok:false,error:'Invalid wallet address'});
  const key=process.env.RESERVOIR_API_KEY;
  if(!key) return res.status(503).json({ok:false,error:'Listing verification is not configured'});

  try{
    const listed=[];
    let continuation=null,guard=0;
    do{
      const u=new URL(`https://api.reservoir.tools/users/${wallet}/tokens/v10`);
      u.searchParams.set('contract',CONTRACT);
      u.searchParams.set('onlyListed','true');
      u.searchParams.set('limit','200');
      if(continuation)u.searchParams.set('continuation',continuation);
      const r=await fetch(u,{headers:{accept:'application/json','x-api-key':key}});
      const data=await r.json();
      if(!r.ok) throw new Error(data?.message||data?.error||`Reservoir ${r.status}`);
      for(const row of (data.tokens||[])){
        const id=row?.token?.tokenId ?? row?.token?.token_id ?? row?.tokenId;
        if(id!=null) listed.push(String(id));
      }
      continuation=data.continuation||null;
      guard++;
    }while(continuation&&guard<60);
    return res.status(200).json({ok:true,wallet,contract:CONTRACT,listedTokenIds:[...new Set(listed)]});
  }catch(e){
    console.error('residence-status',e);
    return res.status(502).json({ok:false,error:'Unable to verify active listings'});
  }
}
