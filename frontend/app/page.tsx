"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push(getUser() ? "/dashboard" : "/login");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-zinc-500">Loading...</p>
    </div>
  );
}
