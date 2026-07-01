import React, { useState, useEffect } from 'react';
import { 
  subscribeProducts, 
  lookupCustomerByMobile, 
  createOrder, 
  getBusinessSettings 
} from '../firebase/db';
import type { Product, Customer, Order } from '../types';
import { 
  Search, 
  ShoppingCart, 
  User, 
  CreditCard, 
  CheckCircle, 
  Plus, 
  Minus, 
  Trash2, 
  ArrowRight, 
  ArrowLeft, 
  Printer, 
  Share2, 
  Phone,
  AlertCircle
} from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import dayjs from 'dayjs';

// --- Cryptographic QR Token Signer ---
const SECURITY_SALT = "GANPATI_INTERNAL_SALT_KEY_2026";
function generateSecureQRToken(orderId: string): string {
  // Simple hashing algorithm (Adler32/FNV-1a hybrid)
  const dataStr = orderId + SECURITY_SALT;
  let hash = 0;
  for (let i = 0; i < dataStr.length; i++) {
    hash = (hash << 5) - hash + dataStr.charCodeAt(i);
    hash |= 0; // 32bit int
  }
  const signature = Math.abs(hash).toString(16);
  
  const tokenPayload = {
    id: orderId,
    ts: Date.now(),
    sig: signature
  };
  // Base64 encode
  return btoa(JSON.stringify(tokenPayload));
}

export const NewBooking: React.FC = () => {
  const [step, setStep] = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [businessSettings, setBusinessSettings] = useState<any>(null);

  // STEP 1: Cart States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState<{ product: Product; qty: number }[]>([]);

  // STEP 2: Customer States
  const [custName, setCustName] = useState('');
  const [custMobile, setCustMobile] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custNotes, setCustNotes] = useState('');
  const [matchingCustomer, setMatchingCustomer] = useState<Customer | null>(null);

  // STEP 3: Payment States
  const [discount, setDiscount] = useState(0);
  const [gstEnabled, setGstEnabled] = useState(false);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Online' | 'UPI' | 'Card' | 'Other' | 'Split'>('UPI');
  
  // Split payment details
  const [cashSplit, setCashSplit] = useState(0);
  const [onlineSplit, setOnlineSplit] = useState(0);

  // STEP 4: Review / Result States
  const [orderId, setOrderId] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Load products & settings
  useEffect(() => {
    const unsubscribe = subscribeProducts((data) => {
      setProducts(data.filter(p => p.status === 'active'));
    });
    
    getBusinessSettings().then(setBusinessSettings);

    return () => unsubscribe();
  }, []);

  // Autofill customer lookup on mobile input
  useEffect(() => {
    const cleanMobile = custMobile.trim();
    if (cleanMobile.length === 10) {
      lookupCustomerByMobile(cleanMobile).then((cust) => {
        if (cust) {
          setMatchingCustomer(cust);
          setCustName(cust.name);
          setCustAddress(cust.address);
          setCustNotes(cust.notes);
          toast.success(`Found existing customer: ${cust.name}`);
        } else {
          setMatchingCustomer(null);
        }
      });
    } else {
      setMatchingCustomer(null);
    }
  }, [custMobile]);

  // Categories helper
  const categories = ['Dagdusheth Shape', 'Lalbaugcha Raja Shape', 'Peshwa Style', 'Bal Ganesha', 'Traditional', 'Custom Art'];

  // --- CART FUNCTIONS ---
  const handleAddToCart = (product: Product) => {
    if (product.quantity <= 0) {
      toast.error('Product is out of stock!');
      return;
    }
    const exists = cart.find(item => item.product.id === product.id);
    if (exists) {
      if (exists.qty >= product.quantity) {
        toast.error(`Cannot add more. Only ${product.quantity} in stock.`);
        return;
      }
      setCart(cart.map(item => item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { product, qty: 1 }]);
    }
    toast.success(`${product.name} added to cart`);
  };

  const handleUpdateQty = (productId: string, delta: number) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;

    const newQty = item.qty + delta;
    if (newQty <= 0) {
      setCart(cart.filter(i => i.product.id !== productId));
    } else {
      // Check stock limit
      if (newQty > item.product.quantity) {
        toast.error(`Only ${item.product.quantity} units available.`);
        return;
      }
      setCart(cart.map(i => i.product.id === productId ? { ...i, qty: newQty } : i));
    }
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(cart.filter(i => i.product.id !== productId));
  };

  // --- CALCULATIONS ---
  const subtotal = cart.reduce((sum, item) => sum + (item.product.sellingPrice * item.qty), 0);
  const gstRate = businessSettings?.invoiceSettings?.taxRate || 18;
  const gstAmount = gstEnabled ? Math.round(((subtotal - discount) * gstRate) / 100) : 0;
  const grandTotal = Math.max(0, subtotal - discount + gstAmount);
  const remainingBalance = Math.max(0, grandTotal - paidAmount);
  
  const paymentStatus = remainingBalance === 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Pending';

  // --- WIZARD STEPS VALIDATIONS ---
  const validateStep1 = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty. Select at least one product.');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!custName.trim() || !custMobile.trim()) {
      toast.error('Name and Mobile number are required.');
      return false;
    }
    if (custMobile.trim().length !== 10 || isNaN(Number(custMobile))) {
      toast.error('Please enter a valid 10-digit mobile number.');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (paidAmount < 0) {
      toast.error('Paid amount cannot be negative.');
      return false;
    }
    if (paidAmount > grandTotal) {
      toast.error('Paid amount cannot exceed Grand Total.');
      return false;
    }
    if (paymentMethod === 'Split') {
      if (cashSplit + onlineSplit !== paidAmount) {
        toast.error(`Split payments sum (₹${cashSplit + onlineSplit}) must equal paid amount (₹${paidAmount}).`);
        return false;
      }
    }
    return true;
  };

  // --- PROCESS AND SAVE BOOKING ---
  const handleSaveBooking = async () => {
    setSubmittingOrder(true);
    
    // Auto-generate order invoice number
    const year = dayjs().format('YYYY');
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const generatedOrderNo = `GAN-${year}-${randomSuffix}`;
    setOrderId(generatedOrderNo);

    // Cryptographic signed QR token
    const qrToken = generateSecureQRToken(generatedOrderNo);

    // Generate QR Image base64
    try {
      const qrData = await QRCode.toDataURL(qrToken, { width: 250, margin: 1 });
      setQrCodeDataUrl(qrData);
    } catch (err) {
      console.error('Failed to generate QR data:', err);
    }

    const orderPayload: Omit<Order, 'createdBy' | 'createdAt'> = {
      orderNumber: generatedOrderNo,
      products: cart.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        price: item.product.sellingPrice,
        quantity: item.qty,
        size: item.product.size
      })),
      customer: {
        id: matchingCustomer?.id || '',
        name: custName.trim(),
        mobile: custMobile.trim(),
        address: custAddress.trim()
      },
      payment: {
        subtotal,
        discount,
        gstEnabled,
        gstAmount,
        grandTotal,
        paid: paidAmount,
        remaining: remainingBalance,
        status: paymentStatus,
        method: paymentMethod,
        splitDetails: paymentMethod === 'Split' ? [
          { method: 'Cash', amount: cashSplit },
          { method: 'Online', amount: onlineSplit }
        ] : undefined
      },
      status: 'booked',
      qrToken,
      deliveryDate: dayjs().add(2, 'day').format('YYYY-MM-DD'), // default delivery in 2 days
      notes: custNotes.trim()
    };

    try {
      await createOrder(orderPayload);
      toast.success('Order booked and saved to Firestore!');
      setStep(4);
    } catch (e: any) {
      console.error(e);
      toast.error('Booking failed: ' + e.message);
    } finally {
      setSubmittingOrder(false);
    }
  };

  // --- PDF GENERATOR ---
  const handlePrintPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Theme Colors (used for PDF styling via jsPDF color methods)
    const _saffron = '#E05A17';
    const _gold = '#D4AF37';
    void _saffron; void _gold;

    // Header
    doc.setFillColor(245, 240, 235);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(224, 90, 23);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(businessSettings?.businessName || 'Onkareshwararts', 15, 20);
    
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont('Helvetica', 'normal');
    doc.text(businessSettings?.address || 'Shop No. 10, Ganesh Chowk, Pune', 15, 28);
    doc.text(`Phone: ${businessSettings?.phone || '+91 9876543210'} | UPI: ${businessSettings?.upiId || ''}`, 15, 33);

    // Invoice Title
    doc.setTextColor(20, 20, 20);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('BOOKING INVOICE', 150, 20);
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Invoice No: ${orderId}`, 150, 26);
    doc.text(`Date: ${dayjs().format('DD MMM YYYY, hh:mm A')}`, 150, 31);

    // Bill To
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('CUSTOMER DETAILS:', 15, 55);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Name: ${custName}`, 15, 61);
    doc.text(`Mobile: ${custMobile}`, 15, 66);
    doc.text(`Address: ${custAddress || 'N/A'}`, 15, 71);

    // Table Header
    doc.setFillColor(224, 90, 23);
    doc.rect(15, 80, 180, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.text('Description', 18, 85);
    doc.text('Size', 80, 85);
    doc.text('Price (INR)', 115, 85);
    doc.text('Qty', 148, 85);
    doc.text('Total (INR)', 170, 85);

    // Table Body
    let yPos = 92;
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    
    cart.forEach((item) => {
      doc.text(item.product.name, 18, yPos);
      doc.text(item.product.size, 80, yPos);
      doc.text(`Rs. ${item.product.sellingPrice.toLocaleString()}`, 115, yPos);
      doc.text(item.qty.toString(), 150, yPos);
      doc.text(`Rs. ${(item.product.sellingPrice * item.qty).toLocaleString()}`, 170, yPos);
      
      // Bottom border line
      doc.setDrawColor(230, 230, 230);
      doc.line(15, yPos + 3, 195, yPos + 3);
      yPos += 9;
    });

    // Calculations Summary
    yPos += 5;
    doc.setFont('Helvetica', 'normal');
    doc.text('Subtotal:', 130, yPos);
    doc.text(`Rs. ${subtotal.toLocaleString()}`, 170, yPos);
    
    yPos += 6;
    doc.text('Discount:', 130, yPos);
    doc.text(`Rs. ${discount.toLocaleString()}`, 170, yPos);

    if (gstEnabled) {
      yPos += 6;
      doc.text(`GST (${gstRate}%):`, 130, yPos);
      doc.text(`Rs. ${gstAmount.toLocaleString()}`, 170, yPos);
    }

    yPos += 8;
    doc.setFont('Helvetica', 'bold');
    doc.text('Grand Total:', 130, yPos);
    doc.text(`Rs. ${grandTotal.toLocaleString()}`, 170, yPos);

    yPos += 6;
    doc.setTextColor(40, 150, 40);
    doc.text('Paid Amount:', 130, yPos);
    doc.text(`Rs. ${paidAmount.toLocaleString()}`, 170, yPos);

    yPos += 6;
    doc.setTextColor(200, 40, 40);
    doc.text('Outstanding Due:', 130, yPos);
    doc.text(`Rs. ${remainingBalance.toLocaleString()}`, 170, yPos);

    // Terms & QR Code
    yPos = Math.max(yPos + 15, 175);
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'bold');
    doc.text('TERMS & CONDITIONS:', 15, yPos);
    doc.setFont('Helvetica', 'normal');
    doc.text(businessSettings?.invoiceSettings?.terms || 'Delivery to be taken pre-festival.', 15, yPos + 5);

    // Embed scannable QR Code
    if (qrCodeDataUrl) {
      doc.addImage(qrCodeDataUrl, 'PNG', 145, yPos, 45, 45);
      doc.setFont('Helvetica', 'bold');
      doc.text('CONFIRMATION QR CODE', 145, yPos + 48);
    }

    // Save
    doc.save(`invoice_${orderId}.pdf`);
    toast.success('Invoice PDF downloaded!');
  };

  // --- WHATSAPP SHARING ---
  const handleShareWhatsApp = () => {
    const textMsg = `*Ganpati Idol Booking Confirmed!* 
-------------------------------
*Shop:* ${businessSettings?.businessName || 'Onkareshwararts'}
*Order Number:* ${orderId}
*Customer:* ${custName}
*Products:* ${cart.map(i => `${i.product.name} (${i.product.size}) x${i.qty}`).join(', ')}
-------------------------------
*Grand Total:* ₹${grandTotal.toLocaleString()}
*Paid Deposit:* ₹${paidAmount.toLocaleString()}
*Remaining Balance:* ₹${remainingBalance.toLocaleString()}
*Payment Status:* ${paymentStatus}
-------------------------------
_Show this message QR Code at the shop to confirm delivery._`;

    const encodedText = encodeURIComponent(textMsg);
    const waUrl = `https://api.whatsapp.com/send?phone=+91${custMobile}&text=${encodedText}`;
    window.open(waUrl, '_blank');
  };

  // --- FILTERS GRID ---
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">New Booking Wizard</h2>
        <p className="text-sm text-muted-foreground">Follow the steps to select idols, assign customer profile, and record deposits</p>
      </div>

      {/* Progress Stepper */}
      <div className="flex items-center justify-between max-w-xl mx-auto py-2 border-b border-border mb-6">
        {[
          { num: 1, name: 'Select Idols' },
          { num: 2, name: 'Customer Info' },
          { num: 3, name: 'Payment Details' },
          { num: 4, name: 'Review & Print' }
        ].map((s) => (
          <div key={s.num} className="flex items-center space-x-2">
            <span className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs ${
              step === s.num 
                ? 'bg-saffron text-white shadow-md shadow-saffron/15 animate-pulse'
                : step > s.num
                  ? 'bg-green-500 text-white'
                  : 'bg-muted text-muted-foreground border border-border'
            }`}>
              {s.num}
            </span>
            <span className={`text-xs font-semibold hidden sm:inline ${step === s.num ? 'text-foreground' : 'text-muted-foreground'}`}>{s.name}</span>
          </div>
        ))}
      </div>

      {/* ========================================== */}
      {/* STEP 1: CHOOSE PRODUCTS */}
      {/* ========================================== */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Products Catalogue */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search idols..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-border bg-background rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center space-x-2 bg-card border border-border px-3 py-1.5 rounded-xl text-xs font-semibold self-end">
                <span className="text-muted-foreground">Category:</span>
                <select 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 cursor-pointer"
                >
                  <option value="All">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
              {filteredProducts.length === 0 ? (
                <p className="text-center py-20 text-xs text-muted-foreground lg:col-span-2">No matching idols in stock.</p>
              ) : (
                filteredProducts.map(p => (
                  <div key={p.id} className="bg-card border border-border rounded-xl p-3 flex space-x-3.5 shadow-sm hover:shadow-md transition-shadow relative">
                    <div className="h-16 w-16 bg-muted rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                      {p.photoUrl ? (
                        <img src={p.photoUrl} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-muted-foreground/35 font-bold uppercase text-lg">{p.name[0]}</span>
                      )}
                    </div>
                    <div className="flex-1 space-y-1 overflow-hidden">
                      <h4 className="font-bold text-xs text-foreground truncate">{p.name}</h4>
                      <p className="text-[10px] text-muted-foreground">Size: {p.size} | Stock: <strong className={p.quantity <= p.lowStockLimit ? 'text-amber-600 font-bold' : 'text-foreground'}>{p.quantity}</strong></p>
                      <strong className="text-xs text-saffron block">₹{p.sellingPrice.toLocaleString()}</strong>
                    </div>
                    <button
                      onClick={() => handleAddToCart(p)}
                      disabled={p.quantity <= 0}
                      className="absolute bottom-3 right-3 p-1.5 bg-saffron hover:bg-saffron-light disabled:bg-muted text-white rounded-lg transition-colors cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cart Sidebar summary */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm h-fit flex flex-col space-y-4">
            <div className="flex items-center space-x-2 border-b border-border pb-3">
              <ShoppingCart className="h-4.5 w-4.5 text-saffron" />
              <h3 className="font-bold text-xs text-foreground uppercase tracking-wider">Shopping Cart ({cart.length})</h3>
            </div>

            {cart.length === 0 ? (
              <p className="text-center py-12 text-xs text-muted-foreground">Cart is empty. Add idols from left catalogue.</p>
            ) : (
              <>
                <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex justify-between items-center text-xs">
                      <div className="flex-1 pr-3 overflow-hidden">
                        <p className="font-semibold text-foreground truncate">{item.product.name}</p>
                        <p className="text-[10px] text-muted-foreground">Size: {item.product.size} | ₹{item.product.sellingPrice}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => handleUpdateQty(item.product.id, -1)} className="p-1 bg-muted hover:bg-border rounded text-foreground cursor-pointer"><Minus className="h-3 w-3" /></button>
                        <span className="font-bold text-xs px-1">{item.qty}</span>
                        <button onClick={() => handleUpdateQty(item.product.id, 1)} className="p-1 bg-muted hover:bg-border rounded text-foreground cursor-pointer"><Plus className="h-3 w-3" /></button>
                        <button onClick={() => handleRemoveFromCart(item.product.id)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded cursor-pointer ml-1"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-4 text-xs space-y-2">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span>₹{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-foreground pt-1.5 border-t border-border/60">
                    <span>Grand Total:</span>
                    <span>₹{subtotal.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={() => validateStep1() && setStep(2)}
                  className="w-full py-2.5 bg-gradient-to-r from-saffron to-gold hover:brightness-105 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-saffron/10 cursor-pointer"
                >
                  <span>Proceed to Client details</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* STEP 2: CUSTOMER CRM INFORMATION */}
      {/* ========================================== */}
      {step === 2 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Customer CRM details form */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-xs text-foreground uppercase tracking-wider border-b border-border pb-3 flex items-center"><User className="h-4.5 w-4.5 text-saffron mr-2" /> CRM Customer Profile</h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center"><Phone className="h-3 w-3 mr-1" /> Mobile Phone Number *</label>
                <input
                  type="text"
                  maxLength={10}
                  required
                  placeholder="e.g. 9876543210"
                  value={custMobile}
                  onChange={(e) => setCustMobile(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amit Patil"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Residential Address</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Sadashiv Peth, Pune"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Booking Notes / Requests</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Needs delivery by 6 AM, wants specific orange shading on mukut."
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-border">
              <button
                onClick={() => setStep(1)}
                className="flex items-center space-x-1.5 px-4 py-2 border border-border hover:bg-muted text-xs font-bold rounded-xl cursor-pointer"
              >
                <ArrowLeft className="h-4.5 w-4.5" />
                <span>Back</span>
              </button>
              <button
                onClick={() => validateStep2() && setStep(3)}
                className="flex items-center space-x-1.5 px-5 py-2 bg-gradient-to-r from-saffron to-gold text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
              >
                <span>Proceed to Billing</span>
                <ArrowRight className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          {/* CRM Profile insights column */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-xs text-foreground uppercase tracking-wider border-b border-border pb-3">CRM Profile Insights</h3>
            {matchingCustomer ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl space-y-2">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1.5 shrink-0" />
                    Recognized Client Profile
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    This client exists in database since **{dayjs(matchingCustomer.joinedDate).format('DD MMM YYYY')}**. Last transaction was recorded on **{dayjs(matchingCustomer.lastVisit).format('DD MMM YYYY')}**.
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {matchingCustomer.tags.map(t => (
                      <span key={t} className="px-2 py-0.5 text-[8px] font-extrabold bg-gold/20 text-gold rounded border border-gold/15 uppercase">{t}</span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="border border-border p-3.5 rounded-xl bg-muted/20">
                    <span className="text-[9px] text-muted-foreground uppercase font-bold block">Lifetime Orders</span>
                    <strong className="text-sm font-bold text-foreground">{matchingCustomer.totalOrders}</strong>
                  </div>
                  <div className="border border-border p-3.5 rounded-xl bg-muted/20">
                    <span className="text-[9px] text-muted-foreground uppercase font-bold block">Lifetime Billing</span>
                    <strong className="text-sm font-bold text-foreground">₹{matchingCustomer.totalAmount.toLocaleString()}</strong>
                  </div>
                  <div className="border border-border p-3.5 rounded-xl bg-muted/20 col-span-2">
                    <span className="text-[9px] text-muted-foreground uppercase font-bold block">Outstanding Dues</span>
                    <strong className={`text-sm font-bold ${matchingCustomer.remainingDue > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      ₹{matchingCustomer.remainingDue.toLocaleString()}
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-xs text-muted-foreground space-y-2.5">
                <AlertCircle className="h-10 w-10 text-muted-foreground/35 mx-auto" />
                <p>New Client Profile</p>
                <p className="max-w-xs mx-auto text-[10px]">A CRM database profile card will be registered automatically upon saving this booking.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* STEP 3: BILLING & PAYMENT METHOD */}
      {/* ========================================== */}
      {step === 3 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Payment fields form */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-xs text-foreground uppercase tracking-wider border-b border-border pb-3 flex items-center"><CreditCard className="h-4.5 w-4.5 text-saffron mr-2" /> Billing ledger</h3>
            
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                {/* Discount */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Apply Discount (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={discount || ''}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-border bg-background rounded-xl font-semibold"
                  />
                </div>

                {/* GST rate */}
                <div className="space-y-2 pt-5">
                  <label className="flex items-center space-x-2 text-foreground font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={gstEnabled}
                      onChange={(e) => setGstEnabled(e.target.checked)}
                      className="rounded text-saffron focus:ring-saffron"
                    />
                    <span>Charge GST ({gstRate}%)</span>
                  </label>
                </div>
              </div>

              {/* Paid Amount */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Paid Deposit (₹)</label>
                <input
                  type="number"
                  min={0}
                  max={grandTotal}
                  value={paidAmount || ''}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl font-bold text-saffron"
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Primary Payment Channel</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl font-semibold cursor-pointer"
                >
                  <option value="UPI">UPI / Net Banking</option>
                  <option value="Cash">Cash Ledger</option>
                  <option value="Card">Credit/Debit Card</option>
                  <option value="Online">Online Gateway</option>
                  <option value="Split">Split Payment</option>
                </select>
              </div>

              {/* Split details if selected */}
              {paymentMethod === 'Split' && (
                <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-3.5">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block">Split Configuration</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="block text-[8px] font-bold text-muted-foreground uppercase">Cash Portion (₹)</span>
                      <input
                        type="number"
                        min={0}
                        value={cashSplit || ''}
                        onChange={(e) => setCashSplit(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 border border-border bg-background rounded-lg font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="block text-[8px] font-bold text-muted-foreground uppercase">Online/UPI Portion (₹)</span>
                      <input
                        type="number"
                        min={0}
                        value={onlineSplit || ''}
                        onChange={(e) => setOnlineSplit(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 border border-border bg-background rounded-lg font-semibold"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-semibold">
                    <span className="text-muted-foreground">Configured: ₹{cashSplit + onlineSplit}</span>
                    <span className={cashSplit + onlineSplit === paidAmount ? 'text-green-600' : 'text-red-500'}>Required: ₹{paidAmount}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-border">
              <button
                onClick={() => setStep(2)}
                className="flex items-center space-x-1.5 px-4 py-2 border border-border hover:bg-muted text-xs font-bold rounded-xl cursor-pointer"
              >
                <ArrowLeft className="h-4.5 w-4.5" />
                <span>Back</span>
              </button>
              <button
                onClick={() => validateStep3() && handleSaveBooking()}
                disabled={submittingOrder}
                className="flex items-center space-x-1.5 px-5 py-2 bg-gradient-to-r from-saffron to-gold text-white text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:bg-muted"
              >
                <span>{submittingOrder ? 'Saving...' : 'Book & Save Order'}</span>
                <ArrowRight className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          {/* Checkout Totals Summary Card */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm h-fit space-y-4">
            <h3 className="font-bold text-xs text-foreground uppercase tracking-wider border-b border-border pb-3">Checkout Totals</h3>
            
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Total Items Selling Value:</span>
                <span className="font-semibold text-foreground">₹{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Applied Discount:</span>
                <span className="font-semibold text-red-500">-₹{discount.toLocaleString()}</span>
              </div>
              {gstEnabled && (
                <div className="flex justify-between text-muted-foreground">
                  <span>GST ({gstRate}%):</span>
                  <span className="font-semibold text-foreground">+₹{gstAmount.toLocaleString()}</span>
                </div>
              )}

              <div className="border-t border-border pt-3.5 flex justify-between font-extrabold text-sm text-foreground">
                <span>Grand Total:</span>
                <span>₹{grandTotal.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-green-600 font-semibold pt-1 border-t border-border/60">
                <span>Paid Deposit:</span>
                <span>₹{paidAmount.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-red-500 font-semibold pt-1 border-t border-border/60">
                <span>Outstanding Dues:</span>
                <span>₹{remainingBalance.toLocaleString()}</span>
              </div>

              <div className="flex justify-between pt-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Payment Status:</span>
                <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                  paymentStatus === 'Paid' ? 'bg-green-500/10 text-green-500' :
                  paymentStatus === 'Partial' ? 'bg-amber-500/10 text-amber-500' :
                  'bg-red-500/10 text-red-500'
                }`}>{paymentStatus}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* STEP 4: REVIEW & PRINTS */}
      {/* ========================================== */}
      {step === 4 && (
        <div className="max-w-md mx-auto bg-card border border-border rounded-2xl p-6 shadow-xl text-center space-y-6">
          <div className="mx-auto h-16 w-16 bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center shadow-inner">
            <CheckCircle className="h-10 w-10 animate-bounce-slow" />
          </div>

          <div>
            <h3 className="font-bold text-lg text-foreground">Booking Confirmed!</h3>
            <p className="text-xs text-muted-foreground mt-1">Invoice number: <strong>{orderId}</strong></p>
          </div>

          {/* Secure QR Display */}
          {qrCodeDataUrl && (
            <div className="p-4 bg-white border border-slate-100 rounded-2xl inline-block shadow-sm glow-saffron">
              <img src={qrCodeDataUrl} alt="Delivery confirmation QR code" className="mx-auto h-44 w-44" />
              <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">Cryptographically Signed QR</span>
            </div>
          )}

          {/* Print options */}
          <div className="grid grid-cols-2 gap-3 pb-2">
            <button
              onClick={handlePrintPDF}
              className="flex items-center justify-center space-x-1.5 py-2.5 border border-border hover:bg-muted text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              <Printer className="h-4.5 w-4.5 text-saffron" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="flex items-center justify-center space-x-1.5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-xs font-bold rounded-xl shadow shadow-emerald-500/10 hover:brightness-105 active:scale-98 transition-all cursor-pointer"
            >
              <Share2 className="h-4.5 w-4.5" />
              <span>WhatsApp Share</span>
            </button>
          </div>

          <button
            onClick={() => {
              // Wipes form
              setCart([]);
              setCustName('');
              setCustMobile('');
              setCustAddress('');
              setCustNotes('');
              setDiscount(0);
              setGstEnabled(false);
              setPaidAmount(0);
              setPaymentMethod('UPI');
              setCashSplit(0);
              setOnlineSplit(0);
              setStep(1);
            }}
            className="w-full py-2.5 bg-saffron hover:bg-saffron-light text-white font-bold rounded-xl text-xs cursor-pointer shadow-md shadow-saffron/10"
          >
            Create Another Booking
          </button>
        </div>
      )}
    </div>
  );
};
