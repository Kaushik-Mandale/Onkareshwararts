import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts, getCustomers, subscribeOrders } from '../firebase/db';
import type { Product, Customer, Order } from '../types';
import { Search, Package, User, FileText, ArrowRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const [queryText, setQueryText] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Load baseline search datasets
  useEffect(() => {
    if (!isOpen) return;
    
    const loadData = async () => {
      try {
        const prodData = await getProducts();
        setProducts(prodData);
        const custData = await getCustomers();
        setCustomers(custData);
      } catch (e) {
        console.error('Failed to load search data:', e);
      }
    };
    loadData();

    const unsubscribeOrders = subscribeOrders((data) => {
      setOrders(data);
    });

    return () => unsubscribeOrders();
  }, [isOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      setQueryText('');
      setFilteredProducts([]);
      setFilteredCustomers([]);
      setFilteredOrders([]);
    }
  }, [isOpen]);

  // Handle search filtering
  useEffect(() => {
    const term = queryText.toLowerCase().trim();
    if (!term) {
      setFilteredProducts([]);
      setFilteredCustomers([]);
      setFilteredOrders([]);
      return;
    }

    // Filter Products
    const prodMatches = products.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.barcode.includes(term) ||
      p.category.toLowerCase().includes(term) ||
      p.size.toLowerCase().includes(term)
    ).slice(0, 5);
    setFilteredProducts(prodMatches);

    // Filter Customers
    const custMatches = customers.filter(c => 
      c.name.toLowerCase().includes(term) ||
      c.mobile.includes(term) ||
      c.address.toLowerCase().includes(term)
    ).slice(0, 5);
    setFilteredCustomers(custMatches);

    // Filter Orders
    const ordMatches = orders.filter(o => 
      o.orderNumber.toLowerCase().includes(term) ||
      o.customer.name.toLowerCase().includes(term) ||
      o.customer.mobile.includes(term)
    ).slice(0, 5);
    setFilteredOrders(ordMatches);

  }, [queryText, products, customers, orders]);

  // Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  const hasResults = filteredProducts.length > 0 || filteredCustomers.length > 0 || filteredOrders.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 md:px-6">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Search Box Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -20 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl relative z-10 overflow-hidden"
          >
            {/* Input Header */}
            <div className="flex items-center px-4 py-3.5 border-b border-border bg-muted/30">
              <Search className="h-5 w-5 text-muted-foreground mr-3" />
              <input
                ref={inputRef}
                type="text"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Search products, orders, customers, mobile numbers..."
                className="w-full bg-transparent border-none text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-0"
              />
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Results Content */}
            <div className="max-h-[420px] overflow-y-auto p-4 space-y-5">
              {!queryText && (
                <div className="py-8 text-center text-muted-foreground text-xs space-y-1">
                  <p>Type to search...</p>
                  <p>Try searching **"Ganesh"**, a phone number, or a barcode string.</p>
                </div>
              )}

              {queryText && !hasResults && (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  No results found matching "{queryText}"
                </div>
              )}

              {/* Products Section */}
              {filteredProducts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase flex items-center px-2">
                    <Package className="h-3.5 w-3.5 mr-1 text-saffron" />
                    Products ({filteredProducts.length})
                  </h4>
                  <div className="space-y-1">
                    {filteredProducts.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleNavigate(`/inventory?search=${p.name}`)}
                        className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-saffron/5 dark:group-hover:bg-saffron/10 border border-transparent hover:border-saffron/20 transition-all cursor-pointer"
                      >
                        <div className="flex items-center space-x-3">
                          {p.photoUrl ? (
                            <img src={p.photoUrl} alt={p.name} className="h-9 w-9 object-cover rounded-lg border border-border" />
                          ) : (
                            <div className="h-9 w-9 bg-saffron/10 text-saffron rounded-lg flex items-center justify-center font-bold text-xs uppercase">
                              {p.name[0]}
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-semibold text-foreground group-hover:text-saffron transition-colors">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground">Size: {p.size} | Barcode: {p.barcode} | Price: ₹{p.sellingPrice}</p>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-saffron opacity-0 group-hover:opacity-100 transition-all" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Orders Section */}
              {filteredOrders.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase flex items-center px-2">
                    <FileText className="h-3.5 w-3.5 mr-1 text-gold" />
                    Orders ({filteredOrders.length})
                  </h4>
                  <div className="space-y-1">
                    {filteredOrders.map(o => (
                      <div
                        key={o.orderNumber}
                        onClick={() => handleNavigate(`/orders?id=${o.orderNumber}`)}
                        className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-gold/5 dark:group-hover:bg-gold/10 border border-transparent hover:border-gold/20 transition-all cursor-pointer"
                      >
                        <div>
                          <p className="text-xs font-semibold text-foreground group-hover:text-gold transition-colors">{o.orderNumber}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Customer: {o.customer.name} ({o.customer.mobile}) | Status: <span className="capitalize font-semibold">{o.status}</span>
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-gold opacity-0 group-hover:opacity-100 transition-all" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Customers Section */}
              {filteredCustomers.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase flex items-center px-2">
                    <User className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                    Customers ({filteredCustomers.length})
                  </h4>
                  <div className="space-y-1">
                    {filteredCustomers.map(c => (
                      <div
                        key={c.id}
                        onClick={() => handleNavigate(`/customers?search=${c.name}`)}
                        className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-500/5 border border-transparent hover:border-emerald-500/20 transition-all cursor-pointer"
                      >
                        <div>
                          <p className="text-xs font-semibold text-foreground group-hover:text-emerald-500 transition-colors">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground">Mobile: {c.mobile} | Orders: {c.totalOrders} | Due: ₹{c.remainingDue}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-all" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Keyboard shortcuts footer */}
            <div className="px-4 py-2 bg-muted/40 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Use <kbd className="px-1.5 py-0.5 bg-card border border-border rounded font-mono">ESC</kbd> to close</span>
              <span>Search index: Live Firestore database</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
