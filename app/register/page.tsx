"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { HandHeart, ArrowRight, ShieldCheck, CheckCircle2, Eye, EyeOff, Sparkles, MapPin } from 'lucide-react';
import LocationPicker from '@/components/location/LocationPicker';
import { cn } from '@/lib/utils';
import { UserRole, Department, DepartmentItem } from '@/types';
import { subscribeDepartments, DEFAULT_DEPARTMENTS } from '@/services/departments.service';

export default function Register() {
  const [role, setRole] = useState<UserRole>('user');
  const [department, setDepartment] = useState<string>('Plumbing');
  const [departmentList, setDepartmentList] = useState<DepartmentItem[]>(DEFAULT_DEPARTMENTS);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [coordinates, setCoordinates] = useState<{lat: number, lng: number} | null>(null);

  // Subscribe to real-time departments from Firestore so all admin-created departments appear
  useEffect(() => {
    const unsub = subscribeDepartments((depts) => {
      if (depts && depts.length > 0) {
        setDepartmentList(depts);
        setDepartment(prev => {
          if (depts.some(d => d.name === prev || d.id === prev)) return prev;
          return depts[0].name || depts[0].id || 'Plumbing';
        });
      }
    });
    return () => unsub();
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Validate phone number - exactly 10 digits
    const cleanedPhone = phone.replace(/\D/g, '');
    if (cleanedPhone.length !== 10) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }

    if (!area) {
      setError('Please select or confirm your neighborhood location.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        fullName,
        phone: cleanedPhone,
        area,
        coordinates,
        role,
        department: role === 'employee' ? department : null,
        status: 'active',
        onboardingCompleted: true,
        createdAt: new Date().toISOString()
      }, { merge: true });

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-blue-500/8 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-indigo-500/8 rounded-full blur-[80px] pointer-events-none" />

      {/* Left Panel - Brand Showcase */}
      <div className="hidden lg:flex w-5/12 relative overflow-hidden flex-col justify-between p-10 xl:p-12 z-10 border-r border-slate-200/80 bg-white/70 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2.5 font-bold text-xl tracking-tight">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
              <HandHeart className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Localend<span className="text-blue-600">.</span>
            </span>
          </div>

          <div className="mt-14 space-y-4 max-w-sm">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-[11px] font-semibold uppercase tracking-wider">
              <Sparkles className="w-3 h-3" /> Direct Community Mesh
            </div>
            <h1 className="text-3xl xl:text-4xl font-extrabold leading-tight tracking-tight text-slate-900">
              Join your neighborhood network.
            </h1>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              Create an account to discover requests within walking distance, volunteer support, and request help safely with 4-digit token verification.
            </p>

            <div className="pt-3 space-y-2.5">
              {[
                'Strict 10-digit verified community contact',
                'Hyperlocal distance-based request routing',
                'Zero fees, 100% neighbor-driven support'
              ].map((text, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl w-fit">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span>Privacy guaranteed: exact address is never public</span>
        </div>
      </div>

      {/* Right Panel - Form Container */}
      <div className="flex-1 flex flex-col justify-center items-center p-5 sm:p-8 z-10 min-h-screen overflow-y-auto">
        <div className="w-full max-w-md space-y-5 py-6">
          
          {/* Mobile Header */}
          <div className="lg:hidden flex flex-col items-center gap-2 text-center mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
              <HandHeart className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Localend<span className="text-blue-600">.</span>
            </span>
          </div>

          <div className="space-y-1 text-center lg:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Create Account</h2>
            <p className="text-slate-500 text-xs">Join the mutual aid community in just under a minute.</p>
          </div>

          <div className="bg-white border border-slate-200/85 rounded-2xl p-5 sm:p-6 shadow-xs backdrop-blur-xl">
            <form onSubmit={handleRegister} className="space-y-3.5">
              {/* Account Type / Role Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600">Register As</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setRole('user')}
                    className={cn(
                      "py-1.5 text-xs font-semibold rounded-lg transition-all",
                      role === 'user'
                        ? "bg-white text-blue-600 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    👤 Citizen / User
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('employee')}
                    className={cn(
                      "py-1.5 text-xs font-semibold rounded-lg transition-all",
                      role === 'employee'
                        ? "bg-white text-indigo-600 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    👷 Service Employee
                  </button>
                </div>
              </div>

              {/* Department Dropdown for Employee */}
              {role === 'employee' && (
                <div className="space-y-1 p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl animate-in fade-in">
                  <label className="text-[11px] font-semibold text-indigo-900 flex items-center justify-between">
                    <span>Assigned Department</span>
                    <span className="text-[10px] text-indigo-600">Only receive tasks in this category</span>
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full h-9 rounded-xl bg-white border border-indigo-200 text-slate-900 text-xs px-3 focus:outline-none focus:border-indigo-600 font-medium"
                  >
                    {departmentList.map((dept) => (
                      <option key={dept.id || dept.name} value={dept.name || dept.id}>
                        {dept.icon || '🛠️'} {dept.name} Department
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">Full Name</label>
                <Input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Mercer"
                  className="h-9 rounded-xl bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Email Address</label>
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@example.com"
                    className="h-9 rounded-xl bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-semibold text-slate-600">Phone</label>
                    <span className="text-[10px] text-blue-600 font-mono">10 digits</span>
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
              </div>

              <div className="space-y-1 pt-0.5">
                <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-blue-600" />
                  Neighborhood Location
                </label>
                <LocationPicker 
                  onLocationSelect={(addr, coords) => {
                    setArea(addr);
                    if (coords) setCoordinates(coords);
                  }} 
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-9 rounded-xl bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 text-xs font-mono pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Confirm Password</label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-9 rounded-xl bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 text-xs font-mono pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-9 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer mt-2" 
                disabled={loading}
              >
                {loading ? 'Registering...' : 'Complete Registration'}
                {!loading && <ArrowRight className="ml-1.5 h-3.5 w-3.5" />}
              </Button>
            </form>
          </div>

          <p className="text-center text-xs text-slate-600">
            Already registered?{' '}
            <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
              Access account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
