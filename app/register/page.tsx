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

  // Reset inputs on initial mount so previously typed or autofilled data does not linger
  useEffect(() => {
    setFullName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setError('');
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
    
    if (!fullName.trim()) {
      setError('Please fill out Full Name.');
      return;
    }

    if (!email.trim()) {
      setError('Please fill out Email Address.');
      return;
    }

    // Validate phone number - exactly 10 digits
    const cleanedPhone = phone.replace(/\D/g, '');
    if (!cleanedPhone) {
      setError('Please fill out Phone Number.');
      return;
    }
    if (cleanedPhone.length !== 10) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }

    if (!area) {
      setError('Please fill out Neighborhood Location.');
      return;
    }

    if (!password) {
      setError('Please fill out Password.');
      return;
    }

    if (!confirmPassword) {
      setError('Please fill out Confirm Password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
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
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-10 z-10 min-h-screen overflow-y-auto">
        <div className="w-full max-w-lg space-y-6 py-8">
          
          {/* Mobile Header */}
          <div className="lg:hidden flex flex-col items-center gap-2 text-center mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
              <HandHeart className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900 font-display">
              Localend<span className="text-blue-600">.</span>
            </span>
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-display">Create Account</h2>
            <p className="text-slate-500 text-sm sm:text-base leading-relaxed">Join the mutual aid community in just under a minute.</p>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm backdrop-blur-xl">
            <form onSubmit={handleRegister} autoComplete="off" className="space-y-4">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-sm font-medium flex items-start gap-2.5 animate-in fade-in">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Account Type / Role Selector */}
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-semibold text-slate-700">Register As</label>
                <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setRole('user')}
                    className={cn(
                      "py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer",
                      role === 'user'
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    👤 Citizen / User
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('employee')}
                    className={cn(
                      "py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer",
                      role === 'employee'
                        ? "bg-white text-indigo-600 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    👷 Service Employee
                  </button>
                </div>
              </div>

              {/* Department Dropdown for Employee */}
              {role === 'employee' && (
                <div className="space-y-1.5 p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl animate-in fade-in">
                  <label className="text-xs sm:text-sm font-semibold text-indigo-900 flex items-center justify-between">
                    <span>Assigned Department</span>
                    <span className="text-xs text-indigo-600 font-normal">Only receive tasks in this category</span>
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full h-11 rounded-xl bg-white border border-indigo-200 text-slate-900 text-sm px-3.5 focus:outline-none focus:border-indigo-600 font-medium cursor-pointer"
                  >
                    {departmentList.map((dept) => (
                      <option key={dept.id || dept.name} value={dept.name || dept.id}>
                        {dept.icon || '🛠️'} {dept.name} Department
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="register-name" className="text-xs sm:text-sm font-semibold text-slate-700">Full Name</label>
                  {fullName && (
                    <button
                      type="button"
                      onClick={() => setFullName('')}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <Input
                  id="register-name"
                  name="fullName"
                  fieldName="Full Name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Mercer"
                  autoComplete="off"
                  showClear
                  className="h-11 rounded-xl bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 text-sm sm:text-base"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label htmlFor="register-email" className="text-xs sm:text-sm font-semibold text-slate-700">Email Address</label>
                    {email && (
                      <button
                        type="button"
                        onClick={() => setEmail('')}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <Input
                    id="register-email"
                    name="email"
                    fieldName="Email Address"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@example.com"
                    autoComplete="off"
                    showClear
                    className="h-11 rounded-xl bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 text-sm sm:text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label htmlFor="register-phone" className="text-xs sm:text-sm font-semibold text-slate-700">Phone</label>
                    <span className="text-xs text-blue-600 font-mono">10 digits</span>
                  </div>
                  <Input
                    id="register-phone"
                    name="phone"
                    fieldName="Phone Number"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    autoComplete="off"
                    showClear
                    className="h-11 rounded-xl bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 text-sm sm:text-base font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-xs sm:text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  Neighborhood Location
                </label>
                <LocationPicker 
                  onLocationSelect={(addr, coords) => {
                    setArea(addr);
                    if (coords) setCoordinates(coords);
                  }} 
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div className="space-y-1.5">
                  <label htmlFor="register-password" className="text-xs sm:text-sm font-semibold text-slate-700">Password</label>
                  <div className="relative">
                    <Input
                      id="register-password"
                      name="password"
                      fieldName="Password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="h-11 rounded-xl bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 text-sm sm:text-base font-mono pr-10"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors cursor-pointer p-1"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="register-confirm-password" className="text-xs sm:text-sm font-semibold text-slate-700">Confirm Password</label>
                  <div className="relative">
                    <Input
                      id="register-confirm-password"
                      name="confirmPassword"
                      fieldName="Confirm Password"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="h-11 rounded-xl bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 text-sm sm:text-base font-mono pr-10"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors cursor-pointer p-1"
                      title={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-11 rounded-xl text-sm sm:text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer mt-3" 
                disabled={loading}
              >
                {loading ? 'Registering...' : 'Complete Registration'}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>
          </div>

          <p className="text-center text-sm text-slate-600">
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
