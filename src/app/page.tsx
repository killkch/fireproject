"use client";

/**
 * ========================================================
 * 메인 대시보드 및 레이싱 게임 페이지 (src/app/page.tsx)
 * ========================================================
 * 
 * [역할 및 설명]
 * 이 페이지는 게임 전체를 아우르는 중앙 통합 컴포넌트입니다:
 * 1. 상단 네비게이션 바: 사용자 로그인/로그아웃 상태 및 프로필 표시
 * 2. 중앙 좌측: 60FPS 네온 자동차 레이싱 게임 (RacingGame)
 * 3. 중앙 우측: 실시간 Firestore 리더보드 (Leaderboard) 및 가이드
 * 4. 게임 종료 시 점수 자동 저장 및 신기록 감지 로직 연동
 */

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import RacingGame from "@/components/RacingGame";
import Leaderboard, { savePlayerScore } from "@/components/Leaderboard";
import AuthModal from "@/components/AuthModal";

export default function Home() {
  const { user, logOut } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [userHighScore, setUserHighScore] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 토스트 알림을 띄우는 헬퍼 함수
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 게임 종료 시 호출되는 이벤트 핸들러
  const handleGameOver = async (finalScore: number, finalLevel: number) => {
    // 1. 비로그인 상태일 때
    if (!user) {
      showToast("💡 로그인하시면 달성하신 점수를 리더보드에 영구 등록할 수 있습니다!");
      return;
    }

    // 2. 로그인 상태일 때: 기존 최고 점수와 비교 후 Firestore 저장
    try {
      const isNewRecord = await savePlayerScore(
        user.uid,
        user.displayName || "익명 라이더",
        finalScore,
        finalLevel,
        userHighScore,
        user.isDemo
      );

      if (isNewRecord) {
        setUserHighScore(finalScore);
        showToast(`🎉 축하합니다! 신기록 (${finalScore}점)이 리더보드에 등록되었습니다!`);
      } else {
        showToast(`🏁 완주! 기존 최고 기록: ${userHighScore}점`);
      }
    } catch (error) {
      console.error("점수 저장 실패:", error);
      showToast("⚠️ 점수 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans">
      {/* ---------------------------------------------------- */}
      {/* 1. 상단 글로벌 네비게이션 바                          */}
      {/* ---------------------------------------------------- */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* 게임 로고 & 타이틀 */}
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏎️</span>
            <div>
              <h1 className="text-lg md:text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 leading-tight">
                CYBER NITRO RACING
              </h1>
              <span className="text-[10px] text-zinc-400 hidden sm:inline-block">
                Firebase Auth & Firestore Realtime Leaderboard
              </span>
            </div>
          </div>

          {/* 우측 사용자 인증 버튼 및 정보 */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-zinc-800/70 border border-zinc-700 px-3 py-1.5 rounded-full">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-xs font-bold text-cyan-300">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : "U"}
                  </div>
                  <span className="text-xs font-semibold text-zinc-200">
                    {user.displayName || user.email}
                  </span>
                </div>
                <button
                  onClick={() => logOut()}
                  className="text-xs text-zinc-400 hover:text-rose-400 px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-rose-500/30 transition-colors cursor-pointer"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950 font-bold text-xs tracking-wider transition-all transform active:scale-95 shadow-md shadow-cyan-500/20 cursor-pointer"
              >
                🔑 로그인 / 회원가입
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------- */}
      {/* 2. 메인 콘텐츠 (게임 화면 & 리더보드 2단 레이아웃)      */}
      {/* ---------------------------------------------------- */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* 좌측 (7열): 캔버스 레이싱 게임 엔진 */}
        <section className="lg:col-span-7 flex flex-col items-center justify-center">
          <RacingGame
            onGameOver={handleGameOver}
            userHighScore={userHighScore}
            playerName={user?.displayName || "게스트"}
          />
        </section>

        {/* 우측 (5열): 실시간 Firestore 리더보드 및 설명 카드 */}
        <section className="lg:col-span-5 flex flex-col gap-6 h-full">
          {/* 실시간 랭킹 순위표 */}
          <div className="h-[480px]">
            <Leaderboard
              currentUserId={user?.uid}
              onHighScoreLoaded={(score) => setUserHighScore(score)}
            />
          </div>

          {/* 보안 및 게임 규칙 안내 카드 */}
          <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <span>🛡️</span>
              <span>데이터베이스 보안 정책 (Security Rules)</span>
            </h4>
            <ul className="text-xs text-zinc-400 space-y-1.5 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400">✓</span>
                <span><strong>본인 점수만 기록:</strong> 타인의 UID로는 점수를 등록하거나 위조할 수 없습니다.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400">✓</span>
                <span><strong>무결성 검증:</strong> 이전 최고 점수보다 높을 때만 랭킹이 갱신됩니다.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400">✓</span>
                <span><strong>보안 규칙 단위 테스트 통과:</strong> 7개 보안 시나리오가 자동으로 검증되었습니다.</span>
              </li>
            </ul>
          </div>
        </section>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. 토스트 알림 팝업                                   */}
      {/* ---------------------------------------------------- */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-zinc-900/95 border border-cyan-500/50 text-white text-xs md:text-sm font-semibold shadow-[0_0_30px_rgba(6,182,212,0.3)] animate-in fade-in slide-in-from-bottom-4 duration-300">
          {toastMessage}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 4. 로그인 / 회원가입 모달                             */}
      {/* ---------------------------------------------------- */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </main>
  );
}
