"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import Papa from "papaparse";
import { Loader2, AlertCircle, CheckCircle, EyeOff, Eye } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

type AdminView = "dashboard" | "event-controls" | "selfie-moderation" | "clue-moderation" | "import-export";

interface ConfigState {
  event_active: boolean;
  leaderboard_visible: boolean;
}

interface ModerationItem {
  id: string;
  from_name: string;
  to_name: string;
  fact_learned: string;
  selfie_url: string;
  status: string;
  hidden: boolean;
  created_at: string;
}

interface ClueItem {
  id: string;
  name: string;
  email: string;
  department: string;
  clue_text: string;
  self_clue: string;
}

export default function AdminPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  
  const [view, setView] = useState<AdminView>("dashboard");
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [queue, setQueue] = useState<ModerationItem[]>([]);
  const [clueQueue, setClueQueue] = useState<ClueItem[]>([]);
  const [editingClue, setEditingClue] = useState<{id: string; value: string} | null>(null);
  
  // Loading states
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [updatingConfig, setUpdatingConfig] = useState(false);
  
  // Feedback states
  const [importFeedback, setImportFeedback] = useState<{type: 'success' | 'error', msg: string} | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const emptySingle = { name: '', email: '', department: '', paper_title: '', interest: '' };
  const [single, setSingle] = useState(emptySingle);
  const [addingSingle, setAddingSingle] = useState(false);
  const [singleFeedback, setSingleFeedback] = useState<{type: 'success'|'error', msg: string}|null>(null);

  useEffect(() => {
    if (!authLoading && userProfile?.role !== "admin") {
      router.push("/home");
    }
  }, [userProfile, authLoading, router]);

  useEffect(() => {
    if (userProfile?.role === "admin") {
      fetchConfig();
    }
  }, [userProfile]);

  useEffect(() => {
    if (view === "selfie-moderation") {
      fetchModerationQueue();
    }
    if (view === "clue-moderation") {
      fetchClueQueue();
    }
  }, [view]);

  const fetchConfig = async () => {
    setLoadingConfig(true);
    const { data, error } = await supabase.from("config").select("*").eq("id", "main").single();
    if (!error && data) {
      setConfig({
        event_active: data.event_active,
        leaderboard_visible: data.leaderboard_visible
      });
    }
    setLoadingConfig(false);
  };

  const fetchModerationQueue = async () => {
    setLoadingQueue(true);
    const { data, error } = await supabase.rpc("get_admin_moderation_queue");
    if (!error && data) {
      setQueue(data);
    }
    setLoadingQueue(false);
  };

  const fetchClueQueue = async () => {
    setLoadingQueue(true);
    const { data, error } = await supabase.rpc("get_admin_clue_queue");
    if (!error && data) setClueQueue(data);
    setLoadingQueue(false);
  };

  const clearSelfClue = async (participantId: string) => {
    const { error } = await supabase.rpc("admin_clear_self_clue", { p_participant_id: participantId });
    if (error) { alert("Failed: " + error.message); return; }
    setClueQueue(q => q.filter(item => item.id !== participantId));
  };

  const toggleConfig = async (key: keyof ConfigState) => {
    if (!config || updatingConfig) return;
    setUpdatingConfig(true);
    
    const newValue = !config[key];
    // Optimistic UI could be risky if it fails, but prompt says:
    // "Wait for the actual response. If successful update UI state. If failed revert UI."
    // So we don't update state until success.
    
    const { error } = await supabase
      .from("config")
      .update({ [key]: newValue })
      .eq("id", "main");
      
    if (error) {
      alert(`Failed to update ${key}: ` + error.message);
    } else {
      setConfig({ ...config, [key]: newValue });
    }
    setUpdatingConfig(false);
  };

  const toggleSelfieVisibility = async (connectionId: string, currentHidden: boolean) => {
    const newHidden = !currentHidden;
    // Optimistic approach for perceived performance, but revert on error
    setQueue(q => q.map(item => item.id === connectionId ? { ...item, hidden: newHidden } : item));
    
    const { error } = await supabase.rpc("toggle_selfie_visibility", {
      p_connection_id: connectionId,
      p_hidden: newHidden
    });
      
    if (error) {
      alert("Failed to update visibility: " + error.message);
      // Revert
      setQueue(q => q.map(item => item.id === connectionId ? { ...item, hidden: currentHidden } : item));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.rpc("get_admin_export");
      if (error) throw error;
      if (!data || data.length === 0) {
        alert("No participants to export.");
        setExporting(false);
        return;
      }
      
      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const date = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `lynk-participants-export-${date}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (err: any) {
      alert("Export failed: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    setImportFeedback(null);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const response = await fetch('/api/admin/import-participants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: results.data }),
          });
          
          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error || "Import failed");
          }
          
          setImportFeedback({
            type: 'success',
            msg: `Import complete. Rows processed: ${results.data.length}, Rows imported: ${result.count}`
          });
        } catch (err: any) {
          setImportFeedback({ type: 'error', msg: err.message });
        } finally {
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      },
      error: (error) => {
        setImportFeedback({ type: 'error', msg: "Failed to parse CSV: " + error.message });
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  };

  const handleAddSingle = async () => {
    if (!single.name.trim() || !single.email.trim() || !single.department.trim() || !single.paper_title.trim()) {
      setSingleFeedback({ type: 'error', msg: 'Name, Email, Department, and Paper Title are required.' });
      return;
    }
    setAddingSingle(true);
    setSingleFeedback(null);
    try {
      const response = await fetch('/api/admin/import-participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: [{
            'Name': single.name.trim(),
            'Email': single.email.trim().toLowerCase(),
            'Department': single.department.trim(),
            'Paper Title': single.paper_title.trim(),
            'Fun Fact': single.interest.trim(),
          }]
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to add participant');
      if (result.count === 0) {
        setSingleFeedback({ type: 'error', msg: 'A participant with that email already exists — skipped.' });
      } else {
        setSingleFeedback({ type: 'success', msg: `${single.name} added successfully!` });
        setSingle(emptySingle);
      }
    } catch (err: any) {
      setSingleFeedback({ type: 'error', msg: err.message });
    } finally {
      setAddingSingle(false);
    }
  };

  if (authLoading || userProfile?.role !== "admin") {
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
            {view === "dashboard" ? "Dashboard" : view.replace("-", " ")}
          </h1>
        </div>
        <Button
          variant="secondary"
          onClick={() => view === "dashboard" ? router.push("/home") : setView("dashboard")}
          className="text-sm border-2 px-3 py-1 shadow-[2px_2px_0px_#000] active:translate-y-1 active:translate-x-1 active:shadow-none bg-white hover:bg-bg-alt min-h-[44px]"
        >
          {view === "dashboard" ? "← App" : "← Back"}
        </Button>
      </div>

      {view === "dashboard" && (
        <div className="space-y-4">
          {[
            { id: "import-export", icon: "📥", label: "Import / Export Data", desc: "Manage participant CSVs" },
            { id: "event-controls", icon: "⚙️", label: "Event Controls", desc: "Toggle event active / leaderboard" },
            { id: "selfie-moderation", icon: "🖼️", label: "Selfie Moderation", desc: "Review uploaded selfies" },
            { id: "clue-moderation", icon: "✏️", label: "Clue Moderation", desc: "Review user-submitted personal clues" },
          ].map((action) => (
            <button
              key={action.id}
              onClick={() => setView(action.id as AdminView)}
              className="w-full text-left block bg-transparent border-0 outline-none p-0 min-h-[44px]"
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
      )}

      {view === "event-controls" && (
        <div className="space-y-6">
          {loadingConfig ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" size={32} /></div>
          ) : config ? (
            <>
              <Card className="p-6 bg-white border-thicker shadow-[4px_4px_0px_#000]">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-xl font-black uppercase">Event Active</h3>
                    <p className="text-sm font-bold text-text-muted">Allows new connections to be submitted.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold uppercase">{config.event_active ? "ON" : "OFF"}</span>
                    <button 
                      onClick={() => toggleConfig("event_active")}
                      disabled={updatingConfig}
                      className={`w-14 h-8 rounded-full border-2 border-text relative transition-colors min-h-[44px] min-w-[60px] ${config.event_active ? "bg-success" : "bg-bg-alt"}`}
                    >
                      <div className={`absolute top-1 w-5 h-5 rounded-full border-2 border-text bg-white transition-all ${config.event_active ? "left-7" : "left-1"}`} />
                    </button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white border-thicker shadow-[4px_4px_0px_#000]">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-xl font-black uppercase">Leaderboard</h3>
                    <p className="text-sm font-bold text-text-muted">Make leaderboard visible to all participants.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold uppercase">{config.leaderboard_visible ? "ON" : "OFF"}</span>
                    <button 
                      onClick={() => toggleConfig("leaderboard_visible")}
                      disabled={updatingConfig}
                      className={`w-14 h-8 rounded-full border-2 border-text relative transition-colors min-h-[44px] min-w-[60px] ${config.leaderboard_visible ? "bg-success" : "bg-bg-alt"}`}
                    >
                      <div className={`absolute top-1 w-5 h-5 rounded-full border-2 border-text bg-white transition-all ${config.leaderboard_visible ? "left-7" : "left-1"}`} />
                    </button>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <p>Failed to load configuration.</p>
          )}
        </div>
      )}

      {view === "import-export" && (
        <div className="space-y-6">
          <Card className="p-6 bg-white border-thicker shadow-[4px_4px_0px_#000]">
            <h3 className="text-xl font-black uppercase mb-2">Import Participants</h3>
            <p className="text-sm font-bold text-text-muted mb-6">Upload a CSV containing columns: Name, Email, Department, Paper Title, Fun Fact</p>
            
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleImport}
            />
            
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={importing}
              isLoading={importing}
              className="w-full justify-center min-h-[44px]"
            >
              Select CSV File
            </Button>
            
            {importFeedback && (
              <div className={`mt-4 p-4 border-2 border-text shadow-[2px_2px_0px_#000] flex items-start gap-3 ${importFeedback.type === 'success' ? 'bg-success text-white' : 'bg-error text-white'}`}>
                {importFeedback.type === 'success' ? <CheckCircle className="shrink-0" /> : <AlertCircle className="shrink-0" />}
                <p className="text-sm font-bold">{importFeedback.msg}</p>
              </div>
            )}
          </Card>

          {/* Add Single Participant */}
          <Card className="p-6 bg-white border-thicker shadow-[4px_4px_0px_#000]">
            <h3 className="text-xl font-black uppercase mb-2">Add Single Participant</h3>
            <p className="text-sm font-bold text-text-muted mb-5">Manually add one participant by filling in the fields below.</p>

            <div className="grid grid-cols-1 gap-3">
              {[
                { key: 'name', label: 'Full Name', required: true, placeholder: 'e.g. Ahmed Al-Farsi' },
                { key: 'email', label: 'Email', required: true, placeholder: 'e.g. ahmed@example.com', type: 'email' },
                { key: 'department', label: 'Department', required: true, placeholder: 'e.g. Computer Science' },
                { key: 'paper_title', label: 'Paper Title', required: true, placeholder: 'e.g. Deep Learning in Edge Computing' },
                { key: 'interest', label: 'Fun Fact / Interest', required: false, placeholder: 'e.g. Loves hiking (optional)' },
              ].map(({ key, label, required, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-xs font-black uppercase tracking-widest mb-1 text-text">
                    {label}{required && <span className="text-error ml-1">*</span>}
                  </label>
                  <input
                    type={type || 'text'}
                    value={(single as any)[key]}
                    onChange={e => { setSingle(s => ({ ...s, [key]: e.target.value })); setSingleFeedback(null); }}
                    placeholder={placeholder}
                    className="w-full border-3 border-text px-3 py-2 text-sm font-medium text-text focus:outline-none focus:border-primary placeholder:text-text-muted"
                  />
                </div>
              ))}
            </div>

            {singleFeedback && (
              <div className={`mt-4 p-4 border-2 border-text shadow-[2px_2px_0px_#000] flex items-start gap-3 ${singleFeedback.type === 'success' ? 'bg-success text-white' : 'bg-error text-white'}`}>
                {singleFeedback.type === 'success' ? <CheckCircle className="shrink-0" /> : <AlertCircle className="shrink-0" />}
                <p className="text-sm font-bold">{singleFeedback.msg}</p>
              </div>
            )}

            <Button
              onClick={handleAddSingle}
              disabled={addingSingle}
              isLoading={addingSingle}
              className="w-full justify-center mt-5 min-h-[44px]"
            >
              Add Participant
            </Button>
          </Card>

          <Card className="p-6 bg-white border-thicker shadow-[4px_4px_0px_#000]">
            <h3 className="text-xl font-black uppercase mb-2">Export Data</h3>
            <p className="text-sm font-bold text-text-muted mb-6">Download a full CSV of all participants, their generated unique codes, and their connection counts.</p>
            
            <Button 
              onClick={handleExport}
              disabled={exporting}
              isLoading={exporting}
              className="w-full justify-center min-h-[44px]"
            >
              Export CSV
            </Button>
          </Card>
        </div>
      )}

      {view === "selfie-moderation" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm font-bold text-text-muted">Showing latest 100 selfies</p>
            <Button variant="secondary" onClick={fetchModerationQueue} disabled={loadingQueue} className="text-xs px-2 py-1 min-h-[44px]">Refresh</Button>
          </div>
          
          {loadingQueue ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" size={32} /></div>
          ) : queue.length === 0 ? (
            <Card className="p-8 text-center bg-white border-thicker shadow-[4px_4px_0px_#000]">
              <p className="font-bold">No selfies found.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {queue.map(item => (
                <Card key={item.id} className={`overflow-hidden bg-white border-thicker shadow-[4px_4px_0px_#000] flex flex-col ${item.hidden ? 'opacity-80' : ''}`}>
                  <div className="aspect-square relative border-b-4 border-text bg-bg-alt">
                    <img src={item.selfie_url} alt="Selfie" className={`w-full h-full object-cover ${item.hidden ? 'grayscale' : ''}`} />
                    {item.hidden && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Badge variant="error" className="text-lg py-2 px-4 shadow-[4px_4px_0px_#000] border-4">HIDDEN</Badge>
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col gap-3">
                    <div>
                      <p className="text-xs font-bold text-text-muted uppercase">From → To</p>
                      <p className="text-base font-black truncate">{item.from_name} → {item.to_name}</p>
                    </div>
                    <div className="bg-bg-alt p-2 border-2 border-text text-sm font-bold">
                      "{item.fact_learned}"
                    </div>
                    <Button 
                      variant={item.hidden ? "primary" : "secondary"}
                      className={`w-full justify-center mt-2 min-h-[44px] ${!item.hidden ? 'border-2' : ''}`}
                      onClick={() => toggleSelfieVisibility(item.id, item.hidden)}
                    >
                      {item.hidden ? <><Eye size={18} /> Unhide Selfie</> : <><EyeOff size={18} /> Hide Selfie</>}
                    </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      )}

      {view === "clue-moderation" && (
        <div className="space-y-4">
          <p className="text-sm font-bold text-text-muted">
            All participants who have submitted a personal clue. You can clear any clue here.
          </p>
          {loadingQueue ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" size={32} /></div>
          ) : clueQueue.length === 0 ? (
            <Card className="p-8 text-center bg-white border-thicker shadow-[4px_4px_0px_#000]">
              <p className="font-bold">No personal clues submitted yet.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {clueQueue.map(item => (
                <Card key={item.id} className="p-4 bg-white border-thicker shadow-[4px_4px_0px_#000]">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="font-black text-text uppercase truncate">{item.name}</p>
                      <p className="text-xs text-text-muted font-bold">{item.department} &middot; {item.email}</p>
                    </div>
                    <button
                      onClick={() => clearSelfClue(item.id)}
                      className="flex-shrink-0 text-xs font-black uppercase text-error border-2 border-error px-3 py-1 hover:bg-error hover:text-white transition-colors min-h-[36px]"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="bg-bg-alt border-2 border-text p-3 text-sm font-medium text-text">
                    <p className="text-xs font-black uppercase text-text-muted mb-1">Personal clue</p>
                    &ldquo;{item.self_clue}&rdquo;
                  </div>
                  <div className="mt-2 bg-white border-2 border-text-muted p-3 text-xs font-medium text-text-muted">
                    <p className="text-xs font-black uppercase mb-1">Admin clue (baseline)</p>
                    {item.clue_text}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "clue-moderation" && (
        <div className="space-y-4">
          <p className="text-sm font-bold text-text-muted">
            All participants who submitted a personal clue. You can clear any clue here.
          </p>
          {loadingQueue ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" size={32} /></div>
          ) : clueQueue.length === 0 ? (
            <Card className="p-8 text-center bg-white border-thicker shadow-[4px_4px_0px_#000]">
              <p className="font-bold">No personal clues submitted yet.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {clueQueue.map(item => (
                <Card key={item.id} className="p-4 bg-white border-thicker shadow-[4px_4px_0px_#000]">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="font-black text-text uppercase truncate">{item.name}</p>
                      <p className="text-xs text-text-muted font-bold">{item.department} &middot; {item.email}</p>
                    </div>
                    <button
                      onClick={() => clearSelfClue(item.id)}
                      className="flex-shrink-0 text-xs font-black uppercase text-error border-2 border-error px-3 py-1 hover:bg-error hover:text-white transition-colors min-h-[36px]"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="bg-bg-alt border-2 border-text p-3 text-sm font-medium text-text">
                    <p className="text-xs font-black uppercase text-text-muted mb-1">Personal clue</p>
                    &ldquo;{item.self_clue}&rdquo;
                  </div>
                  <div className="mt-2 bg-white border-2 border-text-muted p-3 text-xs font-medium text-text-muted">
                    <p className="text-xs font-black uppercase mb-1">Admin clue (baseline)</p>
                    {item.clue_text}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

