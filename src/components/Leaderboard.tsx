"use client";

/**
 * ========================================================
 * 실시간 리더보드 순위표 (src/components/Leaderboard.tsx)
 * ========================================================
 * 
 * [디자인 테마: Harbor Steel]
 * - shadcn/ui Harbor Steel 카드(#192030), 스틸 보더(#2e384d), 0.75rem 곡률
 * - 1위 및 최고 점수에 Harbor Gold(#c59b4c) 하이라이트
 * 
 * [기능]
 * - Firestore 실시간 쿼리(onSnapshot) 구독 및 미연동 시 로컬 데모 순위 지원
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

export const DEMO_LEADERBOARD: ScoreEntry[] = [
  { userId: "demo1", displayName: "골든팬텀", score: 5200, level: 9 },
  { userId: "demo2", displayName: "스틸라이더", score: 4350, level: 8 },
  { userId: "demo3", displayName: "하버에이스", score: 3600, level: 7 },
  { userId: "demo4", displayName: "터보차저", score: 2800, level: 5 },
  { userId: "demo5", displayName: "질주본능", score: 1950, level: 4 },
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
    if (!isFirebaseConfigured) {
      loadLocalDemoScores();
      const handleDemoUpdate = () => loadLocalDemoScores();
      window.addEventListener("demo_leaderboard_updated", handleDemoUpdate);
      return () => window.removeEventListener("demo_leaderboard_updated", handleDemoUpdate);
    }

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
            setScores(DEMO_LEADERBOARD);
            setIsDemoMode(true);
          }

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
    <div className="w-full rounded-xl bg-[#192030] border border-[#2e384d] p-6 shadow-xl flex flex-col h-full text-[#e2e4e9]">
      {/* 헤더 */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#2e384d]">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🏆</span>
          <h3 className="text-base font-bold tracking-wider text-[#c59b4c] uppercase font-mono">
            LEADERBOARD
          </h3>
        </div>
        {isDemoMode && (
          <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-lg bg-[#2e384d]/60 border border-[#2e384d] text-[#8e9ab0]">
            DEMO
          </span>
        )}
      </div>

      {/* 랭킹 리스트 */}
      <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
        {loading ? (
          <div className="py-12 text-center text-xs text-[#8e9ab0]">
            랭킹 데이터를 동기화하는 중...
          </div>
        ) : (
          scores.map((entry, index) => {
            const isMe = currentUserId === entry.userId || (user && user.uid === entry.userId);

            let rankBadge = (
              <span className="w-6 text-center text-xs font-mono font-bold text-[#8e9ab0]">
                {index + 1}
              </span>
            );
            if (index === 0) rankBadge = <span className="text-base">🥇</span>;
            if (index === 1) rankBadge = <span className="text-base">🥈</span>;
            if (index === 2) rankBadge = <span className="text-base">🥉</span>;

            return (
              <div
                key={entry.userId + index}
                className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                  isMe
                    ? "bg-[#c59b4c]/10 border border-[#c59b4c] shadow-sm"
                    : index === 0
                    ? "bg-[#121622] border border-[#c59b4c]/40"
                    : "bg-[#121622]/60 border border-[#2e384d]/80 hover:border-[#2e384d]"
                }`}
              >
                {/* 순위 및 라이더 이름 */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center w-6">
                    {rankBadge}
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold truncate ${isMe ? "text-[#c59b4c]" : "text-[#e2e4e9]"}`}>
                        {entry.displayName}
                      </span>
                      {isMe && (
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-[#c59b4c] text-[#121622]">
                          ME
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#8e9ab0] font-mono">
                      Level {entry.level}
                    </span>
                  </div>
                </div>

                {/* 점수 */}
                <div className="text-right">
                  <div className="text-sm font-black text-[#c59b4c] font-mono">
                    {entry.score.toLocaleString()}
                  </div>
                  <div className="text-[9px] text-[#8e9ab0] font-mono tracking-tighter">PTS</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 하단 유저 안내 */}
      <div className="mt-4 pt-3 border-t border-[#2e384d] text-[11px] text-[#8e9ab0] text-center">
        {user ? (
          <span>현재 라이더: <strong className="text-[#c59b4c]">{user.displayName || user.email}</strong></span>
        ) : (
          <span>로그인하시면 당신의 최고 기록이 랭킹에 영구 보존됩니다.</span>
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
  if (newScore <= currentHighScore) {
    return false;
  }

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
