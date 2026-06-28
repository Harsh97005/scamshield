import { z } from 'zod';

/**
 * Shared password rule — API Contract §1.1:
 * ≥ 8 chars, at least 1 letter, at least 1 number.
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * POST /auth/signup — API Contract §1.1
 */
export const signupSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(60, 'Name must be at most 60 characters'),

  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Must be a valid email address'),

  password: passwordSchema,
});

/**
 * POST /auth/login — API Contract §1.4
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Must be a valid email address'),

  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});
