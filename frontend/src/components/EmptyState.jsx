import Icon from './Icon.jsx';

export default function EmptyState({ icon = 'box', title, children }) {
  return (
    <div className="empty">
      <Icon name={icon} size={38} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
