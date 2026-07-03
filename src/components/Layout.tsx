import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { NotificationCenter } from './NotificationCenter';
import { GlobalSearch } from './GlobalSearch';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Package, 
  Users, 
  QrCode, 
  DollarSign, 
  BarChart3, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Sun, 
  Moon, 
  Search,
  User as UserIcon,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  // Apply Theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Keyboard shortcut Ctrl+K / Cmd+K to search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navLinks = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['admin', 'staff'] },
    { name: 'New Booking', path: '/booking', icon: ShoppingBag, roles: ['admin', 'staff'] },
    { name: 'Orders List', path: '/orders', icon: Package, roles: ['admin', 'staff'] },
    { name: 'Scan QR / Deliver', path: '/delivery', icon: QrCode, roles: ['admin', 'staff'] },
    { name: 'Payments Ledger', path: '/payments', icon: DollarSign, roles: ['admin', 'staff'] },
    { name: 'Inventory CRM', path: '/inventory', icon: Package, roles: ['admin', 'staff'] },
    { name: 'Customer CRM', path: '/customers', icon: Users, roles: ['admin', 'staff'] },
    { name: 'Reports & Analytics', path: '/reports', icon: BarChart3, roles: ['admin', 'staff'] },
    { name: 'Settings & Admin', path: '/settings', icon: Settings, roles: ['admin', 'staff'] },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex transition-colors duration-300">
      {/* ========================================== */}
      {/* DESKTOP SIDEBAR */}
      {/* ========================================== */}
      <aside className="hidden lg:flex flex-col w-64 bg-card border-r border-border shrink-0 z-20">
        {/* Brand Logo */}
        <div className="h-16 px-6 border-b border-border flex items-center space-x-3 bg-card/50">
          <div className="h-9 w-9 bg-gradient-to-tr from-saffron to-gold rounded-xl flex items-center justify-center text-white font-bold shadow-md shadow-saffron/10">
            G
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight bg-gradient-to-r from-saffron to-gold bg-clip-text text-transparent">
              Onkareshwararts SaaS
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider -mt-0.5">
              Enterprise Edition
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navLinks.map((link) => {
            // Hide admin links from staff
            if (currentUser && !link.roles.includes(currentUser.role)) return null;
            
            const Icon = link.icon;
            const active = isActive(link.path);
            return (
              <Link
                key={link.name}
                to={link.path}
                className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  active 
                    ? 'bg-gradient-to-r from-saffron to-saffron/85 text-white shadow-md shadow-saffron/15'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
                <span>{link.name}</span>
                {link.name === 'Settings & Admin' && (
                  <span className="ml-auto px-1.5 py-0.5 text-[8px] bg-gold/10 text-gold rounded font-bold uppercase border border-gold/10">Admin</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Account / Footer */}
        {currentUser && (
          <div className="p-4 border-t border-border bg-muted/20">
            <div className="flex items-center space-x-3 mb-3">
              <div className="h-9 w-9 bg-gradient-to-tr from-saffron/20 to-gold/20 text-saffron rounded-xl flex items-center justify-center border border-saffron/10">
                <UserIcon className="h-4.5 w-4.5" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-foreground truncate">{currentUser.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize flex items-center">
                  <ShieldCheck className="h-3 w-3 text-gold mr-1" />
                  {currentUser.role}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 py-2 bg-muted hover:bg-red-500/10 hover:text-red-500 rounded-xl text-xs font-semibold transition-all border border-border cursor-pointer active:scale-98"
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out</span>
            </button>
          </div>
        )}
      </aside>

      {/* ========================================== */}
      {/* MOBILE DRAWER (NAVBAR OVERLAY) */}
      {/* ========================================== */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed top-0 bottom-0 left-0 w-64 bg-card border-r border-border flex flex-col z-50"
            >
              <div className="h-16 px-6 border-b border-border flex items-center justify-between">
                <span className="font-bold bg-gradient-to-r from-saffron to-gold bg-clip-text text-transparent">Onkareshwararts</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
                {navLinks.map((link) => {
                  if (currentUser && !link.roles.includes(currentUser.role)) return null;
                  const Icon = link.icon;
                  const active = isActive(link.path);
                  return (
                    <Link
                      key={link.name}
                      to={link.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        active 
                          ? 'bg-gradient-to-r from-saffron to-saffron/85 text-white shadow-md'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4.5 w-4.5" />
                      <span>{link.name}</span>
                    </Link>
                  );
                })}
              </nav>

              {currentUser && (
                <div className="p-4 border-t border-border bg-muted/20">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="h-9 w-9 bg-saffron/10 text-saffron rounded-xl flex items-center justify-center">
                      <UserIcon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{currentUser.name}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{currentUser.role}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center space-x-2 py-2 bg-muted hover:bg-red-500/10 hover:text-red-500 rounded-xl text-xs font-semibold transition-all border border-border cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================== */}
      {/* MAIN CONTENT AREA */}
      {/* ========================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 px-4 md:px-6 bg-card/60 backdrop-blur-md border-b border-border flex items-center justify-between sticky top-0 z-30">
          {/* Mobile hamburger & search */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Menu className="h-5.5 w-5.5" />
            </button>

            {/* Ctrl+K Trigger UI bar */}
            <button
              onClick={() => setSearchModalOpen(true)}
              className="hidden md:flex items-center space-x-2 px-3 py-1.5 w-64 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 text-muted-foreground text-left cursor-pointer transition-all text-xs"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="flex-1">Search anywhere...</span>
              <kbd className="hidden lg:inline-block px-1.5 py-0.5 bg-card border border-border rounded font-mono text-[9px]">Ctrl+K</kbd>
            </button>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-3.5">
            {/* Search icon (mobile only) */}
            <button
              onClick={() => setSearchModalOpen(true)}
              className="md:hidden p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground cursor-pointer shadow-sm"
            >
              <Search className="h-5 w-5" />
            </button>

            {/* Dark/Light mode switcher */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
            >
              {darkMode ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
            </button>

            {/* Realtime Notification Center dropdown */}
            <NotificationCenter />

            {/* User role quick badge */}
            {currentUser && (
              <span className={`hidden sm:inline-block px-2.5 py-1 text-[10px] font-bold rounded-full uppercase border ${
                currentUser.role === 'admin' 
                  ? 'bg-saffron/10 text-saffron border-saffron/15' 
                  : 'bg-gold/10 text-gold border-gold/15'
              }`}>
                {currentUser.role}
              </span>
            )}
          </div>
        </header>

        {/* Dynamic page container */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto relative">
          {children}
        </main>
      </div>

      {/* Global Command palette search dialog */}
      <GlobalSearch isOpen={searchModalOpen} onClose={() => setSearchModalOpen(false)} />
    </div>
  );
};
