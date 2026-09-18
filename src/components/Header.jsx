// src/components/Header.jsx
import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Smartphone, 
  Cpu, 
  Bell, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw,
  X
} from 'lucide-react';

export function Header({ scannerState, onRefreshData, notifications = [], onOpenUsbModal }) {
  const [currentTime, setCurrentTime] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      setCurrentTime(`${dateStr} • ${timeStr}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const getScannerDotClass = () => {
    switch (scannerState?.status) {
      case 'CONNECTED': return 'connected';
      case 'PROCESSING':
      case 'IMAGE RECEIVED': return 'processing';
      case 'WAITING FOR SCAN': return 'waiting';
      default: return 'disconnected';
    }
  };

  return (
    <header className="header-container">
      <div className="header-brand">
        <div className="brand-logo-glow">
          <ShieldCheck size={24} className="text-cyan" />
        </div>
        <div className="brand-text">
          <div className="brand-title">
            VIZORIS <span className="version-pill">v2.4</span>
          </div>
          <div className="brand-subtitle">
            Vision Intelligence for Zero-Defect Manufacturing
          </div>
        </div>
      </div>

      {/* Right Telemetry & Status Indicators */}
      <div className="header-telemetry">
        {/* System Status */}
        <div className="telemetry-pill">
          <Cpu size={14} className="telemetry-icon" />
          <div className="telemetry-label">SYSTEM</div>
          <div className="telemetry-value">
            <span className="status-dot online"></span>ONLINE
          </div>
        </div>

        {/* Scanner Status Button */}
        <button 
          className={`telemetry-pill telemetry-pill-clickable ${scannerState?.status === 'CONNECTED' ? 'scanner-connected' : 'scanner-disconnected'}`}
          onClick={onOpenUsbModal}
          id="header-scanner-status-btn"
          title="Click to connect or manage USB Scanner device"
        >
          <Smartphone size={14} className="telemetry-icon" />
          <div className="telemetry-label">SCANNER</div>
          <div className="telemetry-value">
            <span className={`status-dot ${getScannerDotClass()}`}></span>
            {scannerState?.status || 'CONNECTED'}
          </div>
          {scannerState?.status !== 'CONNECTED' && (
            <span className="telemetry-action-hint mono">CONNECT</span>
          )}
        </button>

        {/* Refresh button */}
        <button 
          className="btn-icon" 
          onClick={onRefreshData} 
          title="Refresh telemetry and metrics"
        >
          <RefreshCw size={15} />
        </button>

        {/* Notification Bell */}
        <div className="notification-wrapper">
          <button 
            className={`btn-icon ${notifications.length > 0 ? 'has-badge' : ''}`}
            onClick={() => setShowNotifications(!showNotifications)}
            title="System alerts & notifications"
          >
            <Bell size={16} />
            {notifications.length > 0 && (
              <span className="notification-badge-count">{notifications.length}</span>
            )}
          </button>

          {showNotifications && (
            <div className="notifications-popover">
              <div className="notifications-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={15} className="text-amber" /> SYSTEM NOTIFICATIONS
                </div>
                <button className="btn-icon" onClick={() => setShowNotifications(false)} style={{ width: '24px', height: '24px' }}>
                  <X size={14} />
                </button>
              </div>
              <div className="notifications-list">
                {notifications.length === 0 ? (
                  <div className="notifications-empty">No active notifications.</div>
                ) : (
                  notifications.map((n, idx) => (
                    <div key={idx} className="notification-item">
                      <div style={{ marginTop: '2px' }}>
                        {n.type === 'defect' ? (
                          <AlertTriangle size={14} className="text-rose" />
                        ) : (
                          <CheckCircle2 size={14} className="text-emerald" />
                        )}
                      </div>
                      <div>
                        <div className="notification-item-title">{n.title}</div>
                        <div className="notification-item-text">{n.message}</div>
                        <div className="notification-item-time mono">{n.time || 'Just now'}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Real-time Shift Clock */}
        <div className="telemetry-clock mono">
          <Clock size={13} />
          <span>{currentTime || 'SYNCHRONIZING...'}</span>
        </div>
      </div>
    </header>
  );
}
