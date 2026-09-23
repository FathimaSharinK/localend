import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs,
  Unsubscribe 
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { DepartmentItem } from '@/types';

export const COMMON_DEPARTMENT_ICONS = ['🛠️', '🩺', '🛒', '⚡', '🔧', '🪚', '🧹', '🚗', '🎨', '🌱', '📚', '🍳', '🛡️', '💻', '📦', '🚨'];

export function getAutoIconForDepartment(name: string): string {
  const n = (name || '').toLowerCase().trim();
  if (n.includes('medic') || n.includes('doctor') || n.includes('health') || n.includes('nurse') || n.includes('pharm')) return '🩺';
  if (n.includes('groc') || n.includes('food') || n.includes('market') || n.includes('ration') || n.includes('eat')) return '🛒';
  if (n.includes('elect') || n.includes('wire') || n.includes('power') || n.includes('volt') || n.includes('light')) return '⚡';
  if (n.includes('plumb') || n.includes('water') || n.includes('pipe') || n.includes('leak') || n.includes('drain')) return '🔧';
  if (n.includes('carp') || n.includes('wood') || n.includes('furnitur')) return '🪚';
  if (n.includes('clean') || n.includes('wash') || n.includes('sweep') || n.includes('waste') || n.includes('maid')) return '🧹';
  if (n.includes('car') || n.includes('vehic') || n.includes('drive') || n.includes('auto') || n.includes('bike') || n.includes('transit') || n.includes('transp')) return '🚗';
  if (n.includes('paint')) return '🎨';
  if (n.includes('garden') || n.includes('plant') || n.includes('farm') || n.includes('tree')) return '🌱';
  if (n.includes('teach') || n.includes('tutor') || n.includes('book') || n.includes('educat') || n.includes('school')) return '📚';
  if (n.includes('cook') || n.includes('chef') || n.includes('kitchen')) return '🍳';
  if (n.includes('secur') || n.includes('guard')) return '🛡️';
  if (n.includes('tech') || n.includes('comput') || n.includes('it') || n.includes('phone') || n.includes('laptop')) return '💻';
  if (n.includes('pack') || n.includes('deliver') || n.includes('courier') || n.includes('shift')) return '📦';
  if (n.includes('emerg') || n.includes('rescue') || n.includes('fire')) return '🚨';
  return '🛠️';
}

export const DEFAULT_DEPARTMENTS: DepartmentItem[] = [
  {
    id: 'Medical',
    name: 'Medical',
    description: 'Emergency medicine delivery, patient transit, and nursing visits',
    icon: '🩺',
    color: 'rose',
    slaHours: 2,
    active: true
  },
  {
    id: 'Groceries',
    name: 'Groceries',
    description: 'Essential rations, pantry replenishment, and market pick-ups',
    icon: '🛒',
    color: 'emerald',
    slaHours: 4,
    active: true
  },
  {
    id: 'Electrical',
    name: 'Electrical',
    description: 'Wiring issues, breaker failures, inverter diagnostics, and appliance repair',
    icon: '⚡',
    color: 'amber',
    slaHours: 3,
    active: true
  },
  {
    id: 'Plumbing',
    name: 'Plumbing',
    description: 'Pipe leaks, drainage clearing, tap replacements, and water pump repair',
    icon: '🔧',
    color: 'cyan',
    slaHours: 3,
    active: true
  }
];

/**
 * Seed initial departments if the collection is empty.
 */
export async function seedDefaultDepartments(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'departments'));
    if (snap.empty) {
      for (const dept of DEFAULT_DEPARTMENTS) {
        await setDoc(doc(db, 'departments', dept.id || dept.name), {
          ...dept,
          createdAt: new Date().toISOString()
        });
      }
    }
  } catch (err) {
    console.warn('Error checking/seeding default departments:', err);
  }
}

/**
 * Subscribe to departments in real time.
 */
export function subscribeDepartments(callback: (departments: DepartmentItem[]) => void): Unsubscribe {
  // Check seeding in background
  seedDefaultDepartments();

  return onSnapshot(collection(db, 'departments'), (snapshot) => {
    if (snapshot.empty) {
      callback(DEFAULT_DEPARTMENTS);
      return;
    }

    const items = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as DepartmentItem));

    // Sort by name
    items.sort((a, b) => a.name.localeCompare(b.name));
    callback(items);
  }, (err) => {
    console.warn('Error subscribing to departments:', err);
    callback(DEFAULT_DEPARTMENTS);
  });
}

/**
 * Create a new department
 */
export async function createDepartment(params: {
  name: string;
  description: string;
  icon?: string;
  color?: string;
  slaHours?: number;
}): Promise<string> {
  const id = params.name.trim();
  const deptRef = doc(db, 'departments', id);
  
  await setDoc(deptRef, {
    name: params.name.trim(),
    description: params.description.trim(),
    icon: params.icon || '🛠️',
    color: params.color || 'blue',
    slaHours: Number(params.slaHours) || 3,
    active: true,
    createdAt: new Date().toISOString()
  });

  return id;
}

/**
 * Update an existing department
 */
export async function updateDepartment(id: string, updates: Partial<DepartmentItem>): Promise<void> {
  await updateDoc(doc(db, 'departments', id), {
    ...updates,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Delete a department
 */
export async function deleteDepartment(id: string): Promise<void> {
  await deleteDoc(doc(db, 'departments', id));
}
