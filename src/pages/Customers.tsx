import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  subscribeCustomers, 
  subscribeOrders,
  updateCustomerDetails,
  deleteCustomer
} from '../firebase/db';
import type { Customer, Order } from '../types';
import { 
  Search, 
  User, 
  Phone, 
  MapPin, 
  FileText, 
  TrendingUp, 
  Tag, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';

export const Customers: React.FC = () => {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const searchParamQuery = searchParams.get('search') || '';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState(searchParamQuery);
  const [selectedTag, setSelectedTag] = useState('All');
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);

  // Edit states
  const [editNotesId, setEditNotesId] = useState<string | null>(null);
  const [notesTemp, setNotesTemp] = useState('');
  const [editTagsId, setEditTagsId] = useState<string | null>(null);
  const [tagsTemp, setTagsTemp] = useState<Customer['tags']>([]);

  const tagList: Customer['tags'][number][] = ['VIP', 'Regular', 'Wholesale', 'Repeat Customer'];

  useEffect(() => {
    if (!currentUser) return;
    const unsubCust = subscribeCustomers(setCustomers);
    const unsubOrd = subscribeOrders(setOrders);

    return () => {
      unsubCust();
      unsubOrd();
    };
  }, [currentUser]);

  // Update search bar if query param changes
  useEffect(() => {
    if (searchParamQuery) {
      setSearchTerm(searchParamQuery);
    }
  }, [searchParamQuery]);

  const handleUpdateNotes = async (customerId: string) => {
    try {
      await updateCustomerDetails(customerId, {
        notes: notesTemp.trim()
      });
      setEditNotesId(null);
      toast.success('Notes updated successfully.');
    } catch (e: any) {
      toast.error('Failed to update notes: ' + e.message);
    }
  };

  const handleUpdateTags = async (customerId: string) => {
    try {
      await updateCustomerDetails(customerId, {
        tags: tagsTemp
      });
      setEditTagsId(null);
      toast.success('Tags updated successfully.');
    } catch (e: any) {
      toast.error('Failed to update tags: ' + e.message);
    }
  };

  const handleDeleteCustomer = async (customerId: string, customerName: string) => {
    if (window.confirm(`⚠️ WARNING: Delete customer "${customerName}" and all their booking history?\n\nThis action cannot be undone.`)) {
      try {
        await deleteCustomer(customerId);
        toast.success('Customer deleted successfully.');
      } catch (error: any) {
        toast.error('Failed to delete customer: ' + error.message);
        console.error('Delete customer error:', error);
      }
    }
  };

  const handleTagCheckboxChange = (tag: Customer['tags'][number]) => {
    if (tagsTemp.includes(tag)) {
      setTagsTemp(tagsTemp.filter(t => t !== tag));
    } else {
      setTagsTemp([...tagsTemp, tag]);
    }
  };

  // Filter Pipeline
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.mobile.includes(searchTerm) || 
                          c.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = selectedTag === 'All' || c.tags.includes(selectedTag as any);
    return matchesSearch && matchesTag;
  });

  // Get orders relating to customer mobile
  const getCustomerOrders = (mobile: string) => {
    return orders.filter(o => o.customer.mobile === mobile);
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Customer Relationship Management (CRM)</h2>
        <p className="text-sm text-muted-foreground">Monitor client history, credit balances, tags, and past bookings</p>
      </div>

      {/* Filter / Search header */}
      <div className="glass p-4 rounded-2xl border border-border flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, phone, address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-saffron/30"
          />
        </div>

        {/* Tag selector */}
        <div className="flex items-center space-x-1.5 bg-card border border-border px-3 py-1.5 rounded-xl text-xs font-semibold self-end md:self-auto">
          <Tag className="h-3.5 w-3.5 text-saffron mr-1" />
          <span className="text-muted-foreground">Filter by Tag:</span>
          <select 
            value={selectedTag} 
            onChange={(e) => setSelectedTag(e.target.value)}
            className="bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer"
          >
            <option value="All">All Tags</option>
            {tagList.map(tag => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        </div>
      </div>

      {/* Grid List */}
      <div className="space-y-4">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-2xl flex flex-col items-center justify-center space-y-2">
            <AlertCircle className="h-10 w-10 text-muted-foreground/35" />
            <h3 className="font-semibold text-foreground text-sm">No Customers Found</h3>
            <p className="text-xs text-muted-foreground">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          filteredCustomers.map(customer => {
            const isExpanded = expandedCustomerId === customer.id;
            const customerOrders = getCustomerOrders(customer.mobile);
            
            return (
              <div 
                key={customer.id} 
                className="bg-card border border-border rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                {/* Header card info */}
                <div 
                  onClick={() => setExpandedCustomerId(isExpanded ? null : customer.id)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-center space-x-4">
                    <div className="h-11 w-11 bg-gradient-to-tr from-saffron/10 to-gold/10 text-saffron rounded-xl flex items-center justify-center border border-saffron/10 shrink-0">
                      <User className="h-5.5 w-5.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-foreground">{customer.name}</h4>
                        <span className="text-[10px] text-muted-foreground font-mono">{customer.id}</span>
                        {customer.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 text-[8px] font-extrabold bg-gold/15 text-gold border border-gold/10 rounded uppercase tracking-wider">{tag}</span>
                        ))}
                      </div>
                      <div className="flex items-center space-x-3.5 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center"><Phone className="h-3.5 w-3.5 mr-1 text-slate-400" /> {customer.mobile}</span>
                        {customer.address && (
                          <span className="hidden sm:flex items-center truncate max-w-xs"><MapPin className="h-3.5 w-3.5 mr-1 text-slate-400" /> {customer.address}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="flex items-center space-x-6 md:space-x-8 text-right self-start md:self-auto pl-15 md:pl-0">
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase block font-bold">Total Booked</span>
                      <span className="text-xs font-bold text-foreground">{customer.totalOrders} Orders</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase block font-bold">Total Spent</span>
                      <span className="text-xs font-bold text-foreground">₹{customer.totalAmount.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground uppercase block font-bold">Dues Outstanding</span>
                      <span className={`text-xs font-bold ${customer.remainingDue > 0 ? 'text-red-500' : 'text-green-600'}`}>
                        ₹{customer.remainingDue.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCustomer(customer.id, customer.name);
                        }}
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10 p-2 rounded-lg transition-all"
                        title="Delete Customer"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                      <div className="text-muted-foreground">
                        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expandable History Ledger */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/15 p-5 space-y-5 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* Left column: address, notes, tags modifications */}
                      <div className="space-y-4 md:col-span-1 border-r border-border/60 pr-0 md:pr-6">
                        
                        {/* Address */}
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center"><MapPin className="h-3.5 w-3.5 mr-1 text-saffron" /> Address</span>
                          <p className="text-xs text-foreground bg-card p-3 border border-border rounded-xl">{customer.address || 'No address stored.'}</p>
                        </div>

                        {/* Customer tags editable */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center"><Tag className="h-3.5 w-3.5 mr-1 text-gold" /> Segmentation Tags</span>
                            {editTagsId === customer.id ? (
                              <div className="flex space-x-1">
                                <button onClick={() => handleUpdateTags(customer.id)} className="text-[10px] font-bold text-green-600">Save</button>
                                <span className="text-[10px] text-muted-foreground">|</span>
                                <button onClick={() => setEditTagsId(null)} className="text-[10px] text-muted-foreground">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditTagsId(customer.id); setTagsTemp(customer.tags); }} className="text-[10px] font-bold text-saffron hover:underline">Edit</button>
                            )}
                          </div>
                          {editTagsId === customer.id ? (
                            <div className="flex flex-wrap gap-2 p-3 bg-card border border-border rounded-xl">
                              {tagList.map(tag => (
                                <label key={tag} className="flex items-center space-x-1.5 text-xs text-foreground cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={tagsTemp.includes(tag)} 
                                    onChange={() => handleTagCheckboxChange(tag)}
                                    className="rounded text-saffron focus:ring-saffron"
                                  />
                                  <span>{tag}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {customer.tags.length === 0 ? (
                                <span className="text-xs text-muted-foreground">No tags configured.</span>
                              ) : (
                                customer.tags.map(t => (
                                  <span key={t} className="px-2 py-0.5 text-[9px] font-semibold bg-muted border border-border rounded text-foreground">{t}</span>
                                ))
                              )}
                            </div>
                          )}
                        </div>

                        {/* Customer notes editable */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center"><FileText className="h-3.5 w-3.5 mr-1 text-slate-400" /> Admin CRM Notes</span>
                            {editNotesId === customer.id ? (
                              <div className="flex space-x-1">
                                <button onClick={() => handleUpdateNotes(customer.id)} className="text-[10px] font-bold text-green-600">Save</button>
                                <span className="text-[10px] text-muted-foreground">|</span>
                                <button onClick={() => setEditNotesId(null)} className="text-[10px] text-muted-foreground">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditNotesId(customer.id); setNotesTemp(customer.notes); }} className="text-[10px] font-bold text-saffron hover:underline">Edit</button>
                            )}
                          </div>
                          {editNotesId === customer.id ? (
                            <textarea
                              rows={2.5}
                              value={notesTemp}
                              onChange={(e) => setNotesTemp(e.target.value)}
                              className="w-full p-3 border border-border bg-background text-xs rounded-xl focus:outline-none"
                            />
                          ) : (
                            <p className="text-xs text-foreground bg-card p-3 border border-border rounded-xl whitespace-pre-wrap italic">
                              {customer.notes || 'No notes saved yet. Add reminders here regarding delivery preferences or discounts.'}
                            </p>
                          )}
                        </div>

                        {/* Dates */}
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/60 pt-3">
                          <span>Joined: {dayjs(customer.joinedDate).format('DD MMM YYYY')}</span>
                          <span>Last Visit: {dayjs(customer.lastVisit).format('DD MMM YYYY')}</span>
                        </div>
                      </div>

                      {/* Right columns: previous order lists */}
                      <div className="space-y-3 md:col-span-2">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center"><TrendingUp className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Previous Bookings Ledger ({customerOrders.length})</span>
                        
                        {customerOrders.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-6 text-center bg-card border border-border rounded-xl">No order records registered matching this phone number.</p>
                        ) : (
                          <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                            {customerOrders.map(order => (
                              <div key={order.orderNumber} className="bg-card border border-border rounded-xl p-3 flex justify-between items-center text-xs">
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <strong className="text-foreground">{order.orderNumber}</strong>
                                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${
                                      order.status === 'delivered' ? 'bg-green-500/10 text-green-500' :
                                      order.status === 'cancelled' ? 'bg-red-500/10 text-red-500' :
                                      'bg-saffron/10 text-saffron'
                                    }`}>{order.status}</span>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground mt-1">
                                    {order.products.map(p => `${p.name} (x${p.quantity})`).join(', ')}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold text-foreground">₹{order.payment.grandTotal.toLocaleString()}</span>
                                  <p className="text-[9px] text-muted-foreground mt-0.5">
                                    Paid: ₹{order.payment.paid.toLocaleString()} | Due: <span className={order.payment.remaining > 0 ? 'text-red-500 font-semibold' : 'text-slate-400'}>₹{order.payment.remaining.toLocaleString()}</span>
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
