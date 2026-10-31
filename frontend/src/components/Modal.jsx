import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import Icon from './Icon.jsx';

export default function Modal({ open, onClose, title, children, width }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose && onClose()}
        >
          <motion.div
            className="modal" style={width ? { maxWidth: width } : undefined}
            initial={{ scale: 0.94, y: 14, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 10, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            role="dialog" aria-modal="true"
          >
            <div className="modal-head">
              <h3>{title}</h3>
              <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
                <Icon name="x" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
