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
const PRODUCTS = [
  'Container Tracking','Port Congestion','Sailing Schedule',
  'Freight Rates / GFI','Freight Quotation','Vessel Tracking',
  'Cargo Tracking','Contact Us / Generic','Other'
];

function pct(a, b) { return b ? (a / b * 100).toFixed(1) + '%' : '\u2014'; }

export default function Dashboard() {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);

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
      <p>Fetching live data from HubSpot\u2026</p>
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
      <p>Check that HUBSPOT_API_KEY is set in Vercel, then redeploy.</p>
      <style jsx>{`.err{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:12px;padding:24px;text-align:center;font-family:system-ui,sans-serif}h2{color:#e74c3c}`}</style>
    </div>
  );

  const totals   = raw.reduce((a, m) => ({ total: a.total+m.total, meetings: a.meetings+m.meetings, deals: a.deals+m.deals }), { total:0, meetings:0, deals:0 });
  const totalROW = raw.reduce((s, m) => s + m.ROW, 0);
  const totalAm  = raw.reduce((s, m) => s + m.America, 0);
  const labels   = raw.map(m => m.label);

  const trendData = {
    labels,
    datasets: [
      { label: 'ROW',      data: raw.map(m => m.ROW),     borderColor: '#378add', backgroundColor: 'rgba(55,138,221,0.08)', fill: true, tension: 0.35, pointRadius: 3, borderWidth: 2 },
      { label: 'Americas', data: raw.map(m => m.America), borderColor: '#d85a30', backgroundColor: 'rgba(216,90,48,0.08)',  fill: true, tension: 0.35, pointRadius: 3, borderWidth: 2, borderDash: [5,3] },
    ]
  };

  const allSegs = SEGS.reduce((a, s) => { a[s] = raw.reduce((sum, m) => sum + (m.segments[s]||0), 0); return a; }, {});
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
      { label: 'Leads',    data: SEGS.map(s => raw.reduce((sum,m)=>sum+(m.segFunnel[s]?.leads||0),0)),    backgroundColor: '#b5d4f4', borderWidth: 0 },
      { label: 'Meetings', data: SEGS.map(s => raw.reduce((sum,m)=>sum+(m.segFunnel[s]?.meetings||0),0)), backgroundColor: '#378add', borderWidth: 0 },
      { label: 'Deals/DM', data: SEGS.map(s => raw.reduce((sum,m)=>sum+(m.segFunnel[s]?.deals||0),0)),    backgroundColor: '#0c447c', borderWidth: 0 },
    ]
  };

  const baseOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };

  function segROW(m, seg) { return m.total > 0 ? Math.round(m.ROW     * ((m.segFunnel[seg]?.leads||0) / m.total)) : 0; }
  function segAm(m, seg)  { return m.total > 0 ? Math.round(m.America * ((m.segFunnel[seg]?.leads||0) / m.total)) : 0; }

  function MoMCell({ cur, prev }) {
    const d = prev !== null && prev !== undefined ? ((cur - prev) / (prev || 1) * 100).toFixed(1) : null;
    if (d === null) return '\u2014';
    const n = parseFloat(d);
    return <span className={n > 0 ? 'up' : n < 0 ? 'dn' : ''}>{n > 0 ? '\u25b2' : n < 0 ? '\u25bc' : ''}{Math.abs(d)}%</span>;
  }

  return (
    <div className="dash">
      <div className="topbar">
        <div>
          <h1>Inbound Leads Dashboard</h1>
          <div className="live">
            <span className="dot" />
            Live &middot; HubSpot &middot; {fetchedAt ? `Updated ${new Date(fetchedAt).toLocaleTimeString()}` : 'Cached 1 hr'}
          </div>
        </div>
      </div>

      <div className="kpis">
        {[
          { label: 'Total leads',    val: totals.total.toLocaleString(),    sub: 'Last 16 months' },
          { label: 'Meetings set',   val: totals.meetings.toLocaleString(), sub: `Lead\u2192Mtg ${pct(totals.meetings, totals.total)}` },
          { label: 'Deals / DM',     val: totals.deals.toLocaleString(),    sub: `Mtg\u2192DM ${pct(totals.deals, totals.meetings)}` },
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
          <div className="ct">Funnel by segment &mdash; Leads \u2192 Meetings \u2192 Deals/DM</div>
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
          <div className="ct tbl-head">Overall &mdash; Month over Month</div>
          <div className="tw"><table>
            <thead><tr>
              <th>Month</th><th>Total</th><th>MoM</th>
              <th>ROW</th><th>Americas</th>
              <th>Enterprise</th><th>Mid-Market</th><th>SMB</th><th>Not Found</th>
              <th>Meetings</th><th>Lead\u2192Mtg%</th>
              <th>Deals</th><th>Mtg\u2192DM%</th>
            </tr></thead>
            <tbody>{raw.map((m,i) => (
              <tr key={m.key}>
                <td className="mc">{m.label}</td>
                <td><strong>{m.total.toLocaleString()}</strong></td>
                <td><MoMCell cur={m.total} prev={i>0?raw[i-1].total:null}/></td>
                <td>{m.ROW.toLocaleString()}</td>
                <td>{m.America.toLocaleString()}</td>
                <td>{(m.segments.Enterprise||0).toLocaleString()}</td>
                <td>{(m.segments['Mid-Market']||0).toLocaleString()}</td>
                <td>{(m.segments['Startup/SMB']||0).toLocaleString()}</td>
                <td>{(m.segments['Not Found']||0).toLocaleString()}</td>
                <td>{m.meetings.toLocaleString()}</td>
                <td>{pct(m.meetings,m.total)}</td>
                <td>{m.deals.toLocaleString()}</td>
                <td>{pct(m.deals,m.meetings)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>

        <div className="card full">
          <div className="ct tbl-head">Enterprise &mdash; Month over Month</div>
          <div className="tw"><table>
            <thead><tr>
              <th>Month</th><th>Leads</th><th>MoM</th>
              <th>ROW</th><th>Americas</th>
              <th>Meetings</th><th>Lead\u2192Mtg%</th>
              <th>Deals</th><th>Mtg\u2192DM%</th>
            </tr></thead>
            <tbody>{raw.map((m,i) => {
              const sf = m.segFunnel['Enterprise'] || {};
              const leads = sf.leads || 0;
              return (<tr key={m.key}>
                <td className="mc">{m.label}</td>
                <td><strong>{leads.toLocaleString()}</strong></td>
                <td><MoMCell cur={leads} prev={i>0?(raw[i-1].segFunnel['Enterprise']?.leads||0):null}/></td>
                <td>{segROW(m,'Enterprise').toLocaleString()}</td>
                <td>{segAm(m,'Enterprise').toLocaleString()}</td>
                <td>{(sf.meetings||0).toLocaleString()}</td>
                <td>{pct(sf.meetings||0,leads)}</td>
                <td>{(sf.deals||0).toLocaleString()}</td>
                <td>{pct(sf.deals||0,sf.meetings||0)}</td>
              </tr>);
            })}</tbody>
          </table></div>
        </div>

        <div className="card full">
          <div className="ct tbl-head">Mid-Market &mdash; Month over Month</div>
          <div className="tw"><table>
            <thead><tr>
              <th>Month</th><th>Leads</th><th>MoM</th>
              <th>ROW</th><th>Americas</th>
              <th>Meetings</th><th>Lead\u2192Mtg%</th>
              <th>Deals</th><th>Mtg\u2192DM%</th>
            </tr></thead>
            <tbody>{raw.map((m,i) => {
              const sf = m.segFunnel['Mid-Market'] || {};
              const leads = sf.leads || 0;
              return (<tr key={m.key}>
                <td className="mc">{m.label}</td>
                <td><strong>{leads.toLocaleString()}</strong></td>
                <td><MoMCell cur={leads} prev={i>0?(raw[i-1].segFunnel['Mid-Market']?.leads||0):null}/></td>
                <td>{segROW(m,'Mid-Market').toLocaleString()}</td>
                <td>{segAm(m,'Mid-Market').toLocaleString()}</td>
                <td>{(sf.meetings||0).toLocaleString()}</td>
                <td>{pct(sf.meetings||0,leads)}</td>
                <td>{(sf.deals||0).toLocaleString()}</td>
                <td>{pct(sf.deals||0,sf.meetings||0)}</td>
              </tr>);
            })}</tbody>
          </table></div>
        </div>

        <div className="card full">
          <div className="ct tbl-head">Startup / SMB &mdash; Month over Month</div>
          <div className="tw"><table>
            <thead><tr>
              <th>Month</th><th>Leads</th><th>MoM</th>
              <th>ROW</th><th>Americas</th>
              <th>Meetings</th><th>Lead\u2192Mtg%</th>
              <th>Deals</th><th>Mtg\u2192DM%</th>
            </tr></thead>
            <tbody>{raw.map((m,i) => {
              const sf = m.segFunnel['Startup/SMB'] || {};
              const leads = sf.leads || 0;
              return (<tr key={m.key}>
                <td className="mc">{m.label}</td>
                <td><strong>{leads.toLocaleString()}</strong></td>
                <td><MoMCell cur={leads} prev={i>0?(raw[i-1].segFunnel['Startup/SMB']?.leads||0):null}/></td>
                <td>{segROW(m,'Startup/SMB').toLocaleString()}</td>
                <td>{segAm(m,'Startup/SMB').toLocaleString()}</td>
                <td>{(sf.meetings||0).toLocaleString()}</td>
                <td>{pct(sf.meetings||0,leads)}</td>
                <td>{(sf.deals||0).toLocaleString()}</td>
                <td>{pct(sf.deals||0,sf.meetings||0)}</td>
              </tr>);
            })}</tbody>
          </table></div>
        </div>

        <div className="card full">
          <div className="ct tbl-head">Product &mdash; Month over Month</div>
          <div className="tw"><table>
            <thead><tr>
              <th>Month</th>
              {PRODUCTS.map(p => <th key={p}>{p}</th>)}
            </tr></thead>
            <tbody>{raw.map(m => (
              <tr key={m.key}>
                <td className="mc">{m.label}</td>
                {PRODUCTS.map(p => <td key={p}>{(m.products[p]||0).toLocaleString()}</td>)}
              </tr>
            ))}</tbody>
          </table></div>
        </div>

        <div className="card full">
          <div className="ct tbl-head">Conversion ratios by segment</div>
          <div className="tw"><table>
            <thead><tr><th>Segment</th><th>Leads</th><th>Meetings</th><th>Lead\u2192Mtg</th><th>Deals</th><th>Mtg\u2192DM</th></tr></thead>
            <tbody>{SEGS.map(s => {
              const leads = raw.reduce((sum,m)=>sum+(m.segFunnel[s]?.leads||0),0);
              const mtgs  = raw.reduce((sum,m)=>sum+(m.segFunnel[s]?.meetings||0),0);
              const dls   = raw.reduce((sum,m)=>sum+(m.segFunnel[s]?.deals||0),0);
              return (<tr key={s}>
                <td><span className={`pill p-${s.replace('/','').replace(/ /g,'-').toLowerCase()}`}>{s}</span></td>
                <td>{leads.toLocaleString()}</td>
                <td>{mtgs.toLocaleString()}</td>
                <td>{pct(mtgs,leads)}</td>
                <td>{dls.toLocaleString()}</td>
                <td>{pct(dls,mtgs)}</td>
              </tr>);
            })}</tbody>
          </table></div>
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
        .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}
        .kpi{background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #eee;box-shadow:0 1px 3px rgba(0,0,0,.05)}
        .kpi-l{font-size:11px;color:#888;margin-bottom:6px}
        .kpi-v{font-size:22px;font-weight:600}
        .kpi-s{font-size:11px;color:#888;margin-top:3px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        .card{background:#fff;border:1px solid #eee;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.05)}
        .full{grid-column:1/-1}
        .ct{font-size:13px;font-weight:600;margin-bottom:10px}
        .tbl-head{font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #f0f0f0}
        .leg{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:8px;font-size:11px;color:#666}
        .leg span{display:flex;align-items:center;gap:4px}
        .leg b{width:9px;height:9px;border-radius:2px;flex-shrink:0;display:inline-block}
        .tw{overflow-x:auto}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{font-size:11px;font-weight:600;color:#888;text-align:left;padding:6px 8px;border-bottom:1px solid #eee;white-space:nowrap}
        td{padding:7px 8px;border-bottom:1px solid #f5f5f5;white-space:nowrap}
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
          .topbar{flex-direction:column;align-items:flex-start}
        }
      `}</style>
    </div>
  );
}
