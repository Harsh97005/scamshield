import mongoose from 'mongoose';
import { REPORT_STATUSES, REPORT_CATEGORIES } from '../constants/reports.js';

const { Schema } = mongoose;

/**
 * Reports collection.
 *
 * DB Architecture §3 — One document per community submission.
 * A Report links a User (reporter) to an Identifier (the scam entity)
 * and carries the evidence and metadata needed for admin moderation.
 *
 * Key design decisions:
 *  - reporter and identifier are ObjectId refs; populated only when explicitly
 *    needed (populate()). Stored as raw refs to keep document size small.
 *  - reportStatus defaults to 'pending' — all submissions enter the
 *    moderation queue before affecting any public reputation signal.
 *  - adminNotes is select:false — internal moderator field, never sent to
 *    the submitting user or public endpoints.
 *  - evidenceUrls stores object-storage URLs only; binary data lives in the
 *    Evidence collection (DB Architecture §4) linked from a separate service.
 *  - amountLost is optional — not all scams involve a direct monetary loss.
 *  - incidentDate is the user-reported date of the scam event, not the
 *    submission date (which is captured by createdAt).
 *  - No soft-delete — 'rejected' is the terminal removal state per
 *    DB Architecture §Soft Delete Strategy.
 */
const reportSchema = new Schema(
  {
    /**
     * The authenticated user who submitted this report.
     * Required — anonymous reports are not permitted (PRD §FR-R1).
     */
    reporter: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'reporter is required'],
    },

    /**
     * The scam entity being reported (phone, UPI, website, etc.).
     * Resolved via findOrCreateIdentifier() in the Reports service before save.
     */
    identifier: {
      type: Schema.Types.ObjectId,
      ref: 'Identifier',
      required: [true, 'identifier is required'],
    },

    /**
     * Category of scam — inline enum, no separate Categories collection
     * per DB Architecture §3 design note.
     */
    reportType: {
      type: String,
      required: [true, 'reportType is required'],
      enum: {
        values: Object.values(REPORT_CATEGORIES),
        message: `reportType must be one of: ${Object.values(REPORT_CATEGORIES).join(', ')}`,
      },
    },

    /**
     * Moderation lifecycle state.
     * All new submissions start as 'pending' and enter the admin queue.
     */
    reportStatus: {
      type: String,
      required: true,
      enum: {
        values: Object.values(REPORT_STATUSES),
        message: `reportStatus must be one of: ${Object.values(REPORT_STATUSES).join(', ')}`,
      },
      default: REPORT_STATUSES.PENDING,
    },

    /** Short human-readable title for the report — shown in the moderation queue. */
    title: {
      type: String,
      required: [true, 'title is required'],
      trim: true,
      minlength: [10, 'title must be at least 10 characters'],
      maxlength: [120, 'title must be at most 120 characters'],
    },

    /** Full account of the scam incident. Required for moderation review. */
    description: {
      type: String,
      required: [true, 'description is required'],
      trim: true,
      minlength: [30, 'description must be at least 30 characters'],
      maxlength: [5000, 'description must be at most 5000 characters'],
    },

    /**
     * Object-storage URLs for supporting screenshots or documents.
     * Binary files are managed by the Evidence service; this field holds
     * the resulting access URLs after a successful upload confirmation.
     * Optional — a report can be submitted without evidence.
     */
    evidenceUrls: {
      type: [String],
      default: [],
      validate: {
        validator(urls) {
          return urls.length <= 10;
        },
        message: 'A maximum of 10 evidence URLs are allowed per report',
      },
    },

    /**
     * The date on which the scam incident occurred, as reported by the user.
     * Must not be in the future. Optional — not all users remember the exact date.
     */
    incidentDate: {
      type: Date,
      default: null,
      validate: {
        validator(date) {
          return date === null || date <= new Date();
        },
        message: 'incidentDate cannot be in the future',
      },
    },

    /**
     * Financial loss reported by the user, in INR (Indian Rupees).
     * Optional — zero or absent means no direct monetary loss claimed.
     */
    amountLost: {
      type: Number,
      default: null,
      min: [0, 'amountLost cannot be negative'],
    },

    /**
     * Free-form tags for categorization and search filtering.
     * E.g. ['emi_fraud', 'fake_bank', 'whatsapp'].
     * Stored lowercase; enforced at the validator layer.
     */
    tags: {
      type: [String],
      default: [],
      validate: {
        validator(tags) {
          return tags.length <= 10;
        },
        message: 'A maximum of 10 tags are allowed per report',
      },
    },

    /**
     * INTERNAL ONLY — moderator-facing notes on the review decision.
     * select:false: never returned in public or user-facing queries.
     * Set only by admin moderation endpoints (future sprint).
     */
    adminNotes: {
      type: String,
      trim: true,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true, // createdAt (submission time), updatedAt (last moderation action)
    collection: 'reports',
  },
);

// ---------------------------------------------------------------------------
// Indexes
// DB Architecture §3:
//   - identifier + reportStatus — primary moderation queue and timeline queries.
//   - reporter — "my reports" user profile queries.
//   - reportStatus — admin queue filtered by status.
//   - reportType — category-based filtering in admin and analytics.
//   - createdAt DESC — default sort for moderation queue (newest first).
// ---------------------------------------------------------------------------
reportSchema.index(
  { identifier: 1, reportStatus: 1 },
  { name: 'idx_identifier_status' },
);
reportSchema.index({ reporter: 1 }, { name: 'idx_reporter' });
reportSchema.index({ reportStatus: 1 }, { name: 'idx_reportStatus' });
reportSchema.index({ reportType: 1 }, { name: 'idx_reportType' });
reportSchema.index({ createdAt: -1 }, { name: 'idx_createdAt_desc' });

// ---------------------------------------------------------------------------
// Instance methods
// ---------------------------------------------------------------------------

/**
 * Public-safe representation — excludes adminNotes.
 * Used in user-facing responses (submitter viewing own report).
 *
 * @returns {object}
 */
reportSchema.methods.toPublicJSON = function () {
  return {
    id:           this._id,
    reportType:   this.reportType,
    reportStatus: this.reportStatus,
    reporter:     this.reporter,
    identifier:   this.identifier,
    title:        this.title,
    description:  this.description,
    evidenceUrls: this.evidenceUrls,
    incidentDate: this.incidentDate,
    amountLost:   this.amountLost,
    tags:         this.tags,
    createdAt:    this.createdAt,
    updatedAt:    this.updatedAt,
  };
};

/**
 * Admin representation — includes adminNotes.
 * Used exclusively by admin moderation endpoints.
 * Requires the document to have been fetched with .select('+adminNotes').
 *
 * @returns {object}
 */
reportSchema.methods.toAdminJSON = function () {
  return {
    ...this.toPublicJSON(),
    adminNotes: this.adminNotes,
  };
};

export const Report = mongoose.model('Report', reportSchema);
