import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import Icon from '../components/Icon.jsx';

const moneyMinor = (amount, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount || 0) / 100);
const observedLabel = (value) => {
  if (!value) return 'Price and stock not recently checked';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Price and stock not recently checked' : `Checked ${parsed.toLocaleString()}`;
};
const categoryLabel = (value) => String(value || 'Other').replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const itemId = (item) => `${item.key || item.name.trim().toLowerCase()}::${item.unit}`;
const categoryMark = (value) => ({
  dairy: '◌', vegetables: '✿', vegetable: '✿', fruits: '◉', fruit: '◉', grains: '▦',
  pulses: '◈', bakery: '⌂', meat: '◇', pantry: '▧', other: '＋'
})[String(value || '').trim().toLowerCase()] || '◦';

function shoppingItems(data) {
  const rows = [
    ...(data?.saved || []).filter((item) => !item.boughtAt).map((item) => ({ ...item, qty: Number(item.toBuy || item.qty), sourceLabel: 'Shopping list' })),
    ...(data?.planNeeds || []).filter((item) => !item.inList).map((item) => ({ ...item, qty: Number(item.toBuy), sourceLabel: 'Meal plan' }))
  ].filter((item) => item.name && Number.isFinite(item.qty) && item.qty > 0 && item.unit);

  const merged = new Map();
  for (const item of rows) {
    const key = item.key || item.name.trim().toLowerCase();
    const previous = merged.get(key);
    if (!previous || item.qty > previous.qty) merged.set(key, item);
  }
  return [...merged.values()].map(({ name, key, qty, unit, sourceLabel, category }) => ({ name, key, qty, unit, sourceLabel, category: category || 'other' }));
}

function resultPrice(result, item) {
  const row = (result?.items || []).find((candidate) => candidate.name.trim().toLowerCase() === item.name.trim().toLowerCase() && candidate.unit === item.unit);
  const prices = [row?.cheapest?.lineTotalMinor, ...(row?.offers || []).filter((offer) => offer.comparable && offer.stock !== false).map((offer) => offer.lineTotalMinor)]
    .filter((price) => price !== null && price !== undefined && Number.isFinite(Number(price))).map(Number);
  return prices.length ? Math.min(...prices) : null;
}

function retailerPurchaseLink(offer) {
  const candidates = [offer.url, offer.sourceUrl, offer.source_url, offer.productUrl, offer.product_url, offer.deepLink, offer.deep_link, offer.latest?.sourceUrl, offer.latest?.source_url];
  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const url = new URL(String(raw).trim());
      if (url.protocol === 'https:' && !url.username && !url.password) return { href: url.href, direct: true };
    } catch { /* Use the retailer's own search URL if the API URL is malformed. */ }
  }

  // Rewalto's matched title and pack size identify the actual offer shown on this card.
  const query = encodeURIComponent(`${offer.title || ''} ${offer.packSize || ''}`.trim());
  const key = String(offer.retailer || '').toLowerCase().replaceAll('_', ' ');
  const destinations = [
    { match: /blinkit/, host: 'Blinkit', href: `https://blinkit.com/s/?q=${query}` },
    { match: /zepto/, host: 'Zepto', href: `https://www.zeptonow.com/search?query=${query}` },
    { match: /instamart|swiggy/, host: 'Instamart', href: `https://www.swiggy.com/instamart/search?query=${query}` },
    { match: /bigbasket/, host: 'BigBasket', href: `https://www.bigbasket.com/ps/?q=${query}` },
    { match: /jiomart|jio mart/, host: 'JioMart', href: `https://www.jiomart.com/search/${query}` },
    { match: /amazon/, host: 'Amazon', href: `https://www.amazon.in/s?k=${query}` }
  ];
  const destination = destinations.find((entry) => entry.match.test(key));
  return destination ? { href: destination.href, direct: false, host: destination.host } : null;
}
function storeName(retailer) {
  return String(retailer || 'Store').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function PriceCompare() {
  const { toast, user } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [configured, setConfigured] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [compareError, setCompareError] = useState('');
  const pincode = String(user?.household?.pincode || '').trim();
  const validPincode = /^[1-9]\d{5}$/.test(pincode);
  const [selectedIds, setSelectedIds] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('recommended');
  const [showAll, setShowAll] = useState(false);

  const items = useMemo(() => shoppingItems(list), [list]);
  const selectedItems = useMemo(() => selectedIds === null ? [] : items.filter((item) => selectedIds.includes(itemId(item))), [items, selectedIds]);
  const categories = useMemo(() => [...new Set(items.map((item) => categoryLabel(item.category)))].sort((a, b) => a.localeCompare(b)), [items]);
  const filteredItems = useMemo(() => {
    const search = query.trim().toLowerCase();
    const matches = items.filter((item) => (category === 'all' || categoryLabel(item.category) === category)
      && (!search || `${item.name} ${item.category} ${item.sourceLabel}`.toLowerCase().includes(search)));
    if (sort === 'recommended') return matches;
    return [...matches].sort((a, b) => {
      const aPrice = resultPrice(result, a);
      const bPrice = resultPrice(result, b);
      if (aPrice === null && bPrice !== null) return 1;
      if (bPrice === null && aPrice !== null) return -1;
      if (aPrice !== null && bPrice !== null && aPrice !== bPrice) return sort === 'low' ? aPrice - bPrice : bPrice - aPrice;
      return a.name.localeCompare(b.name);
    });
  }, [items, query, category, sort, result]);
  const visibleItems = showAll ? filteredItems : filteredItems.slice(0, 4);
  const displayedResults = useMemo(() => {
    const rows = [...(result?.items || [])];
    if (sort === 'recommended') return rows;
    return rows.sort((a, b) => {
      const aPrice = a.cheapest?.lineTotalMinor;
      const bPrice = b.cheapest?.lineTotalMinor;
      if (aPrice == null && bPrice != null) return 1;
      if (bPrice == null && aPrice != null) return -1;
      if (aPrice != null && bPrice != null && aPrice !== bPrice) return sort === 'low' ? aPrice - bPrice : bPrice - aPrice;
      return a.name.localeCompare(b.name);
    });
  }, [result, sort]);

  const load = async () => {
    setLoadError('');
    try {
      const [listResponse, statusResponse] = await Promise.all([
        api.get('/shopping/list'),
        api.get('/shopping/live-compare/status')
      ]);
      setList(listResponse.data);
      setConfigured(Boolean(statusResponse.data.configured));
      const available = shoppingItems(listResponse.data);
      const requestedKey = new URLSearchParams(location.search).get('item')?.trim().toLowerCase();
      const requestedMatches = requestedKey ? available.filter((item) => String(item.key || item.name).trim().toLowerCase() === requestedKey || item.name.trim().toLowerCase() === requestedKey).map(itemId) : [];
      setSelectedIds((current) => current === null ? requestedMatches : current.filter((id) => available.some((item) => itemId(item) === id)));
    } catch (error) {
      setLoadError(errMsg(error));
    }
  };

  useEffect(() => { load(); }, []);

  const compare = async (forceRefresh = false) => {
    if (!selectedItems.length) return toast('Select at least one item to compare.', 'warn');
    if (!validPincode) {
      toast('Add a delivery PIN under Profile → About you to compare nearby offers.', 'warn');
      navigate('/profile');
      return;
    }
    const action = forceRefresh ? 'Refresh live store listings' : 'Search live store listings';
    const approved = window.confirm(`${action} for ${selectedItems.length} selected item${selectedItems.length === 1 ? '' : 's'}? Rewalto may charge up to one credit per item. Cached results may be free.`);
    if (!approved) return;
    setBusy(!forceRefresh);
    setRefreshing(forceRefresh);
    setCompareError('');
    setResult(null);
    try {
      const { data } = await api.post('/shopping/live-compare', {
        pincode,
        forceRefresh,
        items: selectedItems.map(({ name, qty, unit }) => ({ name, qty, unit }))
      });
      if (!Array.isArray(data.items)) throw new Error('The price service returned an unreadable response. Please try again.');
      setResult(data);
    } catch (error) {
      setCompareError(errMsg(error));
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  };

  const toggleItem = (item) => {
    const id = itemId(item);
    setSelectedIds((current) => {
      const selected = new Set(current || []);
      if (selected.has(id)) selected.delete(id);
      else {
        if (selected.size >= 20) {
          toast('You can compare up to 20 items at a time.', 'warn');
          return [...selected];
        }
        selected.add(id);
      }
      return [...selected];
    });
    setResult(null);
  };

  if (!list && !loadError) return <div className="skeleton" style={{ height: 320 }} />;

  return (
    <div className="store-offers-page">
      <header className="store-offers-header">
        <div><h2>Store Offers</h2><p>Find the best prices for your shopping list.</p></div>
      </header>

      <section className="store-offers-card" aria-label="Compare shopping list prices">
        <div className="store-offers-toolbar">
          <label className="store-offers-search"><Icon name="search" size={18} /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setShowAll(false); }} placeholder="Search products across stores..." aria-label="Search products across stores" /></label>
          <label className="store-offers-filter"><select value={category} onChange={(event) => { setCategory(event.target.value); setShowAll(false); }} aria-label="Filter products by category"><option value="all">All categories</option>{categories.map((itemCategory) => <option value={itemCategory} key={itemCategory}>{itemCategory}</option>)}</select></label>
          <label className="store-offers-filter"><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products by price"><option value="recommended">Sort: Recommended</option><option value="low">Price: Low to High</option><option value="high">Price: High to Low</option></select></label>
        </div>

        {loadError && <div className="store-offers-message error" role="alert"><b>Could not load your shopping list.</b><span>{loadError}</span><button className="btn btn-sm" onClick={load}>Try again</button></div>}
        {configured === false && <div className="store-offers-message error" role="alert"><b>Live comparison is not configured.</b><span>Add <code>MULTISTOREAPI</code> to <code>backend/.env</code> and restart KitchenSync.</span></div>}
        {configured === null && !loadError && <div className="tiny muted store-offers-service-status">Checking live store availability…</div>}

        <div className="store-offers-list-heading"><span>{filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} available from your list</span><b>{selectedItems.length} selected</b></div>
        <div className="store-offers-product-grid">
          {visibleItems.map((item) => {
            const checked = selectedItems.some((selected) => itemId(selected) === itemId(item));
            const itemCategory = categoryLabel(item.category);
            return <label key={itemId(item)} className={`store-offer-product ${checked ? 'selected' : ''}`}>
              <input type="checkbox" checked={checked} onChange={() => toggleItem(item)} aria-label={`Select ${item.name} for price comparison`} />
              <span className="store-offer-category-mark" aria-hidden="true">{categoryMark(item.category)}</span>
              <span className="store-offer-product-copy"><b>{item.name}</b><small>{itemCategory} · {item.sourceLabel}</small></span>
              <span className="store-offer-quantity">{item.qty} {item.unit}</span>
            </label>;
          })}
          {!visibleItems.length && <div className="store-offers-empty"><b>{items.length ? 'No products match your search.' : 'Your shopping list is empty.'}</b><span>{items.length ? 'Try another product name or category.' : 'Add items in Shopping and they’ll appear here.'}</span>{!items.length && <Link className="btn btn-sm" to="/shopping">Open shopping list</Link>}</div>}
        </div>
        {filteredItems.length > 4 && <button className="store-offers-expand" type="button" onClick={() => setShowAll((value) => !value)} aria-expanded={showAll}>{showAll ? 'Show fewer items' : `Show all items (${filteredItems.length})`}</button>}

        <div className="store-offers-action">
          <span>{selectedItems.length ? `${selectedItems.length} selected for comparison` : 'Select products to compare store prices.'}</span>
          <button className="btn btn-primary" onClick={() => compare(false)} disabled={busy || refreshing || !selectedItems.length || configured !== true} aria-busy={busy || refreshing}>
            <Icon name={busy || refreshing ? 'refresh' : 'search'} /> {busy ? 'Comparing selected items…' : refreshing ? 'Refreshing offers…' : 'Compare Selected Items'} <span className="store-offers-count">{selectedItems.length}</span>
          </button>
        </div>

        {compareError && <div className="store-offers-message error" role="alert"><b>Price comparison issue</b><span>{compareError}</span><button className="btn btn-sm" onClick={() => setCompareError('')}>Dismiss</button></div>}

        {result && <section className="store-offers-results" aria-live="polite">
          <header className="store-offers-results-heading"><div><h3>Price comparison</h3><p>{result.items.length} {result.items.length === 1 ? 'item' : 'items'} checked · {result.cachedItems} cached · {result.creditsCharged} credit(s) charged</p></div><button className="btn btn-sm" onClick={() => compare(true)} disabled={busy || refreshing}><Icon name="refresh" /> {refreshing ? 'Refreshing…' : 'Refresh offers'}</button></header>
          {result.cheapestBasketMinor !== null ? <div className="store-offers-basket"><div><small>Cheapest mix of stores</small><b>{moneyMinor(result.cheapestBasketMinor)}</b></div>{result.bestSingleStore && <div><small>Best single store · {storeName(result.bestSingleStore.retailer)}</small><b>{moneyMinor(result.bestSingleStore.totalMinor)}</b></div>}</div> : <p className="store-offers-basket-note">A full basket total needs a compatible offer for every selected item.</p>}
          <div className="store-offers-result-list">
            {displayedResults.map((item, index) => <article className="store-offers-result-item" key={`${item.name}-${item.unit}-${index}`}>
              <header><div><h4>{item.name}</h4><span>Need {item.qty} {item.unit}</span></div>{item.cheapest && <b className="store-offers-lowest">Lowest compatible · {moneyMinor(item.cheapest.lineTotalMinor, item.cheapest.currency)}</b>}</header>
              {item.error ? <p className="store-offers-result-empty" role="alert">Couldn’t check this item: {item.error}</p> : !item.offers?.length ? <p className="store-offers-result-empty">No matching offers were found for your saved delivery area.</p> : <div className="store-offer-retailers">
                {item.offers.map((offer, offerIndex) => {
                  const cheapest = item.cheapest && offer.retailer === item.cheapest.retailer && offer.title === item.cheapest.title && offer.lineTotalMinor === item.cheapest.lineTotalMinor;
                  return <div className="store-offer-retailer" key={`${offer.retailer}-${offer.title}-${offerIndex}`}>
                    <div className="store-offer-retailer-top"><b>{storeName(offer.retailer)}{cheapest ? ' · Best match' : ''}</b><span className={`store-offer-stock ${offer.stock === true ? 'in' : offer.stock === false ? 'out' : 'unknown'}`}>{offer.stock === true ? 'In stock' : offer.stock === false ? 'Out of stock' : 'Availability unknown'}</span></div>
                    <strong>{offer.priceMinor == null ? 'No recent price' : moneyMinor(offer.priceMinor, offer.currency)}</strong>
                    <span>{offer.title}{offer.packSize ? ` · ${offer.packSize}` : ''}</span>
                    {offer.unitPriceMinor != null && offer.comparable && <small>{moneyMinor(offer.unitPriceMinor, offer.currency)} / {offer.pack?.kind === 'mass' ? 'kg' : offer.pack?.kind === 'volume' ? 'L' : 'piece'}</small>}
                    {offer.packsNeeded && offer.comparable && <small>{offer.packsNeeded} pack(s) · estimated {moneyMinor(offer.lineTotalMinor, offer.currency)} for {item.qty} {item.unit}</small>}
                    {!offer.comparable && <small>Pack size or product match could not be confirmed for a basket total.</small>}
                    <small className="store-offer-observed">{observedLabel(offer.observedAt)}</small>
                    {(() => { const purchase = retailerPurchaseLink(offer); return purchase ? <a className="store-offer-buy-link" href={purchase.href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{offer.stock === false ? 'Check availability' : purchase.direct ? 'Buy this exact item' : `Open ${purchase.host} listing`}<Icon name="external" size={14} /></a> : <span className="store-offer-buy-unavailable">No purchase link for this retailer</span>; })()}
                  </div>;
                })}
              </div>}
            </article>)}
          </div>
        </section>}
      </section>
    </div>
  );
}
