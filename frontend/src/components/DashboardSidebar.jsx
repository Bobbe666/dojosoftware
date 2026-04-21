import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import '../styles/Sidebar.css';

export default function DashboardSidebar({ tabs, activeTab, onTabChange, collapsed, onToggle }) {
  return (
    <aside className={`db-sidebar${collapsed ? ' db-sidebar--collapsed' : ''}`}>
      <button className="db-sidebar__toggle" onClick={onToggle} title={collapsed ? 'Ausklappen' : 'Einklappen'}>
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        {!collapsed && <span>Einklappen</span>}
      </button>

      <nav className="db-sidebar__nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`db-sidebar__item${activeTab === tab.id ? ' db-sidebar__item--active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            title={collapsed ? tab.label : undefined}
          >
            <span className="db-sidebar__icon">{tab.icon}</span>
            {!collapsed && <span className="db-sidebar__label">{tab.label}</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}
