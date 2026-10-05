import { 
  collection, 
  doc, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  updateDoc,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase/client';
import { HelpOffer, HelpRequest } from '../types';

export const subscribeOffersByRequest = (
  requestId: string,
  callback: (offers: HelpOffer[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'helpOffers'),
    where('requestId', '==', requestId)
  );

  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpOffer));
    callback(data);
  });
};

export const subscribeMyOffers = (
  userId: string,
  callback: (offers: HelpOffer[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'helpOffers'),
    where('helperId', '==', userId)
  );

  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpOffer));
    callback(data);
  });
};

export const sendHelpOffer = async (params: {
  requestId: string;
  requestTitle: string;
  requesterId: string;
  helperId: string;
  helperName: string;
  message: string;
  currentRequestStatus: string;
}): Promise<void> => {
  const offerRef = doc(collection(db, 'helpOffers'));
  await setDoc(offerRef, {
    requestId: params.requestId,
    helperId: params.helperId,
    helperName: params.helperName,
    message: params.message.trim() || 'I would like to volunteer and help with this request!',
    status: 'PENDING',
    createdAt: new Date().toISOString()
  });

  if (params.currentRequestStatus === 'OPEN') {
    await updateDoc(doc(db, 'helpRequests', params.requestId), {
      status: 'OFFER_RECEIVED'
    });
  }

  // Notify requester
  const notificationRef = doc(collection(db, 'notifications'));
  await setDoc(notificationRef, {
    userId: params.requesterId,
    title: 'New Help Offer! 🤝',
    message: `${params.helperName} offered to help with "${params.requestTitle}".`,
    read: false,
    type: 'OFFER_RECEIVED',
    relatedId: params.requestId,
    createdAt: new Date().toISOString()
  });
};

export const acceptHelpOffer = async (
  request: HelpRequest,
  selectedOffer: HelpOffer,
  allOffers: HelpOffer[]
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
    if (currentData.status === 'IN_PROGRESS' || currentData.status === 'COMPLETED' || currentData.status === 'CANCELLED') {
      throw new Error('This request has already been assigned or closed.');
    }

    const generatedCode = Math.floor(1000 + Math.random() * 9000).toString();

    // 1. Mark selected offer as ACCEPTED
    if (selectedOffer.id) {
      transaction.update(doc(db, 'helpOffers', selectedOffer.id), {
        status: 'ACCEPTED'
      });
    }

    // 2. Mark other pending offers as REJECTED
    const otherPending = allOffers.filter(o => o.id !== selectedOffer.id && o.status === 'PENDING');
    for (const o of otherPending) {
      if (o.id) {
        transaction.update(doc(db, 'helpOffers', o.id), {
          status: 'REJECTED'
        });
      }
    }

    // 3. Update helpRequests
    transaction.update(requestRef, {
      status: 'IN_PROGRESS',
      selectedHelperId: selectedOffer.helperId,
      selectedHelperName: selectedOffer.helperName,
      completionCode: generatedCode,
      updatedAt: new Date().toISOString()
    });

    // 4. Create in helpTasks
    const taskRef = doc(collection(db, 'helpTasks'));
    transaction.set(taskRef, {
      requestId: request.id,
      requesterId: currentData.requesterId || request.requesterId || '',
      requesterName: currentData.requesterName || request.requesterName || 'Resident',
      helperId: selectedOffer.helperId,
      helperName: selectedOffer.helperName,
      title: currentData.title || request.title || '',
      description: currentData.description || request.description || '',
      category: currentData.categoryId || request.categoryId || 'General',
      priority: currentData.priority || request.priority || 'NORMAL',
      scheduledDate: currentData.date || request.date || '',
      scheduledTime: currentData.startTime || request.startTime || '',
      location: currentData.location || request.location || '',
      status: 'IN_PROGRESS',
      completionCode: generatedCode,
      createdAt: new Date().toISOString()
    });

    // 5. Notify volunteer
    const notifRef = doc(collection(db, 'notifications'));
    transaction.set(notifRef, {
      userId: selectedOffer.helperId,
      title: 'Offer Accepted! 🚀',
      message: `Your volunteer offer for "${currentData.title}" was accepted! Handshake code generated.`,
      read: false,
      type: 'OFFER_ACCEPTED',
      relatedId: request.id,
      createdAt: new Date().toISOString()
    });

    return generatedCode;
  });
};
