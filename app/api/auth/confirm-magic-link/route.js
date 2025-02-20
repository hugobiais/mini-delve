import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const redirectTo = request.nextUrl.clone();

  // Clear params from the redirect url
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");

  if (token_hash && type) {
    const supabase = await createClient(cookies());

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      // Get the user data after successful verification
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!userError && user) {
        // Check if user already exists in our database
        const { data: existingUser } = await supabase
          .from("users")
          .select()
          .eq("id", user.id)
          .single();

        // If user doesn't exist, create a new entry
        if (!existingUser) {
          const { error: insertError } = await supabase.from("users").insert([
            {
              id: user.id,
              email: user.email,
            },
          ]);

          if (insertError) {
            console.error("Error creating user:", insertError);
          }
        }
      }

      redirectTo.pathname = "/";
      return NextResponse.redirect(redirectTo);
    }
  }

  // return the user to the auth page if verification failed
  redirectTo.pathname = "/auth";
  return NextResponse.redirect(redirectTo);
}
