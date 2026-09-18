import { 
  collection, 
  doc, 
  getDoc, 
  onSnapshot, 
  updateDoc,
  Unsubscribe 
} from 'firebase/firestore';
import { db } from '../lib/firebase/client';
import { UserData } from '../types';

export const getUserProfile = async (uid: string): Promise<UserData | null> => {
  const snap = await getDoc(doc(db, 'users', uid));
  if (snap.exists()) {
    return { uid: snap.id, ...snap.data() } as UserData;
  }
  return null;
};

export const updateUserProfile = async (uid: string, data: Partial<UserData>): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), {
    ...data,
    updatedAt: new Date().toISOString()
  });
};

export const subscribeAllUsers = (
  callback: (users: UserData[]) => void
): Unsubscribe => {
  return onSnapshot(collection(db, 'users'), (snapshot) => {
    const items = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserData));
    callback(items);
  });
};

export const updateUserRole = async (uid: string, role: 'admin' | 'user'): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), {
    role,
    updatedAt: new Date().toISOString()
  });
};
