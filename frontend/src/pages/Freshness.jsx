import { useState } from 'react';
import FreshnessIndex from '../components/FreshnessIndex.jsx';

export default function Freshness() {
  const [category, setCategory] = useState('produce');
  return <div className="freshness-page">
    <header className="freshness-page-heading"><div><span className="eyebrow">FRESHNESS INDEX</span><h1>Know what to use next.</h1><p>Freshness estimates use your saved purchase dates, shelf life and storage details.</p></div></header>
    <div className="freshness-tabs" role="tablist" aria-label="Freshness category">
      <button type="button" role="tab" id="freshness-tab-produce" aria-selected={category === 'produce'} aria-controls="freshness-panel" className={category === 'produce' ? 'active produce-tab' : 'produce-tab'} onClick={() => setCategory('produce')}><span aria-hidden="true">🌿</span><span><b>Vegetables & fruits</b><small>Leafy, roots and seasonal produce</small></span></button>
      <button type="button" role="tab" id="freshness-tab-dairy" aria-selected={category === 'dairy'} aria-controls="freshness-panel" className={category === 'dairy' ? 'active dairy-tab' : 'dairy-tab'} onClick={() => setCategory('dairy')}><span aria-hidden="true">🥛</span><span><b>Dairy products</b><small>Opened state and cold-chain aware</small></span></button>
    </div>
    <div id="freshness-panel" role="tabpanel" aria-labelledby={category === 'produce' ? 'freshness-tab-produce' : 'freshness-tab-dairy'} key={category}>
      <FreshnessIndex category={category} />
    </div>
  </div>;
}
