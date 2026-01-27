import React from 'react';
import './Tabs.css';

/**
 * Wiederverwendbare Tabs-Komponente
 *
 * @param {Array} items - [{ id, label, icon, badge, content }]
 * @param {string} activeKey - Aktiver Tab
 * @param {function} onChange - Callback bei Tab-Wechsel
 * @param {string} variant - horizontal, vertical
 */
export const Tabs = ({
  items = [],
  activeKey,
  onChange,
  variant = 'horizontal',
  className = '',
}) => {
  const activeTab = items.find(item => item.id === activeKey) || items[0];

  return (
    <div className={`ds-tabs ds-tabs--${variant} ${className}`}>
      <div className="ds-tabs__list" role="tablist">
        {items.map((item) => (
          <button
            key={item.id}
            role="tab"
            className={`ds-tabs__tab ${activeKey === item.id ? 'ds-tabs__tab--active' : ''}`}
            aria-selected={activeKey === item.id}
            onClick={() => onChange?.(item.id)}
          >
            {item.icon && <span className="ds-tabs__icon">{item.icon}</span>}
            <span className="ds-tabs__label">{item.label}</span>
            {item.badge && (
              <span className="ds-tabs__badge">{item.badge}</span>
            )}
          </button>
        ))}
      </div>
      {activeTab?.content && (
        <div className="ds-tabs__panel" role="tabpanel">
          {activeTab.content}
        </div>
      )}
    </div>
  );
};

/**
 * Tab List (nur die Tab-Buttons, ohne Content)
 */
export const TabList = ({
  items = [],
  activeKey,
  onChange,
  variant = 'horizontal',
  className = '',
}) => {
  return (
    <div className={`ds-tabs__list ds-tabs__list--${variant} ${className}`} role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          className={`ds-tabs__tab ${activeKey === item.id ? 'ds-tabs__tab--active' : ''}`}
          aria-selected={activeKey === item.id}
          onClick={() => onChange?.(item.id)}
        >
          {item.icon && <span className="ds-tabs__icon">{item.icon}</span>}
          <span className="ds-tabs__label">{item.label}</span>
          {item.badge && (
            <span className="ds-tabs__badge">{item.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
};

/**
 * Tab Panel (Content Container)
 */
export const TabPanel = ({ children, className = '' }) => {
  return (
    <div className={`ds-tabs__panel ${className}`} role="tabpanel">
      {children}
    </div>
  );
};

export default Tabs;
