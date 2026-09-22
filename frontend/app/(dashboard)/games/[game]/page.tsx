"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Trophy, RefreshCw, Gamepad2, Brain, Timer, Dice5, Grid3x3, MousePointerClick, Hash } from "lucide-react";
import { api } from "@/lib/api";

const gameInfo: Record<string, any> = {
  tictactoe: { name: "Tic Tac Toe", icon: Grid3x3, color: "bg-blue-50 text-blue-600" },
  snake: { name: "Snake", icon: MousePointerClick, color: "bg-emerald-50 text-emerald-600" },
  memory: { name: "Memory Game", icon: Brain, color: "bg-purple-50 text-purple-600" },
  reaction: { name: "Reaction Time", icon: Timer, color: "bg-orange-50 text-orange-600" },
  rps: { name: "Rock Paper Scissors", icon: Dice5, color: "bg-pink-50 text-pink-600" },
  simon: { name: "Simon Says", icon: Brain, color: "bg-amber-50 text-amber-600" },
  "2048": { name: "2048", icon: Hash, color: "bg-red-50 text-red-600" },
  sudoku: { name: "Sudoku", icon: Grid3x3, color: "bg-cyan-50 text-cyan-600" },
};

function TicTacToe({ onScore }: { onScore: (score: number) => void }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isX, setIsX] = useState(true);
  const [winner, setWinner] = useState<string | null>(null);
  const [wins, setWins] = useState(0);

  const checkWinner = (b: any[]) => {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a, c, d] of lines) {
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    }
    if (b.every(cell => cell)) return "Draw";
    return null;
  };

  const handleClick = (idx: number) => {
    if (board[idx] || winner) return;
    const newBoard = [...board];
    newBoard[idx] = isX ? "X" : "O";
    setBoard(newBoard);
    setIsX(!isX);
    const win = checkWinner(newBoard);
    if (win) {
      setWinner(win);
      if (win === "X") {
        setWins(w => w + 1);
        onScore(10);
      }
    }
  };

  const reset = () => { setBoard(Array(9).fill(null)); setIsX(true); setWinner(null); };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {board.map((cell, idx) => (
          <button key={idx} onClick={() => handleClick(idx)} className={`h-24 rounded-lg text-4xl font-bold transition-all cursor-pointer ${cell === "X" ? "bg-blue-50 text-blue-600" : cell === "O" ? "bg-red-50 text-red-600" : "bg-zinc-50 hover:bg-zinc-100"}`}>
            {cell}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <p className="font-medium">{winner ? (winner === "Draw" ? "🤝 Draw!" : `🏆 ${winner} wins!`) : "Playing..."}</p>
        <button onClick={reset} className="text-zinc-400 hover:text-zinc-600"><RefreshCw className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

function SnakeGame({ onScore }: { onScore: (score: number) => void }) {
  const [snake, setSnake] = useState([{ x: 10, y: 10 }]);
  const [food, setFood] = useState({ x: 5, y: 5 });
  const [direction, setDirection] = useState("right");
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem("snake_high") || "0"));

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSnake(prev => {
        const head = { ...prev[0] };
        if (direction === "right") head.x += 1;
        if (direction === "left") head.x -= 1;
        if (direction === "up") head.y -= 1;
        if (direction === "down") head.y += 1;
        if (head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 20 || prev.some(s => s.x === head.x && s.y === head.y)) {
          setGameOver(true);
          setIsPlaying(false);
          if (score > highScore) { setHighScore(score); localStorage.setItem("snake_high", String(score)); }
          onScore(score);
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
        {!isPlaying && <button onClick={startGame} className="px-4 py-2 bg-[#0A0A0A] text-white rounded-lg text-sm cursor-pointer">{gameOver ? "Restart" : "Start"}</button>}
      </div>
      <div className="grid gap-px bg-zinc-200 rounded-lg overflow-hidden" style={{ gridTemplateColumns: "repeat(20, 1fr)" }}>
        {Array.from({ length: 400 }, (_, i) => {
          const x = i % 20, y = Math.floor(i / 20);
          const isSnake = snake.some(s => s.x === x && s.y === y);
          const isFood = food.x === x && food.y === y;
          return <div key={i} className={`aspect-square ${isSnake ? "bg-emerald-600" : isFood ? "bg-red-500" : "bg-white"}`} />;
        })}
      </div>
      <p className="text-xs text-zinc-400 mt-3 text-center">Use arrow keys to move</p>
    </div>
  );
}

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
      <button onClick={state === "idle" || state === "result" ? start : handleClick} className={`w-full h-40 rounded-lg text-xl font-bold transition-all cursor-pointer ${state === "waiting" ? "bg-red-100 text-red-600" : state === "ready" ? "bg-emerald-500 text-white" : "bg-zinc-100 hover:bg-zinc-200"}`}>
        {state === "idle" && "Click to Start"}
        {state === "waiting" && "Wait for green..."}
        {state === "ready" && "CLICK NOW!"}
        {state === "result" && `${score}ms — click to retry`}
      </button>
      {bestScore && <p className="text-center text-sm text-zinc-500 mt-4">🏆 Best: {bestScore}ms</p>}
    </div>
  );
}


function MemoryGame({ onScore }: { onScore: (score: number) => void }) {
  const emojis = ["🐻", "🦁", "🐕", "🐔", "🦡", "🐱", "🐰", "🦒"];
  const [cards, setCards] = useState<any[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    const deck = [...emojis.slice(0, 6), ...emojis.slice(0, 6)].sort(() => Math.random() - 0.5);
    setCards(deck);
  }, []);

  const handleFlip = (idx: number) => {
    if (flipped.length === 2 || matched.includes(idx) || flipped.includes(idx)) return;
    const newFlipped = [...flipped, idx];
    setFlipped(newFlipped);
    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      if (cards[newFlipped[0]] === cards[newFlipped[1]]) {
        setMatched([...matched, ...newFlipped]);
        setFlipped([]);
        if (matched.length + 2 === cards.length) {
          onScore(Math.max(100, 500 - moves * 10));
        }
      } else {
        setTimeout(() => setFlipped([]), 800);
      }
    }
  };

  const reset = () => {
    setCards([...emojis.slice(0, 6), ...emojis.slice(0, 6)].sort(() => Math.random() - 0.5));
    setFlipped([]);
    setMatched([]);
    setMoves(0);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm">Moves: {moves}</span>
        <button onClick={reset} className="text-zinc-400 hover:text-zinc-600"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {cards.map((card, idx) => (
          <button key={idx} onClick={() => handleFlip(idx)} className={`h-20 rounded-lg text-3xl transition-all cursor-pointer ${matched.includes(idx) ? "bg-emerald-50" : flipped.includes(idx) ? "bg-white border-2 border-zinc-300" : "bg-zinc-50 hover:bg-zinc-100"}`}>
            {flipped.includes(idx) || matched.includes(idx) ? card : "❓"}
          </button>
        ))}
      </div>
      {matched.length === cards.length && cards.length > 0 && <p className="text-center font-medium mt-4">🎉 Completed in {moves} moves!</p>}
    </div>
  );
}

function RockPaperScissors({ onScore }: { onScore: (score: number) => void }) {
  const choices = ["🪨", "📄", "✂️"];
  const [playerChoice, setPlayerChoice] = useState<string | null>(null);
  const [botChoice, setBotChoice] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [score, setScore] = useState({ player: 0, bot: 0 });

  const play = (choice: string) => {
    const bot = choices[Math.floor(Math.random() * 3)];
    setPlayerChoice(choice);
    setBotChoice(bot);
    if (choice === bot) {
      setResult("🤝 Draw!");
      onScore(5);
    } else if ((choice === "🪨" && bot === "✂️") || (choice === "📄" && bot === "🪨") || (choice === "✂️" && bot === "📄")) {
      setResult("🎉 You win!");
      setScore(s => ({ ...s, player: s.player + 1 }));
      onScore(10);
    } else {
      setResult("😢 Bot wins!");
      setScore(s => ({ ...s, bot: s.bot + 1 }));
    }
  };

  return (
    <div>
      <div className="flex justify-center gap-4 mb-6">
        {choices.map(choice => (
          <button key={choice} onClick={() => play(choice)} className="text-5xl hover:scale-125 transition-transform cursor-pointer">{choice}</button>
        ))}
      </div>
      {result && (
        <div className="text-center mb-4">
          <p className="text-3xl">{playerChoice} vs {botChoice}</p>
          <p className="font-medium mt-2">{result}</p>
        </div>
      )}
      <div className="flex justify-center gap-8 text-sm">
        <span>You: <strong>{score.player}</strong></span>
        <span>Bot: <strong>{score.bot}</strong></span>
      </div>
    </div>
  );
}

function SimonSays({ onScore }: { onScore: (score: number) => void }) {
  const colors = ["red", "blue", "green", "yellow"];
  const [sequence, setSequence] = useState<string[]>([]);
  const [playerSeq, setPlayerSeq] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [level, setLevel] = useState(0);

  const startGame = () => {
    const newSeq = [colors[Math.floor(Math.random() * 4)]];
    setSequence(newSeq);
    setPlayerSeq([]);
    setLevel(1);
    setIsPlaying(true);
  };

  const handleColorClick = (color: string) => {
    if (!isPlaying) return;
    const newPlayer = [...playerSeq, color];
    setPlayerSeq(newPlayer);
    const idx = newPlayer.length - 1;
    if (newPlayer[idx] !== sequence[idx]) {
      setIsPlaying(false);
      onScore(level * 5);
      setLevel(0);
      return;
    }
    if (newPlayer.length === sequence.length) {
      const newSeq = [...sequence, colors[Math.floor(Math.random() * 4)]];
      setSequence(newSeq);
      setPlayerSeq([]);
      setLevel(newSeq.length);
      onScore(10);
    }
  };

  return (
    <div>
      {!isPlaying && (
        <button onClick={startGame} className="w-full py-3 bg-[#0A0A0A] text-white rounded-lg font-medium mb-4 cursor-pointer">
          {level === 0 ? "Start Game" : "Play Again"}
        </button>
      )}
      {isPlaying && <p className="text-center mb-4 font-medium">Level: {level}</p>}
      <div className="grid grid-cols-2 gap-3">
        {colors.map(color => (
          <button key={color} onClick={() => handleColorClick(color)} disabled={!isPlaying} className={`h-24 rounded-lg transition-all cursor-pointer ${color === "red" ? "bg-red-500" : color === "blue" ? "bg-blue-500" : color === "green" ? "bg-emerald-500" : "bg-yellow-500"} ${!isPlaying ? "opacity-30" : "hover:opacity-80"}`} />
        ))}
      </div>
    </div>
  );
}

function Game2048({ onScore }: { onScore: (score: number) => void }) {
  const [grid, setGrid] = useState<number[][]>(() => {
    const g = Array(4).fill(null).map(() => Array(4).fill(0));
    addRandom(g);
    addRandom(g);
    return g;
  });
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  function addRandom(g: number[][]) {
    const empty = [];
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        if (g[i][j] === 0) empty.push([i, j]);
    if (empty.length > 0) {
      const [r, c] = empty[Math.floor(Math.random() * empty.length)];
      g[r][c] = Math.random() < 0.9 ? 2 : 4;
    }
  }

  const slide = (row: number[]) => {
    const filtered = row.filter(v => v !== 0);
    for (let i = 0; i < filtered.length - 1; i++) {
      if (filtered[i] === filtered[i + 1]) {
        filtered[i] *= 2;
        setScore(s => s + filtered[i]);
        filtered.splice(i + 1, 1);
      }
    }
    while (filtered.length < 4) filtered.push(0);
    return filtered;
  };

  const move = (direction: string) => {
    let newGrid = grid.map(row => [...row]);
    if (direction === "left") newGrid = newGrid.map(row => slide(row));
    if (direction === "right") newGrid = newGrid.map(row => slide(row.reverse()).reverse());
    if (direction === "up") {
      for (let c = 0; c < 4; c++) {
        const col = slide(newGrid.map(r => r[c]));
        for (let r = 0; r < 4; r++) newGrid[r][c] = col[r];
      }
    }
    if (direction === "down") {
      for (let c = 0; c < 4; c++) {
        const col = slide(newGrid.map(r => r[c]).reverse()).reverse();
        for (let r = 0; r < 4; r++) newGrid[r][c] = col[r];
      }
    }
    addRandom(newGrid);
    setGrid(newGrid);
    if (newGrid.every(row => row.every(cell => cell !== 0))) {
      setGameOver(true);
      onScore(score);
    }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") move("left");
      if (e.key === "ArrowRight") move("right");
      if (e.key === "ArrowUp") move("up");
      if (e.key === "ArrowDown") move("down");
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [grid, score]);

  const reset = () => {
    const g = Array(4).fill(null).map(() => Array(4).fill(0));
    addRandom(g); addRandom(g);
    setGrid(g);
    setScore(0);
    setGameOver(false);
  };

  const getColor = (val: number) => {
    if (val === 0) return "bg-zinc-100";
    if (val === 2) return "bg-zinc-200";
    if (val === 4) return "bg-amber-100";
    if (val === 8) return "bg-orange-200";
    if (val === 16) return "bg-orange-300";
    if (val === 32) return "bg-red-300";
    if (val === 64) return "bg-red-400";
    if (val === 128) return "bg-yellow-300";
    if (val === 256) return "bg-yellow-400";
    return "bg-amber-400";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm">Score: {score}</span>
        <button onClick={reset} className="text-zinc-400 hover:text-zinc-600"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {grid.map((row, r) => row.map((cell, c) => (
          <div key={`${r}-${c}`} className={`h-20 rounded-lg flex items-center justify-center text-2xl font-bold ${getColor(cell)}`}>
            {cell > 0 ? cell : ""}
          </div>
        )))}
      </div>
      <p className="text-xs text-zinc-400 mt-3 text-center">Use arrow keys to merge tiles</p>
      {gameOver && <p className="text-center text-red-600 mt-2 font-medium">Game Over! Score: {score}</p>}
    </div>
  );
}


function SudokuGame({ onScore }: { onScore: (score: number) => void }) {
  const [board, setBoard] = useState<number[][]>([]);
  const [original, setOriginal] = useState<number[][]>([]);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [message, setMessage] = useState("");

  const generateBoard = () => {
    // Simple pre-defined puzzle
    const puzzle = [
      [5,3,0,0,7,0,0,0,0],
      [6,0,0,1,9,5,0,0,0],
      [0,9,8,0,0,0,0,6,0],
      [8,0,0,0,6,0,0,0,3],
      [4,0,0,8,0,3,0,0,1],
      [7,0,0,0,2,0,0,0,6],
      [0,6,0,0,0,0,2,8,0],
      [0,0,0,4,1,9,0,0,5],
      [0,0,0,0,8,0,0,7,9],
    ];
    setBoard(puzzle.map(r => [...r]));
    setOriginal(puzzle.map(r => [...r]));
    setMessage("");
  };

  useEffect(() => {
    generateBoard();
  }, []);

  const handleCellClick = (r: number, c: number) => {
    if (original[r][c] !== 0) return;
    setSelected([r, c]);
  };

  const handleNumberInput = (num: number) => {
    if (!selected) return;
    const [r, c] = selected;
    const newBoard = board.map(row => [...row]);
    newBoard[r][c] = num;
    setBoard(newBoard);
    
    // Check if solved
    if (newBoard.every(row => row.every(cell => cell !== 0))) {
      setMessage("🎉 Puzzle solved!");
      onScore(100);
    }
  };

  const reset = () => generateBoard();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm">Fill in the blanks with numbers 1-9</span>
        <button onClick={reset} className="text-zinc-400 hover:text-zinc-600"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-9 gap-px bg-zinc-300 rounded-lg overflow-hidden border-2 border-zinc-300">
        {board.map((row, r) => row.map((cell, c) => (
          <button
            key={`${r}-${c}`}
            onClick={() => handleCellClick(r, c)}
            className={`aspect-square flex items-center justify-center text-lg font-medium transition-colors cursor-pointer ${
              original[r][c] !== 0 ? "bg-zinc-100 font-bold" : selected?.[0] === r && selected?.[1] === c ? "bg-blue-100" : "bg-white hover:bg-zinc-50"
            } ${(r + 1) % 3 === 0 && r < 8 ? "border-b-2 border-zinc-400" : ""} ${(c + 1) % 3 === 0 && c < 8 ? "border-r-2 border-zinc-400" : ""}`}
          >
            {cell !== 0 ? cell : ""}
          </button>
        )))}
      </div>
      {selected && (
        <div className="flex justify-center gap-2 mt-4">
          {[1,2,3,4,5,6,7,8,9].map(num => (
            <button key={num} onClick={() => handleNumberInput(num)} className="w-8 h-8 bg-zinc-100 rounded-lg text-sm font-medium hover:bg-zinc-200 cursor-pointer">
              {num}
            </button>
          ))}
        </div>
      )}
      {message && <p className="text-center font-medium mt-4 text-emerald-600">{message}</p>}
    </div>
  );
}

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params?.game as string;
  const game = gameInfo[gameId];
  const [totalScore, setTotalScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    loadLeaderboard();
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
    setTotalScore(s => s + points);
    try {
      await api.submitGameScore({ game_name: gameId, score: totalScore + points });
      await loadLeaderboard();
    } catch (err) {
      console.error("Failed to save score");
    }
  };

  if (!game) return <p>Game not found</p>;

  return (
    <main className="max-w-4xl mx-auto px-8 py-8">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 mb-6">
        <ChevronLeft className="w-4 h-4" />Back to Games
      </button>

      <div className="flex items-center gap-3 mb-8">
        <div className={`w-12 h-12 ${game.color} rounded-xl flex items-center justify-center`}>
          <game.icon className="w-6 h-6" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#0A0A0A]">{game.name}</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Score: {totalScore} points</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Game Area */}
        <div className="md:col-span-2 bg-white border border-zinc-200 rounded-xl p-6">
          {gameId === "tictactoe" && <TicTacToe onScore={handleScore} />}
          {gameId === "snake" && <SnakeGame onScore={handleScore} />}
          {gameId === "reaction" && <ReactionGame onScore={handleScore} />}
          {gameId === "memory" && <MemoryGame onScore={handleScore} />}
          {gameId === "rps" && <RockPaperScissors onScore={handleScore} />}
          {gameId === "simon" && <SimonSays onScore={handleScore} />}
          {gameId === "2048" && <Game2048 onScore={handleScore} />}
          {gameId === "sudoku" && <SudokuGame onScore={handleScore} />}
        </div>

        {/* Leaderboard */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-amber-500" />
            Leaderboard
          </h3>
          <div className="space-y-2">
            {leaderboard.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-6">No scores yet. Play to get on the board!</p>
            ) : (
              leaderboard.map((entry: any, idx: number) => (
                <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg text-sm ${idx === 0 ? "bg-amber-50" : idx === 1 ? "bg-zinc-50" : idx === 2 ? "bg-orange-50" : ""}`}>
                  <span className="w-5 text-center font-bold text-xs">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs truncate">{entry.name}</p>
                    <p className="text-[10px] text-zinc-400">{entry.game}</p>
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
