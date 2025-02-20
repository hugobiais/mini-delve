import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function GET(request) {
  // Parse the request URL to get search parameters.
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing code or state parameter" },
      { status: 400 }
    );
  }

  // TODO: Validate that the 'state' matches the one you stored (via cookies or session)

  try {
    // Exchange the authorization code for an access token
    const tokenRes = await fetch("https://api.supabase.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.NEXT_PUBLIC_SUPABASE_CLIENT_ID,
        client_secret: process.env.SUPABASE_CLIENT_SECRET,
        code,
        redirect_uri:
          process.env.NODE_ENV === "development"
            ? process.env.NEXT_PUBLIC_SUPABASE_REDIRECT_URI_DEV
            : process.env.NEXT_PUBLIC_SUPABASE_REDIRECT_URI_PROD,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return NextResponse.json(
        { error: "Token exchange failed", details: tokenData },
        { status: 400 }
      );
    }

    // Get organization info using the access token
    const orgRes = await fetch("https://api.supabase.com/v1/organizations", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const orgData = await orgRes.json();
    if (!orgRes.ok || !orgData.length) {
      return NextResponse.json(
        { error: "Failed to fetch organization data" },
        { status: 400 }
      );
    }

    const supabase = await createClient(cookies());

    // Get the current user's ID from the session
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "No authenticated user found" },
        { status: 401 }
      );
    }

    // Compute token expiration date as ISO string for timestamptz compatibility
    const tokenExpiration = new Date(
      Date.now() + tokenData.expires_in * 1000
    ).toISOString();

    // Insert organization data into the database
    const { error: insertError } = await supabase.from("organizations").upsert(
      {
        user_id: user.id,
        supabase_org_id: orgData[0].id,
        name: orgData[0].name,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: tokenExpiration,
      },
      {
        onConflict: "user_id,supabase_org_id",
      }
    );

    if (insertError) {
      console.error("Error inserting organization:", insertError);
      return NextResponse.json(
        { error: "Failed to store organization data" },
        { status: 500 }
      );
    }

    // Redirect to home page after successful storage
    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error("Error during token exchange:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
