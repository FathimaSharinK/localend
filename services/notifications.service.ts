import { 
  collection, 
  doc, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase/client';
import { AppNotification } from '../types';

export const subscribeUserNotifications = (
  userId: string,
  callback: (notifications: AppNotification[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId)
  );

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(items);
  });
};

export const markNotificationAsRead = async (id: string): Promise<void> => {
  await updateDoc(doc(db, 'notifications', id), { read: true });
};

export const deleteNotification = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'notifications', id));
};

export const sendNotification = async (params: {
  userId: string;
  title: string;
  message: string;
  type: AppNotification['type'];
  relatedId?: string;
}): Promise<void> => {
  const ref = doc(collection(db, 'notifications'));
  await setDoc(ref, {
    ...params,
    read: false,
    createdAt: new Date().toISOString()
  });
};
