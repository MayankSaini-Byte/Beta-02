import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { useApp } from '../context/AppContext.jsx';
import api, { errMsg } from '../api/client.js';

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
  const { user, toast } = useApp();
  const [poll, setPoll] = useState(null);
  const [canEditPoll, setCanEditPoll] = useState(false);
  const [pollLoading, setPollLoading] = useState(true);
  const [pollBusy, setPollBusy] = useState(false);
  const [pollEditorOpen, setPollEditorOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState([]);
  const [pollClosed, setPollClosed] = useState(false);
  const [pollChoice, setPollChoice] = useState('');
  const preferenceKey = `ks-mess-type:${user?._id || user?.name || 'service'}`;
  const [messType, setMessType] = useState(() => {
    try { return localStorage.getItem(preferenceKey) === 'nonveg' ? 'nonveg' : 'veg'; }
    catch { return 'veg'; }
  });
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  const loadPoll = async () => {
    setPollLoading(true);
    try {
      const { data } = await api.get('/mess-menu/poll');
      setPoll(data.poll);
      setCanEditPoll(Boolean(data.canEdit));
      setPollChoice(data.poll?.myVote || '');
    } catch (error) {
      toast(errMsg(error), 'error');
    } finally {
      setPollLoading(false);
    }
  };

  useEffect(() => { loadPoll(); }, []);

  const openPollEditor = () => {
    setPollQuestion(poll?.question || '');
    setPollOptions(poll?.options?.map(({ id, text }) => ({ id, text })) || [{ id: '', text: '' }, { id: '', text: '' }]);
    setPollClosed(Boolean(poll?.closed));
    setPollEditorOpen(true);
  };

  const savePoll = async (event) => {
    event.preventDefault();
    setPollBusy(true);
    try {
      const { data } = await api.put('/mess-menu/poll', {
        question: pollQuestion,
        options: pollOptions,
        closed: pollClosed
      });
      setPoll(data.poll);
      setCanEditPoll(Boolean(data.canEdit));
      setPollChoice(data.poll?.myVote || '');
      setPollEditorOpen(false);
      toast(poll ? 'Mess poll updated.' : 'Mess poll published.');
    } catch (error) {
      toast(errMsg(error), 'error');
    } finally {
      setPollBusy(false);
    }
  };

  const castPollVote = async (event) => {
    event.preventDefault();
    if (!pollChoice) return;
    setPollBusy(true);
    try {
      const { data } = await api.post('/mess-menu/poll/vote', { optionId: pollChoice });
      setPoll(data.poll);
      setPollChoice(data.poll?.myVote || '');
      toast('Your vote has been recorded.');
    } catch (error) {
      toast(errMsg(error), 'error');
    } finally {
      setPollBusy(false);
    }
  };

  const deletePoll = async () => {
    if (!window.confirm('Delete this mess poll and its votes?')) return;
    setPollBusy(true);
    try {
      await api.delete('/mess-menu/poll');
      setPoll(null);
      setPollEditorOpen(false);
      setPollChoice('');
      toast('Mess poll deleted.');
    } catch (error) {
      toast(errMsg(error), 'error');
    } finally {
      setPollBusy(false);
    }
  };

  const changePollOption = (index, value) => setPollOptions((current) => current.map((option, i) => i === index ? { ...option, text: value } : option));

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

      <section className="mess-poll card" aria-labelledby="mess-poll-heading">
        <div className="mess-poll-header">
          <div><span className="eyebrow">MESS COMMUNITY</span><h2 id="mess-poll-heading">Quick poll</h2><p>Share your choice with the mess.</p></div>
          {canEditPoll && <button type="button" className="btn btn-sm" onClick={openPollEditor}>{poll ? 'Edit poll' : '＋ Create poll'}</button>}
        </div>

        {pollLoading ? <p className="mess-poll-empty">Loading the current poll…</p> : poll ? <>
          <form onSubmit={castPollVote} className="mess-poll-vote">
            <h3>{poll.question} {poll.demo && <span className="mess-poll-demo-tag">DEMO</span>}</h3>
            <div className="mess-poll-options">
              {poll.options.map((option) => {
                const percent = poll.totalVotes ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
                return <label className={`mess-poll-option ${pollChoice === option.id ? 'selected' : ''}`} key={option.id}>
                  <input type="radio" name="mess-poll-option" value={option.id} checked={pollChoice === option.id} onChange={() => setPollChoice(option.id)} disabled={poll.closed} />
                  <span className="mess-poll-option-copy"><span>{option.text}</span><small>{option.votes} {option.votes === 1 ? 'vote' : 'votes'} · {percent}%</small></span>
                  <span className="mess-poll-meter" aria-hidden="true"><i style={{ width: `${percent}%` }} /></span>
                </label>;
              })}
            </div>
            <div className="mess-poll-footer"><span>{poll.closed ? 'Poll closed' : poll.myVote ? 'You can change your vote' : 'Choose one option'} · {poll.totalVotes} total {poll.totalVotes === 1 ? 'vote' : 'votes'}</span>
              {!poll.closed && <button type="submit" className="btn btn-primary btn-sm" disabled={!pollChoice || pollBusy}>{pollBusy ? 'Saving…' : poll.myVote ? 'Update vote' : 'Vote'}</button>}
            </div>
          </form>
          {canEditPoll && pollEditorOpen && <form className="mess-poll-editor" onSubmit={savePoll}>
            <label className="field"><span className="label">Question</span><input className="input" maxLength={180} value={pollQuestion} onChange={(event) => setPollQuestion(event.target.value)} placeholder="What should we serve this Sunday?" required /></label>
            <div className="mess-poll-edit-options"><span className="label">Choices</span>
              {pollOptions.map((option, index) => <div className="mess-poll-edit-row" key={`${option.id || 'new'}-${index}`}><input className="input" maxLength={100} value={option.text} onChange={(event) => changePollOption(index, event.target.value)} placeholder={`Option ${index + 1}`} required /><button type="button" className="btn btn-sm" aria-label={`Remove option ${index + 1}`} disabled={pollOptions.length <= 2} onClick={() => setPollOptions((current) => current.filter((_, i) => i !== index))}>×</button></div>)}
              {pollOptions.length < 8 && <button type="button" className="btn btn-sm" onClick={() => setPollOptions((current) => [...current, { id: '', text: '' }])}>＋ Add choice</button>}
            </div>
            <label className="mess-poll-closed"><input type="checkbox" checked={pollClosed} onChange={(event) => setPollClosed(event.target.checked)} /> Close voting</label>
            <div className="mess-poll-editor-actions"><button type="button" className="btn btn-sm" onClick={() => setPollEditorOpen(false)}>Cancel</button><button type="submit" className="btn btn-primary btn-sm" disabled={pollBusy}>{pollBusy ? 'Saving…' : 'Save poll'}</button></div>
          </form>}
          {canEditPoll && <div className="mess-poll-admin-actions">{pollEditorOpen && <button type="button" className="btn btn-sm danger" disabled={pollBusy} onClick={deletePoll}>Delete poll</button>}</div>}
        </> : <div className="mess-poll-empty"><span>No poll is open right now.</span>{canEditPoll && pollEditorOpen && <form className="mess-poll-editor" onSubmit={savePoll}>
          <label className="field"><span className="label">Question</span><input className="input" maxLength={180} value={pollQuestion} onChange={(event) => setPollQuestion(event.target.value)} placeholder="What should we serve this Sunday?" required /></label>
          <div className="mess-poll-edit-options"><span className="label">Choices</span>{pollOptions.map((option, index) => <div className="mess-poll-edit-row" key={`new-${index}`}><input className="input" maxLength={100} value={option.text} onChange={(event) => changePollOption(index, event.target.value)} placeholder={`Option ${index + 1}`} required /><button type="button" className="btn btn-sm" aria-label={`Remove option ${index + 1}`} disabled={pollOptions.length <= 2} onClick={() => setPollOptions((current) => current.filter((_, i) => i !== index))}>×</button></div>)}{pollOptions.length < 8 && <button type="button" className="btn btn-sm" onClick={() => setPollOptions((current) => [...current, { id: '', text: '' }])}>＋ Add choice</button>}</div>
          <div className="mess-poll-editor-actions"><button type="button" className="btn btn-sm" onClick={() => setPollEditorOpen(false)}>Cancel</button><button type="submit" className="btn btn-primary btn-sm" disabled={pollBusy}>{pollBusy ? 'Publishing…' : 'Publish poll'}</button></div>
        </form>}</div>}
      </section>

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
