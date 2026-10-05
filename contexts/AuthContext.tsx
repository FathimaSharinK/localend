"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase/client";

import { UserRole, Department, UserStatus } from "@/types";

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  onboardingCompleted: boolean;
  area?: string;
  phone?: string;
  bio?: string;
  role?: UserRole;
  department?: Department;
  status?: UserStatus;
  coordinates?: { lat: number; lng: number } | null;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        if (auth.currentUser?.email?.toLowerCase() === 'admin@gmail.com') {
          data.role = 'admin';
        }
        setProfile(data);
      } else if (auth.currentUser?.email?.toLowerCase() === 'admin@gmail.com') {
        setProfile({
          uid,
          fullName: 'Platform Admin',
          email: 'admin@gmail.com',
          role: 'admin',
          onboardingCompleted: true,
          area: 'Community Headquarters',
          status: 'active'
        });
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
