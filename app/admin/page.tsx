"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc,
  deleteDoc,
  addDoc,
  setDoc
} from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { db, auth, createAccountByAdmin } from '@/lib/firebase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserData, HelpRequest, HelpOffer, HelpTask, Department, UserRole, UserStatus, HelpPriority, HelpStatus } from '@/types';
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
  User as UserIcon,
  Clock,
  UserPlus,
  Trash2,
  Send,
  AlertCircle,
  Pencil,
  Plus,
  Briefcase,
  Layers,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AppLayout from '@/components/layout/AppLayout';
import { directDispatchByAdmin } from '@/services/tasks.service';
import { deleteHelpRequest } from '@/services/requests.service';
import { getMinutesUntilDeadline, evaluateAndEscalateRequest } from '@/lib/slaEscalation';
import { getGoogleMapsUrl, getRequestDistance, formatDistance } from '@/lib/distance';
import { REQUEST_CATEGORIES } from '@/data/categories';
import { sortByLatestScheduled } from '@/lib/sortUtils';
import { 
  subscribeDepartments, 
  createDepartment, 
  updateDepartment, 
  deleteDepartment, 
  DEFAULT_DEPARTMENTS,
  getAutoIconForDepartment,
  COMMON_DEPARTMENT_ICONS
} from '@/services/departments.service';
import { DepartmentItem } from '@/types';

type AdminTab = 'overview' | 'employees' | 'users' | 'departments' | 'tasks' | 'settings';

function AdminContent() {
  const { user, profile, refreshProfile, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const tabParam = searchParams.get('tab') as AdminTab;
  const activeTab: AdminTab = 
    tabParam === 'employees' ? 'employees' :
    tabParam === 'users' ? 'users' :
    tabParam === 'departments' ? 'departments' :
    tabParam === 'tasks' ? 'tasks' :
    tabParam === 'settings' ? 'settings' : 'overview';

  const setActiveTab = (tab: AdminTab) => {
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
  const [departmentsList, setDepartmentsList] = useState<DepartmentItem[]>(DEFAULT_DEPARTMENTS);
  const [, setLoading] = useState(true);

  // Search & Filter States
  const [userSearch, setUserSearch] = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const [deptSearch, setDeptSearch] = useState('');
  const [empDeptFilter, setEmpDeptFilter] = useState<string>('All');
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>('All');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('All');

  // Action / Feedback
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Dispatch Modal State
  const [dispatchModalReq, setDispatchModalReq] = useState<HelpRequest | null>(null);
  const [targetEmployeeUid, setTargetEmployeeUid] = useState<string>('');
  const [dispatchOnlyCategory, setDispatchOnlyCategory] = useState(true);
  const [isDispatching, setIsDispatching] = useState(false);

  // Add Employee Modal State
  const [addEmpModalOpen, setAddEmpModalOpen] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpPhone, setNewEmpPhone] = useState('');
  const [newEmpDept, setNewEmpDept] = useState<string>('Plumbing');
  const [newEmpPassword, setNewEmpPassword] = useState('');
  const [isSavingEmp, setIsSavingEmp] = useState(false);

  // Edit Employee Modal State
  const [editingEmployee, setEditingEmployee] = useState<UserData | null>(null);
  const [editEmpName, setEditEmpName] = useState('');
  const [editEmpPhone, setEditEmpPhone] = useState('');
  const [editEmpDept, setEditEmpDept] = useState<string>('Plumbing');
  const [isUpdatingEmp, setIsUpdatingEmp] = useState(false);

  // Add Citizen User Modal State
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Edit Citizen User Modal State
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  // Add Department Modal State
  const [addDeptModalOpen, setAddDeptModalOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptDesc, setNewDeptDesc] = useState('');
  const [newDeptIcon, setNewDeptIcon] = useState('🛠️');
  const [newDeptColor, setNewDeptColor] = useState('blue');
  const [newDeptSlaHours, setNewDeptSlaHours] = useState(3);
  const [isSavingDept, setIsSavingDept] = useState(false);

  // Edit Department Modal State
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null);
  const [viewingDept, setViewingDept] = useState<DepartmentItem | null>(null);
  const [editDeptName, setEditDeptName] = useState('');
  const [editDeptDesc, setEditDeptDesc] = useState('');
  const [editDeptIcon, setEditDeptIcon] = useState('🛠️');
  const [editDeptColor, setEditDeptColor] = useState('blue');
  const [editDeptSlaHours, setEditDeptSlaHours] = useState(3);
  const [isUpdatingDept, setIsUpdatingDept] = useState(false);

  // Add Task Modal State (Admin Task Management)
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskCategory, setTaskCategory] = useState<string>('Plumbing');
  const [taskPriority, setTaskPriority] = useState<HelpPriority>('NORMAL');
  const [taskDate, setTaskDate] = useState('');
  const [taskTime, setTaskTime] = useState('');
  const [taskLocation, setTaskLocation] = useState('');
  const [taskCoordinates, setTaskCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [taskRequesterId, setTaskRequesterId] = useState('admin');
  const [isSavingTask, setIsSavingTask] = useState(false);

  // Edit Task Modal State
  const [editingTask, setEditingTask] = useState<HelpRequest | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDesc, setEditTaskDesc] = useState('');
  const [editTaskCategory, setEditTaskCategory] = useState<string>('Plumbing');
  const [editTaskPriority, setEditTaskPriority] = useState<HelpPriority>('NORMAL');
  const [editTaskDate, setEditTaskDate] = useState('');
  const [editTaskTime, setEditTaskTime] = useState('');
  const [editTaskLocation, setEditTaskLocation] = useState('');
  const [editTaskCoordinates, setEditTaskCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [editTaskStatus, setEditTaskStatus] = useState<HelpStatus>('OPEN');
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);

  // View Task Modal State
  const [viewingTask, setViewingTask] = useState<HelpRequest | null>(null);

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

  // Manual SLA Check Trigger State
  const [isCheckingSla, setIsCheckingSla] = useState(false);

  const handleManualSlaCheck = async () => {
    setIsCheckingSla(true);
    try {
      const res = await fetch('/api/cron/check-sla', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (data.escalatedCount > 0) {
          showMessage(`🚨 Escalated ${data.escalatedCount} task(s)! Emergency alert email dispatched.`, 'success');
        } else {
          showMessage(`✅ Checked ${data.checkedCount} open tasks. All are within normal SLA limits.`, 'success');
        }
      } else {
        showMessage(data.error || 'Failed to complete SLA check.', 'error');
      }
    } catch (err: any) {
      showMessage('Network error during SLA evaluation.', 'error');
    } finally {
      setIsCheckingSla(false);
    }
  };

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
      setRequestsList(sortByLatestScheduled(data));
      // Auto-escalate any open requests approaching deadline (<= 50 mins or URGENT)
      data.forEach(req => {
        if (req.status === 'OPEN' && !req.isEscalated) {
          evaluateAndEscalateRequest(req, user.uid);
        }
      });
    }, (err) => console.warn('Requests snapshot error:', err));

    const unsubOffers = onSnapshot(collection(db, 'helpOffers'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpOffer));
      setOffersList(data);
    }, (err) => console.warn('Offers snapshot error:', err));

    const unsubTasks = onSnapshot(collection(db, 'helpTasks'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpTask));
      setTasksList(sortByLatestScheduled(data));
      setLoading(false);
    }, (err) => {
      console.warn('Tasks snapshot error:', err);
      setLoading(false);
    });

    const unsubDepts = subscribeDepartments((depts) => {
      setDepartmentsList(depts);
    });

    return () => {
      unsubUsers();
      unsubRequests();
      unsubOffers();
      unsubTasks();
      unsubDepts();
    };
  }, [user, isAdmin]);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Filtered lists
  const employeesList = useMemo(() => {
    return usersList.filter(u => u.role === 'employee');
  }, [usersList]);

  const filteredEmployees = useMemo(() => {
    let list = employeesList;
    if (empDeptFilter !== 'All') {
      list = list.filter(e => e.department === empDeptFilter);
    }
    if (empSearch.trim()) {
      const q = empSearch.toLowerCase();
      list = list.filter(e => 
        (e.fullName || '').toLowerCase().includes(q) ||
        (e.email || '').toLowerCase().includes(q) ||
        (e.phone || '').includes(q) ||
        (e.department || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [employeesList, empDeptFilter, empSearch]);

  const citizensList = useMemo(() => {
    return usersList.filter(u => u.role !== 'admin' && u.role !== 'employee');
  }, [usersList]);

  const filteredCitizens = useMemo(() => {
    if (!userSearch.trim()) return citizensList;
    const q = userSearch.toLowerCase();
    return citizensList.filter(usr => 
      (usr.fullName || '').toLowerCase().includes(q) ||
      (usr.email || '').toLowerCase().includes(q) ||
      (usr.phone || '').includes(q) ||
      (usr.area || '').toLowerCase().includes(q)
    );
  }, [citizensList, userSearch]);

  // SLA Escalated / Urgent Unassigned Requests
  const escalatedRequests = useMemo(() => {
    return requestsList.filter(req => {
      if (req.status !== 'OPEN') return false;
      if (req.isEscalated) return true;
      const mins = getMinutesUntilDeadline(req.date, req.startTime);
      return mins !== null && mins <= 120;
    });
  }, [requestsList]);

  // Dynamic available categories combining departments and standard categories
  const availableCategories = useMemo(() => {
    const fromDepts = departmentsList.map(d => d.name);
    return Array.from(new Set([...fromDepts, ...REQUEST_CATEGORIES]));
  }, [departmentsList]);

  // Filtered Master Tasks
  const filteredMasterTasks = useMemo(() => {
    let list = requestsList;
    if (taskCategoryFilter !== 'All') {
      list = list.filter(r => r.categoryId === taskCategoryFilter);
    }
    if (taskStatusFilter !== 'All') {
      list = list.filter(r => r.status === taskStatusFilter);
    }
    return sortByLatestScheduled(list);
  }, [requestsList, taskCategoryFilter, taskStatusFilter]);

  // Dispatch Modal: Filtered specialists based on task department
  // Dispatch Modal: Filtered strictly to task department & sorted by location proximity
  const rankedDepartmentSpecialists = useMemo(() => {
    if (!dispatchModalReq) return [];

    const deptMatches = employeesList.filter(emp => {
      if (emp.status === 'inactive') return false;
      return (emp.department || '').trim().toLowerCase() === (dispatchModalReq.categoryId || '').trim().toLowerCase();
    });

    const reqLocationText = (dispatchModalReq.location || '').toLowerCase();
    const reqTokens = reqLocationText.split(/[\s,.-]+/).filter(w => w.length > 3 && !['road', 'near', 'bank'].includes(w));

    const scored = deptMatches.map(emp => {
      const distance = getRequestDistance(
        dispatchModalReq.coordinates,
        emp.coordinates,
        dispatchModalReq.location,
        emp.area
      );

      // Check text match if coordinates are unresolvable or missing
      const empAreaText = (emp.area || '').toLowerCase();
      const empTokens = empAreaText.split(/[\s,.-]+/).filter(w => w.length > 3);
      const sharedTokens = reqTokens.filter(t => empTokens.includes(t));
      const hasTextMatch = sharedTokens.length > 0;

      let score = 9999;
      if (distance !== null && !isNaN(distance)) {
        score = distance;
      } else if (hasTextMatch) {
        score = 0.5; // Shared area text match
      }

      return {
        ...emp,
        distanceKm: distance,
        distanceFormatted: formatDistance(distance) || (hasTextMatch ? 'Same Area' : null),
        score,
        hasTextMatch
      };
    });

    // Sort closest first
    scored.sort((a, b) => a.score - b.score);
    return scored;
  }, [employeesList, dispatchModalReq]);

  const bestMatchSpecialistUid = useMemo(() => {
    if (rankedDepartmentSpecialists.length === 0) return null;
    const top = rankedDepartmentSpecialists[0];
    if (top.score < 9000) {
      return top.uid;
    }
    return null;
  }, [rankedDepartmentSpecialists]);

  useEffect(() => {
    if (dispatchModalReq) {
      if (rankedDepartmentSpecialists.length > 0) {
        setTargetEmployeeUid(rankedDepartmentSpecialists[0].uid);
      } else {
        setTargetEmployeeUid('');
      }
    }
  }, [dispatchModalReq, rankedDepartmentSpecialists]);

  // Toggle user status (active <-> inactive)
  const handleToggleUserStatus = async (targetUser: UserData) => {
    const newStatus: UserStatus = targetUser.status === 'inactive' ? 'active' : 'inactive';
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), { status: newStatus });
      showMessage(`User account set to ${newStatus.toUpperCase()}.`, 'success');
    } catch (err: any) {
      showMessage(err.message || 'Failed to update user status.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete User / Employee
  const handleDeleteUser = async (targetUser: UserData) => {
    if (!window.confirm(`Are you sure you want to delete ${targetUser.fullName}?`)) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'users', targetUser.uid));
      showMessage('User record removed from platform.', 'success');
    } catch (err: any) {
      showMessage(err.message || 'Failed to delete user.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Add Employee directly from Admin Panel
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) {
      showMessage('Technician Name is required.', 'error');
      return;
    }
    if (!newEmpEmail.trim()) {
      showMessage('Email Address is required.', 'error');
      return;
    }
    const cleanPhone = newEmpPhone.replace(/\D/g, '').slice(0, 10);
    if (cleanPhone.length !== 10) {
      showMessage('Phone must be a valid 10-digit number.', 'error');
      return;
    }
    if (!newEmpDept) {
      showMessage('Department selection is required.', 'error');
      return;
    }
    if (!newEmpPassword.trim() || newEmpPassword.length < 6) {
      showMessage('Password is required and must be at least 6 characters.', 'error');
      return;
    }

    setIsSavingEmp(true);
    try {
      const cleanEmail = newEmpEmail.toLowerCase().trim();
      const uid = await createAccountByAdmin(cleanEmail, newEmpPassword.trim());

      await setDoc(doc(db, 'users', uid), {
        uid,
        fullName: newEmpName.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        department: newEmpDept,
        role: 'employee',
        status: 'active',
        onboardingCompleted: true,
        createdAt: new Date().toISOString()
      });

      showMessage(`Employee ${newEmpName} registered in ${newEmpDept} Department!`, 'success');
      setAddEmpModalOpen(false);
      setNewEmpName('');
      setNewEmpEmail('');
      setNewEmpPhone('');
      setNewEmpPassword('');
    } catch (err: any) {
      showMessage(err.message || 'Failed to add employee.', 'error');
    } finally {
      setIsSavingEmp(false);
    }
  };

  // Update Employee (Edit)
  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee?.uid || !editEmpName.trim()) {
      showMessage('Technician name is required.', 'error');
      return;
    }

    const cleanPhone = editEmpPhone.replace(/\D/g, '').slice(0, 10);
    if (cleanPhone.length !== 10) {
      showMessage('Phone must be a valid 10-digit number.', 'error');
      return;
    }
    if (!editEmpDept) {
      showMessage('Department selection is required.', 'error');
      return;
    }

    setIsUpdatingEmp(true);
    try {
      await updateDoc(doc(db, 'users', editingEmployee.uid), {
        fullName: editEmpName.trim(),
        phone: cleanPhone,
        department: editEmpDept,
        updatedAt: new Date().toISOString()
      });

      showMessage(`Technician ${editEmpName} updated successfully!`, 'success');
      setEditingEmployee(null);
    } catch (err: any) {
      showMessage(err.message || 'Failed to update technician.', 'error');
    } finally {
      setIsUpdatingEmp(false);
    }
  };

  // Add Citizen User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) {
      showMessage('Citizen Name is required.', 'error');
      return;
    }
    if (!newUserEmail.trim()) {
      showMessage('Email Address is required.', 'error');
      return;
    }
    const cleanPhone = newUserPhone.replace(/\D/g, '').slice(0, 10);
    if (cleanPhone.length !== 10) {
      showMessage('Phone must be a valid 10-digit number.', 'error');
      return;
    }
    if (!newUserPassword.trim() || newUserPassword.length < 6) {
      showMessage('Password is required and must be at least 6 characters.', 'error');
      return;
    }

    setIsSavingUser(true);
    try {
      const cleanEmail = newUserEmail.toLowerCase().trim();
      const uid = await createAccountByAdmin(cleanEmail, newUserPassword.trim());

      await setDoc(doc(db, 'users', uid), {
        uid,
        fullName: newUserName.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        role: 'user',
        status: 'active',
        onboardingCompleted: true,
        createdAt: new Date().toISOString()
      });

      showMessage(`Citizen ${newUserName} added successfully!`, 'success');
      setAddUserModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPhone('');
      setNewUserPassword('');
    } catch (err: any) {
      showMessage(err.message || 'Failed to add citizen.', 'error');
    } finally {
      setIsSavingUser(false);
    }
  };

  // Update Citizen User (Edit)
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser?.uid || !editUserName.trim()) {
      showMessage('User name is required.', 'error');
      return;
    }

    const cleanPhone = editUserPhone.replace(/\D/g, '').slice(0, 10);
    if (cleanPhone.length !== 10) {
      showMessage('Phone must be a valid 10-digit number.', 'error');
      return;
    }

    setIsUpdatingUser(true);
    try {
      await updateDoc(doc(db, 'users', editingUser.uid), {
        fullName: editUserName.trim(),
        phone: cleanPhone,
        updatedAt: new Date().toISOString()
      });

      showMessage(`Citizen ${editUserName} updated successfully!`, 'success');
      setEditingUser(null);
    } catch (err: any) {
      showMessage(err.message || 'Failed to update citizen.', 'error');
    } finally {
      setIsUpdatingUser(false);
    }
  };

  // Department CRUD Handlers
  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) {
      showMessage('Department name is required.', 'error');
      return;
    }

    setIsSavingDept(true);
    try {
      await createDepartment({
        name: newDeptName.trim(),
        description: newDeptDesc.trim() || `${newDeptName.trim()} Services`,
        icon: newDeptIcon.trim() || '🛠️',
        color: newDeptColor || 'blue',
        slaHours: Number(newDeptSlaHours) || 3
      });

      showMessage(`Department "${newDeptName.trim()}" created successfully!`, 'success');
      setAddDeptModalOpen(false);
      setNewDeptName('');
      setNewDeptDesc('');
      setNewDeptIcon('🛠️');
      setNewDeptColor('blue');
      setNewDeptSlaHours(3);
    } catch (err: any) {
      showMessage(err.message || 'Failed to create department.', 'error');
    } finally {
      setIsSavingDept(false);
    }
  };

  const handleUpdateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept?.id || !editDeptName.trim()) {
      showMessage('Department name is required.', 'error');
      return;
    }

    setIsUpdatingDept(true);
    try {
      await updateDepartment(editingDept.id, {
        name: editDeptName.trim(),
        description: editDeptDesc.trim(),
        icon: editDeptIcon.trim() || '🛠️',
        color: editDeptColor || 'blue',
        slaHours: Number(editDeptSlaHours) || 3
      });

      showMessage(`Department "${editDeptName}" updated!`, 'success');
      setEditingDept(null);
    } catch (err: any) {
      showMessage(err.message || 'Failed to update department.', 'error');
    } finally {
      setIsUpdatingDept(false);
    }
  };

  const handleDeleteDept = async (dept: DepartmentItem) => {
    if (!dept.id) return;
    if (!window.confirm(`Are you sure you want to delete the "${dept.name}" department?`)) return;
    setActionLoading(true);
    try {
      await deleteDepartment(dept.id);
      showMessage(`Department "${dept.name}" deleted.`, 'success');
    } catch (err: any) {
      showMessage(err.message || 'Failed to delete department.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredDepartments = useMemo(() => {
    if (!deptSearch.trim()) return departmentsList;
    const q = deptSearch.toLowerCase();
    return departmentsList.filter(d => 
      (d.name || '').toLowerCase().includes(q) ||
      (d.description || '').toLowerCase().includes(q)
    );
  }, [departmentsList, deptSearch]);

  // Dispatch Employee to an urgent/open task
  const handleExecuteDispatch = async () => {
    if (!dispatchModalReq || !targetEmployeeUid) {
      showMessage('Please select a technician to dispatch.', 'error');
      return;
    }

    const chosenEmployee = employeesList.find(e => e.uid === targetEmployeeUid);
    if (!chosenEmployee) {
      showMessage('Selected employee could not be found.', 'error');
      return;
    }

    setIsDispatching(true);
    try {
      const code = await directDispatchByAdmin(dispatchModalReq, {
        uid: chosenEmployee.uid,
        fullName: chosenEmployee.fullName,
        department: chosenEmployee.department
      });

      showMessage(`Dispatched ${chosenEmployee.fullName}! 4-Digit Handshake Code: ${code}`, 'success');
      setDispatchModalReq(null);
      setTargetEmployeeUid('');
    } catch (err: any) {
      showMessage(err.message || 'Failed to dispatch employee.', 'error');
    } finally {
      setIsDispatching(false);
    }
  };

  // Task CRUD Handlers (Admin Master Console)
  const resetTaskForm = () => {
    setTaskTitle('');
    setTaskDesc('');
    setTaskCategory(availableCategories[0] || 'Plumbing');
    setTaskPriority('NORMAL');
    setTaskDate(new Date().toISOString().split('T')[0]);
    setTaskTime(new Date().toTimeString().slice(0, 5));
    setTaskLocation(profile?.area || 'Neighborhood Hub');
    setTaskCoordinates(profile?.coordinates || null);
    setTaskRequesterId('admin');
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      showMessage('Task title is required.', 'error');
      return;
    }
    if (!taskDesc.trim()) {
      showMessage('Task description is required.', 'error');
      return;
    }
    if (!taskCategory) {
      showMessage('Department is required.', 'error');
      return;
    }
    if (!taskPriority) {
      showMessage('Priority level is required.', 'error');
      return;
    }
    if (!taskDate) {
      showMessage('Scheduled date is required.', 'error');
      return;
    }
    if (!taskTime) {
      showMessage('Scheduled time is required.', 'error');
      return;
    }
    if (!taskLocation.trim()) {
      showMessage('Location / Area is required.', 'error');
      return;
    }

    setIsSavingTask(true);
    try {
      let requesterId = taskRequesterId;
      let requesterName = 'Admin Community Desk';

      if (taskRequesterId === 'admin') {
        requesterId = user?.uid || 'admin';
        requesterName = profile?.fullName ? `${profile.fullName} (Admin)` : 'Platform Admin';
      } else {
        const citizen = citizensList.find(c => c.uid === taskRequesterId);
        if (citizen) {
          requesterName = citizen.fullName || citizen.email || 'Citizen';
        }
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const nowTimeStr = new Date().toTimeString().slice(0, 5);

      await addDoc(collection(db, 'helpRequests'), {
        requesterId,
        requesterName,
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        categoryId: taskCategory,
        priority: taskPriority,
        date: taskDate || todayStr,
        startTime: taskTime || nowTimeStr,
        location: taskLocation.trim(),
        coordinates: taskCoordinates || null,
        status: 'OPEN',
        isEscalated: false,
        dispatchedByAdmin: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      showMessage(`Task "${taskTitle.trim()}" published successfully!`, 'success');
      setCreateTaskModalOpen(false);
      resetTaskForm();
    } catch (err: any) {
      showMessage(err.message || 'Failed to create task.', 'error');
    } finally {
      setIsSavingTask(false);
    }
  };

  const handleStartEditTask = (req: HelpRequest) => {
    setEditingTask(req);
    setEditTaskTitle(req.title || '');
    setEditTaskDesc(req.description || '');
    setEditTaskCategory(req.categoryId || 'Plumbing');
    setEditTaskPriority(req.priority || 'NORMAL');
    setEditTaskDate(req.date || new Date().toISOString().split('T')[0]);
    setEditTaskTime(req.startTime || '10:00');
    setEditTaskLocation(req.location || '');
    setEditTaskCoordinates(req.coordinates || null);
    setEditTaskStatus((req.status as HelpStatus) || 'OPEN');
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask?.id) return;
    if (!editTaskTitle.trim()) {
      showMessage('Task title is required.', 'error');
      return;
    }
    if (!editTaskDesc.trim()) {
      showMessage('Task description is required.', 'error');
      return;
    }
    if (!editTaskCategory) {
      showMessage('Department is required.', 'error');
      return;
    }
    if (!editTaskPriority) {
      showMessage('Priority is required.', 'error');
      return;
    }
    if (!editTaskDate) {
      showMessage('Scheduled date is required.', 'error');
      return;
    }
    if (!editTaskTime) {
      showMessage('Scheduled time is required.', 'error');
      return;
    }
    if (!editTaskLocation.trim()) {
      showMessage('Location / Area is required.', 'error');
      return;
    }

    setIsUpdatingTask(true);
    try {
      await updateDoc(doc(db, 'helpRequests', editingTask.id), {
        title: editTaskTitle.trim(),
        description: editTaskDesc.trim(),
        categoryId: editTaskCategory,
        priority: editTaskPriority,
        date: editTaskDate,
        startTime: editTaskTime,
        location: editTaskLocation.trim(),
        coordinates: editTaskCoordinates || null,
        status: editTaskStatus,
        updatedAt: new Date().toISOString()
      });

      showMessage(`Task "${editTaskTitle.trim()}" updated successfully!`, 'success');
      setEditingTask(null);
      if (viewingTask?.id === editingTask.id) {
        setViewingTask(prev => prev ? {
          ...prev,
          title: editTaskTitle.trim(),
          description: editTaskDesc.trim(),
          categoryId: editTaskCategory,
          priority: editTaskPriority,
          date: editTaskDate,
          startTime: editTaskTime,
          location: editTaskLocation.trim(),
          coordinates: editTaskCoordinates || null,
          status: editTaskStatus
        } : null);
      }
    } catch (err: any) {
      showMessage(err.message || 'Failed to update task.', 'error');
    } finally {
      setIsUpdatingTask(false);
    }
  };

  const handleDeleteTask = async (req: HelpRequest) => {
    if (!req.id) return;
    if (!window.confirm(`Are you sure you want to permanently delete task "${req.title}"?\nThis will remove the request and any associated specialist assignments & offers.`)) {
      return;
    }

    setActionLoading(true);
    try {
      await deleteHelpRequest(req.id);
      showMessage(`Task "${req.title}" and linked records removed.`, 'success');
      if (viewingTask?.id === req.id) {
        setViewingTask(null);
      }
    } catch (err: any) {
      showMessage(err.message || 'Failed to delete task.', 'error');
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

  // Save Admin Credentials
  const handleSaveAdminCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!adminNewPassword || adminNewPassword.length < 6) {
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
        showMessage('Admin password updated successfully!', 'success');
        setAdminNewPassword('');
        setAdminConfirmPassword('');
      }
    } catch (err: any) {
      showMessage(err.message || 'Failed to update credentials.', 'error');
    } finally {
      setCredSaving(false);
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

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'Medical': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Groceries': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Electrical': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Plumbing': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
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
        <div className="border-b border-slate-200/80 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1 uppercase tracking-wider">
                <ShieldCheck className="w-3 h-3" />
                Admin Command Console
              </span>
              <span className="text-[11px] text-slate-400 font-mono">3-Tier RBAC & Dispatch Engine</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {activeTab === 'employees' ? 'Employee & Technician Management' :
               activeTab === 'users' ? 'Citizen User Directory' :
               activeTab === 'tasks' ? 'Master Category Task Console' :
               activeTab === 'settings' ? 'Admin Profile & Credentials' :
               'Network Overview & SLA Dispatch'}
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              {activeTab === 'employees' ? 'Manage service staff, department assignments, and toggle active/inactive status.' :
               activeTab === 'users' ? 'Inspect registered citizens, review account activity, and maintain community safety.' :
               activeTab === 'tasks' ? 'Full visibility across Medical, Groceries, Electrical, and Plumbing requests.' :
               activeTab === 'settings' ? 'Update administrator credentials and base coordinates.' :
               'Monitor real-time requests, resolve unattended SLA deadlines, and dispatch available specialists.'}
            </p>
          </div>

          {/* Quick SLA Escalation Trigger Button */}
          
        </div>

        {/* TAB 1: OVERVIEW & SLA ESCALATION */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <Card className="border border-slate-200/85 rounded-2xl bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Citizens</span>
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">{citizensList.length}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Registered residents</p>
              </Card>

              <Card className="border border-slate-200/85 rounded-2xl bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Technicians</span>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <HandHeart className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">{employeesList.length}</p>
                <p className="text-[11px] text-indigo-600 font-medium mt-0.5">
                  Across 4 departments
                </p>
              </Card>

              <Card className="border border-slate-200/85 rounded-2xl bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Open Requests</span>
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <ClipboardList className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">
                  {requestsList.filter(r => r.status === 'OPEN').length}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Awaiting assignment</p>
              </Card>

              <Card className="border border-slate-200/85 rounded-2xl bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Completed</span>
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">
                  {tasksList.filter(t => t.status === 'COMPLETED').length}
                </p>
                <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Verified handshakes</p>
              </Card>
            </div>

            {/* 🚨 CRITICAL SLA BREACH & EMERGENCY DISPATCH CONSOLE */}
            <div className="border border-rose-200 bg-rose-50/50 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold animate-pulse shadow-xs">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-rose-900 flex items-center gap-2">
                      <span>Emergency SLA Escalation Engine</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white animate-bounce">
                        {escalatedRequests.length} URGENT
                      </span>
                    </h3>
                    <p className="text-[11px] text-rose-700">
                      Requests approaching deadline with zero assigned helpers. Dispatch an available specialist directly.
                    </p>
                  </div>
                </div>
              </div>

              {escalatedRequests.length === 0 ? (
                <div className="p-4 bg-white/80 rounded-xl border border-rose-100 text-center text-xs text-slate-500">
                  ✅ All active requests are within safe SLA thresholds or assigned.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {escalatedRequests.map(req => {
                    const mins = getMinutesUntilDeadline(req.date, req.startTime);
                    return (
                      <div key={req.id} className="p-3.5 bg-white rounded-xl border border-rose-200 shadow-2xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold border", getCategoryBadge(req.categoryId))}>
                              {req.categoryId}
                            </span>
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3" />
                              {mins !== null ? (mins <= 0 ? 'OVERDUE' : `${mins}m left`) : 'URGENT'}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{req.title}</h4>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">{req.description}</p>
                          <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                            <a
                              href={getGoogleMapsUrl(req.location, req.coordinates)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-blue-600 transition-colors flex items-center gap-0.5 truncate"
                              title="Open in Google Maps"
                            >
                              <span>📍</span>
                              <span className="truncate hover:underline">{req.location}</span>
                            </a>
                            <span className="shrink-0">• By {req.requesterName}</span>
                          </div>
                        </div>

                        <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] text-rose-600 font-semibold">Unclaimed by Technicians</span>
                          <Button
                            size="sm"
                            onClick={() => {
                              setDispatchModalReq(req);
                              setTargetEmployeeUid('');
                            }}
                            className="h-7 px-3 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            <span>Direct Dispatch</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Stream */}
            <div className="border border-slate-200/85 rounded-2xl bg-white p-4 sm:p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-600" />
                Latest Community Requests Stream
              </h3>
              <div className="space-y-2">
                {requestsList.slice(0, 5).map(req => (
                  <div key={req.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                        {req.categoryId?.charAt(0) || 'R'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{req.title}</p>
                        <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                          <span>{req.categoryId} • by {req.requesterName} •</span>
                          <a
                            href={getGoogleMapsUrl(req.location, req.coordinates)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="hover:text-blue-600 hover:underline truncate"
                            title="Open in Google Maps"
                          >
                            📍 {req.location}
                          </a>
                        </p>
                      </div>
                    </div>
                    <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ml-2", getStatusBadge(req.status))}>
                      {req.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EMPLOYEE MANAGEMENT (CRUD) */}
        {activeTab === 'employees' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-lg">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    type="text"
                    placeholder="Search technician name, email, phone..."
                    value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    className="pl-9 h-9 rounded-xl bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs focus:border-blue-600 shadow-2xs"
                  />
                </div>
                <select
                  value={empDeptFilter}
                  onChange={(e) => setEmpDeptFilter(e.target.value)}
                  className="h-9 rounded-xl bg-white border border-slate-200 px-3 text-xs text-slate-700 font-semibold focus:outline-none focus:border-blue-600 shadow-2xs"
                >
                  <option value="All">All Departments</option>
                  {departmentsList.map(d => (
                    <option key={d.id || d.name} value={d.name}>
                      {d.icon || '🛠️'} {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                onClick={() => setAddEmpModalOpen(true)}
                className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Employee</span>
              </Button>
            </div>

            {/* Employees Table */}
            <div className="border border-slate-200/85 rounded-2xl bg-white shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Specialist</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-10 text-slate-400 font-medium">
                          No employees found matching filter criteria. Click "Add Employee" to create one.
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map(emp => (
                        <tr key={emp.uid} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px] shadow-2xs shrink-0">
                                {emp.fullName?.charAt(0) || 'E'}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate">{emp.fullName}</p>
                                <p className="text-slate-400 text-[10px] truncate">{emp.email}</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-4">
                            <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold border", getCategoryBadge(emp.department || 'Plumbing'))}>
                              {emp.department || 'Plumbing'}
                            </span>
                          </td>

                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600">
                            {emp.phone || '—'}
                          </td>

                          <td className="py-2.5 px-4 text-center">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold",
                              emp.status === 'inactive'
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            )}>
                              {emp.status === 'inactive' ? 'INACTIVE' : 'ACTIVE'}
                            </span>
                          </td>

                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleUserStatus(emp)}
                                disabled={actionLoading}
                                className={cn(
                                  "h-7 px-2 text-[11px] font-semibold rounded-lg cursor-pointer",
                                  emp.status === 'inactive'
                                    ? "text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                    : "text-amber-700 border-amber-200 hover:bg-amber-50"
                                )}
                              >
                                {emp.status === 'inactive' ? 'Activate' : 'Deactivate'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingEmployee(emp);
                                  setEditEmpName(emp.fullName || '');
                                  setEditEmpPhone(emp.phone || '');
                                  setEditEmpDept(emp.department || departmentsList[0]?.name || 'Plumbing');
                                }}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                                title="Edit Employee"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteUser(emp)}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                title="Delete Employee"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CITIZEN USER MANAGEMENT (CRUD) */}
        {activeTab === 'users' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Search citizen name, email, phone..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9 h-9 rounded-xl bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs focus:border-blue-600 shadow-2xs"
                />
              </div>
              <div className="flex items-center gap-3">
                <p className="text-[11px] text-slate-400 font-mono">
                  {filteredCitizens.length} Registered Citizens
                </p>
                <Button
                  onClick={() => setAddUserModalOpen(true)}
                  className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Citizen</span>
                </Button>
              </div>
            </div>

            <div className="border border-slate-200/85 rounded-2xl bg-white shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Citizen</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Requests Posted</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCitizens.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-10 text-slate-400 font-medium">
                          No citizens matching search criteria. Click "Add Citizen" to create one.
                        </td>
                      </tr>
                    ) : (
                      filteredCitizens.map(usr => {
                        const postedCount = requestsList.filter(r => r.requesterId === usr.uid).length;
                        return (
                          <tr key={usr.uid} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px] shadow-2xs shrink-0">
                                  {usr.fullName?.charAt(0) || 'U'}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 truncate">{usr.fullName}</p>
                                  <p className="text-slate-400 text-[10px] truncate">{usr.email}</p>
                                </div>
                              </div>
                            </td>

                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600">
                              {usr.phone || '—'}
                            </td>

                            <td className="py-2.5 px-4 text-center">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold",
                                usr.status === 'inactive'
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              )}>
                                {usr.status === 'inactive' ? 'SUSPENDED' : 'ACTIVE'}
                              </span>
                            </td>

                            <td className="py-2.5 px-4 text-center">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                {postedCount}
                              </span>
                            </td>

                            <td className="py-2.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleToggleUserStatus(usr)}
                                  disabled={actionLoading}
                                  className={cn(
                                    "h-7 px-2.5 text-[11px] font-semibold rounded-lg cursor-pointer",
                                    usr.status === 'inactive'
                                      ? "text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                      : "text-rose-700 border-rose-200 hover:bg-rose-50"
                                  )}
                                >
                                  {usr.status === 'inactive' ? 'Activate' : 'Suspend'}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingUser(usr);
                                    setEditUserName(usr.fullName || '');
                                    setEditUserPhone(usr.phone || '');
                                  }}
                                  className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                                  title="Edit Citizen"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteUser(usr)}
                                  className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                  title="Delete Citizen"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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

        {/* TAB 4: SERVICE DEPARTMENTS MANAGEMENT (CRUD) */}
        {activeTab === 'departments' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Search department name or description..."
                  value={deptSearch}
                  onChange={(e) => setDeptSearch(e.target.value)}
                  className="pl-9 h-9 rounded-xl bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs focus:border-blue-600 shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-3">
                <p className="text-[11px] text-slate-400 font-mono">
                  {filteredDepartments.length} Active Departments
                </p>
                <Button
                  onClick={() => setAddDeptModalOpen(true)}
                  className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Department</span>
                </Button>
              </div>
            </div>

            {/* Departments Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDepartments.map(dept => {
                const staffCount = employeesList.filter(e => e.department?.toLowerCase() === dept.name.toLowerCase()).length;
                const activeRequestsCount = requestsList.filter(r => r.categoryId?.toLowerCase() === dept.name.toLowerCase() && (r.status === 'OPEN' || r.status === 'IN_PROGRESS')).length;

                return (
                  <div key={dept.id || dept.name} className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs flex flex-col justify-between space-y-3 hover:shadow-md transition-shadow">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl p-2 bg-slate-50 border border-slate-100 rounded-xl">
                            {dept.icon || '🛠️'}
                          </span>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">{dept.name}</h4>
                            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                              {dept.slaHours || 3} Hours SLA
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mt-1">
                        {dept.description || 'Neighborhood assistance services'}
                      </p>

                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                        <div className="p-2 bg-slate-50 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Specialists</span>
                          <span className="text-sm font-bold text-slate-800">{staffCount} Active</span>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Live Tasks</span>
                          <span className="text-sm font-bold text-slate-800">{activeRequestsCount} In Progress</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingDept(dept)}
                        className="h-7 px-2.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200 rounded-lg cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </Button>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingDept(dept);
                            setEditDeptName(dept.name);
                            setEditDeptDesc(dept.description || '');
                            setEditDeptIcon(dept.icon || '🛠️');
                            setEditDeptColor(dept.color || 'blue');
                            setEditDeptSlaHours(dept.slaHours || 3);
                          }}
                          className="h-7 px-2.5 text-[11px] font-semibold text-slate-700 hover:text-blue-600 rounded-lg cursor-pointer flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDept(dept)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Delete Department"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: MASTER ALL-CATEGORY TASK EXPLORER */}
        {activeTab === 'tasks' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Filter & Action Bar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-slate-500 mr-1">Department:</span>
                {['All', ...availableCategories].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setTaskCategoryFilter(cat)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                      taskCategoryFilter === cat
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
                <span className="text-xs font-semibold text-slate-500">Status:</span>
                <select
                  value={taskStatusFilter}
                  onChange={(e) => setTaskStatusFilter(e.target.value)}
                  className="h-8 rounded-lg bg-slate-50 border border-slate-200 px-2.5 text-xs text-slate-700 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="OPEN">OPEN</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>

                <Button
                  onClick={() => {
                    resetTaskForm();
                    setCreateTaskModalOpen(true);
                  }}
                  className="h-8 px-3 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Task</span>
                </Button>
              </div>
            </div>

            {/* Tasks Grid or Empty State */}
            {filteredMasterTasks.length === 0 ? (
              <div className="p-12 text-center bg-white border border-dashed border-slate-200 rounded-2xl space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">No tasks found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No requests matching the selected category or status. You can post a new help task directly as Admin.
                </p>
                <Button
                  onClick={() => {
                    resetTaskForm();
                    setCreateTaskModalOpen(true);
                  }}
                  className="h-8 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Create First Task</span>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMasterTasks.map(req => (
                  <div 
                    key={req.id} 
                    className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl shadow-xs flex flex-col justify-between space-y-3 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5 mb-2">
                        <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold border", getCategoryBadge(req.categoryId))}>
                          {req.categoryId}
                        </span>
                        <div className="flex items-center gap-1">
                          {req.priority && req.priority !== 'NORMAL' && (
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                              req.priority === 'URGENT' ? "bg-rose-50 text-rose-700 border border-rose-200" :
                              req.priority === 'HIGH' ? "bg-amber-50 text-amber-700 border border-amber-200" :
                              "bg-slate-50 text-slate-600"
                            )}>
                              {req.priority}
                            </span>
                          )}
                          <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-semibold", getStatusBadge(req.status))}>
                            {req.status}
                          </span>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{req.title}</h4>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">{req.description}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-2">
                      <div className="text-[11px] flex items-center justify-between">
                        <span className="truncate pr-1">Requester: <strong className="text-slate-800">{req.requesterName}</strong></span>
                        <span className="font-mono text-[10px] text-slate-400 shrink-0">{req.date} {req.startTime}</span>
                      </div>

                      {req.location && (
                        <a
                          href={getGoogleMapsUrl(req.location, req.coordinates)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] text-slate-500 hover:text-blue-600 flex items-center gap-1 truncate transition-colors cursor-pointer group"
                          title="Open location in Google Maps"
                        >
                          <MapPin className="w-3 h-3 text-slate-400 group-hover:text-blue-600 shrink-0" />
                          <span className="truncate group-hover:underline">{req.location}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </a>
                      )}

                      {req.selectedHelperName && (
                        <div className="text-[11px] text-indigo-700 font-medium bg-indigo-50 p-1.5 rounded-lg border border-indigo-100 flex items-center justify-between">
                          <span>Assigned: <strong>{req.selectedHelperName}</strong></span>
                          {req.completionCode && (
                            <span className="font-mono text-[10px] font-bold bg-white px-1.5 py-0.5 rounded border border-indigo-200">
                              PIN: {req.completionCode}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Admin Task Actions (View, Edit, Delete) */}
                      <div className="flex items-center gap-1 pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingTask(req)}
                          className="flex-1 h-7 text-[11px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg p-0 font-medium cursor-pointer flex items-center justify-center gap-1"
                          title="View Details"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartEditTask(req)}
                          className="flex-1 h-7 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg p-0 font-medium cursor-pointer flex items-center justify-center gap-1"
                          title="Edit Task"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTask(req)}
                          className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg p-0 cursor-pointer flex items-center justify-center shrink-0"
                          title="Delete Task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      {req.status === 'OPEN' && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setDispatchModalReq(req);
                            setTargetEmployeeUid('');
                          }}
                          className="w-full h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 mt-1"
                        >
                          <Send className="w-3 h-3" />
                          <span>Dispatch Employee</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: ADMIN SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Profile Form */}
              <div className="bg-white border border-slate-200/85 rounded-2xl p-4 sm:p-5 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                  <UserIcon className="w-4 h-4 text-blue-600" />
                  Admin Profile Details
                </h3>
                <p className="text-[11px] text-slate-500 mb-3.5">Manage administrator operational jurisdiction</p>

                <form onSubmit={handleSaveAdminProfile} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Full Name</label>
                    <Input
                      type="text"
                      required
                      value={adminFullName}
                      onChange={(e) => setAdminFullName(e.target.value)}
                      className="h-9 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Phone</label>
                    <Input
                      type="tel"
                      required
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(e.target.value)}
                      className="h-9 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Jurisdiction Area</label>
                    <LocationPicker 
                      defaultLocation={adminArea}
                      onLocationSelect={(addr, coords) => {
                        setAdminArea(addr);
                        if (coords) setAdminCoordinates(coords);
                      }} 
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={profileSaving}
                    className="w-full h-9 rounded-xl bg-blue-600 text-white text-xs font-semibold mt-2"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {profileSaving ? 'Saving...' : 'Save Profile'}
                  </Button>
                </form>
              </div>

              {/* Password Form */}
              <div className="bg-white border border-slate-200/85 rounded-2xl p-4 sm:p-5 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-indigo-600" />
                  Update Credentials
                </h3>
                <p className="text-[11px] text-slate-500 mb-3.5">Modify administrator login password</p>

                <form onSubmit={handleSaveAdminCredentials} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">New Password</label>
                    <Input
                      type="password"
                      required
                      value={adminNewPassword}
                      onChange={(e) => setAdminNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-9 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Confirm New Password</label>
                    <Input
                      type="password"
                      required
                      value={adminConfirmPassword}
                      onChange={(e) => setAdminConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-9 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={credSaving}
                    className="w-full h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold mt-2"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {credSaving ? 'Updating...' : 'Update Password'}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: DIRECT DISPATCH EMPLOYEE */}
        {dispatchModalReq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4 text-slate-900 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Dispatch Department Specialist</h3>
                    <p className="text-[11px] text-slate-500">Directly assign a technician to this task</p>
                  </div>
                </div>
                <button onClick={() => setDispatchModalReq(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Task Summary */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-slate-800 truncate">{dispatchModalReq.title}</span>
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", getCategoryBadge(dispatchModalReq.categoryId))}>
                    {dispatchModalReq.categoryId}
                  </span>
                </div>
                <p className="text-slate-500 text-[11px] flex items-center gap-1 flex-wrap">
                  <span>Requester: {dispatchModalReq.requesterName} •</span>
                  <a
                    href={getGoogleMapsUrl(dispatchModalReq.location, dispatchModalReq.coordinates)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5 font-medium"
                    title="Open location in Google Maps"
                  >
                    <span>📍 {dispatchModalReq.location}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </p>
              </div>

              {/* Specialist Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <span>Available {dispatchModalReq.categoryId} Specialists</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                      {rankedDepartmentSpecialists.length}
                    </span>
                  </label>
                  {bestMatchSpecialistUid && (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-emerald-600" /> Nearest Highlighted
                    </span>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {rankedDepartmentSpecialists.length === 0 ? (
                    <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl text-center space-y-1.5">
                      <p className="text-xs font-semibold text-amber-900">
                        No active specialists found in {dispatchModalReq.categoryId}.
                      </p>
                      <p className="text-[11px] text-amber-700">
                        Please register or assign an employee to the {dispatchModalReq.categoryId} department first.
                      </p>
                    </div>
                  ) : (
                    rankedDepartmentSpecialists.map((emp) => {
                      const isTopMatch = emp.uid === bestMatchSpecialistUid;
                      const isSelected = targetEmployeeUid === emp.uid;

                      return (
                        <div
                          key={emp.uid}
                          onClick={() => setTargetEmployeeUid(emp.uid)}
                          className={cn(
                            "p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all text-xs",
                            isTopMatch
                              ? isSelected
                                ? "bg-emerald-50/95 border-2 border-emerald-500 text-emerald-950 shadow-sm ring-2 ring-emerald-300"
                                : "bg-emerald-50/60 border-2 border-emerald-400 text-emerald-900 hover:bg-emerald-50 shadow-2xs"
                              : isSelected
                                ? "bg-blue-50 border-2 border-blue-600 text-blue-900 shadow-2xs ring-1 ring-blue-600"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={cn(
                              "w-8 h-8 rounded-xl text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs",
                              isTopMatch ? "bg-emerald-600 ring-2 ring-emerald-300" : "bg-blue-600"
                            )}>
                              {emp.fullName?.charAt(0) || 'E'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="truncate font-bold text-slate-900 text-xs">{emp.fullName}</p>
                                {isTopMatch ? (
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-600 text-white shadow-2xs flex items-center gap-0.5">
                                    🌟 Nearest Match
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                    Department Specialist
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 truncate mt-0.5 flex items-center gap-1 flex-wrap">
                                <span>📞 {emp.phone || 'No phone'}</span>
                                {emp.area && <span>• 📍 {emp.area}</span>}
                                {emp.distanceFormatted && (
                                  <span className={cn(
                                    "font-semibold px-1 rounded",
                                    isTopMatch ? "text-emerald-800 bg-emerald-100 border border-emerald-200" : "text-slate-600 bg-slate-100"
                                  )}>
                                    ({emp.distanceFormatted})
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[9px] font-bold uppercase border",
                              getCategoryBadge(emp.department || dispatchModalReq.categoryId)
                            )}>
                              {emp.department}
                            </span>
                            <div className={cn(
                              "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                              isSelected 
                                ? (isTopMatch ? "border-emerald-600 bg-emerald-600" : "border-blue-600 bg-blue-600")
                                : "border-slate-300 bg-white"
                            )}>
                              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button variant="ghost" size="sm" onClick={() => setDispatchModalReq(null)} className="h-8 text-xs">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleExecuteDispatch}
                  disabled={!targetEmployeeUid || isDispatching}
                  className="h-8 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                >
                  {isDispatching ? 'Dispatching...' : 'Confirm Assignment'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ADD EMPLOYEE DIRECTLY */}
        {addEmpModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4 text-slate-900 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Add Service Specialist</h3>
                    <p className="text-[11px] text-slate-500">Create employee credentials in department</p>
                  </div>
                </div>
                <button onClick={() => setAddEmpModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateEmployee} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Technician Full Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="text"
                    required
                    value={newEmpName}
                    onChange={(e) => setNewEmpName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="h-9 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="email"
                    required
                    value={newEmpEmail}
                    onChange={(e) => setNewEmpEmail(e.target.value)}
                    placeholder="john@localend.com"
                    className="h-9 rounded-xl text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">
                      Phone (10 digits) <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      type="tel"
                      required
                      minLength={10}
                      maxLength={10}
                      value={newEmpPhone}
                      onChange={(e) => setNewEmpPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      className="h-9 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">
                      Assigned Department <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={newEmpDept}
                      onChange={(e) => setNewEmpDept(e.target.value)}
                      className="w-full h-9 rounded-xl bg-white border border-slate-200 text-xs px-3 focus:outline-none focus:border-blue-600 font-semibold"
                    >
                      {departmentsList.map(d => (
                        <option key={d.id || d.name} value={d.name}>
                          {d.icon || '🛠️'} {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Login Password <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="password"
                    required
                    minLength={6}
                    value={newEmpPassword}
                    onChange={(e) => setNewEmpPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="h-9 rounded-xl text-xs font-mono"
                  />
                  <p className="text-[10px] text-slate-400">Employee will use this password to sign in at /login</p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setAddEmpModalOpen(false)} className="h-8 text-xs">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSavingEmp}
                    className="h-8 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                  >
                    {isSavingEmp ? 'Registering...' : 'Register Specialist'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: EDIT EMPLOYEE */}
        {editingEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4 text-slate-900 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Edit Service Specialist</h3>
                    <p className="text-[11px] text-slate-500">Update employee details and department assignment</p>
                  </div>
                </div>
                <button onClick={() => setEditingEmployee(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateEmployee} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Technician Full Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="text"
                    required
                    value={editEmpName}
                    onChange={(e) => setEditEmpName(e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">
                      Phone (10 digits) <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      type="tel"
                      required
                      minLength={10}
                      maxLength={10}
                      value={editEmpPhone}
                      onChange={(e) => setEditEmpPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      className="h-9 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">
                      Assigned Department <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={editEmpDept}
                      onChange={(e) => setEditEmpDept(e.target.value)}
                      className="w-full h-9 rounded-xl bg-white border border-slate-200 text-xs px-3 focus:outline-none focus:border-blue-600 font-semibold"
                    >
                      {departmentsList.map(d => (
                        <option key={d.id || d.name} value={d.name}>
                          {d.icon || '🛠️'} {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setEditingEmployee(null)} className="h-8 text-xs">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isUpdatingEmp}
                    className="h-8 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                  >
                    {isUpdatingEmp ? 'Saving...' : 'Update Specialist'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: ADD CITIZEN USER */}
        {addUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4 text-slate-900 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Add Citizen Member</h3>
                    <p className="text-[11px] text-slate-500">Register a new community citizen into the system</p>
                  </div>
                </div>
                <button onClick={() => setAddUserModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Citizen Full Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="h-9 rounded-xl text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      type="email"
                      required
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="rahul@example.com"
                      className="h-9 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">
                      Phone (10 digits) <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      type="tel"
                      required
                      minLength={10}
                      maxLength={10}
                      value={newUserPhone}
                      onChange={(e) => setNewUserPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      className="h-9 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Login Password <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="password"
                    required
                    minLength={6}
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="h-9 rounded-xl text-xs font-mono"
                  />
                  <p className="text-[10px] text-slate-400">Citizen will use this password to sign in at /login</p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setAddUserModalOpen(false)} className="h-8 text-xs">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSavingUser}
                    className="h-8 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
                  >
                    {isSavingUser ? 'Registering...' : 'Create Citizen'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: EDIT CITIZEN USER */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4 text-slate-900 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Edit Citizen Member</h3>
                    <p className="text-[11px] text-slate-500">Update citizen contact information</p>
                  </div>
                </div>
                <button onClick={() => setEditingUser(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateUser} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Citizen Full Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="text"
                    required
                    value={editUserName}
                    onChange={(e) => setEditUserName(e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Phone (10 digits) <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="tel"
                    required
                    minLength={10}
                    maxLength={10}
                    value={editUserPhone}
                    onChange={(e) => setEditUserPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    className="h-9 rounded-xl text-xs font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setEditingUser(null)} className="h-8 text-xs">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isUpdatingUser}
                    className="h-8 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                  >
                    {isUpdatingUser ? 'Saving...' : 'Update Citizen'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: ADD DEPARTMENT */}
        {addDeptModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4 text-slate-900 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Add Service Department</h3>
                    <p className="text-[11px] text-slate-500">Create a new specialized category for your community</p>
                  </div>
                </div>
                <button onClick={() => setAddDeptModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateDept} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Department Name</label>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xl shrink-0 shadow-2xs"
                      title="Auto-detected Icon"
                    >
                      {newDeptIcon || '🛠️'}
                    </div>
                    <Input
                      type="text"
                      required
                      value={newDeptName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewDeptName(val);
                        setNewDeptIcon(getAutoIconForDepartment(val));
                      }}
                      placeholder="e.g. Carpentry, Painting, Transit..."
                      className="h-10 rounded-xl text-xs flex-1"
                    />
                  </div>
                </div>

                {/* Quick Icon Selector (No typing required) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold">Icon (Auto-selected from name, or click to pick)</span>
                    <span className="text-[10px] text-blue-600 font-medium">Selected: {newDeptIcon}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap p-1.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                    {COMMON_DEPARTMENT_ICONS.map((ico) => (
                      <button
                        key={ico}
                        type="button"
                        onClick={() => setNewDeptIcon(ico)}
                        className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all cursor-pointer ${
                          newDeptIcon === ico 
                            ? 'bg-blue-600 text-white shadow-2xs scale-110 font-bold' 
                            : 'hover:bg-slate-200/70 text-slate-700'
                        }`}
                        title={ico}
                      >
                        {ico}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Description</label>
                  <Input
                    type="text"
                    value={newDeptDesc}
                    onChange={(e) => setNewDeptDesc(e.target.value)}
                    placeholder="Short description of services offered"
                    className="h-9 rounded-xl text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">SLA Target (Hours)</label>
                    <Input
                      type="number"
                      min={1}
                      max={72}
                      required
                      value={newDeptSlaHours}
                      onChange={(e) => setNewDeptSlaHours(Number(e.target.value))}
                      className="h-9 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Badge Color</label>
                    <select
                      value={newDeptColor}
                      onChange={(e) => setNewDeptColor(e.target.value)}
                      className="w-full h-9 rounded-xl bg-white border border-slate-200 text-xs px-3 focus:outline-none focus:border-blue-600"
                    >
                      <option value="blue">Blue</option>
                      <option value="emerald">Emerald</option>
                      <option value="amber">Amber</option>
                      <option value="rose">Rose</option>
                      <option value="purple">Purple</option>
                      <option value="cyan">Cyan</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setAddDeptModalOpen(false)} className="h-8 text-xs">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSavingDept}
                    className="h-8 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                  >
                    {isSavingDept ? 'Creating...' : 'Create Department'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: EDIT DEPARTMENT */}
        {editingDept && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4 text-slate-900 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Edit Department</h3>
                    <p className="text-[11px] text-slate-500">Update department service settings and SLA</p>
                  </div>
                </div>
                <button onClick={() => setEditingDept(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateDept} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Department Name</label>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xl shrink-0 shadow-2xs"
                      title="Department Icon"
                    >
                      {editDeptIcon || '🛠️'}
                    </div>
                    <Input
                      type="text"
                      required
                      value={editDeptName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditDeptName(val);
                        setEditDeptIcon(getAutoIconForDepartment(val));
                      }}
                      className="h-10 rounded-xl text-xs flex-1"
                    />
                  </div>
                </div>

                {/* Quick Icon Selector (No typing required) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold">Icon (Auto-selected from name, or click to pick)</span>
                    <span className="text-[10px] text-blue-600 font-medium">Selected: {editDeptIcon}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap p-1.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                    {COMMON_DEPARTMENT_ICONS.map((ico) => (
                      <button
                        key={ico}
                        type="button"
                        onClick={() => setEditDeptIcon(ico)}
                        className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all cursor-pointer ${
                          editDeptIcon === ico 
                            ? 'bg-blue-600 text-white shadow-2xs scale-110 font-bold' 
                            : 'hover:bg-slate-200/70 text-slate-700'
                        }`}
                        title={ico}
                      >
                        {ico}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Description</label>
                  <Input
                    type="text"
                    value={editDeptDesc}
                    onChange={(e) => setEditDeptDesc(e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">SLA Target (Hours)</label>
                    <Input
                      type="number"
                      min={1}
                      max={72}
                      required
                      value={editDeptSlaHours}
                      onChange={(e) => setEditDeptSlaHours(Number(e.target.value))}
                      className="h-9 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Badge Color</label>
                    <select
                      value={editDeptColor}
                      onChange={(e) => setEditDeptColor(e.target.value)}
                      className="w-full h-9 rounded-xl bg-white border border-slate-200 text-xs px-3 focus:outline-none focus:border-blue-600"
                    >
                      <option value="blue">Blue</option>
                      <option value="emerald">Emerald</option>
                      <option value="amber">Amber</option>
                      <option value="rose">Rose</option>
                      <option value="purple">Purple</option>
                      <option value="cyan">Cyan</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setEditingDept(null)} className="h-8 text-xs">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isUpdatingDept}
                    className="h-8 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                  >
                    {isUpdatingDept ? 'Saving...' : 'Update Department'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: VIEW DEPARTMENT DETAILS & EMPLOYEES */}
        {viewingDept && (() => {
          const deptEmployees = employeesList.filter(
            e => (e.department || '').toLowerCase() === viewingDept.name.toLowerCase()
          );
          const deptRequests = requestsList.filter(
            r => (r.categoryId || '').toLowerCase() === viewingDept.name.toLowerCase()
          );
          const openCount = deptRequests.filter(r => r.status === 'OPEN' || r.status === 'OFFER_RECEIVED').length;
          const inProgressCount = deptRequests.filter(r => r.status === 'IN_PROGRESS' || r.status === 'SCHEDULED').length;
          const completedCount = deptRequests.filter(r => r.status === 'COMPLETED').length;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-5 text-slate-900 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl p-3 bg-slate-50 border border-slate-200/80 rounded-2xl shadow-2xs">
                      {viewingDept.icon || '🛠️'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">{viewingDept.name} Department</h3>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                          {viewingDept.slaHours || 3} Hours SLA
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{viewingDept.description || 'Specialized community assistance services'}</p>
                    </div>
                  </div>
                  <button onClick={() => setViewingDept(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-4 gap-2.5 text-center">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Specialists</span>
                    <span className="text-base font-bold text-slate-800">{deptEmployees.length}</span>
                  </div>
                  <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-100/60">
                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">New / Open</span>
                    <span className="text-base font-bold text-blue-700">{openCount}</span>
                  </div>
                  <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-100/60">
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">In Progress</span>
                    <span className="text-base font-bold text-amber-700">{inProgressCount}</span>
                  </div>
                  <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100/60">
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">Completed</span>
                    <span className="text-base font-bold text-emerald-700">{completedCount}</span>
                  </div>
                </div>

                {/* Employees / Specialists List */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      Assigned Specialists & Technicians ({deptEmployees.length})
                    </h4>
                    <Button
                      size="sm"
                      onClick={() => {
                        setNewEmpDept(viewingDept.name);
                        setAddEmpModalOpen(true);
                      }}
                      className="h-7 px-2.5 text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 cursor-pointer flex items-center gap-1"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>Add Specialist</span>
                    </Button>
                  </div>

                  {deptEmployees.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-1">
                      <p className="text-xs text-slate-500 font-medium">No employees assigned to this department yet.</p>
                      <p className="text-[11px] text-slate-400">Click "Add Specialist" to register a technician for {viewingDept.name}.</p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-52 overflow-y-auto">
                      {deptEmployees.map(emp => (
                        <div key={emp.uid} className="p-2.5 sm:p-3 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                              {emp.fullName?.charAt(0) || 'E'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900 truncate">{emp.fullName}</p>
                              <p className="text-[10px] text-slate-400 truncate">
                                📞 {emp.phone || 'No phone'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-bold",
                              emp.status === 'inactive'
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            )}>
                              {emp.status === 'inactive' ? 'INACTIVE' : 'ACTIVE'}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingEmployee(emp);
                                setEditEmpName(emp.fullName || '');
                                setEditEmpPhone(emp.phone || '');
                                setEditEmpDept(emp.department || viewingDept.name);
                              }}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                              title="Edit Employee"
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Live / Recent Tasks in this Department */}
                <div className="space-y-2.5 pt-1">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <ClipboardList className="w-3.5 h-3.5 text-indigo-600" />
                    Department Tasks Stream ({deptRequests.length})
                  </h4>

                  {deptRequests.length === 0 ? (
                    <div className="p-4 text-center bg-slate-50 rounded-xl border border-slate-100 text-slate-400 text-xs">
                      No citizen requests recorded in {viewingDept.name} yet.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-52 overflow-y-auto">
                      {deptRequests.slice(0, 8).map(req => (
                        <div key={req.id} className="p-2.5 sm:p-3 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors">
                          <div className="min-w-0 pr-2">
                            <p className="text-xs font-semibold text-slate-900 truncate">{req.title}</p>
                            <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                              <span>Requester: {req.requesterName} •</span>
                              <a
                                href={getGoogleMapsUrl(req.location, req.coordinates)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="hover:text-blue-600 hover:underline truncate"
                                title="Open in Google Maps"
                              >
                                📍 {req.location}
                              </a>
                              <span>• 📅 {req.date} {req.startTime}</span>
                            </p>
                            {req.selectedHelperName && (
                              <p className="text-[10px] text-indigo-600 font-medium mt-0.5">
                                Assigned to: {req.selectedHelperName}
                              </p>
                            )}
                          </div>
                          <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0", getStatusBadge(req.status))}>
                            {req.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button
                    size="sm"
                    onClick={() => setViewingDept(null)}
                    className="h-8 px-4 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs cursor-pointer"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* MODAL: CREATE NEW TASK / REQUEST */}
        {createTaskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 text-slate-900 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Create Help Task</h3>
                    <p className="text-[11px] text-slate-500">Post a new task directly from the Admin console</p>
                  </div>
                </div>
                <button
                  onClick={() => setCreateTaskModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-3.5">
                {/* Requester Selection */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Requester (Citizen / Community)</label>
                  <select
                    value={taskRequesterId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTaskRequesterId(val);
                      if (val === 'admin') {
                        setTaskLocation(profile?.area || 'Neighborhood Hub');
                        setTaskCoordinates(profile?.coordinates || null);
                      } else {
                        const citizen = citizensList.find(c => c.uid === val);
                        if (citizen?.area) {
                          setTaskLocation(citizen.area);
                        }
                        if (citizen?.coordinates) {
                          setTaskCoordinates(citizen.coordinates);
                        }
                      }
                    }}
                    className="w-full h-9 rounded-xl bg-white border border-slate-200 text-xs px-3 focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="admin">Platform Admin / Community Desk</option>
                    {citizensList.map(c => (
                      <option key={c.uid} value={c.uid}>
                        {c.fullName || 'Citizen'} ({c.email || c.phone || 'No Contact'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Department & Priority */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                      <span>Department</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <select
                      required
                      value={taskCategory}
                      onChange={(e) => setTaskCategory(e.target.value)}
                      className="w-full h-9 rounded-xl bg-white border border-slate-200 text-xs px-3 focus:outline-none focus:border-blue-600 cursor-pointer"
                    >
                      {availableCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                      <span>Priority Level</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <select
                      required
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value as HelpPriority)}
                      className="w-full h-9 rounded-xl bg-white border border-slate-200 text-xs px-3 focus:outline-none focus:border-blue-600 cursor-pointer"
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent (SLA Priority)</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                    <span>Task Title</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. Water leak repair at community library"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                    <span>Description</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Provide details about what needs to be done..."
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    className="w-full rounded-xl bg-white border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 resize-none"
                  />
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                      <span>Scheduled Date</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <Input
                      type="date"
                      required
                      value={taskDate}
                      onChange={(e) => setTaskDate(e.target.value)}
                      className="h-9 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                      <span>Scheduled Time</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <Input
                      type="time"
                      required
                      value={taskTime}
                      onChange={(e) => setTaskTime(e.target.value)}
                      className="h-9 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Location with LocationPicker (GPS Detect + Map) */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Location / Neighborhood Area (Detect GPS or Select on Map)</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <LocationPicker 
                    defaultLocation={taskLocation}
                    initialCoordinates={taskCoordinates}
                    onLocationSelect={(addr, coords) => {
                      setTaskLocation(addr);
                      if (coords) {
                        setTaskCoordinates(coords);
                      }
                    }} 
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setCreateTaskModalOpen(false)} className="h-8 text-xs cursor-pointer">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSavingTask}
                    className="h-8 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer"
                  >
                    {isSavingTask ? 'Publishing...' : 'Publish Task'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: EDIT TASK */}
        {editingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 text-slate-900 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Edit Task</h3>
                    <p className="text-[11px] text-slate-500">Update request parameters and scheduling</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingTask(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateTask} className="space-y-3.5">
                {/* Department, Status, Priority */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Department <span className="text-rose-500 font-bold">*</span></label>
                    <select
                      value={editTaskCategory}
                      onChange={(e) => setEditTaskCategory(e.target.value)}
                      className="w-full h-9 rounded-xl bg-white border border-slate-200 text-xs px-2.5 focus:outline-none focus:border-blue-600 cursor-pointer"
                    >
                      {availableCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Status <span className="text-rose-500 font-bold">*</span></label>
                    <select
                      value={editTaskStatus}
                      onChange={(e) => setEditTaskStatus(e.target.value as HelpStatus)}
                      className="w-full h-9 rounded-xl bg-white border border-slate-200 text-xs px-2.5 focus:outline-none focus:border-blue-600 cursor-pointer font-semibold"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Priority <span className="text-rose-500 font-bold">*</span></label>
                    <select
                      value={editTaskPriority}
                      onChange={(e) => setEditTaskPriority(e.target.value as HelpPriority)}
                      className="w-full h-9 rounded-xl bg-white border border-slate-200 text-xs px-2.5 focus:outline-none focus:border-blue-600 cursor-pointer"
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Task Title <span className="text-rose-500 font-bold">*</span></label>
                  <Input
                    type="text"
                    required
                    value={editTaskTitle}
                    onChange={(e) => setEditTaskTitle(e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Description <span className="text-rose-500 font-bold">*</span></label>
                  <textarea
                    rows={3}
                    required
                    value={editTaskDesc}
                    onChange={(e) => setEditTaskDesc(e.target.value)}
                    className="w-full rounded-xl bg-white border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 resize-none"
                  />
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Date <span className="text-rose-500 font-bold">*</span></label>
                    <Input
                      type="date"
                      required
                      value={editTaskDate}
                      onChange={(e) => setEditTaskDate(e.target.value)}
                      className="h-9 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Time <span className="text-rose-500 font-bold">*</span></label>
                    <Input
                      type="time"
                      required
                      value={editTaskTime}
                      onChange={(e) => setEditTaskTime(e.target.value)}
                      className="h-9 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Location with LocationPicker (GPS Detect + Map) */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Location / Neighborhood Area</span>
                    </span>
                    <span className="text-rose-500 font-bold text-xs">* Required</span>
                  </label>
                  <LocationPicker 
                    defaultLocation={editTaskLocation}
                    initialCoordinates={editTaskCoordinates}
                    onLocationSelect={(addr, coords) => {
                      setEditTaskLocation(addr);
                      if (coords) {
                        setEditTaskCoordinates(coords);
                      }
                    }} 
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setEditingTask(null)} className="h-8 text-xs cursor-pointer">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isUpdatingTask}
                    className="h-8 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer"
                  >
                    {isUpdatingTask ? 'Saving...' : 'Update Task'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: VIEW TASK DETAILS */}
        {viewingTask && (() => {
          const reqUser = usersList.find(u => u.uid === viewingTask.requesterId);
          const assignedEmp = viewingTask.selectedHelperId 
            ? usersList.find(u => u.uid === viewingTask.selectedHelperId)
            : null;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 text-slate-900 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold border", getCategoryBadge(viewingTask.categoryId))}>
                        {viewingTask.categoryId}
                      </span>
                      {viewingTask.priority && viewingTask.priority !== 'NORMAL' && (
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase",
                          viewingTask.priority === 'URGENT' ? "bg-rose-50 text-rose-700 border border-rose-200" :
                          viewingTask.priority === 'HIGH' ? "bg-amber-50 text-amber-700 border border-amber-200" :
                          "bg-slate-50 text-slate-600"
                        )}>
                          {viewingTask.priority}
                        </span>
                      )}
                      <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-semibold", getStatusBadge(viewingTask.status))}>
                        {viewingTask.status}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-1">{viewingTask.title}</h3>
                  </div>
                  <button
                    onClick={() => setViewingTask(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Description */}
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Description</span>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{viewingTask.description}</p>
                </div>

                {/* Requester & Specialist Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Requester */}
                  <div className="p-3 bg-white border border-slate-200/80 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                      <UserIcon className="w-3 h-3 text-blue-600" />
                      Requester Details
                    </span>
                    <p className="text-xs font-bold text-slate-900">{viewingTask.requesterName}</p>
                    <p className="text-[11px] text-slate-500">
                      📞 {reqUser?.phone || 'No phone recorded'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      ✉️ {reqUser?.email || 'N/A'}
                    </p>
                  </div>

                  {/* Specialist / Helper */}
                  <div className="p-3 bg-white border border-slate-200/80 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-indigo-600" />
                      Assigned Specialist
                    </span>
                    {viewingTask.selectedHelperName ? (
                      <>
                        <p className="text-xs font-bold text-indigo-900">{viewingTask.selectedHelperName}</p>
                        <p className="text-[11px] text-slate-500">
                          📞 {assignedEmp?.phone || 'Specialist on duty'}
                        </p>
                        {viewingTask.completionCode && (
                          <div className="pt-1 flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500 font-semibold">Handshake Code:</span>
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-mono font-bold text-xs rounded border border-indigo-200">
                              {viewingTask.completionCode}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-400 italic">No technician assigned yet.</p>
                        {viewingTask.status === 'OPEN' && (
                          <span className="inline-block text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            Ready for direct dispatch
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Schedule & Location */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Schedule</span>
                    <p className="text-slate-800 font-semibold flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{viewingTask.date} at {viewingTask.startTime}</span>
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</span>
                      <a
                        href={getGoogleMapsUrl(viewingTask.location, viewingTask.coordinates)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 hover:underline"
                        title="Open exact location in Google Maps"
                      >
                        <span>Open in Maps</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                    <a
                      href={getGoogleMapsUrl(viewingTask.location, viewingTask.coordinates)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-800 font-semibold flex items-start gap-1.5 hover:text-blue-600 transition-colors group cursor-pointer"
                      title="Click to open in Google Maps"
                    >
                      <MapPin className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0 mt-0.5" />
                      <span className="break-words leading-relaxed select-text">{viewingTask.location || 'Local community'}</span>
                    </a>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 font-mono">
                  <span>Created: {viewingTask.createdAt ? new Date(viewingTask.createdAt).toLocaleDateString() : 'N/A'}</span>
                  <span>Updated: {viewingTask.updatedAt ? new Date(viewingTask.updatedAt).toLocaleDateString() : 'N/A'}</span>
                </div>

                {/* Footer Action Bar */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTask(viewingTask)}
                    className="h-8 px-3 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Task</span>
                  </Button>

                  <div className="flex items-center gap-2">
                    {viewingTask.status === 'OPEN' && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setDispatchModalReq(viewingTask);
                          setTargetEmployeeUid('');
                          setViewingTask(null);
                        }}
                        className="h-8 px-3 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <Send className="w-3 h-3" />
                        <span>Dispatch</span>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => {
                        handleStartEditTask(viewingTask);
                        setViewingTask(null);
                      }}
                      className="h-8 px-3 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Edit Task</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewingTask(null)}
                      className="h-8 px-3 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl cursor-pointer"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
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
