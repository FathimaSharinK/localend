import { doc, updateDoc, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase/client';
import { HelpRequest } from '@/types';

/**
 * Calculates remaining time until the scheduled request time in minutes.
 * Returns negative numbers if already past deadline.
 */
export function getMinutesUntilDeadline(dateStr: string, timeStr: string): number | null {
  if (!dateStr) return null;

  try {
    let year: number, month: number, day: number;
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-').map(Number);
      if (parts[0] > 1000) {
        // YYYY-MM-DD
        [year, month, day] = parts;
      } else {
        // DD-MM-YYYY
        [day, month, year] = parts;
      }
    } else {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      year = d.getFullYear();
      month = d.getMonth() + 1;
      day = d.getDate();
    }

    if (!year || !month || !day) return null;

    let targetDate = new Date(year, month - 1, day);

    if (timeStr && timeStr.includes(':')) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        targetDate.setHours(hours, minutes, 0, 0);
      }
    } else {
      // Default to end of scheduled day if time not specified
      targetDate.setHours(23, 59, 59, 0);
    }

    const diffMs = targetDate.getTime() - Date.now();
    return Math.floor(diffMs / (1000 * 60));
  } catch (e) {
    return null;
  }
}

/**
 * Checks if a request is nearing deadline with 0 assigned helpers and marks it escalated.
 * Notifies all specialists in that specific department and platform administrators.
 */
export async function evaluateAndEscalateRequest(req: HelpRequest, adminUid?: string): Promise<boolean> {
  if (req.status !== 'OPEN' || req.isEscalated || !req.id) return false;

  const minutesLeft = getMinutesUntilDeadline(req.date, req.startTime);
  if (minutesLeft === null) return false;

  // Escalate if within 50 minutes, already overdue, or marked URGENT
  if (minutesLeft <= 50 || req.priority === 'URGENT') {
    try {
      await updateDoc(doc(db, 'helpRequests', req.id), {
        isEscalated: true,
        escalatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const deadlineText = minutesLeft <= 0 ? 'OVERDUE' : `in ${minutesLeft} mins`;

      // 1. Fetch department employees & admins to notify them directly
      const usersSnap = await getDocs(collection(db, 'users'));
      const targetUserIds: { uid: string; isEmployee: boolean }[] = [];
      const recipientEmails: string[] = [];

      usersSnap.forEach((userDoc) => {
        const u = userDoc.data();
        const uid = userDoc.id;
        
        // Match employees of this specific department
        if (u.role === 'employee' && u.department && req.categoryId && 
            u.department.trim().toLowerCase() === req.categoryId.trim().toLowerCase()) {
          targetUserIds.push({ uid, isEmployee: true });
          if (u.email) recipientEmails.push(u.email);
        }
        
        // Match admins
        if (u.role === 'admin' || u.email?.toLowerCase() === 'admin@gmail.com') {
          targetUserIds.push({ uid, isEmployee: false });
          if (u.email) recipientEmails.push(u.email);
        }
      });

      // If specific adminUid was provided, ensure it's included
      if (adminUid && !targetUserIds.some(t => t.uid === adminUid)) {
        targetUserIds.push({ uid: adminUid, isEmployee: false });
      }

      // 2. Dispatch in-app notifications to all relevant recipients
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
          createdAt: new Date().toISOString()
        });
      }

      // 3. Dispatch Email Alert via Next.js API / Nodemailer
      try {
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: req.id,
            taskTitle: req.title,
            category: req.categoryId,
            location: req.location,
            deadlineText,
            priority: req.priority,
            recipientEmails
          })
        }).catch(emailErr => {
          console.warn('Email dispatch warning (SMTP might not be configured):', emailErr);
        });
      } catch (err) {
        console.warn('Email fetch trigger error:', err);
      }

      return true;
    } catch (err) {
      console.warn('Failed to escalate request:', err);
    }
  }

  return false;
}

