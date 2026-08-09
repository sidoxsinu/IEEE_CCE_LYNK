"use server";

import { createClient } from "@/lib/supabase/server";

export async function getMySelfClue() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Call an RPC or use Service Role to read the participant's self_clue
  // Since participants table denies select, we can use an RPC.
  // Wait, the user already provided get_clue_grid.
  // Let's create a secure RPC inline here using the service role client instead to avoid needing another RPC deployment
  
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const adminDb = createAdminClient();

  const { data, error } = await adminDb
    .from("participants")
    .select("self_clue")
    .eq("claimed_by_uid", user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return { selfClue: null };
    console.error("Error fetching self_clue:", error);
    return { error: error.message };
  }

  return { selfClue: data?.self_clue || null };
}

export async function adminResetClue(participantId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("admin_reset_clue", { p_participant_id: participantId });
  if (error) {
    console.error("Admin reset clue error:", error);
    return { error: error.message };
  }

  return { success: true };
}
