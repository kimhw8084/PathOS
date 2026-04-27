import { expect, test, type Page } from '@playwright/test';

type WorkflowRecord = Record<string, any>;

const taxonomy = [
  { id: 1, category: 'TriggerType', label: 'Schedule', value: 'Schedule' },
  { id: 2, category: 'TriggerType', label: 'Manual', value: 'Manual' },
  { id: 3, category: 'OutputType', label: 'Report', value: 'Report' },
  { id: 4, category: 'OutputType', label: 'Notification', value: 'Notification' },
];

const settingsParameters = [
  { key: 'PRC', is_dynamic: false, manual_values: ['PRC-01', 'PRC-02'], cached_values: [] },
  { key: 'WORKFLOW_TYPE', is_dynamic: false, manual_values: ['Verification', 'Automation'], cached_values: [] },
  { key: 'HARDWARE_FAMILY', is_dynamic: false, manual_values: ['Overlay', 'CD-SEM'], cached_values: [] },
  { key: 'TOOL_ID', is_dynamic: false, manual_values: ['OVL-12', 'CD-01'], cached_values: [] },
  { key: 'TASK_TYPE', is_dynamic: false, manual_values: ['System Interaction', 'Verification', 'Documentation'], cached_values: [] },
];

const buildConnectedWorkflow = (): WorkflowRecord => ({
  id: 101,
  name: 'Inline Metrology Verification',
  version: 1,
  workspace: 'Personal Drafts',
  status: 'Created',
  description: 'Baseline workflow for browser journey tests.',
  prc: 'PRC-01',
  workflow_type: 'Verification',
  org: 'Metrology',
  team: 'Yield Engineering',
  tool_family: 'Overlay',
  tool_id: 'OVL-12',
  trigger_type: 'Schedule',
  trigger_description: 'Shift start',
  output_type: 'Report',
  output_description: 'Verification record',
  cadence_count: 1,
  cadence_unit: 'week',
  repeatability_check: true,
  equipment_required: true,
  equipment_state: 'Ready',
  cleanroom_required: false,
  total_roi_saved_hours: 0.3,
  created_at: '2026-04-25T00:00:00Z',
  updated_at: '2026-04-25T00:00:00Z',
  created_by: 'Haewon Kim',
  updated_by: 'Haewon Kim',
  access_control: {
    visibility: 'private',
    viewers: [],
    editors: ['Automation Team'],
    mention_groups: ['Metrology SME'],
    owner: 'Haewon Kim',
  },
  comments: [],
  analysis: {
    has_cycle: false,
    cycle_nodes: [],
    disconnected_nodes: [],
    unreachable_nodes: [],
    malformed_logic_nodes: [],
    orphaned_inputs: [],
    critical_path_minutes: 17,
    critical_path_hours: 0.28,
    critical_path_nodes: ['node-trigger', 'node-task', 'node-outcome'],
    shift_handoff_risk: false,
    diff_summary: { added_nodes: [], removed_nodes: [], modified_nodes: [], has_changes: false },
    diagnostics: {
      'node-trigger': { is_decision: false, blocker_count: 0, error_count: 0, orphaned_input: false, unreachable: false, disconnected: false, logic_warning: false },
      'node-task': { is_decision: false, blocker_count: 0, error_count: 1, orphaned_input: false, unreachable: false, disconnected: false, logic_warning: false },
      'node-outcome': { is_decision: false, blocker_count: 0, error_count: 0, orphaned_input: false, unreachable: false, disconnected: false, logic_warning: false },
    },
  },
  simulation: {
    best_case_minutes: 17,
    worst_case_minutes: 17.5,
    critical_path_minutes: 17,
    critical_path_nodes: ['node-trigger', 'node-task', 'node-outcome'],
    path_count: 1,
  },
  edges: [
    { source: 'node-trigger', target: 'node-task', label: '', edge_style: 'smoothstep', color: '#ffffff', line_style: 'solid' },
    { source: 'node-task', target: 'node-outcome', label: '', edge_style: 'smoothstep', color: '#ffffff', line_style: 'solid' },
  ],
  tasks: [
    {
      id: 1,
      workflow_id: 101,
      node_id: 'node-trigger',
      name: 'Trigger',
      description: 'Workflow start',
      task_type: 'TRIGGER',
      interface: 'TRIGGER',
      position_x: 0,
      position_y: 0,
      manual_time_minutes: 0,
      automation_time_minutes: 0,
      machine_wait_time_minutes: 0,
      occurrence: 1,
      target_systems: [],
      source_data_list: [],
      output_data_list: [{ id: 'output-trigger', name: 'Carrier Lot' }],
      blockers: [],
      errors: [],
      media: [],
      reference_links: [],
      instructions: [],
      verification_steps: [],
      owner_positions: [],
      validation_needed: false,
    },
    {
      id: 2,
      workflow_id: 101,
      node_id: 'node-task',
      name: 'Measure Wafer',
      description: 'Measure the wafer and log the result.',
      task_type: 'System Interaction',
      position_x: 420,
      position_y: 0,
      manual_time_minutes: 12,
      automation_time_minutes: 2,
      machine_wait_time_minutes: 3,
      occurrence: 1,
      target_systems: [{ id: 'sys-1', name: 'Metrology Console', usage: 'Acquisition' }],
      source_data_list: [{ id: 'input-1', name: 'Carrier Lot', from_task_id: 'output-trigger' }],
      output_data_list: [{ id: 'output-task', name: 'Measurement Result' }],
      blockers: [],
      errors: [{ id: 11, task_id: 2, error_type: 'Retry', description: 'Measurement retry required', probability_percent: 10, recovery_time_minutes: 5 }],
      media: [],
      reference_links: [],
      instructions: [],
      verification_steps: [],
      owner_positions: ['Technician'],
      validation_needed: false,
    },
    {
      id: 3,
      workflow_id: 101,
      node_id: 'node-outcome',
      name: 'Outcome',
      description: 'Workflow complete',
      task_type: 'OUTCOME',
      interface: 'OUTCOME',
      position_x: 840,
      position_y: 0,
      manual_time_minutes: 0,
      automation_time_minutes: 0,
      machine_wait_time_minutes: 0,
      occurrence: 1,
      target_systems: [],
      source_data_list: [{ id: 'input-2', name: 'Measurement Result', from_task_id: 'output-task' }],
      output_data_list: [],
      blockers: [],
      errors: [],
      media: [],
      reference_links: [],
      instructions: [],
      verification_steps: [],
      owner_positions: [],
      validation_needed: false,
    },
  ],
});

async function installMockApi(page: Page, initialWorkflow?: WorkflowRecord) {
  const state = {
    workflows: initialWorkflow ? [structuredClone(initialWorkflow)] : [] as WorkflowRecord[],
    nextWorkflowId: initialWorkflow ? initialWorkflow.id + 1 : 101,
  };

  await page.route(url => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === '/api/taxonomy' && method === 'GET') {
      return route.fulfill({ json: taxonomy });
    }
    if (path === '/api/settings/parameters' && method === 'GET') {
      return route.fulfill({ json: settingsParameters });
    }
    if (path === '/api/settings/runtime-config' && method === 'GET') {
      return route.fulfill({ json: {
        organization: {
          org_options: ['Metrology', 'Quality'],
          team_options: ['Yield Engineering', 'Automation'],
          site_options: ['HQ', 'Site A'],
        },
        governance: { status_categories: { STANDARD: ['Created'], REVIEW: [], PENDING: [] } },
        project_governance: { columns: ['Scoping', 'Deployed'] },
        workflow_defaults: {
          access_control: { visibility: 'private' },
          ownership: { owner: 'Haewon Kim' },
          governance: { stale_after_days: 90 },
        },
        templates: [],
      }});
    }
    if ((path === '/api/executions' || path === '/api/projects') && method === 'GET') {
      return route.fulfill({ json: [] });
    }
    if (path === '/api/workflows' && method === 'GET') {
      return route.fulfill({ json: state.workflows });
    }
    if (path === '/api/workflows' && method === 'POST') {
      const payload = request.postDataJSON() as WorkflowRecord;
      const created = {
        ...buildConnectedWorkflow(),
        ...payload,
        id: state.nextWorkflowId++,
        tasks: payload.tasks || [],
        edges: payload.edges || [],
        org: payload.org || 'Metrology',
        team: payload.team || 'Yield Engineering',
        status: 'Created',
        total_roi_saved_hours: 0,
        created_at: '2026-04-25T00:00:00Z',
        updated_at: '2026-04-25T00:00:00Z',
        created_by: 'Haewon Kim',
        updated_by: 'Haewon Kim',
        analysis: payload.analysis || {
          has_cycle: false,
          cycle_nodes: [],
          disconnected_nodes: [],
          unreachable_nodes: [],
          malformed_logic_nodes: [],
          orphaned_inputs: [],
          critical_path_minutes: 0,
          critical_path_hours: 0,
          critical_path_nodes: [],
          shift_handoff_risk: false,
          diff_summary: { added_nodes: [], removed_nodes: [], modified_nodes: [], has_changes: false },
          diagnostics: {},
        },
        simulation: payload.simulation || { best_case_minutes: 0, worst_case_minutes: 0, critical_path_minutes: 0, critical_path_nodes: [], path_count: 1 },
      };
      state.workflows = [created];
      return route.fulfill({ json: created });
    }
    if (path.match(/^\/api\/workflows\/\d+$/) && method === 'PUT') {
      const workflowId = Number(path.split('/').pop());
      const payload = request.postDataJSON() as WorkflowRecord;
      const existing = state.workflows.find((workflow) => workflow.id === workflowId) || buildConnectedWorkflow();
      const updated = {
        ...existing,
        ...payload,
        id: workflowId,
        tasks: payload.tasks || existing.tasks || [],
        edges: payload.edges || existing.edges || [],
        analysis: payload.analysis || existing.analysis || {},
        updated_at: '2026-04-25T00:05:00Z',
        updated_by: 'Haewon Kim',
      };
      state.workflows = state.workflows.map((workflow) => workflow.id === workflowId ? updated : workflow);
      return route.fulfill({ json: updated });
    }
    if (path.match(/^\/api\/workflows\/\d+$/) && method === 'GET') {
      const workflowId = Number(path.split('/').pop());
      const workflow = state.workflows.find((entry) => entry.id === workflowId);
      return route.fulfill({ status: workflow ? 200 : 404, json: workflow || { detail: 'Workflow not found' } });
    }

    return route.fulfill({ status: 200, json: {} });
  });

  return state;
}

async function chooseOption(page: Page, testId: string, optionValueSlug: string) {
  await page.getByTestId(`${testId}-trigger`).click();
  await page.waitForTimeout(500);
  await page.getByTestId(`${testId}-option-${optionValueSlug}`).click();
  await page.keyboard.press('Escape').catch(() => {});
}

async function waitForAppReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {});
  await expect(page.locator('body')).not.toBeEmpty();
}

async function waitForWorkflowRepository(page: Page) {
  await waitForAppReady(page);
  await expect(page.getByTestId('workflow-create-new')).toBeVisible();
}

async function waitForBuilderSurface(page: Page) {
  await waitForAppReady(page);
  await expect(page.getByRole('heading', { name: 'Workflow Definition', exact: true })).toBeVisible();
  await expect(page.getByTestId('builder-commit')).toBeVisible();
}

let pageErrors: string[] = [];
let consoleErrors: string[] = [];

test.beforeEach(async ({ page }, testInfo) => {
  pageErrors = [];
  consoleErrors = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  testInfo.annotations.push({ type: 'playwright-mode', description: process.env.PLAYWRIGHT_BASE_URL ? 'deployed-url' : 'local-dev-server' });
});

test.afterEach(async ({}, testInfo) => {
  if (pageErrors.length > 0) {
    await testInfo.attach('page-errors.txt', {
      body: pageErrors.join('\n\n'),
      contentType: 'text/plain',
    });
  }
  if (consoleErrors.length > 0) {
    await testInfo.attach('console-errors.txt', {
      body: consoleErrors.join('\n\n'),
      contentType: 'text/plain',
    });
  }
});

test.describe('workflow browser journeys', () => {
  test('intake can create a workflow and hand off into builder', async ({ page }) => {
    await installMockApi(page);

    await page.goto('/workflows');
    await waitForWorkflowRepository(page);
    await page.getByTestId('workflow-create-new').click();

    await page.getByTestId('intake-repeatable-yes').click();
    await page.getByTestId('intake-workflow-name').fill('Metrology Daily Browser Journey');
    await page.getByTestId('intake-description').fill('Real browser journey covering intake handoff into builder.');
    await chooseOption(page, 'intake-prc', 'prc-01');
    await chooseOption(page, 'intake-workflow-type', 'verification');
    await chooseOption(page, 'intake-org', 'metrology');
    await chooseOption(page, 'intake-team', 'yield-engineering');
    await chooseOption(page, 'intake-trigger-type', 'schedule');
    await chooseOption(page, 'intake-output-type', 'report');
    await page.getByTestId('intake-trigger-description').fill('Every shift at 7 AM');
    await page.getByTestId('intake-output-description').fill('A recorded verification report.');
    await page.getByTestId('intake-equipment-toggle').click();
    await chooseOption(page, 'intake-equipment-state', 'run');
    await chooseOption(page, 'intake-tool-family', 'overlay');
    await chooseOption(page, 'intake-applicable-tools', 'ovl-12');

    await page.getByTestId('intake-finalize').click();

    await expect(page).toHaveURL(/\/workflows\/builder\/\d+$/);
    await waitForBuilderSurface(page);
    await expect(page.getByText('Repository Definition Surface')).toBeVisible();
  });

  test('builder can save metadata changes and keep them after reload', async ({ page }) => {
    await installMockApi(page, buildConnectedWorkflow());

    await page.goto('/workflows/builder/101');
    await waitForBuilderSurface(page);
    const dismissGuide = page.getByTestId('builder-guide-dismiss');
    if (await dismissGuide.isVisible()) {
      await dismissGuide.click();
    }

    await page.getByRole('button', { name: /Edit Definition/i }).click();
    await expect(page.getByTestId('builder-workflow-name')).toBeVisible();
    await page.getByTestId('builder-workflow-name').fill('Inline Metrology Verification Updated');
    await page.getByTestId('builder-workflow-description').fill('Updated through a real browser save and reload journey.');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/debug-before-commit.png', fullPage: true });
    const commitButton = page.getByTestId('builder-commit');
    await expect(commitButton).toBeEnabled();
    await commitButton.click();

    await expect(page.getByText('Configuration Saved').first()).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: /Edit Definition/i }).click();
    await expect(page.getByTestId('builder-workflow-name')).toHaveValue('Inline Metrology Verification Updated');
    await expect(page.getByTestId('builder-workflow-description')).toHaveValue('Updated through a real browser save and reload journey.');
  });

  test('builder blocks save when a disconnected node is introduced', async ({ page }) => {
    await installMockApi(page, buildConnectedWorkflow());

    await page.goto('/workflows/builder/101');
    await waitForBuilderSurface(page);
    const dismissGuide = page.getByTestId('builder-guide-dismiss');
    if (await dismissGuide.isVisible()) {
      await dismissGuide.click();
    }

    await page.getByTestId('builder-add-task').click();
    await page.waitForTimeout(500);
    const commitButton = page.getByTestId('builder-commit');
    await expect(commitButton).toBeEnabled();
    await commitButton.click();

    await expect(page.getByText(/All nodes must remain connected/i).first()).toBeVisible();
  });
});
