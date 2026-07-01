import React, { useState, useEffect } from 'react';
import { 
  subscribePayments, 
  subscribeOrders,
  deletePayment
} from '../firebase/db';
import type { PaymentHistory } from '../types';
import { 
  DollarSign, 
  CreditCard, 
  Search, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownLeft, 
  PiggyBank,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';

export const Payments: React.FC = () => {
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');

  useEffect(() => {
    const unsubPayments = subscribePayments(setPayments);
    const unsubOrders = subscribeOrders(() => {});

    return () => {
      unsubPayments();
      unsubOrders();
    };
  }, []);

  const todayStr = dayjs().format('YYYY-MM-DD');

  // --- DELETE PAYMENT RECORD ---
  const handleDeletePayment = async (paymentId: string, orderId: string) => {
    if (window.confirm(`Are you sure you want to delete payment record ${paymentId} for order ${orderId}? This action cannot be undone.`)) {
      try {
        await deletePayment(paymentId);
        toast.success('Payment record deleted successfully.');
      } catch (error: any) {
        toast.error('Failed to delete payment: ' + error.message);
        console.error('Delete payment error:', error);
      }
    }
  };

  // --- STATS COMPUTATIONS ---
  const todayCollections = payments
    .filter(p => dayjs(p.timestamp).format('YYYY-MM-DD') === todayStr && p.type === 'payment')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPayments = payments
    .filter(p => p.type === 'payment')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalRefunds = payments
    .filter(p => p.type === 'refund')
    .reduce((sum, p) => sum + p.amount, 0);

  const netCollections = totalPayments - totalRefunds;

  const cashCollections = payments
    .filter(p => p.type === 'payment' && p.method === 'Cash')
    .reduce((sum, p) => sum + p.amount, 0) - 
    payments.filter(p => p.type === 'refund' && p.method === 'Cash').reduce((sum, p) => sum + p.amount, 0);

  const onlineCollections = netCollections - cashCollections;

  // --- FILTERS PIPELINE ---
  const filteredPayments = payments.filter(p => {
    const matchesSearch = p.orderId.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.notes && p.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesMethod = methodFilter === 'All' || p.method === methodFilter;
    const matchesType = typeFilter === 'All' || p.type === typeFilter;

    return matchesSearch && matchesMethod && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Payments Ledger History</h2>
        <p className="text-sm text-muted-foreground">Audit chronological cash collections, digital UPI transfers, and refund transactions</p>
      </div>

      {/* Stats Counter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Collection */}
        <div className="glass rounded-2xl p-5 border-l-4 border-l-saffron shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Today's Collections</span>
            <h3 className="text-2xl font-bold text-foreground">₹{todayCollections.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-saffron/10 text-saffron rounded-xl">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>

        {/* Net Collections */}
        <div className="glass rounded-2xl p-5 border-l-4 border-l-gold shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Net Lifetime Assets</span>
            <h3 className="text-2xl font-bold text-foreground">₹{netCollections.toLocaleString()}</h3>
            <p className="text-[9px] text-muted-foreground">In: ₹{totalPayments.toLocaleString()} | Out: ₹{totalRefunds.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-gold/10 text-gold rounded-xl">
            <PiggyBank className="h-6 w-6" />
          </div>
        </div>

        {/* Cash Deposits */}
        <div className="glass rounded-2xl p-5 border-l-4 border-l-amber-500 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Cash Vault Balance</span>
            <h3 className="text-2xl font-bold text-foreground">₹{cashCollections.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>

        {/* UPI/Online Deposits */}
        <div className="glass rounded-2xl p-5 border-l-4 border-l-indigo-500 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">UPI / Online Deposits</span>
            <h3 className="text-2xl font-bold text-foreground">₹{onlineCollections.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl">
            <CreditCard className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="glass p-4 rounded-2xl border border-border flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by Order ID, Txn ID, notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-saffron/30"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 w-full md:w-auto justify-end">
          {/* Method filter */}
          <div className="flex items-center space-x-1.5 bg-card border border-border px-3 py-1.5 rounded-xl text-xs font-semibold">
            <span className="text-muted-foreground">Method:</span>
            <select 
              value={methodFilter} 
              onChange={(e) => setMethodFilter(e.target.value)}
              className="bg-transparent border-none focus:ring-0 cursor-pointer"
            >
              <option value="All">All Methods</option>
              <option value="UPI">UPI / Net Banking</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Online">Online Gateway</option>
            </select>
          </div>

          {/* Type filter */}
          <div className="flex items-center space-x-1.5 bg-card border border-border px-3 py-1.5 rounded-xl text-xs font-semibold">
            <span className="text-muted-foreground">Type:</span>
            <select 
              value={typeFilter} 
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent border-none focus:ring-0 cursor-pointer"
            >
              <option value="All">All Types</option>
              <option value="payment">Receipts</option>
              <option value="refund">Refunds</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ledger Log List */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border bg-muted/20">
          <h3 className="font-bold text-xs text-foreground uppercase tracking-wider">Chronological Transaction Log ({filteredPayments.length})</h3>
        </div>
        
        <div className="divide-y divide-border overflow-x-auto">
          {filteredPayments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-16">No transaction ledger items registered.</p>
          ) : (
            filteredPayments.map((pay) => (
              <div 
                key={pay.id} 
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs hover:bg-muted/15 transition-colors"
              >
                {/* Transaction reference & type */}
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-xl shrink-0 ${
                    pay.type === 'refund' 
                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/10' 
                      : 'bg-green-500/10 text-green-500 border border-green-500/10'
                  }`}>
                    {pay.type === 'refund' ? <ArrowDownLeft className="h-4.5 w-4.5" /> : <ArrowUpRight className="h-4.5 w-4.5" />}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <strong className="font-bold text-foreground">{pay.id}</strong>
                      <span className={`px-2 py-0.5 text-[8px] font-extrabold rounded uppercase ${
                        pay.type === 'refund' ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500'
                      }`}>{pay.type}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Order Ref: <strong>{pay.orderId}</strong> | Channel: {pay.method}</p>
                  </div>
                </div>

                {/* Notes details */}
                <div className="flex-1 max-w-sm">
                  <span className="text-[9px] text-muted-foreground uppercase font-bold block">Ledger Remarks</span>
                  <p className="text-foreground mt-0.5 italic">"{pay.notes || 'N/A'}"</p>
                  <p className="text-[9px] text-muted-foreground/80 mt-1">Logged by staff: {pay.recordedBy}</p>
                </div>

                {/* Dates & Amount */}
                <div className="flex items-center space-x-6 text-right shrink-0">
                  <div>
                    <span className="text-[9px] text-muted-foreground uppercase block font-bold">Transaction Date</span>
                    <span className="font-semibold text-foreground flex items-center justify-end"><Calendar className="h-3.5 w-3.5 mr-1 text-slate-400" /> {dayjs(pay.timestamp).format('DD MMM YYYY')}</span>
                    <span className="text-[9px] text-muted-foreground block mt-0.5">{dayjs(pay.timestamp).format('hh:mm A')}</span>
                  </div>
                  <div className="w-24">
                    <span className="text-[9px] text-muted-foreground uppercase block font-bold">Amount</span>
                    <strong className={`text-sm font-bold ${pay.type === 'refund' ? 'text-amber-500' : 'text-green-600'}`}>
                      {pay.type === 'refund' ? `-₹${pay.amount.toLocaleString()}` : `+₹${pay.amount.toLocaleString()}`}
                    </strong>
                  </div>
                  <button
                    onClick={() => handleDeletePayment(pay.id, pay.orderId)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10 p-2 rounded-lg transition-all shrink-0"
                    title="Delete Payment Record"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
