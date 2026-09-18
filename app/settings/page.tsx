"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db, auth } from '@/lib/firebase/client';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import LocationPicker from '@/components/location/LocationPicker';
import { 
  User, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Save, 
  KeyRound, 
  ShieldCheck,
  FileText
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';

export default function SettingsPage() {
  const { user, profile, refreshProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  // Profile Form States
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [bio, setBio] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password Form States
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Populate profile info once loaded
  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || '');
      setPhone(profile.phone || '');
      setArea(profile.area || '');
      setCoordinates(profile.coordinates || null);
      setBio(profile.bio || '');
    }
  }, [profile]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  // Handle Profile Update
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    if (!fullName.trim()) {
      setProfileError('Full name is required.');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length !== 10) {
      setProfileError('Phone number must be exactly 10 digits.');
      return;
    }

    if (!area.trim()) {
      setProfileError('Neighborhood / location is required.');
      return;
    }

    setProfileLoading(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        fullName: fullName.trim(),
        phone: phone.replace(/\D/g, ''),
        area: area.trim(),
        coordinates: coordinates || null,
        bio: bio.trim(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await refreshProfile();
      setProfileSuccess('Profile details updated successfully!');
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err: any) {
      console.error(err);
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle Instant Password Update (no current password needed)
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!newPassword) {
      setPasswordError('Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        setPasswordSuccess('Password updated successfully!');
        setNewPassword('');
        setConfirmNewPassword('');
        setTimeout(() => setPasswordSuccess(''), 4000);
      } else {
        throw new Error('No authenticated user session found.');
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        setPasswordError('For security, please log out and log in again before changing your password.');
      } else {
        setPasswordError(err.message || 'Failed to update password.');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-300 max-w-3xl mx-auto">
        {/* Page Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Account Settings
          </h1>
          <p className="text-slate-500 mt-0.5 text-xs">
            Manage your personal details, verified phone, neighborhood location, and security.
          </p>
        </div>

        {/* User Status Card */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-base flex items-center justify-center shadow-2xs shrink-0">
              {profile?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 truncate">{profile?.fullName}</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                  {profile?.role?.toUpperCase() || 'USER'}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">{profile?.email}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{profile?.area || 'Location not set'}</p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Verified Member</span>
          </div>
        </div>

        <div className="space-y-5">
          {/* Card 1: Profile Information */}
          <div className="glass-card rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Personal Details</h3>
                <p className="text-[11px] text-slate-500">Update your name, 10-digit phone, and neighborhood.</p>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-3.5">
              {profileSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-2 text-xs font-medium animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {profileError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2 text-xs font-medium animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{profileError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Full Name</label>
                  <Input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="h-9 rounded-xl bg-slate-50/80 border-slate-200 focus:bg-white text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Email (Locked)</label>
                  <Input
                    type="email"
                    disabled
                    value={user.email || ''}
                    className="h-9 rounded-xl bg-slate-100 border-slate-200 text-slate-500 text-xs cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-slate-400" /> Phone Number (10 digits)
                </label>
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="5550000000"
                  className="h-9 rounded-xl bg-slate-50/80 border-slate-200 focus:bg-white text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-slate-400" /> Neighborhood Map Pin
                </label>
                <LocationPicker
                  defaultLocation={area}
                  initialCoordinates={coordinates}
                  onLocationSelect={(addr, coords) => {
                    setArea(addr);
                    if (coords) setCoordinates(coords);
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3 h-3 text-slate-400" /> Bio / About You
                </label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share a short intro about yourself, your skills, or how you like to help neighbors..."
                  className="w-full p-2.5 rounded-xl bg-slate-50/80 border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs text-slate-800 placeholder:text-slate-400 resize-none transition-all"
                />
              </div>

              <div className="pt-1 flex justify-end">
                <Button
                  type="submit"
                  disabled={profileLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-9 px-4 font-semibold shadow-xs gap-1.5 transition-all text-xs cursor-pointer"
                >
                  {profileLoading ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>

          {/* Card 2: Security & Password */}
          <div className="glass-card rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Security & Password</h3>
                <p className="text-[11px] text-slate-500">Update your account password instantly without requiring your old password.</p>
              </div>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-3.5">
              {passwordSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-2 text-xs font-medium animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {passwordError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2 text-xs font-medium animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">New Password</label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-9 rounded-xl bg-slate-50/80 border-slate-200 focus:bg-white text-xs font-mono pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Confirm Password</label>
                  <div className="relative">
                    <Input
                      type={showConfirmNewPassword ? "text" : "password"}
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-9 rounded-xl bg-slate-50/80 border-slate-200 focus:bg-white text-xs font-mono pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showConfirmNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-1 flex justify-end">
                <Button
                  type="submit"
                  disabled={passwordLoading}
                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-9 px-4 font-semibold shadow-xs gap-1.5 transition-all text-xs cursor-pointer"
                >
                  {passwordLoading ? (
                    <span>Updating...</span>
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Update Password</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
