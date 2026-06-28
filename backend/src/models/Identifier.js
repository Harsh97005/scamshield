import mongoose from 'mongoose';
import {
  IDENTIFIER_TYPES,
  RISK_LEVELS,
  REPUTATION_SCORE,
  deriveRiskLevel,
} from '../constants/identifiers.js';

const { Schema } = mongoose;

/**
 * Identifiers collection.
 *
 * DB Architecture §2 — One document per unique scam-reportable entity.
 * A single identifier (e.g. a phone number) may accumulate many Reports;
 * this document is the aggregate reputation record for that entity.
 *
 * Key design decisions:
 *  - `normalizedValue` is the canonical deduplication key; it is produced
 *    by identifierNormalizer before any write and never mutated after create.
 *  - `reputationScore` is select:false — internal only, never sent to clients.
 *    The UI-facing field is `riskLevel`, derived at write time.
 *  - `riskLevel` is always kept in sync with `reputationScore` via the
 *    pre-save hook; it must never be set directly by callers.
 *  - `totalReports` and `approvedReports` are denormalized counters
 *    incremented by the Reports service to avoid runtime aggregation.
 *  - Compound unique index on (identifierType, normalizedValue) is the
 *    primary duplicate guard.
 */
const identifierSchema = new Schema(
  {
    identifierType: {
      type: String,
      required: [true, 'identifierType is required'],
      enum: {
        values: Object.values(IDENTIFIER_TYPES),
        message: `identifierType must be one of: ${Object.values(IDENTIFIER_TYPES).join(', ')}`,
      },
    },

    /**
     * Canonical, fully normalised value.
     * Produced by identifierNormalizer — never accepted raw from user input.
     * Examples: "+919876543210", "harsh@gmail.com", "example.com"
     */
    normalizedValue: {
      type: String,
      required: [true, 'normalizedValue is required'],
      trim: true,
    },

    /**
     * Human-readable display string shown in search results and detail views.
     * May differ from normalizedValue (e.g. "+91 98765 43210" vs "+919876543210").
     */
    displayValue: {
      type: String,
      required: [true, 'displayValue is required'],
      trim: true,
    },

    /**
     * INTERNAL ONLY — never exposed via API responses.
     * Integer in [0, 100]; updated by the reputation scoring pipeline.
     * select:false ensures it is stripped from all queries by default.
     */
    reputationScore: {
      type: Number,
      default: REPUTATION_SCORE.DEFAULT,
      min: [REPUTATION_SCORE.MIN, `reputationScore cannot be below ${REPUTATION_SCORE.MIN}`],
      max: [REPUTATION_SCORE.MAX, `reputationScore cannot exceed ${REPUTATION_SCORE.MAX}`],
      select: false,
    },

    /**
     * UI-facing risk signal — derived from reputationScore in the pre-save hook.
     * Must never be set directly; always computed via deriveRiskLevel().
     * New identifiers default to 'unverified' (score 0 → below caution threshold).
     */
    riskLevel: {
      type: String,
      enum: {
        values: Object.values(RISK_LEVELS),
        message: `riskLevel must be one of: ${Object.values(RISK_LEVELS).join(', ')}`,
      },
      default: deriveRiskLevel(REPUTATION_SCORE.DEFAULT),
    },

    /** Total community reports submitted (pending + approved + rejected). */
    totalReports: {
      type: Number,
      default: 0,
      min: 0,
    },

    /** Reports that passed moderation — used in credibility weighting. */
    approvedReports: {
      type: Number,
      default: 0,
      min: 0,
    },

    /** Timestamp of the most recently submitted report against this identifier. */
    lastReportedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
    collection: 'identifiers',
  },
);

// ---------------------------------------------------------------------------
// Indexes
// DB Architecture §2:
//   - Compound unique on (identifierType, normalizedValue) — primary dedup guard.
//   - riskLevel — filtered lookups in moderation and public search.
//   - lastReportedAt — "recently active" sort in search results.
// ---------------------------------------------------------------------------
identifierSchema.index(
  { identifierType: 1, normalizedValue: 1 },
  { unique: true, name: 'idx_type_normalizedValue_unique' },
);
identifierSchema.index({ riskLevel: 1 }, { name: 'idx_riskLevel' });
identifierSchema.index({ lastReportedAt: -1 }, { name: 'idx_lastReportedAt_desc' });

// ---------------------------------------------------------------------------
// Pre-save hook — keep riskLevel in sync with reputationScore.
// Runs whenever reputationScore is modified so the two fields never diverge.
// ---------------------------------------------------------------------------
identifierSchema.pre('save', function (next) {
  if (this.isModified('reputationScore') || this.isNew) {
    // reputationScore is select:false; access via $locals trick for new docs.
    // For existing docs the field is already in memory when fetched with +reputationScore.
    const score = this.reputationScore ?? REPUTATION_SCORE.DEFAULT;
    this.riskLevel = deriveRiskLevel(score);
  }
  next();
});

// ---------------------------------------------------------------------------
// Instance methods
// ---------------------------------------------------------------------------

/**
 * Public-safe representation — excludes reputationScore.
 * Used in API responses for search results and detail views.
 *
 * @returns {object}
 */
identifierSchema.methods.toPublicJSON = function () {
  return {
    id:             this._id,
    identifierType: this.identifierType,
    displayValue:   this.displayValue,
    riskLevel:      this.riskLevel,
    totalReports:   this.totalReports,
    approvedReports: this.approvedReports,
    lastReportedAt: this.lastReportedAt,
    createdAt:      this.createdAt,
    updatedAt:      this.updatedAt,
  };
};

export const Identifier = mongoose.model('Identifier', identifierSchema);
