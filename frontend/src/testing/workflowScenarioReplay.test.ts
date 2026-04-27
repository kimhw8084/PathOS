import test from 'node:test';
import assert from 'node:assert/strict';

import { auditWorkflowDraft } from './workflowQuality.ts';

const scenarioMatrix = [
  {
    name: 'happy path linear flow',
    draft: {
      metadata: {
        name: 'Daily Verification',
        description: 'Linear workflow',
        prc: 'PRC-1',
        workflow_type: 'Verification',
        org: 'Metrology',
        team: 'Yield',
        trigger_type: 'Schedule',
        trigger_description: 'Shift start',
        output_type: 'Report',
        output_description: 'Report ready',
        cadence_count: 1,
        cadence_unit: 'day',
        tool_family: ['CD-SEM'],
        applicable_tools: ['CD-01'],
        repeatability_check: true,
      },
      tasks: [
        { id: 't', node_id: 't', name: 'Trigger', description: 'start', task_type: 'TRIGGER', interface: 'TRIGGER', occurrence: 1, manual_time_minutes: 0, automation_time_minutes: 0, machine_wait_time_minutes: 0, source_data_list: [], output_data_list: [{ id: 'o1', name: 'Start Packet' }], blockers: [], errors: [], validation_needed: false, validation_procedure_steps: [], reference_links: [], instructions: [], media: [] },
        { id: 'a', node_id: 'a', name: 'Measure', description: 'measure wafer', task_type: 'System Interaction', occurrence: 1, manual_time_minutes: 12, automation_time_minutes: 0, machine_wait_time_minutes: 2, source_data_list: [{ id: 'i1', name: 'Start Packet', from_task_id: 'o1' }], output_data_list: [{ id: 'o2', name: 'Measurement Result' }], blockers: [], errors: [], validation_needed: false, validation_procedure_steps: [], reference_links: [], instructions: [], media: [] },
        { id: 'o', node_id: 'o', name: 'Outcome', description: 'finish', task_type: 'OUTCOME', interface: 'OUTCOME', occurrence: 1, manual_time_minutes: 0, automation_time_minutes: 0, machine_wait_time_minutes: 0, source_data_list: [{ id: 'i2', name: 'Measurement Result', from_task_id: 'o2' }], output_data_list: [], blockers: [], errors: [], validation_needed: false, validation_procedure_steps: [], reference_links: [], instructions: [], media: [] },
      ],
      edges: [
        { source: 't', target: 'a', label: '' },
        { source: 'a', target: 'o', label: '' },
      ],
    },
    expectedCodes: [],
  },
  {
    name: 'orphaned input reference',
    draft: {
      metadata: {
        name: 'Orphan Check',
        description: 'Broken data lineage',
        prc: 'PRC-2',
        workflow_type: 'Verification',
        org: 'Yield',
        team: 'Process Control',
        trigger_type: 'Manual',
        trigger_description: 'Operator request',
        output_type: 'Result',
        output_description: 'Done',
        cadence_count: 1,
        cadence_unit: 'week',
        tool_family: ['Overlay'],
        applicable_tools: ['OVL-01'],
        repeatability_check: true,
      },
      tasks: [
        { id: 't', node_id: 't', name: 'Trigger', description: 'start', task_type: 'TRIGGER', interface: 'TRIGGER', occurrence: 1, manual_time_minutes: 0, automation_time_minutes: 0, machine_wait_time_minutes: 0, source_data_list: [], output_data_list: [], blockers: [], errors: [], validation_needed: false, validation_procedure_steps: [], reference_links: [], instructions: [], media: [] },
        { id: 'a', node_id: 'a', name: 'Task', description: 'use missing input', task_type: 'System Interaction', occurrence: 1, manual_time_minutes: 8, automation_time_minutes: 0, machine_wait_time_minutes: 0, source_data_list: [{ id: 'i1', name: 'Ghost', from_task_id: 'missing-output' }], output_data_list: [], blockers: [], errors: [], validation_needed: false, validation_procedure_steps: [], reference_links: [], instructions: [], media: [] },
        { id: 'o', node_id: 'o', name: 'Outcome', description: 'finish', task_type: 'OUTCOME', interface: 'OUTCOME', occurrence: 1, manual_time_minutes: 0, automation_time_minutes: 0, machine_wait_time_minutes: 0, source_data_list: [], output_data_list: [], blockers: [], errors: [], validation_needed: false, validation_procedure_steps: [], reference_links: [], instructions: [], media: [] },
      ],
      edges: [
        { source: 't', target: 'a', label: '' },
        { source: 'a', target: 'o', label: '' },
      ],
    },
    expectedCodes: [],
  },
  {
    name: 'cycle and disconnected branch',
    draft: {
      metadata: {
        name: 'Cycle Check',
        description: 'Contains cycle',
        prc: 'PRC-3',
        workflow_type: 'Automation',
        org: 'Metrology',
        team: 'Automation',
        trigger_type: 'Manual',
        trigger_description: 'Operator',
        output_type: 'State',
        output_description: 'State updated',
        cadence_count: 2,
        cadence_unit: 'week',
        tool_family: ['XPS'],
        applicable_tools: ['XPS-02'],
        repeatability_check: true,
      },
      tasks: [
        { id: 't', node_id: 't', name: 'Trigger', description: 'start', task_type: 'TRIGGER', interface: 'TRIGGER', occurrence: 1, manual_time_minutes: 0, automation_time_minutes: 0, machine_wait_time_minutes: 0, source_data_list: [], output_data_list: [], blockers: [], errors: [], validation_needed: false, validation_procedure_steps: [], reference_links: [], instructions: [], media: [] },
        { id: 'a', node_id: 'a', name: 'A', description: 'first', task_type: 'System Interaction', occurrence: 1, manual_time_minutes: 3, automation_time_minutes: 0, machine_wait_time_minutes: 0, source_data_list: [], output_data_list: [], blockers: [], errors: [], validation_needed: false, validation_procedure_steps: [], reference_links: [], instructions: [], media: [] },
        { id: 'b', node_id: 'b', name: 'B', description: 'second', task_type: 'System Interaction', occurrence: 1, manual_time_minutes: 3, automation_time_minutes: 0, machine_wait_time_minutes: 0, source_data_list: [], output_data_list: [], blockers: [], errors: [], validation_needed: false, validation_procedure_steps: [], reference_links: [], instructions: [], media: [] },
        { id: 'x', node_id: 'x', name: 'Detached', description: 'detached', task_type: 'System Interaction', occurrence: 1, manual_time_minutes: 3, automation_time_minutes: 0, machine_wait_time_minutes: 0, source_data_list: [], output_data_list: [], blockers: [], errors: [], validation_needed: false, validation_procedure_steps: [], reference_links: [], instructions: [], media: [] },
        { id: 'o', node_id: 'o', name: 'Outcome', description: 'finish', task_type: 'OUTCOME', interface: 'OUTCOME', occurrence: 1, manual_time_minutes: 0, automation_time_minutes: 0, machine_wait_time_minutes: 0, source_data_list: [], output_data_list: [], blockers: [], errors: [], validation_needed: false, validation_procedure_steps: [], reference_links: [], instructions: [], media: [] },
      ],
      edges: [
        { source: 't', target: 'a', label: '' },
        { source: 'a', target: 'b', label: '' },
        { source: 'b', target: 'a', label: '' },
        { source: 'b', target: 'o', label: '' },
      ],
    },
    expectedCodes: ['graph.cycle', 'graph.unreachable'],
  },
];

test('workflow scenario replay catches known structural failures', () => {
  const results = scenarioMatrix.map((scenario) => ({
    name: scenario.name,
    issues: auditWorkflowDraft(scenario.draft),
  }));

  const cycleScenario = results.find((result) => result.name === 'cycle and disconnected branch');
  assert(cycleScenario);
  assert(cycleScenario.issues.some((issue) => issue.code === 'graph.cycle'));
  assert(cycleScenario.issues.some((issue) => issue.code === 'graph.unreachable'));

  const happyPath = results.find((result) => result.name === 'happy path linear flow');
  assert(happyPath);
  assert.equal(happyPath.issues.filter((issue) => issue.severity === 'error').length, 0);

  const orphanScenario = results.find((result) => result.name === 'orphaned input reference');
  assert(orphanScenario);
  assert(orphanScenario.issues.some((issue) => issue.code === 'task.orphaned_input'));
});
