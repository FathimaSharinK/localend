"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { HandHeart, ArrowRight, ShieldCheck, MapPin, Sparkles } from 'lucide-react';
import LocationPicker from '@/components/location/LocationPicker';

export default function Onboarding() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [coordinates, setCoordinates] = useState<{lat: number, lng: number} | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/login');
      } else if (profile?.onboardingCompleted) {
        router.replace('/dashboard');
      }
    }
  }, [user, profile, authLoading, router]);

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!area) {
      setError('Please select or specify your neighborhood area.');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await setDoc(doc(db, 'users', user.uid), {
        fullName,
        phone: cleanPhone,
        area,
        coordinates,
        onboardingCompleted: true,
        createdAt: new Date().toISOString()
      }, { merge: true });
      
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
      setLoading(false);
    }
  };

  if (authLoading || profile?.onboardingCompleted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-blue-500/8 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-indigo-500/8 rounded-full blur-[80px] pointer-events-none" />

      {/* Left Panel */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden flex-col justify-between p-10 xl:p-12 z-10 border-r border-slate-200/80 bg-white/70 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2.5 font-bold text-xl tracking-tight">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
              <HandHeart className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Localend<span className="text-blue-600">.</span>
            </span>
          </div>

          <div className="mt-16 space-y-4 max-w-md">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-[11px] font-semibold uppercase tracking-wider">
              <Sparkles className="w-3 h-3" /> Identity Initialization
            </div>
            <h1 className="text-3xl xl:text-4xl font-extrabold leading-tight tracking-tight text-slate-900">
              Set up your community profile.
            </h1>
            <p className="text-slate-600 text-xs sm:text-sm font-normal leading-relaxed">
              Define your neighborhood presence so the system can match you with nearby assistance opportunities and coordinate safely.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-xs text-slate-600 bg-slate-100 border border-slate-200 p-3 rounded-xl w-fit">
          <MapPin className="h-4 w-4 text-blue-600" />
          <span>Coordinates help calculate proximity without exposing your home.</span>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-5 sm:p-8 z-10 min-h-screen overflow-y-auto">
        <div className="w-full max-w-md space-y-5 py-6">
          
          <div className="space-y-1 text-center lg:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Profile Setup</h2>
            <p className="text-slate-500 text-xs">Please finalize your contact details and active location.</p>
          </div>

          <div className="bg-white border border-slate-200/85 rounded-2xl p-5 sm:p-6 shadow-xs backdrop-blur-xl">
            <form onSubmit={handleComplete} className="space-y-3.5">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-600 p-3 rounded-xl text-xs font-semibold flex items-start gap-2 animate-in fade-in">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-rose-500 mt-0.2" />
                  <span>{error}</span>
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">Full Name</label>
                <Input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className="h-9 rounded-xl bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 text-xs"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-semibold text-slate-600">Phone Number</label>
                  <span className="text-[10px] text-blue-600 font-mono">10 digits required</span>
                </div>
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  className="h-9 rounded-xl bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 text-xs font-mono"
                />
              </div>

              <div className="space-y-1 pt-0.5">
                <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-blue-600" />
                  Active Neighborhood Location
                </label>
                <LocationPicker 
                  onLocationSelect={(addr, coords) => {
                    setArea(addr);
                    if (coords) setCoordinates(coords);
                  }} 
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-9 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer mt-2" 
                disabled={loading}
              >
                {loading ? 'Initializing Profile...' : 'Enter Neighborhood Hub'}
                {!loading && <ArrowRight className="ml-1.5 h-3.5 w-3.5" />}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
