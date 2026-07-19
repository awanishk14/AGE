import { runAllCapabilities, type CapabilityRunReport } from '@age/demo-runtime';

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
    `SUMMARY: ${reports.length} capabilities ran; ` +
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
