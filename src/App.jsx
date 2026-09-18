// src/App.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { OverviewView } from './components/OverviewView';
import { LiveInspectionView } from './components/LiveInspectionView';
import { InspectionHistoryView } from './components/InspectionHistoryView';
import { QualityAnalyticsView } from './components/QualityAnalyticsView';
import { RootCauseView } from './components/RootCauseView';
import { PredictionsView } from './components/PredictionsView';
import { DigitalPassportView } from './components/DigitalPassportView';
import { SettingsView } from './components/SettingsView';
import { InspectionDetailModal } from './components/InspectionDetailModal';
import { UsbDeviceModal } from './components/UsbDeviceModal';
import './App.css';

export default function App() {
  // Live Inspection is the main hero screen per product requirements
  const [activeTab, setActiveTab] = useState('live');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showUsbModal, setShowUsbModal] = useState(false);

  // Core Data States (Strictly initialized to real data, zero fake seeds)
  const [scannerState, setScannerState] = useState({
    status: 'DISCONNECTED',
    deviceName: 'No Scanner Connected',
    batteryLevel: null,
    connectionType: 'USB / ADB Bridge'
  });

  const [metrics, setMetrics] = useState({
    totalInspected: 0,
    passed: 0,
    defective: 0,
    defectRate: 0,
    avgQualityScore: null,
    categoryCounts: {},
    hasRealData: false
  });

  const [inspections, setInspections] = useState([]);
  const [currentInspection, setCurrentInspection] = useState(null);
  const [modalInspection, setModalInspection] = useState(null);
  const [referenceInfo, setReferenceInfo] = useState(null);

  // Live Scan Streaming States
  const [liveScannedImage, setLiveScannedImage] = useState(null);
  const [streamStatus, setStreamStatus] = useState('IDLE'); // 'IDLE' | 'RECEIVED' | 'ANALYZING' | 'COMPLETE' | 'FAILED'
  const [streamError, setStreamError] = useState(null);
  const lastUploadedFileRef = useRef(null);

  // 10-Step AI Processing Animation State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(1);

  // Real-time notifications
  const [notifications, setNotifications] = useState([]);

  // WebSocket reference
  const wsRef = useRef(null);

  // Fetch real data from server
  const loadInitialData = useCallback(async () => {
    try {
      const [mRes, iRes, sRes, rRes] = await Promise.all([
        fetch('/api/metrics').then(r => r.json()),
        fetch('/api/inspections').then(r => r.json()),
        fetch('/api/scanner/status').then(r => r.json()),
        fetch('/api/reference/info').then(r => r.json()).catch(() => null)
      ]);

      if (mRes) setMetrics(mRes);
      if (iRes?.inspections) {
        setInspections(iRes.inspections);
        setCurrentInspection(prev => prev || iRes.inspections[0] || null);
      }
      if (sRes) setScannerState(sRes);
      if (rRes) setReferenceInfo(rRes);
    } catch (err) {
      console.warn('[VIZORIS UI] Data load warning:', err);
    }
  }, []);

  // Handle incoming real-time WebSocket events
  const handleWsEvent = useCallback((msg) => {
    switch (msg.event) {
      case 'INIT_STATE':
        if (msg.data?.reference) setReferenceInfo(msg.data.reference);
        if (msg.data?.scanner) setScannerState(msg.data.scanner);
        break;

      case 'REFERENCE_UPDATED':
        setReferenceInfo(msg.data);
        setNotifications(prev => [
          {
            title: 'CLEAN REFERENCE UPDATED',
            message: `Baseline reference updated (${msg.data.filename}). Future inspections will compare against this standard.`,
            type: 'info',
            time: 'Just now'
          },
          ...prev.slice(0, 4)
        ]);
        break;

      case 'SCANNER_STATUS_CHANGED':
        setScannerState(msg.data);
        break;

      case 'NEW_SCAN_RECEIVED':
        setLiveScannedImage(msg.data.image);
        setStreamStatus('RECEIVED');
        setStreamError(null);
        setIsProcessing(true);
        setProcessingStep(1);
        setActiveTab('live'); // Automatically switch to Live Inspection workspace
        setNotifications(prev => [
          {
            title: 'SCANNED IMAGE RECEIVED',
            message: `Ingested ${msg.data.scannerSource || 'USB scanner'} notebook scan. Initiating AI surface analysis...`,
            type: 'info',
            time: 'Just now'
          },
          ...prev.slice(0, 4)
        ]);
        break;

      case 'PROCESSING_STEP':
        setIsProcessing(true);
        setStreamStatus('ANALYZING');
        setProcessingStep(msg.data.step);
        break;

      case 'INSPECTION_COMPLETED':
        setIsProcessing(false);
        setProcessingStep(10);
        setStreamStatus('COMPLETE');
        setLiveScannedImage(null); // Transition seamlessly to currentInspection
        setCurrentInspection(msg.data.inspection);
        if (msg.data.metrics) setMetrics(msg.data.metrics);
        setInspections(prev => [msg.data.inspection, ...prev.filter(i => i.id !== msg.data.inspection.id)]);
        
        if (msg.data.inspection.status === 'DEFECT DETECTED') {
          setNotifications(prev => [
            {
              title: `DEFECT DETECTED: ${msg.data.inspection.id}`,
              message: `${msg.data.inspection.defects?.[0]?.label || 'Non-conformance'} (${msg.data.inspection.defects?.[0]?.severity || 'FLAGGED'})`,
              type: 'defect',
              time: 'Just now'
            },
            ...prev.slice(0, 4)
          ]);
        }
        break;

      case 'INSPECTION_FAILED':
        setIsProcessing(false);
        setStreamStatus('FAILED');
        setStreamError(msg.data.error || 'Inspection failed');
        setNotifications(prev => [
          {
            title: 'INSPECTION FAILED',
            message: msg.data.error || 'Computer vision pipeline failed to process image',
            type: 'defect',
            time: 'Just now'
          },
          ...prev.slice(0, 4)
        ]);
        break;

      case 'INSPECTION_UPDATED':
        setInspections(prev => prev.map(i => i.id === msg.data.id ? msg.data : i));
        setCurrentInspection(prev => prev?.id === msg.data.id ? msg.data : prev);
        break;

      case 'DATA_RESET':
        loadInitialData();
        setCurrentInspection(null);
        setLiveScannedImage(null);
        setStreamStatus('IDLE');
        break;

      default:
        break;
    }
  }, [loadInitialData]);

  // WebSocket Connection
  useEffect(() => {
    loadInitialData();

    const wsPort = window.location.port === '5173' ? '5000' : window.location.port;
    const wsUrl = `ws://${window.location.hostname}:${wsPort}/ws`;

    const connectWs = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[VIZORIS WS] Connected to backend');
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            handleWsEvent(msg);
          } catch (e) {
            console.error('[VIZORIS WS] Parse error:', e);
          }
        };

        ws.onclose = () => {
          console.log('[VIZORIS WS] Connection closed, reconnecting in 3s...');
          setTimeout(connectWs, 3000);
        };

        ws.onerror = (err) => {
          console.warn('[VIZORIS WS] Connection error:', err);
        };
      } catch (err) {
        console.warn('[VIZORIS WS] Init failed:', err);
      }
    };

    connectWs();

    // Fallback data sync interval (strictly queries read-only status, no fake heartbeat)
    const pollInterval = setInterval(() => {
      loadInitialData();
    }, 6000);

    return () => {
      clearInterval(pollInterval);
      if (wsRef.current) wsRef.current.close();
    };
  }, [loadInitialData, handleWsEvent]);

  // Upload Custom / Mobile Scan via File Input
  const handleUploadCustomScan = async (file) => {
    lastUploadedFileRef.current = file;
    setIsProcessing(true);
    setStreamStatus('RECEIVED');
    setStreamError(null);
    setProcessingStep(1);
    setActiveTab('live');

    // Immediate local image preview
    try {
      const localUrl = URL.createObjectURL(file);
      setLiveScannedImage(localUrl);
    } catch (e) {
      // fallback
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('scannerSource', 'DESKTOP_WEB_UPLOAD');

    try {
      const res = await fetch('/api/scan/upload', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Upload returned status ${res.status}`);
      }
    } catch (err) {
      console.error('[VIZORIS UI] File upload error:', err);
      setIsProcessing(false);
      setStreamStatus('FAILED');
      setStreamError(err.message || 'Scan upload failed');
    }
  };

  // Select inspection for Live view
  const handleSelectInspection = (item) => {
    setCurrentInspection(item);
    setActiveTab('live');
  };

  // Open inspection in passport
  const handleOpenPassport = (item) => {
    setCurrentInspection(item);
    setActiveTab('passport');
  };

  // Upload / Replace Clean Reference Image
  const handleUpdateReference = async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await fetch('/api/reference/upload', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error(`Upload failed with status ${res.status}`);
      const data = await res.json();
      if (data.reference) {
        setReferenceInfo(data.reference);
      }
      return data;
    } catch (err) {
      console.error('[VIZORIS UI] Reference upload error:', err);
      throw err;
    }
  };

  // Reset database cleanly
  const handleResetData = async () => {
    if (window.confirm('Clear all stored real inspections and reset metrics to zero?')) {
      try {
        await fetch('/api/reset-data', { method: 'POST' });
        loadInitialData();
      } catch (err) {
        console.error('[VIZORIS UI] Reset failed:', err);
      }
    }
  };

  // Connect USB Scanner Device
  const handleConnectUsbDevice = async (device) => {
    try {
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
      if (!res.ok) throw new Error('Failed to connect USB device');
      const data = await res.json();
      if (data.scanner) {
        setScannerState(data.scanner);
        setNotifications(prev => [
          {
            title: 'USB SCANNER CONNECTED',
            message: `${data.scanner.deviceName} is ready for live notebook inspection.`,
            type: 'info',
            time: 'Just now'
          },
          ...prev.slice(0, 4)
        ]);
      }
    } catch (err) {
      console.error('[VIZORIS UI] Connect device error:', err);
      throw err;
    }
  };

  // Disconnect USB Scanner Device
  const handleDisconnectUsbDevice = async () => {
    try {
      const res = await fetch('/api/usb/disconnect', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to disconnect USB device');
      const data = await res.json();
      if (data.scanner) {
        setScannerState(data.scanner);
        setNotifications(prev => [
          {
            title: 'USB SCANNER DISCONNECTED',
            message: 'Scanner device was disconnected by operator.',
            type: 'info',
            time: 'Just now'
          },
          ...prev.slice(0, 4)
        ]);
      }
    } catch (err) {
      console.error('[VIZORIS UI] Disconnect error:', err);
      throw err;
    }
  };

  return (
    <div className="app-layout">
      {/* Top Header */}
      <Header 
        scannerState={scannerState} 
        onRefreshData={loadInitialData}
        notifications={notifications}
        onOpenUsbModal={() => setShowUsbModal(true)}
      />

      {/* Main Body */}
      <div className="app-body">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          scannerState={scannerState}
          onOpenUsbModal={() => setShowUsbModal(true)}
        />

        <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          {activeTab === 'overview' && (
            <OverviewView 
              metrics={metrics}
              scannerState={scannerState}
              recentInspections={inspections}
              onSelectInspection={handleSelectInspection}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'live' && (
            <LiveInspectionView 
              currentInspection={currentInspection}
              referenceInfo={referenceInfo}
              scannerState={scannerState}
              liveScannedImage={liveScannedImage}
              streamStatus={streamStatus}
              streamError={streamError}
              isProcessing={isProcessing}
              processingStep={processingStep}
              onUploadCustomScan={handleUploadCustomScan}
              onOpenPassport={handleOpenPassport}
              onNavigate={setActiveTab}
              onOpenUsbModal={() => setShowUsbModal(true)}
              onRetry={() => {
                if (lastUploadedFileRef.current) {
                  handleUploadCustomScan(lastUploadedFileRef.current);
                }
              }}
            />
          )}

          {activeTab === 'history' && (
            <InspectionHistoryView 
              inspections={inspections}
              onSelectInspection={item => setModalInspection(item)}
              onOpenPassport={handleOpenPassport}
            />
          )}

          {activeTab === 'analytics' && (
            <QualityAnalyticsView 
              metrics={metrics}
              inspections={inspections}
            />
          )}

          {activeTab === 'rootcause' && (
            <RootCauseView 
              currentInspection={currentInspection}
            />
          )}

          {activeTab === 'predictions' && (
            <PredictionsView 
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'passport' && (
            <DigitalPassportView 
              inspection={currentInspection}
              allInspections={inspections}
              onSelectPassport={setCurrentInspection}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView 
              scannerState={scannerState}
              referenceInfo={referenceInfo}
              onUpdateReference={handleUpdateReference}
              onResetData={handleResetData}
            />
          )}
        </main>
      </div>

      {/* Inspection Detail Modal */}
      {modalInspection && (
        <InspectionDetailModal 
          inspection={modalInspection}
          onClose={() => setModalInspection(null)}
          onOpenPassport={handleOpenPassport}
          onNavigateToLive={handleSelectInspection}
        />
      )}

      {/* USB Scanner Device Manager Modal */}
      <UsbDeviceModal 
        isOpen={showUsbModal}
        onClose={() => setShowUsbModal(false)}
        scannerState={scannerState}
        onConnectDevice={handleConnectUsbDevice}
        onDisconnectDevice={handleDisconnectUsbDevice}
      />
    </div>
  );
}
