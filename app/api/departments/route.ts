import { NextResponse } from 'next/server';
import { collection, getDocs } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '@/lib/firebase/client';
import { DepartmentItem } from '@/types';
import { DEFAULT_DEPARTMENTS } from '@/services/departments.service';

export const dynamic = 'force-dynamic';

async function ensureAuthenticated() {
  if (auth.currentUser) return;
  const cronEmail = "system_cron@localend.app";
  const cronPass = "CronLocalendSecret123!";
  try {
    await signInWithEmailAndPassword(auth, cronEmail, cronPass);
  } catch (e: any) {
    try {
      await createUserWithEmailAndPassword(auth, cronEmail, cronPass);
    } catch (err: any) {
      console.warn('⚠️ [API Departments] Auth error:', err.message);
    }
  }
}

export async function GET() {
  try {
    await ensureAuthenticated();
    const snap = await getDocs(collection(db, 'departments'));
    
    if (snap.empty) {
      return NextResponse.json({ success: true, departments: DEFAULT_DEPARTMENTS });
    }

    const items: DepartmentItem[] = [];
    snap.forEach((d) => {
      items.push({ id: d.id, ...d.data() } as DepartmentItem);
    });

    items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return NextResponse.json({ success: true, departments: items });
  } catch (error: any) {
    console.error('❌ Error fetching departments in API:', error);
    return NextResponse.json({ success: true, departments: DEFAULT_DEPARTMENTS });
  }
}
