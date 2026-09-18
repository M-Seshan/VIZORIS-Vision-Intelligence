// server/services/usbScannerService.js
// VIZORIS USB Scanner & Mobile Device Management Service

import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Locate ADB executable on Windows or system PATH
 */
export function findAdbExecutable() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const userProfile = process.env.USERPROFILE || '';

  const candidates = [
    path.join(localAppData, 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
    path.join(userProfile, 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
    'C:\\platform-tools\\adb.exe',
    'C:\\Program Files\\Android\\platform-tools\\adb.exe',
    'C:\\Program Files (x86)\\Android\\android-sdk\\platform-tools\\adb.exe'
  ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return p;
      }
    } catch {
      // ignore
    }
  }

  // Fallback to 'adb' in PATH
  return 'adb';
}

/**
 * Get Android ADB devices (phones/tablets connected over USB or Wi-Fi)
 */
export async function getAdbDevices() {
  const adbBin = findAdbExecutable();

  return new Promise((resolve) => {
    execFile(adbBin, ['devices', '-l'], { timeout: 4000 }, (err, stdout, _stderr) => {
      if (err) {
        // ADB might not be running or not installed
        return resolve({
          available: false,
          error: err.message,
          devices: []
        });
      }

      const lines = stdout.trim().split('\n');
      const devices = [];

      // Skip the first line: "List of devices attached"
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Example format:
        // R58M1234XYZ device product:a52sxq model:SM_A528B device:a52sxq transport_id:1
        // XYZ123 unauthorized
        const parts = line.split(/\s+/);
        const serial = parts[0];
        const state = parts[1] || 'unknown'; // device, unauthorized, offline

        let model = '';
        let product = '';
        for (let j = 2; j < parts.length; j++) {
          if (parts[j].startsWith('model:')) {
            model = parts[j].replace('model:', '').replace(/_/g, ' ');
          } else if (parts[j].startsWith('product:')) {
            product = parts[j].replace('product:', '');
          }
        }

        const displayName = model || (product ? `Android (${product})` : `Android Phone (${serial})`);

        devices.push({
          id: `adb-${serial}`,
          serial,
          name: displayName,
          model: model || 'Android Mobile Phone',
          state: state === 'device' ? 'READY' : state.toUpperCase(),
          rawState: state,
          type: 'ADB_MOBILE_SCANNER',
          interface: 'USB Debugging (ADB Bridge)',
          isAuthorized: state === 'device'
        });
      }

      resolve({
        available: true,
        adbPath: adbBin,
        devices
      });
    });
  });
}

/**
 * Get connected Windows PnP USB devices (cameras, scanners, composite devices, phones)
 */
export async function getSystemUsbDevices() {
  return new Promise((resolve) => {
    const psScript = `
      $devices = Get-PnpDevice -Class USB, Camera, Image, WPD -PresentOnly -ErrorAction SilentlyContinue | 
        Where-Object { $_.FriendlyName -and $_.Status -eq 'OK' } | 
        Select-Object -First 25 FriendlyName, InstanceId, Class, Status
      if ($devices) {
        $devices | ConvertTo-Json -Compress
      } else {
        "[]"
      }
    `;

    execFile('powershell.exe', ['-NoProfile', '-Command', psScript], { timeout: 6000 }, (err, stdout) => {
      if (err || !stdout) {
        return resolve([]);
      }

      try {
        let parsed = JSON.parse(stdout.trim());
        if (!Array.isArray(parsed)) {
          parsed = [parsed];
        }

        const filtered = parsed
          .filter(d => d && d.FriendlyName)
          .map((d, index) => {
            const isCamera = d.Class === 'Camera' || d.Class === 'Image';
            const isPhone = d.Class === 'WPD' || /phone|galaxy|pixel|android|iphone|mobile/i.test(d.FriendlyName);

            let type = 'USB_PERIPHERAL';
            if (isPhone) type = 'USB_MOBILE_DEVICE';
            else if (isCamera) type = 'USB_VISION_CAMERA';

            return {
              id: `usb-${index}-${(d.InstanceId || '').slice(-8)}`,
              name: d.FriendlyName,
              className: d.Class,
              type,
              status: d.Status || 'OK',
              interface: 'USB 3.2 Direct'
            };
          });

        resolve(filtered);
      } catch {
        resolve([]);
      }
    });
  });
}

/**
 * Query all USB devices across ADB and System PnP
 */
export async function discoverAllUsbDevices(currentConnectedDevice = null) {
  const [adbResult, systemUsbList] = await Promise.all([
    getAdbDevices(),
    getSystemUsbDevices()
  ]);

  const allDevices = [];

  // Add ADB Android Mobile devices first (highest priority for scanner)
  if (adbResult.devices && adbResult.devices.length > 0) {
    adbResult.devices.forEach(dev => {
      allDevices.push({
        ...dev,
        isConnected: currentConnectedDevice && (currentConnectedDevice.id === dev.id || currentConnectedDevice.serial === dev.serial)
      });
    });
  }

  // Add system cameras and mobile devices next
  systemUsbList.forEach(dev => {
    // Avoid exact duplicate if name is very similar
    const duplicate = allDevices.some(d => d.name.toLowerCase() === dev.name.toLowerCase());
    if (!duplicate) {
      allDevices.push({
        ...dev,
        isConnected: currentConnectedDevice && (currentConnectedDevice.id === dev.id || currentConnectedDevice.name === dev.name)
      });
    }
  });

  return {
    adbAvailable: adbResult.available,
    adbPath: adbResult.adbPath || null,
    totalFound: allDevices.length,
    devices: allDevices
  };
}
