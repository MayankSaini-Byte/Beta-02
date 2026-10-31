import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../context/AppContext.jsx';
import api from '../api/client.js';
import Icon from './Icon.jsx';

const sevColor = { danger: 'var(--red)', warning: 'var(--amber)', info: 'var(--blue)' };

export default function NotificationBell() {
  const { notifs, refreshNotifs } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markRead = async () => {
    try {
      await api.post('/notifications/read-all');
      await refreshNotifs();
    } catch { /* noop */ }
  };

  return (
    <div className="bell-wrap" ref={ref}>
      <button
        className="btn btn-icon" aria-label="Notifications"
        onClick={() => { setOpen((o) => !o); if (!open && notifs.unread > 0) markRead(); }}
      >
        <Icon name="bell" />
        {notifs.unread > 0 && <span className="bell-dot">{notifs.unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="bell-pop"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.16 }}
          >
            <div className="flex-between" style={{ padding: '6px 10px 10px' }}>
              <b style={{ fontSize: 13 }}>Reminders</b>
              <span className="tiny faint">{notifs.notifications.length} active</span>
            </div>
            {notifs.notifications.length === 0 && (
              <div className="tc muted small" style={{ padding: '18px 10px 22px' }}>
                All clear! No pending reminders.
              </div>
            )}
            {notifs.notifications.map((n) => (
              <div key={n.id} className="notif-row">
                <span className="notif-dot" style={{ background: sevColor[n.severity] || 'var(--muted)' }} />
                <div>
                  <div className="notif-title">{n.title}</div>
                  <div className="notif-msg">{n.message}</div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
