"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

interface Props {
  onDone: () => void;
}

export function SelfClueModal({ onDone }: Props) {
  const [clue, setClue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleSave = async () => {
    const words = clue.trim().split(/\s+/).filter(Boolean);
    if (words.length < 3) {
      setError("Please write at least 3 words so others can find you.");
      return;
    }
    if (clue.length > 100) {
      setError("Keep it under 100 characters.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("update_my_clue", { p_text: clue.trim() });
    if (rpcErr) {
      setError(rpcErr.message);
      setSaving(false);
      return;
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white border-4 border-text shadow-[8px_8px_0px_#000] w-full max-w-md">
        
        {/* Header */}
        <div className="bg-primary border-b-4 border-text p-5">
          <p className="text-white text-xs font-bold uppercase tracking-widest mb-0.5">Welcome to LYNK!</p>
          <h2 className="text-white font-black text-xl uppercase">Add Your Personal Clue</h2>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="text-text font-medium text-sm mb-5 leading-relaxed">
            Before you start connecting, add a short hint so others can spot you in person. <strong>Minimum 3 words</strong> — be specific!
          </p>

          <div className="mb-1">
            <label htmlFor="self-clue-input" className="block text-xs font-black uppercase tracking-widest mb-2 text-text">
              Your personal clue
            </label>
            <textarea
              id="self-clue-input"
              value={clue}
              onChange={(e) => {
                if (e.target.value.length <= 100) {
                  setClue(e.target.value);
                  setError(null);
                }
              }}
              placeholder="e.g. I'm wearing a bright orange lanyard and love terrible puns."
              rows={3}
              className="w-full border-3 border-text p-3 text-sm font-medium text-text resize-none focus:outline-none focus:border-primary placeholder:text-text-muted"
              maxLength={100}
            />
            <div className="flex justify-between items-center mt-1">
              {error ? (
                <p className="text-error text-xs font-bold">{error}</p>
              ) : (
                <span />
              )}
              <span className={`text-xs font-bold tabular-nums ml-auto ${clue.length >= 90 ? "text-error" : "text-text-muted"}`}>
                {clue.length}/100
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-4 border-text p-4">
          <Button
            onClick={handleSave}
            disabled={saving || clue.trim().split(/\s+/).filter(Boolean).length < 3}
            className="w-full py-3 justify-center text-sm"
          >
            {saving ? "Saving…" : "Save My Clue"}
          </Button>
          <p className="text-center text-xs text-text-muted font-bold mt-2">
            {clue.trim().split(/\s+/).filter(Boolean).length < 3
              ? `${3 - clue.trim().split(/\s+/).filter(Boolean).length} more word${3 - clue.trim().split(/\s+/).filter(Boolean).length === 1 ? '' : 's'} needed`
              : '✓ Ready to save'}
          </p>
        </div>
      </div>
    </div>
  );
}
