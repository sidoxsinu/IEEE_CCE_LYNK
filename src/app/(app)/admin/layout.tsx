import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  // Fetch the role of the user
  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .eq("uid", session.user.id)
    .single();

  if (!userProfile || userProfile.role !== "admin") {
    redirect("/home");
  }

  return <>{children}</>;
}
