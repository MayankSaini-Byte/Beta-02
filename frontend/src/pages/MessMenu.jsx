import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { useApp } from '../context/AppContext.jsx';

const WEEK_MENU = [
  {
    day: 'Monday',
    breakfast: ['Paratha', 'Aloo ki sabzi', 'Bread and jam', 'Milk', 'Chai', 'Sprouts'],
    breakfastEggOption: true,
    lunch: ['Chana masala', 'Chaach', 'Dal', 'Rice', 'Roti', 'Salad'],
    snacks: ['Poha', 'Nimbu chai'],
    dinner: ['Chole bhature', 'Imli-meethi chutney', 'Rice']
  },
  {
    day: 'Tuesday',
    breakfast: ['Soft idli', 'Sambar', 'Coconut chutney', 'Milk', 'Chai', 'Sprouts', '2 bananas'],
    lunch: ['Aaloo matar tamatar', 'Dahi', 'Dal', 'Rice', 'Roti', 'Salad'],
    snacks: ['Aaloo chana pyaz', 'Chutney', 'Chai', 'Coffee'],
    dinner: ['Sev tamatar / methi malai tamatar', 'Dal', 'Rice', 'Roti', 'Salad', 'Gulab jamun']
  },
  {
    day: 'Wednesday',
    breakfast: ['Methi paratha', 'Chutney', 'Aachar', 'Bread and jam', 'Milk', 'Chai', 'Sprouts'],
    breakfastEggOption: true,
    lunch: ['Dum aloo', 'Chaach', 'Dal', 'Rice', 'Roti', 'Salad'],
    snacks: ['Fried idly', 'Tea', 'Coffee'],
    dinner: ['Matar paneer', 'Rice', 'Roti', 'Salad'],
    nonVegDinner: ['Egg curry / egg biryani']
  },
  {
    day: 'Thursday',
    breakfast: ['Uttapam', 'Sambar', 'Chutney', 'Milk', 'Chai', 'Sprouts'],
    breakfastEggOption: true,
    lunch: ['Rajma', 'Raita', 'Dal', 'Rice', 'Roti', 'Salad'],
    snacks: ['Vada pav', 'Chai'],
    dinner: ['Chole', 'Dal', 'Rice', 'Roti', 'Salad']
  },
  {
    day: 'Friday',
    breakfast: ['Poha', 'Jalebi', 'Sev', 'Lemon', 'Bread and jam', 'Milk', 'Chai', 'Sprouts'],
    breakfastEggOption: true,
    lunch: ['Curry pakoda', 'Aloo sabzi', 'Dal', 'Rice', 'Roti', 'Salad'],
    snacks: ['Samosa / mixed pakoda', 'Chutney', 'Chai', 'Coffee'],
    dinner: ['Soya chunks sabzi', 'Dal', 'Rice', 'Roti', 'Salad', 'Custard']
  },
  {
    day: 'Saturday',
    breakfast: ['Aloo paratha', 'Dahi', 'Milk', 'Chai', 'Sprouts', '2 bananas'],
    lunch: ['Dal waffle', 'Ice cream', 'Dal', 'Rice', 'Salad'],
    snacks: ['Biscuit / namkeen', 'Chai', 'Coffee'],
    dinner: ['Dal-rice', 'Veg biryani', 'Raita']
  },
  {
    day: 'Sunday',
    breakfast: ['Masala dosa', 'Sambar', 'Chutney', 'Bread and jam', 'Milk', 'Chai', 'Sprouts'],
    breakfastEggOption: true,
    lunch: ['Malai kofta', 'Raita', 'Dal', 'Rice', 'Roti', 'Salad'],
    snacks: ['Bhel', 'Boiled potato', 'Chutney', 'Chai'],
    dinner: ['Paalak paneer', 'Rice', 'Roti', 'Salad'],
    nonVegDinner: ['Chicken']
  }
];

const MEALS = [
  { key: 'breakfast', name: 'Breakfast', time: '7:30–9:00 AM · weekdays / 8:30–10:00 AM · weekends', icon: 'sun' },
  { key: 'lunch', name: 'Lunch', time: '12:30–2:30 PM', icon: 'planner' },
  { key: 'snacks', name: 'Snacks', time: '5:00–6:30 PM', icon: 'flame' },
  { key: 'dinner', name: 'Dinner', time: '8:00–9:30 PM', icon: 'moon' }
];

export default function MessMenu() {
  const { user } = useApp();
  const preferenceKey = `ks-mess-type:${user?._id || user?.name || 'service'}`;
  const [messType, setMessType] = useState(() => {
    try { return localStorage.getItem(preferenceKey) === 'nonveg' ? 'nonveg' : 'veg'; }
    catch { return 'veg'; }
  });
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  const changeMess = (type) => {
    setMessType(type);
    try { localStorage.setItem(preferenceKey, type); } catch { /* menu selection is still usable for this visit */ }
  };

  const itemsFor = (day, meal) => {
    const items = [...day[meal.key]];
    if (meal.key === 'breakfast' && day.breakfastEggOption) {
      if (messType === 'nonveg') items.push('2 bananas OR 2 eggs');
      else items.push('2 bananas');
    }
    if (meal.key === 'dinner' && messType === 'nonveg' && day.nonVegDinner) items.push(...day.nonVegDinner);
    return items;
  };

  return (
    <main className="mess-menu-page">
      <header className="mess-menu-heading">
        <div>
          <span className="eyebrow">A.P.J. ABDUL KALAM BHAWAN · H10-A / H10-B</span>
          <h1>Mess Menu</h1>
          <p>Your weekly menu, organized by day and meal time.</p>
        </div>
        <div className="mess-type-switch" role="group" aria-label="Choose mess menu">
          <button type="button" className={messType === 'veg' ? 'active' : ''} aria-pressed={messType === 'veg'} onClick={() => changeMess('veg')}>
            <span className="mess-type-dot veg" /> Mess 10A <small>Vegetarian</small>
          </button>
          <button type="button" className={messType === 'nonveg' ? 'active' : ''} aria-pressed={messType === 'nonveg'} onClick={() => changeMess('nonveg')}>
            <span className="mess-type-dot nonveg" /> Mess 10B <small>Non-vegetarian</small>
          </button>
        </div>
      </header>

      <section className="mess-menu-notices" aria-label="Mess rules">
        <div className="mess-menu-notice card">
          <span className="mess-notice-icon"><Icon name="receipt" /></span>
          <div><b>Bring your physical mess card</b><p>Photos of the mess card are not accepted.</p></div>
        </div>
        <div className="mess-menu-notice card egg-rule">
          <span className="mess-notice-icon"><Icon name="alert" /></span>
          <div><b>Choose two eggs or two bananas</b><p>You may take one option only—never both.</p></div>
        </div>
      </section>

      <div className="mess-menu-hours card">
        <span className="mess-hours-title"><Icon name="clock" /> Serving hours</span>
        {MEALS.map((meal) => <span key={meal.key}><b>{meal.name}</b><small>{meal.time}</small></span>)}
      </div>

      <section className="mess-week-grid" aria-label={`${messType === 'veg' ? 'Vegetarian' : 'Non-vegetarian'} weekly menu`}>
        {WEEK_MENU.map((day) => (
          <article className={`mess-day-card card ${today === day.day ? 'is-today' : ''}`} key={day.day}>
            <header className="mess-day-heading">
              <h2>{day.day}</h2>
              {today === day.day && <span className="mess-today-badge">TODAY</span>}
              <span className="mess-day-mess">{messType === 'veg' ? '10A · Veg' : '10B · Non-Veg'}</span>
            </header>
            <div className="mess-meal-list">
              {MEALS.map((meal) => (
                <section className="mess-meal" key={meal.key}>
                  <div className="mess-meal-label"><Icon name={meal.icon} size={14} /><span>{meal.name}</span><small>{meal.key === 'breakfast' && ['Saturday', 'Sunday'].includes(day.day) ? '8:30–10:00 AM' : meal.key === 'breakfast' ? '7:30–9:00 AM' : meal.time}</small></div>
                  <ul>{itemsFor(day, meal).map((item, index) => <li key={`${day.day}-${meal.key}-${index}`}>{item}</li>)}</ul>
                </section>
              ))}
            </div>
          </article>
        ))}
      </section>
      <p className="mess-menu-footnote">Menu shown for the selected mess. Weekly items are displayed as provided by A.P.J. Abdul Kalam Bhawan.</p>
    </main>
  );
}
