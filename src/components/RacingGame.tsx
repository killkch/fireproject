"use client";

/**
 * ========================================================
 * Harbor Steel 럭셔리 자동차 레이싱 게임 엔진 (src/components/RacingGame.tsx)
 * ========================================================
 * 
 * [디자인 테마: Harbor Steel]
 * - Primary (#c59b4c): 럭셔리 골드 하이퍼카 바디 및 스코어 강조
 * - Card/Surface (#192030): 정갈한 스틸 서피스 패널
 * - Border (#2e384d): 0.75rem(12px) 둥근 테두리 라인
 * - Destructive (#f43f44): 충돌 및 고위험 경고
 * 
 * [기능]
 * 60FPS 캔버스 렌더링, 키보드 및 모바일 터치 제어, Web Audio API 내장 효과음
 */

import React, { useRef, useEffect, useState, useCallback } from "react";

interface RacingGameProps {
  onGameOver: (finalScore: number, finalLevel: number) => void;
  userHighScore?: number;
  playerName?: string;
}

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

  // 60FPS 물리 연산용 참조값
  const gameStateRef = useRef({
    playerX: 180,
    playerY: 480,
    playerWidth: 44,
    playerHeight: 76,
    speed: 5.5,
    baseSpeed: 5.5,
    maxSpeed: 16,
    score: 0,
    distance: 0,
    level: 1,
    roadOffset: 0,
    keys: { left: false, right: false, up: false, down: false },
    npcs: [] as NPCVehicle[],
    items: [] as BonusItem[],
    nitroTimer: 0,
  });

  // -----------------------------------------------------------
  // 🔊 Web Audio API 효과음 신디사이저
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
        osc.type = "sine";
        osc.frequency.setValueAtTime(1046.50, now); // C6 골드 벨 소리
        osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === "nitro") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(640, now + 0.35);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === "crash") {
        osc.type = "square";
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(25, now + 0.45);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      }
    } catch {
      // 무시
    }
  }, [isMuted]);

  // -----------------------------------------------------------
  // 🎮 게임 시작
  // -----------------------------------------------------------
  const startGame = () => {
    initAudio();
    gameStateRef.current = {
      playerX: 180,
      playerY: 480,
      playerWidth: 44,
      playerHeight: 76,
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
  // ⌨️ 키보드 입력 핸들러 (e.key 널 가드 및 스크롤 방지 완비)
  // -----------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
  // 🕹️ 메인 60FPS Canvas 루프 (Harbor Steel 스타일 렌더링)
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

      // 1. 속도 제어
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

      // 2. 조작 이동
      const turnSpeed = 6;
      if (state.keys.left) state.playerX -= turnSpeed;
      if (state.keys.right) state.playerX += turnSpeed;

      if (state.playerX < roadLeft + 10) state.playerX = roadLeft + 10;
      if (state.playerX + state.playerWidth > roadRight - 10) {
        state.playerX = roadRight - 10 - state.playerWidth;
      }

      // 3. 점수 계산
      state.distance += state.speed;
      state.score = Math.floor(state.distance / 10);
      const newLevel = Math.min(10, Math.floor(state.score / 500) + 1);
      if (newLevel !== state.level) {
        state.level = newLevel;
        setLevel(newLevel);
      }
      setScore(state.score);
      setSpeed(Math.round(state.speed * 12));

      // 4. 도로 오프셋
      state.roadOffset = (state.roadOffset + state.speed) % 40;

      // 5. 장애물 NPC 스폰 (Harbor Steel 세련된 팔레트)
      if (Math.random() < 0.02 + state.level * 0.005 && state.npcs.length < 5) {
        const laneWidth = roadWidth / 3;
        const randomLane = Math.floor(Math.random() * 3);
        const spawnX = roadLeft + randomLane * laneWidth + (laneWidth - 42) / 2;
        
        const isOverlapping = state.npcs.some((npc) => Math.abs(npc.y - (-80)) < 120);
        if (!isOverlapping) {
          // Harbor Steel 팔레트와 조화로운 컬러군
          const npcColors = ["#f43f44", "#2b3856", "#475569", "#78716c", "#b45309"];
          state.npcs.push({
            x: spawnX,
            y: -90,
            width: 42,
            height: 72,
            speed: Math.max(2, state.speed - 3 + Math.random() * 2),
            color: npcColors[Math.floor(Math.random() * npcColors.length)],
          });
        }
      }

      // 6. 보너스 아이템 (골드 코인 / 스틸 니트로)
      if (Math.random() < 0.015 && state.items.length < 3) {
        const itemX = roadLeft + 30 + Math.random() * (roadWidth - 60);
        state.items.push({
          x: itemX,
          y: -40,
          type: Math.random() > 0.8 ? "nitro" : "coin",
          radius: 12,
        });
      }

      // 7. 충돌 판정
      for (let i = state.npcs.length - 1; i >= 0; i--) {
        const npc = state.npcs[i];
        npc.y += state.speed - npc.speed + 1;

        const hitPadding = 6;
        if (
          state.playerX + hitPadding < npc.x + npc.width - hitPadding &&
          state.playerX + state.playerWidth - hitPadding > npc.x + hitPadding &&
          state.playerY + hitPadding < npc.y + npc.height - hitPadding &&
          state.playerY + state.playerHeight - hitPadding > npc.y + hitPadding
        ) {
          playSound("crash");
          setIsPlaying(false);
          setIsGameOver(true);
          onGameOver(state.score, state.level);
          return;
        }

        if (npc.y > canvas.height + 100) {
          state.npcs.splice(i, 1);
        }
      }

      // 8. 아이템 획득 판정
      for (let i = state.items.length - 1; i >= 0; i--) {
        const item = state.items[i];
        item.y += state.speed;

        const playerCenterX = state.playerX + state.playerWidth / 2;
        const playerCenterY = state.playerY + state.playerHeight / 2;
        const dist = Math.hypot(playerCenterX - item.x, playerCenterY - item.y);

        if (dist < item.radius + state.playerWidth / 2 - 4) {
          if (item.type === "coin") {
            playSound("coin");
            state.distance += 1000;
          } else {
            playSound("nitro");
            state.nitroTimer = 180;
          }
          state.items.splice(i, 1);
          continue;
        }

        if (item.y > canvas.height + 50) {
          state.items.splice(i, 1);
        }
      }

      // -------------------------------------------------------
      // 🎨 Harbor Steel 감성 캔버스 렌더링
      // -------------------------------------------------------
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // (1) 외부 배경: 깊은 다크 스틸 (#121622)
      ctx.fillStyle = "#121622";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 사이드 엠보싱 라인
      ctx.strokeStyle = "rgba(46, 56, 77, 0.4)";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // (2) 도로 표면: 차분한 스틸 아스팔트 (#161c28)
      ctx.fillStyle = "#161c28";
      ctx.fillRect(roadLeft, 0, roadWidth, canvas.height);

      // (3) 도로 가드레일: 좌측 Harbor Gold (#c59b4c), 우측 Slate Blue (#2b3856)
      ctx.save();
      ctx.lineWidth = 3;
      // 좌측 골드 라인
      ctx.shadowColor = "#c59b4c";
      ctx.shadowBlur = 10;
      ctx.strokeStyle = "#c59b4c";
      ctx.beginPath();
      ctx.moveTo(roadLeft, 0);
      ctx.lineTo(roadLeft, canvas.height);
      ctx.stroke();

      // 우측 스틸 라인
      ctx.shadowColor = "#8e9ab0";
      ctx.shadowBlur = 8;
      ctx.strokeStyle = "#475569";
      ctx.beginPath();
      ctx.moveTo(roadRight, 0);
      ctx.lineTo(roadRight, canvas.height);
      ctx.stroke();
      ctx.restore();

      // (4) 도로 점선: 부드러운 오프화이트 (#e2e4e9)
      ctx.strokeStyle = "rgba(226, 228, 233, 0.25)";
      ctx.lineWidth = 3;
      ctx.setLineDash([24, 24]);
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
      ctx.setLineDash([]);

      // (5) 아이템 드로잉 (골드 코인 / 스틸 니트로)
      state.items.forEach((item) => {
        ctx.save();
        if (item.type === "coin") {
          ctx.shadowColor = "#c59b4c";
          ctx.shadowBlur = 12;
          ctx.fillStyle = "#c59b4c";
          ctx.beginPath();
          ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#fef3c7";
          ctx.beginPath();
          ctx.arc(item.x, item.y, item.radius * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.shadowColor = "#e2e4e9";
          ctx.shadowBlur = 12;
          ctx.fillStyle = "#2b3856";
          ctx.beginPath();
          ctx.arc(item.x, item.y, item.radius + 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#c59b4c";
          ctx.font = "bold 13px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("⚡", item.x, item.y);
        }
        ctx.restore();
      });

      // (6) 장애물 NPC 차량 (Harbor Steel 스틸 카 디자인)
      state.npcs.forEach((npc) => {
        ctx.save();
        ctx.shadowColor = npc.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = npc.color;

        ctx.beginPath();
        ctx.roundRect(npc.x, npc.y, npc.width, npc.height, 10);
        ctx.fill();

        // 윈드실드
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(npc.x + 5, npc.y + 15, npc.width - 10, 14);
        ctx.fillRect(npc.x + 6, npc.y + 46, npc.width - 12, 10);

        // 헤드라이트 (앞쪽)
        ctx.fillStyle = "#fef08a";
        ctx.fillRect(npc.x + 4, npc.y + npc.height - 4, 7, 3);
        ctx.fillRect(npc.x + npc.width - 11, npc.y + npc.height - 4, 7, 3);
        ctx.restore();
      });

      // (7) ⭐️ 플레이어 스포츠카: 럭셔리 Harbor Gold & 카본 블랙 하이퍼카
      ctx.save();
      const px = state.playerX;
      const py = state.playerY;
      const pw = state.playerWidth;
      const ph = state.playerHeight;

      // 부스터 불꽃
      if (state.nitroTimer > 0) {
        ctx.shadowColor = "#c59b4c";
        ctx.shadowBlur = 20;
        ctx.fillStyle = "#fef08a";
        ctx.beginPath();
        ctx.moveTo(px + 9, py + ph);
        ctx.lineTo(px + pw / 2, py + ph + 24 + Math.random() * 8);
        ctx.lineTo(px + pw - 9, py + ph);
        ctx.fill();
      }

      // 바디: Harbor Gold (#c59b4c)
      ctx.shadowColor = "#c59b4c";
      ctx.shadowBlur = state.nitroTimer > 0 ? 18 : 10;
      ctx.fillStyle = "#c59b4c";
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 12);
      ctx.fill();

      // 중앙 카본 스트라이프
      ctx.fillStyle = "#121622";
      ctx.fillRect(px + pw / 2 - 4, py + 4, 8, ph - 8);

      // 전면 유리창
      ctx.fillStyle = "#0b0e17";
      ctx.beginPath();
      ctx.roundRect(px + 6, py + 16, pw - 12, 16, 4);
      ctx.fill();

      // 후면 창
      ctx.fillRect(px + 8, py + 46, pw - 16, 10);

      // 전면 크롬 헤드라이트
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(px + 4, py + 2, 7, 5);
      ctx.fillRect(px + pw - 11, py + 2, 7, 5);

      // 후방 브레이크등 (코랄 레드 #f43f44)
      ctx.shadowColor = "#f43f44";
      ctx.shadowBlur = 12;
      ctx.fillStyle = state.keys.down ? "#ff1f24" : "#f43f44";
      ctx.fillRect(px + 4, py + ph - 5, 8, 4);
      ctx.fillRect(px + pw - 12, py + ph - 5, 8, 4);

      ctx.restore();

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, onGameOver, playSound]);

  const handleTouchControl = (direction: "left" | "right" | "up" | "down", active: boolean) => {
    gameStateRef.current.keys[direction] = active;
  };

  return (
    <div className="flex flex-col items-center select-none w-full max-w-lg mx-auto">
      {/* ---------------------------------------------------- */}
      {/* 상단 스탯 대시보드 (Harbor Steel 카드, 0.75rem 곡률)   */}
      {/* ---------------------------------------------------- */}
      <div className="w-full grid grid-cols-4 gap-2.5 mb-3 px-1">
        <div className="bg-[#192030] border border-[#2e384d] rounded-xl p-2.5 text-center shadow-md">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#8e9ab0]">Score</div>
          <div className="text-xl font-black text-[#c59b4c] font-mono">{score}</div>
        </div>
        <div className="bg-[#192030] border border-[#2e384d] rounded-xl p-2.5 text-center shadow-md">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#8e9ab0]">Speed</div>
          <div className="text-xl font-black text-[#e2e4e9] font-mono">{speed} <span className="text-[10px] text-[#8e9ab0]">km/h</span></div>
        </div>
        <div className="bg-[#192030] border border-[#2e384d] rounded-xl p-2.5 text-center shadow-md">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#8e9ab0]">Level</div>
          <div className="text-xl font-black text-[#c59b4c] font-mono">Lv.{level}</div>
        </div>
        <div className="bg-[#192030] border border-[#2e384d] rounded-xl p-2.5 text-center shadow-md">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#8e9ab0]">Best</div>
          <div className="text-xl font-black text-[#f43f44] font-mono">{Math.max(score, userHighScore)}</div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 캔버스 화면 컨테이너 (Harbor Steel 테두리 & 라운딩)      */}
      {/* ---------------------------------------------------- */}
      <div className="relative rounded-xl overflow-hidden border border-[#2e384d] shadow-[0_12px_36px_rgba(0,0,0,0.5)] bg-[#121622]">
        <canvas
          ref={canvasRef}
          width={400}
          height={600}
          className="block w-full max-w-[400px] h-auto aspect-[2/3]"
        />

        {/* 음소거 버튼 */}
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-xl bg-[#192030]/90 border border-[#2e384d] text-sm flex items-center justify-center text-[#e2e4e9] hover:border-[#c59b4c] transition-colors cursor-pointer"
          title={isMuted ? "소리 켜기" : "소리 끄기"}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>

        {/* 시작 화면 오버레이 */}
        {!isPlaying && !isGameOver && (
          <div className="absolute inset-0 bg-[#121622]/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-[#e2e4e9]">
            <div className="text-5xl mb-4 animate-bounce">🏎️</div>
            <h2 className="text-2xl font-black tracking-wider text-[#c59b4c] mb-1.5 uppercase font-mono">
              HARBOR STEEL RACING
            </h2>
            <p className="text-xs text-[#8e9ab0] mb-6 max-w-xs leading-relaxed">
              환영합니다, <span className="text-[#e2e4e9] font-bold">{playerName}</span> 님!<br />
              골드 코인과 니트로를 획득하여 최고 기록을 경신하세요.
            </p>
            <button
              onClick={startGame}
              className="px-8 py-3.5 rounded-xl bg-[#c59b4c] hover:bg-[#d8ad5a] text-[#121622] font-black text-sm tracking-wider transition-all transform active:scale-95 shadow-lg shadow-[#c59b4c]/20 cursor-pointer"
            >
              🏁 레이스 시작하기
            </button>
            <div className="mt-6 text-[11px] text-[#8e9ab0] flex gap-4">
              <span>이동: ← → (A, D)</span>
              <span>가속: ↑ (W)</span>
            </div>
          </div>
        )}

        {/* 게임 오버 화면 오버레이 */}
        {isGameOver && (
          <div className="absolute inset-0 bg-[#121622]/95 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-[#e2e4e9] animate-in zoom-in-95 duration-200">
            <div className="text-4xl mb-2">💥</div>
            <h3 className="text-2xl font-black text-[#f43f44] tracking-wider mb-1">
              CRASH! GAME OVER
            </h3>
            <p className="text-xs text-[#8e9ab0] mb-5">차량이 장애물과 충돌했습니다.</p>

            <div className="w-full max-w-xs bg-[#192030] border border-[#2e384d] rounded-xl p-4 mb-6 space-y-2 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-[#8e9ab0]">최종 기록:</span>
                <span className="font-bold text-[#c59b4c] font-mono text-base">{score}점</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#8e9ab0]">달성 레벨:</span>
                <span className="font-bold text-[#e2e4e9] font-mono">Lv.{level}</span>
              </div>
              {score > userHighScore && (
                <div className="pt-2 border-t border-[#2e384d] text-xs font-bold text-[#c59b4c] text-center">
                  🎉 신기록 달성! 순위표에 등록되었습니다.
                </div>
              )}
            </div>

            <button
              onClick={startGame}
              className="px-8 py-3.5 rounded-xl bg-[#c59b4c] hover:bg-[#d8ad5a] text-[#121622] font-black text-sm tracking-wider transition-all transform active:scale-95 shadow-lg shadow-[#c59b4c]/20 cursor-pointer"
            >
              🔄 다시 도전하기
            </button>
          </div>
        )}
      </div>

      {/* 모바일 화면용 터치 버튼 (0.75rem 곡률) */}
      <div className="w-full grid grid-cols-3 gap-2 mt-4 px-1">
        <button
          onMouseDown={() => handleTouchControl("left", true)}
          onMouseUp={() => handleTouchControl("left", false)}
          onTouchStart={() => handleTouchControl("left", true)}
          onTouchEnd={() => handleTouchControl("left", false)}
          className="py-3.5 bg-[#192030] active:bg-[#2b3856] border border-[#2e384d] rounded-xl text-lg text-[#e2e4e9] font-bold flex items-center justify-center cursor-pointer transition-colors"
        >
          ◀
        </button>
        <button
          onMouseDown={() => handleTouchControl("up", true)}
          onMouseUp={() => handleTouchControl("up", false)}
          onTouchStart={() => handleTouchControl("up", true)}
          onTouchEnd={() => handleTouchControl("up", false)}
          className="py-3.5 bg-[#192030] active:bg-[#2b3856] border border-[#2e384d] rounded-xl text-xs text-[#c59b4c] font-bold flex flex-col items-center justify-center cursor-pointer transition-colors"
        >
          <span>▲</span>
          <span className="text-[9px] text-[#8e9ab0]">BOOST</span>
        </button>
        <button
          onMouseDown={() => handleTouchControl("right", true)}
          onMouseUp={() => handleTouchControl("right", false)}
          onTouchStart={() => handleTouchControl("right", true)}
          onTouchEnd={() => handleTouchControl("right", false)}
          className="py-3.5 bg-[#192030] active:bg-[#2b3856] border border-[#2e384d] rounded-xl text-lg text-[#e2e4e9] font-bold flex items-center justify-center cursor-pointer transition-colors"
        >
          ▶
        </button>
      </div>
    </div>
  );
}
