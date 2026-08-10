"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function submitJoinRequest(data: {
  email: string;
  name: string;
  photo_url: string;
  department: string;
  paper_title: string;
}) {
  const adminClient = createAdminClient();
  
  const { error } = await adminClient.from("join_requests").upsert({
    ...data,
    status: 'pending' // Always reset to pending
  }, { onConflict: 'email' });

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}
