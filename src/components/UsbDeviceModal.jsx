// src/components/UsbDeviceModal.jsx
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Usb, 
  Smartphone, 
  Camera, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  Zap, 
  Radio, 
  Terminal, 
  ShieldCheck, 
  Laptop,
  CheckCircle2,
  Send
} from 'lucide-react';

export function UsbDeviceModal({ 
  isOpen, 
  onClose, 
  scannerState, 
  onConnectDevice, 
  onDisconnectDevice 
}) {
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState([]);
  const [adbAvailable, setAdbAvailable] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [connectingId, setConnectingId] = useState(null);
  const [testScanLoading, setTestScanLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('devices'); // 'devices' | 'setup'

  // Fetch connected USB and ADB devices from backend
  const fetchDevices = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/usb/devices');
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to scan USB ports`);
      const data = await res.json();
      setDevices(data.devices || []);
      setAdbAvailable(data.adbAvailable ?? true);
    } catch (err) {
      console.warn('[USB MODAL] Device fetch error:', err);
      setErrorMsg('Could not query host USB subsystem: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDevices();
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConnected = scannerState?.status === 'CONNECTED';

  const handleConnect = async (device) => {
    setConnectingId(device.id);
    setErrorMsg(null);
    try {
      if (onConnectDevice) {
        await onConnectDevice(device);
      } else {
        const res = await fetch('/api/usb/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: device.id,
            deviceName: device.name,
            connectionType: device.interface || 'USB 3.2 High-Speed Bridge',
            serial: device.serial,
            model: device.model || device.name
          })
        });
        if (!res.ok) throw new Error('Connection failed');
      }
      setSuccessMsg(`Successfully connected to ${device.name}!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchDevices();
    } catch (err) {
      setErrorMsg('Connection failed: ' + err.message);
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async () => {
    setErrorMsg(null);
    try {
      if (onDisconnectDevice) {
        await onDisconnectDevice();
      } else {
        await fetch('/api/usb/disconnect', { method: 'POST' });
      }
      setSuccessMsg('Scanner disconnected.');
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchDevices();
    } catch (err) {
      setErrorMsg('Disconnect failed: ' + err.message);
    }
  };

  const handlePairWebUsb = async () => {
    if (!navigator.usb) {
      setErrorMsg('WebUSB API is not supported in this browser environment. Use Chrome or Edge.');
      return;
    }
    try {
      const device = await navigator.usb.requestDevice({ filters: [] });
      if (device) {
        const virtualDev = {
          id: `webusb-${device.vendorId}-${device.productId}`,
          name: device.productName || `USB Device (${device.vendorId}:${device.productId})`,
          serial: device.serialNumber || 'WEBUSB-SERIAL',
          interface: 'WebUSB Direct Link',
          type: 'WEBUSB_DEVICE',
          status: 'READY'
        };
        handleConnect(virtualDev);
      }
    } catch (err) {
      if (err.name !== 'NotFoundError') {
        setErrorMsg('WebUSB pair error: ' + err.message);
      }
    }
  };

  const handleSendTestScan = async () => {
    setTestScanLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/usb/test-scan', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to transmit test scan');
      setSuccessMsg('USB scan transferred! Live Inspection view is processing the image.');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err) {
      setErrorMsg('Test scan error: ' + err.message);
    } finally {
      setTestScanLoading(false);
    }
  };

  const handleConnectSimulated = () => {
    handleConnect({
      id: 'usb-virtual-mobile-01',
      name: 'Android Mobile Scanner App (USB Bridge)',
      serial: 'VIZORIS-MOB-USB',
      model: 'Android Phone via USB 3.2',
      interface: 'USB High-Speed ADB Bridge',
      type: 'ADB_MOBILE_SCANNER'
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card usb-device-modal-card" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="usb-modal-icon-glow">
              <Usb size={20} className="text-cyan" />
            </div>
            <div>
              <div className="modal-heading" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                USB SCANNER DEVICE MANAGER
                <span className="badge badge-cyan mono" style={{ fontSize: '10px' }}>USB 3.2 / ADB</span>
              </div>
              <div className="mono text-muted" style={{ fontSize: '11px' }}>
                Discover physical Android mobile scanner apps and connected USB vision hardware
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              className="btn-icon" 
              onClick={fetchDevices} 
              disabled={loading}
              title="Rescan USB and ADB ports"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin text-cyan' : ''} />
            </button>
            <button className="btn-icon" onClick={onClose} title="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Real-time Hardware Telemetry Bar */}
        <div className="usb-telemetry-banner">
          <div className="usb-telemetry-item">
            <span className="telemetry-sub">CONNECTION STATE</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className={`status-dot ${isConnected ? 'online' : 'disconnected'}`} />
              <span className={`mono font-bold ${isConnected ? 'text-emerald' : 'text-rose'}`}>
                {scannerState?.status || 'DISCONNECTED'}
              </span>
            </div>
          </div>

          <div className="usb-telemetry-item" style={{ flex: 1 }}>
            <span className="telemetry-sub">ACTIVE SCANNER</span>
            <span className="mono text-cyan" style={{ fontSize: '12px', fontWeight: 600 }}>
              {scannerState?.deviceName || 'No Scanner Connected'}
            </span>
          </div>

          <div className="usb-telemetry-item">
            <span className="telemetry-sub">INTERFACE</span>
            <span className="mono" style={{ fontSize: '12px' }}>
              {scannerState?.connectionType || 'USB 3.2 ADB Bridge'}
            </span>
          </div>

          {isConnected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                className="btn btn-primary btn-sm"
                onClick={handleSendTestScan}
                disabled={testScanLoading}
                title="Send test photo over USB bridge to verify Live Inspection"
              >
                <Send size={13} />
                {testScanLoading ? 'Sending...' : 'Test USB Scan'}
              </button>
              <button 
                className="btn btn-danger btn-sm"
                onClick={handleDisconnect}
                title="Disconnect this scanner"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* Notifications / Feedback */}
        {errorMsg && (
          <div className="usb-modal-alert error">
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="usb-modal-alert success">
            <CheckCircle2 size={15} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab navigation */}
        <div className="usb-modal-tabs">
          <button 
            className={`usb-tab-btn ${activeTab === 'devices' ? 'active' : ''}`}
            onClick={() => setActiveTab('devices')}
          >
            <Usb size={14} />
            <span>Detected USB Devices ({devices.length})</span>
          </button>
          <button 
            className={`usb-tab-btn ${activeTab === 'setup' ? 'active' : ''}`}
            onClick={() => setActiveTab('setup')}
          >
            <Terminal size={14} />
            <span>Scanner App Setup Guide</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="usb-modal-body">
          {activeTab === 'devices' && (
            <div className="usb-devices-view">
              <div className="usb-section-header">
                <span className="mono" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  AVAILABLE USB HARDWARE & MOBILE SCANNERS
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={handlePairWebUsb}
                    title="Pair device via browser native WebUSB dialog"
                  >
                    <Laptop size={13} /> Pair via WebUSB
                  </button>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={handleConnectSimulated}
                    title="Connect virtual mobile scanner for testing"
                  >
                    <Zap size={13} /> Quick-Connect Virtual Scanner
                  </button>
                </div>
              </div>

              {/* Device List */}
              <div className="usb-device-list">
                {devices.length === 0 && !loading && (
                  <div className="usb-empty-state">
                    <Radio size={32} className="text-muted animate-pulse" />
                    <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '8px' }}>
                      No Physical USB Scanner Currently Detected
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '400px', margin: '4px auto 16px' }}>
                      Plug in your Android phone via USB cable and ensure "USB Debugging" is enabled, or click Quick-Connect Virtual Scanner to test immediately.
                    </p>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={handleConnectSimulated}
                    >
                      <Zap size={14} /> Connect Virtual USB Mobile Scanner
                    </button>
                  </div>
                )}

                {devices.map((dev) => {
                  const isThisConnected = isConnected && (
                    scannerState?.deviceName?.toLowerCase().includes(dev.name.toLowerCase()) ||
                    (scannerState?.connectedDevice && (scannerState.connectedDevice.id === dev.id || scannerState.connectedDevice.name === dev.name))
                  );
                  const isAdb = dev.type === 'ADB_MOBILE_SCANNER' || dev.interface?.includes('ADB');
                  const isCamera = dev.className === 'Camera' || dev.type === 'USB_VISION_CAMERA';

                  return (
                    <div key={dev.id} className={`usb-device-card ${isThisConnected ? 'connected' : ''}`}>
                      <div className="usb-device-icon-box">
                        {isAdb ? (
                          <Smartphone size={22} className="text-cyan" />
                        ) : isCamera ? (
                          <Camera size={22} className="text-emerald" />
                        ) : (
                          <Usb size={22} className="text-blue" />
                        )}
                      </div>

                      <div className="usb-device-info">
                        <div className="usb-device-name-row">
                          <span className="usb-device-name">{dev.name}</span>
                          {isThisConnected ? (
                            <span className="badge badge-pass mono" style={{ fontSize: '10px' }}>
                              <Check size={11} /> CURRENTLY CONNECTED
                            </span>
                          ) : (
                            <span className={`badge ${dev.state === 'READY' || dev.status === 'OK' ? 'badge-pass' : 'badge-warn'} mono`} style={{ fontSize: '10px' }}>
                              {dev.state || dev.status || 'AVAILABLE'}
                            </span>
                          )}
                        </div>

                        <div className="usb-device-meta mono">
                          <span>INTERFACE: <span className="text-cyan">{dev.interface}</span></span>
                          {dev.serial && <span>ID: {dev.serial}</span>}
                          {isAdb && <span className="text-emerald">ANDROID ADB READY</span>}
                        </div>
                      </div>

                      <div className="usb-device-actions">
                        {isThisConnected ? (
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={handleDisconnect}
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button 
                            className="btn btn-primary btn-sm"
                            disabled={connectingId === dev.id}
                            onClick={() => handleConnect(dev)}
                            id={`connect-dev-${dev.id}`}
                          >
                            <Zap size={13} />
                            {connectingId === dev.id ? 'Connecting...' : 'Connect Scanner App'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'setup' && (
            <div className="usb-setup-view">
              <div className="usb-setup-step">
                <div className="step-badge mono">01</div>
                <div className="step-content">
                  <div className="step-title">Connect Phone via USB Cable</div>
                  <p className="step-desc">
                    Connect your Android phone to this workstation using a high-speed USB data cable (USB-C to USB-A or USB-C). Select "File Transfer / MTP" or "PTP" mode on the phone.
                  </p>
                </div>
              </div>

              <div className="usb-setup-step">
                <div className="step-badge mono">02</div>
                <div className="step-content">
                  <div className="step-title">Enable USB Debugging on Android</div>
                  <p className="step-desc">
                    Go to <strong>Settings &gt; About Phone</strong> and tap <strong>Build Number</strong> 7 times to enable Developer Options. Then navigate to <strong>Settings &gt; Developer Options</strong> and switch on <strong>USB Debugging</strong>. Tap "Always Allow" when prompted.
                  </p>
                </div>
              </div>

              <div className="usb-setup-step">
                <div className="step-badge mono">03</div>
                <div className="step-content">
                  <div className="step-title">Automated Camera Ingestion Bridge</div>
                  <p className="step-desc">
                    Run the automated camera monitor bridge daemon in terminal:
                  </p>
                  <div className="usb-terminal-box mono" style={{ marginTop: '8px' }}>
                    <div className="terminal-header">
                      <Terminal size={13} className="text-cyan" />
                      <span>TERMINAL COMMAND</span>
                    </div>
                    <div className="terminal-line"><span className="text-cyan">python usb_bridge.py</span></div>
                    <div className="terminal-line text-muted"># Automatically transfers all photos taken with phone camera to VIZORIS live inspection</div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '20px', padding: '14px', background: 'rgba(14, 165, 233, 0.08)', borderRadius: '6px', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--cyan-accent)', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
                  <ShieldCheck size={16} /> Instant Verification
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Once connected, any photo captured on your mobile camera is streamed instantaneously over USB into the VIZORIS AI inspection workspace.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)' }}>
          <div className="mono text-muted" style={{ fontSize: '11px' }}>
            ADB STATUS: <span className={adbAvailable ? 'text-emerald' : 'text-amber'}>{adbAvailable ? 'INSTALLED & ACTIVE' : 'STANDBY'}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
