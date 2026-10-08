/**
 * Custom auth using only Supabase tables (users, otps) - no Supabase Auth.
 * Matches my_fyp CustomAuthService.
 * Sends OTP via EmailJS for signup and forgot password.
 */
import { supabase } from "./supabase.js";
import { hashPassword, verifyPassword, generateOTP } from "./passwordService.js";
import { sendOTPEmail } from "./emailService.js";
import { GOOGLE_WEB_CLIENT_ID } from "./googleConstants.js";

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

function decodeGoogleIdTokenPayload(credential) {
  try {
    const parts = credential.split(".");
    if (parts.length !== 3) throw new Error("Invalid token");
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
    const json = atob(base64 + pad);
    return JSON.parse(json);
  } catch {
    throw new Error("Invalid Google sign-in response.");
  }
}

/**
 * Sign in or register with Google ID token. Persists user in `users` with password_hash null and google_sub set.
 * @param {object} opts
 * @param {string} opts.credential - Google ID token (JWT) from OAuth
 * @param {"user"|"vendor"} opts.role
 */
export async function signInWithGoogle({ credential, role }) {
  const roleToUse = role === "vendor" ? "vendor" : "user";
  const payload = decodeGoogleIdTokenPayload(credential);
  const aud = payload.aud;
  if (aud !== GOOGLE_WEB_CLIENT_ID && aud !== import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID) {
    throw new Error("Google sign-in configuration error.");
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp != null && payload.exp < nowSec) {
    throw new Error("Google sign-in expired. Please try again.");
  }
  const googleSub = payload.sub;
  const emailRaw = payload.email;
  if (!googleSub || !emailRaw || String(emailRaw).trim() === "") {
    throw new Error("Google did not provide an email. Allow email permission and try again.");
  }
  const emailLower = String(emailRaw).trim().toLowerCase();
  const nameFromGoogle = (payload.name && String(payload.name).trim()) || emailLower.split("@")[0];
  const emailVerified =
    payload.email_verified === true || payload.email_verified === "true";

  let { data: userRow } = await supabase
    .from("users")
    .select("*")
    .eq("google_sub", googleSub)
    .eq("role", roleToUse)
    .maybeSingle();

  if (!userRow) {
    const { data: byEmail } = await supabase
      .from("users")
      .select("*")
      .eq("email", emailLower)
      .eq("role", roleToUse)
      .maybeSingle();

    if (byEmail) {
      if (byEmail.password_hash != null && byEmail.google_sub != null && byEmail.google_sub !== googleSub) {
        throw new Error("This email is linked to another Google account.");
      }
      const { data: linked, error: linkErr } = await supabase
        .from("users")
        .update({
          google_sub: googleSub,
          last_login: new Date().toISOString(),
          name: byEmail.name || nameFromGoogle,
          email_verified: byEmail.email_verified || emailVerified,
        })
        .eq("id", byEmail.id)
        .select()
        .single();
      if (linkErr) throw new Error(linkErr.message || "Could not link Google account.");
      userRow = linked;
    }
  }

  if (!userRow) {
    const now = new Date().toISOString();
    const insertPayload = {
      email: emailLower,
      password_hash: null,
      name: nameFromGoogle,
      phone: null,
      role: roleToUse,
      company_name: null,
      address: null,
      google_sub: googleSub,
      email_verified: emailVerified,
      phone_verified: false,
      is_active: true,
      last_login: now,
    };
    const { data: inserted, error: insertError } = await supabase
      .from("users")
      .insert(insertPayload)
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
    userRow = inserted;
  } else {
    if (userRow.is_active === false) {
      throw new Error("Your account has been deactivated. Please contact support.");
    }
    const { data: updated, error: upErr } = await supabase
      .from("users")
      .update({
        last_login: new Date().toISOString(),
        name: userRow.name || nameFromGoogle,
        email_verified: userRow.email_verified || emailVerified,
      })
      .eq("id", userRow.id)
      .select()
      .single();
    if (upErr) throw new Error(upErr.message);
    userRow = updated;
  }

  if (userRow.is_active === false) {
    throw new Error("Your account has been deactivated. Please contact support.");
  }

  const { password_hash: _, ...rest } = userRow;
  return toUserModel(rest);
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

  if (userRow.password_hash == null) {
    throw new Error("This account uses Google sign-in. Please use Continue with Google.");
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

const MAX_OTP_ATTEMPTS = 5;

/** Roles that share one login screen (and so one password-reset flow). */
function rolesForFlow(role) {
  return role === "vendor" ? ["vendor", "admin"] : ["user", "doctor"];
}

/**
 * Check `otpCode` against the latest active OTP for email + type.
 * Wrong codes count toward MAX_OTP_ATTEMPTS. Returns the OTP row on success.
 */
async function checkActiveOtp({ email, otpCode, otpType }) {
  const emailLower = email.trim().toLowerCase();

  const { data: otpRow, error } = await supabase
    .from("otps")
    .select("*")
    .eq("email", emailLower)
    .eq("otp_type", otpType)
    .eq("is_used", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!otpRow) throw new Error("Invalid or expired OTP code.");
  if ((otpRow.attempts ?? 0) >= MAX_OTP_ATTEMPTS) {
    throw new Error("Too many failed attempts. Please request a new OTP.");
  }

  if (otpRow.otp_code !== String(otpCode).trim()) {
    await supabase
      .from("otps")
      .update({ attempts: (otpRow.attempts ?? 0) + 1 })
      .eq("id", otpRow.id);
    throw new Error("Invalid or expired OTP code.");
  }

  return otpRow;
}

async function markOtpUsed(otpId) {
  const { error } = await supabase.from("otps").update({ is_used: true }).eq("id", otpId);
  if (error) throw new Error(error.message);
}

/** Verify OTP (email_verification or password_reset). Marks OTP used and updates email_verified if type is email_verification. */
export async function verifyOTP({ email, otpCode, otpType = "email_verification" }) {
  const otpRow = await checkActiveOtp({ email, otpCode, otpType });
  await markOtpUsed(otpRow.id);

  if (otpType === "email_verification") {
    const { error } = await supabase.from("users").update({ email_verified: true }).eq("id", otpRow.user_id);
    if (error) throw new Error(error.message);
  }

  return true;
}

/** Verify OTP without marking used (for password reset flow). */
export async function verifyOTPWithoutMarking({ email, otpCode, otpType }) {
  await checkActiveOtp({ email, otpCode, otpType });
  return true;
}

/**
 * Request password reset: create OTP (password_reset) for the account of this role.
 * The same email may have a customer and a vendor account, so `role` picks one.
 * Does not reveal if email exists.
 */
export async function requestPasswordReset({ email, role = "user" }) {
  const emailLower = email.trim().toLowerCase();
  const { data: rows, error } = await supabase
    .from("users")
    .select("id")
    .eq("email", emailLower)
    .in("role", rolesForFlow(role))
    .limit(2);

  if (error) throw new Error(error.message);
  if (rows?.length !== 1) return;

  const otpCode = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error: insertError } = await supabase.from("otps").insert({
    user_id: rows[0].id,
    email: emailLower,
    otp_code: otpCode,
    otp_type: "password_reset",
    expires_at: expiresAt,
    is_used: false,
    attempts: 0,
  });
  if (insertError) throw new Error(insertError.message);

  const emailResult = await sendOTPEmail(emailLower, otpCode, "password_reset");
  if (!emailResult.ok) {
    console.warn("Password reset OTP email send failed:", emailResult.error);
  }
}

/** Reset password: verify OTP, then update the account the OTP was issued for. */
export async function resetPassword({ email, otpCode, newPassword }) {
  const otpRow = await checkActiveOtp({ email, otpCode, otpType: "password_reset" });
  if (!otpRow.user_id) throw new Error("User not found.");

  const passwordHash = await hashPassword(newPassword);
  const { error: updateError } = await supabase
    .from("users")
    .update({ password_hash: passwordHash })
    .eq("id", otpRow.user_id);

  if (updateError) throw new Error(updateError.message);

  await markOtpUsed(otpRow.id);
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
