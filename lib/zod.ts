import { z } from 'zod'

// Shared Zod DTOs (as per specification)

// RegisterDto { email, password(min 8..128), displayName? }
export const RegisterDto = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'),
  displayName: z.string().min(1, 'Display name cannot be empty').optional(),
})

// LoginDto { email, password, mfaCode? }
export const LoginDto = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  mfaCode: z.string().regex(/^\d{6}$/, 'MFA code must be exactly 6 digits').optional(),
})

// ForgotDto { email }
export const ForgotDto = z.object({
  email: z.string().email('Invalid email format'),
})

// ResetDto { token, newPassword }
export const ResetDto = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'),
})

// VerifyDto { token }
export const VerifyDto = z.object({
  token: z.string().min(1, 'Token is required'),
})

// ChangePasswordDto { currentPassword, newPassword }
export const ChangePasswordDto = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'),
})

// ChangeEmailInitDto { newEmail }
export const ChangeEmailInitDto = z.object({
  newEmail: z.string().email('Invalid email format'),
})

// ChangeEmailConfirmDto { token }
export const ChangeEmailConfirmDto = z.object({
  token: z.string().min(1, 'Token is required'),
})

// MFA DTOs (not in main spec but needed for completeness)
export const MfaSetupDto = z.object({
  secret: z.string().min(1, 'Secret is required'),
  token: z.string().regex(/^\d{6}$/, 'Token must be exactly 6 digits'),
})

export const MfaConfirmDto = z.object({
  token: z.string().regex(/^\d{6}$/, 'Token must be exactly 6 digits'),
})

// Legacy schema exports for backward compatibility
export const registerSchema = RegisterDto
export const loginSchema = LoginDto
export const forgotPasswordSchema = ForgotDto
export const resetPasswordSchema = ResetDto
export const changePasswordSchema = ChangePasswordDto
export const changeEmailInitSchema = ChangeEmailInitDto
export const changeEmailConfirmSchema = ChangeEmailConfirmDto
export const mfaSetupSchema = MfaSetupDto
export const mfaConfirmSchema = MfaConfirmDto

// Type exports (using DTO naming convention)
export type RegisterDto = z.infer<typeof RegisterDto>
export type LoginDto = z.infer<typeof LoginDto>
export type ForgotDto = z.infer<typeof ForgotDto>
export type ResetDto = z.infer<typeof ResetDto>
export type VerifyDto = z.infer<typeof VerifyDto>
export type ChangePasswordDto = z.infer<typeof ChangePasswordDto>
export type ChangeEmailInitDto = z.infer<typeof ChangeEmailInitDto>
export type ChangeEmailConfirmDto = z.infer<typeof ChangeEmailConfirmDto>
export type MfaSetupDto = z.infer<typeof MfaSetupDto>
export type MfaConfirmDto = z.infer<typeof MfaConfirmDto>

// Legacy type exports for backward compatibility
export type RegisterInput = RegisterDto
export type LoginInput = LoginDto
export type ForgotPasswordInput = ForgotDto
export type ResetPasswordInput = ResetDto
export type ChangePasswordInput = ChangePasswordDto
export type ChangeEmailInitInput = ChangeEmailInitDto
export type ChangeEmailConfirmInput = ChangeEmailConfirmDto
export type MfaSetupInput = MfaSetupDto
export type MfaConfirmInput = MfaConfirmDto