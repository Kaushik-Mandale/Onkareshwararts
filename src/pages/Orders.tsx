import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  subscribeOrders, 
  addPaymentToOrder, 
  refundOrder, 
  cancelOrder,
  subscribePayments,
  subscribeSettings,
  deleteOrder,
  subscribeProducts
} from '../firebase/db';
import type { Order, PaymentHistory, Product } from '../types';
import { 
  Search, 
  Trash2, 
  Calendar, 
  XCircle, 
  Printer, 
  Share2,
  AlertCircle,
  PlusCircle,
  RotateCcw,
  QrCode
} from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import dayjs from 'dayjs';

export const Orders: React.FC = () => {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const searchParamId = searchParams.get('id') || '';

  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState(searchParamId);
  const [statusFilter, setStatusFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(searchParamId || null);
  const [businessSettings, setBusinessSettings] = useState<any>(null);

  // Lightbox
  const [lightboxImg, setLightboxImg] = useState<{ url: string; name: string } | null>(null);

  // Quick photo lookup: productId -> photoUrl
  const productPhotoMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    products.forEach(p => { if (p.photoUrl) map[p.id] = p.photoUrl; });
    return map;
  }, [products]);

  // Modals / Actions states
  const [paymentModalOrder, setPaymentModalOrder] = useState<Order | null>(null);
  const [payCash, setPayCash] = useState(0);
  const [payUpi, setPayUpi] = useState(0);
  const [payNotes, setPayNotes] = useState('');
  
  const [refundModalOrder, setRefundModalOrder] = useState<Order | null>(null);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundNotes, setRefundNotes] = useState('');

  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Subscriptions
  useEffect(() => {
    if (!currentUser) return;
    const unsub1 = subscribeOrders(setOrders);
    const unsub2 = subscribePayments(setPayments);
    const unsub3 = subscribeProducts(setProducts);
    const unsub4 = subscribeSettings(setBusinessSettings);
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [currentUser]);

  // Expand order if deep-linked
  useEffect(() => {
    if (searchParamId) {
      setSearchTerm(searchParamId);
      setExpandedOrderId(searchParamId);
    }
  }, [searchParamId]);

  // --- ACTIONS ---
  const handleAddPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalOrder) return;
    const totalAmount = payCash + payUpi;
    if (totalAmount <= 0) {
      toast.error('Please enter a payment amount.');
      return;
    }
    if (totalAmount > paymentModalOrder.payment.remaining) {
      toast.error(`Total payment of ₹${totalAmount} exceeds remaining balance of ₹${paymentModalOrder.payment.remaining}`);
      return;
    }
    
    try {
      if (payCash > 0) {
        await addPaymentToOrder(
          paymentModalOrder.orderNumber, 
          payCash, 
          'Cash', 
          payNotes.trim() ? `${payNotes.trim()} (Cash Portion)` : 'Installment Payment (Cash)'
        );
      }
      if (payUpi > 0) {
        await addPaymentToOrder(
          paymentModalOrder.orderNumber, 
          payUpi, 
          'UPI', 
          payNotes.trim() ? `${payNotes.trim()} (UPI Portion)` : 'Installment Payment (UPI)'
        );
      }
      toast.success(`Payment of ₹${totalAmount} added successfully.`);
      setPaymentModalOrder(null);
      setPayCash(0);
      setPayUpi(0);
      setPayNotes('');
    } catch (err: any) {
      toast.error('Payment failed: ' + err.message);
    }
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundModalOrder || refundAmount <= 0) return;
    
    try {
      await refundOrder(
        refundModalOrder.orderNumber, 
        refundAmount, 
        refundNotes.trim() || 'Customer Refund'
      );
      toast.success(`Refund of ₹${refundAmount} logged.`);
      setRefundModalOrder(null);
      setRefundAmount(0);
      setRefundNotes('');
    } catch (err: any) {
      toast.error('Refund failed: ' + err.message);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalOrder || !cancelReason.trim()) return;

    try {
      await cancelOrder(cancelModalOrder.orderNumber, cancelReason.trim());
      toast.success('Order cancelled and inventory restored.');
      setCancelModalOrder(null);
      setCancelReason('');
    } catch (err: any) {
      toast.error('Cancellation failed: ' + err.message);
    }
  };

  const handleDeleteOrder = async (orderNo: string) => {
    if (window.confirm(`CRITICAL: Are you sure you want to permanently delete order ${orderNo}?`)) {
      try {
        await deleteOrder(orderNo);
        toast.success('Order deleted permanently.');
      } catch (err: any) {
        toast.error('Deletion failed: ' + err.message);
      }
    }
  };

  // --- REGENERATE INVOICE PDF ---
  const handleRegenerateInvoice = async (order: Order) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Theme colors used for PDF rendering
    const _saffron = '#E05A17';
    const _gold = '#D4AF37';
    void _saffron; void _gold;

    // Header background
    doc.setFillColor(245, 240, 235);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(224, 90, 23);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(businessSettings?.businessName || 'Onkareshwararts', 15, 20);
    
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont('Helvetica', 'normal');
    doc.text(businessSettings?.address || 'Ayodhya Nagari, Plot No. 50, Sakri Road, Dhule, Behind Circuit House', 15, 28);
    doc.text(`Phone: ${businessSettings?.phone || '+91 9168925461'} | UPI: ${businessSettings?.upiId || ''}`, 15, 33);

    // Invoice Title
    doc.setTextColor(20, 20, 20);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('REPRINT BOOKING INVOICE', 140, 20);
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Invoice No: ${order.orderNumber}`, 140, 26);
    doc.text(`Date: ${dayjs(order.createdAt).format('DD MMM YYYY, hh:mm A')}`, 140, 31);

    // Bill To
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('CUSTOMER DETAILS:', 15, 55);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Name: ${order.customer.name}`, 15, 61);
    doc.text(`Mobile: ${order.customer.mobile}`, 15, 66);
    doc.text(`Address: ${order.customer.address || 'N/A'}`, 15, 71);

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
    
    order.products.forEach((item) => {
      doc.text(item.name, 18, yPos);
      doc.text(item.size, 80, yPos);
      doc.text(`Rs. ${item.price.toLocaleString()}`, 115, yPos);
      doc.text(item.quantity.toString(), 150, yPos);
      doc.text(`Rs. ${(item.price * item.quantity).toLocaleString()}`, 170, yPos);
      
      doc.setDrawColor(230, 230, 230);
      doc.line(15, yPos + 3, 195, yPos + 3);
      yPos += 9;
    });

    // Summary calculations
    yPos += 5;
    doc.setFont('Helvetica', 'normal');
    doc.text('Subtotal:', 130, yPos);
    doc.text(`Rs. ${order.payment.subtotal.toLocaleString()}`, 170, yPos);
    
    yPos += 6;
    doc.text('Discount:', 130, yPos);
    doc.text(`Rs. ${order.payment.discount.toLocaleString()}`, 170, yPos);

    if (order.payment.gstEnabled) {
      yPos += 6;
      doc.text(`GST (${businessSettings?.invoiceSettings?.taxRate || 18}%):`, 130, yPos);
      doc.text(`Rs. ${order.payment.gstAmount.toLocaleString()}`, 170, yPos);
    }

    yPos += 8;
    doc.setFont('Helvetica', 'bold');
    doc.text('Grand Total:', 130, yPos);
    doc.text(`Rs. ${order.payment.grandTotal.toLocaleString()}`, 170, yPos);

    yPos += 6;
    doc.setTextColor(40, 150, 40);
    doc.text('Paid Amount:', 130, yPos);
    doc.text(`Rs. ${order.payment.paid.toLocaleString()}`, 170, yPos);

    yPos += 6;
    doc.setTextColor(200, 40, 40);
    doc.text('Outstanding Due:', 130, yPos);
    doc.text(`Rs. ${order.payment.remaining.toLocaleString()}`, 170, yPos);

    if (order.payment.paid > 0 && order.payment.remaining > 0) {
      yPos += 8;
      doc.setFillColor(254, 243, 199); // Amber background
      doc.rect(15, yPos, 180, 10, 'F');
      doc.setDrawColor(245, 158, 11); // Amber border
      doc.rect(15, yPos, 180, 10, 'D');
      doc.setTextColor(180, 83, 9); // Amber text
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(`ADVANCE PAYMENT RECEIVED: Rs. ${order.payment.paid.toLocaleString()} | BALANCE DUE AT DELIVERY: Rs. ${order.payment.remaining.toLocaleString()}`, 19, yPos + 6.5);
      yPos += 10;
    }

    // Embed QR delivery token in reprinted PDF
    try {
      const qrDataUrl = await QRCode.toDataURL(order.qrToken, { width: 250, margin: 1 });
      yPos = Math.max(yPos + 15, 175);
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(8);
      doc.setFont('Helvetica', 'bold');
      doc.text('TERMS & CONDITIONS:', 15, yPos);
      doc.setFont('Helvetica', 'normal');
      doc.text(businessSettings?.invoiceSettings?.terms || 'Standard terms apply.', 15, yPos + 5);

      doc.addImage(qrDataUrl, 'PNG', 145, yPos, 45, 45);
      doc.setFont('Helvetica', 'bold');
      doc.text('CONFIRMATION QR CODE', 145, yPos + 48);
    } catch (e) {
      console.error(e);
    }

    doc.save(`invoice_${order.orderNumber}.pdf`);
    toast.success('PDF invoice generated!');
  };

  const handleShareWhatsApp = (order: Order) => {
    const textMsg = `*Update on your Onkareshwararts Booking:* 
-------------------------------
*Shop:* ${businessSettings?.businessName || 'Onkareshwararts'}
*Order Number:* ${order.orderNumber}
*Customer:* ${order.customer.name}
*Delivery Status:* ${order.status.toUpperCase()}
-------------------------------
*Grand Total:* ₹${order.payment.grandTotal.toLocaleString()}
*Paid Deposit:* ₹${order.payment.paid.toLocaleString()}
*Remaining Balance:* ₹${order.payment.remaining.toLocaleString()}
*Payment Status:* ${order.payment.status}
-------------------------------
_Open the invoice at the shop to verify payment and confirm pickup from the QR code inside it._`;

    const waUrl = `https://wa.me/?text=${encodeURIComponent(textMsg)}`;
    window.open(waUrl, '_blank');
  };

  // --- FILTERS GRID ---
  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          o.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          o.customer.mobile.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
    const matchesPayment = paymentFilter === 'All' || o.payment.status === paymentFilter;

    return matchesSearch && matchesStatus && matchesPayment;
  });

  // Get payment ledger timeline for a specific order
  const getOrderPayments = (orderNo: string) => {
    return payments.filter(p => p.orderId === orderNo);
  };
  const totalBookings = orders.length;
  const bookedCount = orders.filter(o => o.status === 'booked').length;
  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;
  const cancelledCount = orders.filter(o => o.status === 'cancelled').length;

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Order Manager</h2>
          <p className="text-sm text-muted-foreground">Monitor client bookings, confirm deposits, and process refunds</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border border-border p-3.5 rounded-2xl flex flex-col justify-between shadow-sm">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Total Bookings</span>
          <strong className="text-lg text-foreground mt-1">{totalBookings}</strong>
        </div>
        <div className="bg-card border border-border p-3.5 rounded-2xl flex flex-col justify-between shadow-sm border-l-4 border-l-saffron">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Booked (Active)</span>
          <strong className="text-lg text-saffron mt-1">{bookedCount}</strong>
        </div>
        <div className="bg-card border border-border p-3.5 rounded-2xl flex flex-col justify-between shadow-sm border-l-4 border-l-amber-500">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Pending Pickup</span>
          <strong className="text-lg text-amber-500 mt-1">{pendingCount}</strong>
        </div>
        <div className="bg-card border border-border p-3.5 rounded-2xl flex flex-col justify-between shadow-sm border-l-4 border-l-green-500">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Delivered</span>
          <strong className="text-lg text-green-500 mt-1">{deliveredCount}</strong>
        </div>
        <div className="bg-card border border-border p-3.5 rounded-2xl flex flex-col justify-between shadow-sm border-l-4 border-l-red-500 col-span-2 md:col-span-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Cancelled</span>
          <strong className="text-lg text-red-500 mt-1">{cancelledCount}</strong>
        </div>
      </div>

      {/* --- FILTER & SEARCH BAR --- */}
      <div className="glass p-4 rounded-2xl border border-border flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by Order ID, Client, Mobile..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-saffron/30"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 w-full md:w-auto justify-end">
          {/* Order Status */}
          <div className="flex items-center space-x-1.5 bg-card border border-border px-3 py-1.5 rounded-xl text-xs font-semibold">
            <span className="text-muted-foreground">Order Status:</span>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none focus:ring-0 cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="booked">Booked</option>
              <option value="pending">Pending</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          {/* Payment Status */}
          <div className="flex items-center space-x-1.5 bg-card border border-border px-3 py-1.5 rounded-xl text-xs font-semibold">
            <span className="text-muted-foreground">Payment:</span>
            <select 
              value={paymentFilter} 
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="bg-transparent border-none focus:ring-0 cursor-pointer"
            >
              <option value="All">All Payment States</option>
              <option value="Paid">Fully Paid</option>
              <option value="Partial">Partially Paid</option>
              <option value="Pending">Unpaid / Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders List Accordion */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-2xl flex flex-col items-center justify-center space-y-2">
            <AlertCircle className="h-10 w-10 text-muted-foreground/35" />
            <h3 className="font-semibold text-foreground text-sm">No Orders Found</h3>
            <p className="text-xs text-muted-foreground">No records matching search filters are present.</p>
          </div>
        ) : (
          filteredOrders.map(order => {
            const isExpanded = expandedOrderId === order.orderNumber;
            const orderPaymentsLedger = getOrderPayments(order.orderNumber);

            return (
              <div 
                key={order.orderNumber} 
                className={`bg-card border rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden ${
                  isExpanded ? 'border-saffron/25' : 'border-border'
                }`}
              >
                {/* Header overview row */}
                <div 
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.orderNumber)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-center space-x-4">
                    {/* Product thumbnail(s) — show first product photo */}
                    {(() => {
                      const firstPhoto = order.products
                        .map(p => productPhotoMap[p.productId])
                        .find(Boolean);
                      return firstPhoto ? (
                        <img
                          src={firstPhoto}
                          alt={order.products[0]?.name}
                          onClick={(e) => { e.stopPropagation(); setLightboxImg({ url: firstPhoto, name: order.products[0]?.name }); }}
                          className="h-11 w-11 rounded-xl object-cover border border-border shrink-0 shadow-sm cursor-zoom-in hover:opacity-90 transition-opacity"
                        />
                      ) : (
                        <div className="h-11 w-11 bg-muted rounded-xl flex items-center justify-center border border-border shrink-0">
                          <QrCode className="h-5.5 w-5.5 text-muted-foreground" />
                        </div>
                      );
                    })()}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-foreground">{order.orderNumber}</h4>
                        <span className={`px-2 py-0.5 text-[8px] font-extrabold rounded uppercase ${
                          order.status === 'delivered' ? 'bg-green-500/10 text-green-500 border border-green-500/10' :
                          order.status === 'cancelled' ? 'bg-red-500/10 text-red-500 border border-red-500/10' :
                          'bg-saffron/10 text-saffron border border-saffron/10'
                        }`}>{order.status}</span>
                      </div>
                      <div className="flex items-center space-x-3.5 text-xs text-muted-foreground mt-1">
                        <span>Client: <strong>{order.customer.name}</strong></span>
                        <span>•</span>
                        <span>Phone: {order.customer.mobile}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6 md:space-x-8 text-right self-start md:self-auto pl-15 md:pl-0 text-xs">
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase block font-bold">Delivery Date</span>
                      <span className="font-semibold text-foreground flex items-center"><Calendar className="h-3.5 w-3.5 mr-1 text-slate-400" /> {dayjs(order.deliveryDate).format('DD MMM YY')}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase block font-bold">Total Bill</span>
                      <strong className="text-foreground text-sm">₹{order.payment.grandTotal.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase block font-bold">Balance Due</span>
                      <strong className={order.payment.remaining > 0 ? 'text-red-500 text-sm font-bold' : 'text-green-600 text-sm font-bold'}>
                        ₹{order.payment.remaining.toLocaleString()}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Expanded Detail Panel */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/15 p-5 space-y-5 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* Left: Items list & Client Details */}
                      <div className="space-y-4 md:col-span-2 pr-0 md:pr-4 border-r border-border/60">
                        {/* Booked Items */}
                        <div className="space-y-2">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Booked Idols</span>
                          <div className="border border-border bg-card rounded-xl overflow-hidden divide-y divide-border/60">
                            {order.products.map((item, idx) => (
                              <div key={idx} className="p-3 flex justify-between items-center text-xs">
                                <div className="flex items-center gap-3">
                                  {productPhotoMap[item.productId] ? (
                                    <img
                                      src={productPhotoMap[item.productId]}
                                      alt={item.name}
                                      onClick={() => setLightboxImg({ url: productPhotoMap[item.productId], name: item.name })}
                                      className="h-12 w-12 rounded-lg object-cover border border-border shrink-0 cursor-zoom-in hover:opacity-90 transition-opacity"
                                    />
                                  ) : (
                                    <div className="h-12 w-12 bg-muted rounded-lg flex items-center justify-center border border-border shrink-0">
                                      <QrCode className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-bold text-foreground">{item.name}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Size: {item.size} | Qty: {item.quantity}</p>
                                  </div>
                                </div>
                                <span className="font-semibold text-foreground">₹{(item.price * item.quantity).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Order info & Notes */}
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase block">Delivery Location</span>
                            <p className="text-foreground font-semibold mt-0.5">{order.customer.address || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase block">Created By</span>
                            <p className="text-foreground font-semibold mt-0.5">{order.createdBy} on {dayjs(order.createdAt).format('DD MMM YY, hh:mm A')}</p>
                          </div>
                          {order.notes && (
                            <div className="col-span-2">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase block">Booking Notes</span>
                              <p className="text-foreground italic mt-0.5 bg-card p-3 rounded-lg border border-border">{order.notes}</p>
                            </div>
                          )}
                          {order.status !== 'delivered' && order.status !== 'cancelled' && order.payment.paid > 0 && order.payment.remaining > 0 && (
                            <div className="col-span-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-amber-700 dark:text-amber-400">
                              <span className="text-[9px] font-bold uppercase block">Advance Payment Info</span>
                              <p className="mt-1 font-semibold text-xs">Advance Deposit Paid: ₹{order.payment.paid.toLocaleString()}</p>
                              <p className="text-[10px] text-red-600 dark:text-red-400 font-bold mt-0.5">Remaining Balance to Collect at Delivery: ₹{order.payment.remaining.toLocaleString()}</p>
                            </div>
                          )}
                          {order.status === 'delivered' && (
                            <div className="col-span-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-xl text-green-700 dark:text-green-400">
                              <span className="text-[9px] font-bold uppercase block">Delivery Verified</span>
                              <p className="mt-1 font-semibold">Collected by client on {dayjs(order.deliveryTime).format('DD MMM YYYY, hh:mm A')}</p>
                              <p className="text-[9px] text-muted-foreground mt-0.5">Verified by staff: {order.deliveredBy} | Device: {order.deliveryDevice}</p>
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-2.5 pt-3 border-t border-border/60">
                          {order.status !== 'cancelled' && order.status !== 'refunded' && order.payment.remaining > 0 && (
                            <button
                              onClick={() => setPaymentModalOrder(order)}
                              className="flex items-center space-x-1.5 px-4 py-2 bg-saffron hover:bg-saffron-light text-white text-xs font-bold rounded-xl shadow cursor-pointer"
                            >
                              <PlusCircle className="h-4 w-4" />
                              <span>Collect Payment</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleRegenerateInvoice(order)}
                            className="flex items-center space-x-1.5 px-4 py-2 border border-border bg-card text-muted-foreground hover:text-foreground text-xs font-semibold rounded-xl cursor-pointer"
                          >
                            <Printer className="h-4 w-4" />
                            <span>Invoice PDF</span>
                          </button>

                          <button
                            onClick={() => handleShareWhatsApp(order)}
                            className="flex items-center space-x-1.5 px-4 py-2 border border-border bg-card text-muted-foreground hover:text-foreground text-xs font-semibold rounded-xl cursor-pointer"
                          >
                            <Share2 className="h-4 w-4" />
                            <span>WhatsApp Status</span>
                          </button>

                          {order.status !== 'cancelled' && order.status !== 'delivered' && order.status !== 'refunded' && (
                            <button
                              onClick={() => setCancelModalOrder(order)}
                              className="flex items-center space-x-1.5 px-4 py-2 border border-red-500/20 text-red-500 hover:bg-red-500/5 text-xs font-semibold rounded-xl cursor-pointer"
                            >
                              <XCircle className="h-4 w-4" />
                              <span>Cancel Booking</span>
                            </button>
                          )}

                          {/* Admin Only Actions */}
                          {currentUser?.role === 'admin' && (
                            <>
                              {order.status !== 'refunded' && order.payment.paid > 0 && (
                                <button
                                  onClick={() => { setRefundModalOrder(order); setRefundAmount(order.payment.paid); }}
                                  className="flex items-center space-x-1.5 px-4 py-2 border border-amber-500/20 text-amber-500 hover:bg-amber-500/5 text-xs font-semibold rounded-xl cursor-pointer"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  <span>Refund Ledger</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteOrder(order.orderNumber)}
                                className="flex items-center space-x-1.5 px-4 py-2 border border-red-500/20 text-red-500 hover:bg-red-500/5 text-xs font-semibold rounded-xl cursor-pointer ml-auto"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span>Delete Record</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right: Payment history ledger */}
                      <div className="space-y-4 text-xs md:col-span-1">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Payments Ledger History</span>
                        
                        {orderPaymentsLedger.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground p-4 text-center bg-card border border-border rounded-xl">No ledger transactions found.</p>
                        ) : (
                          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                            {orderPaymentsLedger.map((pay) => (
                              <div 
                                key={pay.id} 
                                className={`p-3 rounded-xl border flex justify-between items-center bg-card ${
                                  pay.type === 'refund' ? 'border-amber-200 dark:border-amber-900/30 bg-amber-500/5' : 'border-border'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center space-x-1">
                                    <strong className={pay.type === 'refund' ? 'text-amber-600' : 'text-foreground'}>
                                      {pay.type === 'refund' ? `-₹${pay.amount.toLocaleString()}` : `+₹${pay.amount.toLocaleString()}`}
                                    </strong>
                                    <span className="text-[9px] text-muted-foreground">({pay.method})</span>
                                  </div>
                                  <p className="text-[9px] text-muted-foreground mt-0.5 italic">"{pay.notes}"</p>
                                  <p className="text-[8px] text-muted-foreground/80 mt-1">by {pay.recordedBy}</p>
                                </div>
                                <span className="text-[9px] text-muted-foreground">{dayjs(pay.timestamp).format('DD MMM, hh:mm A')}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="border border-border p-3 rounded-xl space-y-2 bg-card">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase block">Billing Summary</span>
                          <div className="space-y-1.5 text-[11px]">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Subtotal:</span>
                              <span>₹{order.payment.subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Discount:</span>
                              <span className="text-red-500">-₹{order.payment.discount.toLocaleString()}</span>
                            </div>
                            {order.payment.gstEnabled && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">GST Charged:</span>
                                <span>+₹{order.payment.gstAmount.toLocaleString()}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-bold text-xs pt-1 border-t border-border">
                              <span>Grand Total:</span>
                              <span>₹{order.payment.grandTotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between font-semibold text-green-600">
                              <span>Paid to date:</span>
                              <span>₹{order.payment.paid.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* --- COLLECT PAYMENT MODAL --- */}
      {paymentModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPaymentModalOrder(null)} />
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl shadow-2xl relative z-10 overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex justify-between items-center bg-muted/20">
              <h3 className="font-bold text-xs text-foreground uppercase">Collect Installment</h3>
              <button onClick={() => setPaymentModalOrder(null)} className="p-1 rounded hover:bg-muted text-muted-foreground"><XCircle className="h-4.5 w-4.5" /></button>
            </div>
            <form onSubmit={handleAddPaymentSubmit} className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <span className="text-muted-foreground">Outstanding Balance:</span>
                <p className="text-lg font-bold text-red-500">₹{paymentModalOrder.payment.remaining.toLocaleString()}</p>
              </div>
              
              <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-3.5">
                <span className="text-[9px] font-bold text-muted-foreground uppercase block">Split Configuration</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="block text-[8px] font-bold text-muted-foreground uppercase">Cash Portion (₹)</span>
                    <input
                      type="number"
                      min={0}
                      max={paymentModalOrder.payment.remaining}
                      value={payCash || ''}
                      onChange={(e) => setPayCash(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 border border-border bg-background rounded-lg font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-[8px] font-bold text-muted-foreground uppercase">Online/UPI Portion (₹)</span>
                    <input
                      type="number"
                      min={0}
                      max={paymentModalOrder.payment.remaining}
                      value={payUpi || ''}
                      onChange={(e) => setPayUpi(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 border border-border bg-background rounded-lg font-semibold"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center text-[10px] font-semibold pt-1 border-t border-border/40">
                  <span className="text-muted-foreground">Total: ₹{payCash + payUpi}</span>
                  <span className={payCash + payUpi > 0 && payCash + payUpi <= paymentModalOrder.payment.remaining ? 'text-green-600' : 'text-red-500'}>
                    Remaining: ₹{paymentModalOrder.payment.remaining - (payCash + payUpi)}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">Ledger Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Second installment paid at shop"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-saffron hover:bg-saffron-light text-white font-bold rounded-xl shadow-md cursor-pointer"
              >
                Log Payment Transaction
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- REFUND PAYMENT MODAL --- */}
      {refundModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRefundModalOrder(null)} />
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl shadow-2xl relative z-10 overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex justify-between items-center bg-muted/20">
              <h3 className="font-bold text-xs text-foreground uppercase">Issue Refund Ledger</h3>
              <button onClick={() => setRefundModalOrder(null)} className="p-1 rounded hover:bg-muted text-muted-foreground"><XCircle className="h-4.5 w-4.5" /></button>
            </div>
            <form onSubmit={handleRefundSubmit} className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <span className="text-muted-foreground">Total Paid Deposit:</span>
                <p className="text-lg font-bold text-green-600">₹{refundModalOrder.payment.paid.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">Refund Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={refundModalOrder.payment.paid}
                  value={refundAmount || ''}
                  onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl font-bold text-red-500 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">Reason for Refund</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Idol sizing mismatch, booking cancel refund"
                  value={refundNotes}
                  onChange={(e) => setRefundNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-md cursor-pointer"
              >
                Issue Refund & Restore Inventory
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- CANCEL ORDER MODAL --- */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCancelModalOrder(null)} />
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl shadow-2xl relative z-10 overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex justify-between items-center bg-muted/20">
              <h3 className="font-bold text-xs text-foreground uppercase">Cancel Booking</h3>
              <button onClick={() => setCancelModalOrder(null)} className="p-1 rounded hover:bg-muted text-muted-foreground"><XCircle className="h-4.5 w-4.5" /></button>
            </div>
            <form onSubmit={handleCancelSubmit} className="p-5 space-y-4 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                Cancelling order **{cancelModalOrder.orderNumber}** will mark the status as cancelled and return the booked idols back to the inventory stock automatically.
              </p>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">Reason for Cancellation *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Client changed mind"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-md cursor-pointer"
              >
                Confirm Cancellation
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Lightbox ─────────────────────────────── */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
          onClick={() => setLightboxImg(null)}
        >
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => setLightboxImg(null)}
              className="absolute -top-3 -right-3 z-10 h-8 w-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
            >
              ✕
            </button>
            <img
              src={lightboxImg.url}
              alt={lightboxImg.name}
              className="w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/10"
            />
            <p className="text-center text-white/70 text-xs font-semibold mt-3 tracking-wide">{lightboxImg.name}</p>
          </div>
        </div>
      )}
    </div>
  );
};
