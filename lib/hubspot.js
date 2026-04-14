const BASE = 'https://api.hubapi.com/crm/v3/objects/contacts/search';

function parseProduct(name) {
  if (!name) return 'Other';
  const n = name.toLowerCase();
  if (n.includes('port-congestion') || n.includes('port congestion') || n.includes('port dwell')) return 'Port Congestion';
  if (n.includes('sailing-schedule') || n.includes('sailing schedule')) return 'Sailing Schedule';
  if (n.includes('online-container-tracking') || n.includes('container-tracking') || n.includes('real-time-container') || n.includes('/tracking')) return 'Container Tracking';
  if (n.includes('freight-shipping-rates') || n.includes('gfi')) return 'Freight Rates / GFI';
  if (n.includes('freight-quotation')) return 'Freight Quotation';
  if (n.includes('vessel-tracking')) return 'Vessel Tracking';
  if (n.includes('online-cargo-tracking') || n.includes('cargo-tracking')) return 'Cargo Tracking';
  if (n.includes('contact-us') || n.startsWith('/contact')) return 'Contact Us / Generic';
  return 'Other';
}

async function fetchMonthRecords(apiKey, year, month) {
  // HubSpot search API requires Unix timestamps in milliseconds for date filters
  const start = String(Date.UTC(year, month - 1, 1));
  const end = String(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const props = [
    'inbound_lead_region',
    'account_qualification__data_enrichment_',
    'response_bucket__seo_inside_sales_',
    'num_associated_deals',
    'first_conversion_event_name'
  ];
  let all = [], after = undefined;
  while (true) {
    const body = {
      filterGroups: [{ filters: [
        { propertyName: 'contact_us_form_submission_date', operator: 'GTE', value: start },
        { propertyName: 'contact_us_form_submission_date', operator: 'LTE', value: end }
      ]}],
      properties: props,
      limit: 200
    };
    if (after) body.after = after;
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HubSpot error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    all = all.concat(data.results || []);
    if (data.paging?.next?.after) { after = data.paging.next.after; } else { break; }
  }
  return all;
}

function aggregateMonth(records) {
  const s = {
    total: records.length,
    ROW: 0, America: 0,
    segments: { Enterprise: 0, 'Mid-Market': 0, 'Startup/SMB': 0, 'Not Found': 0 },
    products: {},
    meetings: 0, deals: 0,
    segFunnel: {
      Enterprise:    { leads: 0, meetings: 0, deals: 0 },
      'Mid-Market':  { leads: 0, meetings: 0, deals: 0 },
      'Startup/SMB': { leads: 0, meetings: 0, deals: 0 },
      'Not Found':   { leads: 0, meetings: 0, deals: 0 }
    }
  };
  for (const r of records) {
    const p = r.properties;
    const region = p.inbound_lead_region;
    const seg = p.account_qualification__data_enrichment_ || 'Not Found';
    const isMeeting = p.response_bucket__seo_inside_sales_ === 'Meeting Set';
    const isDeal = parseInt(p.num_associated_deals || '0') >= 1;
    const product = parseProduct(p.first_conversion_event_name);
    if (region === 'ROW') s.ROW++;
    if (region === 'America') s.America++;
    s.segments[seg] = (s.segments[seg] || 0) + 1;
    s.products[product] = (s.products[product] || 0) + 1;
    if (isMeeting) s.meetings++;
    if (isDeal) s.deals++;
    const sf = s.segFunnel[seg] || s.segFunnel['Not Found'];
    sf.leads++;
    if (isMeeting) sf.meetings++;
    if (isDeal) sf.deals++;
  }
  return s;
}

export async function getDashboardData(apiKey) {
  const now = new Date();
  const months = [];
  for (let i = 15; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const results = await Promise.all(months.map(async ({ year, month }) => {
    const records = await fetchMonthRecords(apiKey, year, month);
    return {
      label: `${MONTH_NAMES[month-1]} ${String(year).slice(2)}`,
      key: `${year}-${String(month).padStart(2,'0')}`,
      ...aggregateMonth(records)
    };
  }));
  return results;
}
