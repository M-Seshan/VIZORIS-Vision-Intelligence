// src/components/DigitalPassportView.jsx
import React, { useState } from 'react';
import { 
  Award, 
  ShieldCheck, 
  Printer, 
  Download, 
  Copy, 
  Check
} from 'lucide-react';

export function DigitalPassportView({ inspection, allInspections = [] }) {
  const [copied, setCopied] = useState(false);

  // Active record is the selected inspection or latest real inspection
  const activeRecord = inspection || allInspections[0] || null;

  if (!activeRecord) {
    return (
      <div className="empty-state-banner">
        <Award size={36} className="text-cyan" style={{ margin: '0 auto 12px' }} />
        <div className="empty-state-title">No Digital Quality Passport Available</div>
        <p className="empty-state-sub">
          Digital Passports are generated automatically for each verified notebook scan. Complete an inspection to generate a certificate.
        </p>
      </div>
    );
  }

  const isPass = activeRecord.status === 'PASSED';
  const isDefect = activeRecord.status === 'DEFECT DETECTED';
  const passport = activeRecord.passport || {
    passportId: `PASSPORT-${activeRecord.id}`,
    hash: 'SHA256-UNAVAILABLE',
    verifiedBy: 'VIZORIS Vision Intelligence Engine v2.4',
    issuedAt: activeRecord.timestamp
  };

  const handleCopyHash = () => {
    if (passport.hash) {
      navigator.clipboard.writeText(passport.hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeRecord, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `VIZORIS-PASSPORT-${activeRecord.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="passport-container">
      {/* Top Header Bar */}
      <div className="history-filter-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Award size={20} className="text-cyan" />
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              DIGITAL QUALITY PASSPORT & TRACEABILITY CERTIFICATE
            </div>
            <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Immutable inspection certificate tied to physical notebook specimen
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={handlePrint}>
            <Printer size={14} /> Print Certificate
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleExportJson}>
            <Download size={14} /> Export JSON
          </button>
        </div>
      </div>

      {/* Main Printable Certificate */}
      <div className="passport-certificate-wrapper">
        <div className="certificate-card printable">
          {/* Certificate Header */}
          <div className="cert-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ShieldCheck size={36} className="text-cyan" />
              <div>
                <div className="cert-brand">VIZORIS CERTIFIED</div>
                <div className="cert-brand-sub mono">ZERO-DEFECT NOTEBOOK QUALITY ASSURANCE RECORD</div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>CERTIFICATE ID</div>
              <div className="mono font-bold text-cyan" style={{ fontSize: '14px' }}>{passport.passportId}</div>
            </div>
          </div>

          {/* Certificate Content Grid */}
          <div className="cert-content-grid">
            {/* Left: Scanned Specimen Image */}
            <div>
              <div className="cert-image-frame">
                <img src={activeRecord.image} alt={activeRecord.id} className="cert-specimen-img" />
              </div>

              {/* SHA-256 Hash Box */}
              <div className="cert-qr-box">
                <div style={{ flex: 1 }}>
                  <div className="qr-label mono">CRYPTOGRAPHIC HASH:</div>
                  <div className="hash-string mono">{passport.hash}</div>
                </div>
                <button 
                  className="btn-icon" 
                  onClick={handleCopyHash}
                  title="Copy SHA-256 Verification Hash"
                  style={{ width: '28px', height: '28px' }}
                >
                  {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Right: Inspection Specs */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <span className={`badge ${isPass ? 'badge-pass' : (isDefect ? 'badge-defect' : 'badge-warn')}`}>
                    {activeRecord.status}
                  </span>
                  <span className="badge badge-cyan mono">PRODUCT = NOTEBOOK</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                  <div>
                    <span className="text-muted mono" style={{ fontSize: '10px', display: 'block' }}>PRODUCT IDENTIFIER</span>
                    <strong className="mono text-cyan">{activeRecord.id}</strong>
                  </div>
                  <div>
                    <span className="text-muted mono" style={{ fontSize: '10px', display: 'block' }}>QUALITY SCORE</span>
                    <strong className="mono">{activeRecord.qualityScore !== null ? `${activeRecord.qualityScore}%` : 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-muted mono" style={{ fontSize: '10px', display: 'block' }}>SCAN TIMESTAMP</span>
                    <span className="mono">{new Date(activeRecord.timestamp).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted mono" style={{ fontSize: '10px', display: 'block' }}>AI MODEL CONFIDENCE</span>
                    <span className="mono">{activeRecord.confidence ? `${activeRecord.confidence}%` : 'Low Confidence'}</span>
                  </div>
                </div>

                {/* Detected Defects Section */}
                <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div className="mono text-muted" style={{ fontSize: '10px', marginBottom: '6px' }}>
                    DEFECT TELEMETRY:
                  </div>
                  {activeRecord.defects && activeRecord.defects.length > 0 ? (
                    activeRecord.defects.map((d, idx) => (
                      <div key={idx} style={{ fontSize: '12px', marginBottom: '4px' }}>
                        <span className="text-rose font-bold">• {d.label || d.type}</span> ({d.severity}) — {d.location}
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '10px' }}>
                          {d.description}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--status-pass)' }}>
                      ✓ Zero visible manufacturing defects detected across sheet surface and margins.
                    </div>
                  )}
                </div>

                {/* Root Cause & Prediction Summary in Passport */}
                {activeRecord.rootCause && (
                  <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <strong>Root-Cause Correlation:</strong> {activeRecord.rootCause.process} ({activeRecord.rootCause.probableCause})
                  </div>
                )}
              </div>

              {/* Certificate Footer */}
              <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>VERIFIED BY: {passport.verifiedBy}</span>
                <span className="mono">ISSUED: {new Date(passport.issuedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
