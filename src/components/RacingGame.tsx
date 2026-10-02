"use client";

/**
 * ========================================================
 * 네온 자동차 레이싱 게임 엔진 (src/components/RacingGame.tsx)
 * ========================================================
 * 
 * [역할 및 설명]
 * HTML5 Canvas 2D API와 requestAnimationFrame을 사용하여 60FPS로 동작하는
 * 네온 사이버펑크 스타일의 자동차 레이싱 게임입니다.
 * 
 * [주요 기능]
 * 1. 키보드(←, →, ↑, ↓ / W, A, S, D) 및 화면 터치 컨트롤 완벽 지원
 * 2. Web Audio API 기반의 자체 사운드 효과 (외부 오디오 파일 없이 엔진음, 코인음, 충돌음 재생)
 * 3. 난이도 시스템 (시간이 지날수록 속도 증가 및 장애물 차량 빈도 증가)
 * 4. 코인 및 니트로 부스터 아이템 시스템
 * 5. 게임 종료 시 최고 기록 비교 및 상위 컴포넌트(리더보드 저장)로 점수 전달
 */

import React, { useRef, useEffect, useState, useCallback } from "react";

interface RacingGameProps {
  onGameOver: (finalScore: number, finalLevel: number) => void;
  userHighScore?: number;
  playerName?: string;
}

// 아이템 및 장애물 타입 정의
interface NPCVehicle {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  color: string;
}

interface BonusItem {
  x: number;
  y: number;
  type: "coin" | "nitro";
  radius: number;
}

export default function RacingGame({
  onGameOver,
  userHighScore = 0,
  playerName = "게스트",
}: RacingGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 게임 상태 관리
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // 게임 내부 루프 참조값 (리렌더링 유발 없이 60FPS 고속 연산을 위해 useRef 사용)
  const gameStateRef = useRef({
    playerX: 180,              // 플레이어 가로 위치 (도로 폭 기준 중앙)
    playerY: 480,              // 플레이어 세로 위치 (화면 하단)
    playerWidth: 44,
    playerHeight: 75,
    speed: 5,                  // 현재 주행 속도
    baseSpeed: 5,
    maxSpeed: 16,
    score: 0,
    distance: 0,
    level: 1,
    roadOffset: 0,
    keys: {
      left: false,
      right: false,
      up: false,
      down: false,
    },
    npcs: [] as NPCVehicle[],
    items: [] as BonusItem[],
    nitroTimer: 0,             // 니트로 부스터 지속 시간 카운트
  });

  // -----------------------------------------------------------
  // 🔊 Web Audio API를 활용한 내장 사운드 신디사이저
  // -----------------------------------------------------------
  const audioCtxRef = useRef<AudioContext | null>(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
  };

  // 사운드 재생 헬퍼 함수
  const playSound = useCallback((type: "coin" | "nitro" | "crash") => {
    if (isMuted || !audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === "coin") {
        // 맑고 경쾌한 코인 효과음
        osc.type = "sine";
        osc.frequency.setValueAtTime(987.77, now); // B5
        osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === "nitro") {
        // 강력한 부스터 효과음
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.4);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === "crash") {
        // 충돌 폭발 효과음
        osc.type = "square";
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch {
      // 오디오 미지원 환경 예외 무시
    }
  }, [isMuted]);

  // -----------------------------------------------------------
  // 🎮 게임 시작 및 리셋 함수
  // -----------------------------------------------------------
  const startGame = () => {
    initAudio();
    gameStateRef.current = {
      playerX: 180,
      playerY: 480,
      playerWidth: 44,
      playerHeight: 75,
      speed: 6,
      baseSpeed: 6,
      maxSpeed: 16,
      score: 0,
      distance: 0,
      level: 1,
      roadOffset: 0,
      keys: { left: false, right: false, up: false, down: false },
      npcs: [],
      items: [],
      nitroTimer: 0,
    };
    setIsGameOver(false);
    setIsPlaying(true);
    setScore(0);
    setLevel(1);
    setSpeed(60);
  };

  // -----------------------------------------------------------
  // ⌨️ 키보드 입력 이벤트 핸들러
  // -----------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 키보드 조합(IME)이나 특수 입력 등으로 e.key가 없는 경우 안전하게 무시
      if (!e.key) return;

      const key = e.key.toLowerCase();
      const keys = gameStateRef.current.keys;

      if (e.key === "ArrowLeft" || key === "a") {
        keys.left = true;
        e.preventDefault();
      }
      if (e.key === "ArrowRight" || key === "d") {
        keys.right = true;
        e.preventDefault();
      }
      if (e.key === "ArrowUp" || key === "w") {
        keys.up = true;
        e.preventDefault();
      }
      if (e.key === "ArrowDown" || key === "s") {
        keys.down = true;
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.key) return;

      const key = e.key.toLowerCase();
      const keys = gameStateRef.current.keys;

      if (e.key === "ArrowLeft" || key === "a") keys.left = false;
      if (e.key === "ArrowRight" || key === "d") keys.right = false;
      if (e.key === "ArrowUp" || key === "w") keys.up = false;
      if (e.key === "ArrowDown" || key === "s") keys.down = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // -----------------------------------------------------------
  // 🕹️ 메인 60FPS Canvas 렌더링 루프
  // -----------------------------------------------------------
  useEffect(() => {
    if (!isPlaying) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    const roadWidth = 320;
    const roadLeft = (canvas.width - roadWidth) / 2;
    const roadRight = roadLeft + roadWidth;

    const gameLoop = () => {
      const state = gameStateRef.current;

      // 1. 속도 및 가속/감속 처리
      let currentTargetSpeed = state.baseSpeed + (state.level - 1) * 1.5;
      if (state.nitroTimer > 0) {
        currentTargetSpeed += 6;
        state.nitroTimer--;
      } else if (state.keys.up) {
        currentTargetSpeed += 3;
      } else if (state.keys.down) {
        currentTargetSpeed = Math.max(3, currentTargetSpeed - 3);
      }
      state.speed = currentTargetSpeed;

      // 2. 플레이어 조작 이동
      const turnSpeed = 6;
      if (state.keys.left) state.playerX -= turnSpeed;
      if (state.keys.right) state.playerX += turnSpeed;

      // 도로 밖으로 나가지 않도록 경계 제한
      if (state.playerX < roadLeft + 10) state.playerX = roadLeft + 10;
      if (state.playerX + state.playerWidth > roadRight - 10) {
        state.playerX = roadRight - 10 - state.playerWidth;
      }

      // 3. 점수 및 레벨 업데이트
      state.distance += state.speed;
      state.score = Math.floor(state.distance / 10);
      const newLevel = Math.min(10, Math.floor(state.score / 500) + 1);
      if (newLevel !== state.level) {
        state.level = newLevel;
        setLevel(newLevel);
      }
      setScore(state.score);
      setSpeed(Math.round(state.speed * 12));

      // 4. 도로 배경 스크롤
      state.roadOffset = (state.roadOffset + state.speed) % 40;

      // 5. 장애물(NPC) 및 아이템 스폰 로직
      // 5-1. NPC 차량 생성 (레벨에 따라 빈도 증가)
      if (Math.random() < 0.02 + state.level * 0.005 && state.npcs.length < 5) {
        const laneWidth = roadWidth / 3;
        const randomLane = Math.floor(Math.random() * 3);
        const spawnX = roadLeft + randomLane * laneWidth + (laneWidth - 42) / 2;
        
        // 겹침 방지
        const isOverlapping = state.npcs.some((npc) => Math.abs(npc.y - (-80)) < 120);
        if (!isOverlapping) {
          const colors = ["#f43f5e", "#eab308", "#8b5cf6", "#ec4899", "#10b981"];
          state.npcs.push({
            x: spawnX,
            y: -90,
            width: 42,
            height: 70,
            speed: Math.max(2, state.speed - 3 + Math.random() * 2),
            color: colors[Math.floor(Math.random() * colors.length)],
          });
        }
      }

      // 5-2. 보너스 아이템(코인/니트로) 생성
      if (Math.random() < 0.015 && state.items.length < 3) {
        const itemX = roadLeft + 30 + Math.random() * (roadWidth - 60);
        state.items.push({
          x: itemX,
          y: -40,
          type: Math.random() > 0.8 ? "nitro" : "coin",
          radius: 12,
        });
      }

      // 6. 충돌 감지 및 위치 갱신
      // 6-1. NPC 차량 이동 및 충돌 판정
      for (let i = state.npcs.length - 1; i >= 0; i--) {
        const npc = state.npcs[i];
        npc.y += state.speed - npc.speed + 1; // 상대 속도로 화면 아래로 하강

        // 충돌 감지 (AABB 박스 충돌 알고리즘)
        const hitPadding = 6;
        if (
          state.playerX + hitPadding < npc.x + npc.width - hitPadding &&
          state.playerX + state.playerWidth - hitPadding > npc.x + hitPadding &&
          state.playerY + hitPadding < npc.y + npc.height - hitPadding &&
          state.playerY + state.playerHeight - hitPadding > npc.y + hitPadding
        ) {
          // 💥 충돌 발생 -> 게임 오버
          playSound("crash");
          setIsPlaying(false);
          setIsGameOver(true);
          onGameOver(state.score, state.level);
          return;
        }

        // 화면 밖으로 벗어난 NPC 제거
        if (npc.y > canvas.height + 100) {
          state.npcs.splice(i, 1);
        }
      }

      // 6-2. 아이템 획득 판정
      for (let i = state.items.length - 1; i >= 0; i--) {
        const item = state.items[i];
        item.y += state.speed;

        // 플레이어와 아이템 간 거리 계산
        const playerCenterX = state.playerX + state.playerWidth / 2;
        const playerCenterY = state.playerY + state.playerHeight / 2;
        const dist = Math.hypot(playerCenterX - item.x, playerCenterY - item.y);

        if (dist < item.radius + state.playerWidth / 2 - 4) {
          // 아이템 획득!
          if (item.type === "coin") {
            playSound("coin");
            state.distance += 1000; // 보너스 점수 +100점 효과
          } else {
            playSound("nitro");
            state.nitroTimer = 180; // 3초간 부스터 지속 (60FPS 기준 180프레임)
          }
          state.items.splice(i, 1);
          continue;
        }

        if (item.y > canvas.height + 50) {
          state.items.splice(i, 1);
        }
      }

      // -------------------------------------------------------
      // 🎨 화면 드로잉 (Canvas 렌더링)
      // -------------------------------------------------------
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // (1) 배경 (어두운 사이버 잔디/사이드)
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 사이드 네온 가이드라인
      ctx.strokeStyle = "rgba(6, 182, 212, 0.15)";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // (2) 도로 아스팔트
      ctx.fillStyle = "#18181b";
      ctx.fillRect(roadLeft, 0, roadWidth, canvas.height);

      // (3) 도로 양쪽 네온 가드레일 (Glow 효과)
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.lineWidth = 4;
      // 좌측 네온 사이안 라인
      ctx.shadowColor = "#06b6d4";
      ctx.strokeStyle = "#22d3ee";
      ctx.beginPath();
      ctx.moveTo(roadLeft, 0);
      ctx.lineTo(roadLeft, canvas.height);
      ctx.stroke();

      // 우측 네온 마젠타 라인
      ctx.shadowColor = "#ec4899";
      ctx.strokeStyle = "#f472b6";
      ctx.beginPath();
      ctx.moveTo(roadRight, 0);
      ctx.lineTo(roadRight, canvas.height);
      ctx.stroke();
      ctx.restore();

      // (4) 도로 중앙 점선 (차선 스크롤 애니메이션)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 4;
      ctx.setLineDash([25, 25]);
      ctx.lineDashOffset = -state.roadOffset;

      const lane1 = roadLeft + roadWidth / 3;
      const lane2 = roadLeft + (roadWidth / 3) * 2;

      ctx.beginPath();
      ctx.moveTo(lane1, 0);
      ctx.lineTo(lane1, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(lane2, 0);
      ctx.lineTo(lane2, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]); // 대시 리셋

      // (5) 아이템 그리기 (코인 & 니트로)
      state.items.forEach((item) => {
        ctx.save();
        if (item.type === "coin") {
          ctx.shadowColor = "#facc15";
          ctx.shadowBlur = 15;
          ctx.fillStyle = "#eab308";
          ctx.beginPath();
          ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#fef08a";
          ctx.beginPath();
          ctx.arc(item.x, item.y, item.radius * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // 니트로 아이템
          ctx.shadowColor = "#06b6d4";
          ctx.shadowBlur = 15;
          ctx.fillStyle = "#06b6d4";
          ctx.beginPath();
          ctx.arc(item.x, item.y, item.radius + 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 12px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("⚡", item.x, item.y);
        }
        ctx.restore();
      });

      // (6) 장애물 NPC 차량 그리기
      state.npcs.forEach((npc) => {
        ctx.save();
        ctx.shadowColor = npc.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = npc.color;

        // 차량 바디
        ctx.beginPath();
        ctx.roundRect(npc.x, npc.y, npc.width, npc.height, 8);
        ctx.fill();

        // 윈드실드 (유리창)
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(npc.x + 5, npc.y + 15, npc.width - 10, 14);
        ctx.fillRect(npc.x + 7, npc.y + 45, npc.width - 14, 10);

        // 헤드라이트 (앞쪽)
        ctx.fillStyle = "#fef08a";
        ctx.fillRect(npc.x + 4, npc.y + npc.height - 4, 8, 4);
        ctx.fillRect(npc.x + npc.width - 12, npc.y + npc.height - 4, 8, 4);
        ctx.restore();
      });

      // (7) 플레이어 스포츠카 그리기
      ctx.save();
      const px = state.playerX;
      const py = state.playerY;
      const pw = state.playerWidth;
      const ph = state.playerHeight;

      // 부스터 가동 시 후방 불꽃 이펙트
      if (state.nitroTimer > 0) {
        ctx.shadowColor = "#06b6d4";
        ctx.shadowBlur = 20;
        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.moveTo(px + 8, py + ph);
        ctx.lineTo(px + pw / 2, py + ph + 25 + Math.random() * 10);
        ctx.lineTo(px + pw - 8, py + ph);
        ctx.fill();
      }

      // 차량 차체 (사이버 네온 블루)
      ctx.shadowColor = state.nitroTimer > 0 ? "#06b6d4" : "#0284c7";
      ctx.shadowBlur = 15;
      ctx.fillStyle = "#0284c7";
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 10);
      ctx.fill();

      // 차량 중앙 레이싱 스트라이프 데칼
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(px + pw / 2 - 4, py + 4, 8, ph - 8);

      // 전면 유리창
      ctx.fillStyle = "#030712";
      ctx.beginPath();
      ctx.roundRect(px + 6, py + 16, pw - 12, 16, 4);
      ctx.fill();

      // 후면 창문
      ctx.fillRect(px + 8, py + 46, pw - 16, 10);

      // 전방 네온 헤드라이트 (전방 조명 빔 효과)
      ctx.shadowColor = "#e0f2fe";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(px + 4, py + 2, 7, 5);
      ctx.fillRect(px + pw - 11, py + 2, 7, 5);

      // 후방 테일램프 (빨간색 브레이크등)
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 12;
      ctx.fillStyle = state.keys.down ? "#ff0000" : "#b91c1c";
      ctx.fillRect(px + 4, py + ph - 5, 8, 4);
      ctx.fillRect(px + pw - 12, py + ph - 5, 8, 4);

      ctx.restore();

      // 다음 프레임 예약
      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, onGameOver, playSound]);

  // 모바일/터치 온스크린 조작 핸들러
  const handleTouchControl = (direction: "left" | "right" | "up" | "down", active: boolean) => {
    gameStateRef.current.keys[direction] = active;
  };

  return (
    <div className="flex flex-col items-center select-none w-full max-w-lg mx-auto">
      {/* 게임 헤더: 스탯 대시보드 */}
      <div className="w-full grid grid-cols-4 gap-2 mb-3 px-2">
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2 text-center">
          <div className="text-[10px] uppercase font-bold text-zinc-400">Score</div>
          <div className="text-xl font-black text-cyan-400 font-mono">{score}</div>
        </div>
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2 text-center">
          <div className="text-[10px] uppercase font-bold text-zinc-400">Speed</div>
          <div className="text-xl font-black text-emerald-400 font-mono">{speed} <span className="text-xs">km/h</span></div>
        </div>
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2 text-center">
          <div className="text-[10px] uppercase font-bold text-zinc-400">Level</div>
          <div className="text-xl font-black text-amber-400 font-mono">Lv.{level}</div>
        </div>
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2 text-center">
          <div className="text-[10px] uppercase font-bold text-zinc-400">High</div>
          <div className="text-xl font-black text-rose-400 font-mono">{Math.max(score, userHighScore)}</div>
        </div>
      </div>

      {/* 캔버스 화면 컨테이너 */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-cyan-500/40 shadow-[0_0_35px_rgba(6,182,212,0.2)] bg-black">
        <canvas
          ref={canvasRef}
          width={400}
          height={600}
          className="block w-full max-w-[400px] h-auto aspect-[2/3]"
        />

        {/* 음소거 토글 버튼 */}
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-zinc-900/80 border border-zinc-700 text-sm flex items-center justify-center text-white hover:bg-zinc-800 cursor-pointer"
          title={isMuted ? "소리 켜기" : "소리 끄기"}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>

        {/* 게임 시작 전 오버레이 */}
        {!isPlaying && !isGameOver && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white">
            <div className="text-5xl mb-4 animate-bounce">🏎️</div>
            <h2 className="text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 mb-2">
              CYBER NITRO RACING
            </h2>
            <p className="text-sm text-zinc-400 mb-6 max-w-xs">
              환영합니다, <span className="text-cyan-400 font-bold">{playerName}</span> 라이더님!
              <br />장애물 차량을 피하고 코인과 니트로를 획득하세요.
            </p>
            <button
              onClick={startGame}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950 font-black text-lg tracking-wider transition-all transform active:scale-95 shadow-lg shadow-cyan-500/30 cursor-pointer"
            >
              🏁 레이스 시작하기
            </button>
            <div className="mt-6 text-xs text-zinc-500 flex gap-4">
              <span>조작: ← → 또는 A D</span>
              <span>가속: ↑ 또는 W</span>
            </div>
          </div>
        )}

        {/* 게임 오버 오버레이 */}
        {isGameOver && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center text-white animate-in zoom-in-95 duration-200">
            <div className="text-5xl mb-3">💥</div>
            <h3 className="text-2xl font-black text-rose-500 tracking-wider mb-1">
              CRASH! GAME OVER
            </h3>
            <p className="text-xs text-zinc-400 mb-4">차량이 충돌했습니다!</p>

            <div className="w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">최종 점수:</span>
                <span className="font-bold text-cyan-400 font-mono text-lg">{score}점</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">도달 레벨:</span>
                <span className="font-bold text-amber-400 font-mono">Lv.{level}</span>
              </div>
              {score > userHighScore && (
                <div className="pt-2 border-t border-zinc-800 text-xs font-bold text-emerald-400 animate-pulse">
                  🎉 신기록 달성! 리더보드에 갱신됩니다!
                </div>
              )}
            </div>

            <button
              onClick={startGame}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950 font-black text-lg tracking-wider transition-all transform active:scale-95 shadow-lg shadow-cyan-500/30 cursor-pointer"
            >
              🔄 다시 도전하기
            </button>
          </div>
        )}
      </div>

      {/* 모바일 화면용 온스크린 터치 컨트롤러 */}
      <div className="w-full grid grid-cols-3 gap-2 mt-4 px-2">
        <button
          onMouseDown={() => handleTouchControl("left", true)}
          onMouseUp={() => handleTouchControl("left", false)}
          onTouchStart={() => handleTouchControl("left", true)}
          onTouchEnd={() => handleTouchControl("left", false)}
          className="py-4 bg-zinc-900/90 active:bg-cyan-500/30 border border-zinc-800 rounded-xl text-xl text-white font-bold flex items-center justify-center cursor-pointer"
        >
          ◀
        </button>
        <button
          onMouseDown={() => handleTouchControl("up", true)}
          onMouseUp={() => handleTouchControl("up", false)}
          onTouchStart={() => handleTouchControl("up", true)}
          onTouchEnd={() => handleTouchControl("up", false)}
          className="py-4 bg-zinc-900/90 active:bg-cyan-500/30 border border-zinc-800 rounded-xl text-sm text-cyan-400 font-bold flex flex-col items-center justify-center cursor-pointer"
        >
          <span>▲</span>
          <span className="text-[10px]">NITRO</span>
        </button>
        <button
          onMouseDown={() => handleTouchControl("right", true)}
          onMouseUp={() => handleTouchControl("right", false)}
          onTouchStart={() => handleTouchControl("right", true)}
          onTouchEnd={() => handleTouchControl("right", false)}
          className="py-4 bg-zinc-900/90 active:bg-cyan-500/30 border border-zinc-800 rounded-xl text-xl text-white font-bold flex items-center justify-center cursor-pointer"
        >
          ▶
        </button>
      </div>
    </div>
  );
}
