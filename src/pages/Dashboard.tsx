import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  subscribeProducts, 
  subscribeOrders, 
  subscribePayments, 
  subscribeActivityLogs
} from '../firebase/db';
import type { Product, Order, PaymentHistory, ActivityLog } from '../types';
import { 
  TrendingUp, 
  ShoppingBag, 
  AlertTriangle, 
  DollarSign, 
  PlusCircle, 
  Scan, 
  Package, 
  CreditCard,
  History,
  Clock,
  CheckCircle2,
  FileBarChart
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';

// --- Animated Counter Component ---
const AnimatedCounter: React.FC<{ value: number; prefix?: string; suffix?: string; duration?: number }> = ({ 
  value, 
  prefix = '', 
  suffix = '', 
  duration = 180 
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = Math.floor(value);
    if (start === end) {
      setCount(end);
      return;
    }
    
    const range = end - start;
    let current = start;
    const increment = end > start ? 1 : -1;
    const stepTime = Math.abs(Math.floor(duration / range));
    const step = Math.max(1, Math.ceil(Math.abs(range) / 20));
    const timer = setInterval(() => {
      current += increment * step;
      if ((increment > 0 && current > end) || (increment < 0 && current < end)) {
        current = end;
      }
      setCount(current);
      if (current === end) {
        clearInterval(timer);
      }
    }, Math.max(stepTime, 15));

    return () => clearInterval(timer);
  }, [value, duration]);

  return <span>{prefix}{count.toLocaleString()}{suffix}</span>;
};

export const Dashboard: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  // Subscriptions
  useEffect(() => {
    const unsubProds = subscribeProducts(setProducts);
    const unsubOrders = subscribeOrders(setOrders);
    const unsubPayments = subscribePayments(setPayments);
    const unsubLogs = subscribeActivityLogs(setLogs);

    return () => {
      unsubProds();
      unsubOrders();
      unsubPayments();
      unsubLogs();
    };
  }, []);

  const todayStr = dayjs().format('YYYY-MM-DD');

  // --- STATS COMPUTATIONS ---
  // Orders counting
  const todayOrders = orders.filter(o => dayjs(o.createdAt).format('YYYY-MM-DD') === todayStr);
  const pendingOrders = orders.filter(o => o.status === 'booked' || o.status === 'pending');
  const deliveredOrders = orders.filter(o => o.status === 'delivered');
  const cancelledOrders = orders.filter(o => o.status === 'cancelled');

  // Revenue counts
  const todayRevenue = payments
    .filter(p => dayjs(p.timestamp).format('YYYY-MM-DD') === todayStr && p.type === 'payment')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalRevenue = payments
    .filter(p => p.type === 'payment')
    .reduce((sum, p) => sum + p.amount, 0) - 
    payments.filter(p => p.type === 'refund').reduce((sum, p) => sum + p.amount, 0);

  const totalOutstanding = orders
    .filter(o => o.status !== 'cancelled' && o.status !== 'refunded')
    .reduce((sum, o) => sum + o.payment.remaining, 0);

  // Stock counts
  const totalProducts = products.filter(p => p.status === 'active').length;
  const totalStockValue = products
    .filter(p => p.status === 'active')
    .reduce((sum, p) => sum + (p.sellingPrice * p.quantity), 0);
  
  const lowStockProds = products.filter(p => p.status === 'active' && p.quantity > 0 && p.quantity <= p.lowStockLimit);
  const outOfStockCount = products.filter(p => p.status === 'active' && p.quantity === 0).length;

  // Payments splits
  const cashCollection = payments
    .filter(p => p.type === 'payment' && p.method === 'Cash')
    .reduce((sum, p) => sum + p.amount, 0);
  const onlineCollection = payments
    .filter(p => p.type === 'payment' && p.method !== 'Cash')
    .reduce((sum, p) => sum + p.amount, 0);

  // Monthly / Yearly revenue
  const thisMonthStr = dayjs().format('YYYY-MM');
  const thisYearStr = dayjs().format('YYYY');
  
  const monthlyRevenue = payments
    .filter(p => dayjs(p.timestamp).format('YYYY-MM') === thisMonthStr && p.type === 'payment')
    .reduce((sum, p) => sum + p.amount, 0);

  const yearlyRevenue = payments
    .filter(p => dayjs(p.timestamp).format('YYYY') === thisYearStr && p.type === 'payment')
    .reduce((sum, p) => sum + p.amount, 0);

  // Upcoming Deliveries (Orders not delivered/cancelled, delivery date >= today)
  const upcomingDeliveries = orders
    .filter(o => (o.status === 'booked' || o.status === 'pending') && dayjs(o.deliveryDate).isSame(dayjs(), 'day') || dayjs(o.deliveryDate).isAfter(dayjs(), 'day'))
    .sort((a, b) => dayjs(a.deliveryDate).diff(dayjs(b.deliveryDate)))
    .slice(0, 5);

  // --- CHARTS DATA PREPARATION ---
  // 1. Sales Trend over past 7 days
  const last7Days = Array.from({ length: 7 }).map((_, i) => dayjs().subtract(i, 'day').format('YYYY-MM-DD')).reverse();
  const salesTrendData = last7Days.map(date => {
    const dayPayments = payments.filter(p => dayjs(p.timestamp).format('YYYY-MM-DD') === date && p.type === 'payment');
    const dayOrdersCount = orders.filter(o => dayjs(o.createdAt).format('YYYY-MM-DD') === date).length;
    return {
      date: dayjs(date).format('DD MMM'),
      sales: dayPayments.reduce((sum, p) => sum + p.amount, 0),
      ordersCount: dayOrdersCount
    };
  });

  // 2. Collection Methods Pie Chart
  const pieData = [
    { name: 'Cash', value: cashCollection, color: '#D4AF37' },
    { name: 'Online/UPI/Card', value: onlineCollection, color: '#E05A17' }
  ];



  return (
    <div className="space-y-6">
      {/* Title & Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Overview Dashboard</h2>
          <p className="text-sm text-muted-foreground">Real-time statistics & business performance overview</p>
        </div>
        <div className="flex items-center space-x-2 text-xs bg-card border border-border px-3 py-1.5 rounded-xl text-muted-foreground shadow-sm">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-ping" />
          <span>Live Firestore Channel Connected</span>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <Link to="/booking" className="glass p-4 rounded-2xl flex flex-col items-center justify-center text-center hover:scale-105 active:scale-95 transition-all shadow-sm border border-saffron/10 group cursor-pointer">
          <PlusCircle className="h-6 w-6 text-saffron mb-2 group-hover:rotate-90 transition-transform duration-300" />
          <span className="text-[11px] font-bold text-foreground">Create Booking</span>
        </Link>
        <Link to="/delivery" className="glass p-4 rounded-2xl flex flex-col items-center justify-center text-center hover:scale-105 active:scale-95 transition-all shadow-sm border border-saffron/10 group cursor-pointer">
          <Scan className="h-6 w-6 text-saffron mb-2 group-hover:scale-110 transition-transform" />
          <span className="text-[11px] font-bold text-foreground">Scan QR / Deliver</span>
        </Link>
        <Link to="/inventory" className="glass p-4 rounded-2xl flex flex-col items-center justify-center text-center hover:scale-105 active:scale-95 transition-all shadow-sm border border-gold/10 group cursor-pointer">
          <Package className="h-6 w-6 text-gold mb-2" />
          <span className="text-[11px] font-bold text-foreground">Manage Products</span>
        </Link>
        <Link to="/orders" className="glass p-4 rounded-2xl flex flex-col items-center justify-center text-center hover:scale-105 active:scale-95 transition-all shadow-sm border border-gold/10 group cursor-pointer">
          <ShoppingBag className="h-6 w-6 text-gold mb-2" />
          <span className="text-[11px] font-bold text-foreground">View Orders</span>
        </Link>
        <Link to="/payments" className="glass p-4 rounded-2xl flex flex-col items-center justify-center text-center hover:scale-105 active:scale-95 transition-all shadow-sm border border-border group cursor-pointer">
          <DollarSign className="h-6 w-6 text-muted-foreground mb-2" />
          <span className="text-[11px] font-bold text-foreground">Payments Ledger</span>
        </Link>
        <Link to="/reports" className="glass p-4 rounded-2xl flex flex-col items-center justify-center text-center hover:scale-105 active:scale-95 transition-all shadow-sm border border-border group cursor-pointer">
          <FileBarChart className="h-6 w-6 text-muted-foreground mb-2" />
          <span className="text-[11px] font-bold text-foreground">Business Reports</span>
        </Link>
      </div>

      {/* --- STATS COUNTERS GRID (GLASS CARDS) --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Revenue */}
        <motion.div whileHover={{ y: -4 }} className="glass rounded-2xl p-5 border-l-4 border-l-saffron shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Today's Revenue</p>
            <h3 className="text-2xl font-bold text-foreground">
              <AnimatedCounter value={todayRevenue} prefix="₹" />
            </h3>
            <p className="text-[9px] text-muted-foreground">Orders: {todayOrders.length}</p>
          </div>
          <div className="p-3 bg-saffron/10 text-saffron rounded-xl">
            <DollarSign className="h-6 w-6" />
          </div>
        </motion.div>

        {/* Total Revenue */}
        <motion.div whileHover={{ y: -4 }} className="glass rounded-2xl p-5 border-l-4 border-l-gold shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Total Revenue (Net)</p>
            <h3 className="text-2xl font-bold text-foreground">
              <AnimatedCounter value={totalRevenue} prefix="₹" />
            </h3>
            <p className="text-[9px] text-muted-foreground">M: ₹{monthlyRevenue.toLocaleString()} | Y: ₹{yearlyRevenue.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-gold/10 text-gold rounded-xl">
            <TrendingUp className="h-6 w-6" />
          </div>
        </motion.div>

        {/* Dues Outstanding */}
        <motion.div whileHover={{ y: -4 }} className="glass rounded-2xl p-5 border-l-4 border-l-amber-500 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Remaining Dues</p>
            <h3 className="text-2xl font-bold text-red-500">
              <AnimatedCounter value={totalOutstanding} prefix="₹" />
            </h3>
            <p className="text-[9px] text-muted-foreground">Pending collections</p>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
            <CreditCard className="h-6 w-6" />
          </div>
        </motion.div>

        {/* Stock Value & Warnings */}
        <motion.div whileHover={{ y: -4 }} className="glass rounded-2xl p-5 border-l-4 border-l-red-500 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Inventory Value</p>
            <h3 className="text-2xl font-bold text-foreground">
              <AnimatedCounter value={totalStockValue} prefix="₹" />
            </h3>
            <p className="text-[9px] text-red-500 font-semibold">
              {lowStockProds.length} Low stock | {outOfStockCount} Out of stock
            </p>
          </div>
          <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </motion.div>
      </div>

      {/* --- DETAILED STATUS SUB-GRID --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-4 rounded-xl text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Pending Deliveries</p>
          <p className="text-xl font-bold text-foreground mt-1">{pendingOrders.length}</p>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Delivered Orders</p>
          <p className="text-xl font-bold text-foreground mt-1">{deliveredOrders.length}</p>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Cancelled Orders</p>
          <p className="text-xl font-bold text-foreground mt-1">{cancelledOrders.length}</p>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Catalog Items</p>
          <p className="text-xl font-bold text-foreground mt-1">{totalProducts}</p>
        </div>
      </div>

      {/* --- CHARTS ROW --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Area Chart */}
        <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-2 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Sales Trend</h3>
              <p className="text-[10px] text-muted-foreground">Daily collection statistics over the past 7 days</p>
            </div>
            <TrendingUp className="h-4 w-4 text-saffron" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stop-color="#E05A17" stop-opacity={0.3}/>
                    <stop offset="95%" stop-color="#E05A17" stop-opacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.1)" />
                <XAxis dataKey="date" tickLine={false} style={{ fontSize: 9, fill: 'gray' }} />
                <YAxis tickLine={false} axisLine={false} style={{ fontSize: 9, fill: 'gray' }} />
                <Tooltip 
                  contentStyle={{ 
                    background: 'rgba(255,255,255,0.9)', 
                    border: '1px solid #ddd', 
                    borderRadius: '8px',
                    fontSize: '11px'
                  }} 
                />
                <Area type="monotone" dataKey="sales" name="Collections (₹)" stroke="#E05A17" strokeWidth={2.5} fillOpacity={1} fill="url(#salesColor)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Collections split & Top Products Pie */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground">Collection Methods</h3>
            <p className="text-[10px] text-muted-foreground">Split between Cash and Online channels</p>
          </div>
          <div className="flex-1 h-44 flex items-center justify-center">
            {cashCollection === 0 && onlineCollection === 0 ? (
              <p className="text-xs text-muted-foreground">No transaction data recorded yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `₹${Number(value).toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center">
                <span className="h-2.5 w-2.5 rounded-full bg-gold mr-2" />
                <span className="text-muted-foreground">Cash Payments</span>
              </div>
              <span className="font-semibold">₹{cashCollection.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center">
                <span className="h-2.5 w-2.5 rounded-full bg-saffron mr-2" />
                <span className="text-muted-foreground">Online / UPI</span>
              </div>
              <span className="font-semibold">₹{onlineCollection.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* --- LOWER ROW: UPCOMING DELIVERIES & ACTIVITIES --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Deliveries */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
            <div className="flex items-center space-x-2">
              <Clock className="h-4.5 w-4.5 text-saffron" />
              <h3 className="text-sm font-bold text-foreground">Upcoming Deliveries</h3>
            </div>
            <Link to="/orders" className="text-xs text-saffron hover:underline font-semibold">View All</Link>
          </div>
          <div className="space-y-3.5">
            {upcomingDeliveries.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground/30" />
                <p>No pending deliveries scheduled</p>
              </div>
            ) : (
              upcomingDeliveries.map((order) => (
                <div key={order.orderNumber} className="flex items-center justify-between p-3 bg-muted/20 hover:bg-muted/40 rounded-xl transition-colors">
                  <div>
                    <p className="text-xs font-bold text-foreground">{order.orderNumber}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Cust: {order.customer.name} | Mobile: {order.customer.mobile}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 text-[9px] font-bold bg-saffron/10 text-saffron rounded-full">
                      {dayjs(order.deliveryDate).format('DD MMM YYYY')}
                    </span>
                    <p className="text-[9px] text-muted-foreground mt-1 capitalize">{order.products.length} idols booked</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Store Activity logs */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
            <div className="flex items-center space-x-2">
              <History className="h-4.5 w-4.5 text-gold" />
              <h3 className="text-sm font-bold text-foreground">Audit Activity Log</h3>
            </div>
          </div>
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
            {logs.length === 0 ? (
              <p className="py-12 text-center text-xs text-muted-foreground">No activity recorded yet</p>
            ) : (
              logs.slice(0, 10).map((log) => (
                <div key={log.id} className="flex items-start space-x-3 text-xs">
                  <div className="h-2 w-2 rounded-full bg-saffron mt-1.5 shrink-0" />
                  <div className="flex-1 space-y-0.5">
                    <p className="text-foreground font-medium">{log.action}</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{log.details}</p>
                    <div className="flex items-center space-x-2 text-[9px] text-muted-foreground/80 mt-1">
                      <span className="font-semibold text-foreground/75">by {log.username}</span>
                      <span>•</span>
                      <span>{dayjs(log.timestamp).format('hh:mm A, DD MMM')}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
