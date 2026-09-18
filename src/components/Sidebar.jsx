// src/components/Sidebar.jsx
import React from 'react';
import { 
  LayoutDashboard, 
  ScanSearch, 
  History, 
  BarChart3, 
  GitFork, 
  TrendingUp, 
  Award, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Usb,
  Radio
} from 'lucide-react';

export function Sidebar({ activeTab, setActiveTab, collapsed, setCollapsed, scannerState, onOpenUsbModal }) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, badge: null },
    { id: 'live', label: 'Live Inspection', icon: ScanSearch, badge: 'LIVE' },
    { id: 'history', label: 'Inspection History', icon: History, badge: null },
    { id: 'analytics', label: 'Quality Analytics', icon: BarChart3, badge: null },
    { id: 'rootcause', label: 'Root Cause', icon: GitFork, badge: null },
    { id: 'predictions', label: 'Predictions', icon: TrendingUp, badge: null },
    { id: 'passport', label: 'Digital Passport', icon: Award, badge: null },
    { id: 'settings', label: 'Settings', icon: Settings, badge: null },
  ];

  const isConnected = scannerState?.status === 'CONNECTED';

  return (
    <aside className={`sidebar-container ${collapsed ? 'collapsed' : ''}`}>
      {/* Navigation List */}
      <div className="sidebar-nav">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="nav-icon" />
              {!collapsed && (
                <span className="nav-item-label">{item.label}</span>
              )}
              {!collapsed && item.badge && (
                <span className="nav-item-badge">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Mobile Scanner Hardware Card at Sidebar bottom */}
      {!collapsed ? (
        <div 
          className="sidebar-hardware-dock sidebar-hardware-dock-clickable"
          onClick={onOpenUsbModal}
          title="Click to connect or configure USB Scanner"
          role="button"
          tabIndex={0}
        >
          <div className="hardware-dock-header">
            <div className="dock-title">
              <Usb size={14} className="text-cyan" /> USB SCANNER
            </div>
            <div className={`status-indicator ${scannerState?.status?.toLowerCase() || 'connected'}`}>
              <Radio size={12} />
            </div>
          </div>
          <div className="dock-device-name mono">
            {scannerState?.deviceName || 'Mobile Phone (USB Bridge)'}
          </div>
          <div className="dock-state-banner mono">
            STATUS: <span className={isConnected ? 'text-emerald font-bold' : 'text-amber font-bold'}>{scannerState?.status || 'CONNECTED'}</span>
          </div>
          <div className="dock-action-hint mono">
            {isConnected ? 'MANAGE DEVICE ›' : 'CONNECT USB DEVICE ›'}
          </div>
        </div>
      ) : (
        <div 
          className="sidebar-collapsed-dock-icon clickable" 
          onClick={onOpenUsbModal}
          title={`Scanner: ${scannerState?.status || 'CONNECTED'} (Click to manage)`}
          role="button"
          tabIndex={0}
        >
          <Usb size={18} className={isConnected ? 'text-cyan' : 'text-amber'} />
        </div>
      )}

      {/* Collapse/Expand Toggle */}
      <div className="sidebar-footer">
        <button 
          className="sidebar-toggle-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : (
            <>
              <ChevronLeft size={16} />
              <span className="toggle-label">COLLAPSE SIDEBAR</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
