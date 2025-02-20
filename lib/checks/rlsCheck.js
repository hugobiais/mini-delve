export async function rlsCheck(
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

  addLog(`Starting RLS check`, "info", {
    organization_id: organization.supabase_org_id,
    check_type: "rls",
  });

  // Fetch projects for the organization
  addLog(`Fetching projects for organization ${organization.supabase_org_id}`);
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

  // For each project, check RLS settings
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

    addLog(`Analyzing RLS settings for project`, "info", {
      project_name: project.name,
      project_id: project.id,
    });

    const queryEndpoint = `https://api.supabase.com/v1/projects/${project.id}/database/query`;
    const queryBody = {
      query:
        "SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public'AND c.relkind = 'r';",
    };

    const queryRes = await fetch(queryEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(queryBody),
    });

    if (!queryRes.ok) {
      addLog(`Failed to query RLS settings`, "error", {
        project_name: project.name,
        project_id: project.id,
        status: queryRes.status,
      });
      projectResults.push({
        project_ref: project.id,
        error: `Failed to query RLS settings: ${queryRes.status}`,
      });
      continue;
    }

    const result = await queryRes.json();
    const tables = result || [];
    addLog(`Found ${tables.length} tables in project ${project.name}`);

    projectResults.push({
      project_id: project.id,
      project_name: project.name,
      tables: tables.map((table) => ({
        name: table.table_name,
        rls_enabled: table.rls_enabled,
      })),
    });
  }

  // Analyze results
  const tablesWithoutRLS = projectResults.flatMap((project) =>
    (project.tables || [])
      .filter((table) => !table.rls_enabled)
      .map((table) => ({
        project_id: project.project_id,
        project_name: project.project_name,
        table: table.name,
      }))
  );

  const totalTables = projectResults.reduce(
    (sum, project) => sum + (project.tables || []).length,
    0
  );
  addLog(
    `Found ${tablesWithoutRLS.length} tables without RLS enabled out of ${totalTables} total tables`
  );

  const status = tablesWithoutRLS.length === 0 ? "success" : "failure";
  addLog(`RLS check completed with status: ${status}`);

  const logs = {
    execution_logs: executionLogs,
    summary: {
      total_items: totalTables,
      items_with_issues: tablesWithoutRLS.length,
      status: status,
      details: {
        total_projects: projectResults.length,
        total_tables: totalTables,
        tables_without_rls: tablesWithoutRLS,
        project_details: projectResults,
      },
    },
  };

  const recommendations =
    tablesWithoutRLS.length === 0
      ? null
      : {
          suggestion:
            "Some tables don't have Row Level Security (RLS) enabled.",
          affected_elements: tablesWithoutRLS.map((table) => ({
            type: "table",
            project_id: table.project_id,
            project_name: table.project_name,
            table_name: table.table,
          })),
          action_links: Object.values(
            tablesWithoutRLS.reduce((acc, table) => {
              if (!acc[table.project_id]) {
                acc[table.project_id] = {
                  url: `https://supabase.com/dashboard/project/${table.project_id}/auth/policies`,
                  label: `Click here to configure ${table.project_name} Policies`,
                  project_name: table.project_name,
                };
              }
              return acc;
            }, {})
          ),
        };

  const rlsCheck = {
    user_id: userId,
    organization_id: organization.id,
    check_type: "rls",
    status,
    logs,
    recommendations,
    full_scan_id: fullScanId,
  };

  // Insert check into the database
  const { error } = await supabaseClient.from("checks").insert([rlsCheck]);

  if (error) {
    throw new Error(`Failed to write check log: ${error.message}`);
  }

  return rlsCheck;
}
