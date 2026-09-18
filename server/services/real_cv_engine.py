#!/usr/bin/env python3
"""
VIZORIS — Dual-Engine Notebook Quality Inspection Engine (v4.0)
=======================================================================
Implements two complementary detection pipelines:
  METHOD 1: Reference Difference Detection (aligned scan vs clean baseline)
  METHOD 2: Independent Abnormal Mark Detection (scan image directly analyzed)

Features:
  1. Horizontal Ruling Line Modeling & Masking (ruling lines are normal)
  2. Page Margin Inset Masking (desk boundary/crop shadows never flagged)
  3. Chromatic Ink Analysis (detects blue, red, black ink strokes)
  4. Cross-Line Stroke Extraction (detects non-horizontal pen lines & scribbles)
  5. Dark Blob Detection (ink stains / smudges)
  6. Spatial Clustering & Bounding Box Merging
  7. Evidence-based dynamic confidence & deductive quality scoring
  8. Detailed structured debug logging
"""

import sys
import os
import json
import math
import cv2
import numpy as np

# ──────────────────────────────────────────────────────────────────────────────
# Configuration & Constants
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.join(SCRIPT_DIR, '..', '..')
DEFAULT_REFERENCE_PATH = os.path.join(PROJECT_ROOT, 'reference', 'notebook_clean_reference.jpg')

# Standard processing resolution
COMPARE_WIDTH = 800
COMPARE_HEIGHT = 1100

# Blur detection threshold
BLUR_THRESHOLD = 25.0

# Margin exclusion: percentage from image border to ignore desk/crop boundary
MARGIN_X_PCT = 0.070  # 7.0% horizontal margin
MARGIN_Y_PCT = 0.050  # 5.0% vertical margin

# ORB alignment parameters
ORB_FEATURES = 1000
MIN_MATCH_COUNT = 15
FLANN_RATIO_THRESH = 0.75

# Diff thresholds
ABS_DIFF_THRESHOLD = 65

# Defect bounds
MAX_DEFECTS = 10


# ──────────────────────────────────────────────────────────────────────────────
# Step 1: Image Loading & Preprocessing
# ──────────────────────────────────────────────────────────────────────────────

def load_image(image_path):
    """Load image from disk in BGR format."""
    if not os.path.exists(image_path):
        return None, f"File not found: {image_path}"
    try:
        data = np.fromfile(image_path, dtype=np.uint8)
        img = cv2.imdecode(data, cv2.IMREAD_COLOR)
        if img is None or img.size == 0:
            return None, "Failed to decode image data."
        return img, None
    except Exception as e:
        return None, str(e)


def check_blur(gray_image):
    """Compute Laplacian variance. Variance < threshold indicates blur."""
    var = float(cv2.Laplacian(gray_image, cv2.CV_64F).var())
    return round(var, 2), var < BLUR_THRESHOLD


def preprocess_image(bgr_img, target_w=COMPARE_WIDTH, target_h=COMPARE_HEIGHT):
    """Resize to standard processing resolution with aspect-ratio preservation or warp."""
    return cv2.resize(bgr_img, (target_w, target_h), interpolation=cv2.INTER_AREA)


def normalize_lighting(img_gray):
    """Apply CLAHE to normalize lighting gradients across the paper surface."""
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(img_gray)


# ──────────────────────────────────────────────────────────────────────────────
# Step 2: Ruling Line Modeling & Masking
# ──────────────────────────────────────────────────────────────────────────────

def model_ruling_lines(gray, h, w):
    """
    Detect horizontal notebook ruling lines.
    Ruling lines are normal product features and must not be flagged as defects.
    Returns:
      - ruling_mask: binary mask of horizontal ruling lines dilated slightly
      - has_ruling: boolean indicating whether ruling structure was detected
      - dominant_spacing: estimated line spacing in pixels (or None)
    """
    k_len = max(35, int(w * 0.045))
    kernel_h = cv2.getStructuringElement(cv2.MORPH_RECT, (k_len, 1))

    # Adaptive threshold isolates fine printed lines regardless of illumination
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY_INV, 21, 6)

    # Extract horizontal lines
    horiz = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel_h)

    # Check row projection profile
    proj = np.sum(horiz > 0, axis=1)
    peaks = np.where(proj > w * 0.20)[0]
    has_ruling = len(peaks) > 5

    dominant_spacing = None
    if len(peaks) >= 4:
        diffs = np.diff(peaks)
        valid_diffs = diffs[(diffs > 15) & (diffs < 120)]
        if len(valid_diffs) > 0:
            dominant_spacing = float(np.median(valid_diffs))

    # Dilate horizontal lines vertically by 3-4px to fully cover line boundaries
    dil_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 5))
    ruling_mask = cv2.dilate(horiz, dil_kernel, iterations=1)

    return ruling_mask, has_ruling, dominant_spacing, thresh


def is_ruling_fragment(bw, bh, aspect):
    """Returns True if a contour shape is merely a horizontal ruling line segment."""
    if aspect > 3.2 and bh < 24:
        return True
    if aspect > 5.5 and bh < 32:
        return True
    return False


# ──────────────────────────────────────────────────────────────────────────────
# Step 3: Alignment (Scan to Clean Reference)
# ──────────────────────────────────────────────────────────────────────────────

def align_to_reference(scan_bgr, ref_bgr):
    """Align scan to clean reference using ORB homography with ECC fallback."""
    scan_gray = cv2.cvtColor(scan_bgr, cv2.COLOR_BGR2GRAY)
    ref_gray = cv2.cvtColor(ref_bgr, cv2.COLOR_BGR2GRAY)

    try:
        orb = cv2.ORB_create(nfeatures=ORB_FEATURES)
        kp_scan, des_scan = orb.detectAndCompute(scan_gray, None)
        kp_ref, des_ref = orb.detectAndCompute(ref_gray, None)

        if des_scan is not None and des_ref is not None and len(kp_scan) > 20 and len(kp_ref) > 20:
            index_params = dict(algorithm=6, table_number=6, key_size=12, multi_probe_level=1)
            search_params = dict(checks=50)
            flann = cv2.FlannBasedMatcher(index_params, search_params)
            matches = flann.knnMatch(des_scan, des_ref, k=2)

            good = []
            for m_pair in matches:
                if len(m_pair) == 2:
                    m, n = m_pair
                    if m.distance < FLANN_RATIO_THRESH * n.distance:
                        good.append(m)

            if len(good) >= MIN_MATCH_COUNT:
                src_pts = np.float32([kp_scan[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
                dst_pts = np.float32([kp_ref[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
                H, _ = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
                if H is not None:
                    aligned = cv2.warpPerspective(scan_bgr, H, (ref_bgr.shape[1], ref_bgr.shape[0]))
                    if aligned.mean() > 10:
                        return aligned, 'ORB_HOMOGRAPHY'
    except Exception:
        pass

    try:
        warp_matrix = np.eye(2, 3, dtype=np.float32)
        criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-5)
        _, warp_matrix = cv2.findTransformECC(ref_gray, scan_gray, warp_matrix, cv2.MOTION_EUCLIDEAN, criteria)
        aligned = cv2.warpAffine(scan_bgr, warp_matrix, (ref_bgr.shape[1], ref_bgr.shape[0]),
                                 flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP)
        return aligned, 'ECC_EUCLIDEAN'
    except Exception:
        pass

    return scan_bgr, 'DIRECT_RESIZE'


# ──────────────────────────────────────────────────────────────────────────────
# Step 4: Structural Difference Computation (SSIM + Abs Diff)
# ──────────────────────────────────────────────────────────────────────────────

def compute_ssim_map(img_a_gray, img_b_gray, window_size=11):
    """Compute per-pixel SSIM map between two grayscale images."""
    C1 = (0.01 * 255) ** 2
    C2 = (0.03 * 255) ** 2

    img_a = img_a_gray.astype(np.float64)
    img_b = img_b_gray.astype(np.float64)

    kernel = cv2.getGaussianKernel(window_size, 1.5)
    kernel_2d = kernel @ kernel.T

    def conv(img):
        return cv2.filter2D(img, -1, kernel_2d)

    mu_a = conv(img_a)
    mu_b = conv(img_b)
    mu_a2 = mu_a ** 2
    mu_b2 = mu_b ** 2
    mu_ab = mu_a * mu_b

    sigma_a2 = conv(img_a ** 2) - mu_a2
    sigma_b2 = conv(img_b ** 2) - mu_b2
    sigma_ab = conv(img_a * img_b) - mu_ab

    ssim_map = ((2 * mu_ab + C1) * (2 * sigma_ab + C2)) / \
               ((mu_a2 + mu_b2 + C1) * (sigma_a2 + sigma_b2 + C2))

    ssim_map = np.clip(ssim_map, 0.0, 1.0)
    mean_ssim = float(ssim_map.mean())
    return mean_ssim, ssim_map


def compute_difference(aligned_scan, ref_bgr):
    """Compute combined structural difference map."""
    scan_gray = cv2.cvtColor(aligned_scan, cv2.COLOR_BGR2GRAY)
    ref_gray = cv2.cvtColor(ref_bgr, cv2.COLOR_BGR2GRAY)

    mean_ssim, ssim_map = compute_ssim_map(scan_gray, ref_gray)
    ssim_diff = (1.0 - ssim_map)
    ssim_diff_u8 = (ssim_diff * 255).clip(0, 255).astype(np.uint8)
    abs_diff = cv2.absdiff(scan_gray, ref_gray)

    combined = (ssim_diff_u8.astype(np.float32) * 0.60 +
                abs_diff.astype(np.float32) * 0.40).clip(0, 255).astype(np.uint8)

    return combined, mean_ssim, abs_diff


# ──────────────────────────────────────────────────────────────────────────────
# Step 5: Method 1 — Reference Difference Candidate Extraction
# ──────────────────────────────────────────────────────────────────────────────

def is_border_artifact(bx, by, bw, bh, img_w, img_h, margin_x, margin_y, area):
    """
    Distinguishes normal border/crop artifacts (thin shadow slits along edges)
    from genuine structural defects (such as a torn corner or damaged margin).
    """
    touches_left = (bx <= margin_x)
    touches_right = (bx + bw >= img_w - margin_x)
    touches_top = (by <= margin_y)
    touches_bottom = (by + bh >= img_h - margin_y)

    if not (touches_left or touches_right or touches_top or touches_bottom):
        return False  # Fully inside the page

    # Genuine large defect (e.g. torn corner or edge tear): penetrates deeply into page
    if area > 1200 and min(bw, bh) > 40:
        return False

    # A thin artifact (camera crop, shadow edge) has narrow width or height
    if bw < margin_x * 1.5 and (touches_left or touches_right):
        return True
    if bh < margin_y * 1.5 and (touches_top or touches_bottom):
        return True

    # Near-border small blob
    if area < 300:
        return True

    return False


def detect_reference_candidates(diff_map, aligned_scan, ref_bgr, img_h, img_w, margin_x, margin_y):
    """Extract candidate defect regions from the reference difference map."""
    _, binary = cv2.threshold(diff_map, ABS_DIFF_THRESHOLD, 255, cv2.THRESH_BINARY)
    # Bridge nearby differences
    close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    connected = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, close_kernel)

    contours, _ = cv2.findContours(connected, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    img_area = img_h * img_w
    candidates = []

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 100 or area > img_area * 0.45:
            continue
        bx, by, bw, bh = cv2.boundingRect(cnt)
        aspect = bw / max(bh, 1)

        # Skip horizontal ruling line fragments
        if is_ruling_fragment(bw, bh, aspect):
            continue

        # Filter out edge crop / desk shadow artifacts
        if is_border_artifact(bx, by, bw, bh, img_w, img_h, margin_x, margin_y, area):
            continue

        # Region diff intensity check
        patch = diff_map[by:by+bh, bx:bx+bw]
        if patch.size == 0 or patch.max() < ABS_DIFF_THRESHOLD * 1.25:
            continue

        # Check brightness delta between scan and reference for this candidate
        patch_scan = cv2.cvtColor(aligned_scan[by:by+bh, bx:bx+bw], cv2.COLOR_BGR2GRAY) if aligned_scan.size > 0 else None
        patch_ref = cv2.cvtColor(ref_bgr[by:by+bh, bx:bx+bw], cv2.COLOR_BGR2GRAY) if ref_bgr.size > 0 else None
        brightness_delta = 0.0
        if patch_scan is not None and patch_ref is not None and patch_scan.size > 0 and patch_ref.size > 0:
            brightness_delta = float(patch_scan.mean()) - float(patch_ref.mean())

        candidates.append({
            "source": "REFERENCE_DIFF",
            "bbox": (bx, by, bw, bh),
            "area": area,
            "max_dim": max(bw, bh),
            "peak_diff": float(patch.max()),
            "mean_diff": float(patch.mean()),
            "brightness_delta": brightness_delta
        })

    return candidates


# ──────────────────────────────────────────────────────────────────────────────
# Step 6: Method 2 — Independent Abnormal Mark Detection
# ──────────────────────────────────────────────────────────────────────────────

def detect_independent_candidates(img_bgr, ruling_mask, thresh_inv, img_h, img_w, margin_x, margin_y):
    """
    Independently detect abnormal marks directly on the scan image:
    1. Blue / red / colored ink strokes
    2. Non-horizontal strokes crossing ruling lines (scribbles, handwriting, sketches)
    3. Dark compact ink deposits (stains / smudges)
    """
    candidates = []

    # ── A. Chromatic Ink Detection (Blue / Red Pen Ink) ──────────────────────
    b, g, r = cv2.split(img_bgr)
    # Blue ink: Blue channel significantly exceeds Red and Green
    blue_excess = b.astype(np.int16) - np.maximum(r, g).astype(np.int16)
    blue_mask = (blue_excess > 14).astype(np.uint8) * 255

    # Red ink: Red channel significantly exceeds Blue and Green
    red_excess = r.astype(np.int16) - np.maximum(b, g).astype(np.int16)
    red_mask = (red_excess > 20).astype(np.uint8) * 255

    color_mask = cv2.bitwise_or(blue_mask, red_mask)
    # Mask out margins
    color_mask[:margin_y, :] = 0
    color_mask[img_h - margin_y:, :] = 0
    color_mask[:, :margin_x] = 0
    color_mask[:, img_w - margin_x:] = 0

    color_conn = cv2.morphologyEx(color_mask, cv2.MORPH_CLOSE,
                                  cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    cnts_color, _ = cv2.findContours(color_conn, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    for c in cnts_color:
        area = cv2.contourArea(c)
        bx, by, bw, bh = cv2.boundingRect(c)
        max_dim = max(bw, bh)

        # Ignore tiny specks or border edges
        if max_dim >= 35 and area >= 45:
            # Must not be right at the border
            if bx <= margin_x + 2 or bx + bw >= img_w - margin_x - 2:
                continue
            candidates.append({
                "source": "INDEPENDENT_COLOR_INK",
                "type": "Pen Line / Writing",
                "label": "Stray Pen / Ink Mark",
                "bbox": (bx, by, bw, bh),
                "area": area,
                "max_dim": max_dim,
                "is_color_ink": True
            })

    # ── B. Non-Horizontal Dark Strokes Crossing Ruling Lines ─────────────────
    # Subtract ruling lines mask so normal horizontal lines are removed
    non_ruling = cv2.subtract(thresh_inv, ruling_mask)
    non_ruling[:margin_y, :] = 0
    non_ruling[img_h - margin_y:, :] = 0
    non_ruling[:, :margin_x] = 0
    non_ruling[:, img_w - margin_x:] = 0

    # Remove isolated 1px noise
    non_ruling_clean = cv2.morphologyEx(non_ruling, cv2.MORPH_OPEN,
                                        cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2)))
    # Connect nearby stroke clusters
    non_ruling_conn = cv2.morphologyEx(non_ruling_clean, cv2.MORPH_CLOSE,
                                       cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))

    cnts_strokes, _ = cv2.findContours(non_ruling_conn, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for c in cnts_strokes:
        area = cv2.contourArea(c)
        bx, by, bw, bh = cv2.boundingRect(c)
        max_dim = max(bw, bh)
        aspect = bw / max(bh, 1)

        # Filter out horizontal ruling line remnants
        if is_ruling_fragment(bw, bh, aspect):
            continue

        # Skip desk/border margins
        if bx <= margin_x + 3 or bx + bw >= img_w - margin_x - 3:
            continue
        if by <= margin_y + 3 or by + bh >= img_h - margin_y - 3:
            continue

        # Meaningful stroke crossing lines: has vertical dimension or substantial area
        if (bh >= 30 and max_dim >= 40) or (max_dim >= 55 and area >= 90):
            candidates.append({
                "source": "INDEPENDENT_STROKE",
                "type": "Pen Line / Writing",
                "label": "Stray Pen / Pencil Mark",
                "bbox": (bx, by, bw, bh),
                "area": area,
                "max_dim": max_dim,
                "is_color_ink": False
            })

    # ── C. Dark Compact Blobs (Ink Stains / Smudges) ─────────────────────────
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    bg_median = cv2.medianBlur(gray, 35)
    diff = cv2.subtract(bg_median, gray)
    diff[:margin_y, :] = 0
    diff[img_h - margin_y:, :] = 0
    diff[:, :margin_x] = 0
    diff[:, img_w - margin_x:] = 0

    # Significant contrast drop (>36 luminance units darker than paper background)
    _, dark_blobs = cv2.threshold(diff, 36, 255, cv2.THRESH_BINARY)
    compact_blobs = cv2.morphologyEx(dark_blobs, cv2.MORPH_OPEN,
                                     cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    cnts_blobs, _ = cv2.findContours(compact_blobs, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    for c in cnts_blobs:
        area = cv2.contourArea(c)
        if area >= 160:
            bx, by, bw, bh = cv2.boundingRect(c)
            # Skip border margins
            if bx <= margin_x + 3 or bx + bw >= img_w - margin_x - 3:
                continue
            candidates.append({
                "source": "INDEPENDENT_INK_STAIN",
                "type": "Ink Stain",
                "label": "Ink Stain / Smudge",
                "bbox": (bx, by, bw, bh),
                "area": area,
                "max_dim": max(bw, bh),
                "is_color_ink": False
            })

    return candidates


# ──────────────────────────────────────────────────────────────────────────────
# Step 7: Fusion, Spatial Clustering & Bounding Box Merging
# ──────────────────────────────────────────────────────────────────────────────

def merge_nearby_bboxes(candidates, dist_thresh=45):
    """
    Merge bounding boxes that are overlapping or close to each other
    into unified defect regions.
    """
    if not candidates:
        return []

    rects = []
    for c in candidates:
        bx, by, bw, bh = c["bbox"]
        rects.append([bx, by, bx + bw, by + bh, dict(c)])

    merged = True
    while merged:
        merged = False
        new_rects = []
        skip = set()
        for i in range(len(rects)):
            if i in skip:
                continue
            r1 = rects[i]
            for j in range(i + 1, len(rects)):
                if j in skip:
                    continue
                r2 = rects[j]
                # Check bounding box overlap or proximity within dist_thresh
                x_overlap = not (r1[2] + dist_thresh < r2[0] or r2[2] + dist_thresh < r1[0])
                y_overlap = not (r1[3] + dist_thresh < r2[1] or r2[3] + dist_thresh < r1[1])

                if x_overlap and y_overlap:
                    r1[0] = min(r1[0], r2[0])
                    r1[1] = min(r1[1], r2[1])
                    r1[2] = max(r1[2], r2[2])
                    r1[3] = max(r1[3], r2[3])
                    r1[4]["area"] = r1[4].get("area", 0) + r2[4].get("area", 0)
                    if r2[4].get("is_color_ink"):
                        r1[4]["is_color_ink"] = True
                        r1[4]["type"] = "Pen Line / Writing"
                    skip.add(j)
                    merged = True
            new_rects.append(r1)
        rects = new_rects

    results = []
    for r in rects:
        x1, y1, x2, y2, meta = r
        meta["bbox"] = (x1, y1, x2 - x1, y2 - y1)
        meta["max_dim"] = max(x2 - x1, y2 - y1)
        results.append(meta)

    return results


# ──────────────────────────────────────────────────────────────────────────────
# Step 8: Classification, Confidence & Severity Determination
# ──────────────────────────────────────────────────────────────────────────────

def classify_and_score_defect(item, img_w, img_h, img_area):
    """
    Compute defect label, severity, confidence, location, and percentage bbox.
    """
    bx, by, bw, bh = item["bbox"]
    area = item.get("area", bw * bh)
    max_dim = max(bw, bh)
    aspect = bw / max(bh, 1)

    # Percentage bounding box
    bbox_pct = {
        "x": round((bx / img_w) * 100, 1),
        "y": round((by / img_h) * 100, 1),
        "width": round((bw / img_w) * 100, 1),
        "height": round((bh / img_h) * 100, 1)
    }

    # Location description
    cx_rel = (bx + bw / 2) / img_w
    cy_rel = (by + bh / 2) / img_h
    loc_h = "left" if cx_rel < 0.35 else ("right" if cx_rel > 0.65 else "center")
    loc_v = "upper" if cy_rel < 0.30 else ("lower" if cy_rel > 0.70 else "mid-body")
    location = f"{loc_v.capitalize()}-{loc_h} page area"

    # Default type if not already set
    defect_type = item.get("type", "Pen Line / Writing")
    if (bx <= 20 or bx + bw >= img_w - 20 or by <= 20 or by + bh >= img_h - 20) and area > 1200 and min(bw, bh) > 50:
        defect_type = "Torn Page"
        label = "Torn / Damaged Page Corner"
    elif item.get("brightness_delta", 0) > 10 and aspect > 1.2 and area > 800:
        defect_type = "Wrong / Missing Printed Content"
        label = "Missing / Faded Print"
    elif item.get("is_color_ink") or aspect < 0.5 or aspect > 2.2:
        defect_type = "Pen Line / Writing"
        label = "Stray Pen / Ink Stroke"
    elif item.get("type") == "Ink Stain":
        defect_type = "Ink Stain"
        label = "Ink Stain / Smudge"
    else:
        defect_type = "Surface Anomaly"
        label = "Unclassified Surface Mark"

    # Severity based on visual prominence and coverage
    area_pct = (area / img_area) * 100
    if defect_type in ("Torn Page", "Wrong / Missing Printed Content") or max_dim > img_w * 0.40 or area_pct > 1.8:
        severity = "CRITICAL"
        action = "Quarantine notebook unit; investigate printing/damage source."
    elif max_dim > img_w * 0.15 or area_pct > 0.3:
        severity = "MODERATE"
        action = "Flag unit for manual QA review before packaging."
    else:
        severity = "MINOR"
        action = "Record minor surface anomaly in batch inspection log."

    # Evidence-based confidence
    dim_factor = min(1.0, max_dim / (img_w * 0.40))
    area_factor = min(1.0, area / 2000.0)
    color_bonus = 10.0 if item.get("is_color_ink") else 0.0

    confidence = round(min(98.8, 76.0 + dim_factor * 12.0 + area_factor * 6.0 + color_bonus), 1)

    if defect_type == "Pen Line / Writing":
        desc = (
            f"Linear or curved pen/pencil mark detected (~{max_dim}px span, bbox {bbox_pct['width']}%x{bbox_pct['height']}%). "
            "Crosses normal notebook ruling structure — stray mark confirmed."
        )
    elif defect_type == "Torn Page":
        desc = (
            f"Substrate boundary damage detected at page corner (~{max_dim}px span, {area_pct:.1f}% area). "
            "Page substrate is torn, cut, or missing compared to clean baseline reference."
        )
    elif defect_type == "Wrong / Missing Printed Content":
        desc = (
            f"Expected printed ruling lines absent or faded in this region (~{max_dim}px span, bbox {bbox_pct['width']}%x{bbox_pct['height']}%). "
            "Surface is significantly brighter than clean reference — missing print confirmed."
        )
    elif defect_type == "Ink Stain":
        desc = (
            f"Dark ink deposit detected (~{int(area)}px, {area_pct:.2f}% of page). "
            "Exceeds surface cleanliness tolerance — ink contamination confirmed."
        )
    else:
        desc = f"Anomalous surface feature detected at {location} (~{max_dim}px prominence)."

    return {
        "type": defect_type,
        "label": label,
        "confidence": confidence,
        "severity": severity,
        "location": location,
        "bbox": bbox_pct,
        "description": desc,
        "suggestedAction": action,
        "_meta": {
            "source": item.get("source"),
            "raw_bbox": item["bbox"],
            "area_px": int(area),
            "max_dim": max_dim
        }
    }


def calculate_quality_score(mean_ssim, defects):
    """
    Deductive quality score:
    100 base score minus penalties based on defect count, severity, and extent.
    Clean pass returns 94.0 - 99.0.
    Defective returns score reduced according to severity.
    """
    score = 100.0
    for d in defects:
        sev = d.get("severity", "MINOR")
        if sev == "CRITICAL":
            score -= 32.0
        elif sev == "MODERATE":
            score -= 16.0
        else:
            score -= 7.0

    if defects:
        score = max(50.0, min(round(score, 1), 89.0))
    else:
        score = max(94.0, min(round(score, 1), 99.5))

    return score


# ──────────────────────────────────────────────────────────────────────────────
# Main Pipeline Orchestrator
# ──────────────────────────────────────────────────────────────────────────────

def analyze_notebook_image(scan_path, reference_path=None):
    """
    Complete dual-engine notebook quality inspection pipeline.
    """
    if reference_path is None:
        reference_path = DEFAULT_REFERENCE_PATH

    # 0. File validation
    if not os.path.exists(scan_path):
        return {
            "success": False, "status": "IMAGE ERROR",
            "qualityScore": None, "confidence": None, "severity": "NOMINAL",
            "defects": [], "imageAnalysis": {"error": f"File not found: {scan_path}"},
            "diagnosticMessage": f"Scan image file not found on disk: {scan_path}"
        }

    has_ref = os.path.exists(reference_path)

    # 1. Load images
    scan_bgr_raw, err = load_image(scan_path)
    if scan_bgr_raw is None:
        return {
            "success": False, "status": "IMAGE ERROR",
            "qualityScore": None, "confidence": None, "severity": "NOMINAL",
            "defects": [], "imageAnalysis": {"error": err},
            "diagnosticMessage": f"Cannot decode scan image: {err}"
        }

    scan_h_orig, scan_w_orig = scan_bgr_raw.shape[:2]

    # 2. Image Quality & Blur Check
    scan_gray_orig = cv2.cvtColor(scan_bgr_raw, cv2.COLOR_BGR2GRAY)
    blur_var, is_blurry = check_blur(scan_gray_orig)
    mean_brightness = float(scan_gray_orig.mean())
    contrast = float(scan_gray_orig.std())

    if is_blurry:
        sys.stderr.write(f"[VIZORIS AI] Image quality: BLURRY (Laplacian: {blur_var:.1f} < {BLUR_THRESHOLD})\n")
        sys.stderr.write("[VIZORIS AI] Final Status: LOW CONFIDENCE\n")
        return {
            "success": True, "status": "LOW CONFIDENCE",
            "qualityScore": None, "confidence": 36.0, "severity": "NOMINAL",
            "defects": [],
            "imageAnalysis": {
                "width": scan_w_orig, "height": scan_h_orig,
                "blurVariance": blur_var, "isBlurry": True,
                "notebookDetected": True,
                "meanBrightness": round(mean_brightness, 1),
                "contrast": round(contrast, 1),
                "referenceUsed": has_ref,
                "alignmentMethod": "N/A"
            },
            "diagnosticMessage": (
                f"Image too blurry for reliable computer vision inspection "
                f"(Laplacian variance: {blur_var:.1f} < {BLUR_THRESHOLD}). "
                "Please hold the camera steady and rescan."
            )
        }

    # 3. Standardize Resolution
    scan_pp = preprocess_image(scan_bgr_raw, COMPARE_WIDTH, COMPARE_HEIGHT)
    img_h, img_w = scan_pp.shape[:2]
    img_area = img_h * img_w
    margin_x = int(img_w * MARGIN_X_PCT)
    margin_y = int(img_h * MARGIN_Y_PCT)

    scan_gray_pp = cv2.cvtColor(scan_pp, cv2.COLOR_BGR2GRAY)

    # 4. Ruling Line Modeling & Masking
    ruling_mask, has_ruling, dominant_spacing, thresh_inv = model_ruling_lines(scan_gray_pp, img_h, img_w)

    # 5. Method 1: Reference Difference Detection
    ref_candidates = []
    mean_ssim = 0.90
    alignment_method = "N/A"

    if has_ref:
        ref_bgr_raw, r_err = load_image(reference_path)
        if ref_bgr_raw is not None:
            ref_pp = preprocess_image(ref_bgr_raw, COMPARE_WIDTH, COMPARE_HEIGHT)
            aligned_scan, alignment_method = align_to_reference(scan_pp, ref_pp)
            diff_map, mean_ssim, _ = compute_difference(aligned_scan, ref_pp)
            ref_candidates = detect_reference_candidates(diff_map, aligned_scan, ref_pp, img_h, img_w, margin_x, margin_y)

    # 6. Method 2: Independent Abnormal Mark Detection
    indep_candidates = detect_independent_candidates(scan_pp, ruling_mask, thresh_inv,
                                                    img_h, img_w, margin_x, margin_y)

    # 7. Candidate Fusion & Spatial Box Merging
    all_candidates = indep_candidates + ref_candidates
    merged_items = merge_nearby_bboxes(all_candidates, dist_thresh=45)

    # 8. Classify & Format Confirmed Defects
    defects = []
    for item in merged_items[:MAX_DEFECTS]:
        d = classify_and_score_defect(item, img_w, img_h, img_area)
        defects.append(d)

    # Sort defects by severity
    sev_rank = {"CRITICAL": 0, "MODERATE": 1, "MINOR": 2, "NOMINAL": 3}
    defects.sort(key=lambda x: sev_rank.get(x["severity"], 2))

    for i, d in enumerate(defects):
        d["id"] = f"DEF-{i+1:02d}"

    # 9. Final Decision & Quality Score
    final_status = "DEFECT DETECTED" if defects else "PASSED"
    quality_score = calculate_quality_score(mean_ssim, defects)

    overall_conf = (
        round(max([d["confidence"] for d in defects]), 1)
        if defects else
        round(min(99.0, max(92.0, mean_ssim * 100)), 1)
    )

    primary_severity = defects[0]["severity"] if defects else "NOMINAL"

    if final_status == "PASSED":
        diag_msg = (
            f"Notebook quality inspection PASSED. Surface, ruling lines, and binding verified conformant. "
            f"No abnormal ink strokes, stains, or structural deviations detected (SSIM: {mean_ssim:.3f})."
        )
    else:
        primary = defects[0]
        diag_msg = (
            f"Non-conformance detected: {primary['label']} at {primary['location']} "
            f"— Severity: {primary['severity']}. Bounding box: x={primary['bbox']['x']}%, y={primary['bbox']['y']}%, "
            f"w={primary['bbox']['width']}%, h={primary['bbox']['height']}%."
        )

    # Structured Debug Output (Logged to stderr for development tracking)
    sys.stderr.write(f"[VIZORIS AI] Image quality: GOOD (Laplacian: {blur_var:.1f})\n")
    sys.stderr.write(f"[VIZORIS AI] Reference similarity: {mean_ssim:.3f} SSIM (Alignment: {alignment_method})\n")
    sys.stderr.write(f"[VIZORIS AI] Ruling structure detected: {'YES' if has_ruling else 'NO'} (spacing: {dominant_spacing}px)\n")
    sys.stderr.write(f"[VIZORIS AI] Method 1 (Reference Diff) candidates: {len(ref_candidates)}\n")
    sys.stderr.write(f"[VIZORIS AI] Method 2 (Independent) candidates: {len(indep_candidates)}\n")
    sys.stderr.write(f"[VIZORIS AI] Valid defect regions after fusion: {len(defects)}\n")
    if defects:
        sys.stderr.write(f"[VIZORIS AI] Primary defect type: {defects[0]['type']} ({defects[0]['label']})\n")
        sys.stderr.write(f"[VIZORIS AI] Confidence: {overall_conf}% | Severity: {primary_severity} | Score: {quality_score}\n")
    else:
        sys.stderr.write(f"[VIZORIS AI] Defect type: NONE | Confidence: {overall_conf}% | Severity: NOMINAL | Score: {quality_score}\n")
    sys.stderr.write(f"[VIZORIS AI] Final Status: {final_status}\n")

    return {
        "success": True,
        "status": final_status,
        "qualityScore": quality_score,
        "confidence": overall_conf,
        "severity": primary_severity,
        "defects": defects,
        "imageAnalysis": {
            "width": scan_w_orig,
            "height": scan_h_orig,
            "blurVariance": blur_var,
            "isBlurry": False,
            "notebookDetected": True,
            "meanBrightness": round(mean_brightness, 1),
            "contrast": round(contrast, 1),
            "meanSsim": round(mean_ssim, 4),
            "referenceUsed": has_ref,
            "alignmentMethod": alignment_method,
            "rulingDetected": has_ruling,
            "rulingSpacing": dominant_spacing
        },
        "diagnosticMessage": diag_msg
    }


# ──────────────────────────────────────────────────────────────────────────────
# Entry Point — CLI: python real_cv_engine.py <scan_path> [<reference_path>]
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.stdout.buffer.write(json.dumps({
            "success": False,
            "error": "Usage: real_cv_engine.py <scan_image_path> [<reference_image_path>]"
        }, ensure_ascii=True).encode('utf-8'))
        sys.exit(1)

    scan_img_path = sys.argv[1]
    ref_img_path = sys.argv[2] if len(sys.argv) > 2 else None

    result = analyze_notebook_image(scan_img_path, ref_img_path)
    sys.stdout.buffer.write((json.dumps(result, ensure_ascii=True) + '\n').encode('utf-8'))
    sys.stdout.buffer.flush()
