/**
 * ========================================================
 * Firebase 클라이언트 초기화 모듈 (src/lib/firebase.ts)
 * ========================================================
 * 
 * [역할 및 설명]
 * 이 파일은 Next.js 애플리케이션 전체에서 공유하여 사용할 Firebase의
 * 핵심 서비스(인증, 데이터베이스, 스토리지 등)를 초기화하고 내보내는(export) 역할을 합니다.
 * 
 * [싱글톤(Singleton) 패턴 적용 이유]
 * Next.js는 화면을 새로고침하거나 코드가 수정될 때(HMR), 또는 서버와 클라이언트를 넘나들며
 * 코드를 다시 실행할 수 있습니다. 이때 Firebase 앱을 매번 새로 생성하면
 * "Firebase App named '[DEFAULT]' already exists"라는 중복 초기화 에러가 발생합니다.
 * 이를 방지하기 위해 이미 초기화된 앱이 있다면 그것을 재사용(getApp())하도록 구현합니다.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// 1. 환경 변수(.env.local)로부터 Firebase 접속 정보 로드
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 2. Firebase App 초기화 (싱글톤 패턴)
// 이미 초기화된 앱이 있으면(getApps().length > 0) 기존 앱을 가져오고, 없으면 새로 초기화합니다.
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 3. 주요 Firebase 서비스 인스턴스 생성
// - auth: 사용자 로그인/회원가입/인증 상태 관리
// - db: NoSQL 실시간 데이터베이스(Firestore)
// - storage: 이미지, 파일 등 대용량 미디어 파일 저장소
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

// 4. 다른 파일(컴포넌트나 API 라우트)에서 사용할 수 있도록 export
export { app, auth, db, storage };
