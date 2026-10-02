"use client";

/**
 * ========================================================
 * 로그인 및 회원가입 모달 (src/components/AuthModal.tsx)
 * ========================================================
 * 
 * [디자인 테마: Harbor Steel]
 * - shadcn/ui 기반 Harbor Steel 스타일 (카드 #192030, 보더 #2e384d, 곡률 0.75rem)
 * - 버튼: Harbor Gold (#c59b4c), Secondary Off-White (#e2e4e9)
 * - 인풋: #121622 배경, #2e384d 테두리, 포커스 시 골드 링
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

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  if (!isOpen) return null;

  const getFriendlyErrorMessage = (error: unknown): string => {
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code: string }).code;
      if (code.includes("api-key")) {
        return "Firebase API 키가 유효하지 않습니다. .env.local 파일을 확인해 주세요.";
      }

      switch (code) {
        case "auth/invalid-email":
          return "올바른 이메일 형식이 아닙니다.";
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          return "이메일 또는 비밀번호가 일치하지 않습니다.";
        case "auth/email-already-in-use":
          return "이미 등록된 이메일 주소입니다.";
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
      if (!isConfigured) {
        const riderName = displayName.trim() || email.split("@")[0] || "골든라이더";
        loginAsDemo(riderName);
        onClose();
        return;
      }

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
      onClose();
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = () => {
    const quickNames = ["골든라이더", "스틸팬텀", "하버마스터", "질주본능"];
    const randomName = quickNames[Math.floor(Math.random() * quickNames.length)];
    loginAsDemo(displayName.trim() || randomName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-xl bg-[#192030] border border-[#2e384d] p-6 md:p-8 shadow-2xl text-[#e2e4e9] max-h-[90vh] overflow-y-auto">
        
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8e9ab0] hover:text-[#e2e4e9] transition-colors text-xl font-bold p-1 cursor-pointer"
          aria-label="닫기"
        >
          ✕
        </button>

        {/* 상단 타이틀 */}
        <div className="text-center mb-6">
          <div className="inline-block p-3 rounded-xl bg-[#2e384d]/40 border border-[#2e384d] mb-3 text-3xl">
            🏎️
          </div>
          <h2 className="text-xl font-bold tracking-wider text-[#e2e4e9]">
            {isSignUpMode ? "신규 라이더 등록" : "라이더 로그인"}
          </h2>
          <p className="text-xs text-[#8e9ab0] mt-1">
            {isConfigured
              ? "Firebase 클라우드 계정으로 로그인합니다."
              : "닉네임과 이메일을 입력하시면 즉시 라이더로 등록됩니다."}
          </p>
        </div>

        {/* 빠른 체험 모드 안내 */}
        {!isConfigured && (
          <div className="mb-5 rounded-xl bg-[#121622] border border-[#2e384d] p-3.5 text-xs text-[#8e9ab0] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#c59b4c] flex items-center gap-1.5">
                <span>⚡</span>
                <span>원클릭 체험 모드</span>
              </span>
              <button
                type="button"
                onClick={handleQuickDemo}
                className="px-2.5 py-1 rounded-lg bg-[#c59b4c] hover:bg-[#d8ad5a] text-[#121622] font-bold text-[11px] cursor-pointer transition-colors shadow-sm"
              >
                즉시 시작
              </button>
            </div>
            <p className="text-[11px] text-[#8e9ab0] leading-relaxed">
              복잡한 인증 없이 바로 시작하거나, 아래 폼에 원하는 닉네임을 입력하여 등록하세요.
            </p>
          </div>
        )}

        {/* 탭 전환 (Harbor Steel 0.75rem 스타일) */}
        <div className="flex rounded-xl bg-[#121622] p-1 mb-5 border border-[#2e384d]">
          <button
            type="button"
            onClick={() => {
              setIsSignUpMode(false);
              setErrorMessage("");
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              !isSignUpMode
                ? "bg-[#c59b4c] text-[#121622] shadow-sm"
                : "text-[#8e9ab0] hover:text-[#e2e4e9]"
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
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              isSignUpMode
                ? "bg-[#c59b4c] text-[#121622] shadow-sm"
                : "text-[#8e9ab0] hover:text-[#e2e4e9]"
            }`}
          >
            회원가입
          </button>
        </div>

        {/* 오류 메시지 */}
        {errorMessage && (
          <div className="mb-4 rounded-xl bg-[#f43f44]/10 border border-[#f43f44]/30 p-3 text-xs text-[#f43f44] flex items-start gap-2">
            <span className="text-sm">⚠️</span>
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* 입력 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {(isSignUpMode || !isConfigured) && (
            <div>
              <label className="block text-xs font-semibold text-[#8e9ab0] mb-1.5">
                플레이어 닉네임 {!isConfigured && "(리더보드 표시명)"}
              </label>
              <input
                type="text"
                required={isSignUpMode}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="예: 골든라이더"
                maxLength={20}
                className="w-full rounded-xl bg-[#121622] border border-[#2e384d] px-3.5 py-2.5 text-xs text-[#e2e4e9] placeholder-[#8e9ab0]/50 focus:border-[#c59b4c] focus:outline-none focus:ring-1 focus:ring-[#c59b4c] transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#8e9ab0] mb-1.5">
              이메일 주소
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="racer@harbor.com"
              className="w-full rounded-xl bg-[#121622] border border-[#2e384d] px-3.5 py-2.5 text-xs text-[#e2e4e9] placeholder-[#8e9ab0]/50 focus:border-[#c59b4c] focus:outline-none focus:ring-1 focus:ring-[#c59b4c] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8e9ab0] mb-1.5">
              비밀번호 (6자 이상)
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl bg-[#121622] border border-[#2e384d] px-3.5 py-2.5 text-xs text-[#e2e4e9] placeholder-[#8e9ab0]/50 focus:border-[#c59b4c] focus:outline-none focus:ring-1 focus:ring-[#c59b4c] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-xl bg-[#c59b4c] hover:bg-[#d8ad5a] text-[#121622] font-black text-xs tracking-wider transition-all transform active:scale-98 shadow-md disabled:opacity-50 cursor-pointer"
          >
            {loading ? "처리 중..." : isSignUpMode ? "회원가입 완료" : "레이스 참가하기"}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-[#2e384d] text-center">
          <p className="text-[11px] text-[#8e9ab0]">
            실제 Firebase 클라우드 연동은 <code className="text-[#c59b4c]">.env.local</code> 파일의 키를 통해 처리됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
