import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import imageCompression from "browser-image-compression";
import { Camera, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export interface ParticipantCard {
  id: string;
  clue_text: string;
  self_clue?: string | null;
  department: string;
  connections_made_count: number;
  connection_status: string | null;
  claimed_by_uid?: string;
}

interface ConnectionModalProps {
  participant: ParticipantCard;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectionModal({ participant, onClose, onSuccess }: ConnectionModalProps) {
  const [step, setStep] = useState<"input" | "submitting" | "success" | "error">("input");
  const [errorMessage, setErrorMessage] = useState("");
  const [code, setCode] = useState("");
  const [fact, setFact] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !fact || !photo) {
      setErrorMessage("Please fill all fields and snap a selfie!");
      return;
    }

    setStep("submitting");
    setErrorMessage("");

    try {
      // 1. Compress Image
      const compressedFile = await imageCompression(photo, {
        maxSizeMB: 0.4, // Max ~400KB
        maxWidthOrHeight: 1080,
        useWebWorker: true,
      });

      // 2. Upload to Supabase Storage
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not logged in");

      const fileExt = compressedFile.name.split('.').pop() || 'jpg';
      const fileName = `${uid}/${crypto.randomUUID()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("selfies")
        .upload(fileName, compressedFile, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("selfies")
        .getPublicUrl(uploadData.path);

      const publicUrl = publicUrlData.publicUrl;

      // 3. Call RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc("submit_connection", {
        p_target_participant_id: participant.id,
        p_submitted_code: code.trim(),
        p_selfie_url: publicUrl,
        p_fact_text: fact.trim(),
      });

      if (rpcError) throw rpcError;

      // 4. Handle RPC Result
      const status = Array.isArray(rpcData) && rpcData.length > 0 ? rpcData[0].connection_status : null;

      if (status === "verified") {
        setStep("success");
        onSuccess();
      } else if (status === "rejected") {
        setStep("error");
        setErrorMessage("Incorrect code! Ask them again.");
      } else if (status === "too_many_attempts") {
        setStep("error");
        setErrorMessage("Too many incorrect attempts. Please try someone else.");
      } else {
        throw new Error("Unknown response from server.");
      }
    } catch (err: any) {
      console.error(err);
      setStep("error");
      setErrorMessage(err.message || "An error occurred. Please try again.");
    }
  };

  if (participant.connection_status === "verified") {
    return (
      <Modal isOpen={true} onClose={onClose} title="Connection Verified">
        <div className="text-center py-6">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="text-2xl font-black text-text mb-2 uppercase">Already Connected!</h2>
          <p className="text-text-muted font-medium">You've successfully connected with this participant.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={true} onClose={() => {
      if (step !== "submitting") onClose();
    }} title="Make a Connection">
      {step === "success" ? (
        <div className="text-center py-10">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="text-2xl font-black text-text mb-2 uppercase">Connection Verified!</h2>
          <p className="text-text-muted font-medium mb-6">You've successfully revealed this participant.</p>
          <Button onClick={onClose} className="w-full justify-center">
            Continue
          </Button>
        </div>
      ) : (
        <>
          <p className="text-xs text-text-muted font-bold mb-3">Find the person who matches this clue!</p>
          
          <Card className="p-3 bg-white border-thicker mb-4">
            <span className="text-xs font-black uppercase tracking-wider text-primary">Their Clue</span>
            <p className="text-text font-bold text-lg mt-1">&quot;{participant.self_clue || participant.clue_text || "No clue provided yet."}&quot;</p>
            <div className="mt-2 text-xs font-bold text-text-muted">{participant.department}</div>
          </Card>

          {step === "error" && (
            <div className="mb-4 p-4 bg-error text-white border-2 border-text shadow-[2px_2px_0px_#000] flex items-start gap-3">
              <AlertCircle className="shrink-0 w-5 h-5 mt-0.5" />
              <p className="text-sm font-bold">{errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Their Unique Code"
              type="text"
              placeholder="Ask them for their 6-character code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={step === "submitting"}
              required
            />

            <Input
              label="Fact Learned"
              type="text"
              placeholder="What did you learn about them?"
              value={fact}
              onChange={(e) => setFact(e.target.value)}
              disabled={step === "submitting"}
              required
            />

            <div>
              <label className="block text-sm font-bold font-heading text-text mb-2">Selfie Together</label>
              <input
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                ref={fileInputRef}
                onChange={handlePhotoCapture}
                disabled={step === "submitting"}
              />
              
              {photoPreview ? (
                <div className="relative rounded-sm overflow-hidden border-2 border-text aspect-video bg-text flex items-center justify-center">
                  <img src={photoPreview} alt="Selfie preview" className="object-cover w-full h-full" />
                  <button
                    type="button"
                    onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                    className="absolute top-2 right-2 bg-white border-2 border-text p-2 hover:bg-bg-alt active:translate-y-1 active:translate-x-1 transition-transform"
                    disabled={step === "submitting"}
                  >
                    <X size={16} className="text-text" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={step === "submitting"}
                  className="w-full flex flex-col items-center justify-center gap-1 py-4 border-2 border-dashed border-text bg-white hover:bg-bg-alt text-text font-bold transition-colors shadow-[2px_2px_0px_#000] active:translate-y-1 active:translate-x-1 active:shadow-none"
                >
                  <Camera size={24} className="text-primary mb-1" />
                  <span className="text-xs">Tap to snap a selfie</span>
                </button>
              )}
            </div>

            <div className="pt-1">
              <Button
                type="submit"
                disabled={step === "submitting" || !code || !fact || !photo}
                isLoading={step === "submitting"}
                className="w-full justify-center text-base py-3"
              >
                {step === "error" ? "Try Again" : "Submit Connection"}
              </Button>
            </div>
          </form>
        </>
      )}
    </Modal>
  );
}
