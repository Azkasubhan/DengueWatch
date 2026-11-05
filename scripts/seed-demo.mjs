import { createClient } from "@supabase/supabase-js";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "DEMO_ACCOUNT_PASSWORD",
];

if (process.env.NODE_ENV === "production") {
  throw new Error("Demo seed is disabled in production.");
}

if (process.env.ALLOW_DEMO_SEED !== "true") {
  throw new Error(
    "Set ALLOW_DEMO_SEED=true explicitly before running the demo seed.",
  );
}

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  const normalized = process.env[name].toLowerCase();
  if (
    normalized.includes("replace") ||
    normalized.includes("placeholder") ||
    normalized.includes("your-project") ||
    normalized.includes("server_only_if")
  ) {
    throw new Error(
      `Environment variable still contains a placeholder: ${name}`,
    );
  }
}

const projectUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
if (projectUrl.protocol !== "http:" && projectUrl.protocol !== "https:") {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL must use http or https.");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);

const accounts = [
  {
    email: "warga.simulasi@denguewatch.test",
    displayName: "Warga",
    role: "resident",
    membershipType: "resident",
  },
  {
    email: "kader.satu@denguewatch.test",
    displayName: "Kader Satu",
    role: "cadre",
    membershipType: "assigned_cadre",
  },
  {
    email: "kader.dua@denguewatch.test",
    displayName: "Kader Dua",
    role: "cadre",
    membershipType: "assigned_cadre",
  },
  {
    email: "pengelola.simulasi@denguewatch.test",
    displayName: "Pengelola",
    role: "manager",
    membershipType: "manager",
  },
];

async function findUser(email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email === email);
    if (user) return user;
    if (data.users.length < 100) return null;
  }
  throw new Error("Demo user lookup exceeded the safe pagination limit.");
}

async function ensureUser(account) {
  const existing = await findUser(account.email);
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(
      existing.id,
      {
        email_confirm: true,
        password: process.env.DEMO_ACCOUNT_PASSWORD,
        user_metadata: { display_name: account.displayName },
      },
    );
    if (error) throw error;
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: account.email,
    email_confirm: true,
    password: process.env.DEMO_ACCOUNT_PASSWORD,
    user_metadata: { display_name: account.displayName },
  });
  if (error) throw error;
  return data.user;
}

const { data: area, error: areaError } = await supabase
  .from("areas")
  .upsert(
    {
      code: "DEMO-RW-01",
      is_demo: true,
      name: "Wilayah Harmoni",
    },
    { onConflict: "code" },
  )
  .select("id")
  .single();

if (areaError) throw areaError;

for (const account of accounts) {
  const user = await ensureUser(account);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ display_name: account.displayName, role: account.role })
    .eq("id", user.id);
  if (profileError) throw profileError;

  const { error: membershipError } = await supabase
    .from("area_memberships")
    .upsert(
      {
        area_id: area.id,
        membership_type: account.membershipType,
        profile_id: user.id,
        verified_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,area_id,membership_type" },
    );
  if (membershipError) throw membershipError;
}

console.info("Demo users and the fictional demo area are ready.");
