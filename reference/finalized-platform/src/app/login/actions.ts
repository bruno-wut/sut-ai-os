"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(4).max(200),
  next: z
    .string()
    .startsWith("/")
    .max(500)
    .refine((value) => !value.startsWith("//"), "Invalid return path.")
    .default("/staff/dashboard"),
});

export type LoginState = Readonly<{ error: string | null }>;

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || "/staff/dashboard",
  });

  if (!parsed.success) {
    return { error: "Enter a valid staff email and password." };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { error: "Staff sign-in is not configured yet." };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { error: "The email or password was not recognised." };
  }

  const { data: staffProfile } = await supabase
    .from("staff_profiles")
    .select("user_id")
    .eq("user_id", data.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!staffProfile) {
    await supabase.auth.signOut();
    return { error: "This account does not have active hotel staff access." };
  }

  redirect(parsed.data.next as Route);
}
