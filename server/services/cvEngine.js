// server/services/cvEngine.js
// Computer Vision Integration Service for VIZORIS Real Notebook Inspection System
// Invokes the real Python OpenCV vision pipeline (real_cv_engine.py).
// Eliminates all fake random() defect generators. Real images are the single source of truth.

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateInspectionId, generatePassport, deriveRootCauseAnalysis, derivePredictiveAnalysis } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REAL_CV_SCRIPT = path.join(__dirname, 'real_cv_engine.py');
const REFERENCE_DIR = path.join(__dirname, '..', '..', 'reference');
const DEFAULT_REF_FILENAME = 'notebook_clean_reference.jpg';

export function getReferenceImagePath() {
  const defaultPath = path.join(REFERENCE_DIR, DEFAULT_REF_FILENAME);
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }
  // Check if any other image exists in reference directory
  if (fs.existsSync(REFERENCE_DIR)) {
    const files = fs.readdirSync(REFERENCE_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    if (files.length > 0) {
      return path.join(REFERENCE_DIR, files[0]);
    }
  }
  return defaultPath;
}

export function getReferenceInfo() {
  const refPath = getReferenceImagePath();
  const exists = fs.existsSync(refPath);
  if (!exists) {
    return {
      exists: false,
      filename: DEFAULT_REF_FILENAME,
      path: 'reference/' + DEFAULT_REF_FILENAME,
      url: null,
      updatedAt: null,
      sizeBytes: 0
    };
  }
  const stat = fs.statSync(refPath);
  const fname = path.basename(refPath);
  return {
    exists: true,
    filename: fname,
    path: 'reference/' + fname,
    url: `/reference/${fname}?t=${stat.mtimeMs}`,
    updatedAt: stat.mtime.toISOString(),
    sizeBytes: stat.size
  };
}

/**
 * Execute real OpenCV Python engine on the target image against clean reference
 */
export function runPythonCvEngine(absoluteImagePath, referencePath = null) {
  return new Promise((resolve) => {
    try {
      const activeRef = referencePath || getReferenceImagePath();
      const args = [REAL_CV_SCRIPT, absoluteImagePath];
      if (activeRef && fs.existsSync(activeRef)) {
        args.push(activeRef);
      }
      const pyProcess = spawn('python', args);
      let stdoutData = '';
      let stderrData = '';

      pyProcess.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
      });

      pyProcess.stderr.on('data', (chunk) => {
        stderrData += chunk.toString();
      });

      pyProcess.on('close', (code) => {
        if (code !== 0 || !stdoutData.trim()) {
          console.error(`[CV ENGINE ERROR] Python process exited with code ${code}:`, stderrData);
          resolve({
            success: false,
            status: 'LOW CONFIDENCE',
            qualityScore: null,
            confidence: 40.0,
            severity: 'NOMINAL',
            defects: [],
            imageAnalysis: { error: stderrData || 'Vision engine subprocess error' },
            diagnosticMessage: 'Low confidence — vision engine requires manual review.'
          });
          return;
        }

        try {
          const parsed = JSON.parse(stdoutData.trim());
          resolve(parsed);
        } catch (parseErr) {
          console.error('[CV ENGINE ERROR] Failed to parse Python JSON output:', stdoutData);
          resolve({
            success: false,
            status: 'LOW CONFIDENCE',
            qualityScore: null,
            confidence: 40.0,
            severity: 'NOMINAL',
            defects: [],
            imageAnalysis: { error: 'Invalid JSON response from vision engine' },
            diagnosticMessage: 'Low confidence — manual inspection required.'
          });
        }
      });

      pyProcess.on('error', (err) => {
        console.error('[CV ENGINE ERROR] Failed to spawn Python CV process:', err.message);
        resolve({
          success: false,
          status: 'LOW CONFIDENCE',
          qualityScore: null,
          confidence: 40.0,
          severity: 'NOMINAL',
          defects: [],
          imageAnalysis: { error: err.message },
          diagnosticMessage: 'Vision service unavailable — manual inspection required.'
        });
      });
    } catch (err) {
      console.error('[CV ENGINE EXCEPTION]', err);
      resolve({
        success: false,
        status: 'IMAGE ERROR',
        qualityScore: null,
        confidence: null,
        severity: 'NOMINAL',
        defects: [],
        imageAnalysis: { error: err.message },
        diagnosticMessage: 'Failed to initiate computer vision inspection.'
      });
    }
  });
}

/**
 * Primary Real Inspection Analysis Pipeline
 * Takes an image path, executes real pixel analysis, and constructs the complete inspection document.
 */
export async function analyzeNotebookImage(imagePath, options = {}) {
  // Resolve absolute path on disk
  let diskPath = imagePath;
  if (imagePath.startsWith('/uploads/')) {
    diskPath = path.join(__dirname, '..', '..', 'uploads', path.basename(imagePath));
  } else if (imagePath.startsWith('/samples/')) {
    diskPath = path.join(__dirname, '..', '..', 'public', 'samples', path.basename(imagePath));
  } else if (!path.isAbsolute(imagePath)) {
    diskPath = path.join(__dirname, '..', '..', imagePath);
  }

  const cvResult = await runPythonCvEngine(diskPath, options.referencePath);

  const inspectionId = generateInspectionId();
  const timestamp = new Date().toISOString();
  const primaryDefect = cvResult.defects?.[0] || null;
  const primaryDefectType = primaryDefect ? primaryDefect.type : null;

  // Derive real root cause & prediction based strictly on real inspection history
  const rootCause = deriveRootCauseAnalysis(primaryDefectType);
  const prediction = derivePredictiveAnalysis();

  // Create immutable Digital Passport with SHA-256 hash
  const passport = generatePassport(
    inspectionId,
    imagePath,
    cvResult.defects || [],
    cvResult.qualityScore
  );

  return {
    id: inspectionId,
    productId: inspectionId,
    productType: 'Notebook',
    name: `Notebook Scan ${inspectionId}`,
    image: imagePath,
    originalFilename: options.originalFilename || path.basename(imagePath),
    timestamp: timestamp,
    inspectedAt: timestamp,
    status: cvResult.status,
    qualityScore: cvResult.qualityScore,
    confidence: cvResult.confidence,
    severity: cvResult.severity,
    defects: cvResult.defects || [],
    imageAnalysis: cvResult.imageAnalysis || {},
    diagnosticMessage: cvResult.diagnosticMessage,
    referenceInfo: getReferenceInfo(),
    rootCause: rootCause.primaryHotspot || null,
    prediction: prediction.sufficientData ? prediction.earlyWarning : {
      riskLevel: 'LOW',
      trend: 'INSUFFICIENT_DATA',
      currentDefectRate: 'N/A',
      earlyWarning: 'Insufficient historical data for reliable prediction',
      recommendedAction: 'Inspect additional notebook units to establish statistical baseline.',
      sufficientData: false
    },
    passport: passport,
    scannerSource: options.scannerSource || 'USB_MOBILE_SCANNER'
  };
}

// Development-only sample references (Explicitly marked as DEMO DATA)
export const SAMPLE_PRESETS = {
  pen_line: {
    id: 'DEMO-SAMPLE-PEN',
    name: 'Sample Notebook: Pen Line Defect [DEMO ONLY]',
    image: '/samples/notebook_pen_line.svg',
    isDemo: true
  },
  ink_stain: {
    id: 'DEMO-SAMPLE-INK',
    name: 'Sample Notebook: Ink Stain Defect [DEMO ONLY]',
    image: '/samples/notebook_ink_stain.svg',
    isDemo: true
  },
  torn_page: {
    id: 'DEMO-SAMPLE-TORN',
    name: 'Sample Notebook: Torn Page [DEMO ONLY]',
    image: '/samples/notebook_torn_page.svg',
    isDemo: true
  },
  binding_misaligned: {
    id: 'DEMO-SAMPLE-BIND',
    name: 'Sample Notebook: Binding Shift [DEMO ONLY]',
    image: '/samples/notebook_binding_misaligned.svg',
    isDemo: true
  },
  clean_pass: {
    id: 'DEMO-SAMPLE-PASS',
    name: 'Sample Notebook: Clean Pass Specimen [DEMO ONLY]',
    image: '/samples/notebook_clean_pass.svg',
    isDemo: true
  }
};
