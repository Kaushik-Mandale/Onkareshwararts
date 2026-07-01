import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isFirebaseConfigured } from '../firebase/config';
import { FirebaseSetupWizard } from './FirebaseSetupWizard';
import { ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'staff')[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles = ['admin', 'staff'] 
}) => {
  const { currentUser, loading } = useAuth();

  // If Firebase is not configured at all, intercept and show setup wizard
  if (!isFirebaseConfigured()) {
    return <FirebaseSetupWizard />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-saffron/20 border-t-saffron animate-spin" />
          <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-gold/10 border-b-gold animate-spin-reverse opacity-70" />
        </div>
        <p className="mt-4 text-sm font-medium text-muted-foreground animate-pulse tracking-wide">
          Verifying security keys...
        </p>
      </div>
    );
  }

  // Redirect to login if not logged in
  if (!currentUser) {
    const redirectTarget = `${window.location.pathname}${window.location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectTarget)}`} replace />;
  }

  // Check role restriction
  if (!allowedRoles.includes(currentUser.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass-premium border border-red-500/10 rounded-2xl p-8 text-center shadow-lg"
        >
          <div className="mx-auto w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Your account ({currentUser.name}) with role <strong>{currentUser.role.toUpperCase()}</strong> does not have permission to view this section.
          </p>
          <div className="mt-6">
            <button
              onClick={() => window.history.back()}
              className="px-6 py-2 bg-saffron hover:bg-saffron-light text-white font-semibold rounded-xl text-sm transition-all active:scale-95 shadow-lg shadow-saffron/10 cursor-pointer"
            >
              Go Back
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
};
