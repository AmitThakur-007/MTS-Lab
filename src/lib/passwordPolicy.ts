export interface PasswordValidationResult {
  valid: boolean;
  message?: string;
  requirements?: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
  };
}

export function validateStrongPassword(password: string): PasswordValidationResult {
  const minLength = Boolean(password && password.length >= 12);
  const hasUppercase = /[A-Z]/.test(password || '');
  const hasLowercase = /[a-z]/.test(password || '');
  const hasNumber = /[0-9]/.test(password || '');
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password || '');

  const valid = minLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;

  let message: string | undefined;
  if (!valid) {
    const missing: string[] = [];
    if (!minLength) missing.push('at least 12 characters');
    if (!hasUppercase) missing.push('at least 1 uppercase letter (A-Z)');
    if (!hasLowercase) missing.push('at least 1 lowercase letter (a-z)');
    if (!hasNumber) missing.push('at least 1 numeric digit (0-9)');
    if (!hasSpecialChar) missing.push('at least 1 special character (e.g. @, #, $, !)');
    message = `Password must include ${missing.join(', ')}.`;
  }

  return {
    valid,
    message,
    requirements: {
      minLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecialChar
    }
  };
}
