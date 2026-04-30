export function validateEmail(email: string): "emailRequired" | "emailInvalid" | null {
  if (!email.trim()) return "emailRequired";
  if (!/^\S+@\S+\.\S+$/.test(email)) return "emailInvalid";
  return null;
}

export function validatePassword(password: string): "passwordRequired" | "passwordMin" | null {
  if (!password) return "passwordRequired";
  if (password.length < 8) return "passwordMin";
  return null;
}

export function validatePasswordMatch(
  password: string,
  confirm: string
): "confirmRequired" | "passwordsMismatch" | null {
  if (!confirm) return "confirmRequired";
  if (password !== confirm) return "passwordsMismatch";
  return null;
}
