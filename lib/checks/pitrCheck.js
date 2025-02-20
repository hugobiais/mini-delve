export async function pitrCheck(
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

  addLog(`Starting PITR check`, "info", {
    organization_id: organization.supabase_org_id,
    check_type: "pitr",
  });

  // Fetch projects for the organization
  addLog(
    `Fetching projects for organization ${organization.name} (${organization.supabase_org_id})`
  );
  const projectsRes = await fetch(`https://api.supabase.com/v1/projects`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  let projectsData = [];
  if (projectsRes.ok) {
    const parsed = await projectsRes.json();
    projectsData = parsed?.items || parsed;
    addLog(`Successfully fetched ${projectsData.length} projects`);
  } else {
    addLog(`Failed to fetch projects`, { status: projectsRes.status });
    throw new Error(`Failed to fetch projects: ${projectsRes.status}`);
  }

  // For each project, check PITR settings
  const projectResults = [];
  for (const project of projectsData) {
    // Skip inactive projects
    if (project.status === "INACTIVE") {
      addLog(`Skipping inactive project`, "info", {
        project_name: project.name,
        project_id: project.id,
      });
      continue;
    }

    addLog(`Checking PITR settings`, "info", {
      project_name: project.name,
      project_id: project.id,
    });

    const backupsEndpoint = `https://api.supabase.com/v1/projects/${project.id}/database/backups`;
    const backupsRes = await fetch(backupsEndpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!backupsRes.ok) {
      addLog(`Failed to fetch backup settings`, "error", {
        project_name: project.name,
        project_id: project.id,
        status: backupsRes.status,
      });
      projectResults.push({
        project_id: project.id,
        project_name: project.name,
        error: `Failed to fetch backup settings: ${backupsRes.status}`,
      });
      continue;
    }

    const backupsData = await backupsRes.json();

    // Determine PITR status
    const pitrEnabled = backupsData.pitr_enabled === true;

    addLog(
      `PITR status for project ${project.name}: ${
        pitrEnabled ? "enabled" : "disabled"
      }`
    );

    if (!pitrEnabled) {
      addLog(`PITR is disabled for project`, "warning", {
        project_name: project.name,
        project_id: project.id,
        backup_details: backupsData,
      });
    }

    projectResults.push({
      project_id: project.id,
      project_name: project.name,
      pitr_enabled: pitrEnabled,
      backup_details: backupsData,
    });
  }

  // Analyze results
  const projectsWithoutPITR = projectResults.filter(
    (project) => !project.pitr_enabled && !project.error
  );

  addLog(
    `Found ${projectsWithoutPITR.length} projects without PITR enabled out of ${projectResults.length} total projects`
  );

  const status = projectsWithoutPITR.length === 0 ? "success" : "failure";
  addLog(`PITR check completed with status: ${status}`);

  const logs = {
    execution_logs: executionLogs,
    summary: {
      total_items: projectResults.length,
      items_with_issues: projectsWithoutPITR.length,
      status: projectsWithoutPITR.length === 0 ? "success" : "failure",
      details: {
        total_projects: projectResults.length,
        projects_with_pitr: projectResults.length - projectsWithoutPITR.length,
        projects_without_pitr: projectsWithoutPITR.length,
        project_details: projectResults,
      },
    },
  };

  const recommendations =
    projectsWithoutPITR.length === 0
      ? null
      : {
          suggestion:
            "Some projects don't have Point-in-Time Recovery (PITR) enabled. PITR provides continuous backup protection and allows you to restore your database to any point in time.",
          affected_elements: projectsWithoutPITR.map((project) => ({
            type: "project",
            project_id: project.project_id,
            project_name: project.project_name,
          })),
          action_links: projectsWithoutPITR.map((project) => ({
            url: `https://supabase.com/dashboard/project/${project.project_id}/database/backups/pitr`,
            label: `Click here to configure ${project.project_name} PITR`,
            project_name: project.project_name,
          })),
        };

  const pitrCheck = {
    user_id: userId,
    organization_id: organization.id,
    check_type: "pitr",
    status,
    logs,
    recommendations,
    full_scan_id: fullScanId,
  };

  // Insert check into the database
  const { error } = await supabaseClient.from("checks").insert([pitrCheck]);

  if (error) {
    throw new Error(`Failed to write check log: ${error.message}`);
  }

  return pitrCheck;
}
