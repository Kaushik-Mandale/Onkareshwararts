import React, { useState } from 'react';
import { saveFirebaseConfig } from '../firebase/config';
import { Settings, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export const FirebaseSetupWizard: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [authDomain, setAuthDomain] = useState('');
  const [projectId, setProjectId] = useState('');
  const [storageBucket, setStorageBucket] = useState('');
  const [messagingSenderId, setMessagingSenderId] = useState('');
  const [appId, setAppId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !projectId || !authDomain || !appId) {
      setError('Please fill in at least API Key, Project ID, Auth Domain, and App ID.');
      return;
    }

    const config = {
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim(),
      projectId: projectId.trim(),
      storageBucket: storageBucket.trim() || `${projectId.trim()}.appspot.com`,
      messagingSenderId: messagingSenderId.trim(),
      appId: appId.trim()
    };

    const saved = saveFirebaseConfig(config);
    if (saved) {
      setError('');
      setSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      setError('Failed to write configuration to local storage.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(30,20%,95%)] dark:bg-[hsl(20,10%,4%)] p-6 transition-colors duration-300">
      <div className="absolute inset-0 bg-radial-[circle_at_center,rgba(224,90,23,0.06),transparent_60%] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-xl glass-premium rounded-2xl p-8 border border-white/20 dark:border-white/5 relative z-10 overflow-hidden shadow-2xl"
      >
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-3 bg-gradient-to-tr from-saffron to-gold rounded-xl text-white shadow-lg">
            <Settings className="h-6 w-6 animate-spin-slow" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Firebase Configuration Required</h1>
            <p className="text-sm text-muted-foreground">Setup the database connection for Onkareshwararts Business Manager</p>
          </div>
        </div>

        {success ? (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center justify-center py-10 space-y-4 text-center"
          >
            <div className="h-16 w-16 bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center shadow-inner">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Configuration Saved!</h2>
              <p className="text-sm text-muted-foreground mt-1">Reconnecting to database and reloading resources...</p>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start space-x-3 text-red-700 dark:text-red-400 text-sm">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="bg-saffron/5 dark:bg-saffron/10 border border-saffron/10 dark:border-saffron/20 rounded-xl p-4 text-xs text-muted-foreground space-y-2">
              <div className="font-semibold text-saffron flex items-center">
                <HelpCircle className="h-3.5 w-3.5 mr-1" />
                Where to get these?
              </div>
              <p>
                Open your <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-saffron-light">Firebase Console</a>, select your project, go to **Project Settings &gt; General &gt; Your Apps** (or add a Web App), and copy the config object keys.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">Project ID *</label>
                <input
                  type="text"
                  required
                  placeholder="ganpati-shop-abc12"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">API Key *</label>
                <input
                  type="password"
                  required
                  placeholder="AIzaSyA1..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">Auth Domain *</label>
                <input
                  type="text"
                  required
                  placeholder="ganpati-shop.firebaseapp.com"
                  value={authDomain}
                  onChange={(e) => setAuthDomain(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">App ID *</label>
                <input
                  type="text"
                  required
                  placeholder="1:12345:web:abcdef..."
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">Storage Bucket</label>
                <input
                  type="text"
                  placeholder="ganpati-shop.appspot.com"
                  value={storageBucket}
                  onChange={(e) => setStorageBucket(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">Messaging Sender ID</label>
                <input
                  type="text"
                  placeholder="123456789012"
                  value={messagingSenderId}
                  onChange={(e) => setMessagingSenderId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron transition-all"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-saffron to-gold text-white font-bold rounded-xl shadow-lg hover:shadow-saffron/20 hover:brightness-105 active:scale-98 transition-all cursor-pointer text-center text-sm"
              >
                Save &amp; Connect App
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};
