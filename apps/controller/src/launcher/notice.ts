// Reports that mean the launch went as planned; anything else is worth a brief look.
const ROUTINE = /^(rsp_set_mode\b|run_\w+ sent$|Run finished\b)/;

/** A launch report to flash in the readout, or null for the routine ones. */
export function launchNotice(report: string | undefined): string | null {
  return report && !ROUTINE.test(report) ? report : null;
}
