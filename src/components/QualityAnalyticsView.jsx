// src/components/QualityAnalyticsView.jsx
import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  PieChart, 
  Layers, 
  Percent, 
  Award,
  CheckCircle2,
  AlertOctagon,
  Info
} from 'lucide-react';

export function QualityAnalyticsView({ metrics, inspections = [] }) {
  const [dataMode, setDataMode] = useState('REAL'); // 'REAL' only by default

  const total = metrics?.totalInspections ?? metrics?.totalInspected ?? 0;
  const passed = metrics?.passedSpecimens ?? metrics?.passed ?? 0;
  const defective = metrics?.defectsDetected ?? metrics?.defective ?? 0;
  const lowConfidence = metrics?.lowConfidence || 0;
  const hasData = total > 0;

  const passPercent = hasData 
    ? `${metrics?.firstPassYield !== undefined ? metrics.firstPassYield : ((passed / total) * 100).toFixed(1)}%` 
    : '0%';
  const defectPercent = hasData 
    ? `${metrics?.defectRate !== undefined ? metrics.defectRate : ((defective / total) * 100).toFixed(1)}%` 
    : '0%';
  const avgQuality = hasData 
    ? `${metrics?.averageQualityScore ?? metrics?.avgQualityScore ?? 0}%` 
    : '0%';

  const categoryCounts = metrics?.categoryCounts || {};
  const categoryKeys = Object.keys(categoryCounts);

  return (
    <div className="analytics-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header & Real Data Indicator */}
      <div className="history-filter-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BarChart3 size={20} className="text-cyan" />
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              QUALITY ANALYTICS & STATISTICAL CONTROL
            </div>
            <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Computed strictly from verified physical notebook inspection records
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-cyan mono">
            DATA SOURCE: REAL SCANS ONLY
          </span>
        </div>
      </div>

      {/* Summary KPI row */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">TOTAL ANALYZED SCANS</span>
            <Layers size={16} className="text-cyan" />
          </div>
          <div className="kpi-value mono">{total}</div>
          <div className="kpi-subtext">Real mobile captures</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">YIELD (PASS RATE)</span>
            <CheckCircle2 size={16} className="text-emerald" />
          </div>
          <div className="kpi-value mono text-emerald">{passPercent}</div>
          <div className="kpi-subtext">{passed} conformant notebooks</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">DEFECT RATE</span>
            <AlertOctagon size={16} className="text-rose" />
          </div>
          <div className="kpi-value mono text-rose">{defectPercent}</div>
          <div className="kpi-subtext">{defective} non-conformant units</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">AVG QUALITY SCORE</span>
            <Award size={16} className="text-cyan" />
          </div>
          <div className="kpi-value mono">
            {avgQuality}
          </div>
          <div className="kpi-subtext">Scored from CV features</div>
        </div>
      </div>

      {/* Analytics Body */}
      {!hasData ? (
        <div className="empty-state-banner">
          <Info size={32} className="text-muted" style={{ margin: '0 auto 12px' }} />
          <div className="empty-state-title">Insufficient Real Data for Analytics</div>
          <p className="empty-state-sub">
            Analytics are generated exclusively from actual notebook scans stored in the database. Scan notebooks to view Pareto defect distributions and SPC charts.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Defect Category Breakdown from Real Scans */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieChart size={16} className="text-cyan" /> REAL DEFECT BREAKDOWN
            </div>

            {categoryKeys.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                Zero defects recorded across all completed scans.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {categoryKeys.map((catKey) => {
                  const count = categoryCounts[catKey];
                  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
                  return (
                    <div key={catKey}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{catKey}</span>
                        <span className="mono text-muted">{count} units ({pct}%)</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            width: `${pct}%`, 
                            height: '100%', 
                            background: '#0ea5e9' 
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pass vs Defect Ratio */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={16} className="text-emerald" /> CONFORMANCE RATIO
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--status-pass)', fontWeight: 600 }}>PASSED ZERO-DEFECT</span>
                  <span className="mono">{passed} ({passPercent}%)</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${passPercent}%`, height: '100%', background: 'var(--status-pass)' }}></div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--status-defect)', fontWeight: 600 }}>DEFECTIVE FLAGGED</span>
                  <span className="mono">{defective} ({defectPercent}%)</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${defectPercent}%`, height: '100%', background: 'var(--status-defect)' }}></div>
                </div>
              </div>

              {lowConfidence > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--status-warn)', fontWeight: 600 }}>LOW CONFIDENCE / RESCAN</span>
                    <span className="mono">{lowConfidence} ({((lowConfidence / total) * 100).toFixed(1)}%)</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${((lowConfidence / total) * 100).toFixed(1)}%`, height: '100%', background: 'var(--status-warn)' }}></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
