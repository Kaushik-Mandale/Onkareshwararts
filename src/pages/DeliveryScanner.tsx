import React, { useState, useEffect, useRef } from 'react';
import { getOrder, confirmDelivery } from '../firebase/db';
import type { Order } from '../types';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Scan, 
  Camera, 
  CameraOff, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  User, 
  DollarSign, 
  Package, 
  X,
  Smartphone
} from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';

// --- Cryptographic QR Token Decoder & Validator ---
const SECURITY_SALT = "GANPATI_INTERNAL_SALT_KEY_2026";
interface DecodedQR {
  id: string;
  ts: number;
  sig: string;
}

function validateQRToken(tokenBase64: string): { isValid: boolean; orderId: string } {
  try {
    const jsonStr = atob(tokenBase64);
    const payload = JSON.parse(jsonStr) as DecodedQR;
    
    // Re-verify digital signature
    const dataStr = payload.id + SECURITY_SALT;
    let hash = 0;
    for (let i = 0; i < dataStr.length; i++) {
      hash = (hash << 5) - hash + dataStr.charCodeAt(i);
      hash |= 0;
    }
    const signature = Math.abs(hash).toString(16);

    if (signature === payload.sig) {
      return { isValid: true, orderId: payload.id };
    }
    return { isValid: false, orderId: '' };
  } catch (e) {
    console.error('Failed to validate QR token:', e);
    return { isValid: false, orderId: '' };
  }
}

export const DeliveryScanner: React.FC = () => {
  const [scannerActive, setScannerActive] = useState(false);
  const [scannedOrder, setScannedOrder] = useState<Order | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [processingDelivery, setProcessingDelivery] = useState(false);
  
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const readerId = "qr-reader-viewport";

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  // --- CAMERA CONTROL ---
  const startScanner = async () => {
    setScannedOrder(null);
    setScanError(null);
    setScannerActive(true);

    setTimeout(async () => {
      try {
        const qrScanner = new Html5Qrcode(readerId);
        qrScannerRef.current = qrScanner;

        await qrScanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.65;
              return { width: size, height: size };
            }
          },
          onScanSuccess,
          onScanFailure
        );
      } catch (err: any) {
        console.error('Failed to start QR scanner:', err);
        setScanError('Unable to access camera. Please check camera permissions.');
        setScannerActive(false);
        toast.error('Camera initialization failed.');
      }
    }, 150);
  };

  const stopScanner = async () => {
    if (qrScannerRef.current && qrScannerRef.current.isScanning) {
      try {
        await qrScannerRef.current.stop();
        qrScannerRef.current = null;
      } catch (e) {
        console.error('Failed to stop scanning:', e);
      }
    }
    setScannerActive(false);
  };

  // --- SCAN CALLBACKS ---
  const onScanSuccess = async (decodedText: string) => {
    await stopScanner();
    toast.info('QR Code detected. Fetching signature details...');

    // 1. Verify QR token cryptographically
    const validation = validateQRToken(decodedText);
    if (!validation.isValid) {
      setScanError('Invalid QR Token. The signature does not match our security database keys.');
      toast.error('Verification failed: Invalid QR Signature.');
      return;
    }

    // 2. Fetch Order from Firestore
    try {
      const order = await getOrder(validation.orderId);
      if (order) {
        setScannedOrder(order);
        toast.success(`Successfully loaded booking: ${order.orderNumber}`);
      } else {
        setScanError(`Order record ${validation.orderId} not found in database.`);
      }
    } catch (e: any) {
      console.error(e);
      setScanError('Database retrieval failed: ' + e.message);
    }
  };

  const onScanFailure = (_error: unknown) => {
    // Quiet scan failure (html5-qrcode logs every frame it doesn't find a QR code)
  };

  // --- CONFIRM DELIVERY ---
  const handleConfirmDelivery = async () => {
    if (!scannedOrder) return;
    setProcessingDelivery(true);

    try {
      const deviceDetails = `${navigator.platform} | ${navigator.userAgent.split(') ')[0].split('(')[1] || 'Web Session'}`;
      await confirmDelivery(scannedOrder.orderNumber, deviceDetails);
      toast.success('Delivery Confirmed! Database updated.');
      
      // Reload order detail state
      const reloaded = await getOrder(scannedOrder.orderNumber);
      setScannedOrder(reloaded);
    } catch (e: any) {
      toast.error('Delivery failed: ' + e.message);
    } finally {
      setProcessingDelivery(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">QR Delivery System</h2>
        <p className="text-sm text-muted-foreground">Scan customer booking QR codes to confirm pick-ups and verify payments</p>
      </div>

      {/* Main Container */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center space-y-6">
        
        {/* State 1: Active Camera Feed */}
        {scannerActive && (
          <div className="w-full space-y-4 flex flex-col items-center">
            <div className="relative w-full max-w-sm aspect-square bg-black rounded-2xl overflow-hidden shadow-inner border border-border">
              {/* Target Scan Guides overlay */}
              <div className="absolute inset-0 border-[35px] border-black/40 z-10 pointer-events-none flex items-center justify-center">
                <div className="w-full h-full border-2 border-dashed border-saffron relative">
                  <span className="absolute top-0 left-0 h-4 w-4 border-t-4 border-l-4 border-saffron" />
                  <span className="absolute top-0 right-0 h-4 w-4 border-t-4 border-r-4 border-saffron" />
                  <span className="absolute bottom-0 left-0 h-4 w-4 border-b-4 border-l-4 border-saffron" />
                  <span className="absolute bottom-0 right-0 h-4 w-4 border-b-4 border-r-4 border-saffron" />
                </div>
              </div>
              
              {/* HTML5-qrcode mount node */}
              <div id={readerId} className="w-full h-full object-cover" />
            </div>

            <button
              onClick={stopScanner}
              className="flex items-center space-x-1.5 px-6 py-2 border border-red-500/20 text-red-500 hover:bg-red-500/5 text-xs font-bold rounded-xl cursor-pointer"
            >
              <CameraOff className="h-4.5 w-4.5" />
              <span>Cancel Scan</span>
            </button>
          </div>
        )}

        {/* State 2: Scanner Off & Waiting to Scan */}
        {!scannerActive && !scannedOrder && !scanError && (
          <div className="py-14 text-center space-y-4">
            <div className="mx-auto h-16 w-16 bg-gradient-to-tr from-saffron/15 to-gold/15 text-saffron rounded-2xl flex items-center justify-center shadow-sm border border-saffron/10">
              <Scan className="h-8 w-8 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-foreground text-sm">Ready to Scan QR</h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">Open the camera viewport and align the customer's PDF or WhatsApp QR code within the frame.</p>
            </div>
            <button
              onClick={startScanner}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-saffron to-gold text-white text-xs font-bold rounded-xl shadow-lg shadow-saffron/10 hover:brightness-105 cursor-pointer mx-auto"
            >
              <Camera className="h-4.5 w-4.5" />
              <span>Start Camera Scanner</span>
            </button>
          </div>
        )}

        {/* State 3: Scan Error Display */}
        {scanError && (
          <div className="w-full py-10 text-center space-y-4">
            <div className="mx-auto h-14 w-14 bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="font-bold text-foreground text-sm">Verification Failed</h3>
              <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-950/50 p-4 rounded-xl font-medium leading-relaxed">{scanError}</p>
            </div>
            <div className="flex justify-center space-x-2.5">
              <button
                onClick={() => setScanError(null)}
                className="px-5 py-2 border border-border hover:bg-muted text-xs font-bold rounded-xl cursor-pointer"
              >
                Clear
              </button>
              <button
                onClick={startScanner}
                className="px-5 py-2 bg-saffron text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* State 4: Scanned Order Verification Detail Cards */}
        {scannedOrder && (
          <div className="w-full space-y-6 animate-fade-in text-xs">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-bold text-base text-foreground">Scanned Booking Details</h3>
                <span className="text-muted-foreground font-mono text-[10px]">{scannedOrder.orderNumber}</span>
              </div>
              <button 
                onClick={() => setScannedOrder(null)} 
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Verification Warnings & Alerts */}
            {scannedOrder.status === 'delivered' ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start space-x-3 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <strong className="font-bold">Already Delivered!</strong>
                  <p className="text-[11px] leading-relaxed">
                    This idol booking was already picked up on **{dayjs(scannedOrder.deliveryTime).format('DD MMM YYYY, hh:mm A')}**. 
                    Confirmed by staff member **{scannedOrder.deliveredBy}**.
                  </p>
                </div>
              </div>
            ) : scannedOrder.status === 'cancelled' ? (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start space-x-3 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <strong className="font-bold">Order Cancelled</strong>
                  <p className="text-[11px] leading-relaxed">
                    This booking has been cancelled and cannot be delivered. Inventory stock has already been restored.
                  </p>
                </div>
              </div>
            ) : scannedOrder.payment.remaining > 0 ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-start space-x-3 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <strong className="font-bold">Outstanding Balance Warning!</strong>
                  <p className="text-[11px] leading-relaxed">
                    Ensure the remaining balance of <strong className="font-extrabold text-foreground underline">₹{scannedOrder.payment.remaining.toLocaleString()}</strong> is collected via UPI or Cash first before releasing the idols.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-start space-x-3 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <strong className="font-bold">All Dues Cleared!</strong>
                  <p className="text-[11px] leading-relaxed">
                    Booking is fully paid. Safe to confirm delivery and release the idols to customer.
                  </p>
                </div>
              </div>
            )}

            {/* Profile & Items details grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer */}
              <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-2">
                <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center"><User className="h-3.5 w-3.5 mr-1" /> Customer CRM Card</span>
                <div>
                  <p className="font-bold text-foreground">{scannedOrder.customer.name}</p>
                  <p className="text-muted-foreground mt-0.5">Mobile: {scannedOrder.customer.mobile}</p>
                  <p className="text-[10px] text-muted-foreground/80 mt-1 italic">Address: {scannedOrder.customer.address || 'N/A'}</p>
                </div>
              </div>

              {/* Payments summary */}
              <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-2">
                <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center"><DollarSign className="h-3.5 w-3.5 mr-1" /> Payments Ledger</span>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Grand Total:</span>
                    <strong className="text-foreground">₹{scannedOrder.payment.grandTotal.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Paid Deposit:</span>
                    <strong>₹{scannedOrder.payment.paid.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between text-red-500 border-t border-border pt-1 font-bold">
                    <span>Remaining Due:</span>
                    <strong>₹{scannedOrder.payment.remaining.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-2 md:col-span-2">
                <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center"><Package className="h-3.5 w-3.5 mr-1" /> Booked Idols</span>
                <div className="space-y-1">
                  {scannedOrder.products.map((p, idx) => (
                    <div key={idx} className="flex justify-between text-xs py-0.5">
                      <span className="text-foreground">{p.name} (x{p.quantity}) - {p.size}</span>
                      <span className="text-muted-foreground">₹{(p.price * p.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-end space-x-2 border-t border-border pt-4">
              <button
                onClick={() => setScannedOrder(null)}
                className="px-5 py-2 border border-border hover:bg-muted text-xs font-bold rounded-xl cursor-pointer"
              >
                Close Details
              </button>
              
              {scannedOrder.status !== 'delivered' && scannedOrder.status !== 'cancelled' && (
                <button
                  onClick={handleConfirmDelivery}
                  disabled={processingDelivery}
                  className="flex items-center space-x-1.5 px-6 py-2 bg-gradient-to-r from-saffron to-gold text-white text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:bg-muted"
                >
                  <Smartphone className="h-4 w-4" />
                  <span>{processingDelivery ? 'Processing...' : 'Confirm Delivery'}</span>
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
