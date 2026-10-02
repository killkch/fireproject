"use client";

/**
 * ========================================================
 * Firebase 인증 컨텍스트 (src/context/AuthContext.tsx)
 * ========================================================
 * 
 * [역할 및 설명]
 * 이 파일은 React Context API를 통해 사용자 로그인 상태를 앱 전체에 제공하고,
 * 회원가입 시 Firebase Authentication 계정 생성뿐만 아니라
 * Firestore의 'users' 컬렉션에 사용자 프로필(UID, 이메일, 닉네임, 가입일시)을 안전하게 저장합니다.
 * 
 * [초보자를 위한 핵심 흐름]
 * 1. createUserWithEmailAndPassword: 비밀번호를 암호화하여 Firebase 인증 서버에 안전하게 계정 생성
 * 2. updateProfile: 계정의 기본 닉네임(displayName) 설정
 * 3. setDoc(doc(db, "users", uid), ...): Firestore 'users' 컬렉션에 사용자 추가 메타데이터 저장
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  type User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";

// 사용자의 프로필 정보 인터페이스
export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isDemo?: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isConfigured: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  loginAsDemo: (displayName: string) => void;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // 1. 로컬스토리지에 저장된 체험용(Demo) 계정 확인
    const savedDemoUser = typeof window !== "undefined" ? localStorage.getItem("demo_user") : null;
    if (savedDemoUser) {
      try {
        setUser(JSON.parse(savedDemoUser));
        setLoading(false);
        return;
      } catch {
        localStorage.removeItem("demo_user");
      }
    }

    // 2. 실제 Firebase 키가 설정된 경우 공식 Firebase Auth 상태 감지
    if (isFirebaseConfigured) {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        if (currentUser) {
          setUser({
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            isDemo: false,
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  // 1. 이메일/비밀번호 회원가입 및 Firestore 사용자 정보 동시 저장
  const signUp = async (email: string, password: string, displayName: string) => {
    if (!isFirebaseConfigured) {
      throw new Error("FIREBASE_NOT_CONFIGURED");
    }

    // 1-1. Firebase Auth에 신규 계정 생성
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const createdUser = userCredential.user;

    if (createdUser) {
      const trimmedName = displayName.trim();

      // 1-2. Firebase 인증 프로필에 닉네임 설정
      await updateProfile(createdUser, {
        displayName: trimmedName,
      });

      // 1-3. ⭐️ Firestore 'users' 컬렉션에 사용자 세부 정보 안전하게 저장
      try {
        const userDocRef = doc(db, "users", createdUser.uid);
        await setDoc(userDocRef, {
          uid: createdUser.uid,
          email: createdUser.email,
          displayName: trimmedName,
          createdAt: serverTimestamp(),
          role: "player",
        });
      } catch (firestoreError) {
        console.error("Firestore users 컬렉션 저장 중 오류 발생:", firestoreError);
      }

      // 1-4. 로컬 유저 상태 동기화
      setUser({
        uid: createdUser.uid,
        email: createdUser.email,
        displayName: trimmedName,
        isDemo: false,
      });
    }
  };

  // 2. 이메일/비밀번호 로그인
  const signIn = async (email: string, password: string) => {
    if (!isFirebaseConfigured) {
      throw new Error("FIREBASE_NOT_CONFIGURED");
    }
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    if (userCredential.user) {
      setUser({
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: userCredential.user.displayName,
        isDemo: false,
      });
    }
  };

  // 3. 체험용(Demo) 계정 로그인 (Firebase 키 없이 즉시 플레이 가능)
  const loginAsDemo = (displayName: string) => {
    const demoUser: AppUser = {
      uid: "demo-user-" + Date.now().toString(36),
      email: `${displayName.toLowerCase().replace(/\s+/g, "")}@demo.local`,
      displayName: displayName.trim() || "스피드라이더",
      isDemo: true,
    };
    setUser(demoUser);
    if (typeof window !== "undefined") {
      localStorage.setItem("demo_user", JSON.stringify(demoUser));
    }
  };

  // 4. 로그아웃
  const logOut = async () => {
    if (user?.isDemo) {
      localStorage.removeItem("demo_user");
      setUser(null);
      return;
    }
    if (isFirebaseConfigured) {
      await signOut(auth);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured: isFirebaseConfigured,
        signUp,
        signIn,
        loginAsDemo,
        logOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth는 반드시 AuthProvider 내부에서 사용되어야 합니다.");
  }
  return context;
}
