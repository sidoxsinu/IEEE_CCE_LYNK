"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function resetGameAction() {
  const adminClient = createAdminClient();

  try {
    // 1. Delete all connections
    // We use .not("id", "is", null) as a safe wildcard to delete all rows
    await adminClient.from("connections").delete().not("id", "is", null);

    // 2. Delete all join requests
    await adminClient.from("join_requests").delete().not("id", "is", null);

    // 3. Reset participants (unclaim everyone and remove clues)
    await adminClient.from("participants").update({
      claimed_by_uid: null,
      clue_text: null
    }).not("id", "is", null);

    // 4. Delete users (except admins)
    // Keep admins so you don't lock yourself out of the admin dashboard!
    await adminClient.from("users").delete().neq("role", "admin");

    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
