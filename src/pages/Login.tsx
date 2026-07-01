import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please fill in both username and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(username, password);
      toast.success('Welcome back! Logged in successfully.');
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(30,20%,97%)] dark:bg-[hsl(20,12%,6%)] p-6 transition-colors duration-300 relative overflow-hidden">
      {/* Background ambient radial golds */}
      <div className="absolute inset-0 bg-radial-[circle_at_center,rgba(224,90,23,0.05),transparent_60%] pointer-events-none" />
      <div className="absolute -top-40 -left-40 h-96 w-96 bg-gold/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 bg-saffron/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        className="w-full max-w-md bg-card/65 backdrop-blur-md border border-white/20 dark:border-white/5 rounded-3xl p-8 shadow-2xl relative z-10"
      >
        {/* Branding header */}
        <div className="text-center space-y-3 mb-8">
          <div className="mx-auto h-16 w-16 bg-gradient-to-tr from-saffron to-gold rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl shadow-xl shadow-saffron/20 relative group overflow-hidden">
            <span className="relative z-10 animate-pulse">G</span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-saffron to-gold bg-clip-text text-transparent flex items-center justify-center">
              Onkareshwararts CRM
              <Sparkles className="h-4 w-4 text-gold ml-1 animate-pulse" />
            </h1>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest mt-1">Enterprise Portal</p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start space-x-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4 text-xs">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Username</label>
              <input
                type="text"
                required
                placeholder="admin or staff"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron transition-all"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron transition-all"
              />
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center space-x-2 text-muted-foreground font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded text-saffron focus:ring-saffron"
                />
                <span>Remember Session</span>
              </label>
              <span className="text-[10px] text-muted-foreground/60">Internal operations only</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-saffron to-gold text-white font-extrabold rounded-xl shadow-lg hover:shadow-saffron/20 hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer text-xs"
          >
            {loading ? 'Authenticating...' : 'Sign In To Dashboard'}
          </button>

          {/* Provisioning Tip */}
          <div className="p-3 bg-saffron/5 dark:bg-saffron/10 border border-saffron/10 dark:border-saffron/20 rounded-xl text-[10px] text-muted-foreground leading-relaxed flex items-start space-x-2">
            <ShieldCheck className="h-4.5 w-4.5 text-gold shrink-0 mt-0.5" />
            <span>
              <strong>First time?</strong> Log in with `admin` / `Ganpati@123` or `staff` / `Ganpati@123`. 
              The application will automatically register and provision them securely in your Firebase auth instance.
            </span>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
