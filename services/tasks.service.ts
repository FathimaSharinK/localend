import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  updateDoc,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase/client';
import { HelpRequest, HelpTask } from '../types';

export const subscribeMyHelpingTasks = (
  userId: string,
  callback: (tasks: HelpTask[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'helpTasks'),
    where('helperId', '==', userId)
  );

  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpTask));
    callback(data);
  });
};

export const subscribeAllTasks = (
  callback: (tasks: HelpTask[]) => void
): Unsubscribe => {
  return onSnapshot(collection(db, 'helpTasks'), (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpTask));
    callback(data);
  });
};

export const directAcceptTask = async (
  request: HelpRequest,
  helper: { uid: string; fullName: string }
): Promise<string> => {
  if (!request.id) throw new Error('Request ID is required');

  const { runTransaction } = await import('firebase/firestore');

  return await runTransaction(db, async (transaction) => {
    const requestRef = doc(db, 'helpRequests', request.id!);
    const requestSnap = await transaction.get(requestRef);

    if (!requestSnap.exists()) {
      throw new Error('This request no longer exists.');
    }

    const currentData = requestSnap.data() as HelpRequest;
    if (currentData.status !== 'OPEN' && currentData.status !== 'OFFER_RECEIVED') {
      throw new Error('This request has already been assigned to another neighbor or is no longer open.');
    }

    const generatedCode = Math.floor(1000 + Math.random() * 9000).toString();

    // 1. Update helpRequests
    transaction.update(requestRef, {
      status: 'IN_PROGRESS',
      selectedHelperId: helper.uid,
      selectedHelperName: helper.fullName,
      completionCode: generatedCode,
      updatedAt: new Date().toISOString()
    });

    // 2. Create helpTasks
    const taskRef = doc(collection(db, 'helpTasks'));
    transaction.set(taskRef, {
      requestId: request.id,
      requesterId: currentData.requesterId,
      requesterName: currentData.requesterName,
      helperId: helper.uid,
      helperName: helper.fullName,
      title: currentData.title,
      scheduledDate: currentData.date,
      scheduledTime: currentData.startTime,
      location: currentData.location,
      status: 'IN_PROGRESS',
      completionCode: generatedCode,
      createdAt: new Date().toISOString()
    });

    // 3. Notify requester
    const notifRef = doc(collection(db, 'notifications'));
    transaction.set(notifRef, {
      userId: currentData.requesterId,
      title: 'Task Accepted by Neighbor! 🚀',
      message: `${helper.fullName} accepted your request "${currentData.title}"! Handshake code generated.`,
      read: false,
      type: 'OFFER_ACCEPTED',
      relatedId: request.id,
      createdAt: new Date().toISOString()
    });

    return generatedCode;
  });
};

export const verifyHandshakeCode = async (
  requestId: string,
  inputCode: string,
  correctCode: string,
  requesterId: string,
  taskTitle: string,
  helperName: string
): Promise<{ success: boolean; error?: string }> => {
  if (inputCode.trim() !== correctCode.trim()) {
    return { success: false, error: 'Invalid code! Enter the 4-digit code provided by the requester.' };
  }

  const { runTransaction } = await import('firebase/firestore');

  try {
    return await runTransaction(db, async (transaction) => {
      const requestRef = doc(db, 'helpRequests', requestId);
      const requestSnap = await transaction.get(requestRef);

      if (!requestSnap.exists()) {
        return { success: false, error: 'Request no longer exists.' };
      }

      const reqData = requestSnap.data() as HelpRequest;
      if (reqData.status === 'COMPLETED') {
        return { success: false, error: 'This task has already been marked as completed.' };
      }

      if (reqData.completionCode && reqData.completionCode.trim() !== inputCode.trim()) {
        return { success: false, error: 'Verification code mismatch.' };
      }

      // Update request
      transaction.update(requestRef, {
        status: 'COMPLETED',
        updatedAt: new Date().toISOString()
      });

      // Update related tasks
      const tasksSnap = await getDocs(query(collection(db, 'helpTasks'), where('requestId', '==', requestId)));
      for (const d of tasksSnap.docs) {
        transaction.update(d.ref, { status: 'COMPLETED' });
      }

      // Notify requester
      const notifRef = doc(collection(db, 'notifications'));
      transaction.set(notifRef, {
        userId: requesterId,
        title: 'Handshake Verified & Completed! 🤝',
        message: `${helperName} entered your 4-digit completion code for "${taskTitle}".`,
        read: false,
        type: 'TASK_COMPLETED',
        relatedId: requestId,
        createdAt: new Date().toISOString()
      });

      return { success: true };
    });
  } catch (err: any) {
    return { success: false, error: err?.message || 'Handshake verification failed.' };
  }
};

export const completeByRequester = async (
  requestId: string,
  helperId?: string,
  requesterName?: string,
  taskTitle?: string
): Promise<void> => {
  await updateDoc(doc(db, 'helpRequests', requestId), {
    status: 'COMPLETED',
    updatedAt: new Date().toISOString()
  });

  const tasksSnap = await getDocs(query(collection(db, 'helpTasks'), where('requestId', '==', requestId)));
  for (const d of tasksSnap.docs) {
    await updateDoc(d.ref, { status: 'COMPLETED' });
  }

  if (helperId) {
    const notifRef = doc(collection(db, 'notifications'));
    await setDoc(notifRef, {
      userId: helperId,
      title: 'Mission Completed! 🎉',
      message: `${requesterName || 'The requester'} verified and closed "${taskTitle || 'the task'}". Great work!`,
      read: false,
      type: 'TASK_COMPLETED',
      relatedId: requestId,
      createdAt: new Date().toISOString()
    });
  }
};
