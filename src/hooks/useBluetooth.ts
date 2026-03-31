/**
 * useBluetooth — Impresoras Bluetooth para recibos térmicos.
 * Soporte dual:
 * - Nativo (Android): usa @capacitor-community/bluetooth-le
 * - Web (PWA): usa la Web Bluetooth API (solo Chrome/Edge)
 *
 * Protocolo ESC/POS para impresoras térmicas de 58mm/80mm.
 * Regla: si Bluetooth no está disponible, el recibo se muestra en pantalla.
 */
import { useCallback, useState } from 'react';
import { useCapacitor } from './useCapacitor';

export type BluetoothStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';

export interface BluetoothDevice {
  id: string;
  name: string;
}

interface UseBluetoothReturn {
  status: BluetoothStatus;
  connectedDevice: BluetoothDevice | null;
  isAvailable: boolean;
  /** Escanea y devuelve dispositivos Bluetooth cercanos */
  scan: () => Promise<BluetoothDevice[]>;
  /** Conecta a un dispositivo por ID */
  connect: (deviceId: string) => Promise<boolean>;
  /** Desconecta el dispositivo actual */
  disconnect: () => Promise<void>;
  /** Imprime texto en formato ESC/POS */
  print: (text: string) => Promise<boolean>;
}

// ─── Helpers ESC/POS ─────────────────────────────────────────────────────────

const ESC = 0x1b;
const GS = 0x1d;

/**
 * Convierte texto plano a bytes ESC/POS básicos.
 * Para impresoras de 58mm/80mm estándar.
 */
function buildEscPosBuffer(text: string): Uint8Array {
  const encoder = new TextEncoder();
  const initPrinter = new Uint8Array([ESC, 0x40]);           // Reset
  const centerAlign = new Uint8Array([ESC, 0x61, 0x01]);     // Centrar
  const leftAlign = new Uint8Array([ESC, 0x61, 0x00]);       // Izquierda
  const boldOn = new Uint8Array([ESC, 0x45, 0x01]);          // Negrita ON
  const boldOff = new Uint8Array([ESC, 0x45, 0x00]);         // Negrita OFF
  const cutPaper = new Uint8Array([GS, 0x56, 0x42, 0x00]);   // Cortar papel
  const textBytes = encoder.encode(text + '\n\n\n');

  const parts = [initPrinter, centerAlign, boldOn, boldOff, leftAlign, textBytes, cutPaper];
  const total = parts.reduce((acc, p) => acc + p.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) { result.set(p, offset); offset += p.length; }
  return result;
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useBluetooth(): UseBluetoothReturn {
  const { isNative, isAndroid } = useCapacitor();
  const [status, setStatus] = useState<BluetoothStatus>('idle');
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null);

  // Disponibilidad: nativo Android o Web Bluetooth API
  const isAvailable = isNative && isAndroid
    ? true // Capacitor siempre tiene acceso via plugin
    : typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  // ─── NATIVO: @capacitor-community/bluetooth-le ──────────────────────────────

  const scanNative = useCallback(async (): Promise<BluetoothDevice[]> => {
    try {
      const { BleClient } = await import('@capacitor-community/bluetooth-le');
      setStatus('scanning');
      await BleClient.initialize({ androidNeverForLocation: true });

      const found: BluetoothDevice[] = [];
      await BleClient.requestLEScan(
        { allowDuplicates: false },
        (result) => {
          if (result.device.name) {
            found.push({ id: result.device.deviceId, name: result.device.name });
          }
        }
      );
      // Escaneo por 5 segundos
      await new Promise(r => setTimeout(r, 5000));
      await BleClient.stopLEScan();
      setStatus('idle');
      return found;
    } catch (error) {
      console.error('[Bluetooth] Error scan nativo:', error);
      setStatus('error');
      return [];
    }
  }, []);

  const connectNative = useCallback(async (deviceId: string): Promise<boolean> => {
    try {
      const { BleClient } = await import('@capacitor-community/bluetooth-le');
      setStatus('connecting');
      await BleClient.connect(deviceId, () => {
        // Callback de desconexión inesperada
        setConnectedDevice(null);
        setStatus('idle');
      });
      setConnectedDevice({ id: deviceId, name: deviceId });
      setStatus('connected');
      return true;
    } catch (error) {
      console.error('[Bluetooth] Error conectar nativo:', error);
      setStatus('error');
      return false;
    }
  }, []);

  const disconnectNative = useCallback(async () => {
    if (!connectedDevice) return;
    try {
      const { BleClient } = await import('@capacitor-community/bluetooth-le');
      await BleClient.disconnect(connectedDevice.id);
    } finally {
      setConnectedDevice(null);
      setStatus('idle');
    }
  }, [connectedDevice]);

  const printNative = useCallback(async (text: string): Promise<boolean> => {
    // Para impresoras BLE ESC/POS, escribimos a la característica de escritura
    // UUID estándar de impresoras: 0000ff02-0000-1000-8000-00805f9b34fb
    const PRINT_SERVICE = '000018f0-0000-1000-8000-00805f9b34fb';
    const PRINT_CHAR = '00002af1-0000-1000-8000-00805f9b34fb';

    if (!connectedDevice) return false;
    try {
      const { BleClient } = await import('@capacitor-community/bluetooth-le');
      const data = buildEscPosBuffer(text);
      // Enviar en chunks de 512 bytes (límite BLE)
      const CHUNK = 512;
      for (let i = 0; i < data.length; i += CHUNK) {
        await BleClient.write(
          connectedDevice.id,
          PRINT_SERVICE,
          PRINT_CHAR,
          new DataView(data.buffer, i, Math.min(CHUNK, data.length - i))
        );
        await new Promise(r => setTimeout(r, 50));
      }
      return true;
    } catch (error) {
      console.error('[Bluetooth] Error imprimir nativo:', error);
      return false;
    }
  }, [connectedDevice]);

  // ─── WEB: Web Bluetooth API ─────────────────────────────────────────────────

  const webDeviceRef = { current: null as BluetoothRemoteGATTCharacteristic | null };

  const scanWeb = useCallback(async (): Promise<BluetoothDevice[]> => {
    if (!('bluetooth' in navigator)) return [];
    try {
      setStatus('scanning');
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'],
      });
      setStatus('idle');
      return [{ id: device.id, name: device.name ?? 'Impresora' }];
    } catch {
      setStatus('idle');
      return [];
    }
  }, []);

  const connectWeb = useCallback(async (deviceId: string): Promise<boolean> => {
    // En Web Bluetooth, la conexión ocurre durante el scan (requestDevice)
    // Aquí solo actualizamos el estado
    setConnectedDevice({ id: deviceId, name: 'Impresora' });
    setStatus('connected');
    return true;
  }, []);

  const disconnectWeb = useCallback(async () => {
    setConnectedDevice(null);
    setStatus('idle');
    webDeviceRef.current = null;
  }, []);

  const printWeb = useCallback(async (text: string): Promise<boolean> => {
    if (!webDeviceRef.current) return false;
    try {
      const data = buildEscPosBuffer(text);
      // Copia explícita a ArrayBuffer para satisfacer el tipo de writeValue
      const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      await webDeviceRef.current.writeValue(buffer);
      return true;
    } catch (error) {
      console.error('[Bluetooth] Error imprimir web:', error);
      return false;
    }
  }, []);

  // ─── API pública unificada ──────────────────────────────────────────────────

  const scan = useCallback(async () => {
    if (isNative && isAndroid) return scanNative();
    return scanWeb();
  }, [isNative, isAndroid, scanNative, scanWeb]);

  const connect = useCallback(async (deviceId: string) => {
    if (isNative && isAndroid) return connectNative(deviceId);
    return connectWeb(deviceId);
  }, [isNative, isAndroid, connectNative, connectWeb]);

  const disconnect = useCallback(async () => {
    if (isNative && isAndroid) return disconnectNative();
    return disconnectWeb();
  }, [isNative, isAndroid, disconnectNative, disconnectWeb]);

  const print = useCallback(async (text: string) => {
    if (isNative && isAndroid) return printNative(text);
    return printWeb(text);
  }, [isNative, isAndroid, printNative, printWeb]);

  return { status, connectedDevice, isAvailable, scan, connect, disconnect, print };
}
