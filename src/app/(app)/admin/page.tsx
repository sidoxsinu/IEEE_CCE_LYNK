"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function AdminPage() {
  const { userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && userProfile?.role !== "admin") {
      router.push("/home");
    }
  }, [userProfile, loading, router]);

  if (loading || userProfile?.role !== "admin") {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-bg-alt">
        <div className="w-12 h-12 rounded-full border-4 border-text border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh px-4 pt-8 pb-8 bg-bg-alt">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-text-muted font-bold text-sm uppercase tracking-widest mb-1">Admin Panel</p>
          <h1 className="text-4xl font-black uppercase text-text">
            Dashboard
          </h1>
        </div>
        <Button
          variant="secondary"
          onClick={() => router.push("/home")}
          className="text-sm border-2 px-3 py-1 shadow-[2px_2px_0px_#000] active:translate-y-1 active:translate-x-1 active:shadow-none bg-white hover:bg-bg-alt"
        >
          ← App
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card className="p-4 text-center bg-white border-thicker shadow-[4px_4px_0px_#000]">
          <p className="text-3xl font-black text-primary">0</p>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-text-muted mt-1 break-words">Participants</p>
        </Card>
        <Card className="p-4 text-center bg-white border-thicker shadow-[4px_4px_0px_#000]">
          <p className="text-3xl font-black text-text">0</p>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-text-muted mt-1 break-words">Connections</p>
        </Card>
        <Card className="p-4 text-center bg-white border-thicker shadow-[4px_4px_0px_#000]">
          <p className="text-3xl font-black text-success">0</p>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-text-muted mt-1 break-words">Online</p>
        </Card>
      </div>

      {/* Admin Actions */}
      <div className="space-y-4">
        <h2 className="text-2xl font-black text-text mb-4 uppercase">
          Actions
        </h2>

        {[
          { icon: "📥", label: "Import Participants (CSV)", desc: "Upload registration data", id: "import-csv" },
          { icon: "⚙️", label: "Event Controls", desc: "Toggle event active / leaderboard", id: "event-controls" },
          { icon: "🖼️", label: "Selfie Moderation", desc: "Review uploaded selfies", id: "selfie-moderation" },
          { icon: "📊", label: "Export Data", desc: "Download CSV report", id: "export-data" },
        ].map((action, i) => (
          <button
            key={action.id}
            id={action.id}
            className="w-full text-left block bg-transparent border-0 outline-none p-0"
          >
            <Card className="p-4 flex items-center gap-4 bg-white border-thicker shadow-[4px_4px_0px_#000] hover:-translate-y-1 hover:shadow-hard-hover active:translate-y-1 active:translate-x-1 active:shadow-none transition-all">
              <span className="text-3xl bg-bg-alt border-2 border-text p-2 rounded-sm">{action.icon}</span>
              <div className="flex-1">
                <p className="text-base font-black text-text uppercase">{action.label}</p>
                <p className="text-xs font-bold text-text-muted">{action.desc}</p>
              </div>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-text">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
