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

  // SLA Escalation is deadline-driven:
  // - URGENT priority tasks escalate within 120 minutes (2 hrs) of deadline or overdue
  // - Standard tasks escalate within 50 minutes of deadline or overdue
  // Future tasks (e.g. tomorrow or hours away) do NOT falsely trigger SLA breach
  const thresholdMins = req.priority === 'URGENT' ? 120 : 50;
  if (minutesLeft <= thresholdMins) {
    try {
      await updateDoc(doc(db, 'helpRequests', req.id), {
        isEscalated: true,
        escalatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const deadlineText = minutesLeft <= 0 ? 'OVERDUE' : `in ${minutesLeft} mins`;

      // 1. Fetch department employees & admins to notify them directly, and resolve citizen info
      const usersSnap = await getDocs(collection(db, 'users'));
      const targetUserIds: { uid: string; isEmployee: boolean }[] = [];
      const recipientEmails: string[] = [];
      let requesterUser: {
        fullName?: string;
        email?: string;
        phone?: string;
        area?: string;
      } = {
        fullName: req.requesterName
      };

      usersSnap.forEach((userDoc) => {
        const u = userDoc.data();
        const uid = userDoc.id;

        // Match citizen requester
        if (uid === req.requesterId) {
          requesterUser = {
            fullName: u.fullName || req.requesterName,
            email: u.email,
            phone: u.phone,
            area: u.area || req.location
          };
        }
        
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

      // 3. Dispatch Email Alert with rich citizen user information and alert nature
      try {
        const alertReason = minutesLeft !== null && minutesLeft <= 0
          ? `This ${req.categoryId || ''} task is OVERDUE by ${Math.abs(minutesLeft)} minutes with 0 confirmed specialists or volunteers assigned.`
          : `This ${req.categoryId || ''} task is within ${minutesLeft ?? 50} minutes of its scheduled deadline (${deadlineText}) with 0 confirmed specialists or volunteers. Direct dispatch or mission claim is required.`;

        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alertNature: req.priority === 'URGENT' ? 'URGENT_UNASSIGNED' : 'SLA_BREACH',
            alertTitle: req.priority === 'URGENT'
              ? `⚡ Urgent ${req.categoryId || 'Emergency'} Request: ${req.title}`
              : `🚨 Critical SLA Breach Alert: ${req.title}`,
            alertReason,
            alertSeverity: 'CRITICAL',
            taskId: req.id,
            taskTitle: req.title,
            taskDescription: req.description,
            category: req.categoryId,
            location: req.location,
            coordinates: req.coordinates,
            scheduledDate: req.date,
            scheduledTime: req.startTime,
            deadlineText,
            priority: req.priority,
            status: req.status,
            requesterId: req.requesterId,
            requesterName: requesterUser.fullName || req.requesterName,
            requesterEmail: requesterUser.email,
            requesterPhone: requesterUser.phone,
            requesterArea: requesterUser.area || req.location,
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

