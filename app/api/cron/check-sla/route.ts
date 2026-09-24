import { NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, addDoc, query, where } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '@/lib/firebase/client';
import { getMinutesUntilDeadline } from '@/lib/slaEscalation';
import { sendSlaAlertEmail } from '@/lib/emailService';
import { HelpRequest } from '@/types';

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
      console.warn('⚠️ [Cron Auth] Error authenticating background runner:', err.message);
    }
  }
}

async function performSlaCheck() {
  const timestamp = new Date().toISOString();
  console.log(`[Cron SLA Check] Running at ${timestamp}`);

  try {
    // 0. Ensure Firebase Auth session exists so Firestore rules allow read/write
    await ensureAuthenticated();

    // 1. Fetch all OPEN requests from Firestore
    const requestsQuery = query(
      collection(db, 'helpRequests'),
      where('status', '==', 'OPEN')
    );
    const requestsSnap = await getDocs(requestsQuery);

    const openRequests: HelpRequest[] = [];
    requestsSnap.forEach((d) => {
      openRequests.push({ id: d.id, ...d.data() } as HelpRequest);
    });

    console.log(`[Cron SLA Check] Found ${openRequests.length} OPEN requests in Firestore.`);

    // 2. Fetch users to identify department specialists and administrators
    const usersSnap = await getDocs(collection(db, 'users'));
    const allUsers: { uid: string; email?: string; role?: string; department?: string }[] = [];
    usersSnap.forEach((uDoc) => {
      const data = uDoc.data();
      allUsers.push({
        uid: uDoc.id,
        email: data.email,
        role: data.role,
        department: data.department
      });
    });

    const escalatedTasks: {
      id: string;
      title: string;
      category: string;
      minutesLeft: number | null;
      priority: string;
      recipients: string[];
    }[] = [];

    // 3. Evaluate each unescalated open request
    for (const req of openRequests) {
      if (req.isEscalated || !req.id) continue;

      const minutesLeft = getMinutesUntilDeadline(req.date, req.startTime);
      const isUrgent = req.priority === 'URGENT';
      const isNearDeadline = minutesLeft !== null && minutesLeft <= 50;

      console.log(`[Cron] Checking "${req.title}" (ID: ${req.id}) | minutesLeft: ${minutesLeft} | isUrgent: ${isUrgent} | isNearDeadline: ${isNearDeadline}`);

      if (isNearDeadline || isUrgent) {
        console.log(`🚨 [Cron] Escalating request "${req.title}" (ID: ${req.id}) - Minutes left: ${minutesLeft}`);

        // A. Mark as escalated in Firestore immediately
        await updateDoc(doc(db, 'helpRequests', req.id), {
          isEscalated: true,
          escalatedAt: timestamp,
          updatedAt: timestamp
        });

        const deadlineText = minutesLeft === null ? 'URGENT PRIORITY' : minutesLeft <= 0 ? 'OVERDUE' : `in ${minutesLeft} mins`;

        // B. Target relevant users (Admins & Department Employees)
        const targetUserIds: { uid: string; isEmployee: boolean }[] = [];
        const recipientEmails: string[] = [];

        for (const u of allUsers) {
          // Match employees of this specific department
          if (
            u.role === 'employee' &&
            u.department &&
            req.categoryId &&
            u.department.trim().toLowerCase() === req.categoryId.trim().toLowerCase()
          ) {
            targetUserIds.push({ uid: u.uid, isEmployee: true });
            if (u.email && !recipientEmails.includes(u.email)) recipientEmails.push(u.email);
          }

          // Match admins
          if (u.role === 'admin' || u.email?.toLowerCase() === 'admin@gmail.com') {
            targetUserIds.push({ uid: u.uid, isEmployee: false });
            if (u.email && !recipientEmails.includes(u.email)) recipientEmails.push(u.email);
          }
        }

        // C. Dispatch in-app notifications
        for (const target of targetUserIds) {
          const notifTitle = target.isEmployee
            ? `🚨 Urgent ${req.categoryId} Task Alert!`
            : `🚨 SLA Escalation Alert: Unattended ${req.categoryId} Request!`;

          const notifMessage = target.isEmployee
            ? `Emergency! Pending request "${req.title}" in ${req.categoryId} needs immediate resolution. Deadline is ${deadlineText}. Claim mission now!`
            : `Urgent! ${req.categoryId} request "${req.title}" has no volunteers and deadline is ${deadlineText}. Manual dispatch required!`;

          await addDoc(collection(db, 'notifications'), {
            userId: target.uid,
            title: notifTitle,
            message: notifMessage,
            read: false,
            type: 'SLA_BREACH',
            relatedId: req.id,
            createdAt: timestamp
          });
        }

        // D. Dispatch Nodemailer Email directly
        await sendSlaAlertEmail({
          taskId: req.id,
          taskTitle: req.title,
          category: req.categoryId,
          location: req.location,
          deadlineText,
          priority: req.priority,
          recipientEmails
        });

        escalatedTasks.push({
          id: req.id,
          title: req.title,
          category: req.categoryId,
          minutesLeft,
          priority: req.priority,
          recipients: recipientEmails
        });
      }
    }

    return {
      success: true,
      timestamp,
      checkedCount: openRequests.length,
      escalatedCount: escalatedTasks.length,
      escalatedTasks,
      message: `Checked ${openRequests.length} open tasks. Escalated ${escalatedTasks.length} tasks.`
    };
  } catch (error: any) {
    console.error('❌ [Cron] Error during SLA evaluation:', error);
    return {
      success: false,
      timestamp,
      error: error.message || 'SLA Check failed',
      checkedCount: 0,
      escalatedCount: 0,
      escalatedTasks: []
    };
  }
}

export async function GET(req: Request) {
  const result = await performSlaCheck();
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const result = await performSlaCheck();
  return NextResponse.json(result);
}
