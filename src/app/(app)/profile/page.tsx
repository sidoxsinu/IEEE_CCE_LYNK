"use client";

import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export default function ProfilePage() {
  const { userProfile, eventActive } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const [connectionsCount, setConnectionsCount] = useState(0);

  // Self-clue state
  const [currentClue, setCurrentClue] = useState<string>("");
  const [editingClue, setEditingClue] = useState(false);
  const [clueInput, setClueInput] = useState("");
  const [savingClue, setSavingClue] = useState(false);
  const [clueError, setClueError] = useState<string | null>(null);
  const [clueSaved, setClueSaved] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!userProfile?.uid) return;
    
    const { count } = await supabase
      .from("connections")
      .select("*", { count: "exact", head: true })
      .eq("from_uid", userProfile.uid)
      .eq("status", "verified");
    
    if (count) setConnectionsCount(count);
  }, [supabase, userProfile?.uid]);

  const fetchMyClue = useCallback(async () => {
    const { data } = await supabase.rpc("get_clue_grid");
    // Find self from the grid to get our own self_clue
    if (data && userProfile?.uid) {
      const self = data.find((p: any) => p.claimed_by_uid === userProfile.uid);
      if (self?.self_clue) {
        setCurrentClue(self.self_clue);
        setClueInput(self.self_clue);
      }
    }
  }, [supabase, userProfile?.uid]);

  useEffect(() => {
    fetchStats();
    fetchMyClue();
  }, [fetchStats, fetchMyClue]);

  const handleSaveClue = async () => {
    const words = clueInput.trim().split(/\s+/).filter(Boolean);
    if (words.length < 3) {
      setClueError("Please write at least 3 words.");
      return;
    }
    if (clueInput.length > 100) {
      setClueError("Keep it under 100 characters.");
      return;
    }
    setSavingClue(true);
    setClueError(null);
    const { error } = await supabase.rpc("update_my_clue", { p_text: clueInput.trim() });
    setSavingClue(false);
    if (error) {
      setClueError(error.message);
    } else {
      setCurrentClue(clueInput.trim());
      setEditingClue(false);
      setClueSaved(true);
      setTimeout(() => setClueSaved(false), 3000);
    }
  };

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const isParticipant = !!userProfile?.participantId || userProfile?.role !== "admin";

  return (
    <div className="px-4 pt-8 pb-safe-bottom bg-bg-alt min-h-dvh">
      <h1 className="text-4xl tracking-tighter mb-8 font-black uppercase text-text">
        Profile
      </h1>

      {/* Profile Card */}
      <Card className="p-6 mb-6 bg-white border-thicker">
        <div className="flex items-center gap-5">
          {userProfile?.photoUrl ? (
            <img
              src={userProfile.photoUrl}
              alt={userProfile.displayName || "Avatar"}
              className="w-16 h-16 rounded-full border-4 border-text object-cover shadow-[2px_2px_0px_#000]"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center border-4 border-text shadow-[2px_2px_0px_#000]">
              <span className="text-3xl font-black text-white uppercase">
                {userProfile?.displayName?.charAt(0) || "?"}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-text truncate uppercase">
              {userProfile?.displayName}
            </h2>
            <p className="text-sm font-bold text-text-muted truncate mb-2">{userProfile?.email}</p>
            <Badge variant={userProfile?.role === "admin" ? "warning" : "primary"} className="shadow-[2px_2px_0px_#000]">
              {userProfile?.role === "admin" ? "🛡️ Admin" : "👤 Participant"}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="p-4 text-center bg-white border-thicker shadow-[4px_4px_0px_#000]">
          <p className="text-4xl font-black text-primary">{connectionsCount}</p>
          <p className="text-xs font-bold uppercase tracking-widest text-text-muted mt-1">Connections</p>
        </Card>
        <Card className="p-4 text-center bg-white border-thicker shadow-[4px_4px_0px_#000]">
          <p className="text-4xl font-black text-text">—</p>
          <p className="text-xs font-bold uppercase tracking-widest text-text-muted mt-1">Rank</p>
        </Card>
      </div>

      {/* Edit My Clue — only for participants when event is active */}
      {isParticipant && eventActive && (
        <Card className="p-5 mb-6 bg-white border-thicker">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black text-sm uppercase tracking-widest text-text">My Personal Clue</h3>
            {!editingClue && (
              <button
                onClick={() => { setEditingClue(true); setClueInput(currentClue); }}
                className="text-xs font-black uppercase text-primary border-2 border-primary px-3 py-1 hover:bg-primary hover:text-white transition-colors"
              >
                {currentClue ? "Edit" : "Add"}
              </button>
            )}
          </div>

          {clueSaved && (
            <p className="text-xs font-bold text-success mb-2">✓ Clue saved!</p>
          )}

          {editingClue ? (
            <div>
              <textarea
                value={clueInput}
                onChange={(e) => {
                  if (e.target.value.length <= 100) {
                    setClueInput(e.target.value);
                    setClueError(null);
                  }
                }}
                placeholder="e.g. I'm wearing a bright orange lanyard and love terrible puns."
                rows={3}
                className="w-full border-3 border-text p-3 text-sm font-medium text-text resize-none focus:outline-none focus:border-primary placeholder:text-text-muted mb-1"
                maxLength={100}
              />
              <div className="flex items-center justify-between mb-3">
                {clueError ? (
                  <p className="text-error text-xs font-bold">{clueError}</p>
                ) : <span />}
                <span className={`text-xs font-bold tabular-nums ml-auto ${clueInput.length >= 90 ? "text-error" : "text-text-muted"}`}>
                  {clueInput.length}/100
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditingClue(false); setClueError(null); }}
                  className="flex-1 py-2 border-3 border-text font-bold text-sm uppercase text-text-muted hover:bg-bg-alt transition-colors"
                >
                  Cancel
                </button>
                <Button
                  onClick={handleSaveClue}
                  disabled={savingClue || clueInput.trim().split(/\s+/).filter(Boolean).length < 3}
                  className="flex-1 py-2 justify-center text-sm"
                >
                  {savingClue ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm font-medium text-text leading-relaxed">
              {currentClue
                ? `"${currentClue}"`
                : <span className="text-text-muted italic">No personal clue added yet. Others will only see your structured clue card.</span>
              }
            </p>
          )}
        </Card>
      )}

      {/* Admin Link */}
      {userProfile?.role === "admin" && (
        <Button
          onClick={() => router.push("/admin")}
          className="w-full mb-4 justify-center text-lg py-4 border-thicker"
          id="admin-dashboard-link"
        >
          🛡️ Admin Dashboard
        </Button>
      )}

      {/* Sign Out */}
      <Button
        variant="secondary"
        onClick={handleSignOut}
        className="w-full justify-center text-lg py-4 border-thicker bg-error text-white hover:bg-red-700 hover:shadow-hard-hover active:shadow-none"
        id="sign-out-btn"
      >
        Sign Out
      </Button>
    </div>
  );
}
