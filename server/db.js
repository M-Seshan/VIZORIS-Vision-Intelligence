// server/db.js
// Persistent Storage for VIZORIS Real Notebook Quality Inspection System
// Supports MongoDB (via Mongoose) with automatic persistent JSON file fallback.
// NO FAKE OR SEED RECORDS: The real scanned notebook image is the single source of truth.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const REAL_DB_FILE = path.join(DATA_DIR, 'real_inspections.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// -------------------------------------------------------------
// MongoDB Mongoose Schema Definition (When MongoDB URI is provided)
// -------------------------------------------------------------
let isMongoConnected = false;

const DefectSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, required: true },
  label: { type: String, required: true },
  confidence: { type: Number, required: true },
  severity: { type: String, enum: ['NOMINAL', 'MINOR', 'MODERATE', 'CRITICAL'], default: 'MINOR' },
  location: { type: String, default: 'Surface' },
  bbox: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 }
  },
  description: String,
  suggestedAction: String
}, { _id: false });

const InspectionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  productId: { type: String, required: true },
  productType: { type: String, default: 'Notebook' },
  image: { type: String, required: true },
  originalFilename: { type: String, default: '' },
  timestamp: { type: String, required: true },
  inspectedAt: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['PASSED', 'DEFECT DETECTED', 'LOW CONFIDENCE', 'IMAGE ERROR', 'ANALYZING'], 
    default: 'ANALYZING' 
  },
  qualityScore: { type: Number, default: null },
  confidence: { type: Number, default: null },
  severity: { type: String, default: 'NOMINAL' },
  defects: [DefectSchema],
  imageAnalysis: {
    width: Number,
    height: Number,
    blurVariance: Number,
    isBlurry: Boolean,
    notebookDetected: Boolean,
    aspectRatio: Number,
    surfaceUniformity: Number
  },
  rootCause: {
    probableProcess: String,
    defectType: String,
    historicalDefects: Number,
    totalInspections: Number,
    confidence: String,
    probableCause: String,
    recommendation: String,
    disclaimer: String
  },
  prediction: {
    riskLevel: String,
    trend: String,
    currentDefectRate: String,
    earlyWarning: String,
    recommendedAction: String,
    sufficientData: Boolean
  },
  passport: {
    passportId: String,
    hash: String,
    verifiedBy: String,
    issuedAt: String
  },
  manualOverride: {
    action: String,
    note: String,
    operator: String,
    timestamp: String
  },
  scannerSource: { type: String, default: 'USB_MOBILE_SCANNER' }
}, { timestamps: true });

let InspectionModel = null;

export async function initDatabase(mongoUri = process.env.MONGODB_URI) {
  if (mongoUri && mongoUri.trim().length > 0) {
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
      InspectionModel = mongoose.models.Inspection || mongoose.model('Inspection', InspectionSchema);
      isMongoConnected = true;
      console.log('[VIZORIS DB] Connected to MongoDB persistent database');
      return true;
    } catch (err) {
      console.warn('[VIZORIS DB] MongoDB connection failed, using local persistent file store:', err.message);
      isMongoConnected = false;
    }
  } else {
    console.log('[VIZORIS DB] Using persistent local JSON file store (server/data/real_inspections.json)');
  }
  return false;
}

// -------------------------------------------------------------
// Persistent Local JSON Store (Clean fallback, zero fake seeds)
// -------------------------------------------------------------
function readJsonDb() {
  if (!fs.existsSync(REAL_DB_FILE)) {
    const emptyDb = {
      inspections: [],
      nextCounter: 1
    };
    fs.writeFileSync(REAL_DB_FILE, JSON.stringify(emptyDb, null, 2), 'utf-8');
    return emptyDb;
  }
  try {
    const raw = fs.readFileSync(REAL_DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.inspections)) {
      parsed.inspections = [];
    }
    if (!parsed.nextCounter) {
      parsed.nextCounter = parsed.inspections.length + 1;
    }
    return parsed;
  } catch (err) {
    console.error('[VIZORIS DB] Failed reading real inspections store, initializing clean:', err);
    const emptyDb = { inspections: [], nextCounter: 1 };
    fs.writeFileSync(REAL_DB_FILE, JSON.stringify(emptyDb, null, 2), 'utf-8');
    return emptyDb;
  }
}

function writeJsonDb(data) {
  fs.writeFileSync(REAL_DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// -------------------------------------------------------------
// Inspection ID Generator: VIZ-YYYY-XXXX (e.g. VIZ-2026-0001)
// -------------------------------------------------------------
export function generateInspectionId() {
  const currentYear = new Date().getFullYear();
  const db = readJsonDb();
  const counter = db.nextCounter || (db.inspections.length + 1);
  db.nextCounter = counter + 1;
  writeJsonDb(db);
  return `VIZ-${currentYear}-${String(counter).padStart(4, '0')}`;
}

// -------------------------------------------------------------
// Digital Passport Hash Generator (SHA-256)
// -------------------------------------------------------------
export function generatePassport(inspectionId, imagePath, defects = [], qualityScore = null) {
  const payload = `${inspectionId}:${imagePath}:${JSON.stringify(defects)}:${qualityScore}:${Date.now()}`;
  const hash = crypto.createHash('sha256').update(payload).digest('hex').toUpperCase();
  return {
    passportId: `PASSPORT-${inspectionId}`,
    hash: `SHA256-${hash.substring(0, 16)}`,
    verifiedBy: 'VIZORIS Vision Intelligence Engine v2.4',
    issuedAt: new Date().toISOString()
  };
}

// -------------------------------------------------------------
// Store a Real Inspection Record
// -------------------------------------------------------------
export function addInspection(inspection) {
  // Ensure required real structure
  if (!inspection.id) {
    inspection.id = generateInspectionId();
  }
  if (!inspection.productId) {
    inspection.productId = inspection.id;
  }
  if (!inspection.productType) {
    inspection.productType = 'Notebook';
  }
  if (!inspection.timestamp) {
    inspection.timestamp = new Date().toISOString();
  }
  if (!inspection.inspectedAt) {
    inspection.inspectedAt = inspection.timestamp;
  }
  if (!inspection.passport) {
    inspection.passport = generatePassport(
      inspection.id, 
      inspection.image, 
      inspection.defects, 
      inspection.qualityScore
    );
  }

  // Save to JSON Store
  const db = readJsonDb();
  // Ensure unshifted to top (most recent first)
  db.inspections = [inspection, ...db.inspections.filter(i => i.id !== inspection.id)];
  writeJsonDb(db);

  // If MongoDB is connected, save asynchronously
  if (isMongoConnected && InspectionModel) {
    InspectionModel.findOneAndUpdate(
      { id: inspection.id },
      inspection,
      { upsert: true, returnDocument: 'after' }
    ).catch(err => console.error('[VIZORIS MONGO] Error saving inspection:', err));
  }

  return inspection;
}

// -------------------------------------------------------------
// Retrieve Real Inspections with Optional Filters
// -------------------------------------------------------------
export function getInspections(filters = {}) {
  const db = readJsonDb();
  let list = [...db.inspections];

  if (filters.status && filters.status !== 'ALL') {
    list = list.filter(i => i.status && i.status.toLowerCase() === filters.status.toLowerCase());
  }

  if (filters.defectType && filters.defectType !== 'ALL') {
    list = list.filter(i => i.defects && i.defects.some(d => 
      d.type.toLowerCase().includes(filters.defectType.toLowerCase()) ||
      d.label.toLowerCase().includes(filters.defectType.toLowerCase())
    ));
  }

  if (filters.severity && filters.severity !== 'ALL') {
    list = list.filter(i => i.defects && i.defects.some(d => 
      d.severity.toLowerCase() === filters.severity.toLowerCase()
    ));
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(i => 
      (i.id && i.id.toLowerCase().includes(q)) || 
      (i.productId && i.productId.toLowerCase().includes(q)) ||
      (i.defects && i.defects.some(d => 
        (d.label && d.label.toLowerCase().includes(q)) || 
        (d.type && d.type.toLowerCase().includes(q))
      ))
    );
  }

  return list;
}

// -------------------------------------------------------------
// Retrieve a Single Real Inspection
// -------------------------------------------------------------
export function getInspectionById(id) {
  const db = readJsonDb();
  return db.inspections.find(i => i.id === id || i.productId === id) || null;
}

export function getMetrics(filters = {}) {
  const db = readJsonDb();
  let realRecords = [...db.inspections];

  // Optional date-range filter strictly applied to actual timestamps
  if (filters && filters.range && filters.range !== 'all' && filters.range !== 'ALL') {
    const now = new Date();
    const range = filters.range.toLowerCase();
    let cutoff = null;
    if (range === 'today') {
      cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (range === 'week' || range === '7d') {
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === 'month' || range === '30d') {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    if (cutoff) {
      realRecords = realRecords.filter(i => {
        const itemDate = new Date(i.timestamp || i.inspectedAt);
        return !isNaN(itemDate.getTime()) && itemDate >= cutoff;
      });
    }
  }

  const totalInspections = realRecords.length;
  const totalInspected = totalInspections; // backward compatibility alias
  const passedSpecimens = realRecords.filter(i => i.status === 'PASSED').length;
  const passed = passedSpecimens; // backward compatibility alias
  const defectsDetected = realRecords.filter(i => i.status === 'DEFECT DETECTED').length;
  const defective = defectsDetected; // backward compatibility alias
  const lowConfidence = realRecords.filter(i => i.status === 'LOW CONFIDENCE').length;

  // Real First-Pass Yield: passed / total * 100 (0 if no scans)
  const firstPassYield = totalInspections > 0 
    ? +((passedSpecimens / totalInspections) * 100).toFixed(2) 
    : 0;

  // Real Defect Rate: defective / total * 100 (0 if no scans)
  const defectRate = totalInspections > 0 
    ? +((defectsDetected / totalInspections) * 100).toFixed(2) 
    : 0;
  
  // Calculate average quality score strictly from records with valid numeric scores (0 if no scans)
  const scoredRecords = realRecords.filter(i => typeof i.qualityScore === 'number' && !isNaN(i.qualityScore));
  const averageQualityScore = scoredRecords.length > 0 
    ? +(scoredRecords.reduce((sum, i) => sum + i.qualityScore, 0) / scoredRecords.length).toFixed(1)
    : 0;
  const avgQualityScore = averageQualityScore; // backward compatibility alias

  // Dynamic Defect Categories strictly from actual scan defect annotations
  const categoryCounts = {};
  realRecords.forEach(item => {
    if (item.defects && Array.isArray(item.defects)) {
      item.defects.forEach(d => {
        const cat = d.type || 'Other';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
    }
  });

  return {
    totalInspections,
    totalInspected,
    passedSpecimens,
    passed,
    defectsDetected,
    defective,
    lowConfidence,
    firstPassYield,
    defectRate,
    averageQualityScore,
    avgQualityScore,
    categoryCounts,
    hasRealData: totalInspections > 0
  };
}

// -------------------------------------------------------------
// Root Cause Analysis Derived from Real Data
// -------------------------------------------------------------
export function deriveRootCauseAnalysis(defectType = null) {
  const db = readJsonDb();
  const realRecords = db.inspections;
  const total = realRecords.length;

  // Process mapping based on defect taxonomy
  const PROCESS_MAPPING = {
    'Pen Line / Writing': { process: 'Printing / Manual Handling', cause: 'Surface roller drag or stray marking during sheet collation' },
    'Printing Error': { process: 'Printing Unit', cause: 'Roller ink pressure imbalance or plate transfer misalignment' },
    'Ink Stain': { process: 'Inking & Application', cause: 'Nozzle overspray, ink drip, or reservoir viscosity variance' },
    'Ink Mark': { process: 'Inking & Application', cause: 'Excess fluid ink deposition or smudge during transport' },
    'Torn Page': { process: 'Cutting & Trimming', cause: 'Trimmer blade edge wear or sheet clamp tension excess' },
    'Torn Pages': { process: 'Cutting & Trimming', cause: 'Trimmer blade dulling or feed grip slippage' },
    'Binding Misalignment': { process: 'Binding & Punching', cause: 'Punch die lateral drift or spiral pitch guide shift' },
    'Wrong / Missing Printed Content': { process: 'Printing Plate Unit', cause: 'Blanket cylinder skip or missing ruling plate registration' },
    'Surface Anomaly': { process: 'Paper Feed / Raw Substrate', cause: 'Foreign particle contamination or surface fiber inconsistency' }
  };

  if (total === 0) {
    return {
      sufficientData: false,
      message: 'No inspections recorded yet to establish root-cause correlation.',
      primaryHotspot: null,
      disclaimer: 'Probable contributing cause (statistical correlation based on historical shift data) rather than confirmed physical cause.'
    };
  }

  // Count defect occurrences by type
  const typeCounts = {};
  realRecords.forEach(i => {
    if (i.defects) {
      i.defects.forEach(d => {
        typeCounts[d.type] = (typeCounts[d.type] || 0) + 1;
      });
    }
  });

  const targetType = defectType || Object.keys(typeCounts)[0] || 'Surface Anomaly';
  const targetCount = typeCounts[targetType] || 0;
  const mapping = PROCESS_MAPPING[targetType] || { process: 'General Assembly', cause: 'Visual variation during notebook assembly' };

  return {
    sufficientData: true,
    primaryHotspot: {
      process: mapping.process,
      defectType: targetType,
      defectCount: targetCount,
      totalInspections: total,
      defectRate: total > 0 ? `${((targetCount / total) * 100).toFixed(1)}%` : '0%',
      confidence: total >= 5 ? 'Moderate' : 'Preliminary (Small sample size)',
      probableCause: mapping.cause,
      recommendedAction: `Inspect ${mapping.process} parameters and verify calibration before next production run.`,
      disclaimer: 'Probable cause based on historical correlation — not confirmed physical cause.'
    },
    categoryDistribution: typeCounts
  };
}

// -------------------------------------------------------------
// Predictive Quality Analysis Derived from Real Data
// -------------------------------------------------------------
export function derivePredictiveAnalysis() {
  const db = readJsonDb();
  const realRecords = db.inspections;
  const total = realRecords.length;

  if (total < 5) {
    return {
      sufficientData: false,
      message: 'Insufficient historical data for reliable prediction',
      note: `Minimum 5 real notebook inspections required to model quality trends (current: ${total}).`,
      earlyWarning: null,
      forecastCycles: []
    };
  }

  // Compute trend over the real records
  const half = Math.floor(total / 2);
  const olderBatch = realRecords.slice(half);
  const newerBatch = realRecords.slice(0, half);

  const olderDefects = olderBatch.filter(i => i.status === 'DEFECT DETECTED').length;
  const newerDefects = newerBatch.filter(i => i.status === 'DEFECT DETECTED').length;

  const olderRate = (olderDefects / olderBatch.length) * 100;
  const newerRate = (newerDefects / newerBatch.length) * 100;
  const rateDelta = +(newerRate - olderRate).toFixed(2);

  const isEscalating = rateDelta > 1.0;

  return {
    sufficientData: true,
    earlyWarning: {
      active: isEscalating,
      headline: isEscalating 
        ? 'EARLY WARNING: Defect Frequency Escalation Detected' 
        : 'STABLE: Production Quality Within Control Limits',
      summary: isEscalating 
        ? `Defect rate increased by +${rateDelta}% across recent notebook inspections.` 
        : `Defect rate is stable or declining across current inspection batch.`,
      riskLevel: isEscalating ? (newerRate > 10 ? 'HIGH' : 'MEDIUM') : 'LOW',
      currentDefectRate: `${newerRate.toFixed(1)}%`,
      previousDefectRate: `${olderRate.toFixed(1)}%`,
      currentBatchTrend: isEscalating ? `+${rateDelta}% increase` : 'Nominal drift',
      futureDefectRisk: isEscalating ? 'Elevated if drift continues' : 'Low',
      recommendedAction: isEscalating 
        ? 'Perform preventive inspection on active production tooling before starting next batch.' 
        : 'Continue current line monitoring parameters.'
    },
    forecastCycles: [
      { cycle: 'Current Scans', predictedDefectRate: +newerRate.toFixed(1), upperTolerance: 5.0, status: newerRate > 5.0 ? 'ELEVATED' : 'OPTIMAL' },
      { cycle: '+25 Units', predictedDefectRate: +(newerRate + (isEscalating ? 1.2 : -0.2)).toFixed(1), upperTolerance: 5.0, status: (newerRate + 1.2) > 5.0 ? 'HIGH' : 'OPTIMAL' },
      { cycle: '+50 Units', predictedDefectRate: +(newerRate + (isEscalating ? 2.5 : -0.4)).toFixed(1), upperTolerance: 5.0, status: (newerRate + 2.5) > 5.0 ? 'CRITICAL' : 'OPTIMAL' },
      { cycle: 'With Preventive Action', predictedDefectRate: Math.max(0.5, +(newerRate * 0.3).toFixed(1)), upperTolerance: 5.0, status: 'OPTIMAL' }
    ]
  };
}

// -------------------------------------------------------------
// Clean All Real Data (Used for explicit test resets)
// -------------------------------------------------------------
export function clearRealData() {
  const emptyDb = {
    inspections: [],
    nextCounter: 1
  };
  writeJsonDb(emptyDb);
  if (isMongoConnected && InspectionModel) {
    InspectionModel.deleteMany({}).catch(err => console.error('[VIZORIS MONGO] Clear failed:', err));
  }
  return emptyDb;
}
