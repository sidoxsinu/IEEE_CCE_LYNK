"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface LeaderboardEntry {
  participant_id: string;
  name: string;
  connections_made_count: number;
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    const fetchLeaderboard = async () => {
      try {
        // Fetch config to check visibility
        const { data: configData } = await supabase
          .from("config")
          .select("leaderboard_visible")
          .eq("id", "main")
          .single();

        const visible = configData?.leaderboard_visible || false;
        
        if (mounted) {
          setIsVisible(visible);
        }

        // Only fetch leaderboard data if visible
        if (visible) {
          const { data: lbData } = await supabase.rpc("get_leaderboard");
          if (mounted && lbData) {
            setEntries(lbData);
          }
        }
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchLeaderboard();

    // Poll every 5 seconds
    const intervalId = setInterval(fetchLeaderboard, 5000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [supabase]);

  if (loading) {
    return (
      <div className="px-4 pt-8 bg-bg-alt min-h-dvh pb-safe-bottom">
        <div className="skeleton h-10 w-48 mb-6 border-4 border-text" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-16 w-full mb-4 border-4 border-text bg-white" />
        ))}
      </div>
    );
  }

  if (!isVisible) {
    return (
      <div className="px-4 pt-8 pb-safe-bottom bg-bg-alt min-h-dvh">
        <h1 className="text-4xl tracking-tighter mb-8 font-black uppercase text-text">
          Leaderboard
        </h1>
        <Card className="p-8 text-center bg-white border-thicker border-dashed">
          <div className="w-20 h-20 rounded-full border-4 border-text bg-primary flex items-center justify-center mx-auto mb-5 shadow-[4px_4px_0px_#000]">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-text mb-2 uppercase">
            Not Revealed Yet
          </h2>
          <p className="text-text-muted font-bold text-sm leading-relaxed max-w-[280px] mx-auto">
            The leaderboard will be unveiled by the event organizer. Keep making connections in the meantime!
          </p>
          <div className="flex items-center justify-center gap-2 mt-5">
            <div className="w-3 h-3 rounded-full border-2 border-text bg-warning animate-bounce" />
            <span className="text-sm font-bold text-text-muted uppercase tracking-widest">Waiting for reveal...</span>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 pt-8 pb-safe-bottom bg-bg-alt min-h-dvh">
      <h1 className="text-4xl tracking-tighter mb-8 font-black uppercase text-text">
        Leaderboard
      </h1>
      
      {entries.length === 0 ? (
        <Card className="p-6 text-center bg-white border-thicker">
          <p className="text-text-muted font-bold text-sm">
            Leaderboard data will appear here once connections start flowing.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, idx) => {
            // Podium colour configs
            const podium = [
              { card: 'bg-[#FFB800] border-text', badge: 'bg-text text-white', rankBg: 'bg-white text-[#FFB800]', label: '🥇', nameColor: 'text-text' },
              { card: 'bg-[#C0C0C0] border-text', badge: 'bg-text text-white', rankBg: 'bg-white text-text',      label: '🥈', nameColor: 'text-text' },
              { card: 'bg-[#CD7F32] border-text', badge: 'bg-text text-white', rankBg: 'bg-white text-[#CD7F32]', label: '🥉', nameColor: 'text-text' },
            ];
            const p = podium[idx];
            const isTop3 = idx < 3;

            return (
              <Card
                key={entry.participant_id}
                className={`p-4 flex items-center gap-4 border-thicker ${
                  isTop3
                    ? `${p.card} shadow-[6px_6px_0px_#000] -translate-y-0.5`
                    : 'bg-white border-text shadow-[4px_4px_0px_#000]'
                }`}
              >
                {/* Rank circle */}
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 border-3 border-text shadow-[2px_2px_0px_#000] font-black text-base ${
                  isTop3 ? p.rankBg : 'bg-bg-alt text-text'
                }`}>
                  {isTop3 ? p.label : `#${idx + 1}`}
                </div>

                {/* Name */}
                <div className={`flex-1 font-black text-lg truncate uppercase ${isTop3 ? p.nameColor : 'text-text'}`}>
                  {entry.name}
                </div>

                {/* Connection count */}
                <div className={`flex-shrink-0 font-black text-xl px-3 py-1 border-2 border-text shadow-[2px_2px_0px_#000] ${
                  isTop3 ? 'bg-text text-white' : 'bg-primary text-white'
                }`}>
                  {entry.connections_made_count}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
