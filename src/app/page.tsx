"use client";

/**
 * ========================================================
 * 메인 대시보드 및 레이싱 게임 페이지 (src/app/page.tsx)
 * ========================================================
 * 
 * [디자인 테마: Harbor Steel]
 * - shadcn/ui Harbor Steel 디자인 시스템 전면 적용
 * - 컬러: Harbor Gold(#c59b4c), 딥 스틸 네이비(#121622), 스틸 서피스(#192030), 스틸 보더(#2e384d)
 * - 곡률: 0.75rem (rounded-xl)
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleGameOver = async (finalScore: number, finalLevel: number) => {
    if (!user) {
      showToast("💡 로그인하시면 달성하신 점수를 리더보드에 영구 등록할 수 있습니다.");
      return;
    }

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
        showToast(`🎉 신기록 (${finalScore}점)이 리더보드에 갱신되었습니다.`);
      } else {
        showToast(`🏁 완주! 기존 최고 기록: ${userHighScore}점`);
      }
    } catch (error) {
      console.error("점수 저장 실패:", error);
      showToast("⚠️ 점수 저장 중 오류가 발생했습니다.");
    }
  };

  return (
    <main className="min-h-screen bg-[#121622] text-[#e2e4e9] flex flex-col font-sans">
      {/* ---------------------------------------------------- */}
      {/* 1. 상단 Harbor Steel 글로벌 헤더                      */}
      {/* ---------------------------------------------------- */}
      <header className="border-b border-[#2e384d] bg-[#121622]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* 브랜드 로고 */}
          <div className="flex items-center gap-3">
            <span className="text-2xl p-2 rounded-xl bg-[#192030] border border-[#2e384d]">
              🏎️
            </span>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-wider text-[#c59b4c] font-mono leading-tight">
                HARBOR STEEL RACING
              </h1>
              <span className="text-[10px] text-[#8e9ab0] hidden sm:inline-block">
                Firebase Realtime Leaderboard & Secure Gaming
              </span>
            </div>
          </div>

          {/* 우측 사용자 컨트롤 */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-2 bg-[#192030] border border-[#2e384d] px-3 py-1.5 rounded-xl">
                  <div className="w-5 h-5 rounded-md bg-[#c59b4c] flex items-center justify-center text-[10px] font-black text-[#121622]">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : "U"}
                  </div>
                  <span className="text-xs font-semibold text-[#e2e4e9]">
                    {user.displayName || user.email}
                  </span>
                </div>
                <button
                  onClick={() => logOut()}
                  className="text-xs text-[#8e9ab0] hover:text-[#f43f44] px-3 py-1.5 rounded-xl border border-[#2e384d] hover:border-[#f43f44]/40 transition-colors cursor-pointer"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#c59b4c] hover:bg-[#d8ad5a] text-[#121622] font-black text-xs tracking-wider transition-all transform active:scale-95 shadow-md shadow-[#c59b4c]/10 cursor-pointer"
              >
                🔑 로그인 / 회원가입
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------- */}
      {/* 2. 메인 콘텐츠 (2단 레이아웃)                         */}
      {/* ---------------------------------------------------- */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* 좌측 (7열): 캔버스 레이싱 엔진 */}
        <section className="lg:col-span-7 flex flex-col items-center justify-center">
          <RacingGame
            onGameOver={handleGameOver}
            userHighScore={userHighScore}
            playerName={user?.displayName || "게스트"}
          />
        </section>

        {/* 우측 (5열): 실시간 리더보드 & 보안 정책 안내 */}
        <section className="lg:col-span-5 flex flex-col gap-6 h-full">
          {/* 리더보드 */}
          <div className="h-[480px]">
            <Leaderboard
              currentUserId={user?.uid}
              onHighScoreLoaded={(score) => setUserHighScore(score)}
            />
          </div>

          {/* 보안 정책 정보 카드 (Harbor Steel 스타일) */}
          <div className="rounded-xl bg-[#192030] border border-[#2e384d] p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#c59b4c] flex items-center gap-2 font-mono">
              <span>🛡️</span>
              <span>FIRESTORE SECURITY POLICIES</span>
            </h4>
            <ul className="text-xs text-[#8e9ab0] space-y-2 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-[#c59b4c]">✓</span>
                <span><strong>본인 점수만 기록:</strong> 타인의 UID로는 점수를 등록하거나 위조할 수 없습니다.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#c59b4c]">✓</span>
                <span><strong>데이터 무결성 검증:</strong> 이전 최고 기록 이상일 때만 순위표가 갱신됩니다.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#c59b4c]">✓</span>
                <span><strong>개인정보 암호화 보호:</strong> 회원가입 시 프로필은 본인만 읽고 쓸 수 있습니다.</span>
              </li>
            </ul>
          </div>
        </section>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. 토스트 알림 (Harbor Steel 0.75rem 스타일)           */}
      {/* ---------------------------------------------------- */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-[#192030] border border-[#c59b4c] text-[#e2e4e9] text-xs font-medium shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
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
