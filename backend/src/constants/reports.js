/**
 * Report constants.
 * DB Architecture §3 — Reports collection.
 *
 * All enums are frozen so they can be imported and used safely by
 * the model, validators, and future service/admin layers without risk
 * of mutation.
 */

/**
 * Report status lifecycle.
 *
 * Transitions (enforced at the service/admin layer, not the DB):
 *   pending → approved
 *   pending → rejected
 *   pending → info_requested
 *   info_requested → pending   (after user provides additional info)
 *
 * No soft-delete — rejected is the terminal negative state.
 * DB Architecture §Soft Delete Strategy: status transitions replace deletion.
 */
export const REPORT_STATUSES = Object.freeze({
  PENDING:          'pending',
  APPROVED:         'approved',
  REJECTED:         'rejected',
  INFO_REQUESTED:   'info_requested',
});

/**
 * Report category / type enum.
 * Describes the nature of the scam being reported.
 * DB Architecture §3 — stored inline on the Report document (no separate Categories collection).
 */
export const REPORT_CATEGORIES = Object.freeze({
  UPI_FRAUD:          'upi_fraud',
  PHONE_SCAM:         'phone_scam',
  PHISHING:           'phishing',
  IMPERSONATION:      'impersonation',
  INVESTMENT_FRAUD:   'investment_fraud',
  LOAN_FRAUD:         'loan_fraud',
  JOB_FRAUD:          'job_fraud',
  LOTTERY_FRAUD:      'lottery_fraud',
  ROMANCE_SCAM:       'romance_scam',
  ECOMMERCE_FRAUD:    'ecommerce_fraud',
  OTHER:              'other',
});
