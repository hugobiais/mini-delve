// app/api/check-pitr/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { pitrCheck } from "@/lib/checks/pitrCheck";

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

    // Run the PITR check for the specific organization
    try {
      const checkResult = await pitrCheck(
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
      // This catch block specifically handles errors from the pitrCheck function
      console.error(
        `Error in PITR check execution for org ${organization_id}:`,
        error
      );
      return NextResponse.json(
        {
          error: "Failed to perform PITR check",
          details: error.message,
          organization_id,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    // This catch block handles all other unexpected errors in the route
    console.error("Unexpected error processing PITR check request:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
