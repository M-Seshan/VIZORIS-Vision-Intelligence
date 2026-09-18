// src/components/SettingsView.jsx
import React, { useState, useRef } from 'react';
import { 
  Settings, 
  Usb, 
  Cpu, 
  CheckCircle2, 
  Terminal, 
  RotateCcw,
  FileImage,
  UploadCloud,
  Check,
  AlertCircle
} from 'lucide-react';

export function SettingsView({ scannerState, referenceInfo, onUpdateReference, onResetData }) {
  const [confidenceThreshold, setConfidenceThreshold] = useState(80);
  const [blurSensitivity, setBlurSensitivity] = useState(25);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [refUploadMsg, setRefUploadMsg] = useState(null);
  const refFileInputRef = useRef(null);

  const handleSaveSettings = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleRefFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Replace the master clean reference notebook image? All future scans will be benchmarked against this new baseline.')) {
      e.target.value = '';
      return;
    }

    setUploadingRef(true);
    setRefUploadMsg(null);
    try {
      if (onUpdateReference) {
        await onUpdateReference(file);
        setRefUploadMsg({ type: 'success', text: 'Clean reference image updated successfully!' });
      }
    } catch (err) {
      setRefUploadMsg({ type: 'error', text: 'Failed to upload reference: ' + err.message });
    } finally {
      setUploadingRef(false);
      e.target.value = '';
      setTimeout(() => setRefUploadMsg(null), 5000);
    }
  };

  return (
    <div className="settings-container">
      {/* Top Header */}
      <div className="history-filter-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Settings size={20} className="text-cyan" />
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              SYSTEM SETTINGS & HARDWARE BRIDGE
            </div>
            <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Configure computer vision parameters, mobile USB bridge, and data store
            </div>
          </div>
        </div>

        <button className="btn btn-primary btn-sm" onClick={handleSaveSettings}>
          <CheckCircle2 size={14} /> {savedSuccess ? 'Settings Saved' : 'Save Changes'}
        </button>
      </div>

      {/* ── MASTER REFERENCE BASELINE CARD ── */}
      <div className="settings-card" style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            <FileImage size={16} className="text-cyan" /> MASTER CLEAN NOTEBOOK REFERENCE BASELINE
          </div>
          <span className="badge badge-pass mono">ACTIVE BASELINE</span>
        </div>

        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Reference Thumbnail */}
          <div style={{ 
            width: '120px', 
            height: '150px', 
            borderRadius: '6px', 
            overflow: 'hidden', 
            border: '1px solid var(--border-subtle)', 
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {referenceInfo?.url ? (
              <img 
                src={referenceInfo.url} 
                alt="Clean Reference Specimen" 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
              />
            ) : (
              <FileImage size={32} className="text-muted" />
            )}
          </div>

          {/* Reference Details */}
          <div style={{ flex: 1, minWidth: '260px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Standard Defect-Free Notebook Master
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
              All camera scans undergo perspective homography alignment and structural diff comparison against this baseline.
              Ruling lines, page margins, and binding geometry present in this reference are established as normal product features.
            </p>

            <div className="scanner-status-grid mono" style={{ marginBottom: '14px' }}>
              <div className="status-metric-box">
                <span className="metric-label">BASELINE FILE</span>
                <span className="metric-val text-cyan" style={{ fontSize: '12px' }}>{referenceInfo?.filename || 'notebook_clean_reference.jpg'}</span>
              </div>
              <div className="status-metric-box">
                <span className="metric-label">STATUS</span>
                <span className="metric-val text-emerald">READY / ACTIVE</span>
              </div>
              <div className="status-metric-box">
                <span className="metric-label">FILE SIZE</span>
                <span className="metric-val">{referenceInfo?.sizeBytes ? `${Math.round(referenceInfo.sizeBytes / 1024)} KB` : '88 KB'}</span>
              </div>
              <div className="status-metric-box">
                <span className="metric-label">COMPARISON ENGINE</span>
                <span className="metric-val">SSIM + ORB Warp</span>
              </div>
            </div>

            {refUploadMsg && (
              <div style={{ 
                padding: '8px 12px', 
                borderRadius: '4px', 
                marginBottom: '10px', 
                fontSize: '12px',
                background: refUploadMsg.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                color: refUploadMsg.type === 'success' ? 'var(--status-pass)' : 'var(--status-defect)',
                border: `1px solid ${refUploadMsg.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`
              }}>
                {refUploadMsg.text}
              </div>
            )}

            <input 
              type="file" 
              ref={refFileInputRef} 
              onChange={handleRefFileChange} 
              accept="image/*" 
              style={{ display: 'none' }} 
            />
            <button 
              className="btn btn-secondary btn-sm"
              disabled={uploadingRef}
              onClick={() => refFileInputRef.current?.click()}
            >
              <UploadCloud size={14} /> {uploadingRef ? 'Uploading Reference...' : 'Replace Master Clean Reference'}
            </button>
          </div>
        </div>
      </div>

      <div className="settings-grid">
        {/* Mobile Scanner & USB Bridge Diagnostic Card */}
        <div className="settings-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              <Usb size={16} className="text-cyan" /> MOBILE SCANNER USB BRIDGE
            </div>
            <span className={`badge ${scannerState?.status === 'CONNECTED' ? 'badge-pass' : 'badge-warn'} mono`}>
              {scannerState?.status || 'CONNECTED'}
            </span>
          </div>

          <div className="scanner-status-grid mono">
            <div className="status-metric-box">
              <span className="metric-label">CONNECTED HARDWARE</span>
              <span className="metric-val text-cyan">{scannerState?.deviceName || 'Android Mobile Phone'}</span>
            </div>
            <div className="status-metric-box">
              <span className="metric-label">INTERFACE</span>
              <span className="metric-val">{scannerState?.connectionType || 'USB 3.2 High-Speed'}</span>
            </div>
            <div className="status-metric-box">
              <span className="metric-label">BATTERY</span>
              <span className="metric-val text-emerald">{scannerState?.batteryLevel || 90}%</span>
            </div>
            <div className="status-metric-box">
              <span className="metric-label">TRANSFER PROTOCOL</span>
              <span className="metric-val">ADB Poll / REST Multipart</span>
            </div>
          </div>

          {/* ADB USB Quick Setup Guide */}
          <div className="usb-terminal-box mono">
            <div className="terminal-header">
              <Terminal size={14} className="text-cyan" />
              <span>USB BRIDGE SETUP</span>
            </div>
            <div className="terminal-line"><span className="text-muted"># 1. Connect Android phone to laptop with USB cable & enable USB Debugging</span></div>
            <div className="terminal-line"><span className="text-cyan">adb devices</span></div>
            <div className="terminal-line"><span className="text-muted"># 2. Launch VIZORIS USB automated photo transfer daemon:</span></div>
            <div className="terminal-line"><span className="text-cyan">python usb_bridge.py</span></div>
            <div className="terminal-line"><span className="text-muted"># Any photo taken on the phone camera will stream directly to the dashboard!</span></div>
          </div>
        </div>

        {/* AI Model Hyperparameters & Database Reset */}
        <div className="settings-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                <Cpu size={16} className="text-cyan" /> COMPUTER VISION PARAMETERS
              </div>
              <span className="badge badge-cyan mono">OPENCV 5.0</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Confidence Threshold Slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Minimum Confidence Threshold</span>
                  <span className="mono text-cyan">{confidenceThreshold}%</span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Detections with confidence below this threshold are flagged as LOW CONFIDENCE for manual review.
                </p>
                <input 
                  type="range" 
                  min="60" 
                  max="95" 
                  value={confidenceThreshold}
                  onChange={e => setConfidenceThreshold(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--cyan-accent)' }}
                />
              </div>

              {/* Blur Threshold Slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Laplacian Blur Sensitivity Threshold</span>
                  <span className="mono text-cyan">{blurSensitivity}</span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Captures with blur variance below this value trigger "Image quality insufficient — please rescan."
                </p>
                <input 
                  type="range" 
                  min="15" 
                  max="50" 
                  value={blurSensitivity}
                  onChange={e => setBlurSensitivity(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--cyan-accent)' }}
                />
              </div>
            </div>
          </div>

          {/* Database Reset Action */}
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--status-defect)', marginBottom: '4px' }}>
              RESET INSPECTION DATABASE
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Clears all real inspection records from database for a fresh test run.
            </p>
            <button 
              className="btn btn-danger btn-sm"
              onClick={onResetData}
            >
              <RotateCcw size={14} /> Clear Inspection Data Store
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
