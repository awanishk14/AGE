import {
  DEMO_BUSINESS_DISCOVERY_PROFILE,
  DEMO_SCENARIO_METADATA,
  buildContextReadinessReport,
  demoContext,
  produceDemoScoredBifContext,
  runAllCapabilities,
  runBusinessDiscoveryIntake,
  type BusinessDiscoveryIntakeSummary,
  type CapabilityRunReport,
  type ContextReadinessReport,
} from '@age/demo-runtime';

/**
 * AGE in-memory capability demo runner.
 *
 * Executes the six completed pure capabilities against local fixtures and prints
 * human-reviewable decision objects. Strictly Human-Approved Execution: no
 * persistence, queues/events, integrations, HTTP, filesystem writes, external
 * APIs, AI/LLM, or execution engines. Nothing here performs a real side effect —
 * the output is a recommendation awaiting human approval.
 */

function line(char = '-', width = 72): string {
  return char.repeat(width);
}

/**
 * Print the upstream Business Discovery intake stage. This runs *before* the
 * capabilities and produces no decision objects — nothing here is approved or
 * executed, so it is reported as context, not as pending work.
 */
function printDiscovery(summary: BusinessDiscoveryIntakeSummary): void {
  console.log('');
  console.log(line('='));
  console.log('DISCOVERY / INTAKE: Business Discovery (upstream — not a capability)');
  console.log(line('='));
  console.log(`profile: ${summary.profileId}  |  business: ${summary.businessName}`);
  console.log(
    `questionnaire: ${summary.questionnaireId} v${summary.questionnaireVersion}  |  ` +
      `profile schema: ${summary.profileSchemaValid ? 'VALID' : 'INVALID'}  |  ` +
      `questionnaire: ${summary.questionnaireValid ? 'VALID' : 'INCOMPLETE'}`,
  );
  console.log(
    `missingRequired=${summary.missingRequiredCount}  criticalGaps=${summary.criticalGapCount}`,
  );

  console.log('');
  console.log('Scores (four distinct measurements — never interchangeable):');
  console.log(
    `  intake: completeness=${summary.discoveryCompletenessScore}  ` +
      `confidence=${summary.discoveryConfidenceScore}   (properties of the interview)`,
  );
  console.log(
    `  BIF:    completeness=${summary.bifCompletenessScore}  ` +
      `confidence=${summary.bifConfidenceScore}   (properties of the produced Draft BIF)`,
  );
  console.log(
    '  A well-captured interview still yields a sparse BIF: discovery covers ' +
      'only part of the BIF surface.',
  );

  console.log('');
  console.log(`Scored BIF context projection (status: ${summary.bifStatus} — never promoted):`);
  console.log(`  populated sections (${summary.presentSectionTypes.length}):`);
  for (const type of summary.presentSectionTypes) {
    console.log(`    - ${type}`);
  }
  console.log(`  omitted sections (${summary.omittedSectionTypes.length}):`);
  for (const type of summary.omittedSectionTypes) {
    console.log(`    - ${type}`);
  }
  console.log(
    `  segments=${summary.customerSegmentCount}  offerings=${summary.offeringCount}  ` +
      `competitors=${summary.competitorCount}  goals=${summary.goalCount}`,
  );
  console.log(
    `  evidenceRefs=${summary.evidenceReferenceCount}  assumptions=${summary.assumptionCount}`,
  );

  console.log('');
  console.log(
    'Discovery captures context only — no strategy, no approval required. The ' +
      'scores above are reported, never acted on: nothing is ranked, planned or ' +
      'promoted from them. Evidence references are counted, never fetched.',
  );
}

/**
 * Print the context-readiness stage (ADR-0047). This runs between intake and the
 * capability runs and produces no decision objects — nothing here is approved or
 * executed, and nothing derived from it feeds the runs.
 *
 * ⚠️ THE ORDER BELOW IS FIXED REGISTRY ORDER AND MUST NEVER BE SORTED, grouped
 * or reordered by state, and NO aggregate line may be added — no "overall
 * readiness", no "2 of 3 ready", no count across capabilities. Each state is
 * printed adjacent to its OWN denominator and its OWN thresholds, because the
 * three states are incommensurable and a state shown without its denominator
 * invites exactly the comparison ADR-0027 D2 refused (ADR-0047 D4).
 */
function printContextReadiness(report: ContextReadinessReport): void {
  console.log('');
  console.log(line('='));
  console.log('CONTEXT READINESS: how far the captured context carries each capability');
  console.log(line('='));

  for (const notice of report.incommensurabilityNotice) {
    console.log(notice);
  }

  for (const entry of report.entries) {
    console.log('');
    console.log(`  ${entry.capabilityName}: ${entry.declaration}`);

    if (entry.state === undefined) {
      // A declared property, never a deficiency and never a lesser capability.
      // No null, no 0, no "N/A", no defaulted sufficiency (ADR-0047 D5).
      continue;
    }

    console.log(`    state: ${entry.state}`);
    console.log(`    basis: ${entry.denominator}`);
    if (entry.requiredSectionTypes !== undefined) {
      console.log(`    requires: ${entry.requiredSectionTypes.join(', ')}`);
    }
    if (entry.thresholds !== undefined) {
      const printed = Object.entries(entry.thresholds)
        .map(([k, v]) => `${k}=${v}`)
        .join('  ');
      console.log(`    thresholds: ${printed}`);
    }
    for (const reason of entry.reasons ?? []) {
      console.log(`    - ${reason}`);
    }
    for (const limitation of entry.limitations ?? []) {
      console.log(`    limitation: ${limitation}`);
    }
    for (const hint of entry.improvementHints ?? []) {
      console.log(`    to raise readiness: ${hint}`);
    }
  }
}

function printReport(report: CapabilityRunReport): void {
  console.log('');
  console.log(line('='));
  console.log(`CAPABILITY: ${report.name}`);
  console.log(line('='));

  const extra =
    report.extra && Object.keys(report.extra).length > 0
      ? '  |  ' +
        Object.entries(report.extra)
          .map(([k, v]) => `${k}=${v}`)
          .join('  ')
      : '';
  console.log(
    `accepted=${report.acceptedCount}  rejected=${report.rejectedCount}  ` +
      `duplicate=${report.duplicateCount}  derived=${report.derivedCount}${extra}`,
  );
  console.log(
    `accounting: ${report.acceptedCount} + ${report.rejectedCount} + ${report.duplicateCount} = ` +
      `${report.derivedCount} (input items: ${report.inputItemCount}) — ` +
      `${report.accountingHolds ? 'OK' : 'MISMATCH'}`,
  );

  console.log('');
  console.log('Accepted decision objects:');
  if (report.acceptedItems.length === 0) {
    console.log('  (none)');
  } else {
    for (const item of report.acceptedItems) {
      console.log(`  - ${JSON.stringify(item)}`);
    }
  }

  if (report.rejectedReasons.length > 0) {
    console.log('');
    console.log('Rejected (surfaced, not dropped silently):');
    for (const reason of report.rejectedReasons) {
      console.log(`  - ${JSON.stringify(reason)}`);
    }
  }

  if (report.duplicateReferences.length > 0) {
    console.log('');
    console.log('Duplicates (merged into the accepted original):');
    for (const dup of report.duplicateReferences) {
      console.log(`  - ${JSON.stringify(dup)}`);
    }
  }

  console.log('');
  console.log('PENDING HUMAN APPROVAL:');
  if (report.acceptedItems.length === 0) {
    console.log('  (nothing to approve)');
  } else {
    for (const item of report.acceptedItems) {
      console.log(`  [ ] approve  ${report.name}  ${item.id}`);
    }
  }
}

async function main(): Promise<void> {
  console.log(line('#'));
  console.log('AGE — In-Memory Capability Demo (Human-Approved Execution)');
  console.log('This is what AGE recommends. Human approval is required before execution.');
  console.log('No external side effects are performed by this demo.');
  console.log(line('#'));

  // The demo scenario metadata is passed explicitly (ADR-0039 D3) — the three
  // values canonical Path B mapping needs are visible here, not hidden inside it.
  const discovery = runBusinessDiscoveryIntake(
    DEMO_BUSINESS_DISCOVERY_PROFILE,
    DEMO_SCENARIO_METADATA,
  );
  printDiscovery(discovery);

  // Stage two: context readiness (ADR-0047). `producedAt` is supplied HERE, at
  // the call site, from the frozen scenario time — ⚠️ never `new Date()`, which
  // would make the determinism note at the foot of sample-output.txt false.
  // `Object.freeze` is shallow, so the Date is copied rather than passed.
  const scoredBifContext = produceDemoScoredBifContext(
    DEMO_BUSINESS_DISCOVERY_PROFILE,
    DEMO_SCENARIO_METADATA,
  ).context;
  const readiness = buildContextReadinessReport(scoredBifContext, {
    producedAt: new Date(DEMO_SCENARIO_METADATA.constructedAt.getTime()),
    // ⚠️ Passed EXPLICITLY (ADR-0053 D5). The stage no longer imports it, and
    // there is no default — a default would make the parameter decorative.
    clientContext: demoContext,
  });
  printContextReadiness(readiness);

  // ⚠️ The runs below are NOT gated on readiness above, and must never become
  // so. They take no argument derived from it (ADR-0047 D7b).
  const reports = await runAllCapabilities();

  let totalPending = 0;
  let allAccountingHolds = true;
  for (const report of reports) {
    printReport(report);
    totalPending += report.acceptedItems.length;
    allAccountingHolds = allAccountingHolds && report.accountingHolds;
  }

  console.log('');
  console.log(line('#'));
  console.log(
    `SUMMARY: Business Discovery intake loaded (profile ${discovery.profileId}, ` +
      `${discovery.presentSectionTypes.length} populated / ` +
      `${discovery.omittedSectionTypes.length} omitted section(s)); ` +
      `${reports.length} capabilities ran; ` +
      `${totalPending} decision object(s) pending human approval.`,
  );
  console.log(
    `Accounting invariant across all capabilities: ${allAccountingHolds ? 'OK' : 'MISMATCH'}`,
  );
  console.log('Human approval is required before any execution. No side effects were performed.');
  console.log(line('#'));

  if (!allAccountingHolds) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error('Demo runner failed:', error);
  process.exitCode = 1;
});
