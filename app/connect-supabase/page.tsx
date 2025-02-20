"use client";

import React from "react";
import Image from "next/image";

export default function ConnectSupabase() {
  const handleConnect = () => {
    // In production, generate a random state and store it securely (e.g., in a secure cookie)
    const state = Math.random().toString(36).substring(2);
    // For example purposes, we store it in localStorage.
    // In production, use an HttpOnly cookie or your session store.
    localStorage.setItem("supabase_oauth_state", state);

    // Read these values from your environment variables.
    const clientId = process.env.NEXT_PUBLIC_SUPABASE_CLIENT_ID;
    // The redirect URI should point to your API route that handles the callback.
    const redirectUri = process.env.NEXT_PUBLIC_SUPABASE_REDIRECT_URI || "";

    // Construct the OAuth2 authorization URL
    const authUrl =
      `https://api.supabase.com/v1/oauth/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `state=${state}`;

    // Redirect the user to the Supabase OAuth2 authorization endpoint
    window.location.href = authUrl;
  };

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <button
        onClick={handleConnect}
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        <Image
          src="/connect-supabase-light.svg"
          alt="Connect with Supabase"
          width={200}
          height={48}
        />
      </button>
    </div>
  );
}
