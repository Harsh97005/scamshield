import mongoose from 'mongoose';
import { ROLES, CREDIBILITY_TIERS, USER_STATUSES } from '../constants/roles.js';

const { Schema } = mongoose;

/**
 * Users collection.
 *
 * DB Architecture §1 — Authentication, profile, role, and account-status
 * management for both regular users and admins.
 *
 * Design decisions enforced here:
 *  - `passwordHash` is select:false — never returned in any query unless
 *    explicitly opted-in via .select('+passwordHash').
 *  - Password hashing is the explicit responsibility of the Auth Service
 *    during registration; the model stores only the resulting hash.
 *  - `suspendedReason` is an application-layer requirement (required when
 *    status=suspended); enforced in service code, not as a DB constraint.
 *  - `reportCount` and `approvedReportCount` are denormalized counters
 *    incremented at the application layer to avoid aggregating Reports on read.
 *  - No soft-delete flag — status:'suspended' is the terminal removal state
 *    per DB Architecture §Soft Delete Strategy.
 */
const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [60, 'Name must be at most 60 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Must be a valid email address'],
    },

    /**
     * Never queried by default (select:false).
     * Hashed by the Auth Service before being written here — plaintext
     * never reaches the model.
     */
    passwordHash: {
      type: String,
      select: false,
    },

    /**
     * Phone-first (OTP) users may not have a password initially.
     * Stored in E.164 format; sparse allows null for email-signup users
     * without violating the unique constraint.
     */
    phone: {
      type: String,
      sparse: true,
      unique: true,
      match: [/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format'],
    },

    role: {
      type: String,
      enum: {
        values: Object.values(ROLES),
        message: `Role must be one of: ${Object.values(ROLES).join(', ')}`,
      },
      default: ROLES.USER,
      required: true,
    },

    status: {
      type: String,
      enum: {
        values: Object.values(USER_STATUSES),
        message: `Status must be one of: ${Object.values(USER_STATUSES).join(', ')}`,
      },
      default: USER_STATUSES.ACTIVE,
      required: true,
    },

    credibilityTier: {
      type: String,
      enum: {
        values: Object.values(CREDIBILITY_TIERS),
        message: `credibilityTier must be one of: ${Object.values(CREDIBILITY_TIERS).join(', ')}`,
      },
      default: CREDIBILITY_TIERS.NEW,
      required: true,
    },

    /** Denormalized total submission count — incremented by the Reports service. */
    reportCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /** Denormalized approved-report count — drives credibility-tier computation. */
    approvedReportCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /** Set only when status transitions to 'suspended'. Application-layer required. */
    suspendedReason: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
    collection: 'users',
  },
);

// ---------------------------------------------------------------------------
// Indexes
// DB Architecture §1: email (unique — enforced via schema option),
//                     role, status.
// ---------------------------------------------------------------------------
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
// phone unique+sparse index declared inline above.

// ---------------------------------------------------------------------------
// Instance methods
// ---------------------------------------------------------------------------

/**
 * Return a safe public representation of the user — no passwordHash,
 * no internal fields. Used in API responses.
 *
 * @returns {object}
 */
userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    status: this.status,
    credibilityTier: this.credibilityTier,
    reportCount: this.reportCount,
    approvedReportCount: this.approvedReportCount,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const User = mongoose.model('User', userSchema);
