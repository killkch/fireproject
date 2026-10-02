"use client";

/**
 * ========================================================
 * 로그인 및 회원가입 모달 (src/components/AuthModal.tsx)
 * ========================================================
 * 
 * [역할 및 설명]
 * 플레이어가 레이싱 게임 시작 전 로그인하거나 신규 계정을 생성할 수 있는 모달 창입니다.
 * 
 * [스마트 폴백 UX]
 * - Firebase 키가 설정된 경우: 실제 Firebase Auth(이메일/비밀번호)로 안전하게 로그인
 * - Firebase 키가 아직 없는 경우: 오류를 발생시키는 대신 입력하신 닉네임/이메일로
 *   즉시 "체험용 라이더"로 로그인되어 게임과 랭킹을 바로 즐길 수 있습니다.
 */

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signIn, signUp, loginAsDemo, isConfigured } = useAuth();
  const [isSignUpMode, setIsSignUpMode] = useState<boolean>(false);

  // 입력 폼 상태
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");

  // 상태 관리 (로딩 및 오류 메시지)
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  if (!isOpen) return null;

  // Firebase 영문 에러 메시지를 초보자가 이해하기 쉬운 한국어로 번역하는 함수
  const getFriendlyErrorMessage = (error: unknown): string => {
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code: string }).code;
      if (code.includes("api-key")) {
        return "Firebase API 키가 유효하지 않습니다. .env.local 파일의 키를 확인해 주세요.";
      }

      switch (code) {
        case "auth/invalid-email":
          return "올바른 이메일 형식이 아닙니다.";
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          return "이메일 또는 비밀번호가 일치하지 않습니다.";
        case "auth/email-already-in-use":
          return "이미 가입된 이메일 주소입니다.";
        case "auth/weak-password":
          return "비밀번호는 최소 6자리 이상이어야 합니다.";
        case "auth/network-request-failed":
          return "네트워크 연결 상태를 확인해 주세요.";
        default:
          return `인증 오류가 발생했습니다 (${code})`;
      }
    }
    return "로그인 중 예상치 못한 오류가 발생했습니다.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setLoading(true);

    try {
      // 1. Firebase API 키가 아직 설정되지 않은 로컬 모드일 때
      // 오류를 띄우지 않고 입력한 닉네임/이메일로 즉시 체험 로그인 처리!
      if (!isConfigured) {
        const riderName = displayName.trim() || email.split("@")[0] || "스피드라이더";
        loginAsDemo(riderName);
        onClose();
        return;
      }

      // 2. Firebase 실제 연동 모드일 때
      if (isSignUpMode) {
        if (!displayName.trim()) {
          setErrorMessage("리더보드에 표시할 닉네임을 입력해 주세요.");
          setLoading(false);
          return;
        }
        await signUp(email, password, displayName);
      } else {
        await signIn(email, password);
      }
      onClose(); // 성공 시 모달 닫기
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // 버튼 한 번으로 즉시 체험 시작
  const handleQuickDemo = () => {
    const quickNames = ["번개라이더", "네온스타", "터보마스터", "질주본능"];
    const randomName = quickNames[Math.floor(Math.random() * quickNames.length)];
    loginAsDemo(displayName.trim() || randomName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-zinc-900 border border-cyan-500/30 p-6 md:p-8 shadow-[0_0_50px_rgba(6,182,212,0.15)] text-white max-h-[90vh] overflow-y-auto">
        
        {/* 모달 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors text-2xl font-bold p-1 cursor-pointer"
          aria-label="닫기"
        >
          ✕
        </button>

        {/* 상단 타이틀 */}
        <div className="text-center mb-5">
          <div className="inline-block p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 mb-2 text-3xl">
            🏎️
          </div>
          <h2 className="text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400">
            {isSignUpMode ? "새로운 라이더 등록" : "라이더 로그인"}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {isConfigured
              ? "Firebase 클라우드 계정으로 로그인합니다."
              : "닉네임과 이메일을 입력하시면 즉시 라이더로 등록됩니다!"}
          </p>
        </div>

        {/* 로컬 체험 모드 안내 뱃지 */}
        {!isConfigured && (
          <div className="mb-5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 p-3.5 text-xs text-cyan-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5 text-cyan-300">
                <span>⚡</span>
                <span>원클릭 체험 모드 지원</span>
              </span>
              <button
                type="button"
                onClick={handleQuickDemo}
                className="px-2.5 py-1 rounded bg-cyan-500 text-zinc-950 font-black text-[11px] hover:bg-cyan-400 cursor-pointer shadow-sm shadow-cyan-500/30"
              >
                1초 만에 바로 시작
              </button>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              복잡한 인증 절차 없이 아래 폼에 입력하거나 위의 <strong>[1초 만에 바로 시작]</strong> 버튼을 누르면 즉시 랭킹에 참여할 수 있습니다!
            </p>
          </div>
        )}

        {/* 로그인 / 회원가입 탭 전환 */}
        <div className="flex rounded-xl bg-zinc-950 p-1 mb-5 border border-zinc-800">
          <button
            type="button"
            onClick={() => {
              setIsSignUpMode(false);
              setErrorMessage("");
            }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all cursor-pointer ${
              !isSignUpMode
                ? "bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUpMode(true);
              setErrorMessage("");
            }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all cursor-pointer ${
              isSignUpMode
                ? "bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            회원가입
          </button>
        </div>

        {/* 오류 메시지 배너 */}
        {errorMessage && (
          <div className="mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-400 flex items-start gap-2">
            <span className="text-sm">⚠️</span>
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* 입력 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 회원가입 시 또는 체험 모드 시 닉네임 입력 */}
          {(isSignUpMode || !isConfigured) && (
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                플레이어 닉네임 {!isConfigured && "(리더보드에 표시될 이름)"}
              </label>
              <input
                type="text"
                required={isSignUpMode}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="예: 스피드레이서"
                maxLength={20}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-colors"
              />
            </div>
          )}

          {/* 이메일 입력란 */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              이메일 주소
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@racing.com"
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-colors"
            />
          </div>

          {/* 비밀번호 입력란 */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              비밀번호 (6자 이상)
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-colors"
            />
          </div>

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950 font-black tracking-wider transition-all transform active:scale-98 shadow-lg shadow-cyan-500/25 disabled:opacity-50 cursor-pointer"
          >
            {loading ? "처리 중..." : isSignUpMode ? "회원가입 완료" : "레이스 참가하기"}
          </button>
        </form>

        {/* 하단 안내 링크 */}
        <div className="mt-5 pt-4 border-t border-zinc-800/80 text-center">
          <p className="text-[11px] text-zinc-500">
            실제 Firebase 클라우드 프로젝트 연동은 <code className="text-cyan-400">.env.local</code> 파일에 키를 입력하시면 언제든 활성화됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
