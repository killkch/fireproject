"use client";

/**
 * ========================================================
 * 실시간 리더보드 순위표 (src/components/Leaderboard.tsx)
 * ========================================================
 * 
 * [역할 및 설명]
 * Firebase Firestore의 'scores' 컬렉션에서 전 세계 상위 10명의 최고 점수 목록을
 * 실시간(onSnapshot)으로 구독하여 보여주는 컴포넌트입니다.
 * 
 * [초보자를 위한 핵심 포인트]
 * 1. onSnapshot: 다른 플레이어가 신기록을 달성하면 화면을 새로고침하지 않아도 순위표가 자동으로 바뀝니다.
 * 2. 내 순위 하이라이트: 현재 로그인한 사용자의 기록은 특별한 네온 사이안 색상으로 강조됩니다.
 * 3. 스마트 폴백(Demo/Local): 아직 Firebase 설정 키가 입력되지 않은 경우에도 데모/로컬 순위를 보여주어 화면이 깨지지 않고 테스트할 수 있습니다.
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export interface ScoreEntry {
  userId: string;
  displayName: string;
  score: number;
  level: number;
  updatedAt?: unknown;
}

// 기본 데모 순위표
export const DEMO_LEADERBOARD: ScoreEntry[] = [
  { userId: "demo1", displayName: "네오레이서", score: 4820, level: 9 },
  { userId: "demo2", displayName: "사이버팬텀", score: 3950, level: 7 },
  { userId: "demo3", displayName: "스피드스타", score: 3200, level: 6 },
  { userId: "demo4", displayName: "터보마스터", score: 2450, level: 5 },
  { userId: "demo5", displayName: "질주본능", score: 1890, level: 4 },
];

interface LeaderboardProps {
  currentUserId?: string;
  onHighScoreLoaded?: (highScore: number) => void;
}

export default function Leaderboard({
  currentUserId,
  onHighScoreLoaded,
}: LeaderboardProps) {
  const { user } = useAuth();
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  // 로컬 데모 순위표 로드 헬퍼
  const loadLocalDemoScores = useCallback(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("demo_leaderboard");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setScores(parsed);
          if (user) {
            const myEntry = parsed.find((s: ScoreEntry) => s.userId === user.uid);
            if (myEntry && onHighScoreLoaded) onHighScoreLoaded(myEntry.score);
          }
          setLoading(false);
          setIsDemoMode(true);
          return;
        } catch {
          // ignore
        }
      }
    }
    setScores(DEMO_LEADERBOARD);
    setLoading(false);
    setIsDemoMode(true);
  }, [user, onHighScoreLoaded]);

  useEffect(() => {
    // 1. Firebase API 키가 아직 설정되지 않은 경우 -> 로컬 데모 순위표 사용
    if (!isFirebaseConfigured) {
      loadLocalDemoScores();

      const handleDemoUpdate = () => loadLocalDemoScores();
      window.addEventListener("demo_leaderboard_updated", handleDemoUpdate);
      return () => window.removeEventListener("demo_leaderboard_updated", handleDemoUpdate);
    }

    // 2. Firebase가 정상 설정된 경우 -> Firestore 실시간 쿼리 실행
    try {
      const scoresQuery = query(
        collection(db, "scores"),
        orderBy("score", "desc"),
        limit(10)
      );

      const unsubscribe = onSnapshot(
        scoresQuery,
        (snapshot) => {
          const fetchedScores: ScoreEntry[] = [];
          snapshot.forEach((docSnap) => {
            fetchedScores.push(docSnap.data() as ScoreEntry);
          });

          if (fetchedScores.length > 0) {
            setScores(fetchedScores);
            setIsDemoMode(false);
          } else {
            // 아직 아무도 점수를 등록하지 않은 경우
            setScores(DEMO_LEADERBOARD);
            setIsDemoMode(true);
          }

          // 현재 사용자의 기존 최고 기록 찾기
          if (user) {
            const myEntry = fetchedScores.find((s) => s.userId === user.uid);
            if (myEntry && onHighScoreLoaded) {
              onHighScoreLoaded(myEntry.score);
            }
          }
          setLoading(false);
        },
        (error) => {
          console.warn("Firestore 리더보드 조회 안내 (데모 데이터 표시):", error.message);
          loadLocalDemoScores();
        }
      );

      return () => unsubscribe();
    } catch {
      loadLocalDemoScores();
    }
  }, [user, onHighScoreLoaded, loadLocalDemoScores]);

  return (
    <div className="w-full rounded-2xl bg-zinc-900/90 border border-zinc-800 p-6 shadow-xl flex flex-col h-full text-white">
      {/* 헤더 */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏆</span>
          <h3 className="text-lg font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-rose-400">
            TOP 10 LEADERBOARD
          </h3>
        </div>
        {isDemoMode && (
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
            로컬/데모 랭킹
          </span>
        )}
      </div>

      {/* 랭킹 목록 */}
      <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
        {loading ? (
          <div className="py-12 text-center text-sm text-zinc-500">
            랭킹 데이터를 불러오는 중...
          </div>
        ) : (
          scores.map((entry, index) => {
            const isMe = currentUserId === entry.userId || (user && user.uid === entry.userId);

            // 순위별 메달 및 뱃지 스타일
            let rankBadge = (
              <span className="w-6 text-center text-xs font-mono font-bold text-zinc-400">
                {index + 1}
              </span>
            );
            if (index === 0) rankBadge = <span className="text-lg">🥇</span>;
            if (index === 1) rankBadge = <span className="text-lg">🥈</span>;
            if (index === 2) rankBadge = <span className="text-lg">🥉</span>;

            return (
              <div
                key={entry.userId + index}
                className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                  isMe
                    ? "bg-cyan-950/40 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                    : "bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700"
                }`}
              >
                {/* 순위 & 이름 */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center w-7">
                    {rankBadge}
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-bold truncate ${isMe ? "text-cyan-300" : "text-zinc-200"}`}>
                        {entry.displayName}
                      </span>
                      {isMe && (
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-cyan-500 text-zinc-950">
                          ME
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      도달 레벨: Lv.{entry.level}
                    </span>
                  </div>
                </div>

                {/* 점수 */}
                <div className="text-right">
                  <div className="text-sm font-black text-cyan-400 font-mono">
                    {entry.score.toLocaleString()}
                  </div>
                  <div className="text-[9px] text-zinc-500">POINTS</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 하단 안내 문구 */}
      <div className="mt-4 pt-3 border-t border-zinc-800/80 text-[11px] text-zinc-400 text-center">
        {user ? (
          <span>현재 라이더: <strong className="text-cyan-400">{user.displayName || user.email}</strong></span>
        ) : (
          <span>로그인하시면 당신의 최고 기록이 랭킹에 영구 보존됩니다!</span>
        )}
      </div>
    </div>
  );
}

/**
 * ========================================================
 * 💾 점수 저장 헬퍼 함수
 * ========================================================
 */
export async function savePlayerScore(
  userId: string,
  displayName: string,
  newScore: number,
  newLevel: number,
  currentHighScore: number,
  isDemo?: boolean
): Promise<boolean> {
  // 이전 점수보다 높지 않으면 저장 생략 (보안 규칙 준수)
  if (newScore <= currentHighScore) {
    return false;
  }

  // 데모 계정이거나 Firebase API 키가 아직 없는 경우 -> 로컬스토리지에 저장하여 랭킹 반영
  if (isDemo || !isFirebaseConfigured) {
    if (typeof window !== "undefined") {
      const demoScoresStr = localStorage.getItem("demo_leaderboard");
      const currentList: ScoreEntry[] = demoScoresStr
        ? JSON.parse(demoScoresStr)
        : [...DEMO_LEADERBOARD];

      const existingIdx = currentList.findIndex((s) => s.userId === userId);
      const newEntry: ScoreEntry = {
        userId,
        displayName: displayName || "익명 라이더",
        score: newScore,
        level: newLevel,
      };

      if (existingIdx >= 0) {
        currentList[existingIdx] = newEntry;
      } else {
        currentList.push(newEntry);
      }

      currentList.sort((a, b) => b.score - a.score);
      localStorage.setItem("demo_leaderboard", JSON.stringify(currentList.slice(0, 10)));
      window.dispatchEvent(new Event("demo_leaderboard_updated"));
    }
    return true;
  }

  // 실제 Firebase Firestore 저장
  const scoreRef = doc(db, "scores", userId);
  await setDoc(scoreRef, {
    userId,
    displayName: displayName || "익명 라이더",
    score: newScore,
    level: newLevel,
    updatedAt: serverTimestamp(),
  });

  return true;
}
