"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FlaskConical, Split, ArrowRight } from "lucide-react";

const TOOLS = [
  {
    href: "/laboratory/data-split",
    icon: Split,
    title: "Data Split",
    description: "Upload one master report and split it into a separate file per branch (or any other column you choose) - no manual copy-pasting.",
  },
];

export default function LaboratoryPage() {
  const router = useRouter();

  return (
    <main className="max-w-4xl mx-auto px-8 py-8 dark:text-white">
      <div className="flex items-center gap-3 mb-8">
        <FlaskConical className="w-6 h-6 text-zinc-400" />
        <div>
          <h2 className="text-2xl font-bold text-[#0A0A0A] dark:text-white">Laboratory</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Tools to cut down the manual work around building reports</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TOOLS.map((tool, idx) => (
          <motion.button
            key={tool.href}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => router.push(tool.href)}
            className="group text-left bg-white border border-zinc-200 rounded-2xl p-6 hover:border-zinc-300 hover:shadow-lg transition-all dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 dark:hover:border-white/20 dark:shadow-none cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-zinc-50 dark:bg-black/50 flex items-center justify-center">
                <tool.icon className="w-6 h-6 text-zinc-700 dark:text-white" strokeWidth={1.5} />
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-300 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 group-hover:translate-x-1 transition-all" />
            </div>
            <p className="font-semibold text-sm dark:text-white">{tool.title}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">{tool.description}</p>
          </motion.button>
        ))}
      </div>
    </main>
  );
}
