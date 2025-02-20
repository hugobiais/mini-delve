export async function mfaCheck(
  accessToken,
  userId,
  organization,
  supabaseClient,
  fullScanId = null
) {
  const executionLogs = [];
  const addLog = (message, level = "info", data = null) => {
    executionLogs.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    });
    console.log(message, data);
  };

  addLog(`Starting MFA check`, "info", {
    organization_id: organization.supabase_org_id,
    check_type: "mfa",
  });

  // Fetch members for the organization
  addLog(`Fetching members for organization ${organization.supabase_org_id}`);
  const membersRes = await fetch(
    `https://api.supabase.com/v1/organizations/${organization.supabase_org_id}/members`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  let membersData = [];
  if (membersRes.ok) {
    const parsed = await membersRes.json();
    membersData = parsed?.items || parsed;
    addLog(`Successfully fetched organization members`, "info", {
      total_members: membersData.length,
    });
  } else {
    addLog(`Failed to fetch organization members`, "error", {
      status: membersRes.status,
      statusText: membersRes.statusText,
    });
  }

  // Map member data to our format
  const members = membersData.map((member) => ({
    id: member.id,
    email: member.email,
    mfa_enabled: member.mfa_enabled,
  }));

  // Determine overall MFA outcome: success if all members have MFA enabled
  addLog("Checking MFA status for all members");
  const allMfaEnabled = members.every((m) => m.mfa_enabled === true);
  const status = allMfaEnabled ? "success" : "failure";

  const disabledMfaUsers = members
    .filter((m) => !m.mfa_enabled)
    .map((m) => m.email);
  if (disabledMfaUsers.length > 0) {
    addLog("Found users without MFA enabled", "warning", {
      users: disabledMfaUsers,
    });
  } else {
    addLog("All users have MFA enabled", "info", {
      total_members: members.length,
    });
  }

  // Enhanced logging for MFA status
  const mfaEnabledCount = members.filter((m) => m.mfa_enabled).length;
  const mfaDisabledCount = members.filter((m) => !m.mfa_enabled).length;

  const logs = {
    execution_logs: executionLogs,
    summary: {
      total_items: members.length,
      items_with_issues: mfaDisabledCount,
      status: allMfaEnabled ? "success" : "failure",
      details: {
        total_members: members.length,
        mfa_enabled_count: mfaEnabledCount,
        mfa_disabled_count: mfaDisabledCount,
        members_list: members,
      },
    },
  };

  const recommendations = allMfaEnabled
    ? null
    : {
        suggestion:
          "Some users don't have MFA enabled. Enable MFA for all users to improve security.",
        affected_elements: disabledMfaUsers.map((email) => ({
          type: "user",
          email: email,
        })),
        action_links: [
          {
            url: "https://supabase.com/dashboard/account/security",
            label: "Click here to configure MFA Settings",
          },
        ],
      };

  const mfaCheck = {
    user_id: userId,
    organization_id: organization.id,
    check_type: "mfa",
    status,
    logs,
    recommendations,
    full_scan_id: fullScanId,
  };

  // Insert check into the database
  const { error } = await supabaseClient.from("checks").insert([mfaCheck]);

  if (error) {
    throw new Error(`Failed to write check log: ${error.message}`);
  }

  return mfaCheck;
}
