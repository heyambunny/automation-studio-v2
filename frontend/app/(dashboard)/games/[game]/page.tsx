"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Trophy, Bird, Blocks, Zap, Rocket, Hammer, Timer, Layers, Sword } from "lucide-react";
import { api } from "@/lib/api";

const gameInfo: Record<string, any> = {
  flappy: { name: "Flappy Bird", icon: Bird, color: "bg-sky-50 text-sky-600" },
  breakout: { name: "Breakout", icon: Blocks, color: "bg-orange-50 text-orange-600" },
  snake: { name: "Snake", icon: Zap, color: "bg-emerald-50 text-emerald-600" },
  invaders: { name: "Space Invaders", icon: Rocket, color: "bg-purple-50 text-purple-600" },
  whackamole: { name: "Whack-a-Mole", icon: Hammer, color: "bg-amber-50 text-amber-600" },
  reaction: { name: "Reaction Time", icon: Timer, color: "bg-red-50 text-red-600" },
  stacker: { name: "Stack Tower", icon: Layers, color: "bg-cyan-50 text-cyan-600" },
  fruitslice: { name: "Fruit Slice", icon: Sword, color: "bg-pink-50 text-pink-600" },
};

function StartOverlay({ label, sub, onStart }: { label: string; sub?: string; onStart: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/10 dark:bg-black/30 rounded-lg">
      <button
        onClick={(e) => { e.stopPropagation(); onStart(); }}
        className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-white/10 rounded-xl px-6 py-4 text-center shadow-lg hover:scale-105 transition-transform cursor-pointer"
      >
        <p className="font-semibold text-sm text-zinc-800 dark:text-white">{label}</p>
        {sub && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{sub}</p>}
      </button>
    </div>
  );
}

/* ---------------- Flappy Bird ---------------- */
function FlappyBird({ onScore }: { onScore: (score: number) => void }) {
  const W = 320, H = 380, BIRD_X = 56, BIRD_R = 12, GAP_H = 130, PIPE_W = 46, PIPE_SPEED = 2.6, GRAVITY = 0.45, FLAP_V = -7.2;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => parseInt(localStorage.getItem("flappy_best") || "0"));
  const engine = useRef({ y: H / 2, v: 0, pipes: [{ x: W + 60, gapTop: 120, passed: false }] as { x: number; gapTop: number; passed: boolean }[], ended: false });
  const scoreRef = useRef(0);

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const e = engine.current;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#22c55e";
    for (const p of e.pipes) {
      ctx.fillRect(p.x, 0, PIPE_W, p.gapTop);
      ctx.fillRect(p.x, p.gapTop + GAP_H, PIPE_W, H - (p.gapTop + GAP_H));
    }
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(BIRD_X, e.y, BIRD_R, 0, Math.PI * 2);
    ctx.fill();
  };

  useEffect(() => { draw(); }, []);

  const start = () => {
    engine.current = { y: H / 2, v: FLAP_V, pipes: [{ x: W + 60, gapTop: 120, passed: false }], ended: false };
    scoreRef.current = 0;
    setScore(0);
    setGameOver(false);
    setIsPlaying(true);
  };

  const flap = () => {
    if (gameOver) return;
    if (!isPlaying) { start(); return; }
    engine.current.v = FLAP_V;
  };

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const e = engine.current;
      e.v += GRAVITY;
      e.y += e.v;

      e.pipes = e.pipes.map(p => ({ ...p, x: p.x - PIPE_SPEED })).filter(p => p.x + PIPE_W > -5);
      const last = e.pipes[e.pipes.length - 1];
      if (!last || last.x < W - 170) {
        const gapTop = 40 + Math.random() * (H - 80 - GAP_H);
        e.pipes.push({ x: W + 10, gapTop, passed: false });
      }

      let died = e.y - BIRD_R < 0 || e.y + BIRD_R > H;
      let gained = 0;
      for (const p of e.pipes) {
        const withinX = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W;
        if (withinX && (e.y - BIRD_R < p.gapTop || e.y + BIRD_R > p.gapTop + GAP_H)) died = true;
        if (!p.passed && p.x + PIPE_W < BIRD_X - BIRD_R) {
          p.passed = true;
          gained += 1;
        }
      }
      if (gained > 0) { scoreRef.current += gained; setScore(scoreRef.current); }
      draw();

      if (died && !e.ended) {
        e.ended = true;
        const finalScore = scoreRef.current;
        setIsPlaying(false);
        setGameOver(true);
        setScore(finalScore);
        if (finalScore > best) { setBest(finalScore); localStorage.setItem("flappy_best", String(finalScore)); }
        onScore(finalScore * 10);
      }
    }, 22);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  useEffect(() => {
    const handleKey = (ev: KeyboardEvent) => { if (ev.key === " ") { ev.preventDefault(); flap(); } };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, gameOver]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm">Score: {score} | Best: {best}</span>
      </div>
      <div
        className="relative rounded-lg overflow-hidden bg-sky-100 dark:bg-sky-950/40 cursor-pointer mx-auto"
        style={{ width: W, maxWidth: "100%" }}
        onClick={flap}
      >
        <canvas ref={canvasRef} width={W} height={H} className="block w-full h-auto" />
        {!isPlaying && <StartOverlay label={gameOver ? `Game Over — ${score}` : "Click to Start"} sub="Click or press Space to flap" onStart={flap} />}
      </div>
    </div>
  );
}

/* ---------------- Breakout ---------------- */
function Breakout({ onScore }: { onScore: (score: number) => void }) {
  const W = 320, H = 380, ROWS = 5, COLS = 8, MARGIN = 10, BRICK_W = (W - MARGIN * 2 - (COLS - 1) * 4) / COLS, BRICK_H = 14, GAP = 4, TOP = 30;
  const PADDLE_W = 60, PADDLE_H = 10, PADDLE_Y = H - 20, BALL_R = 6;
  const rowColors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6"];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const keys = useRef({ left: false, right: false });
  const scoreRef = useRef(0);
  const engine = useRef({
    paddleX: W / 2 - PADDLE_W / 2,
    ball: { x: W / 2, y: PADDLE_Y - BALL_R - 1, vx: 3, vy: -3 },
    bricks: Array.from({ length: ROWS }, () => Array(COLS).fill(1)),
    ended: false,
  });

  const resetBall = () => {
    const e = engine.current;
    e.ball = { x: e.paddleX + PADDLE_W / 2, y: PADDLE_Y - BALL_R - 1, vx: 3, vy: -3 };
  };

  const draw = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const e = engine.current;
    ctx.clearRect(0, 0, W, H);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!e.bricks[r][c]) continue;
        ctx.fillStyle = rowColors[r];
        ctx.fillRect(MARGIN + c * (BRICK_W + GAP), TOP + r * (BRICK_H + GAP), BRICK_W, BRICK_H);
      }
    }
    ctx.fillStyle = "#0A0A0A";
    ctx.fillRect(e.paddleX, PADDLE_Y, PADDLE_W, PADDLE_H);
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(e.ball.x, e.ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
  };

  useEffect(() => { draw(); }, []);

  const start = () => {
    engine.current = {
      paddleX: W / 2 - PADDLE_W / 2,
      ball: { x: W / 2, y: PADDLE_Y - BALL_R - 1, vx: 3, vy: -3 },
      bricks: Array.from({ length: ROWS }, () => Array(COLS).fill(1)),
      ended: false,
    };
    scoreRef.current = 0;
    setScore(0);
    setLives(3);
    setGameOver(false);
    setWon(false);
    setIsPlaying(true);
  };

  useEffect(() => {
    const onDown = (ev: KeyboardEvent) => {
      if (ev.key === "ArrowLeft") keys.current.left = true;
      if (ev.key === "ArrowRight") keys.current.right = true;
    };
    const onUp = (ev: KeyboardEvent) => {
      if (ev.key === "ArrowLeft") keys.current.left = false;
      if (ev.key === "ArrowRight") keys.current.right = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const e = engine.current;
      if (keys.current.left) e.paddleX = Math.max(0, e.paddleX - 6);
      if (keys.current.right) e.paddleX = Math.min(W - PADDLE_W, e.paddleX + 6);

      e.ball.x += e.ball.vx;
      e.ball.y += e.ball.vy;
      if (e.ball.x < BALL_R) { e.ball.x = BALL_R; e.ball.vx *= -1; }
      if (e.ball.x > W - BALL_R) { e.ball.x = W - BALL_R; e.ball.vx *= -1; }
      if (e.ball.y < BALL_R) { e.ball.y = BALL_R; e.ball.vy *= -1; }

      if (
        e.ball.vy > 0 &&
        e.ball.y + BALL_R >= PADDLE_Y && e.ball.y + BALL_R <= PADDLE_Y + PADDLE_H + 6 &&
        e.ball.x >= e.paddleX - BALL_R && e.ball.x <= e.paddleX + PADDLE_W + BALL_R
      ) {
        const hitPos = (e.ball.x - (e.paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
        e.ball.vy = -Math.abs(e.ball.vy);
        e.ball.vx = hitPos * 4.5;
        e.ball.y = PADDLE_Y - BALL_R;
      }

      let gained = 0;
      brickLoop: for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!e.bricks[r][c]) continue;
          const bx = MARGIN + c * (BRICK_W + GAP), by = TOP + r * (BRICK_H + GAP);
          if (e.ball.x + BALL_R > bx && e.ball.x - BALL_R < bx + BRICK_W && e.ball.y + BALL_R > by && e.ball.y - BALL_R < by + BRICK_H) {
            e.bricks[r][c] = 0;
            e.ball.vy *= -1;
            gained += 10;
            break brickLoop;
          }
        }
      }
      if (gained > 0) { scoreRef.current += gained; setScore(scoreRef.current); }

      const remaining = e.bricks.some(row => row.some(Boolean));
      if (!remaining && !e.ended) {
        e.ended = true;
        draw();
        setIsPlaying(false);
        setWon(true);
        onScore(scoreRef.current + 200);
        return;
      }

      if (e.ball.y - BALL_R > H && !e.ended) {
        setLives(l => {
          const nl = l - 1;
          if (nl <= 0) {
            e.ended = true;
            setIsPlaying(false);
            setGameOver(true);
            onScore(scoreRef.current);
          } else {
            resetBall();
          }
          return Math.max(0, nl);
        });
      }

      draw();
    }, 20);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm">Score: {score} | Lives: {"❤️".repeat(Math.max(lives, 0))}</span>
      </div>
      <div className="relative rounded-lg overflow-hidden bg-zinc-100 dark:bg-white/5 mx-auto" style={{ width: W, maxWidth: "100%" }}>
        <canvas ref={canvasRef} width={W} height={H} className="block w-full h-auto" />
        {!isPlaying && (
          <StartOverlay
            label={won ? `You Win! — ${score}` : gameOver ? `Game Over — ${score}` : "Click to Start"}
            sub="Arrow keys to move the paddle"
            onStart={start}
          />
        )}
      </div>
    </div>
  );
}

/* ---------------- Snake ---------------- */
function SnakeGame({ onScore }: { onScore: (score: number) => void }) {
  const [snake, setSnake] = useState([{ x: 10, y: 10 }]);
  const [food, setFood] = useState({ x: 5, y: 5 });
  const [direction, setDirection] = useState("right");
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem("snake_high") || "0"));
  const ended = useRef(false);

  useEffect(() => {
    if (!isPlaying) return;
    ended.current = false;
    const interval = setInterval(() => {
      setSnake(prev => {
        const head = { ...prev[0] };
        if (direction === "right") head.x += 1;
        if (direction === "left") head.x -= 1;
        if (direction === "up") head.y -= 1;
        if (direction === "down") head.y += 1;
        if (head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 20 || prev.some(s => s.x === head.x && s.y === head.y)) {
          if (!ended.current) {
            ended.current = true;
            setGameOver(true);
            setIsPlaying(false);
            if (score > highScore) { setHighScore(score); localStorage.setItem("snake_high", String(score)); }
            onScore(score * 10);
          }
          return prev;
        }
        if (head.x === food.x && head.y === food.y) {
          setScore(s => s + 1);
          setFood({ x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20) });
          return [head, ...prev];
        }
        return [head, ...prev.slice(0, -1)];
      });
    }, 120);
    return () => clearInterval(interval);
  }, [isPlaying, direction, food]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" && direction !== "down") setDirection("up");
      if (e.key === "ArrowDown" && direction !== "up") setDirection("down");
      if (e.key === "ArrowLeft" && direction !== "right") setDirection("left");
      if (e.key === "ArrowRight" && direction !== "left") setDirection("right");
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [direction]);

  const startGame = () => {
    setSnake([{ x: 10, y: 10 }]);
    setScore(0);
    setGameOver(false);
    setDirection("right");
    setFood({ x: 5, y: 5 });
    setIsPlaying(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm">Score: {score} | High: {highScore}</span>
        {!isPlaying && <button onClick={startGame} className="px-4 py-2 bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-lg text-sm cursor-pointer">{gameOver ? "Restart" : "Start"}</button>}
      </div>
      <div className="grid gap-px bg-zinc-200 dark:bg-white/10 rounded-lg overflow-hidden" style={{ gridTemplateColumns: "repeat(20, 1fr)" }}>
        {Array.from({ length: 400 }, (_, i) => {
          const x = i % 20, y = Math.floor(i / 20);
          const isSnake = snake.some(s => s.x === x && s.y === y);
          const isFood = food.x === x && food.y === y;
          return <div key={i} className={`aspect-square ${isSnake ? "bg-emerald-600" : isFood ? "bg-red-500" : "bg-white dark:bg-white/5"}`} />;
        })}
      </div>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-3 text-center">Use arrow keys to move</p>
    </div>
  );
}

/* ---------------- Space Invaders ---------------- */
function SpaceInvaders({ onScore }: { onScore: (score: number) => void }) {
  const W = 320, H = 380, ROWS = 4, COLS = 6, ALIEN_W = 26, ALIEN_H = 16, GAP_X = 10, GAP_Y = 14;
  const PLAYER_W = 26, PLAYER_H = 12, PLAYER_Y = H - 22;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [score, setScore] = useState(0);
  const keys = useRef({ left: false, right: false });
  const lastShot = useRef(0);
  const scoreRef = useRef(0);
  const groupW = COLS * ALIEN_W + (COLS - 1) * GAP_X;

  const freshAliens = () => Array.from({ length: ROWS }, () => Array(COLS).fill(1));
  const engine = useRef({
    playerX: W / 2 - PLAYER_W / 2,
    bullet: null as { x: number; y: number } | null,
    aliens: freshAliens(),
    offsetX: (W - groupW) / 2,
    offsetY: 20,
    dir: 1,
    speed: 1.4,
    ended: false,
  });

  const draw = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const e = engine.current;
    ctx.fillStyle = "#0b1120";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#a855f7";
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!e.aliens[r][c]) continue;
        ctx.fillRect(e.offsetX + c * (ALIEN_W + GAP_X), e.offsetY + r * (ALIEN_H + GAP_Y), ALIEN_W, ALIEN_H);
      }
    }
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(e.playerX, PLAYER_Y, PLAYER_W, PLAYER_H);
    if (e.bullet) {
      ctx.fillStyle = "#facc15";
      ctx.fillRect(e.bullet.x - 2, e.bullet.y, 4, 10);
    }
  };

  useEffect(() => { draw(); }, []);

  const start = () => {
    engine.current = { playerX: W / 2 - PLAYER_W / 2, bullet: null, aliens: freshAliens(), offsetX: (W - groupW) / 2, offsetY: 20, dir: 1, speed: 1.4, ended: false };
    scoreRef.current = 0;
    setScore(0);
    setGameOver(false);
    setWon(false);
    setIsPlaying(true);
  };

  const shoot = () => {
    const e = engine.current;
    const now = Date.now();
    if (e.bullet || now - lastShot.current < 250) return;
    lastShot.current = now;
    e.bullet = { x: e.playerX + PLAYER_W / 2, y: PLAYER_Y };
  };

  useEffect(() => {
    const onDown = (ev: KeyboardEvent) => {
      if (ev.key === "ArrowLeft") keys.current.left = true;
      if (ev.key === "ArrowRight") keys.current.right = true;
      if (ev.key === " ") { ev.preventDefault(); shoot(); }
    };
    const onUp = (ev: KeyboardEvent) => {
      if (ev.key === "ArrowLeft") keys.current.left = false;
      if (ev.key === "ArrowRight") keys.current.right = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const e = engine.current;
      if (keys.current.left) e.playerX = Math.max(0, e.playerX - 5);
      if (keys.current.right) e.playerX = Math.min(W - PLAYER_W, e.playerX + 5);

      const aliveCols = e.aliens.some(row => row.some(Boolean));
      if (aliveCols) {
        let minX = Infinity, maxX = -Infinity;
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          if (e.aliens[r][c]) {
            const ax = e.offsetX + c * (ALIEN_W + GAP_X);
            minX = Math.min(minX, ax);
            maxX = Math.max(maxX, ax + ALIEN_W);
          }
        }
        e.offsetX += e.dir * e.speed;
        if (minX + e.dir * e.speed < 4 || maxX + e.dir * e.speed > W - 4) {
          e.dir *= -1;
          e.offsetY += 14;
        }
      }

      if (e.bullet) {
        e.bullet.y -= 6;
        if (e.bullet.y < 0) e.bullet.y = -100;
      }

      let gained = 0;
      if (e.bullet && e.bullet.y > -50) {
        outer: for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (!e.aliens[r][c]) continue;
            const ax = e.offsetX + c * (ALIEN_W + GAP_X), ay = e.offsetY + r * (ALIEN_H + GAP_Y);
            if (e.bullet.x > ax && e.bullet.x < ax + ALIEN_W && e.bullet.y > ay && e.bullet.y < ay + ALIEN_H) {
              e.aliens[r][c] = 0;
              e.bullet = null;
              gained = 15;
              break outer;
            }
          }
        }
      }
      if (gained > 0) { scoreRef.current += gained; setScore(scoreRef.current); }

      const stillAlive = e.aliens.some(row => row.some(Boolean));
      if (!stillAlive && !e.ended) {
        e.ended = true;
        draw();
        setIsPlaying(false);
        setWon(true);
        onScore(scoreRef.current + 100);
        return;
      }
      if (stillAlive && e.offsetY + ROWS * (ALIEN_H + GAP_Y) > PLAYER_Y && !e.ended) {
        e.ended = true;
        draw();
        setIsPlaying(false);
        setGameOver(true);
        onScore(scoreRef.current);
        return;
      }

      draw();
    }, 30);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm">Score: {score}</span>
      </div>
      <div className="relative rounded-lg overflow-hidden mx-auto cursor-pointer" style={{ width: W, maxWidth: "100%" }} onClick={shoot}>
        <canvas ref={canvasRef} width={W} height={H} className="block w-full h-auto" />
        {!isPlaying && (
          <StartOverlay
            label={won ? `Fleet Cleared! — ${score}` : gameOver ? `Game Over — ${score}` : "Click to Start"}
            sub="Arrow keys to move, Space or click to shoot"
            onStart={start}
          />
        )}
      </div>
    </div>
  );
}

/* ---------------- Whack-a-Mole ---------------- */
function WhackAMole({ onScore }: { onScore: (score: number) => void }) {
  const HOLES = 9;
  const [active, setActive] = useState<boolean[]>(Array(HOLES).fill(false));
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [best, setBest] = useState(() => parseInt(localStorage.getItem("whack_best") || "0"));
  const hideTimeouts = useRef<Record<number, any>>({});
  const reported = useRef(false);

  const popMole = () => {
    setActive(prev => {
      const emptyIdx = prev.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
      if (emptyIdx.length === 0) return prev;
      const idx = emptyIdx[Math.floor(Math.random() * emptyIdx.length)];
      const next = [...prev];
      next[idx] = true;
      clearTimeout(hideTimeouts.current[idx]);
      hideTimeouts.current[idx] = setTimeout(() => {
        setActive(p => { const n = [...p]; n[idx] = false; return n; });
      }, 750);
      return next;
    });
  };

  const handleHoleClick = (idx: number) => {
    if (!isPlaying) return;
    if (active[idx]) {
      setActive(prev => { const n = [...prev]; n[idx] = false; return n; });
      clearTimeout(hideTimeouts.current[idx]);
      setScore(s => s + 10);
    }
  };

  useEffect(() => {
    if (!isPlaying) return;
    const spawn = setInterval(popMole, 650);
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setIsPlaying(false);
          setGameOver(true);
          setActive(Array(HOLES).fill(false));
          Object.values(hideTimeouts.current).forEach(clearTimeout);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { clearInterval(spawn); clearInterval(timer); };
  }, [isPlaying]);

  useEffect(() => {
    if (gameOver && !reported.current) {
      reported.current = true;
      if (score > best) { setBest(score); localStorage.setItem("whack_best", String(score)); }
      onScore(score);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  const start = () => {
    Object.values(hideTimeouts.current).forEach(clearTimeout);
    reported.current = false;
    setActive(Array(HOLES).fill(false));
    setScore(0);
    setTimeLeft(30);
    setGameOver(false);
    setIsPlaying(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm">Score: {score} | Best: {best}</span>
        <span className="text-sm font-medium">⏱ {timeLeft}s</span>
      </div>
      <div className="relative">
        <div className="grid grid-cols-3 gap-3">
          {active.map((on, idx) => (
            <button
              key={idx}
              onClick={() => handleHoleClick(idx)}
              disabled={!isPlaying}
              className="aspect-square rounded-full bg-zinc-200 dark:bg-white/10 flex items-center justify-center text-4xl overflow-hidden cursor-pointer disabled:cursor-default"
            >
              <span className={`transition-transform duration-100 ${on ? "scale-100" : "scale-0"}`}>🐹</span>
            </button>
          ))}
        </div>
        {!isPlaying && (
          <StartOverlay label={gameOver ? `Time's Up! — ${score}` : "Click to Start"} sub="30 seconds, whack every mole you can" onStart={start} />
        )}
      </div>
    </div>
  );
}

/* ---------------- Reaction Time ---------------- */
function ReactionGame({ onScore }: { onScore: (score: number) => void }) {
  const [state, setState] = useState<"idle" | "waiting" | "ready" | "result">("idle");
  const [score, setScore] = useState<number | null>(null);
  const [bestScore, setBestScore] = useState<number | null>(() => parseInt(localStorage.getItem("reaction_best") || "0") || null);

  const start = () => {
    setState("waiting");
    const delay = Math.random() * 3000 + 1000;
    setTimeout(() => {
      setState("ready");
      const startTime = Date.now();
      setTimeout(() => setState("idle"), 2000);
      (window as any).__reactionStart = startTime;
    }, delay);
  };

  const handleClick = () => {
    if (state === "ready" && (window as any).__reactionStart) {
      const reaction = Date.now() - (window as any).__reactionStart;
      setScore(reaction);
      if (!bestScore || reaction < bestScore) { setBestScore(reaction); localStorage.setItem("reaction_best", String(reaction)); }
      setState("result");
      onScore(Math.max(0, 1000 - reaction));
    }
  };

  return (
    <div>
      <button onClick={state === "idle" || state === "result" ? start : handleClick} className={`w-full h-40 rounded-lg text-xl font-bold transition-all cursor-pointer ${state === "waiting" ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400" : state === "ready" ? "bg-emerald-500 text-white" : "bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10"}`}>
        {state === "idle" && "Click to Start"}
        {state === "waiting" && "Wait for green..."}
        {state === "ready" && "CLICK NOW!"}
        {state === "result" && `${score}ms — click to retry`}
      </button>
      {bestScore && <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mt-4">🏆 Best: {bestScore}ms</p>}
    </div>
  );
}

/* ---------------- Stack Tower ---------------- */
function StackTower({ onScore }: { onScore: (score: number) => void }) {
  const CW = 280, BH = 26, VISIBLE = 9, BASE_W = 120;
  const palette = ["#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444"];
  type Block = { left: number; width: number; color: string };
  const [stack, setStack] = useState<Block[]>([{ left: (CW - BASE_W) / 2, width: BASE_W, color: palette[0] }]);
  const [current, setCurrent] = useState<{ left: number; width: number; dir: number; speed: number } | null>(null);
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [best, setBest] = useState(() => parseInt(localStorage.getItem("stacker_best") || "0"));

  const start = () => {
    const base = { left: (CW - BASE_W) / 2, width: BASE_W, color: palette[0] };
    setStack([base]);
    setCurrent({ left: 0, width: BASE_W, dir: 1, speed: 2 });
    setScore(0);
    setGameOver(false);
    setIsPlaying(true);
  };

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrent(cur => {
        if (!cur) return cur;
        let left = cur.left + cur.dir * cur.speed;
        let dir = cur.dir;
        const maxLeft = CW - cur.width;
        if (left < 0) { left = 0; dir = 1; }
        if (left > maxLeft) { left = maxLeft; dir = -1; }
        return { ...cur, left, dir };
      });
    }, 20);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const drop = () => {
    if (!isPlaying || !current) return;
    const top = stack[stack.length - 1];
    const overlapLeft = Math.max(current.left, top.left);
    const overlapRight = Math.min(current.left + current.width, top.left + top.width);
    const overlapWidth = overlapRight - overlapLeft;

    if (overlapWidth < 6) {
      setIsPlaying(false);
      setGameOver(true);
      if (score > best) { setBest(score); localStorage.setItem("stacker_best", String(score)); }
      onScore(score * 5);
      return;
    }

    const nextColor = palette[stack.length % palette.length];
    setStack(s => [...s, { left: overlapLeft, width: overlapWidth, color: nextColor }]);
    setScore(s => s + 1);
    setCurrent({ left: overlapWidth >= CW - overlapWidth ? 0 : overlapLeft, width: overlapWidth, dir: Math.random() > 0.5 ? 1 : -1, speed: Math.min(6, 2 + stack.length * 0.15) });
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === " ") { e.preventDefault(); drop(); } };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, current, stack]);

  const visibleStack = stack.slice(-VISIBLE);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm">Height: {score} | Best: {best}</span>
      </div>
      <div
        className="relative rounded-lg overflow-hidden bg-zinc-100 dark:bg-white/5 mx-auto cursor-pointer"
        style={{ width: CW, height: BH * (VISIBLE + 1), maxWidth: "100%" }}
        onClick={drop}
      >
        {visibleStack.map((b, i) => (
          <div
            key={stack.length - visibleStack.length + i}
            className="absolute rounded-sm"
            style={{ left: b.left, width: b.width, height: BH - 3, bottom: i * BH, background: b.color }}
          />
        ))}
        {current && isPlaying && (
          <div
            className="absolute rounded-sm opacity-90"
            style={{ left: current.left, width: current.width, height: BH - 3, bottom: visibleStack.length * BH, background: palette[stack.length % palette.length] }}
          />
        )}
        {!isPlaying && (
          <StartOverlay label={gameOver ? `Tower Fell! — ${score}` : "Click to Start"} sub="Click or press Space to drop the block" onStart={start} />
        )}
      </div>
    </div>
  );
}

/* ---------------- Fruit Slice ---------------- */
function FruitSlice({ onScore }: { onScore: (score: number) => void }) {
  const CW = 320, CH = 380, ITEM = 34;
  const fruits = ["🍎", "🍊", "🍋", "🍉", "🍇", "🍓", "🍑", "🍍"];
  type Item = { id: number; x: number; y: number; emoji: string; isBomb: boolean };
  const [items, setItems] = useState<Item[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [best, setBest] = useState(() => parseInt(localStorage.getItem("fruitslice_best") || "0"));
  const nextId = useRef(0);
  const speedRef = useRef(2.2);
  const endedRef = useRef(false);

  const start = () => {
    setItems([]);
    setScore(0);
    setLives(3);
    setGameOver(false);
    endedRef.current = false;
    speedRef.current = 2.2;
    setIsPlaying(true);
  };

  const endGame = (finalScore: number) => {
    if (endedRef.current) return;
    endedRef.current = true;
    setIsPlaying(false);
    setGameOver(true);
    if (finalScore > best) { setBest(finalScore); localStorage.setItem("fruitslice_best", String(finalScore)); }
    onScore(finalScore);
  };

  useEffect(() => {
    if (!isPlaying) return;
    const spawn = setInterval(() => {
      const isBomb = Math.random() < 0.15;
      const emoji = isBomb ? "💣" : fruits[Math.floor(Math.random() * fruits.length)];
      setItems(prev => [...prev, { id: nextId.current++, x: 10 + Math.random() * (CW - ITEM - 20), y: -ITEM, emoji, isBomb }]);
    }, 700);
    const tick = setInterval(() => {
      speedRef.current = Math.min(6, speedRef.current + 0.01);
      setItems(prev => {
        const stillFalling: Item[] = [];
        let missed = 0;
        for (const it of prev) {
          const ny = it.y + speedRef.current;
          if (ny > CH) {
            if (!it.isBomb) missed += 1;
          } else {
            stillFalling.push({ ...it, y: ny });
          }
        }
        if (missed > 0) {
          setLives(l => {
            const nl = l - missed;
            if (nl <= 0) setScore(s => { endGame(s); return s; });
            return Math.max(0, nl);
          });
        }
        return stillFalling;
      });
    }, 22);
    return () => { clearInterval(spawn); clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  const slice = (item: Item) => {
    if (!isPlaying) return;
    if (item.isBomb) {
      setItems(prev => prev.filter(i => i.id !== item.id));
      setScore(s => { endGame(s); return s; });
      return;
    }
    setItems(prev => prev.filter(i => i.id !== item.id));
    setScore(s => s + 10);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm">Score: {score} | Best: {best}</span>
        <span className="text-sm">{"❤️".repeat(Math.max(lives, 0))}</span>
      </div>
      <div className="relative rounded-lg overflow-hidden bg-zinc-100 dark:bg-white/5 mx-auto" style={{ width: CW, height: CH, maxWidth: "100%" }}>
        {items.map(it => (
          <button
            key={it.id}
            onClick={() => slice(it)}
            className="absolute text-3xl leading-none cursor-pointer select-none hover:scale-125 transition-transform"
            style={{ left: it.x, top: it.y, width: ITEM, height: ITEM }}
          >
            {it.emoji}
          </button>
        ))}
        {!isPlaying && (
          <StartOverlay label={gameOver ? `Sliced! — ${score}` : "Click to Start"} sub="Click fruit, avoid the bombs" onStart={start} />
        )}
      </div>
    </div>
  );
}

/* ---------------- Page shell ---------------- */
export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params?.game as string;
  const game = gameInfo[gameId];
  const [totalScore, setTotalScore] = useState(0);
  const totalScoreRef = useRef(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const loadLeaderboard = async () => {
    try {
      const data = await api.getLeaderboard(gameId);
      setLeaderboard(data);
    } catch (err) {
      console.error("Failed to load leaderboard");
    }
  };

  const handleScore = async (points: number) => {
    totalScoreRef.current += points;
    setTotalScore(totalScoreRef.current);
    try {
      await api.submitGameScore({ game_name: gameId, score: totalScoreRef.current });
      await loadLeaderboard();
    } catch (err) {
      console.error("Failed to save score");
    }
  };

  if (!game) return <p>Game not found</p>;

  return (
    <main className="max-w-4xl mx-auto px-8 py-8 dark:text-white">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white mb-6">
        <ChevronLeft className="w-4 h-4" />Back to Games
      </button>

      <div className="flex items-center gap-3 mb-8">
        <div className={`w-12 h-12 ${game.color} rounded-xl flex items-center justify-center`}>
          <game.icon className="w-6 h-6" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#0A0A0A] dark:text-white">{game.name}</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Score: {totalScore} points</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Game Area */}
        <div className="md:col-span-2 bg-white border border-zinc-200 rounded-xl p-6 dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10">
          {gameId === "flappy" && <FlappyBird onScore={handleScore} />}
          {gameId === "breakout" && <Breakout onScore={handleScore} />}
          {gameId === "snake" && <SnakeGame onScore={handleScore} />}
          {gameId === "invaders" && <SpaceInvaders onScore={handleScore} />}
          {gameId === "whackamole" && <WhackAMole onScore={handleScore} />}
          {gameId === "reaction" && <ReactionGame onScore={handleScore} />}
          {gameId === "stacker" && <StackTower onScore={handleScore} />}
          {gameId === "fruitslice" && <FruitSlice onScore={handleScore} />}
        </div>

        {/* Leaderboard */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10">
          <h3 className="font-semibold flex items-center gap-2 mb-4 dark:text-white">
            <Trophy className="w-4 h-4 text-amber-500" />
            Leaderboard
          </h3>
          <div className="space-y-2">
            {leaderboard.length === 0 ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-6">No scores yet. Play to get on the board!</p>
            ) : (
              leaderboard.map((entry: any, idx: number) => (
                <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg text-sm ${idx === 0 ? "bg-amber-50 dark:bg-amber-500/10" : idx === 1 ? "bg-zinc-50 dark:bg-white/5" : idx === 2 ? "bg-orange-50 dark:bg-orange-500/10" : ""}`}>
                  <span className="w-5 text-center font-bold text-xs">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs truncate">{entry.name}</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{entry.game}</p>
                  </div>
                  <span className="text-xs font-bold">{entry.score}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
