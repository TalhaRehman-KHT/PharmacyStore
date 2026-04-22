/**
 * Custom auth using only Supabase tables (users, otps) - no Supabase Auth.
 * Matches my_fyp CustomAuthService.
 * Sends OTP via EmailJS for signup and forgot password.
 */
import { supabase } from "./supabase.js";
import { hashPassword, verifyPassword, generateOTP } from "./passwordService.js";
import { sendOTPEmail } from "./emailService.js";

const USER_STORAGE_KEY = "user";

function toUserModel(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    contactInfo: row.phone ?? null,
    companyName: row.company_name ?? null,
    address: row.address ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    role: row.role ?? "user",
  };
}

/** Sign up: insert user, then insert OTP for email verification. */
export async function signUp({
  email,
  password,
  name,
  phone,
  role,
  companyName,
  address,
}) {
  const emailLower = email.trim().toLowerCase();
  const roleToUse = role || "user";
  const { data: existing } = await supabase
    .from("users")
    .select("id, email")
    .eq("email", emailLower)
    .eq("role", roleToUse)
    .maybeSingle();

  if (existing) {
    throw new Error(
      `An account with this email already exists for ${roleToUse === "vendor" ? "vendor" : "customer"}.`,
    );
  }

  const passwordHash = await hashPassword(password);
  const userData = {
    email: emailLower,
    password_hash: passwordHash,
    name: name.trim(),
    phone: phone?.trim() || null,
    role: roleToUse,
    company_name: companyName?.trim() || null,
    address: address?.trim() || null,
    email_verified: false,
    phone_verified: false,
    is_active: true,
  };

  const { data: userRow, error: insertError } = await supabase
    .from("users")
    .insert(userData)
    .select()
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      throw new Error(
        `An account with this email already exists for ${roleToUse === "vendor" ? "vendor" : "customer"}.`,
      );
    }
    throw new Error(insertError.message || "Database error");
  }

  const otpCode = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await supabase.from("otps").insert({
    user_id: userRow.id,
    email: emailLower,
    otp_code: otpCode,
    otp_type: "email_verification",
    expires_at: expiresAt,
    is_used: false,
    attempts: 0,
  });

  const emailResult = await sendOTPEmail(emailLower, otpCode, "email_verification");
  if (!emailResult.ok) {
    console.warn("OTP email send failed:", emailResult.error);
    // OTP is still in DB; user can request resend or support can help
  }

  return toUserModel(userRow);
}

/**
 * Sign in: same as my_fyp CustomAuthService — fetch user by email AND role.
 * Pass role for vendor flow ("vendor") or user flow ("user").
 * Or pass allowedRoles: ["vendor","admin"] or ["user","doctor"] to support admin/doctor.
 */
export async function signIn({ email, password, role, allowedRoles }) {
  const emailLower = email.trim().toLowerCase();

  const rolesToMatch = allowedRoles ?? (role ? [role] : null);
  if (!rolesToMatch?.length) {
    throw new Error("Role or allowedRoles is required for sign in.");
  }

  // Get user by email AND role - separate accounts per role (matches my_fyp)
  const { data: rows, error: fetchError } = await supabase
    .from("users")
    .select("*")
    .eq("email", emailLower)
    .in("role", rolesToMatch)
    .limit(2);

  if (fetchError) {
    throw new Error(fetchError.message || "Invalid email or password.");
  }
  const userRow = rows?.length === 1 ? rows[0] : null;
  if (!userRow) {
    throw new Error("Account not found. Please use the correct login.");
  }

  const storedHash = userRow.password_hash;
  const valid = await verifyPassword(password, storedHash);
  if (!valid) {
    throw new Error("Invalid email or password.");
  }

  if (userRow.is_active === false) {
    throw new Error("Your account has been deactivated. Please contact support.");
  }

  await supabase
    .from("users")
    .update({ last_login: new Date().toISOString() })
    .eq("id", userRow.id);

  const { password_hash: _, ...rest } = userRow;
  return toUserModel(rest);
}

/** Verify OTP (email_verification or password_reset). Marks OTP used and updates email_verified if type is email_verification. */
export async function verifyOTP({ email, otpCode, otpType = "email_verification" }) {
  const emailLower = email.trim().toLowerCase();
  const now = new Date().toISOString();

  const { data: otpRow, error: fetchError } = await supabase
    .from("otps")
    .select("*")
    .eq("email", emailLower)
    .eq("otp_code", otpCode)
    .eq("otp_type", otpType)
    .eq("is_used", false)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!otpRow) throw new Error("Invalid or expired OTP code.");
  if (otpRow.attempts >= 5) throw new Error("Too many failed attempts. Please request a new OTP.");

  await supabase.from("otps").update({ is_used: true }).eq("id", otpRow.id);

  if (otpType === "email_verification") {
    await supabase.from("users").update({ email_verified: true }).eq("id", otpRow.user_id);
  }

  return true;
}

/** Verify OTP without marking used (for password reset flow). */
export async function verifyOTPWithoutMarking({ email, otpCode, otpType }) {
  const emailLower = email.trim().toLowerCase();
  const now = new Date().toISOString();

  const { data: otpRow, error } = await supabase
    .from("otps")
    .select("*")
    .eq("email", emailLower)
    .eq("otp_code", otpCode)
    .eq("otp_type", otpType)
    .eq("is_used", false)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !otpRow) throw new Error("Invalid or expired OTP code.");
  if (otpRow.attempts >= 5) throw new Error("Too many failed attempts. Please request a new OTP.");
  return true;
}

/** Request password reset: create OTP (password_reset). Does not reveal if email exists. */
export async function requestPasswordReset(email) {
  const emailLower = email.trim().toLowerCase();
  const { data: userRow } = await supabase
    .from("users")
    .select("id")
    .eq("email", emailLower)
    .maybeSingle();

  if (!userRow) return;

  const otpCode = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await supabase.from("otps").insert({
    user_id: userRow.id,
    email: emailLower,
    otp_code: otpCode,
    otp_type: "password_reset",
    expires_at: expiresAt,
    is_used: false,
    attempts: 0,
  });

  const emailResult = await sendOTPEmail(emailLower, otpCode, "password_reset");
  if (!emailResult.ok) {
    console.warn("Password reset OTP email send failed:", emailResult.error);
  }
}

/** Reset password: verify OTP then update password_hash. */
export async function resetPassword({ email, otpCode, newPassword }) {
  await verifyOTPWithoutMarking({
    email,
    otpCode,
    otpType: "password_reset",
  });

  const emailLower = email.trim().toLowerCase();
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("email", emailLower)
    .single();

  if (userError || !userRow) throw new Error("User not found.");

  const passwordHash = await hashPassword(newPassword);
  const { error: updateError } = await supabase
    .from("users")
    .update({ password_hash: passwordHash })
    .eq("id", userRow.id);

  if (updateError) throw new Error(updateError.message);

  const { data: otpRow } = await supabase
    .from("otps")
    .select("id")
    .eq("email", emailLower)
    .eq("otp_code", otpCode)
    .eq("otp_type", "password_reset")
    .eq("is_used", false)
    .limit(1)
    .maybeSingle();

  if (otpRow) {
    await supabase.from("otps").update({ is_used: true }).eq("id", otpRow.id);
  }
}

/** Get current user by id from DB. */
export async function getCurrentUser(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return toUserModel(data);
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_STORAGE_KEY);
}

/** Update user profile (name, phone, company_name, address, city, state). */
export async function updateUserProfile(userId, updates) {
  const allowed = ["name", "phone", "company_name", "address", "city", "state"];
  const data = {};
  for (const k of allowed) {
    if (updates[k] !== undefined) data[k] = updates[k]?.trim?.() ?? updates[k];
  }
  if (Object.keys(data).length === 0) return null;

  const { data: row, error } = await supabase
    .from("users")
    .update(data)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return toUserModel(row);
}
