"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Gamepad2, Bird, Blocks, Zap, Rocket, Hammer, Timer, Layers, Sword } from "lucide-react";

const games = [
  { id: "flappy", name: "Flappy Bird", description: "Tap to fly through the gaps", icon: Bird, color: "bg-sky-50 text-sky-600", players: "1 Player" },
  { id: "breakout", name: "Breakout", description: "Smash every brick", icon: Blocks, color: "bg-orange-50 text-orange-600", players: "1 Player" },
  { id: "snake", name: "Snake", description: "Eat food, grow longer", icon: Zap, color: "bg-emerald-50 text-emerald-600", players: "1 Player" },
  { id: "invaders", name: "Space Invaders", description: "Blast the alien fleet", icon: Rocket, color: "bg-purple-50 text-purple-600", players: "1 Player" },
  { id: "whackamole", name: "Whack-a-Mole", description: "Whack 'em before they hide", icon: Hammer, color: "bg-amber-50 text-amber-600", players: "1 Player" },
  { id: "reaction", name: "Reaction Time", description: "Test your reflexes", icon: Timer, color: "bg-red-50 text-red-600", players: "1 Player" },
  { id: "stacker", name: "Stack Tower", description: "Stack blocks as high as you can", icon: Layers, color: "bg-cyan-50 text-cyan-600", players: "1 Player" },
  { id: "fruitslice", name: "Fruit Slice", description: "Slice fruit, dodge bombs", icon: Sword, color: "bg-pink-50 text-pink-600", players: "1 Player" },
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
