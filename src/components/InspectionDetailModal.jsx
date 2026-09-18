// src/components/InspectionDetailModal.jsx
import React from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle,
  FileCheck, 
  Crosshair,
  ArrowRight
} from 'lucide-react';

export function InspectionDetailModal({ inspection, onClose, onOpenPassport, onNavigateToLive }) {
  if (!inspection) return null;

  const isPass = inspection.status === 'PASSED';
  const isDefect = inspection.status === 'DEFECT DETECTED';
  const def = inspection.defects?.[0] || null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Crosshair size={18} className="text-cyan" />
            <div>
              <div className="modal-heading">
                INSPECTION SPECIMEN: {inspection.id}
              </div>
              <div className="mono text-muted" style={{ fontSize: '11px' }}>
                {new Date(inspection.timestamp).toLocaleString()} • Product: Notebook
              </div>
            </div>
          </div>

          <button className="btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body-grid">
          {/* Left: Specimen image with defect box */}
          <div>
            <div className="modal-image-frame">
              <img src={inspection.image} alt={inspection.id} className="modal-product-img" />

              {/* Real Defect Box */}
              {isDefect && def?.bbox && (
                <div 
                  className="defect-bounding-box-overlay"
                  style={{
                    left: `${def.bbox.x}%`,
                    top: `${def.bbox.y}%`,
                    width: `${def.bbox.width}%`,
                    height: `${def.bbox.height}%`
                  }}
                >
                  <div className="defect-overlay-tag">
                    <span>{def.label || def.type}</span>
                    <span className="mono">{def.confidence}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Specimen Details */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span className={`badge ${isPass ? 'badge-pass' : (isDefect ? 'badge-defect' : 'badge-warn')}`}>
                  {inspection.status}
                </span>
                <span className="badge badge-cyan mono">PRODUCT: NOTEBOOK</span>
              </div>

              <div className="modal-specs-table mono">
                <div className="modal-spec-row">
                  <span className="text-muted">INSPECTION ID:</span>
                  <span className="text-cyan font-bold">{inspection.id}</span>
                </div>
                <div className="modal-spec-row">
                  <span className="text-muted">QUALITY SCORE:</span>
                  <span className="font-bold">{inspection.qualityScore !== null ? `${inspection.qualityScore}%` : 'N/A'}</span>
                </div>
                <div className="modal-spec-row">
                  <span className="text-muted">SCAN TIMESTAMP:</span>
                  <span>{new Date(inspection.timestamp).toLocaleString()}</span>
                </div>
                <div className="modal-spec-row">
                  <span className="text-muted">DATA SOURCE:</span>
                  <span>{inspection.scannerSource || 'USB Mobile Scanner'}</span>
                </div>
                {isDefect && def && (
                  <>
                    <div className="modal-spec-row">
                      <span className="text-muted">DEFECT TYPE:</span>
                      <span className="text-rose font-bold">{def.label || def.type}</span>
                    </div>
                    <div className="modal-spec-row">
                      <span className="text-muted">LOCATION:</span>
                      <span>{def.location}</span>
                    </div>
                    <div className="modal-spec-row">
                      <span className="text-muted">CONFIDENCE:</span>
                      <span className="text-cyan">{def.confidence}%</span>
                    </div>
                  </>
                )}
              </div>

              {/* Root Cause snippet if defective */}
              {isDefect && inspection.rootCause && (
                <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '11px' }}>
                  <div className="mono text-cyan" style={{ marginBottom: '2px' }}>CONTRIBUTING PROCESS: {inspection.rootCause.process}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{inspection.rootCause.probableCause}</div>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="modal-footer-actions">
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => {
                  onClose();
                  onOpenPassport(inspection);
                }}
              >
                <FileCheck size={14} /> View Digital Passport
              </button>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  onClose();
                  onNavigateToLive(inspection);
                }}
              >
                Inspect in Live Workspace <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
