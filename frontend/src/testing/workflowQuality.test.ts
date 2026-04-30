import test from 'node:test';
import assert from 'node:assert/strict';

import {
  auditIntakePayload,
  auditWorkflowDraft,
  hasAuditErrors,
} from './workflowQuality.ts';

const buildValidMetadata = () => ({
  name: 'Metrology Morning Calibration',
  description: 'Daily calibration workflow for the metrology team.',
  prc: 'M-01',
  workflow_type: 'Calibration',
  org: 'Metrology',
  team: 'Yield Engineering',
  trigger_type: 'Schedule',
  trigger_description: 'Shift start at 7 AM',
  output_type: 'Report',
  output_description: 'Calibration completion record',
  cadence_count: 1,
  cadence_unit: 'day',
  tool_family: ['Overlay'],
  applicable_tools: ['OVL-12'],
  repeatability_check: true,
  access_control: {
    visibility: 'team',
    owner: 'Haewon Kim',
    viewers: ['Automation Team'],
    editors: ['Metrology SME'],
    mention_groups: ['Metrology SME'],
  },
  comments: [{ message: 'Seed review comment' }],
});

const buildValidDraft = () => {
  const metadata = buildValidMetadata();
  const tasks = [
    {
      id: 'node-trigger',
      node_id: 'node-trigger',
      name: 'Trigger',
      description: 'Start of workflow',
      task_type: 'TRIGGER',
      interface: 'TRIGGER',
      manual_time_minutes: 0,
      automation_time_minutes: 0,
      machine_wait_time_minutes: 0,
      occurrence: 1,
      source_data_list: [],
      output_data_list: [{ id: 'output-trigger', name: 'Request' }],
      blockers: [],
      errors: [],
      validation_needed: false,
      validation_procedure_steps: [],
      reference_links: [],
      instructions: [],
      media: [],
    },
    {
      id: 'node-task',
      node_id: 'node-task',
      name: 'Inspect Tool',
      description: 'Inspect tool state and capture readings',
      task_type: 'System Interaction',
      interface: null,
      manual_time_minutes: 15,
      automation_time_minutes: 0,
      machine_wait_time_minutes: 5,
      occurrence: 1,
      source_data_list: [{ id: 'input-1', name: 'Request', from_task_id: 'output-trigger' }],
      output_data_list: [{ id: 'output-task', name: 'Inspection Result' }],
      blockers: [],
      errors: [],
      validation_needed: true,
      validation_procedure_steps: [{ id: 'step-1', description: 'Confirm measured value is in range' }],
      reference_links: [{ id: 'ref-1', url: 'https://internal/wiki/tool-check' }],
      instructions: [{ id: 'instruction-1', description: 'Wear gloves before touching fixtures.' }],
      media: [{ id: 'media-1', url: '/uploads/reference.png' }],
    },
    {
      id: 'node-outcome',
      node_id: 'node-outcome',
      name: 'Outcome',
      description: 'Workflow completion',
      task_type: 'OUTCOME',
      interface: 'OUTCOME',
      manual_time_minutes: 0,
      automation_time_minutes: 0,
      machine_wait_time_minutes: 0,
      occurrence: 1,
      source_data_list: [{ id: 'input-2', name: 'Inspection Result', from_task_id: 'output-task' }],
      output_data_list: [],
      blockers: [],
      errors: [],
      validation_needed: false,
      validation_procedure_steps: [],
      reference_links: [],
      instructions: [],
      media: [],
    },
  ];

  const edges = [
    { source: 'node-trigger', target: 'node-task', label: '' },
    { source: 'node-task', target: 'node-outcome', label: '' },
  ];

  return { metadata, tasks, edges };
};

test('auditIntakePayload accepts a complete intake payload', () => {
  const issues = auditIntakePayload(buildValidMetadata());
  assert.equal(hasAuditErrors(issues), false);
});

test('auditIntakePayload flags repeatability failures', () => {
  const payload = {
    ...buildValidMetadata(),
    repeatability_check: false,
  };
  const issues = auditIntakePayload(payload);
  assert.equal(hasAuditErrors(issues), true);
  assert(issues.some((issue) => issue.code === 'workflow.repeatability_check'));
});

test('auditIntakePayload flags missing org or team', () => {
  const payload = {
    ...buildValidMetadata(),
    org: '',
    team: '',
  };
  const issues = auditIntakePayload(payload);
  assert.equal(hasAuditErrors(issues), true);
  assert(issues.some((issue) => issue.code === 'workflow.org'));
  assert(issues.some((issue) => issue.code === 'workflow.team'));
});

test('auditIntakePayload enforces workflow-class governance rules', () => {
  const payload = {
    ...buildValidMetadata(),
    workflow_type: 'Automation Study',
    quick_capture_notes: '',
    ownership: {
      owner: 'Haewon Kim',
      smes: [],
      backup_owners: [],
      automation_owner: '',
      reviewers: [],
    },
    governance: {
      lifecycle_stage: 'Draft',
      review_state: 'Requested',
      approval_state: 'Draft',
      required_reviewer_roles: [],
      standards_flags: [],
      stale_after_days: 90,
    },
    review_requests: [],
  };
  const issues = auditIntakePayload(payload);
  assert(issues.some((issue) => issue.code === 'workflow.automation_owner'));
  assert(issues.some((issue) => issue.code === 'workflow.automation_review_request'));
});

test('auditWorkflowDraft accepts a connected trigger-to-outcome draft', () => {
  const issues = auditWorkflowDraft(buildValidDraft());
  assert.equal(hasAuditErrors(issues), false);
});

test('auditWorkflowDraft catches duplicate task identifiers and bad timings', () => {
  const draft = buildValidDraft();
  draft.tasks[1] = {
    ...draft.tasks[1],
    id: 'node-trigger',
    node_id: 'node-trigger',
    manual_time_minutes: -5,
  };
  const issues = auditWorkflowDraft(draft);
  assert.equal(hasAuditErrors(issues), true);
  assert(issues.some((issue) => issue.code === 'task.duplicate_id'));
  assert(issues.some((issue) => issue.code === 'task.manual_time_minutes'));
});

test('auditWorkflowDraft catches unreachable nodes, self loops, and duplicate routes', () => {
  const draft = buildValidDraft();
  draft.tasks.push({
    id: 'node-orphan',
    node_id: 'node-orphan',
    name: 'Orphan',
    description: 'Detached task',
    task_type: 'System Interaction',
    occurrence: 1,
    manual_time_minutes: 3,
    automation_time_minutes: 0,
    machine_wait_time_minutes: 0,
    source_data_list: [],
    output_data_list: [],
    blockers: [],
    errors: [],
    validation_needed: false,
    validation_procedure_steps: [],
    reference_links: [],
    instructions: [],
    media: [],
  });
  draft.edges.push({ source: 'node-task', target: 'node-task', label: '' });
  draft.edges.push({ source: 'node-trigger', target: 'node-task', label: '' });

  const issues = auditWorkflowDraft(draft);
  assert.equal(hasAuditErrors(issues), true);
  assert(issues.some((issue) => issue.code === 'graph.unreachable' && issue.targetId === 'node-orphan'));
  assert(issues.some((issue) => issue.code === 'edge.self_loop'));
  assert(issues.some((issue) => issue.code === 'edge.duplicate'));
});

test('auditWorkflowDraft enforces decision routing semantics', () => {
  const metadata = buildValidMetadata();
  const tasks = [
    {
      id: 'node-trigger',
      node_id: 'node-trigger',
      name: 'Trigger',
      description: 'Start',
      task_type: 'TRIGGER',
      interface: 'TRIGGER',
      occurrence: 1,
      manual_time_minutes: 0,
      automation_time_minutes: 0,
      machine_wait_time_minutes: 0,
      source_data_list: [],
      output_data_list: [],
      blockers: [],
      errors: [],
      validation_needed: false,
      validation_procedure_steps: [],
      reference_links: [],
      instructions: [],
      media: [],
    },
    {
      id: 'node-decision',
      node_id: 'node-decision',
      name: 'Decision',
      description: 'Check value',
      task_type: 'DECISION',
      occurrence: 1,
      manual_time_minutes: 2,
      automation_time_minutes: 0,
      machine_wait_time_minutes: 0,
      source_data_list: [],
      output_data_list: [],
      blockers: [],
      errors: [],
      validation_needed: false,
      validation_procedure_steps: [],
      reference_links: [],
      instructions: [],
      media: [],
    },
    {
      id: 'node-a',
      node_id: 'node-a',
      name: 'Path A',
      description: 'Go left',
      task_type: 'System Interaction',
      occurrence: 1,
      manual_time_minutes: 3,
      automation_time_minutes: 0,
      machine_wait_time_minutes: 0,
      source_data_list: [],
      output_data_list: [],
      blockers: [],
      errors: [],
      validation_needed: false,
      validation_procedure_steps: [],
      reference_links: [],
      instructions: [],
      media: [],
    },
    {
      id: 'node-outcome',
      node_id: 'node-outcome',
      name: 'Outcome',
      description: 'Finish',
      task_type: 'OUTCOME',
      interface: 'OUTCOME',
      occurrence: 1,
      manual_time_minutes: 0,
      automation_time_minutes: 0,
      machine_wait_time_minutes: 0,
      source_data_list: [],
      output_data_list: [],
      blockers: [],
      errors: [],
      validation_needed: false,
      validation_procedure_steps: [],
      reference_links: [],
      instructions: [],
      media: [],
    },
  ];

  const edges = [
    { source: 'node-trigger', target: 'node-decision', label: '' },
    { source: 'node-decision', target: 'node-a', label: 'Maybe' },
    { source: 'node-a', target: 'node-outcome', label: '' },
  ];

  const issues = auditWorkflowDraft({ metadata, tasks, edges });
  assert.equal(hasAuditErrors(issues), true);
  assert(issues.some((issue) => issue.code === 'graph.decision_route_count'));
});

test('auditWorkflowDraft expects validation presence for verification workflows', () => {
  const draft = buildValidDraft();
  draft.metadata.workflow_type = 'Verification';
  draft.tasks[1] = {
    ...draft.tasks[1],
    validation_needed: false,
    validation_procedure_steps: [],
  };
  const issues = auditWorkflowDraft(draft);
  assert(issues.some((issue) => issue.code === 'workflow.validation_presence'));
});
