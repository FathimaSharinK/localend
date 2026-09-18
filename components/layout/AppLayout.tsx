"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import { auth, db } from '@/lib/firebase/client';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
  Home, 
  HandHeart, 
  ClipboardList, 
  Bell, 
  LogOut, 
  Menu, 
  Plus, 
  X, 
  Settings as SettingsIcon, 
  ShieldCheck,
  LayoutDashboard,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import NotificationSidebar from '@/components/notifications/NotificationSidebar';

export default function AppLayout({ children }: { children?: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const { openCreateRequest } = useModal();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const isAdmin = profile?.role === 'admin' || user?.email?.toLowerCase() === 'admin@gmail.com';
  const isAdminRoute = pathname.startsWith('/admin');

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (isAdmin && !isAdminRoute) {
        router.replace('/admin');
      } else if (!isAdmin && isAdminRoute) {
        router.replace('/dashboard');
      }
    }
  }, [user, loading, isAdmin, isAdminRoute, router]);

  useEffect(() => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        where('read', '==', false)
      );
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          setUnreadCount(snapshot.size);
        },
        (err) => {
          console.warn('Notifications snapshot error:', err);
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.error('Error setting up notifications listener:', err);
    }
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const regularNavItems = [
    { icon: Home, label: 'Dashboard', to: '/dashboard' },
    { icon: HandHeart, label: 'Discover Help', to: '/discover' },
    { icon: ClipboardList, label: 'My Tasks', to: '/tasks' },
    { icon: SettingsIcon, label: 'Settings', to: '/settings' },
  ];

  const getPageTitle = () => {
    const search = searchParams.toString();
    if (isAdminRoute || isAdmin) {
      if (search.includes('users')) return 'User Modules';
      if (search.includes('settings')) return 'Admin Settings';
      return 'Admin Overview';
    }
    if (pathname.startsWith('/dashboard')) return 'Dashboard';
    if (pathname.startsWith('/discover')) return 'Discover Requests';
    if (pathname.startsWith('/tasks')) return 'My Tasks';
    if (pathname.startsWith('/settings')) return 'Settings';
    return 'Community';
  };

  const SidebarContent = () => {
    if (isAdmin) {
      const currentTab = searchParams.get('tab') || 'overview';
      return (
        <div className="flex flex-col h-full bg-white text-slate-700 border-r border-slate-200/80 select-none">
          {/* Admin Header */}
          <div className="h-14 flex items-center px-4 border-b border-slate-100 bg-slate-50/50">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="ml-2.5 flex items-baseline gap-1.5">
              <span className="text-sm font-bold tracking-tight text-slate-900 font-display">Localend</span>
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Admin</span>
            </div>
          </div>

          {/* Navigation items */}
          <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
            <Link
              href="/admin?tab=overview"
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors font-medium text-xs",
                currentTab === 'overview'
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900"
              )}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/admin?tab=users"
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors font-medium text-xs",
                currentTab === 'users'
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900"
              )}
            >
              <Users className="h-4 w-4 shrink-0" />
              <span>User Modules</span>
            </Link>

            <Link
              href="/admin?tab=settings"
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors font-medium text-xs",
                currentTab === 'settings'
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900"
              )}
            >
              <SettingsIcon className="h-4 w-4 shrink-0" />
              <span>Settings</span>
            </Link>
          </nav>

          {/* Bottom Area */}
          <div className="p-3 border-t border-slate-100">
            <button 
              onClick={handleLogout}
              className="flex items-center w-full gap-2 px-3 py-2 text-xs font-medium text-slate-500 rounded-lg hover:bg-rose-50 hover:text-rose-600 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      );
    }

    // Regular App Sidebar
    return (
      <div className="flex flex-col h-full bg-white text-slate-700 border-r border-slate-200/80 select-none">
        {/* Brand Header */}
        <div className="h-14 flex items-center px-4 border-b border-slate-100 bg-slate-50/50">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <HandHeart className="h-4 w-4" />
          </div>
          <div className="ml-2.5">
            <span className="text-sm font-bold tracking-tight text-slate-900 font-display">Localend</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {regularNavItems.map((item) => {
            const isActive = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                href={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors font-medium text-xs",
                  isActive 
                    ? "bg-blue-50 text-blue-700 font-semibold" 
                    : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900"
                )}
              >
                <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-blue-600" : "text-slate-400")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-slate-100 space-y-1.5">
          <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 border border-slate-100">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              {profile?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-xs font-semibold text-slate-800 truncate">{profile?.fullName || 'Neighbor'}</p>
              <p className="text-[10px] text-slate-400 truncate">{profile?.area || 'Verified'}</p>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="flex items-center w-full gap-2 px-2.5 py-1.5 text-xs font-medium text-slate-500 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row relative">
      
      {/* Desktop Persistent Sidebar - Compact 240px */}
      <aside className="hidden md:flex flex-col w-60 h-screen fixed top-0 left-0 z-40">
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-60 w-full min-h-screen">
        {/* Top Header - Compact 56px */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 sm:px-6 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
          {/* Left section */}
          <div className="flex items-center gap-2.5">
            <button 
              onClick={() => setMobileMenuOpen(true)} 
              className="md:hidden p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            
            {/* Mobile Brand */}
            <div className="flex items-center gap-1.5 md:hidden">
              <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {isAdmin ? <ShieldCheck className="h-3.5 w-3.5" /> : <HandHeart className="h-3.5 w-3.5" />}
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-900 font-display">
                {isAdmin ? 'Admin' : 'Localend'}
              </span>
            </div>

            {/* Desktop Page Title */}
            <div className="hidden md:block">
              <h2 className="text-base font-bold text-slate-900 font-display tracking-tight">
                {getPageTitle()}
              </h2>
            </div>
          </div>

          {/* Right section: Actions + Profile */}
          <div className="flex items-center gap-2">
            {!isAdmin && (
              <Button
                onClick={() => openCreateRequest()}
                size="sm"
                className="hidden sm:inline-flex bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-8 px-3 font-semibold text-xs shadow-xs gap-1.5 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Ask for Help</span>
              </Button>
            )}

            {/* Notification Trigger Button */}
            <button
              onClick={() => setNotificationDrawerOpen(true)}
              className={cn(
                "relative p-2 rounded-lg transition-colors focus:outline-none",
                notificationDrawerOpen
                  ? "bg-blue-50 text-blue-600"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              )}
              title="Open Notifications"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-0.5 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Desktop User Profile Link */}
            <Link 
              href={isAdmin ? "/admin?tab=settings" : "/settings"}
              className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-200 hover:opacity-85 transition-opacity"
              title="Account Settings"
            >
              <div className="h-7 w-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {profile?.fullName?.charAt(0) || (isAdmin ? 'A' : 'U')}
              </div>
              <div className="text-left leading-none hidden lg:block">
                <p className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">
                  {profile?.fullName || (isAdmin ? 'Admin' : 'Neighbor')}
                </p>
              </div>
            </Link>
          </div>
        </header>

        {/* Mobile Navigation Drawer (Sidebar Slide-in) */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex animate-in fade-in duration-150">
            <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative flex-1 w-full max-w-xs flex flex-col bg-white animate-in slide-in-from-left duration-200 shadow-xl">
              <div className="absolute top-3 right-3 z-50">
                <button 
                  onClick={() => setMobileMenuOpen(false)} 
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <SidebarContent />
            </div>
          </div>
        )}

        {/* Notifications Slide-over Sidebar Drawer */}
        <NotificationSidebar
          isOpen={notificationDrawerOpen}
          onClose={() => setNotificationDrawerOpen(false)}
        />

        {/* Main View Area - Proportional Padding */}
        <main className="flex-1 w-full p-4 sm:p-6 lg:p-7 max-w-6xl mx-auto pb-20 md:pb-8">
          {children}
        </main>

        {/* Proportional Mobile Floating Bottom Navigation Dock */}
        <nav className="md:hidden fixed bottom-2.5 inset-x-3 z-40 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg px-2 py-1 flex items-center justify-around">
          {isAdmin ? (
            <>
              <Link
                href="/admin?tab=overview"
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors",
                  (!searchParams.get('tab') || searchParams.get('tab') === 'overview')
                    ? "text-blue-600 font-semibold" 
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="text-[10px]">Dashboard</span>
              </Link>

              <Link
                href="/admin?tab=users"
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors",
                  searchParams.get('tab') === 'users'
                    ? "text-blue-600 font-semibold" 
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                <Users className="w-4 h-4" />
                <span className="text-[10px]">Users</span>
              </Link>

              <Link
                href="/admin?tab=settings"
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors",
                  searchParams.get('tab') === 'settings'
                    ? "text-blue-600 font-semibold" 
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                <SettingsIcon className="w-4 h-4" />
                <span className="text-[10px]">Settings</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/dashboard"
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors",
                  pathname === '/dashboard' 
                    ? "text-blue-600 font-semibold" 
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                <Home className="w-4 h-4" />
                <span className="text-[10px]">Home</span>
              </Link>

              <Link
                href="/discover"
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors",
                  pathname.startsWith('/discover') 
                    ? "text-blue-600 font-semibold" 
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                <HandHeart className="w-4 h-4" />
                <span className="text-[10px]">Discover</span>
              </Link>

              {/* Compact Center Action Button */}
              <button
                onClick={() => openCreateRequest()}
                className="w-9 h-9 -mt-3.5 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30 border-2 border-white hover:bg-blue-700 active:scale-95 transition-all"
                aria-label="Ask for Help"
              >
                <Plus className="w-5 h-5" />
              </button>

              <Link
                href="/tasks"
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors",
                  pathname.startsWith('/tasks') 
                    ? "text-blue-600 font-semibold" 
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                <ClipboardList className="w-4 h-4" />
                <span className="text-[10px]">Tasks</span>
              </Link>

              <Link
                href="/settings"
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors",
                  pathname.startsWith('/settings')
                    ? "text-blue-600 font-semibold" 
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                <SettingsIcon className="w-4 h-4" />
                <span className="text-[10px]">Settings</span>
              </Link>
            </>
          )}
        </nav>
      </div>
    </div>
  );
}
