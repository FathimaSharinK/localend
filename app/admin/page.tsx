"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { db, auth } from '@/lib/firebase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserData, HelpRequest, HelpOffer, HelpTask } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import LocationPicker from '@/components/location/LocationPicker';
import { 
  ShieldCheck, 
  Users, 
  HandHeart, 
  ClipboardList, 
  CheckCircle2, 
  Search, 
  X, 
  Eye, 
  EyeOff, 
  MapPin, 
  Calendar, 
  AlertTriangle, 
  UserCheck, 
  UserX, 
  ArrowUpRight, 
  ArrowDownLeft, 
  KeyRound, 
  Sparkles, 
  Activity, 
  Lock, 
  Mail, 
  Phone, 
  Save, 
  User as UserIcon 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AppLayout from '@/components/layout/AppLayout';

function AdminContent() {
  const { user, profile, refreshProfile, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  // Tab state: 'overview' (Dashboard), 'users' (User Modules), or 'settings' (Admin Settings)
  const tabParam = searchParams.get('tab');
  const activeTab: 'overview' | 'users' | 'settings' = 
    tabParam === 'users' ? 'users' : 
    tabParam === 'settings' ? 'settings' : 'overview';

  const setActiveTab = (tab: 'overview' | 'users' | 'settings') => {
    router.push(`${pathname}?tab=${tab}`);
  };

  // Auth protection for Admin
  const isAdmin = profile?.role === 'admin' || user?.email?.toLowerCase() === 'admin@gmail.com';

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/login');
      } else if (!isAdmin) {
        router.replace('/dashboard');
      }
    }
  }, [user, isAdmin, authLoading, router]);

  // Real-time Collections State
  const [usersList, setUsersList] = useState<UserData[]>([]);
  const [requestsList, setRequestsList] = useState<HelpRequest[]>([]);
  const [offersList, setOffersList] = useState<HelpOffer[]>([]);
  const [tasksList, setTasksList] = useState<HelpTask[]>([]);
  const [, setLoading] = useState(true);

  // Search in User Module
  const [userSearch, setUserSearch] = useState('');

  // Selected User Modal
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Admin Profile & Credentials Settings State
  const [adminFullName, setAdminFullName] = useState(profile?.fullName || 'Platform Admin');
  const [adminPhone, setAdminPhone] = useState(profile?.phone || '5550000000');
  const [adminArea, setAdminArea] = useState(profile?.area || 'Headquarters');
  const [adminCoordinates, setAdminCoordinates] = useState<{ lat: number; lng: number } | null>(profile?.coordinates || null);
  const [profileSaving, setProfileSaving] = useState(false);

  // Credentials State
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [showAdminConfirmPass, setShowAdminConfirmPass] = useState(false);
  const [credSaving, setCredSaving] = useState(false);

  // Sync profile when available
  useEffect(() => {
    if (profile) {
      setAdminFullName(profile.fullName || 'Platform Admin');
      setAdminPhone(profile.phone || '5550000000');
      setAdminArea(profile.area || 'Headquarters');
      setAdminCoordinates(profile.coordinates || null);
    }
  }, [profile]);

  // Real-time snapshot listeners for all collections
  useEffect(() => {
    if (!user || !isAdmin) return;
    setLoading(true);

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const data = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserData));
      setUsersList(data);
    }, (err) => console.warn('Users snapshot error:', err));

    const unsubRequests = onSnapshot(collection(db, 'helpRequests'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpRequest));
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRequestsList(data);
    }, (err) => console.warn('Requests snapshot error:', err));

    const unsubOffers = onSnapshot(collection(db, 'helpOffers'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpOffer));
      setOffersList(data);
    }, (err) => console.warn('Offers snapshot error:', err));

    const unsubTasks = onSnapshot(collection(db, 'helpTasks'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpTask));
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTasksList(data);
      setLoading(false);
    }, (err) => {
      console.warn('Tasks snapshot error:', err);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubRequests();
      unsubOffers();
      unsubTasks();
    };
  }, [user, isAdmin]);

  // Flash action message
  const showMessage = (text: string, type: 'success' | 'error') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Toggle user role (user <-> admin)
  const handleToggleRole = async (targetUser: UserData) => {
    if (targetUser.email === 'admin@gmail.com' && targetUser.role === 'admin') {
      showMessage('Cannot revoke superadmin account privileges.', 'error');
      return;
    }

    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), { role: newRole });
      showMessage(`User role updated to ${newRole.toUpperCase()}.`, 'success');
      if (selectedUser && selectedUser.uid === targetUser.uid) {
        setSelectedUser({ ...selectedUser, role: newRole });
      }
    } catch (err: any) {
      showMessage(err.message || 'Failed to update user role.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Save Admin Profile
  const handleSaveAdminProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!adminFullName.trim()) {
      showMessage('Admin full name is required.', 'error');
      return;
    }

    const cleanPhone = adminPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      showMessage('Admin phone number must be exactly 10 digits.', 'error');
      return;
    }

    if (!adminArea.trim()) {
      showMessage('Admin area/location is required.', 'error');
      return;
    }

    setProfileSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        fullName: adminFullName.trim(),
        phone: cleanPhone,
        area: adminArea.trim(),
        coordinates: adminCoordinates || null,
        updatedAt: new Date().toISOString()
      });
      await refreshProfile();
      showMessage('Admin profile details saved successfully!', 'success');
    } catch (err: any) {
      showMessage(err.message || 'Failed to update admin profile.', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  // Save Admin Credentials (instant password change, no current password required)
  const handleSaveAdminCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!adminNewPassword) {
      showMessage('Please provide a new password.', 'error');
      return;
    }

    if (adminNewPassword.length < 6) {
      showMessage('Password must be at least 6 characters long.', 'error');
      return;
    }

    if (adminNewPassword !== adminConfirmPassword) {
      showMessage('Passwords do not match.', 'error');
      return;
    }

    setCredSaving(true);
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, adminNewPassword);
        showMessage('Admin password credentials updated successfully!', 'success');
        setAdminNewPassword('');
        setAdminConfirmPassword('');
      } else {
        throw new Error('No authenticated user session active.');
      }
    } catch (err: any) {
      showMessage(err.message || 'Failed to update credentials.', 'error');
    } finally {
      setCredSaving(false);
    }
  };

  // Helper counts
  const getUserAddedCount = (uid: string) => requestsList.filter(r => r.requesterId === uid).length;
  const getUserReceivedCount = (uid: string) => tasksList.filter(t => t.helperId === uid).length;

  // Filtered users for User Modules
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return usersList;
    const q = userSearch.toLowerCase();
    return usersList.filter(usr => {
      return (
        (usr.fullName || '').toLowerCase().includes(q) ||
        (usr.email || '').toLowerCase().includes(q) ||
        (usr.phone || '').includes(q) ||
        (usr.area || '').toLowerCase().includes(q)
      );
    });
  }, [usersList, userSearch]);

  // Tasks Added by selected user (requests created by them)
  const selectedUserAddedTasks = useMemo(() => {
    if (!selectedUser) return [];
    return requestsList.filter(r => r.requesterId === selectedUser.uid);
  }, [requestsList, selectedUser]);

  // Tasks Received by selected user (tasks assigned to them as helper)
  const selectedUserReceivedTasks = useMemo(() => {
    if (!selectedUser) return [];
    return tasksList.filter(t => t.helperId === selectedUser.uid);
  }, [tasksList, selectedUser]);

  // Volunteer offers submitted by selected user
  const selectedUserOffers = useMemo(() => {
    if (!selectedUser) return [];
    return offersList.filter(o => o.helperId === selectedUser.uid);
  }, [offersList, selectedUser]);

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-rose-50 text-rose-600 border-rose-200';
      case 'HIGH': return 'bg-amber-50 text-amber-600 border-amber-200';
      default: return 'bg-blue-50 text-blue-600 border-blue-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'OFFER_RECEIVED': return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
      case 'SCHEDULED': return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'IN_PROGRESS': return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
      case 'COMPLETED': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'CANCELLED': return 'bg-slate-100 text-slate-500 border border-slate-200';
      default: return 'bg-slate-100 text-slate-500 border border-slate-200';
    }
  };

  if (authLoading || !user || !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 sm:space-y-7 animate-in fade-in duration-300 pb-16 text-slate-900">
        {/* Action Message Alert */}
        {actionMessage && (
          <div className={cn(
            "fixed top-16 right-5 z-50 p-3 rounded-xl shadow-lg flex items-center gap-2.5 text-xs font-semibold border backdrop-blur-xl transition-all animate-in slide-in-from-top-4",
            actionMessage.type === 'success' 
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 shadow-emerald-900/10"
              : "bg-rose-50 text-rose-800 border-rose-200 shadow-rose-900/10"
          )}>
            {actionMessage.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* Admin Header */}
        <div className="border-b border-slate-200/80 pb-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1 uppercase tracking-wider">
              <ShieldCheck className="w-3 h-3" />
              Admin Command Console
            </span>
            <span className="text-[11px] text-slate-400 font-mono">v3.0 Clean</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {activeTab === 'users' ? 'User Management Node' : activeTab === 'settings' ? 'Admin Profile & Credentials' : 'Network Telemetry & Operations'}
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            {activeTab === 'users' 
              ? 'Inspect community accounts, audit tasks added, and monitor fulfillment tasks received.' 
              : activeTab === 'settings'
              ? 'Manage administrator profile details, contact information, and account security credentials.'
              : 'Real-time telemetry of hyperlocal tasks, volunteer engagement, and mutual aid velocity.'}
          </p>
        </div>

        {/* MODULE 1: DASHBOARD */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <Card className="border border-slate-200/85 rounded-2xl bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Registered Citizens</span>
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">{usersList.length}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Verified community members</p>
              </Card>

              <Card className="border border-slate-200/85 rounded-2xl bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Broadcast Requests</span>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <HandHeart className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">{requestsList.length}</p>
                <p className="text-[11px] text-indigo-600 font-medium mt-0.5">
                  {requestsList.filter(r => r.status === 'OPEN').length} active in pool
                </p>
              </Card>

              <Card className="border border-slate-200/85 rounded-2xl bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assistance Offers</span>
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <ClipboardList className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">{offersList.length}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Volunteer offers submitted</p>
              </Card>

              <Card className="border border-slate-200/85 rounded-2xl bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fulfillments</span>
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">
                  {tasksList.filter(t => t.status === 'COMPLETED').length}
                </p>
                <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                  {tasksList.filter(t => t.status === 'SCHEDULED' || t.status === 'IN_PROGRESS').length} in active motion
                </p>
              </Card>
            </div>

            {/* Quick Shortcuts & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 border border-slate-200/85 rounded-2xl bg-white p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3.5">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-blue-600" />
                      Real-time Activity Stream
                    </h3>
                    <p className="text-[11px] text-slate-400">Latest broadcasts transmitted across the network</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('users')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                  >
                    Inspect Users &rarr;
                  </button>
                </div>

                <div className="space-y-2">
                  {requestsList.slice(0, 5).map(req => (
                    <div key={req.id} className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center justify-between hover:border-slate-200 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                          {req.requesterName?.charAt(0) || 'R'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">{req.title}</p>
                          <p className="text-[10px] text-slate-400 truncate">by {req.requesterName} • {req.location}</p>
                        </div>
                      </div>
                      <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ml-2", getStatusBadge(req.status))}>
                        {req.status}
                      </span>
                    </div>
                  ))}
                  {requestsList.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-6">No help requests recorded yet.</p>
                  )}
                </div>
              </div>

              {/* Quick Status Box */}
              <div className="border border-slate-200/85 rounded-2xl bg-white p-4 sm:p-5 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  Network Metrics
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <span className="text-slate-600">Open Requests</span>
                    <span className="font-bold text-blue-600 font-mono">
                      {requestsList.filter(r => r.status === 'OPEN').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <span className="text-slate-600">Active Tasks</span>
                    <span className="font-bold text-amber-600 font-mono">
                      {tasksList.filter(t => t.status === 'SCHEDULED' || t.status === 'IN_PROGRESS').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <span className="text-slate-600">Completed Favors</span>
                    <span className="font-bold text-emerald-600 font-mono">
                      {tasksList.filter(t => t.status === 'COMPLETED').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <span className="text-slate-600">Admin Nodes</span>
                    <span className="font-bold text-purple-600 font-mono">
                      {usersList.filter(u => u.role === 'admin').length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODULE 2: USER MODULES */}
        {activeTab === 'users' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Search bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Search name, email, phone, location..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9 h-9 rounded-xl bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 text-xs shadow-2xs"
                />
              </div>
              <p className="text-[11px] text-slate-400 self-end sm:self-auto font-mono">
                Filtered {filteredUsers.length} of {usersList.length} members
              </p>
            </div>

            {/* Users Table */}
            <div className="border border-slate-200/85 rounded-2xl bg-white shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Citizen</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4">Area</th>
                      <th className="py-3 px-4">Clearance</th>
                      <th className="py-3 px-4 text-center">Tasks Added</th>
                      <th className="py-3 px-4 text-center">Tasks Received</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-slate-400 font-medium">
                          No community members matching filter query.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map(usr => {
                        const addedCount = getUserAddedCount(usr.uid);
                        const receivedCount = getUserReceivedCount(usr.uid);
                        return (
                          <tr key={usr.uid} className="hover:bg-slate-50/60 transition-colors">
                            {/* User Avatar & Name */}
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-[10px] shadow-2xs shrink-0">
                                  {usr.fullName?.charAt(0) || 'U'}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 truncate">{usr.fullName}</p>
                                  <p className="text-slate-400 text-[10px] truncate max-w-[140px]">{usr.email}</p>
                                </div>
                              </div>
                            </td>

                            {/* Phone */}
                            <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px]">
                              {usr.phone || <span className="text-slate-300 italic">Unset</span>}
                            </td>

                            {/* Area */}
                            <td className="py-2.5 px-4 text-slate-600 max-w-[130px] truncate text-[11px]">
                              {usr.area || <span className="text-slate-300 italic">Not set</span>}
                            </td>

                            {/* Role */}
                            <td className="py-2.5 px-4">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1",
                                usr.role === 'admin'
                                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                                  : "bg-slate-100 text-slate-600 border border-slate-200"
                              )}>
                                {usr.role === 'admin' ? <ShieldCheck className="w-2.5 h-2.5" /> : null}
                                {usr.role?.toUpperCase() || 'USER'}
                              </span>
                            </td>

                            {/* Tasks Added Count */}
                            <td className="py-2.5 px-4 text-center">
                              <span className={cn(
                                "px-2 py-0.5 rounded-md text-[10px] font-semibold inline-flex items-center gap-1",
                                addedCount > 0 
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-slate-100 text-slate-400"
                              )}>
                                {addedCount}
                              </span>
                            </td>

                            {/* Tasks Received Count */}
                            <td className="py-2.5 px-4 text-center">
                              <span className={cn(
                                "px-2 py-0.5 rounded-md text-[10px] font-semibold inline-flex items-center gap-1",
                                receivedCount > 0 
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-slate-100 text-slate-400"
                              )}>
                                {receivedCount}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-2.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedUser(usr)}
                                  className="h-7 px-2.5 text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-50 rounded-lg cursor-pointer"
                                >
                                  <Eye className="w-3 h-3 mr-1" /> View Tasks
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleRole(usr)}
                                  disabled={actionLoading}
                                  className={cn(
                                    "h-7 px-1.5 text-xs font-semibold rounded-lg cursor-pointer",
                                    usr.role === 'admin'
                                      ? "text-rose-600 hover:bg-rose-50"
                                      : "text-purple-600 hover:bg-purple-50"
                                  )}
                                  title={usr.role === 'admin' ? 'Demote to User' : 'Grant Admin Privileges'}
                                >
                                  {usr.role === 'admin' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODULE 3: ADMIN SETTINGS (PROFILE & CREDENTIALS) */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl">
            {/* Admin Identity Status Banner */}
            <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-white border border-slate-200/85 shadow-xs">
              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                    {adminFullName.charAt(0) || 'A'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 tracking-tight">{adminFullName}</h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                        Master Administrator
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                      <Mail className="w-3 h-3 text-blue-600" />
                      <span>{user?.email || 'admin@gmail.com'}</span>
                      <span>•</span>
                      <Phone className="w-3 h-3 text-emerald-600" />
                      <span className="font-mono">{adminPhone || '5550000000'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Superadmin Authority</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Admin Profile Form */}
              <div className="bg-white border border-slate-200/85 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                      <UserIcon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Administrator Profile</h3>
                      <p className="text-[11px] text-slate-500">Update operational name, contact, and jurisdiction</p>
                    </div>
                  </div>

                  <form id="admin-profile-form" onSubmit={handleSaveAdminProfile} className="space-y-3 mt-3.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Display Name</label>
                      <Input
                        type="text"
                        required
                        value={adminFullName}
                        onChange={(e) => setAdminFullName(e.target.value)}
                        placeholder="Platform Admin"
                        className="h-9 rounded-xl bg-slate-50 border-slate-200 text-slate-900 text-xs focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-semibold text-slate-600">Phone Contact</label>
                        <span className="text-[10px] text-blue-600 font-mono">10 digits</span>
                      </div>
                      <Input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        required
                        value={adminPhone}
                        onChange={(e) => setAdminPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="5550000000"
                        className="h-9 rounded-xl bg-slate-50 border-slate-200 text-slate-900 text-xs font-mono focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1 pt-0.5">
                      <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-blue-600" />
                        Station Area / Jurisdiction
                      </label>
                      <LocationPicker 
                        defaultLocation={adminArea}
                        onLocationSelect={(addr, coords) => {
                          setAdminArea(addr);
                          if (coords) setAdminCoordinates(coords);
                        }} 
                      />
                    </div>
                  </form>
                </div>

                <div className="pt-3.5 mt-3 border-t border-slate-100">
                  <Button
                    type="submit"
                    form="admin-profile-form"
                    disabled={profileSaving}
                    className="w-full h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {profileSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                  </Button>
                </div>
              </div>

              {/* Admin Credentials Form */}
              <div className="bg-white border border-slate-200/85 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Security Credentials</h3>
                      <p className="text-[11px] text-slate-500">Update administrative password directly</p>
                    </div>
                  </div>

                  <form id="admin-cred-form" onSubmit={handleSaveAdminCredentials} className="space-y-3 mt-3.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Account Email</label>
                      <Input
                        type="email"
                        disabled
                        value={user?.email || 'admin@gmail.com'}
                        className="h-9 rounded-xl bg-slate-100 border-slate-200 text-slate-500 text-xs cursor-not-allowed"
                      />
                      <span className="text-[10px] text-slate-400">Root administration address is permanent.</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">New Password</label>
                      <div className="relative">
                        <Input
                          type={showAdminPass ? "text" : "password"}
                          required
                          value={adminNewPassword}
                          onChange={(e) => setAdminNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="h-9 rounded-xl bg-slate-50 border-slate-200 text-slate-900 text-xs font-mono pr-9 focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPass(!showAdminPass)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showAdminPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Confirm New Password</label>
                      <div className="relative">
                        <Input
                          type={showAdminConfirmPass ? "text" : "password"}
                          required
                          value={adminConfirmPassword}
                          onChange={(e) => setAdminConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="h-9 rounded-xl bg-slate-50 border-slate-200 text-slate-900 text-xs font-mono pr-9 focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminConfirmPass(!showAdminConfirmPass)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showAdminConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

                <div className="pt-3.5 mt-3 border-t border-slate-100">
                  <Button
                    type="submit"
                    form="admin-cred-form"
                    disabled={credSaving}
                    className="w-full h-9 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                    {credSaving ? 'Updating Credentials...' : 'Update Password'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* USER DETAIL MODAL: SHOWS TASKS ADDED & TASKS RECEIVED */}
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-xl w-full max-h-[88vh] overflow-y-auto shadow-xl border border-slate-200 p-5 space-y-4 text-slate-900 custom-scrollbar">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-base flex items-center justify-center shadow-xs shrink-0">
                    {selectedUser.fullName?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-base font-bold text-slate-900">{selectedUser.fullName}</h3>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                        selectedUser.role === 'admin' ? "bg-purple-50 text-purple-700 border border-purple-200" : "bg-slate-100 text-slate-600"
                      )}>
                        {selectedUser.role?.toUpperCase() || 'USER'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">{selectedUser.email} • {selectedUser.phone || 'No phone'}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedUser(null)} className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Profile Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 text-[10px] font-medium block">Area / Location:</span>
                  <p className="font-semibold text-slate-800 text-xs mt-0.5 truncate">{selectedUser.area || 'Not specified'}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] font-medium block">Joined Date:</span>
                  <p className="font-semibold text-slate-800 text-xs mt-0.5">
                    {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] font-medium block">Onboarding:</span>
                  <p className="font-semibold text-emerald-600 text-xs mt-0.5">{selectedUser.onboardingCompleted ? 'Completed' : 'Pending'}</p>
                </div>
              </div>

              {/* SECTION 1: TASKS ADDED BY USER */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                    Tasks Added by Citizen ({selectedUserAddedTasks.length})
                  </h4>
                  <span className="text-[10px] text-slate-400">Created help broadcasts</span>
                </div>

                {selectedUserAddedTasks.length === 0 ? (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                    <p className="text-xs text-slate-400 italic">No broadcasts created by this user yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {selectedUserAddedTasks.map(task => {
                      const assignedTask = tasksList.find(t => t.requestId === task.id);
                      const acceptedOffer = offersList.find(o => o.requestId === task.id && o.status === 'ACCEPTED');
                      const helperUser = usersList.find(u => u.uid === task.selectedHelperId || u.uid === assignedTask?.helperId || u.uid === acceptedOffer?.helperId);
                      const helperName = task.selectedHelperName || assignedTask?.helperName || acceptedOffer?.helperName || helperUser?.fullName;

                      return (
                        <div key={task.id} className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900 text-xs truncate max-w-[240px]">{task.title}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className={cn("px-1.5 py-0.5 rounded-md text-[9px] font-semibold border", getPriorityBadge(task.priority))}>
                                {task.priority}
                              </span>
                              <span className={cn("px-1.5 py-0.5 rounded-md text-[9px] font-semibold", getStatusBadge(task.status))}>
                                {task.status}
                              </span>
                            </div>
                          </div>
                          <p className="text-slate-600 text-[11px] line-clamp-2">{task.description}</p>
                          
                          {/* Assigned Helper Name in Admin Portal */}
                          {helperName ? (
                            <div className="flex items-center gap-1.5 p-1.5 bg-blue-50/80 rounded-lg border border-blue-100 text-xs">
                              <div className="w-4 h-4 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[9px] shrink-0">
                                {helperName.charAt(0)}
                              </div>
                              <span className="text-slate-500 font-medium text-[10px]">Assigned Volunteer:</span>
                              <strong className="text-blue-900 font-semibold text-[11px]">{helperName}</strong>
                            </div>
                          ) : null}

                          <div className="flex items-center gap-3 text-slate-400 text-[10px] pt-1 border-t border-slate-200/80">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5" /> {task.date} {task.startTime}
                            </span>
                            <span className="inline-flex items-center gap-1 truncate max-w-[150px]">
                              <MapPin className="w-2.5 h-2.5" /> {task.location}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION 2: TASKS RECEIVED BY USER */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                    Tasks Received / Volunteered ({selectedUserReceivedTasks.length + selectedUserOffers.length})
                  </h4>
                  <span className="text-[10px] text-slate-400">Assigned missions & volunteer offers</span>
                </div>

                {selectedUserReceivedTasks.length === 0 && selectedUserOffers.length === 0 ? (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                    <p className="text-xs text-slate-400 italic">No tasks assigned or volunteered by this user yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {/* Assigned Tasks */}
                    {selectedUserReceivedTasks.map(task => {
                      const relatedRequest = requestsList.find(r => r.id === task.requestId);
                      const requesterUser = usersList.find(u => u.uid === task.requesterId);
                      const requesterName = task.requesterName || relatedRequest?.requesterName || requesterUser?.fullName || 'Requester';

                      return (
                        <div key={task.id} className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900 text-xs truncate max-w-[240px]">{task.title}</span>
                            <span className={cn("px-1.5 py-0.5 rounded-md text-[9px] font-semibold", getStatusBadge(task.status))}>
                              {task.status}
                            </span>
                          </div>

                          {/* Requester Name in Admin Portal */}
                          <div className="flex items-center gap-1.5 p-1.5 bg-white rounded-lg border border-emerald-200 text-xs">
                            <div className="w-4 h-4 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[9px] shrink-0">
                              {requesterName.charAt(0)}
                            </div>
                            <span className="text-slate-500 font-medium text-[10px]">Requested by:</span>
                            <strong className="text-emerald-900 font-semibold text-[11px]">{requesterName}</strong>
                          </div>

                          <div className="flex items-center gap-3 text-slate-600 text-[10px]">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5 text-emerald-600" /> {task.scheduledDate} {task.scheduledTime}
                            </span>
                            <span className="inline-flex items-center gap-1 truncate max-w-[150px]">
                              <MapPin className="w-2.5 h-2.5 text-emerald-600" /> {task.location}
                            </span>
                            {task.completionCode && (
                              <span className="inline-flex items-center gap-1 font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded-md">
                                <KeyRound className="w-2.5 h-2.5" /> Token: {task.completionCode}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Offers Submitted */}
                    {selectedUserOffers.map(offer => {
                      const targetRequest = requestsList.find(r => r.id === offer.requestId);

                      return (
                        <div key={offer.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                          <div className="min-w-0 pr-2">
                            <span className="text-[9px] text-slate-400 block uppercase font-bold">
                              Offer for: {targetRequest?.title || 'Help Request'} {targetRequest?.requesterName ? `(by ${targetRequest.requesterName})` : ''}
                            </span>
                            <p className="font-medium text-slate-700 italic truncate text-[11px]">"{offer.message}"</p>
                          </div>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded-md text-[9px] font-semibold shrink-0",
                            offer.status === 'ACCEPTED' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                            offer.status === 'REJECTED' ? "bg-rose-50 text-rose-700 border border-rose-200" :
                            "bg-amber-50 text-amber-700 border border-amber-200"
                          )}>
                            {offer.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => handleToggleRole(selectedUser)}
                  disabled={actionLoading}
                  className="h-8 text-xs font-semibold text-purple-700 border-purple-200 hover:bg-purple-50 rounded-lg cursor-pointer"
                >
                  {selectedUser.role === 'admin' ? 'Revoke Admin Privileges' : 'Grant Admin Clearance'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedUser(null)}
                  className="h-8 text-xs font-semibold text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    }>
      <AdminContent />
    </Suspense>
  );
}
