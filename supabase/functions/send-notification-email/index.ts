import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const bankUserId = "75f4c572-accb-41b2-baa2-4d86556f1ed2";
const appName = "AmbiCred";

type EventType = "transaction_created" | "transaction_approved" | "transaction_rejected";

type UserRecord = {
  id: string;
  naam: string | null;
  email: string | null;
};

type TransactionRecord = {
  id: string;
  from_user: string;
  to_user: string;
  created_by: string;
  amount: number;
  reason: string | null;
  status: string;
  type: string | null;
};

type ApprovalRecord = {
  reviewer_id: string;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function formatAmount(amount: number) {
  return `${new Intl.NumberFormat("nl-BE").format(Math.abs(amount))} ₳`;
}

function getDisplayRoute(tx: TransactionRecord, userMap: Map<string, UserRecord>) {
  const isPenalty = Number(tx.amount) < 0;
  const fromId = isPenalty ? tx.to_user : tx.from_user;
  const toId = isPenalty ? tx.from_user : tx.to_user;

  return {
    isPenalty,
    fromName: userMap.get(fromId)?.naam ?? "Onbekend",
    toName: userMap.get(toId)?.naam ?? "Onbekend"
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildEmailShell(title: string, intro: string, details: string, ctaLabel: string, appUrl: string) {
  return `
    <div style="font-family:Arial,sans-serif;background:#0f172a;padding:24px;color:#e2e8f0;">
      <div style="max-width:560px;margin:0 auto;background:#1e293b;border:1px solid #334155;border-radius:18px;padding:24px;">
        <div style="font-size:24px;font-weight:700;margin-bottom:12px;">${escapeHtml(title)}</div>
        <div style="font-size:15px;line-height:1.55;color:#cbd5e1;margin-bottom:18px;">${intro}</div>
        <div style="background:#0f172a;border:1px solid #334155;border-radius:14px;padding:16px;margin-bottom:20px;">
          ${details}
        </div>
        <a href="${appUrl}" style="display:inline-block;background:linear-gradient(180deg,#3b82f6,#2563eb);color:white;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:700;">${escapeHtml(ctaLabel)}</a>
      </div>
    </div>
  `;
}

function buildDetails(tx: TransactionRecord, userMap: Map<string, UserRecord>) {
  const route = getDisplayRoute(tx, userMap);
  const createdBy = userMap.get(tx.created_by)?.naam ?? "Onbekend";
  const reason = tx.reason?.trim() || "Geen reden opgegeven";
  const penaltyNote = route.isPenalty
    ? `<div style="color:#fca5a5;font-weight:700;margin-top:10px;">Inhouding</div>`
    : "";

  return `
    <div style="font-size:14px;color:#94a3b8;margin-bottom:8px;">Door ${escapeHtml(createdBy)}</div>
    <div style="font-size:16px;font-weight:700;color:#f8fafc;margin-bottom:8px;">${escapeHtml(route.fromName)} → ${escapeHtml(route.toName)}</div>
    <div style="font-size:15px;font-weight:700;color:${route.isPenalty ? "#fca5a5" : "#86efac"};margin-bottom:10px;">${escapeHtml(formatAmount(tx.amount))}</div>
    <div style="font-size:14px;line-height:1.55;color:#cbd5e1;">${escapeHtml(reason)}</div>
    ${penaltyNote}
  `;
}

function buildTemplate(eventType: EventType, tx: TransactionRecord, userMap: Map<string, UserRecord>, appUrl: string) {
  const details = buildDetails(tx, userMap);

  if (eventType === "transaction_created") {
    return {
      involved: {
        subject: "Nieuwe AmbiCred-transactie",
        html: buildEmailShell(
          "Nieuwe transactie in AmbiCred",
          "Er is een nieuwe transactie aangemaakt waarbij je betrokken bent.",
          details,
          "Open AmbiCred",
          appUrl
        ),
        text: "Er is een nieuwe transactie aangemaakt waarbij je betrokken bent. Open AmbiCred om de details te bekijken."
      },
      reviewer: {
        subject: "Je hebt een transactie te beoordelen",
        html: buildEmailShell(
          "Beoordeling gevraagd",
          "Er wacht een transactie op jouw beoordeling in AmbiCred.",
          details,
          "Open beoordelingsscherm",
          appUrl
        ),
        text: "Er wacht een transactie op jouw beoordeling in AmbiCred. Open de app om ze goed te keuren of af te keuren."
      }
    };
  }

  if (eventType === "transaction_approved") {
    return {
      involved: {
        subject: "Je AmbiCred-transactie is goedgekeurd",
        html: buildEmailShell(
          "Transactie goedgekeurd",
          "Goed nieuws: deze transactie is goedgekeurd en verwerkt.",
          details,
          "Bekijk in AmbiCred",
          appUrl
        ),
        text: "Je transactie is goedgekeurd en verwerkt in AmbiCred."
      }
    };
  }

  return {
    involved: {
      subject: "Je AmbiCred-transactie is afgekeurd",
      html: buildEmailShell(
        "Transactie afgekeurd",
        "Deze transactie is afgekeurd in AmbiCred.",
        details,
        "Bekijk in AmbiCred",
        appUrl
      ),
      text: "Je transactie is afgekeurd in AmbiCred. Open de app om de details te bekijken."
    }
  };
}

async function sendEmail({
  resendApiKey,
  from,
  to,
  subject,
  html,
  text,
  replyTo
}: {
  resendApiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
      reply_to: replyTo ? [replyTo] : undefined
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend error ${response.status}: ${errorText}`);
  }
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  const resendReplyTo = Deno.env.get("RESEND_REPLY_TO");
  const appUrl = Deno.env.get("APP_BASE_URL") ?? "https://example.com";

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !resendFromEmail) {
    return jsonResponse(500, {
      error: "Missing required environment variables"
    });
  }

  let payload: { eventType?: EventType; transactionId?: string };

  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const { eventType, transactionId } = payload;

  if (!eventType || !transactionId) {
    return jsonResponse(400, { error: "eventType and transactionId are required" });
  }

  if (!["transaction_created", "transaction_approved", "transaction_rejected"].includes(eventType)) {
    return jsonResponse(400, { error: "Unsupported eventType" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .select("id, from_user, to_user, created_by, amount, reason, status, type")
    .eq("id", transactionId)
    .single<TransactionRecord>();

  if (txError || !tx) {
    return jsonResponse(404, { error: "Transaction not found" });
  }

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, naam, email")
    .returns<UserRecord[]>();

  if (usersError || !users) {
    return jsonResponse(500, { error: "Could not load users" });
  }

  const userMap = new Map(users.map(user => [user.id, user]));
  const templates = buildTemplate(eventType, tx, userMap, appUrl);
  const sentTo = new Set<string>();
  const errors: string[] = [];

  const sendToUser = async (userId: string, type: "involved" | "reviewer") => {
    if (userId === bankUserId) return;

    const user = userMap.get(userId);
    const email = user?.email?.trim();

    if (!email || sentTo.has(`${type}:${email}`)) {
      return;
    }

    const template = templates[type];
    if (!template) return;

    try {
      await sendEmail({
        resendApiKey,
        from: resendFromEmail,
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        replyTo: resendReplyTo
      });
      sentTo.add(`${type}:${email}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${email}: ${message}`);
    }
  };

  if (eventType === "transaction_created") {
    await sendToUser(tx.from_user, "involved");
    await sendToUser(tx.to_user, "involved");
    await sendToUser(tx.created_by, "involved");

    const { data: approvals } = await supabase
      .from("approvals")
      .select("reviewer_id")
      .eq("transaction_id", transactionId)
      .returns<ApprovalRecord[]>();

    for (const approval of approvals ?? []) {
      await sendToUser(approval.reviewer_id, "reviewer");
    }
  }

  if (eventType === "transaction_approved" || eventType === "transaction_rejected") {
    await sendToUser(tx.from_user, "involved");
    await sendToUser(tx.to_user, "involved");
    await sendToUser(tx.created_by, "involved");
  }

  return jsonResponse(errors.length ? 207 : 200, {
    ok: errors.length === 0,
    app: appName,
    eventType,
    transactionId,
    sent: Array.from(sentTo),
    errors
  });
});
