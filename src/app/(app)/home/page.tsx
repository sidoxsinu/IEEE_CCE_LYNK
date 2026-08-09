"use client";

import { useAuth } from "@/components/AuthProvider";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConnectionModal, ParticipantCard } from "@/components/ConnectionModal";
import { SelfClueModal } from "@/components/SelfClueModal";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { getMySelfClue } from "@/app/actions/participant";

// Inner component that reads search params
function HomePageInner() {
  const { userProfile, loading } = useAuth();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [participants, setParticipants] = useState<ParticipantCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantCard | null>(null);
  const [showSelfClueModal, setShowSelfClueModal] = useState(false);
  const [myCode, setMyCode] = useState<string | null>(null);

  const fetchClueGrid = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc("get_clue_grid");
      if (error) throw error;
      setParticipants(data || []);
    } catch (err: any) {
      console.error("Failed to fetch clue grid:", err);
      setError(err.message || "Failed to load participants.");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Fetch user's own unique code
  const fetchMyCode = useCallback(async () => {
    const { data } = await supabase.rpc("get_my_code");
    if (data) setMyCode(data);
  }, [supabase]);

  useEffect(() => {
    fetchClueGrid();
    fetchMyCode();
  }, [fetchClueGrid, fetchMyCode]);

  // Check if user has set their personal clue yet
  useEffect(() => {
    let mounted = true;
    async function checkClue() {
      try {
        const res = await getMySelfClue();
        if (mounted && !res.error && res.selfClue === null) {
          setTimeout(() => {
            if (mounted) setShowSelfClueModal(true);
          }, 800);
        }
      } catch (err) {
        console.error("Failed to check self clue:", err);
      }
    }
    if (userProfile?.uid) {
      checkClue();
    }
    return () => { mounted = false; };
  }, [userProfile?.uid]);

  const handleSelfClueDone = () => {
    setShowSelfClueModal(false);
    // Remove URL params if any
    if (searchParams.toString()) {
      router.replace("/home", { scroll: false });
    }
    fetchClueGrid(); // Refresh so the card reflects the new clue
  };

  // Exclude self from grid if user is also a participant
  const gridParticipants = participants.filter(p => p.claimed_by_uid !== userProfile?.uid);
  const totalParticipants = gridParticipants.length;
  const verifiedConnections = gridParticipants.filter(p => p.connection_status === "verified").length;
  const progressPercent = totalParticipants > 0 ? (verifiedConnections / totalParticipants) * 100 : 0;

  return (
    <div className="px-4 pt-8 pb-safe-bottom min-h-dvh bg-bg-alt">
      
      {/* Header */}
      <div className="mb-6">
        <p className="text-text-muted font-bold text-sm uppercase mb-1 tracking-wider">Welcome back,</p>
        <h1 className="text-4xl font-black uppercase">
          {userProfile?.displayName?.split(" ")[0] || "Participant"} 👋
        </h1>
      </div>

      {/* Your Code Badge — persistent fixed strip at top */}
      {myCode && (
        <div className="flex items-center gap-3 mb-6 bg-primary border-4 border-text shadow-[4px_4px_0px_#000] px-4 py-3">
          <div>
            <p className="text-white text-xs font-black uppercase tracking-widest mb-0.5">Your code</p>
            <p className="text-white font-black text-2xl tracking-[0.2em] font-mono">{myCode}</p>
          </div>
          <div className="ml-auto text-white text-xs font-bold text-right leading-relaxed">
            Tell others<br />this code ↑
          </div>
        </div>
      )}

      {/* Progress Card */}
      <Card className="p-5 mb-8 bg-white border-thicker">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold uppercase tracking-wider text-text">Connections</span>
          <span className="text-lg font-black text-primary">
            {verifiedConnections} <span className="text-text-muted font-bold text-sm">/ {totalParticipants}</span>
          </span>
        </div>
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <p className="text-xs font-bold text-text-muted mt-3">
          Start discovering and connecting with fellow participants!
        </p>
      </Card>

      {/* Clue Grid */}
      <div>
        <h2 className="text-2xl font-black text-text mb-4 uppercase flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
          Clue Cards
        </h2>

        {error ? (
          <Card className="p-6 text-center border-error bg-red-50">
            <h3 className="text-error font-bold mb-2">Error loading clues</h3>
            <p className="text-sm text-text-muted mb-4">{error}</p>
            <button 
              onClick={fetchClueGrid}
              className="px-4 py-2 bg-error text-white font-bold text-sm border-2 border-text shadow-[2px_2px_0px_#000] active:translate-y-1 active:translate-x-1 active:shadow-none"
            >
              Try Again
            </button>
          </Card>
        ) : isLoading || loading ? (
          <div className="flex justify-center p-12">
            <div className="w-10 h-10 rounded-full border-4 border-text border-t-primary animate-spin" />
          </div>
        ) : gridParticipants.length === 0 ? (
          <Card className="p-8 text-center bg-white border-thicker border-dashed">
            <div className="w-16 h-16 rounded-full border-4 border-text bg-warning flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 className="text-xl font-black uppercase mb-2">No participants yet</h3>
            <p className="text-text-muted font-medium text-sm leading-relaxed">
              The event organiser hasn&apos;t imported participant data yet. Check back when the event starts!
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            {gridParticipants.map((p) => {
              const isVerified = p.connection_status === "verified";
              // Display the user's personal clue. Fall back to admin clue if not set yet.
              const displayClue = p.self_clue || p.clue_text || "No clue provided yet.";

              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedParticipant(p)}
                  className={`text-left block w-full p-0 bg-transparent border-0 outline-none`}
                >
                  <Card 
                    hoverable
                    className={`p-5 h-full ${
                      isVerified
                        ? "bg-primary text-white border-thicker"
                        : "bg-white border-thicker"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <span className={`text-xs font-black uppercase tracking-widest ${isVerified ? 'text-white' : 'text-primary'}`}>
                        {p.department}
                      </span>
                      {isVerified && (
                        <Badge variant="success" className="shadow-[2px_2px_0px_#000]">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M20 6 9 17l-5-5"/></svg>
                          Connected
                        </Badge>
                      )}
                      {p.connection_status === "pending" && (
                        <Badge variant="warning" className="shadow-[2px_2px_0px_#000]">Pending</Badge>
                      )}
                      {p.connection_status === "rejected" && (
                        <Badge variant="error" className="shadow-[2px_2px_0px_#000]">Try Again</Badge>
                      )}
                    </div>
                    <p className={`text-base font-semibold leading-relaxed ${isVerified ? "text-white" : "text-text"}`}>
                      &quot;{displayClue}&quot;
                    </p>
                  </Card>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedParticipant && (
        <ConnectionModal
          participant={selectedParticipant}
          onClose={() => setSelectedParticipant(null)}
          onSuccess={() => {
            fetchClueGrid();
          }}
        />
      )}

      {/* First-login self clue prompt */}
      {showSelfClueModal && (
        <SelfClueModal onDone={handleSelfClueDone} />
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-12"><div className="w-10 h-10 rounded-full border-4 border-text border-t-primary animate-spin" /></div>}>
      <HomePageInner />
    </Suspense>
  );
}
