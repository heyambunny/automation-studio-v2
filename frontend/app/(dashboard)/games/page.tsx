"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Gamepad2, Grid3x3, MousePointerClick, Timer, Brain, Hash, Dice5 } from "lucide-react";

const games = [
  { id: "tictactoe", name: "Tic Tac Toe", description: "Classic X & O game", icon: Grid3x3, color: "bg-blue-50 text-blue-600", players: "2 Players" },
  { id: "snake", name: "Snake", description: "Eat food, grow longer", icon: MousePointerClick, color: "bg-emerald-50 text-emerald-600", players: "1 Player" },
  { id: "memory", name: "Memory Game", description: "Match animal pairs", icon: Brain, color: "bg-purple-50 text-purple-600", players: "1 Player" },
  { id: "reaction", name: "Reaction Time", description: "Test your reflexes", icon: Timer, color: "bg-orange-50 text-orange-600", players: "1 Player" },
  { id: "rps", name: "Rock Paper Scissors", description: "Beat the bot", icon: Dice5, color: "bg-pink-50 text-pink-600", players: "vs Bot" },
  { id: "simon", name: "Simon Says", description: "Remember the pattern", icon: Brain, color: "bg-amber-50 text-amber-600", players: "1 Player" },
  { id: "2048", name: "2048", description: "Merge numbers to win", icon: Hash, color: "bg-red-50 text-red-600", players: "1 Player" },
  { id: "sudoku", name: "Sudoku", description: "Fill the grid", icon: Grid3x3, color: "bg-cyan-50 text-cyan-600", players: "1 Player" },
];

export default function GamesPage() {
  const router = useRouter();

  return (
    <main className="max-w-5xl mx-auto px-8 py-8 dark:text-white">
      <div className="flex items-center gap-3 mb-2">
        <Gamepad2 className="w-7 h-7 text-zinc-400" />
        <div>
          <h2 className="text-2xl font-bold text-[#0A0A0A] dark:text-white">Mini Games</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Take a break while campaigns run</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
        {games.map((game, idx) => (
          <motion.button
            key={game.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            whileHover={{ y: -4 }}
            onClick={() => router.push(`/games/${game.id}`)}
            className="group bg-white border border-zinc-200 rounded-2xl p-6 text-left hover:border-zinc-300 hover:shadow-lg transition-all cursor-pointer dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 dark:hover:border-white/20 dark:shadow-none"
          >
            <div className={`w-12 h-12 ${game.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
              <game.icon className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <h3 className="font-semibold text-sm dark:text-white">{game.name}</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{game.description}</p>
            <p className="text-[10px] text-zinc-400 mt-2">{game.players}</p>
          </motion.button>
        ))}
      </div>
    </main>
  );
}
