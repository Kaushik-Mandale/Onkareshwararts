import React, { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebase/config';
import { getBusinessSettings, logActivity } from '../firebase/db';
import type { User as AppUser } from '../types';
import { toast } from 'sonner';

interface AuthContextType {
  currentUser: AppUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AppUser>;
  logout: (reason?: string) => Promise<void>;
  updateUserSession: (updatedUser: AppUser) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const activityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const settingsTimerRef = useRef<number>(15); // Default 15 mins
  const currentUserRef = useRef<AppUser | null>(null);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const clearInactivityTimer = useCallback(() => {
    if (activityTimerRef.current) {
      clearTimeout(activityTimerRef.current);
      activityTimerRef.current = null;
    }
  }, []);

  // Logout handler
  const logout = useCallback(async (reason?: string) => {
    if (!auth) return;
    try {
      await logActivity('Logout', `User logged out${reason ? ` (${reason})` : ''}`);
      await signOut(auth);
      setCurrentUser(null);
      setFirebaseUser(null);
      clearInactivityTimer();
      if (reason) {
        toast.info(reason, { duration: 5000 });
      } else {
        toast.success('Logged out successfully.');
      }
    } catch (e) {
      console.error('Failed to log out:', e);
    }
  }, [clearInactivityTimer]);

  // Inactivity Auto Logout logic
  const resetInactivityTimer = useCallback(() => {
    clearInactivityTimer();
    const minutes = settingsTimerRef.current;
    
    // If timer is 0, auto-logout is disabled
    if (minutes === 0 || !currentUserRef.current) return;

    activityTimerRef.current = setTimeout(() => {
      void logout('Logged out automatically due to inactivity.');
    }, minutes * 60 * 1000);
  }, [clearInactivityTimer, logout]);

  // Monitor Auth State
  useEffect(() => {
    if (!isFirebaseConfigured() || !auth || !db) {
      setLoading(false);
      return;
    }

    const firebaseAuth = auth;
    const firestore = db;

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (fUser) => {
      setFirebaseUser(fUser);
      if (fUser) {
        // Fetch custom app user data from Firestore
        const userDocRef = doc(firestore, 'users', fUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const appUserData = userDoc.data() as AppUser;
          if (appUserData.status === 'active') {
            setCurrentUser(appUserData);
            // Fetch settings for auto-logout configuration
            try {
              const settings = await getBusinessSettings();
              settingsTimerRef.current = settings.autoLogoutTimer;
              resetInactivityTimer();
            } catch (err) {
              console.error('Error fetching settings:', err);
            }
          } else {
            toast.error('Your account has been deactivated.');
            await signOut(firebaseAuth);
            setCurrentUser(null);
          }
        } else {
          // If auth exists but no Firestore profile, build a fallback based on email
          const username = fUser.email?.split('@')[0] || 'ram2026';
          const role = username === 'vivek2026' ? 'admin' : 'staff';
          const fallbackUser: AppUser = {
            uid: fUser.uid,
            username,
            name: username === 'vivek2026' ? 'Vivek' : 'Ram',
            role,
            status: 'active',
            createdAt: new Date().toISOString()
          };
          await setDoc(userDocRef, fallbackUser);
          setCurrentUser(fallbackUser);
        }
      } else {
        setCurrentUser(null);
        clearInactivityTimer();
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      clearInactivityTimer();
    };
  }, [clearInactivityTimer, resetInactivityTimer]);

  // Add interaction listeners for auto-logout reset
  useEffect(() => {
    if (!currentUser) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    const handleActivity = () => resetInactivityTimer();

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearInactivityTimer();
    };
  }, [clearInactivityTimer, currentUser, resetInactivityTimer]);

  // Login handler with self-provisioning check
  const login = async (username: string, password: string): Promise<AppUser> => {
    if (!isFirebaseConfigured() || !auth || !db) {
      throw new Error('Firebase is not yet configured. Please use the wizard.');
    }

    const email = `${username.trim().toLowerCase()}@ganpatishop.local`;

    try {
      // 1. Try normal Firebase sign-in
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const fUser = userCredential.user;
      
      const userDocRef = doc(db, 'users', fUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        const role = username.toLowerCase() === 'vivek2026' ? 'admin' : 'staff';
        const newAppUser: AppUser = {
          uid: fUser.uid,
          username: username.trim().toLowerCase(),
          name: username.toLowerCase() === 'vivek2026' ? 'Vivek' : 'Ram',
          role,
          status: 'active',
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, newAppUser);
        setCurrentUser(newAppUser);
        await logActivity('Login', `Logged in and provisioned profile: ${username}`);
        return newAppUser;
      }
      
      const appUserData = userDoc.data() as AppUser;
      if (appUserData.status !== 'active') {
        throw new Error('This account has been deactivated.');
      }
      
      setCurrentUser(appUserData);
      await logActivity('Login', `User logged in: ${username}`);
      return appUserData;

    } catch (error: any) {
      console.warn('Authentication error:', error.code, error.message);
      
      // 2. Self-Provisioning: If user is not found, and username/password matches the default, create them
      const isDefaultAdmin = username.toLowerCase() === 'vivek2026' && password === 'vivek@26';
      const isDefaultStaff = username.toLowerCase() === 'ram2026' && password === 'ram@26';

      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        if (isDefaultAdmin || isDefaultStaff) {
          try {
            toast.info(`Provisioning default ${username} credentials on Firebase Auth...`);
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const fUser = userCredential.user;
            
            const role = username.toLowerCase() === 'vivek2026' ? 'admin' : 'staff';
            const newAppUser: AppUser = {
              uid: fUser.uid,
              username: username.trim().toLowerCase(),
              name: username.toLowerCase() === 'vivek2026' ? 'Vivek' : 'Ram',
              role,
              status: 'active',
              createdAt: new Date().toISOString()
            };
            
            await setDoc(doc(db, 'users', fUser.uid), newAppUser);
            setCurrentUser(newAppUser);
            await logActivity('Login (Provisioned)', `First-time provision and login: ${username}`);
            return newAppUser;
          } catch (createErr: any) {
            console.error('Failed to self-provision account:', createErr);
            throw new Error(`Self-provisioning failed: ${createErr.message}`);
          }
        }
      }
      
      // Re-throw localized auth error
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        throw new Error('Incorrect password. Please try again.');
      } else if (error.code === 'auth/user-not-found') {
        throw new Error('Username not found.');
      } else {
        throw new Error(error.message || 'Login failed. Please check connection.');
      }
    }
  };

  const updateUserSession = (updatedUser: AppUser) => {
    setCurrentUser(updatedUser);
  };

  const value = {
    currentUser,
    firebaseUser,
    loading,
    login,
    logout,
    updateUserSession
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
