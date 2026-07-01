import React, { useCallback, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  getBusinessSettings, 
  updateBusinessSettings, 
  logActivity 
} from '../firebase/db';
import { db } from '../firebase/config';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  writeBatch 
} from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';

import type { BusinessSettings, User as AppUser } from '../types';
import { 
  Building, 
  FileText, 
  Users, 
  ShieldCheck, 
  Database, 
  Save, 
  Download, 
  Upload, 
  KeyRound, 
  UserPlus, 
  Trash2, 
  AlertTriangle 
} from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';

export const Settings: React.FC = () => {
  const { currentUser, firebaseUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [_settings, setSettings] = useState<BusinessSettings | null>(null);
  const [saving, setSaving] = useState(false);

  // Profile Form States
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [address, setAddress] = useState('');
  const [upiId, setUpiId] = useState('');
  
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');

  // Invoice Form States
  const [prefix, setPrefix] = useState('');
  const [taxRate, setTaxRate] = useState(18);
  const [gstEnabled, setGstEnabled] = useState(false);
  const [terms, setTerms] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [autoLogoutTimer, setAutoLogoutTimer] = useState(15);

  // Security Form States
  const [_currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Admin User List States
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'staff'>('staff');
  const [newStaffPassword, setNewStaffPassword] = useState('ram@26');
  const [userCreating, setUserCreating] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!db || currentUser?.role !== 'admin') return;
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const list = snapshot.docs.map(d => d.data() as AppUser);
      setUsersList(list);
    } catch (e) {
      console.error('Failed to load users list:', e);
    }
  }, [currentUser?.role]);

  // Load Settings
  useEffect(() => {
    const loadSettings = async () => {
      const data = await getBusinessSettings();
      setSettings(data);
      if (data) {
        setBusinessName(data.businessName);
        setOwnerName(data.ownerName);
        setPhone(data.phone);
        setWhatsapp(data.whatsapp);
        setAddress(data.address);
        setUpiId(data.upiId);
        
        setAccountName(data.bankDetails?.accountName || '');
        setAccountNumber(data.bankDetails?.accountNumber || '');
        setIfscCode(data.bankDetails?.ifscCode || '');
        setBankName(data.bankDetails?.bankName || '');

        setPrefix(data.invoiceSettings?.prefix || 'GAN-2026-');
        setTaxRate(data.invoiceSettings?.taxRate || 18);
        setGstEnabled(data.invoiceSettings?.gstEnabled || false);
        setTerms(data.invoiceSettings?.terms || '');
        setCurrency(data.currency || 'INR');
        setAutoLogoutTimer(data.autoLogoutTimer || 15);
      }
    };
    loadSettings();
    loadUsers();
  }, [loadUsers]);

  // --- SAVE SETTINGS ---
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates: Partial<BusinessSettings> = {
        businessName,
        ownerName,
        phone,
        whatsapp,
        address,
        upiId,
        bankDetails: {
          accountName,
          accountNumber,
          ifscCode,
          bankName
        }
      };
      await updateBusinessSettings(updates);
      toast.success('Business profile updated successfully!');
    } catch (err: any) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates: Partial<BusinessSettings> = {
        invoiceSettings: {
          prefix,
          taxRate,
          gstEnabled,
          terms
        },
        currency,
        autoLogoutTimer
      };
      await updateBusinessSettings(updates);
      toast.success('Billing & invoice settings saved!');
    } catch (err: any) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- CHANGE PASSWORD ---
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match!');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setPasswordSaving(true);
    try {
      if (firebaseUser) {
        await updatePassword(firebaseUser, newPassword);
        toast.success('Your account password has been updated!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error('Authentication session error. Re-login required.');
      }
    } catch (err: any) {
      toast.error('Password update failed: ' + err.message);
    } finally {
      setPasswordSaving(false);
    }
  };

  // --- CREATE USER (ADMIN) ---
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newName.trim() || !newStaffPassword.trim()) {
      toast.error('All user fields are required.');
      return;
    }

    setUserCreating(true);
    try {
      if (!db) throw new Error('Database connection missing');
      
      const cleanUsername = newUsername.trim().toLowerCase();
      
      // Check duplicate username
      const userExists = usersList.find(u => u.username === cleanUsername);
      if (userExists) {
        toast.error('Username already exists in database.');
        setUserCreating(false);
        return;
      }

      // Provision user account mapping (we'll save password in Firestore so that login can auto-provision)
      const fakeUid = 'USER-' + Math.floor(100000 + Math.random() * 900000);
      const newUserPayload: AppUser & { password?: string } = {
        uid: fakeUid,
        username: cleanUsername,
        name: newName.trim(),
        role: newRole,
        status: 'active',
        createdAt: new Date().toISOString(),
        password: newStaffPassword.trim() // saved for dynamic Firebase Auth provisioning upon first login
      };

      await setDoc(doc(db, 'users', fakeUid), newUserPayload);
      toast.success(`Staff user "${cleanUsername}" created! They can log in immediately with default password.`);
      setNewUsername('');
      setNewName('');
      setNewStaffPassword('ram@26');
      loadUsers();
      await logActivity('User Created', `Created staff user account: ${cleanUsername}`);
    } catch (err: any) {
      toast.error('User creation failed: ' + err.message);
    } finally {
      setUserCreating(false);
    }
  };

  const handleDeleteUser = async (userToDelete: AppUser) => {
    if (!db) return;
    if (userToDelete.username === 'vivek2026') {
      toast.error('The default system admin account cannot be deleted.');
      return;
    }
    if (window.confirm(`Are you sure you want to delete user "${userToDelete.name}"?`)) {
      try {
        await deleteDoc(doc(db, 'users', userToDelete.uid));
        toast.success('User deleted successfully.');
        loadUsers();
        await logActivity('User Deleted', `Deleted staff account: ${userToDelete.username}`);
      } catch (err: any) {
        toast.error('Deletion failed: ' + err.message);
      }
    }
  };

  // ==========================================
  // DATABASE BACKUP & RESTORE
  // ==========================================
  const handleExportBackup = async () => {
    if (!db) return;
    toast.info('Assembling database collections...');

    try {
      const collectionsToBackup = [
        'products',
        'customers',
        'orders',
        'payments',
        'activity_logs',
        'settings'
      ];
      
      const backupData: Record<string, any[]> = {};

      for (const colName of collectionsToBackup) {
        const snapshot = await getDocs(collection(db, colName));
        backupData[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      // Download JSON File
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `ganpati_db_backup_${dayjs().format('YYYY-MM-DD_HHmmss')}.json`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Database backup downloaded successfully!');
      await logActivity('Backup Exported', 'Manual JSON database backup downloaded');
    } catch (e: any) {
      toast.error('Backup failed: ' + e.message);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('WARNING: Restoring a backup will overwrite existing documents with the same IDs. Proceed?')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (!db) return;
      const text = event.target?.result as string;
      try {
        const data = JSON.parse(text) as Record<string, any[]>;
        const batch = writeBatch(db);
        
        let writeCount = 0;

        for (const colName in data) {
          const docsArray = data[colName];
          for (const docData of docsArray) {
            const { id, ...fields } = docData;
            const docRef = doc(db, colName, id);
            batch.set(docRef, fields);
            writeCount++;
          }
        }

        await batch.commit();
        toast.success(`Database Restored! Loaded ${writeCount} documents successfully.`);
        await logActivity('Backup Restored', `Restored database backup. Loaded ${writeCount} documents.`);
      } catch (err: any) {
        toast.error('Restore failed. Ensure the JSON backup file is valid: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Settings &amp; Admin Panel</h2>
        <p className="text-sm text-muted-foreground">Configure business profile, manage users, and backup database</p>
      </div>

      {/* Tab Navigation buttons */}
      <div className="flex border-b border-border space-x-4 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'profile', name: 'Business Profile', icon: Building },
          { id: 'billing', name: 'Billing & Invoice', icon: FileText },
          { id: 'password', name: 'Change Password', icon: KeyRound },
          { id: 'users', name: 'Manage Users', icon: Users, adminOnly: true },
          { id: 'database', name: 'Backup & Restore', icon: Database, adminOnly: true }
        ].map((t) => {
          if (t.adminOnly && currentUser?.role !== 'admin') return null;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center space-x-1.5 pb-2.5 px-2 font-semibold tracking-wide border-b-2 transition-all cursor-pointer ${
                activeTab === t.id 
                  ? 'border-saffron text-saffron font-bold' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t.name}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================== */}
      {/* TAB 1: BUSINESS PROFILE */}
      {/* ========================================== */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6 max-w-3xl">
          <div className="space-y-4">
            <h3 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center border-b border-border pb-3"><Building className="h-4.5 w-4.5 text-saffron mr-2" /> Shop Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Shop Business Name</label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Owner Name</label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Business Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">WhatsApp Number</label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Shop Physical Address</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center border-b border-border pb-3"><Building className="h-4.5 w-4.5 text-gold mr-2" /> Banking &amp; UPI Ledger Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">UPI Virtual ID</label>
                <input
                  type="text"
                  placeholder="name@upi"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Bank Account Name</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Account Number</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">IFSC Code</label>
                <input
                  type="text"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-border">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-1.5 px-6 py-2.5 bg-gradient-to-r from-saffron to-gold text-white font-bold rounded-xl text-xs shadow-md cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving...' : 'Save Profile Details'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ========================================== */}
      {/* TAB 2: BILLING & INVOICE */}
      {/* ========================================== */}
      {activeTab === 'billing' && (
        <form onSubmit={handleSaveInvoice} className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6 max-w-3xl">
          <div className="space-y-4">
            <h3 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center border-b border-border pb-3"><FileText className="h-4.5 w-4.5 text-saffron mr-2" /> Invoice Config</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Order Prefix</label>
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Base Tax Rate (%)</label>
                <input
                  type="number"
                  min={0}
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl"
                />
              </div>

              <div className="space-y-2 pt-5">
                <label className="flex items-center space-x-2 text-foreground font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gstEnabled}
                    onChange={(e) => setGstEnabled(e.target.checked)}
                    className="rounded text-saffron focus:ring-saffron"
                  />
                  <span>Enable Tax (GST) Calculations by Default</span>
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Inactivity Auto-Logout (Minutes, 0 to disable)</label>
                <input
                  type="number"
                  min={0}
                  value={autoLogoutTimer}
                  onChange={(e) => setAutoLogoutTimer(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Invoice Terms &amp; Conditions</label>
                <textarea
                  rows={3}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-border">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-1.5 px-6 py-2.5 bg-gradient-to-r from-saffron to-gold text-white font-bold rounded-xl text-xs shadow-md cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving...' : 'Save Invoice Config'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ========================================== */}
      {/* TAB 3: CHANGE PASSWORD */}
      {/* ========================================== */}
      {activeTab === 'password' && (
        <form onSubmit={handleChangePassword} className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 max-w-md">
          <h3 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center border-b border-border pb-3"><KeyRound className="h-4.5 w-4.5 text-saffron mr-2" /> Change Password</h3>
          
          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border border-border bg-background rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-border bg-background rounded-xl"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-border flex justify-end">
            <button
              type="submit"
              disabled={passwordSaving}
              className="flex items-center space-x-1.5 px-5 py-2 bg-gradient-to-r from-saffron to-gold text-white font-bold rounded-xl text-xs cursor-pointer disabled:bg-muted"
            >
              <KeyRound className="h-4 w-4" />
              <span>{passwordSaving ? 'Updating...' : 'Update Password'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ========================================== */}
      {/* TAB 4: MANAGE USERS (ADMIN ONLY) */}
      {/* ========================================== */}
      {activeTab === 'users' && currentUser?.role === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Staff form */}
          <form onSubmit={handleCreateUser} className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 h-fit">
            <h3 className="font-bold text-xs text-foreground uppercase tracking-wider border-b border-border pb-3 flex items-center"><UserPlus className="h-4.5 w-4.5 text-saffron mr-2" /> Create User</h3>
            
            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Username *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. rahul"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.replace(/\s+/g, ''))}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Display Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Role Type</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl font-semibold cursor-pointer"
                >
                  <option value="staff">Staff Member</option>
                  <option value="admin">System Administrator</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Default Password *</label>
                <input
                  type="text"
                  required
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background rounded-xl font-mono font-bold"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={userCreating}
              className="w-full py-2.5 bg-saffron hover:bg-saffron-light text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-saffron/10 cursor-pointer"
            >
              <UserPlus className="h-4.5 w-4.5" />
              <span>{userCreating ? 'Creating...' : 'Create Account'}</span>
            </button>
          </form>

          {/* Users List */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm lg:col-span-2 space-y-4">
            <h3 className="font-bold text-xs text-foreground uppercase tracking-wider border-b border-border pb-3 flex items-center"><ShieldCheck className="h-4.5 w-4.5 text-gold mr-2" /> Registered User Accounts ({usersList.length})</h3>
            
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {usersList.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-10">No users found.</p>
              ) : (
                usersList.map((user) => (
                  <div key={user.uid} className="flex justify-between items-center p-3 bg-muted/20 hover:bg-muted/40 rounded-xl transition-colors border border-border/40 text-xs">
                    <div>
                      <div className="flex items-center space-x-2">
                        <strong className="text-foreground">{user.name}</strong>
                        <span className={`px-2 py-0.5 text-[8px] font-extrabold rounded uppercase ${
                          user.role === 'admin' ? 'bg-saffron/10 text-saffron border border-saffron/10' : 'bg-gold/10 text-gold border border-gold/10'
                        }`}>{user.role}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Username: {user.username} | Status: <span className="capitalize font-semibold text-green-600">{user.status}</span></p>
                    </div>

                    <button
                      onClick={() => handleDeleteUser(user)}
                      disabled={user.username === 'vivek2026'}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg disabled:opacity-30 cursor-pointer"
                      title="Delete User"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 5: DATABASE BACKUP & RESTORE (ADMIN ONLY) */}
      {/* ========================================== */}
      {activeTab === 'database' && currentUser?.role === 'admin' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
          {/* Export card */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-xs text-foreground uppercase tracking-wider border-b border-border pb-3 flex items-center"><Download className="h-4.5 w-4.5 text-saffron mr-2" /> Database Export</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Generate a manual backup configuration file containing all current database entities. This download is in **JSON** structure and can be archived locally or imported back at a later date.
            </p>
            <div className="pt-2">
              <button
                onClick={handleExportBackup}
                className="flex items-center justify-center space-x-1.5 px-6 py-3 bg-gradient-to-r from-saffron to-gold text-white font-bold rounded-xl text-xs shadow-lg shadow-saffron/10 hover:brightness-105 active:scale-98 transition-all cursor-pointer"
              >
                <Download className="h-4.5 w-4.5" />
                <span>Download Database JSON</span>
              </button>
            </div>
          </div>

          {/* Import card */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-xs text-foreground uppercase tracking-wider border-b border-border pb-3 flex items-center"><Upload className="h-4.5 w-4.5 text-gold mr-2" /> Restore Database Backup</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Upload a previously exported **JSON** backup document to restore collections back to Cloud Firestore. 
            </p>
            <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-xl text-xs text-amber-700 dark:text-amber-400 flex items-start space-x-2 leading-relaxed">
              <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <span><strong>CAUTION:</strong> Overwrites fields matching current document keys. Run a backup first to avoid accidental data loss!</span>
            </div>
            
            <div className="pt-2">
              <input
                type="file"
                accept=".json"
                id="json-db-upload"
                onChange={handleImportBackup}
                className="hidden"
              />
              <label
                htmlFor="json-db-upload"
                className="inline-flex items-center justify-center space-x-1.5 px-6 py-3 border border-border bg-card text-muted-foreground hover:text-foreground font-bold rounded-xl text-xs shadow-sm hover:scale-[1.02] transition-all cursor-pointer"
              >
                <Upload className="h-4.5 w-4.5 text-gold" />
                <span>Upload &amp; Restore JSON</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
