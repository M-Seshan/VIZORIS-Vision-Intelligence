import React, { useState, useRef } from 'react';
import { 
  Crosshair, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle,
  Eye, 
  EyeOff, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  UploadCloud, 
  FileCheck, 
  Activity, 
  Cpu, 
  ScanLine, 
  ShieldCheck, 
  ShieldAlert, 
  Zap, 
  BarChart2, 
  Smartphone, 
  ChevronRight, 
  Info, 
  Camera, 
  Aperture, 
  Target, 
  TrendingDown, 
  TrendingUp, 
  CheckSquare, 
  XSquare, 
  AlertOctagon, 
  Layers,
  Usb
} from 'lucide-react';

const PROCESSING_STEPS_INFO = [
  { step: 1, name: 'Image Received', desc: 'Raw camera frame ingested from USB mobile bridge' },
  { step: 2, name: 'Image Preprocessing', desc: 'Laplacian blur check & brightness normalization' },
  { step: 3, name: 'Homography Alignment', desc: 'ORB feature matching against clean reference notebook' },
  { step: 4, name: 'Structural Comparison', desc: 'SSIM difference & pixel subtraction against clean baseline' },
  { step: 5, name: 'Defect Segmentation', desc: 'Contour anomaly isolation & illumination compensation' },
  { step: 6, name: 'Defect Classification', desc: 'Typology mapping (ink stain, pen stroke, torn corner)' },
  { step: 7, name: 'Severity Assessment', desc: 'Tolerance evaluation against notebook QA criteria' },
  { step: 8, name: 'Quality Score Derivation', desc: 'SSIM baseline minus weighted defect deductions' },
  { step: 9, name: 'Root Cause Correlation', desc: 'Process correlation against historical inspection data' },
  { step: 10, name: 'Inspection Complete', desc: 'Digital Quality Passport signed with SHA-256 hash' }
];

function getUsbStatusDetails(scannerState) {
  const status = scannerState?.status || 'DISCONNECTED';
  const deviceName = scannerState?.deviceName || '';

  switch (status) {
    case 'CONNECTED':
      return {
        dotClass: 'status-dot-connected',
        headline: 'USB CONNECTED',
        subtext: deviceName && !deviceName.toLowerCase().includes('no scanner')
          ? `${deviceName.toUpperCase()}`
          : 'VIZORIS MOBILE SCANNER CONNECTED'
      };
    case 'TRANSFERRING':
      return {
        dotClass: 'status-dot-transferring',
        headline: 'USB TRANSFERRING',
        subtext: 'RECEIVING NOTEBOOK SCAN...'
      };
    case 'CONNECTING':
      return {
        dotClass: 'status-dot-connecting',
        headline: 'CONNECTING',
        subtext: 'ESTABLISHING USB LINK...'
      };
    case 'ERROR':
      return {
        dotClass: 'status-dot-error',
        headline: 'USB ERROR',
        subtext: 'SCANNER DISCONNECTED OR ERROR'
      };
    case 'DISCONNECTED':
    default:
      return {
        dotClass: 'status-dot-disconnected',
        headline: 'USB NOT CONNECTED',
        subtext: 'CONNECT MOBILE SCANNER VIA USB'
      };
  }
}

function SeverityBadge({ severity }) {
  const map = {
    CRITICAL: { cls: 'badge-defect', label: 'CRITICAL' },
    MODERATE: { cls: 'badge-warn', label: 'MODERATE' },
    MINOR: { cls: 'badge-warn-soft', label: 'MINOR' },
    NOMINAL: { cls: 'badge-pass', label: 'NOMINAL' }
  };
  const s = map[severity] || map['NOMINAL'];
  return <span className={`badge ${s.cls} mono`}>{s.label}</span>;
}

function ConfidenceBar({ value }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  const color = pct >= 90 ? 'var(--status-pass)' : pct >= 70 ? 'var(--status-warn)' : 'var(--status-defect)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
      </div>
      <span className="mono" style={{ fontSize: '11px', color, minWidth: '36px', textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

function QualityRing({ score }) {
  if (score === null || score === undefined) {
    return (
      <div className="quality-ring-wrapper">
        <div className="quality-ring-value mono" style={{ color: 'var(--text-muted)' }}>N/A</div>
        <div className="quality-ring-label mono">QUALITY</div>
      </div>
    );
  }
  const radius = 40;
  const circ = 2 * Math.PI * radius;
  const fillPct = score / 100;
  const strokeDash = fillPct * circ;
  const color = score >= 90 ? '#10b981' : score >= 75 ? '#f59e0b' : '#f43f5e';
  return (
    <div className="quality-ring-wrapper">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={radius}
          fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${strokeDash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div className="quality-ring-overlay">
        <div className="quality-ring-value mono" style={{ color }}>{score}%</div>
        <div className="quality-ring-label mono">QUALITY</div>
      </div>
    </div>
  );
}

export function LiveInspectionView({ 
  currentInspection, 
  referenceInfo,
  scannerState,
  liveScannedImage,
  streamStatus = 'IDLE',
  streamError = null,
  isProcessing, 
  processingStep, 
  onUploadCustomScan,
  onOpenPassport,
  onNavigate,
  onRetry,
  onOpenUsbModal
}) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showOverlays, setShowOverlays] = useState(true);
  const [operatorAction, setOperatorAction] = useState(null);
  const [activeDefectIdx, setActiveDefectIdx] = useState(0);
  const fileInputRef = useRef(null);

  const isDefect = currentInspection?.status === 'DEFECT DETECTED';
  const isPass = currentInspection?.status === 'PASSED';
  const isLowConfidence = currentInspection?.status === 'LOW CONFIDENCE' || currentInspection?.status === 'IMAGE ERROR';
  const defects = currentInspection?.defects || [];
  const primaryDefect = defects[activeDefectIdx] || defects[0] || null;
  const imgAnalysis = currentInspection?.imageAnalysis || {};

  const usbDetails = getUsbStatusDetails(scannerState);
  const displayImage = liveScannedImage || currentInspection?.image;

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setOperatorAction(null);
      setActiveDefectIdx(0);
      onUploadCustomScan(file);
      e.target.value = '';
    }
  };

  return (
    <div className="live-inspection-container">
      {/* ── Top Scanner Ingest Bar with Dedicated Scanner Status Area ── */}
      <div className="scanner-simulator-bar">
        {/* Scanner Device Connection Status Area (Clickable to open USB Device Manager) */}
        <div 
          className="scanner-device-status-box scanner-device-status-box-clickable" 
          id="scanner-device-status-area"
          onClick={onOpenUsbModal}
          title="Click to open USB Scanner Device Manager"
          role="button"
          tabIndex={0}
        >
          <div className="scanner-device-status-header mono">
            <Usb size={13} className="text-cyan" />
            <span>SCANNER DEVICE</span>
            <span className="scanner-manage-tag mono">CONFIG ›</span>
          </div>
          <div className="scanner-device-status-main">
            <span className={`scanner-connection-indicator ${usbDetails.dotClass}`} />
            <span className={`scanner-connection-headline mono font-bold ${
              scannerState?.status === 'CONNECTED' ? 'text-emerald' :
              scannerState?.status === 'TRANSFERRING' ? 'text-cyan' :
              scannerState?.status === 'CONNECTING' ? 'text-amber' :
              scannerState?.status === 'ERROR' ? 'text-rose' : 'text-muted'
            }`}>
              {usbDetails.headline}
            </span>
          </div>
          <div className="scanner-connection-subtext mono">
            {usbDetails.subtext}
          </div>
        </div>

        {/* Action Controls: Master Reference + Connect USB + Manual Upload Button */}
        <div className="sim-presets-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            className={`btn btn-sm ${scannerState?.status === 'CONNECTED' ? 'btn-secondary' : 'btn-primary'}`}
            onClick={onOpenUsbModal}
            id="live-connect-usb-btn"
            title="Connect or configure USB mobile scanner"
          >
            <Usb size={14} className={scannerState?.status === 'CONNECTED' ? 'text-emerald' : 'text-cyan'} />
            {scannerState?.status === 'CONNECTED' ? 'USB Linked' : 'Connect USB Scanner'}
          </button>

          {referenceInfo?.exists && (
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                background: 'rgba(255,255,255,0.04)', 
                padding: '6px 12px', 
                borderRadius: '4px', 
                border: '1px solid var(--border-subtle)', 
                cursor: 'pointer' 
              }}
              onClick={() => onNavigate && onNavigate('settings')}
              title="Click to view or replace master clean reference baseline in Settings"
            >
              {referenceInfo.url && (
                <img 
                  src={referenceInfo.url} 
                  alt="Ref" 
                  style={{ width: '18px', height: '18px', borderRadius: '2px', objectFit: 'cover' }} 
                />
              )}
              <span className="mono" style={{ fontSize: '11px', color: 'var(--cyan-accent)' }}>
                BASELINE: {referenceInfo.filename || 'notebook_clean_reference.jpg'}
              </span>
              <span className="badge badge-pass mono" style={{ fontSize: '9px', padding: '1px 5px' }}>REFERENCE ACTIVE</span>
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="image/*" 
            style={{ display: 'none' }} 
          />
          <button 
            className="btn btn-secondary btn-sm"
            disabled={isProcessing}
            onClick={() => fileInputRef.current?.click()}
            id="upload-scan-btn"
          >
            <UploadCloud size={14} />
            {isProcessing ? 'Comparing Against Reference...' : 'Upload / Scan Notebook Photo'}
          </button>
        </div>
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div className="inspection-workspace-grid">

        {/* ══════════════════════════════════════════════════════
            LEFT COLUMN: Image Viewport
        ══════════════════════════════════════════════════════ */}
        <div className="inspection-viewport-panel">
          <div className="viewport-header">
            <div className="viewport-title-group">
              <Crosshair size={15} className="text-cyan" />
              <span>SCANNED NOTEBOOK SPECIMEN</span>
              {imgAnalysis.width && (
                <span className="mono viewport-res">
                  {imgAnalysis.width} × {imgAnalysis.height}px
                </span>
              )}
            </div>
            <div className="viewport-toolbar">
              <button 
                className={`btn-tool ${showOverlays ? 'active' : ''}`}
                onClick={() => setShowOverlays(!showOverlays)}
                title="Toggle Defect Bounding Boxes"
              >
                {showOverlays ? <Eye size={13} /> : <EyeOff size={13} />}
                <span>OVERLAY</span>
              </button>
              <button className="btn-tool" onClick={() => setZoomLevel(l => Math.min(l + 0.25, 2.5))} title="Zoom In">
                <ZoomIn size={13} />
              </button>
              <button className="btn-tool" onClick={() => setZoomLevel(l => Math.max(l - 0.25, 0.5))} title="Zoom Out">
                <ZoomOut size={13} />
              </button>
              <button className="btn-tool" onClick={() => setZoomLevel(1)} title="Reset">
                <RotateCcw size={13} />
              </button>
            </div>
          </div>

          {/* Live Scan Stream Transition Banners */}
          {streamStatus === 'RECEIVED' && (
            <div className="stream-live-banner stream-received-state mono">
              <Zap size={14} className="text-cyan animate-pulse" />
              <span>SCANNED IMAGE RECEIVED</span>
            </div>
          )}
          {(streamStatus === 'ANALYZING' || (isProcessing && streamStatus !== 'FAILED')) && (
            <div className="stream-live-banner stream-analyzing-state mono">
              <ScanLine size={14} className="text-cyan" />
              <span>ANALYZING...</span>
            </div>
          )}
          {streamStatus === 'FAILED' && (
            <div className="stream-live-banner stream-failed-state mono">
              <AlertOctagon size={14} className="text-rose" />
              <span>SCAN TRANSFER FAILED: {streamError || 'Connection error'}</span>
              {onRetry && (
                <button className="btn-stream-retry mono" onClick={onRetry}>
                  RETRY
                </button>
              )}
            </div>
          )}

          {/* Interactive Inspection Canvas */}
          <div className="viewport-canvas-container">
            <div 
              className="viewport-image-wrapper"
              style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.15s ease' }}
            >
              {displayImage ? (
                <img 
                  src={displayImage} 
                  alt="Scanned Notebook Specimen" 
                  className="scanned-product-image"
                />
              ) : (
                <div className="viewport-placeholder mono">
                  <Smartphone size={36} className="text-cyan" />
                  <div>AWAITING NOTEBOOK SCAN</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 12px' }}>
                    {scannerState?.status === 'CONNECTED' 
                      ? 'VIZORIS Mobile Scanner Connected — capture notebook to begin instant inspection' 
                      : 'Connect mobile scanner via USB or upload a notebook image'}
                  </div>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadCloud size={14} /> Select Notebook Image
                  </button>
                </div>
              )}

              {/* REAL DEFECT BOUNDING BOX OVERLAYS */}
              {!isProcessing && showOverlays && isDefect && !liveScannedImage && defects.map((defect, idx) => {
                const bbox = defect.bbox || { x: 30, y: 30, width: 20, height: 15 };
                const isActive = idx === activeDefectIdx;
                return (
                  <div 
                    key={idx}
                    className={`defect-bounding-box-overlay ${isActive ? 'defect-overlay-active' : ''}`}
                    style={{
                      left: `${bbox.x}%`,
                      top: `${bbox.y}%`,
                      width: `${bbox.width}%`,
                      height: `${bbox.height}%`,
                      cursor: 'pointer'
                    }}
                    onClick={() => setActiveDefectIdx(idx)}
                  >
                    <div className="defect-overlay-tag">
                      <span className="defect-tag-type">{defect.label || defect.type}</span>
                      <span className="defect-tag-conf mono">{defect.confidence}%</span>
                    </div>
                  </div>
                );
              })}

              {/* PASS GREEN GLOW OVERLAY */}
              {!isProcessing && isPass && !liveScannedImage && (
                <div className="pass-overlay-glow" />
              )}
            </div>
          </div>

          {/* Viewport Footer Telemetry */}
          <div className="viewport-footer mono">
            <div>PRODUCT: Notebook</div>
            <div>ID: {currentInspection?.id || (liveScannedImage ? 'STREAMING...' : '—')}</div>
            <div>BLUR: {imgAnalysis.blurVariance !== undefined ? `${imgAnalysis.blurVariance} LaplacVar` : '—'}</div>
            <div>TIME: {currentInspection?.timestamp ? new Date(currentInspection.timestamp).toLocaleTimeString() : '—'}</div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            RIGHT COLUMN: AI Analysis Results
        ══════════════════════════════════════════════════════ */}
        <div className="inspection-results-panel">

          {/* ── Active 10-Step AI Processing Timeline ── */}
          {isProcessing ? (
            <div className="processing-sequence-card">
              <div className="seq-header">
                <div className="seq-badge mono">
                  <Activity size={13} className="text-cyan" /> AI COMPUTER VISION PIPELINE
                </div>
                <div className="seq-percent mono">{Math.round((processingStep / 10) * 100)}%</div>
              </div>
              <div className="seq-title">Analyzing Scanned Notebook Specimen...</div>
              <div className="seq-progress-bar-wrapper">
                <div 
                  className="seq-progress-bar-fill"
                  style={{ width: `${(processingStep / 10) * 100}%` }}
                />
              </div>
              <div className="seq-steps-list">
                {PROCESSING_STEPS_INFO.map((stepItem) => {
                  const isDone = processingStep > stepItem.step;
                  const isCurrent = processingStep === stepItem.step;
                  return (
                    <div 
                      key={stepItem.step}
                      className={`seq-step-row ${isCurrent ? 'current' : ''} ${isDone ? 'done' : ''}`}
                    >
                      <div className="step-num mono">
                        {isDone ? '✓' : `0${stepItem.step}`}
                      </div>
                      <div>
                        <div className="step-name">{stepItem.name}</div>
                        {isCurrent && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                            {stepItem.desc}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              {/* ── Failed Inspection Banner ── */}
              {streamStatus === 'FAILED' && (
                <div className="result-banner defect-banner">
                  <div className="banner-left">
                    <AlertTriangle size={26} className="text-rose" />
                    <div>
                      <div className="banner-verdict text-rose">INSPECTION FAILED</div>
                      <div className="banner-sub mono">{streamError || 'Vision engine pipeline failed to analyze notebook image'}</div>
                    </div>
                  </div>
                  {onRetry && (
                    <button className="btn btn-secondary btn-sm" onClick={onRetry} style={{ marginLeft: 'auto' }}>
                      <RotateCcw size={13} /> RETRY
                    </button>
                  )}
                </div>
              )}

              {/* ── No Inspection Placeholder ── */}
              {!currentInspection && streamStatus !== 'FAILED' && (
                <div className="result-banner">
                  <div className="banner-left">
                    <Info size={26} className="text-muted" />
                    <div>
                      <div className="banner-verdict">NO ACTIVE INSPECTION</div>
                      <div className="banner-sub mono">Upload a notebook photo or connect the USB scanner to begin AI analysis.</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Verdict Banner ── */}
              {isDefect && (
                <div className="result-banner defect-banner">
                  <div className="banner-left">
                    <ShieldAlert size={26} className="text-rose" />
                    <div>
                      <div className="banner-verdict text-rose">DEFECT DETECTED</div>
                      <div className="banner-sub mono">{currentInspection.diagnosticMessage}</div>
                    </div>
                  </div>
                  <QualityRing score={currentInspection.qualityScore} />
                </div>
              )}
              {isPass && (
                <div className="result-banner pass-banner">
                  <div className="banner-left">
                    <ShieldCheck size={26} className="text-emerald" />
                    <div>
                      <div className="banner-verdict text-emerald">QUALITY PASSED</div>
                      <div className="banner-sub mono">{currentInspection.diagnosticMessage}</div>
                    </div>
                  </div>
                  <QualityRing score={currentInspection.qualityScore} />
                </div>
              )}
              {isLowConfidence && (
                <div className="result-banner warn-banner">
                  <div className="banner-left">
                    <HelpCircle size={26} className="text-amber" />
                    <div>
                      <div className="banner-verdict text-amber">LOW CONFIDENCE — MANUAL REVIEW</div>
                      <div className="banner-sub mono">{currentInspection.diagnosticMessage}</div>
                    </div>
                  </div>
                  <div className="banner-score mono">
                    <div className="score-num text-amber">N/A</div>
                    <div className="score-title">MANUAL QA</div>
                  </div>
                </div>
              )}

              {/* ── D. AI Image Analysis Metrics ── */}
              {currentInspection && (
                <div className="ai-metrics-card">
                  <div className="ai-metrics-header">
                    <Cpu size={14} className="text-cyan" />
                    <span className="mono">AI IMAGE ANALYSIS TELEMETRY</span>
                    <span className="badge badge-cyan mono" style={{ marginLeft: 'auto' }}>
                      PRODUCT = NOTEBOOK
                    </span>
                  </div>
                  <div className="ai-metrics-grid">
                    <div className="ai-metric-item">
                      <div className="ai-metric-label mono">INSPECTION ID</div>
                      <div className="ai-metric-value highlight mono">{currentInspection.id}</div>
                    </div>
                    <div className="ai-metric-item">
                      <div className="ai-metric-label mono">AI CONFIDENCE</div>
                      <div className="ai-metric-value">
                        <ConfidenceBar value={currentInspection.confidence} />
                      </div>
                    </div>
                    <div className="ai-metric-item">
                      <div className="ai-metric-label mono">BLUR VARIANCE</div>
                      <div className="ai-metric-value mono" style={{ 
                        color: (imgAnalysis.blurVariance || 0) < 30 ? 'var(--status-warn)' : 'var(--status-pass)' 
                      }}>
                        {imgAnalysis.blurVariance !== undefined ? `${imgAnalysis.blurVariance}` : '—'}
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                          (LaplacVar)
                        </span>
                      </div>
                    </div>
                    <div className="ai-metric-item">
                      <div className="ai-metric-label mono">MEAN BRIGHTNESS</div>
                      <div className="ai-metric-value mono">{imgAnalysis.meanBrightness !== undefined ? `${imgAnalysis.meanBrightness} / 255` : '—'}</div>
                    </div>
                    <div className="ai-metric-item">
                      <div className="ai-metric-label mono">IMAGE CONTRAST</div>
                      <div className="ai-metric-value mono">{imgAnalysis.contrast !== undefined ? `${imgAnalysis.contrast} σ` : '—'}</div>
                    </div>
                    <div className="ai-metric-item">
                      <div className="ai-metric-label mono">DEFECTS FOUND</div>
                      <div className="ai-metric-value mono" style={{ 
                        color: defects.length > 0 ? 'var(--status-defect)' : 'var(--status-pass)' 
                      }}>
                        {defects.length > 0 ? `${defects.length} NON-CONFORMANCE${defects.length > 1 ? 'S' : ''}` : '0 — ZERO DEFECT'}
                      </div>
                    </div>
                    <div className="ai-metric-item">
                      <div className="ai-metric-label mono">SEVERITY LEVEL</div>
                      <div className="ai-metric-value">
                        <SeverityBadge severity={currentInspection.severity || 'NOMINAL'} />
                      </div>
                    </div>
                    <div className="ai-metric-item">
                      <div className="ai-metric-label mono">STRUCTURAL SIMILARITY</div>
                      <div className="ai-metric-value mono text-cyan">
                        {imgAnalysis.meanSsim !== undefined ? `${(imgAnalysis.meanSsim * 100).toFixed(1)}% SSIM` : '100% SSIM'}
                      </div>
                    </div>
                    <div className="ai-metric-item">
                      <div className="ai-metric-label mono">ALIGNMENT METHOD</div>
                      <div className="ai-metric-value mono" style={{ fontSize: '11px' }}>
                        {imgAnalysis.alignmentMethod || 'ORB_HOMOGRAPHY'}
                      </div>
                    </div>
                    <div className="ai-metric-item">
                      <div className="ai-metric-label mono">DATA SOURCE</div>
                      <div className="ai-metric-value mono" style={{ fontSize: '11px' }}>
                        {currentInspection.scannerSource || 'USB MOBILE SCANNER'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── E. Defect Detail Cards (per defect) ── */}
              {isDefect && defects.length > 0 && (
                <div className="defect-detail-section">
                  <div className="defect-detail-section-header">
                    <AlertOctagon size={14} className="text-rose" />
                    <span className="mono">DETECTED NON-CONFORMANCES ({defects.length})</span>
                    {defects.length > 1 && (
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                        {defects.map((_, i) => (
                          <button
                            key={i}
                            className={`defect-tab-btn ${i === activeDefectIdx ? 'active' : ''}`}
                            onClick={() => setActiveDefectIdx(i)}
                          >
                            DEF-{(i + 1).toString().padStart(2, '0')}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {primaryDefect && (
                    <div className="defect-detail-card">
                      <div className="defect-card-row">
                        <div>
                          <div className="defect-card-type">{primaryDefect.label || primaryDefect.type}</div>
                          <div className="defect-card-location mono">
                            <Target size={11} style={{ display: 'inline', marginRight: '4px' }} />
                            {primaryDefect.location || 'Surface area'}
                          </div>
                        </div>
                        <SeverityBadge severity={primaryDefect.severity} />
                      </div>
                      <div className="defect-card-description">{primaryDefect.description}</div>
                      <div className="defect-card-confidence-row">
                        <span className="defect-conf-label mono">DETECTION CONFIDENCE</span>
                        <ConfidenceBar value={primaryDefect.confidence} />
                      </div>
                      {primaryDefect.suggestedAction && (
                        <div className="defect-card-action">
                          <ChevronRight size={12} className="text-cyan" />
                          <span>{primaryDefect.suggestedAction}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── F. QA Disposition Panel ── */}
              {currentInspection && (
                <div className="qa-action-panel">
                  <div className="qa-action-title">QUALITY ASSURANCE DISPOSITION</div>
                  {operatorAction && (
                    <div className="operator-action-confirmed mono text-cyan">
                      ✓ LOGGED: {operatorAction}
                    </div>
                  )}
                  <div className="qa-action-buttons">
                    <button 
                      className={`btn btn-success ${operatorAction?.includes('RELEASED') ? 'btn-active-state' : ''}`}
                      onClick={() => setOperatorAction('RELEASED — PASS APPROVED')}
                    >
                      <CheckCircle2 size={14} /> Accept & Release
                    </button>
                    <button 
                      className={`btn btn-danger ${operatorAction?.includes('REJECTED') ? 'btn-active-state' : ''}`}
                      onClick={() => setOperatorAction('REJECTED — QUARANTINED AS SCRAP')}
                    >
                      <AlertTriangle size={14} /> Reject (Scrap)
                    </button>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => setOperatorAction('ROUTED — MANUAL REWORK LINE')}
                    >
                      Route to Rework
                    </button>
                    <button 
                      className="btn btn-primary"
                      onClick={() => onOpenPassport(currentInspection)}
                    >
                      <FileCheck size={14} /> Digital Passport
                    </button>
                  </div>
                </div>
              )}

              {/* ── G. Root Cause & Prediction Summary ── */}
              {currentInspection && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {/* Root Cause */}
                  <div className="sub-analysis-card">
                    <div className="sub-card-title">
                      <span>ROOT-CAUSE ANALYSIS</span>
                      <span className="badge badge-cyan mono">CORRELATION</span>
                    </div>
                    <div className="sub-card-text">
                      {currentInspection.rootCause ? (
                        <>
                          <div>Probable process: <strong>{currentInspection.rootCause.process}</strong></div>
                          {currentInspection.rootCause.probableCause && (
                            <div className="sub-card-sub mono" style={{ marginTop: '4px' }}>
                              {currentInspection.rootCause.probableCause}
                            </div>
                          )}
                          <div className="sub-card-sub mono">{currentInspection.rootCause.disclaimer}</div>
                        </>
                      ) : (
                        <div className="text-muted mono">No defect detected — no root cause required.</div>
                      )}
                    </div>
                  </div>

                  {/* Predictive */}
                  <div className="sub-analysis-card">
                    <div className="sub-card-title">
                      <span>PREDICTIVE QUALITY</span>
                      <span className={`badge mono ${
                        currentInspection.prediction?.riskLevel === 'HIGH' ? 'badge-defect' :
                        currentInspection.prediction?.riskLevel === 'MEDIUM' ? 'badge-warn' : 'badge-pass'
                      }`}>
                        {currentInspection.prediction?.riskLevel || 'LOW'}
                      </span>
                    </div>
                    <div className="sub-card-text">
                      <div>{currentInspection.prediction?.earlyWarning || 'Operating within standard parameters.'}</div>
                      <div className="sub-card-sub mono">
                        {currentInspection.prediction?.recommendedAction || 'Continue monitoring notebook line.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
