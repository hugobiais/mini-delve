import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { mfaCheck } from "@/lib/checks/mfaCheck";

export async function POST(request) {
  try {
    const cookieStore = cookies();
    const supabase = await createClient(cookieStore);

    // First verify the user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Fetch user data from the database
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: "User not found in database" },
        { status: 404 }
      );
    }

    // Get organization ID from request body
    const body = await request.json();
    const { organization_id } = body;

    if (!organization_id) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    // Check that the user has access to the organization
    const { data: organizationData, error: organizationError } = await supabase
      .from("organizations")
      .select("*")
      .eq("user_id", user.id)
      .eq("supabase_org_id", organization_id)
      .single();

    if (organizationError || !organizationData) {
      return NextResponse.json(
        { error: "User does not have access to this organization" },
        { status: 403 }
      );
    }

    // Check that the organization access token hasn't expired (LATER)
    // const organizationAccessToken = organizationData.access_token;
    // const organizationAccessTokenExpiresAt = organizationData.access_token_expires_at;
    // const currentTime = new Date();
    // if (currentTime > new Date(organizationAccessTokenExpiresAt)) {
    //   return NextResponse.json({ error: "Organization access token has expired" }, { status: 401 });
    // }

    // Run the MFA check for the specific organization
    try {
      const checkResult = await mfaCheck(
        organizationData.access_token,
        userData.id,
        {
          name: organizationData.name,
          id: organizationData.id,
          supabase_org_id: organizationData.supabase_org_id,
        },
        supabase
      );

      return NextResponse.json(checkResult);
    } catch (error) {
      // This catch block specifically handles errors from the mfaCheck function
      console.error(
        `Error in MFA check execution for org ${organization_id}:`,
        error
      );
      return NextResponse.json(
        {
          error: "Failed to perform MFA check",
          details: error.message,
          organization_id,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    // This catch block handles all other unexpected errors in the route
    console.error("Unexpected error processing MFA check request:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
