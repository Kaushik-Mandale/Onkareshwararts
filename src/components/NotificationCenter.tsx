import React, { useState, useEffect, useRef } from 'react';
import { 
  subscribeNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead 
} from '../firebase/db';
import type { Notification } from '../types';
import { 
  Bell, 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  Package, 
  CheckCircle, 
  CheckCheck,
  PackageCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';

export const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeNotifications((data) => {
      setNotifications(data);
    });
    return () => unsubscribe();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
  };

  const handleItemClick = async (id: string) => {
    await markNotificationAsRead(id);
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'lowStock':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'pendingPayment':
        return <DollarSign className="h-4 w-4 text-amber-500" />;
      case 'deliveryToday':
        return <Clock className="h-4 w-4 text-saffron" />;
      case 'largeOrder':
        return <Package className="h-4 w-4 text-purple-500" />;
      case 'paymentReceived':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'newBooking':
        return <PackageCheck className="h-4 w-4 text-saffron" />;
      case 'deliveryCompleted':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getNotificationBg = (type: Notification['type']) => {
    switch (type) {
      case 'lowStock': return 'bg-red-50 dark:bg-red-950/20';
      case 'pendingPayment': return 'bg-amber-50 dark:bg-amber-950/20';
      case 'deliveryToday': return 'bg-saffron/5 dark:bg-saffron/10';
      case 'largeOrder': return 'bg-purple-50 dark:bg-purple-950/20';
      case 'paymentReceived': return 'bg-green-50 dark:bg-green-950/20';
      case 'newBooking': return 'bg-saffron/5 dark:bg-saffron/10';
      case 'deliveryCompleted': return 'bg-emerald-50 dark:bg-emerald-950/20';
      default: return 'bg-muted/50';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-saffron text-[10px] font-bold text-white shadow-md animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2.5 w-80 md:w-96 glass rounded-2xl shadow-xl border border-white/20 dark:border-white/5 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-card/60 backdrop-blur-md">
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-sm text-foreground">Alert Center</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-saffron/10 text-saffron rounded-full">
                    {unreadCount} Unread
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-saffron hover:text-saffron-light font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[360px] overflow-y-auto divide-y divide-border bg-card/25">
              {notifications.length === 0 ? (
                <div className="py-12 px-4 text-center text-muted-foreground text-sm flex flex-col items-center justify-center space-y-2">
                  <Bell className="h-10 w-10 text-muted-foreground/35 animate-bounce-slow" />
                  <p>All quiet. No notifications found.</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleItemClick(notification.id)}
                    className={`p-4 flex items-start space-x-3 transition-colors cursor-pointer relative ${
                      !notification.read ? 'bg-white/40 dark:bg-white/5' : 'hover:bg-muted/30'
                    }`}
                  >
                    {!notification.read && (
                      <span className="absolute top-4 right-4 h-2 w-2 rounded-full bg-saffron" />
                    )}
                    
                    <div className={`p-2.5 rounded-xl ${getNotificationBg(notification.type)} shadow-inner shrink-0`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="space-y-1 pr-4">
                      <p className={`text-xs text-foreground leading-relaxed ${!notification.read ? 'font-semibold' : 'text-muted-foreground'}`}>
                        {notification.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {dayjs(notification.createdAt).format('DD MMM YY, hh:mm A')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
