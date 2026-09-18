// src/components/PredictionsView.jsx
import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  ShieldAlert, 
  Clock, 
  Zap 
} from 'lucide-react';

export function PredictionsView({ onNavigate }) {
  const [predictionData, setPredictionData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/predictions')
      .then(res => res.json())
      .then(data => {
        setPredictionData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load predictions:', err);
        setLoading(false);
      });
  }, []);

  const hasData = predictionData?.sufficientData;
  const ew = predictionData?.earlyWarning;
  const forecast = predictionData?.forecastCycles || [];

  return (
    <div className="predictions-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div className="history-filter-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <TrendingUp size={20} className="text-cyan" />
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              PREDICTIVE QUALITY ANALYSIS & EARLY WARNING
            </div>
            <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Quality drift projection derived from verified notebook inspection history
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Evaluating inspection trend lines...
        </div>
      ) : !hasData ? (
        /* Honest Insufficient Historical Data Notice */
        <div className="empty-state-banner">
          <Clock size={36} className="text-cyan" style={{ margin: '0 auto 12px' }} />
          <div className="empty-state-title">
            Insufficient Historical Data for Reliable Prediction
          </div>
          <p className="empty-state-sub">
            {predictionData?.note || 'A minimum of 5 real notebook inspections are required to calculate regression curves and early warning alerts.'}
          </p>
          <button 
            className="btn btn-primary"
            onClick={() => onNavigate('live')}
          >
            Scan Notebooks in Live Inspection
          </button>
        </div>
      ) : (
        /* Real Predictive Early Warning & Forecast */
        <>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldAlert size={20} className={ew.active ? 'text-amber' : 'text-emerald'} />
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {ew.headline}
                </span>
              </div>
              <span className={`badge ${ew.riskLevel === 'HIGH' ? 'badge-defect' : (ew.riskLevel === 'MEDIUM' ? 'badge-warn' : 'badge-pass')}`}>
                RISK LEVEL: {ew.riskLevel}
              </span>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              {ew.summary}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>CURRENT DEFECT RATE</div>
                <div className="mono font-bold" style={{ fontSize: '16px', color: ew.active ? 'var(--status-warn)' : 'var(--status-pass)' }}>
                  {ew.currentDefectRate}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>PREVIOUS DEFECT RATE</div>
                <div className="mono" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>
                  {ew.previousDefectRate}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>BATCH TREND</div>
                <div className="mono" style={{ fontSize: '16px', color: ew.active ? 'var(--status-defect)' : 'var(--text-muted)' }}>
                  {ew.currentBatchTrend}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>FUTURE DEFECT RISK</div>
                <div className="mono" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>
                  {ew.futureDefectRisk}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--cyan-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
              <Zap size={16} className="text-cyan" />
              <div style={{ fontSize: '12px' }}>
                <strong className="text-cyan">PREVENTIVE RECOMMENDATION:</strong> {ew.recommendedAction}
              </div>
            </div>
          </div>

          {/* Forecast Cycles Table */}
          {forecast.length > 0 && (
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>
                PROJECTED QUALITY CYCLES
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${forecast.length}, 1fr)`, gap: '12px' }}>
                {forecast.map((fc, idx) => (
                  <div key={idx} style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                      {fc.cycle}
                    </div>
                    <div className="mono font-bold" style={{ fontSize: '18px', color: fc.predictedDefectRate > fc.upperTolerance ? 'var(--status-defect)' : 'var(--status-pass)' }}>
                      {fc.predictedDefectRate}%
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Max Target: {fc.upperTolerance}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
