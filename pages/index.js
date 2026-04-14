import { useState, useEffect } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

const SEGS = ['Enterprise', 'Mid-Market', 'Startup/SMB', 'Not Found'];
const SEG_COLORS = { Enterprise: '#378add', 'Mid-Market': '#7f77dd', 'Startup/SMB': '#639922', 'Not Found': '#888780' };
const PROD_COLORS = ['#378add','#d85a30','#7f77dd','#639922','#ba7517','#0f6e56','#993556','#888780','#5f5e5a'];

function pct(a, b) { return b ? (a / b * 100).toFixed(1) + '%' : '—'; }

export default function Dashboard() {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [region, setRegion] = useState('ALL');
  const [seg, setSeg] = useState('ALL');
  const [product, setProduct] = useState('ALL');

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(j => {
        if (j.error) throw new Error(j.error);
        setRaw(j.data);
        setFetchedAt(j.fetchedAt);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="loading">
      <div className="spinner" />
      <p>Fetching live data from HubSpot&hellip;</p>
      <p className="sub">Pulling 16 months of inbound leads</p>
      <style jsx>{`
        .loading{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:16px;font-size:15px;color:#666;font-family:system-ui,sans-serif}
        .spinner{width:40px;height:40px;border:3px solid #eee;border-top-color:#378add;border-radius:50%;animation:spin .8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .sub{font-size:13px;color:#aaa}
      `}</style>
    </div>
  );

  if (error) return (
    <div className="err">
      <h2>Error loading data</h2>
      <p>{error}</p>
      <p>Check that HUBSPOT_API_KEY is set in Vercel &rarr; Project &rarr; Environment Variables, then redeploy.</p>
      <style jsx>{`.err{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:12px;padding:24px;text-align:center;font-family:system-ui,sans-serif}h2{color:#e74c3c}`}</style>
    </div>
  );

  const filtered = raw.map(m => {
    let ratio = 1;
    if (region === 'ROW') ratio = m.total > 0 ? m.ROW / m.total : 0;
    if (region === 'America') ratio = m.total > 0 ? m.America / m.total : 0;

    let total = region === 'ALL' ? m.total : region === 'ROW' ? m.ROW : m.America;
    let meetings = Math.round(m.meetings * ratio);
    let deals = Math.round(m.deals * ratio);
    const segments = {};
    SEGS.forEach(s => { segments[s] = Math.round((m.segments[s] || 0) * ratio); });
    const segFunnel = {};
    SEGS.forEach(s => {
      segFunnel[s] = {
        leads: Math.round((m.segFunnel[s]?.leads || 0) * ratio),
        meetings: Math.round((m.segFunnel[s]?.meetings || 0) * ratio),
        deals: Math.round((m.segFunnel[s]?.deals || 0) * ratio),
      };
    });

    if (seg !== 'ALL') {
      total = segFunnel[seg]?.leads || 0;
      meetings = segFunnel[seg]?.meetings || 0;
      deals = segFunnel[seg]?.deals || 0;
    }

    if (product !== 'ALL') {
      const pr = m.total > 0 ? (m.products[product] || 0) / m.total : 0;
      total = Math.round(total * pr);
      meetings = Math.round(meetings * pr);
      deals = Math.round(deals * pr);
    }

    return { ...m, total, meetings, deals, segments, segFunnel };
  });

  const totals = filtered.reduce((a, m) => ({ total: a.total+m.total, meetings: a.meetings+m.meetings, deals: a.deals+m.deals }), { total:0, meetings:0, deals:0 });
  const totalROW = raw.reduce((s, m) => s + m.ROW, 0);
  const totalAm = raw.reduce((s, m) => s + m.America, 0);
  const labels = filtered.map(m => m.label);

  const trendData = {
    labels,
    datasets: [
      { label: 'ROW', data: raw.map(m => m.ROW), borderColor: '#378add', backgroundColor: 'rgba(55,138,221,0.08)', fill: true, tension: 0.35, pointRadius: 3, borderWidth: 2 },
      { label: 'Americas', data: raw.map(m => m.America), borderColor: '#d85a30', backgroundColor: 'rgba(216,90,48,0.08)', fill: true, tension: 0.35, pointRadius: 3, borderWidth: 2, borderDash: [5,3] },
    ]
  };

  const allSegs = SEGS.reduce((a, s) => { a[s] = filtered.reduce((sum, m) => sum + (m.segments[s]||0), 0); return a; }, {});
  const segData = { labels: SEGS, datasets: [{ data: SEGS.map(s => allSegs[s]), backgroundColor: SEGS.map(s => SEG_COLORS[s]), borderWidth: 1 }] };

  const allProds = {};
  raw.forEach(m => Object.entries(m.products||{}).forEach(([k,v]) => { allProds[k]=(allProds[k]||0)+v; }));
  const sortedProds = Object.entries(allProds).sort((a,b)=>b[1]-a[1]);
  const prodData = {
    labels: sortedProds.map(([k])=>k),
    datasets: [{ data: sortedProds.map(([,v])=>v), backgroundColor: sortedProds.map((_,i)=>PROD_COLORS[i%PROD_COLORS.length]), borderWidth: 1 }]
  };

  const funnelData = {
    labels: ['Enterprise','Mid-Market','SMB','N/F'],
    datasets: [
      { label: 'Leads', data: SEGS.map(s => filtered.reduce((sum,m)=>sum+(m.segFunnel[s]?.leads||0),0)), backgroundColor: '#b5d4f4', borderWidth: 0 },
      { label: 'Meetings', data: SEGS.map(s => filtered.reduce((sum,m)=>sum+(m.segFunnel[s]?.meetings||0),0)), backgroundColor: '#378add', borderWidth: 0 },
      { label: 'Deals/DM', data: SEGS.map(s => filtered.reduce((sum,m)=>sum+(m.segFunnel[s]?.deals||0),0)), backgroundColor: '#0c447c', borderWidth: 0 },
    ]
  };

  const baseOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };
  const allProdsForFilter = [...new Set(raw.flatMap(m => Object.keys(m.products||{})))].sort();

  return (
    <div className="dash">
      <div className="topbar">
        <div>
          <h1>Inbound Leads Dashboard</h1>
          <div className="live">
            <span className="dot" />
            Live &middot; HubSpot &middot; {fetchedAt ? `Updated ${new Date(fetchedAt).toLocaleTimeString()}` : 'Auto-refresh every 30 min'}
          </div>
        </div>
        <div className="controls">
          <div className="cg">
            <span className="lbl">Region</span>
            {['ALL','ROW','America'].map(r => (
              <button key={r} className={`tab${region===r?' on':''}`} onClick={() => setRegion(r)}>
                {r==='ALL'?'All':r==='America'?'Americas':r}
              </button>
            ))}
          </div>
          <div className="cg">
            <span className="lbl">Segment</span>
            <select value={seg} onChange={e => setSeg(e.target.value)}>
              <option value="ALL">All segments</option>
              {SEGS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="cg">
            <span className="lbl">Product</span>
            <select value={product} onChange={e => setProduct(e.target.value)}>
              <option value="ALL">All products</option>
              {allProdsForFilter.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="kpis">
        {[
          { label: 'Total leads', val: totals.total.toLocaleString(), sub: 'Last 16 months' },
          { label: 'Meetings set', val: totals.meetings.toLocaleString(), sub: `Lead\u2192Mtg ${pct(totals.meetings, totals.total)}` },
          { label: 'Deals / DM', val: totals.deals.toLocaleString(), sub: `Mtg\u2192DM ${pct(totals.deals, totals.meetings)}` },
          { label: 'ROW / Americas', val: `${totalROW.toLocaleString()} / ${totalAm.toLocaleString()}`, sub: `${pct(totalROW, totalROW+totalAm)} ROW` },
        ].map((k,i) => (
          <div key={i} className="kpi">
            <div className="kpi-l">{k.label}</div>
            <div className="kpi-v">{k.val}</div>
            <div className="kpi-s">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid">
        <div className="card full">
          <div className="ct">Monthly leads &mdash; ROW vs Americas</div>
          <div className="leg">
            <span><b style={{background:'#378add'}}/>ROW</span>
            <span><b style={{background:'#d85a30'}}/>Americas</span>
          </div>
          <div style={{height:200}}>
            <Line data={trendData} options={{...baseOpts, scales:{x:{ticks:{font:{size:10},maxRotation:45,autoSkip:false}},y:{ticks:{font:{size:11}}}}}}/>
          </div>
        </div>

        <div className="card">
          <div className="ct">Segment mix</div>
          <div className="leg">{SEGS.map(s=><span key={s}><b style={{background:SEG_COLORS[s]}}/>{s} {allSegs[s].toLocaleString()}</span>)}</div>
          <div style={{height:200}}>
            <Doughnut data={segData} options={{...baseOpts, plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.label}: ${c.raw.toLocaleString()} (${pct(c.raw,totals.total)})`}}}}}/>
          </div>
        </div>

        <div className="card">
          <div className="ct">Product breakdown</div>
          <div className="leg">{sortedProds.slice(0,5).map(([k],i)=><span key={k}><b style={{background:PROD_COLORS[i]}}/>{k}</span>)}</div>
          <div style={{height:200}}>
            <Doughnut data={prodData} options={{...baseOpts, plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.label}: ${c.raw.toLocaleString()}`}}}}}/>
          </div>
        </div>

        <div className="card full">
          <div className="ct">Funnel by segment &mdash; Leads &rarr; Meetings &rarr; Deals/DM</div>
          <div className="leg">
            <span><b style={{background:'#b5d4f4'}}/>Leads</span>
            <span><b style={{background:'#378add'}}/>Meetings</span>
            <span><b style={{background:'#0c447c'}}/>Deals/DM</span>
          </div>
          <div style={{height:200}}>
            <Bar data={funnelData} options={baseOpts}/>
          </div>
        </div>

        <div className="card full">
          <div className="ct">Month-over-month table</div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Month</th><th>Total</th><th>MoM</th>
                  <th>ROW</th><th>Americas</th>
                  <th>Enterprise</th><th>Mid-Market</th><th>SMB</th>
                  <th>Meetings</th><th>Lead&rarr;Mtg</th>
                  <th>Deals</th><th>Mtg&rarr;DM</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m,i) => {
                  const prev = i > 0 ? filtered[i-1].total : null;
                  const d = prev ? ((m.total-prev)/prev*100).toFixed(1) : null;
                  return (
                    <tr key={m.key}>
                      <td className="mc">{m.label}</td>
                      <td><strong>{m.total.toLocaleString()}</strong></td>
                      <td>{d===null?'—':<span className={parseFloat(d)>0?'up':parseFloat(d)<0?'dn':''}>{parseFloat(d)>0?'▲':parseFloat(d)<0?'▼':''}{Math.abs(d)}%</span>}</td>
                      <td>{m.ROW.toLocaleString()}</td>
                      <td>{m.America.toLocaleString()}</td>
                      <td>{(m.segments.Enterprise||0).toLocaleString()}</td>
                      <td>{(m.segments['Mid-Market']||0).toLocaleString()}</td>
                      <td>{(m.segments['Startup/SMB']||0).toLocaleString()}</td>
                      <td>{m.meetings.toLocaleString()}</td>
                      <td>{pct(m.meetings,m.total)}</td>
                      <td>{m.deals.toLocaleString()}</td>
                      <td>{pct(m.deals,m.meetings)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card full">
          <div className="ct">Conversion ratios by segment</div>
          <div className="tw">
            <table>
              <thead>
                <tr><th>Segment</th><th>Leads</th><th>Meetings</th><th>Lead&rarr;Mtg</th><th>Deals</th><th>Mtg&rarr;DM</th></tr>
              </thead>
              <tbody>
                {SEGS.map(s => {
                  const leads = filtered.reduce((sum,m)=>sum+(m.segFunnel[s]?.leads||0),0);
                  const mtgs = filtered.reduce((sum,m)=>sum+(m.segFunnel[s]?.meetings||0),0);
                  const dls = filtered.reduce((sum,m)=>sum+(m.segFunnel[s]?.deals||0),0);
                  return (
                    <tr key={s}>
                      <td><span className={`pill p-${s.replace('/','').replace(/ /g,'-').toLowerCase()}`}>{s}</span></td>
                      <td>{leads.toLocaleString()}</td>
                      <td>{mtgs.toLocaleString()}</td>
                      <td>{pct(mtgs,leads)}</td>
                      <td>{dls.toLocaleString()}</td>
                      <td>{pct(dls,mtgs)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style jsx>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;color:#1a1a1a}
        .dash{max-width:1280px;margin:0 auto;padding:24px}
        .topbar{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px}
        h1{font-size:20px;font-weight:600}
        .live{font-size:12px;color:#888;display:flex;align-items:center;gap:6px;margin-top:4px}
        .dot{width:7px;height:7px;border-radius:50%;background:#27ae60;display:inline-block}
        .controls{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
        .cg{display:flex;gap:4px;align-items:center}
        .lbl{font-size:11px;color:#888;margin-right:2px;white-space:nowrap}
        .tab{padding:5px 12px;border-radius:6px;border:1px solid #ddd;background:transparent;cursor:pointer;font-size:12px;color:#666}
        .tab.on{background:#1a1a1a;color:#fff;border-color:#1a1a1a;font-weight:500}
        select{font-size:12px;padding:5px 8px;border-radius:6px;border:1px solid #ddd;background:#fff;color:#1a1a1a;cursor:pointer}
        .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}
        .kpi{background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #eee;box-shadow:0 1px 3px rgba(0,0,0,.05)}
        .kpi-l{font-size:11px;color:#888;margin-bottom:6px}
        .kpi-v{font-size:22px;font-weight:600}
        .kpi-s{font-size:11px;color:#888;margin-top:3px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        .card{background:#fff;border:1px solid #eee;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.05)}
        .full{grid-column:1/-1}
        .ct{font-size:13px;font-weight:600;margin-bottom:10px}
        .leg{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:8px;font-size:11px;color:#666}
        .leg span{display:flex;align-items:center;gap:4px}
        .leg b{width:9px;height:9px;border-radius:2px;flex-shrink:0;display:inline-block}
        .tw{overflow-x:auto}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{font-size:11px;font-weight:600;color:#888;text-align:left;padding:6px 8px;border-bottom:1px solid #eee;white-space:nowrap}
        td{padding:7px 8px;border-bottom:1px solid #f5f5f5}
        tr:last-child td{border-bottom:none}
        tr:hover td{background:#fafafa}
        .mc{font-weight:500;white-space:nowrap}
        .up{color:#27ae60;font-size:11px}
        .dn{color:#e74c3c;font-size:11px}
        .pill{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:500}
        .p-enterprise{background:#e6f1fb;color:#0c447c}
        .p-mid-market{background:#eeedfe;color:#3c3489}
        .p-startupsmb{background:#eaf3de;color:#27500a}
        .p-not-found{background:#f1efe8;color:#5f5e5a}
        @media(max-width:768px){
          .kpis{grid-template-columns:1fr 1fr}
          .grid{grid-template-columns:1fr}
          .full{grid-column:1}
          .topbar,.controls{flex-direction:column;align-items:flex-start}
        }
      `}</style>
    </div>
  );
}
