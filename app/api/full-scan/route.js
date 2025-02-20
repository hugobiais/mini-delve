import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { mfaCheck } from "@/lib/checks/mfaCheck";
import { rlsCheck } from "@/lib/checks/rlsCheck";
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

    // Create a full scan record to link all checks together
    const { data: fullScanData, error: fullScanError } = await supabase
      .from("full_scans")
      .insert([
        {
          user_id: userData.id,
          organization_id: organizationData.id,
        },
      ])
      .select()
      .single();

    if (fullScanError) {
      return NextResponse.json(
        { error: "Failed to create full scan record" },
        { status: 500 }
      );
    }

    const organizationInfo = {
      name: organizationData.name,
      id: organizationData.id,
      supabase_org_id: organizationData.supabase_org_id,
    };

    const results = {
      scan_id: fullScanData.id,
      checks: {},
      overall_status: "success",
      timestamp: new Date().toISOString(),
    };

    // Run all checks in parallel for better performance
    const [mfaResult, rlsResult, pitrResult] = await Promise.all([
      mfaCheck(
        organizationData.access_token,
        userData.id,
        organizationInfo,
        supabase,
        fullScanData.id
      ),
      rlsCheck(
        organizationData.access_token,
        userData.id,
        organizationInfo,
        supabase,
        fullScanData.id
      ),
      pitrCheck(
        organizationData.access_token,
        userData.id,
        organizationInfo,
        supabase,
        fullScanData.id
      ),
    ]);

    // Organize results
    results.checks = {
      mfa: { ...mfaResult, check_type: 'mfa' },
      rls: { ...rlsResult, check_type: 'rls' },
      pitr: { ...pitrResult, check_type: 'pitr' },
    };

    // Determine overall status
    if (Object.values(results.checks).some(check => check.status === "failure")) {
      results.overall_status = "failure";
    }

    return NextResponse.json({
      user_id: userData.id,
      scan_results: results,
    });
  } catch (error) {
    console.error("Unexpected error processing full scan request:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
