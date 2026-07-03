import React, { useState, useEffect } from 'react';
import { subscribeOrders, subscribePayments } from '../firebase/db';
import { useAuth } from '../contexts/AuthContext';
import type { Order, PaymentHistory } from '../types';
import { 
  BarChart as RechartsBarChart, 
  Bar as RechartsBar, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie 
} from 'recharts';
import { 
  FileText, 
  Download, 
  Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import dayjs from 'dayjs';

export const Reports: React.FC = () => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<PaymentHistory[]>([]);

  // Range Presets: 'today' | 'weekly' | 'monthly' | 'yearly' | 'custom'
  const [datePreset, setDatePreset] = useState<'today' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('weekly');
  const [startDate, setStartDate] = useState(dayjs().subtract(7, 'day').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));

  useEffect(() => {
    if (!currentUser) return;
    const unsubOrders = subscribeOrders(setOrders);
    const unsubPayments = subscribePayments(setPayments);

    return () => {
      unsubOrders();
      unsubPayments();
    };
  }, [currentUser]);

  // Update date ranges based on preset select
  useEffect(() => {
    if (datePreset === 'today') {
      setStartDate(dayjs().format('YYYY-MM-DD'));
      setEndDate(dayjs().format('YYYY-MM-DD'));
    } else if (datePreset === 'weekly') {
      setStartDate(dayjs().subtract(7, 'day').format('YYYY-MM-DD'));
      setEndDate(dayjs().format('YYYY-MM-DD'));
    } else if (datePreset === 'monthly') {
      setStartDate(dayjs().subtract(30, 'day').format('YYYY-MM-DD'));
      setEndDate(dayjs().format('YYYY-MM-DD'));
    } else if (datePreset === 'yearly') {
      setStartDate(dayjs().subtract(365, 'day').format('YYYY-MM-DD'));
      setEndDate(dayjs().format('YYYY-MM-DD'));
    }
  }, [datePreset]);

  // --- FILTERED SUBSETS ---
  const filteredOrders = orders.filter(o => {
    const orderDate = dayjs(o.createdAt).format('YYYY-MM-DD');
    return (orderDate === startDate || dayjs(orderDate).isAfter(startDate)) && 
           (orderDate === endDate || dayjs(orderDate).isBefore(endDate) || dayjs(orderDate).isSame(dayjs(endDate), 'day'));
  });

  const filteredPayments = payments.filter(p => {
    const payDate = dayjs(p.timestamp).format('YYYY-MM-DD');
    return (payDate === startDate || dayjs(payDate).isAfter(startDate)) && 
           (payDate === endDate || dayjs(payDate).isBefore(endDate) || dayjs(payDate).isSame(dayjs(endDate), 'day'));
  });

  // --- CALCULATE SUMMARY KPIS ---
  const totalBookings = filteredOrders.length;
  
  // Total payment transactions recorded in date range
  const grossSales = filteredOrders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.payment.grandTotal, 0);

  const totalCollected = filteredPayments
    .filter(p => p.type === 'payment')
    .reduce((sum, p) => sum + p.amount, 0) - 
    filteredPayments.filter(p => p.type === 'refund').reduce((sum, p) => sum + p.amount, 0);

  const duesOutstanding = filteredOrders
    .filter(o => o.status !== 'cancelled' && o.status !== 'refunded')
    .reduce((sum, o) => sum + o.payment.remaining, 0);

  // Split payments
  const cashCollection = filteredPayments
    .filter(p => p.type === 'payment' && p.method === 'Cash')
    .reduce((sum, p) => sum + p.amount, 0);

  const onlineCollection = filteredPayments
    .filter(p => p.type === 'payment' && p.method !== 'Cash')
    .reduce((sum, p) => sum + p.amount, 0);

  // --- CHART 1: TOP PRODUCTS SOLD ---
  const productSalesMap: Record<string, { name: string; qty: number }> = {};
  filteredOrders.filter(o => o.status !== 'cancelled').forEach(order => {
    order.products.forEach(item => {
      if (productSalesMap[item.productId]) {
        productSalesMap[item.productId].qty += item.quantity;
      } else {
        productSalesMap[item.productId] = { name: item.name, qty: item.quantity };
      }
    });
  });

  const topSellingProducts = Object.values(productSalesMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const COLORS = ['#E05A17', '#D4AF37', '#8A2BE2', '#3CB371', '#4682B4'];

  // --- CHART 2: DAILY COLLECTIONS TREND ---
  // Group collections by date
  const dayGroupMap: Record<string, number> = {};
  filteredPayments.filter(p => p.type === 'payment').forEach(p => {
    const day = dayjs(p.timestamp).format('DD MMM');
    dayGroupMap[day] = (dayGroupMap[day] || 0) + p.amount;
  });

  const dailyCollectionsTrend = Object.keys(dayGroupMap).map(day => ({
    day,
    amount: dayGroupMap[day]
  })).slice(-10); // last 10 transaction days

  // --- EXPORT TO EXCEL ---
  const handleExportExcel = () => {
    const summaryData = [
      ["REPORT DETAILS", ""],
      ["Start Date", startDate],
      ["End Date", endDate],
      [],
      ["FINANCIAL STATISTICS", ""],
      ["Total Bookings", totalBookings],
      ["Gross Booked Sales Value", `Rs. ${grossSales.toLocaleString()}`],
      ["Net Receipts Collected", `Rs. ${totalCollected.toLocaleString()}`],
      ["Uncollected Dues Outstanding", `Rs. ${duesOutstanding.toLocaleString()}`],
      ["COLLECTION METHODS", ""],
      ["Cash", `Rs. ${cashCollection.toLocaleString()}`],
      ["Online/UPI/Cards", `Rs. ${onlineCollection.toLocaleString()}`],
      [],
      ["TOP 5 SELLING PRODUCTS", ""],
      ["Product Name", "Quantity Sold"]
    ];

    topSellingProducts.forEach(p => {
      summaryData.push([p.name, p.qty.toString()]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws, "Financial Report");
    XLSX.writeFile(wb, `ganpati_business_report_${startDate}_to_${endDate}.xlsx`);
    toast.success('Excel spreadsheet downloaded!');
  };

  // --- EXPORT TO PDF ---
  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Brand header
    doc.setFillColor(224, 90, 23);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('Onkareshwararts - Financial Report', 15, 22);
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Report Period: ${dayjs(startDate).format('DD MMM YYYY')} to ${dayjs(endDate).format('DD MMM YYYY')}`, 15, 30);

    // Section 1
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'bold');
    doc.text('1. CORE FINANCIAL STATISTICS', 15, 55);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    let yPos = 65;
    
    const stats = [
      { name: 'Total Bookings Received', val: `${totalBookings} orders` },
      { name: 'Gross Booked Sales Value', val: `Rs. ${grossSales.toLocaleString()}` },
      { name: 'Net Receipts Collected', val: `Rs. ${totalCollected.toLocaleString()}` },
      { name: 'Outstanding Unpaid Dues', val: `Rs. ${duesOutstanding.toLocaleString()}` }
    ];

    stats.forEach(item => {
      doc.text(item.name, 18, yPos);
      doc.setFont('Helvetica', 'bold');
      doc.text(item.val, 130, yPos);
      doc.setFont('Helvetica', 'normal');
      doc.line(15, yPos + 2, 195, yPos + 2);
      yPos += 10;
    });

    // Section 2
    yPos += 10;
    doc.setFont('Helvetica', 'bold');
    doc.text('2. COLLECTION METHODS SPLIT', 15, yPos);
    doc.setFont('Helvetica', 'normal');
    
    yPos += 10;
    doc.text('Cash Collections', 18, yPos);
    doc.text(`Rs. ${cashCollection.toLocaleString()}`, 130, yPos);
    doc.line(15, yPos + 2, 195, yPos + 2);
    
    yPos += 10;
    doc.text('Online/UPI/Card Collections', 18, yPos);
    doc.text(`Rs. ${onlineCollection.toLocaleString()}`, 130, yPos);
    doc.line(15, yPos + 2, 195, yPos + 2);

    // Section 3
    yPos += 20;
    doc.setFont('Helvetica', 'bold');
    doc.text('3. TOP MOVING PRODUCTS CATALOG', 15, yPos);
    doc.setFont('Helvetica', 'normal');
    
    yPos += 10;
    topSellingProducts.forEach((p, index) => {
      doc.text(`${index + 1}. ${p.name}`, 18, yPos);
      doc.text(`${p.qty} units`, 130, yPos);
      yPos += 8;
    });

    doc.save(`financial_report_${startDate}_to_${endDate}.pdf`);
    toast.success('PDF report downloaded!');
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Analytics &amp; Reports</h2>
          <p className="text-sm text-muted-foreground">Monitor sales charts, outstanding dues, and export ledger accounts</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 px-4 py-2 border border-border bg-card text-muted-foreground hover:text-foreground text-xs font-semibold rounded-xl cursor-pointer shadow-sm"
          >
            <Download className="h-4 w-4" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center space-x-1.5 px-4 py-2 bg-saffron hover:bg-saffron-light text-white text-xs font-bold rounded-xl shadow cursor-pointer"
          >
            <FileText className="h-4 w-4" />
            <span>Download Report PDF</span>
          </button>
        </div>
      </div>

      {/* Date controls presets */}
      <div className="glass p-4 rounded-2xl border border-border flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm text-xs font-semibold">
        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'today', name: 'Today' },
            { id: 'weekly', name: 'Last 7 Days' },
            { id: 'monthly', name: 'Last 30 Days' },
            { id: 'yearly', name: 'Last 365 Days' },
            { id: 'custom', name: 'Custom Dates' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setDatePreset(p.id as any)}
              className={`px-3.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                datePreset === p.id 
                  ? 'bg-saffron text-white border-saffron shadow-sm' 
                  : 'bg-card border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Date fields if custom */}
        <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
          <Calendar className="h-4.5 w-4.5 text-muted-foreground" />
          <input
            type="date"
            disabled={datePreset !== 'custom'}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-border bg-card focus:outline-none disabled:opacity-40"
          />
          <span className="text-muted-foreground">to</span>
          <input
            type="date"
            disabled={datePreset !== 'custom'}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-border bg-card focus:outline-none disabled:opacity-40"
          />
        </div>
      </div>

      {/* --- FINANCIAL KPIS GRID --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Booked */}
        <div className="bg-card border border-border p-4 rounded-2xl text-center space-y-1">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Total Bookings</span>
          <h3 className="text-xl font-extrabold text-foreground">{totalBookings}</h3>
          <p className="text-[9px] text-muted-foreground">Reservations logged</p>
        </div>

        {/* Gross Sales */}
        <div className="bg-card border border-border p-4 rounded-2xl text-center space-y-1">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Gross Sales Value</span>
          <h3 className="text-xl font-extrabold text-foreground">₹{grossSales.toLocaleString()}</h3>
          <p className="text-[9px] text-muted-foreground">Booked items pricing</p>
        </div>

        {/* Total Collected */}
        <div className="bg-card border border-border p-4 rounded-2xl text-center space-y-1">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Total Receipts Collected</span>
          <h3 className="text-xl font-extrabold text-green-600">₹{totalCollected.toLocaleString()}</h3>
          <p className="text-[9px] text-muted-foreground">Cash + Digital inputs</p>
        </div>

        {/* outstanding receivable */}
        <div className="bg-card border border-border p-4 rounded-2xl text-center space-y-1">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Receivables Dues</span>
          <h3 className="text-xl font-extrabold text-red-500">₹{duesOutstanding.toLocaleString()}</h3>
          <p className="text-[9px] text-muted-foreground">Outstanding balances</p>
        </div>

      </div>

      {/* --- GRAPH ANALYSIS ROW --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Collections Progress Trend Bar Chart */}
        <div className="bg-card border border-border p-5 rounded-2xl lg:col-span-2 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground">Daily Collections Trend</h3>
            <p className="text-[10px] text-muted-foreground">Receipt collections mapped day-by-day</p>
          </div>
          <div className="h-64">
            {dailyCollectionsTrend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No transaction data matching period.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={dailyCollectionsTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.1)" />
                  <XAxis dataKey="day" tickLine={false} style={{ fontSize: 9, fill: 'gray' }} />
                  <YAxis tickLine={false} axisLine={false} style={{ fontSize: 9, fill: 'gray' }} />
                  <Tooltip formatter={(value) => `Rs. ${Number(value ?? 0).toLocaleString()}`} />
                  <RechartsBar dataKey="amount" name="Collections (INR)" fill="#E05A17" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Products Pie Chart */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Top Selling Products</h3>
            <p className="text-[10px] text-muted-foreground">Proportion of units booked by category</p>
          </div>
          <div className="h-44 flex items-center justify-center">
            {topSellingProducts.length === 0 ? (
              <div className="text-xs text-muted-foreground">No bookings recorded.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topSellingProducts}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="qty"
                  >
                    {topSellingProducts.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="space-y-1.5 border-t border-border pt-3.5">
            {topSellingProducts.map((p, index) => (
              <div key={p.name} className="flex justify-between items-center text-xs">
                <div className="flex items-center truncate max-w-[150px]">
                  <span className="h-2.5 w-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-muted-foreground truncate">{p.name}</span>
                </div>
                <span className="font-bold text-foreground">{p.qty} units</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
