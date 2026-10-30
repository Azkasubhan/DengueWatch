import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

assert(
  url && publishableKey && secretKey,
  "Local Supabase credentials are required.",
);

const parsedUrl = new URL(url);
assert(
  ["127.0.0.1", "localhost"].includes(parsedUrl.hostname),
  "Live M2 verification is restricted to local Supabase.",
);

const admin = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

function userClient(options = {}) {
  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: Boolean(options.storage),
      flowType: options.flowType ?? "implicit",
      storage: options.storage,
    },
  });
}

function strongPassword() {
  return `Dw-${randomBytes(18).toString("base64url")}Aa1!`;
}

let checks = 0;
async function check(name, operation) {
  await operation();
  checks += 1;
  console.info(`ok ${checks} - ${name}`);
}

async function findUser(email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    assert.ifError(error);
    const user = data.users.find((candidate) => candidate.email === email);
    if (user) return user;
    if (data.users.length < 100) return null;
  }
  throw new Error("User lookup exceeded the safe pagination limit.");
}

async function login(email, password) {
  const client = userClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  assert.ifError(error);
  assert(data.session && data.user, `Expected a real session for ${email}.`);
  return client;
}

function ids(rows) {
  return rows.map((row) => row.id).sort();
}

const runId = `${Date.now()}-${randomBytes(4).toString("hex")}`;
const registrationEmail = `m2.verify.${runId}@example.test`;
const initialPassword = strongPassword();
const recoveredPassword = strongPassword();
let registeredUserId;
let temporaryCadreId;

try {
  const registrationClient = userClient();

  await check("resident registration returns a real Auth session", async () => {
    const { data, error } = await registrationClient.auth.signUp({
      email: registrationEmail,
      password: initialPassword,
      options: { data: { display_name: "M2 Live Resident" } },
    });
    assert.ifError(error);
    assert(data.session && data.user);
    registeredUserId = data.user.id;
  });

  await check("profile trigger creates a resident profile", async () => {
    const { data, error } = await registrationClient
      .from("profiles")
      .select("id,display_name,role")
      .single();
    assert.ifError(error);
    assert.equal(data.id, registeredUserId);
    assert.equal(data.role, "resident");
    assert.equal(data.display_name, "M2 Live Resident");
  });

  await check(
    "new resident has pending membership and no area access",
    async () => {
      const [memberships, areas] = await Promise.all([
        registrationClient.from("area_memberships").select("id"),
        registrationClient.from("areas").select("id"),
      ]);
      assert.ifError(memberships.error);
      assert.ifError(areas.error);
      assert.deepEqual(memberships.data, []);
      assert.deepEqual(areas.data, []);
    },
  );

  await check("wrong password is rejected", async () => {
    const { error } = await userClient().auth.signInWithPassword({
      email: registrationEmail,
      password: `${initialPassword}-wrong`,
    });
    assert(error);
  });

  const storage = memoryStorage();
  const persistentClient = userClient({ storage });

  await check("correct password creates a persistent session", async () => {
    const { data, error } = await persistentClient.auth.signInWithPassword({
      email: registrationEmail,
      password: initialPassword,
    });
    assert.ifError(error);
    assert(data.session);

    const restoredClient = userClient({ storage });
    const restored = await restoredClient.auth.getSession();
    assert.ifError(restored.error);
    assert.equal(restored.data.session?.user.id, registeredUserId);
  });

  await check("refresh token produces a valid refreshed session", async () => {
    const { data, error } = await persistentClient.auth.refreshSession();
    assert.ifError(error);
    assert.equal(data.session?.user.id, registeredUserId);
  });

  await check("logout clears the persisted session", async () => {
    const { error } = await persistentClient.auth.signOut();
    assert.ifError(error);
    const session = await persistentClient.auth.getSession();
    assert.ifError(session.error);
    assert.equal(session.data.session, null);
  });

  await check("anonymous requests cannot read private tables", async () => {
    const anonymous = userClient();
    const [profiles, memberships] = await Promise.all([
      anonymous.from("profiles").select("id"),
      anonymous.from("area_memberships").select("id"),
    ]);
    assert(profiles.error);
    assert(memberships.error);
  });

  const demoAccounts = [
    { email: "warga.simulasi@denguewatch.test", role: "resident" },
    { email: "kader.satu@denguewatch.test", role: "cadre" },
    { email: "kader.dua@denguewatch.test", role: "cadre" },
    { email: "pengelola.simulasi@denguewatch.test", role: "manager" },
  ];
  const demoPassword = process.env.DEMO_ACCOUNT_PASSWORD;
  assert(
    demoPassword && !/replace|placeholder/i.test(demoPassword),
    "A non-placeholder DEMO_ACCOUNT_PASSWORD is required.",
  );
  const demoUsers = new Map();

  for (const account of demoAccounts) {
    const user = await findUser(account.email);
    assert(user, `Missing seeded account: ${account.email}`);
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      password: demoPassword,
    });
    assert.ifError(error);
    demoUsers.set(account.email, user);
  }

  const resident = demoUsers.get("warga.simulasi@denguewatch.test");
  const cadreA = demoUsers.get("kader.satu@denguewatch.test");
  const manager = demoUsers.get("pengelola.simulasi@denguewatch.test");
  assert(resident && cadreA && manager);

  const areaAResult = await admin
    .from("areas")
    .select("id")
    .eq("code", "DEMO-RW-01")
    .single();
  assert.ifError(areaAResult.error);
  const areaA = areaAResult.data.id;

  const areaBResult = await admin
    .from("areas")
    .upsert(
      { code: "M2-LIVE-B", is_demo: true, name: "Wilayah M2 B (Simulasi)" },
      { onConflict: "code" },
    )
    .select("id")
    .single();
  assert.ifError(areaBResult.error);
  const areaB = areaBResult.data.id;

  const temporaryCadreEmail = `m2.cadre.${runId}@example.test`;
  const temporaryCadre = await admin.auth.admin.createUser({
    email: temporaryCadreEmail,
    email_confirm: true,
    password: demoPassword,
    user_metadata: { display_name: "M2 Live Cadre B" },
  });
  assert.ifError(temporaryCadre.error);
  assert(temporaryCadre.data.user);
  temporaryCadreId = temporaryCadre.data.user.id;

  const promoteCadre = await admin
    .from("profiles")
    .update({ role: "cadre" })
    .eq("id", temporaryCadreId);
  assert.ifError(promoteCadre.error);

  const assignCadre = await admin.from("area_memberships").insert({
    area_id: areaB,
    membership_type: "assigned_cadre",
    profile_id: temporaryCadreId,
    verified_at: new Date().toISOString(),
  });
  assert.ifError(assignCadre.error);

  const residentClient = await login(resident.email, demoPassword);
  const cadreAClient = await login(cadreA.email, demoPassword);
  const cadreBClient = await login(temporaryCadreEmail, demoPassword);
  const managerClient = await login(manager.email, demoPassword);

  await check(
    "resident can read only their own profile and assigned area",
    async () => {
      const profiles = await residentClient.from("profiles").select("id");
      const areas = await residentClient.from("areas").select("id");
      assert.ifError(profiles.error);
      assert.ifError(areas.error);
      assert.deepEqual(ids(profiles.data), [resident.id]);
      assert.deepEqual(ids(areas.data), [areaA]);

      const other = await residentClient
        .from("profiles")
        .select("id")
        .eq("id", cadreA.id);
      assert.ifError(other.error);
      assert.deepEqual(other.data, []);
    },
  );

  await check("resident cannot self-promote or self-approve", async () => {
    const promotion = await residentClient
      .from("profiles")
      .update({ role: "manager" })
      .eq("id", resident.id);
    assert(promotion.error);

    const approval = await residentClient
      .from("area_memberships")
      .update({ verified_at: new Date().toISOString() })
      .eq("profile_id", resident.id);
    assert(approval.error);
  });

  await check(
    "cadre sessions are isolated to their assigned areas",
    async () => {
      const first = await cadreAClient.from("areas").select("id");
      const second = await cadreBClient.from("areas").select("id");
      assert.ifError(first.error);
      assert.ifError(second.error);
      assert.deepEqual(ids(first.data), [areaA]);
      assert.deepEqual(ids(second.data), [areaB]);
    },
  );

  await check(
    "manager sees only managed area and cannot verify memberships",
    async () => {
      const areas = await managerClient.from("areas").select("id");
      assert.ifError(areas.error);
      assert.deepEqual(ids(areas.data), [areaA]);

      const approval = await managerClient
        .from("area_memberships")
        .update({ verified_at: new Date().toISOString() })
        .eq("profile_id", cadreA.id);
      assert(approval.error);
    },
  );

  await check(
    "password recovery email, PKCE exchange, and new-password login succeed",
    async () => {
      const recoveryClient = userClient({
        flowType: "pkce",
        storage: memoryStorage(),
      });
      const { error } = await recoveryClient.auth.resetPasswordForEmail(
        registrationEmail,
        {
          redirectTo:
            "http://localhost:3000/auth/callback?next=/atur-ulang-kata-sandi",
        },
      );
      assert.ifError(error);

      let message;
      for (let attempt = 0; attempt < 20 && !message; attempt += 1) {
        const response = await fetch("http://127.0.0.1:54324/api/v1/messages");
        assert(response.ok);
        const mailbox = await response.json();
        message = mailbox.messages?.find((candidate) =>
          JSON.stringify(candidate).includes(registrationEmail),
        );
        if (!message) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
      assert(message, "Recovery email did not reach local Mailpit.");

      const detailResponse = await fetch(
        `http://127.0.0.1:54324/api/v1/message/${message.ID}`,
      );
      assert(detailResponse.ok);
      const detail = await detailResponse.json();
      const body = `${detail.HTML ?? ""}\n${detail.Text ?? ""}`.replaceAll(
        "&amp;",
        "&",
      );
      const recoveryLink = body
        .match(/https?:\/\/[^\s"'<>]+/g)
        ?.find((candidate) => candidate.includes("/auth/v1/verify"));
      assert(recoveryLink, "Recovery verification link was not present.");

      const verification = await fetch(recoveryLink, { redirect: "manual" });
      assert([302, 303].includes(verification.status));
      const location = verification.headers.get("location");
      assert(location);
      const callback = new URL(location);
      const code = callback.searchParams.get("code");
      assert(code, "Recovery callback did not contain a PKCE code.");

      const exchange = await recoveryClient.auth.exchangeCodeForSession(code);
      assert.ifError(exchange.error);
      assert.equal(exchange.data.user?.id, registeredUserId);

      const update = await recoveryClient.auth.updateUser({
        password: recoveredPassword,
      });
      assert.ifError(update.error);

      const recoveredLogin = await userClient().auth.signInWithPassword({
        email: registrationEmail,
        password: recoveredPassword,
      });
      assert.ifError(recoveredLogin.error);
      assert.equal(recoveredLogin.data.user?.id, registeredUserId);
    },
  );

  console.info(`Live M2 verification passed: ${checks} checks.`);
} finally {
  if (registeredUserId) {
    const { error } = await admin.auth.admin.deleteUser(registeredUserId);
    if (error) {
      console.warn("Live test user cleanup failed.");
    }
  }
  if (temporaryCadreId) {
    const { error } = await admin.auth.admin.deleteUser(temporaryCadreId);
    if (error) {
      console.warn("Temporary cadre cleanup failed.");
    }
  }
}
