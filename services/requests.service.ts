import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase/client';
import { HelpRequest } from '../types';

export const subscribeOpenRequests = (
  callback: (requests: HelpRequest[]) => void,
  onError?: (error: any) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'helpRequests'),
    where('status', '==', 'OPEN')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpRequest));
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(items);
    },
    (err) => {
      console.warn('Error subscribing to open requests:', err);
      if (onError) onError(err);
    }
  );
};

export const subscribeMyRequests = (
  userId: string,
  callback: (requests: HelpRequest[]) => void,
  onError?: (error: any) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'helpRequests'),
    where('requesterId', '==', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpRequest));
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(items);
    },
    (err) => {
      console.warn('Error subscribing to my requests:', err);
      if (onError) onError(err);
    }
  );
};

export const getRequestById = async (id: string): Promise<HelpRequest | null> => {
  const snap = await getDoc(doc(db, 'helpRequests', id));
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as HelpRequest;
  }
  return null;
};

export const createHelpRequest = async (requestData: Omit<HelpRequest, 'id'>): Promise<string> => {
  const ref = doc(collection(db, 'helpRequests'));
  await setDoc(ref, requestData);
  return ref.id;
};

export const updateHelpRequest = async (id: string, updates: Partial<HelpRequest>): Promise<void> => {
  await updateDoc(doc(db, 'helpRequests', id), {
    ...updates,
    updatedAt: new Date().toISOString()
  });
};

export const deleteHelpRequest = async (requestId: string): Promise<void> => {
  // 1. Delete request
  await deleteDoc(doc(db, 'helpRequests', requestId));

  // 2. Delete related offers
  const offersSnap = await getDocs(query(collection(db, 'helpOffers'), where('requestId', '==', requestId)));
  for (const d of offersSnap.docs) {
    await deleteDoc(d.ref);
  }

  // 3. Delete related tasks
  const tasksSnap = await getDocs(query(collection(db, 'helpTasks'), where('requestId', '==', requestId)));
  for (const d of tasksSnap.docs) {
    await deleteDoc(d.ref);
  }
};
