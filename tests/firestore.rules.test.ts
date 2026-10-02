/**
 * ========================================================
 * Firestore 보안 규칙 단위 테스트 (tests/firestore.rules.test.ts)
 * ========================================================
 * 
 * [테스트 목적]
 * firestore.rules에 작성된 보안 규칙이 의도한 대로 동작하는지 검증합니다:
 * 1. 누구나 리더보드 읽기가 가능한지 (Public Read)
 * 2. 비로그인 사용자의 쓰기 차단
 * 3. 로그인한 사용자 본인의 점수 등록 허용
 * 4. 타인 계정의 점수 위조 차단 (보안 핵심)
 * 5. 비정상 데이터(음수 점수, 글자 수 초과, 필드 누락 등) 차단
 * 6. 이전 점수보다 낮은 점수로의 갱신 차단
 * 7. 일반 사용자의 점수 삭제 차단
 */

import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import * as fs from "fs";
import * as path from "path";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

const PROJECT_ID = "demo-racing-game-rules-test";

describe("Firestore 보안 규칙 (firestore.rules) 검증 테스트", () => {
  let testEnv: RulesTestEnvironment;

  // 테스트 시작 전: 보안 규칙 파일(firestore.rules) 로드 및 가상 테스트 환경 초기화
  beforeAll(async () => {
    const rulesContent = fs.readFileSync(path.resolve(__dirname, "../firestore.rules"), "utf8");
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: rulesContent,
        host: "127.0.0.1",
        port: 8080,
      },
    });
  });

  // 각 테스트 실행 전: 테스트 데이터베이스 초기화
  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  // 모든 테스트 종료 후: 테스트 환경 정리
  afterAll(async () => {
    await testEnv.cleanup();
  });

  // -----------------------------------------------------------
  // [테스트 1] 리더보드 읽기 권한 검증
  // -----------------------------------------------------------
  it("비로그인(익명) 사용자도 리더보드 점수 문서를 자유롭게 읽을 수 있어야 한다", async () => {
    // 관리자(보안규칙 우회) 권한으로 기존 점수 문서 1건 생성
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "scores", "player123"), {
        userId: "player123",
        displayName: "스피드왕",
        score: 1500,
        level: 3,
        updatedAt: new Date(),
      });
    });

    // 비로그인 사용자 컨텍스트
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const docRef = doc(unauthedDb, "scores", "player123");

    // 읽기 성공 검증
    await assertSucceeds(getDoc(docRef));
  });

  // -----------------------------------------------------------
  // [테스트 2] 비로그인 사용자 쓰기 차단 검증
  // -----------------------------------------------------------
  it("비로그인 사용자가 점수를 등록(create)하려고 하면 거부되어야 한다", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const docRef = doc(unauthedDb, "scores", "player123");

    const payload = {
      userId: "player123",
      displayName: "익명해커",
      score: 9999,
      level: 10,
      updatedAt: new Date(),
    };

    // 쓰기 실패(거부) 검증
    await assertFails(setDoc(docRef, payload));
  });

  // -----------------------------------------------------------
  // [테스트 3] 로그인 사용자 본인 점수 등록 검증
  // -----------------------------------------------------------
  it("로그인한 사용자는 본인의 UID 경로에 정상적인 점수를 등록할 수 있어야 한다", async () => {
    const authedDb = testEnv.authenticatedContext("my-user-id").firestore();
    const docRef = doc(authedDb, "scores", "my-user-id");

    const validPayload = {
      userId: "my-user-id",
      displayName: "번개라이더",
      score: 2500,
      level: 5,
      updatedAt: new Date(),
    };

    await assertSucceeds(setDoc(docRef, validPayload));
  });

  // -----------------------------------------------------------
  // [테스트 4] 타인 점수 위조 차단 검증 (보안 핵심)
  // -----------------------------------------------------------
  it("로그인한 사용자라도 다른 사람의 UID 경로에 점수를 등록하려 하면 거부되어야 한다", async () => {
    // 'my-user-id' 계정으로 로그인한 상태
    const authedDb = testEnv.authenticatedContext("my-user-id").firestore();
    // 다른 사람('victim-user-id')의 점수 문서에 쓰기 시도
    const docRef = doc(authedDb, "scores", "victim-user-id");

    const payload = {
      userId: "victim-user-id",
      displayName: "위조시도",
      score: 100,
      level: 1,
      updatedAt: new Date(),
    };

    await assertFails(setDoc(docRef, payload));
  });

  // -----------------------------------------------------------
  // [테스트 5] 비정상 데이터 및 스키마 검증
  // -----------------------------------------------------------
  it("점수가 음수이거나 필수 필드가 누락된 경우 등록이 거부되어야 한다", async () => {
    const authedDb = testEnv.authenticatedContext("my-user-id").firestore();
    const docRef = doc(authedDb, "scores", "my-user-id");

    // 음수 점수
    const negativeScorePayload = {
      userId: "my-user-id",
      displayName: "버그유저",
      score: -500, // 잘못된 점수
      level: 1,
      updatedAt: new Date(),
    };
    await assertFails(setDoc(docRef, negativeScorePayload));

    // 필수 필드 누락 (level 필드 없음)
    const missingFieldPayload = {
      userId: "my-user-id",
      displayName: "누락유저",
      score: 1000,
      updatedAt: new Date(),
    };
    await assertFails(setDoc(docRef, missingFieldPayload));
  });

  // -----------------------------------------------------------
  // [테스트 6] 점수 갱신(Update) 규칙 검증
  // -----------------------------------------------------------
  it("새로운 점수가 기존 최고 점수보다 낮으면 갱신이 거부되어야 한다", async () => {
    // 1) 기존 점수 3000점으로 등록
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "scores", "my-user-id"), {
        userId: "my-user-id",
        displayName: "슈퍼카",
        score: 3000,
        level: 6,
        updatedAt: new Date(),
      });
    });

    const authedDb = testEnv.authenticatedContext("my-user-id").firestore();
    const docRef = doc(authedDb, "scores", "my-user-id");

    // 2) 이전 점수(3000)보다 낮은 점수(1500)로 갱신 시도 -> 실패해야 함
    const lowerScorePayload = {
      userId: "my-user-id",
      displayName: "슈퍼카",
      score: 1500,
      level: 3,
      updatedAt: new Date(),
    };
    await assertFails(setDoc(docRef, lowerScorePayload));

    // 3) 더 높은 점수(4500)로 갱신 시도 -> 성공해야 함
    const higherScorePayload = {
      userId: "my-user-id",
      displayName: "슈퍼카",
      score: 4500,
      level: 8,
      updatedAt: new Date(),
    };
    await assertSucceeds(setDoc(docRef, higherScorePayload));
  });

  // -----------------------------------------------------------
  // [테스트 7] 문서 삭제 차단 검증
  // -----------------------------------------------------------
  it("로그인한 사용자라도 본인이나 타인의 점수 문서를 삭제할 수 없어야 한다", async () => {
    // 기존 점수 등록
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "scores", "my-user-id"), {
        userId: "my-user-id",
        displayName: "영구보존",
        score: 5000,
        level: 10,
        updatedAt: new Date(),
      });
    });

    const authedDb = testEnv.authenticatedContext("my-user-id").firestore();
    const docRef = doc(authedDb, "scores", "my-user-id");

    // 삭제 시도 -> 실패해야 함
    await assertFails(deleteDoc(docRef));
  });

  // -----------------------------------------------------------
  // [테스트 8] users 컬렉션 본인 프로필 생성/조회 검증
  // -----------------------------------------------------------
  it("로그인한 사용자는 본인의 users 문서에 프로필 정보를 등록하고 조회할 수 있어야 한다", async () => {
    const authedDb = testEnv.authenticatedContext("user-abc").firestore();
    const docRef = doc(authedDb, "users", "user-abc");

    const profileData = {
      uid: "user-abc",
      email: "racer@racing.com",
      displayName: "스피드킹",
      createdAt: new Date(),
      role: "player",
    };

    // 본인 문서 쓰기 성공 검증
    await assertSucceeds(setDoc(docRef, profileData));
    // 본인 문서 읽기 성공 검증
    await assertSucceeds(getDoc(docRef));
  });

  // -----------------------------------------------------------
  // [테스트 9] users 컬렉션 타인 접근 차단 검증 (개인정보 보호)
  // -----------------------------------------------------------
  it("로그인한 사용자라도 다른 사람의 users 문서에 접근하거나 수정할 수 없어야 한다", async () => {
    const authedDb = testEnv.authenticatedContext("hacker-uid").firestore();
    const victimDocRef = doc(authedDb, "users", "victim-uid");

    const maliciousData = {
      uid: "victim-uid",
      email: "hacked@racing.com",
      displayName: "해킹시도",
      role: "admin",
    };

    // 타인 문서 쓰기 실패 검증
    await assertFails(setDoc(victimDocRef, maliciousData));
    // 타인 문서 읽기 실패 검증
    await assertFails(getDoc(victimDocRef));
  });
});
