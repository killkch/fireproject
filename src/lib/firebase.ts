/**
 * ========================================================
 * Firebase 클라이언트 초기화 모듈 (src/lib/firebase.ts)
 * ========================================================
 * 
 * [역할 및 설명]
 * 이 파일은 Next.js 애플리케이션 전체에서 공유하여 사용할 Firebase의
 * 핵심 서비스(인증, 데이터베이스, 스토리지 등)를 초기화하고 내보내는(export) 역할을 합니다.
 * 
 * [싱글톤(Singleton) 패턴 적용]
 * Next.js는 화면을 새로고침하거나 코드가 수정될 때(HMR), 또는 서버와 클라이언트를 넘나들며
 * 코드를 다시 실행할 수 있습니다. 이때 Firebase 앱을 매번 새로 생성하면
 * "Firebase App named '[DEFAULT]' already exists"라는 중복 초기화 에러가 발생합니다.
 * 이를 방지하기 위해 이미 초기화된 앱이 있다면 그것을 재사용(getApp())하도록 구현합니다.
 * 
 * [빌드 타임 안전성 확보]
 * .env.local에 실제 키가 아직 입력되지 않은 상태에서도 Next.js 정적 빌드가 중단되지 않도록
 * 안전한 기본 플레이스홀더를 제공합니다. 실제 키가 입력되면 자동으로 우선 적용됩니다.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// 환경 변수 설정 여부 확인
export const isFirebaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY.trim().length > 0 &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
);

// 1. 환경 변수(.env.local)로부터 Firebase 접속 정보 로드 (미입력 시 빌드 통과용 안전 폴백)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDemoFallbackKeyForNextBuildOnly",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-app.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-app",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-app.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456",
};

// 2. Firebase App 초기화 (싱글톤 패턴)
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 3. 주요 Firebase 서비스 인스턴스 생성
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

export { app, auth, db, storage };
