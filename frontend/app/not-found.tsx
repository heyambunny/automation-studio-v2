"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Home, ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-6 relative overflow-hidden">
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
        backgroundSize: "28px 28px",
      }} />
      
      {/* Glow effect */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center"
      >
        {/* Floating astronaut/emoji */}
        <motion.div
          animate={{ 
            y: [0, -20, 0],
            rotate: [0, -5, 5, 0],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="text-9xl mb-8"
        >
          🚀
        </motion.div>

        {/* Animated 404 */}
        <div className="flex items-center justify-center gap-4 mb-4">
          {["4", "0", "4"].map((digit, idx) => (
            <motion.span
              key={idx}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + idx * 0.15, type: "spring", stiffness: 200 }}
              className="text-8xl md:text-9xl font-bold text-white"
            >
              {digit}
            </motion.span>
          ))}
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">Lost in space</h2>
        <p className="text-zinc-400 text-sm mb-10 max-w-sm mx-auto">
          The page you're looking for has drifted into a black hole. Let's get you back to safety.
        </p>

        <div className="flex gap-3 justify-center">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 bg-white text-[#0A0A0A] text-sm font-semibold px-6 py-3 rounded-xl shadow-lg shadow-black/30 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            Take Me Home
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.back()}
            className="flex items-center gap-2 bg-white/10 text-white text-sm font-semibold px-6 py-3 rounded-xl border border-white/20 cursor-pointer backdrop-blur-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </motion.button>
        </div>

        {/* Explore */}
        <div className="mt-12">
          <button
            onClick={() => router.push("/games")}
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 text-sm transition-colors cursor-pointer mx-auto"
          >
            <Compass className="w-4 h-4" />
            Or explore mini games while you're here
          </button>
        </div>

        <p className="text-zinc-600 text-xs mt-8">
          Made with ❤️ by Bunny 🐰
        </p>
      </motion.div>
    </div>
  );
}
