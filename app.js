const supabaseUrl = "https://yjurcwctovgkkjszmhfk.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqdXJjd2N0b3Zna2tqc3ptaGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDk4MTYsImV4cCI6MjA4Nzc4NTgxNn0.4C8w531YXWRysRKX8YJkUlYY5YMWkLcteQ6vcP_p6Zo";
window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let selectedUser = null;

const bankUserId = "75f4c572-accb-41b2-baa2-4d86556f1ed2"
const AUTO_APPROVE_WINDOW_MS = 48 * 60 * 60 * 1000;
const EMAIL_NOTIFICATION_FUNCTION = "send-notification-email";

document.getElementById("pendingNavButton")
  .addEventListener("click", () => showScreen('pending'));

async function loadUsers() {
  const { data } = await supabaseClient
    .from("users")
    .select("*")
    .neq("id", bankUserId)
    .order("saldo", { ascending: false });

  const container = document.getElementById("userButtons");
  container.innerHTML = "";

  data.forEach((user, index) => {

    const btn = document.createElement("button");
    btn.className = "leaderboard-button";

    btn.innerHTML = `
      <div class="lb-rank">${index + 1}.</div>
      <div class="lb-name">${user.naam}</div>
      <div class="lb-saldo">${Number(user.saldo).toLocaleString("nl-BE")} ₳</div>
    `;

    btn.onclick = () => selectUser(user);

    container.appendChild(btn);
  });
}

function selectUser(user) {
  selectedUser = user;
  document.getElementById("selectedName").innerText = user.naam;
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("pinScreen").classList.remove("hidden");
}

function login() {
  const pin = document.getElementById("pinInput").value;

  if (pin === selectedUser.pincode) {
    currentUser = selectedUser;
    document.getElementById("pinScreen").classList.add("hidden");
    document.getElementById("appScreen").classList.remove("hidden");
    initApp();
    updateNotificationBadge();
  } else {
    alert("Verkeerde pincode");
  }
  updateBankLimitIndicator();
}

function logout() {
    document.getElementById("appScreen").classList.add("hidden");
    document.getElementById("loginScreen").classList.remove("hidden");
    initApp();
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
  document.getElementById(name).classList.remove("hidden");
  updateNotificationBadge();
  updateBankLimitIndicator();
}

async function triggerEmailNotification(eventType, transactionId) {
  if (!transactionId) return;

  try {
    const { error } = await supabaseClient.functions.invoke(
      EMAIL_NOTIFICATION_FUNCTION,
      {
        body: { eventType, transactionId }
      }
    );

    if (error) {
      console.error("Email notification failed:", error);
    }
  } catch (error) {
    console.error("Email notification request failed:", error);
  }
}

function getRemainingAutoApproveMs(createdAt) {
  if (!createdAt) return 0;
  const createdAtMs = new Date(createdAt).getTime();
  const expiresAtMs = createdAtMs + AUTO_APPROVE_WINDOW_MS;
  return Math.max(0, expiresAtMs - Date.now());
}

function formatRemainingAutoApprove(ms) {
  if (ms <= 0) return "Nu";

  const totalMinutes = Math.ceil(ms / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}u`);
  parts.push(`${minutes}m`);

  return parts.join(" ");
}

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join("");
}

function updateCountdownLabels() {
  const labels = document.querySelectorAll(".tx-countdown");

  labels.forEach(label => {
    const createdAt = label.dataset.createdAt;
    const remainingMs = getRemainingAutoApproveMs(createdAt);
    label.textContent = formatRemainingAutoApprove(remainingMs);
  });
}

async function executeApprovedTransaction(tx) {
  await supabaseClient.rpc("increment_saldo", {
    user_id_input: tx.to_user,
    amount_input: tx.amount
  });

  await supabaseClient.rpc("increment_saldo", {
    user_id_input: tx.from_user,
    amount_input: -tx.amount
  });

  await supabaseClient
    .from("approvals")
    .update({ decision: "expired" })
    .eq("transaction_id", tx.id)
    .eq("decision", "pending");
}

async function processExpiredPendingTransactions() {
  const cutoffDate = new Date(Date.now() - AUTO_APPROVE_WINDOW_MS).toISOString();

  const { data: expiredTransactions, error } = await supabaseClient
    .from("transactions")
    .select("*")
    .eq("status", "pending")
    .lte("created_at", cutoffDate);

  if (error || !expiredTransactions || expiredTransactions.length === 0) return;

  for (let tx of expiredTransactions) {
    const { data: updatedTx } = await supabaseClient
      .from("transactions")
      .update({ status: "approved" })
      .eq("id", tx.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (!updatedTx) continue;

    await executeApprovedTransaction(updatedTx);
  }
}

async function initApp() {
  await processExpiredPendingTransactions();
  await loadHome();
  await loadNewTransaction();
  await loadPending();

  if (currentUser) {
    await loadHistory();
  }
}

async function loadHome() {
  const { data } = await supabaseClient
    .from("users")
    .select("*")
    .neq("id", bankUserId)
    .order("saldo", { ascending: false });

  const home = document.getElementById("home");
  home.innerHTML = "";

  document.getElementById("userCredits").innerText =
  `${currentUser.saldo.toLocaleString("nl-BE")} ₳`;

  data.forEach((user, index) => {
    const btn = document.createElement("button");
    btn.className = "leaderboard-button";
    btn.innerHTML = `
      <div class="lb-rank">${index + 1}.</div>
      <div class="lb-name">${user.naam}</div>
      <div class="lb-saldo">₳ ${Number(user.saldo).toLocaleString("nl-BE")}</div>
    `;
    btn.onclick = () => openCreditPopup(user);
    home.appendChild(btn);
  });
  updateBankLimitIndicator();
}

let targetUser = null;

function openCreditPopup(user) {
  targetUser = user;
  if (targetUser.id === currentUser.id) return;
  document.getElementById("popupTitle").innerText = `Wijzig credits van ${user.naam}`;
  document.getElementById("creditAction").value = "add";
  document.getElementById("creditAmount").value = "1";
  document.getElementById("creditReason").value = "";
  document.getElementById("creditPopup").classList.remove("hidden");
}

function closePopup() {
  targetUser = null;
  document.getElementById("creditPopup").classList.add("hidden");
}

async function submitCreditChange() {
  const action = document.getElementById("creditAction").value;
  const amount = parseInt(document.getElementById("creditAmount").value);
  const reason = document.getElementById("creditReason").value.trim();

  if (!reason) {
    alert("Reden invullen is verplicht");
    return;
  }

  const signedAmount = action === "add" ? amount : -amount;

  // Insert transaction van bank naar targetUser
  const { data: txData, error: txError } = await supabaseClient
    .from("transactions")
    .insert([{
      from_user: bankUserId,
      to_user: targetUser.id,
      amount: signedAmount,
      reason: reason,
      status: "pending",
      created_by: currentUser.id,
      type: "bank"
    }])
    .select()
    .single();

  if (txError) {
    alert("Fout bij aanmaken transactie");
    return;
  }

  // Jury selecteren zoals bij normale transacties
  const { data: users } = await supabaseClient.from("users").select("*");
  const reviewers = pickRandomReviewers(users, [currentUser.id, targetUser.id, bankUserId], 3);

  const approvalRows = reviewers.map(r => ({
    transaction_id: txData.id,
    reviewer_id: r.id,
    decision: "pending"
  }));

  await supabaseClient.from("approvals").insert(approvalRows);

  void triggerEmailNotification("transaction_created", txData.id);

  closePopup();
  await loadPending();
  await loadHistory();
  updateBankLimitIndicator();
}

async function loadNewTransaction() {
  const { data } = await supabaseClient.from("users").select("*").neq("id", bankUserId);

  const newDiv = document.getElementById("new");
  newDiv.innerHTML = `
    <section class="newtx-card">
      <div class="newtx-header">
        <h2>Nieuwe Transactie</h2>
        <p>Kies een ontvanger, vul bedrag en reden in.</p>
      </div>

      <div class="newtx-form">
        <label class="newtx-label" for="toUser">Ontvanger</label>
        <select id="toUser"></select>

        <label class="newtx-label" for="amount">Bedrag</label>
        <div class="newtx-amount-wrap">
          <input type="number" id="amount" placeholder="0" min="1" step="1">
          <span class="newtx-currency">₳</span>
        </div>

        <label class="newtx-label" for="reason">Reden</label>
        <textarea id="reason" placeholder="Beschrijf kort waarom deze transactie nodig is"></textarea>

        <button class="newtx-submit" onclick="createTransaction()">Transactie versturen</button>
      </div>
    </section>
  `;

  const select = document.getElementById("toUser");
  select.innerHTML = `<option value="" disabled selected>Kies een ontvanger</option>`;

  data.forEach(user => {
    if (user.id !== currentUser.id) {
      select.innerHTML += `<option value="${user.id}">${user.naam}</option>`;
    }
  });
}

function pickRandomReviewers(users, excludeIds, count = 3) {
  const eligible = users.filter(u => !excludeIds.includes(u.id));

  // Shuffle
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }

  return eligible.slice(0, Math.min(count, eligible.length));
}

function ensureTransactionSuccessPopup() {
  if (document.getElementById("txSuccessPopup")) return;

  const popup = document.createElement("div");
  popup.id = "txSuccessPopup";
  popup.className = "hidden";
  popup.innerHTML = `
    <div id="txSuccessContent">
      <h3>Transactie verzonden</h3>
      <p>Je aanvraag is ingediend en wacht op beoordeling.</p>
      <div class="tx-success-subtitle">Toegewezen beoordelaars</div>
      <ul id="txSuccessReviewers"></ul>
      <button onclick="closeTransactionSuccessPopup()">Sluiten</button>
    </div>
  `;

  document.body.appendChild(popup);
}

function closeTransactionSuccessPopup() {
  const popup = document.getElementById("txSuccessPopup");
  if (!popup) return;
  popup.classList.add("hidden");
}

function showTransactionSuccessPopup(reviewers) {
  ensureTransactionSuccessPopup();

  const popup = document.getElementById("txSuccessPopup");
  const list = document.getElementById("txSuccessReviewers");

  if (!popup || !list) return;

  list.innerHTML = "";

  reviewers.forEach((reviewer, index) => {
    const li = document.createElement("li");
    li.textContent = `${index + 1}. ${reviewer.naam}`;
    list.appendChild(li);
  });

  popup.classList.remove("hidden");
}

async function createTransaction() {
  const toUser = document.getElementById("toUser").value;
  const amount = parseInt(document.getElementById("amount").value);
  const reason = document.getElementById("reason").value;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { count, error } = await supabaseClient
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("from_user", currentUser.id)
    .eq("type", "bank")
    .gte("created_at", sevenDaysAgo.toISOString());

  if (count >= 5) {
    alert("Je mag maximaal 5 banktransacties doen per 7 dagen.");
    return;
  }

  if (!toUser || !amount || !reason) {
    alert("Vul ontvanger, bedrag en reden volledig in.");
    return;
  }
  if (amount <= 0) {
    alert("Gebruik een strikt positief bedrag.");
    return;
  }

  //Insert transaction
  const { data: txData, error: txError } = await supabaseClient
    .from("transactions")
    .insert([{
      from_user: currentUser.id,
      to_user: toUser,
      amount: amount,
      reason: reason,
      status: "pending",
      created_by: currentUser.id,
      type: "standard"
    }])
    .select()
    .single();

  if (txError) {
    alert("Er is een fout opgetreden, probeer later opnieuw.");
    return;
  }

  //Haal alle users op
  const { data: users } = await supabaseClient.from("users").select("*");

  //Kies random jury (3 personen)
  const reviewers = pickRandomReviewers(
    users,
    [currentUser.id, toUser, bankUserId],
    3
  ); 

  //Maak approval records aan
  const approvalRows = reviewers.map(r => ({
    transaction_id: txData.id,
    reviewer_id: r.id,
    decision: "pending"
  }));

  await supabaseClient.from("approvals").insert(approvalRows);
  void triggerEmailNotification("transaction_created", txData.id);
  
  // Reset form
  document.getElementById("toUser").selectedIndex = 0;
  document.getElementById("amount").value = "";
  document.getElementById("reason").value = "";

  showTransactionSuccessPopup(reviewers);

  loadPending();
  loadHistory();
  updateBankLimitIndicator();
}

async function loadHistory() {

  await processExpiredPendingTransactions();

  const { data: transactions } = await supabaseClient
    .from("transactions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const historyDiv = document.getElementById("history");
  historyDiv.innerHTML = `
    <section class="pending-section pending-section-active">
      <div class="pending-section-header">
        <h2>Actieve Transacties</h2>
        <span class="pending-section-chip">Live overzicht</span>
      </div>
      <div class="pending-section-content" id="historyContent"></div>
    </section>
  `;

  const historyContent = document.getElementById("historyContent");

  if (!transactions || transactions.length === 0) {
    historyContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">Geen actieve transacties</div>
        <div class="empty-state-subtitle">Nieuwe verzoeken verschijnen hier zodra ze worden ingediend.</div>
      </div>
    `;
    return;
  }

  const { data: users } = await supabaseClient
      .from("users")
      .select("id, naam");

  for (let tx of transactions) {

    const { data: approvals } = await supabaseClient
      .from("approvals")
      .select("*")
      .eq("transaction_id", tx.id);

    const userMap = {};
    users.forEach(u => userMap[u.id] = u.naam);

    const date = tx.created_at
      ? new Date(tx.created_at).toLocaleString("nl-BE")
      : "Onbekende datum";

    const rawAmount = Number(tx.amount);
    const isPenalty = rawAmount < 0;
    const displayAmount = Math.abs(rawAmount);
    const displayFrom = isPenalty ? userMap[tx.to_user] : userMap[tx.from_user];
    const displayTo = isPenalty ? userMap[tx.from_user] : userMap[tx.to_user];
    const amountBadgeClass = isPenalty
      ? "tx-amount-badge tx-amount-penalty"
      : "tx-amount-badge tx-amount-positive";
    const widgetClass = isPenalty
      ? "transaction-widget transaction-widget-penalty"
      : "transaction-widget";

    let juryHTML = `<div class="jury-grid">`;

    for (let approval of approvals) {

      const statusClass =
        approval.decision === "approved"
          ? "jury-approved"
          : approval.decision === "rejected"
          ? "jury-rejected"
          : "jury-pending";

      const reviewerName = userMap[approval.reviewer_id] || "Onbekend";
      const reviewerInitials = getInitials(reviewerName);

      juryHTML += `
        <div class="jury-chip ${statusClass}">
          <div class="jury-avatar">${reviewerInitials}</div>
          <div class="jury-name">${reviewerName}</div>
        </div>
      `;
    }

    juryHTML += `</div>`;

    historyContent.innerHTML += `
      <div class="${widgetClass}">

        <div class="tx-card-top">
          <div class="tx-route">
            <span class="tx-user">${displayFrom}</span>
            <span class="tx-arrow">→</span>
            <span class="tx-user">${displayTo}</span>
          </div>
          <div class="${amountBadgeClass}">${displayAmount.toLocaleString("nl-BE")} ₳</div>
        </div>

        <div class="tx-reason-box">
          ${tx.reason}
        </div>

        <div class="tx-meta-row">
          <div class="tx-meta-pill">
            Door ${userMap[tx.created_by]}
          </div>
          <div class="tx-meta-pill tx-meta-pill-highlight tx-meta-pill-right">
            <span class="tx-meta-label">Resterend</span>
            <span class="tx-countdown" data-created-at="${tx.created_at || ""}"></span>
          </div>
        </div>

        ${isPenalty ? `<div class="tx-penalty-note">− Inhouding</div>` : ""}

        <div class="jury-title">
          --- Beoordelingscomité ---
        </div>

        ${juryHTML}

        <div class="tx-published">
          Geplaatst op ${date}
        </div>

      </div>
    `;
  }
  updateCountdownLabels();
  updateNotificationBadge();
}

async function loadPending() {

  await processExpiredPendingTransactions();

  const { data: approvals } = await supabaseClient
    .from("approvals")
    .select("*")
    .eq("reviewer_id", currentUser.id)
    .eq("decision", "pending");

  const pending = document.getElementById("pendingList");
  const reviewCount = approvals ? approvals.length : 0;
  pending.innerHTML = `
    <section class="pending-section pending-section-review">
      <div class="pending-section-header">
        <h2>Te Beoordelen Transacties</h2>
        <span class="pending-section-chip">${reviewCount}</span>
      </div>
      <div class="pending-section-content" id="pendingReviewContent"></div>
    </section>
  `;

  const pendingReviewContent = document.getElementById("pendingReviewContent");

  if (!approvals || approvals.length === 0) {
    pendingReviewContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">Alles verwerkt</div>
        <div class="empty-state-subtitle">Je hebt momenteel geen transacties die op jouw beoordeling wachten.</div>
      </div>
    `;
    return;
  }

  // users één keer ophalen
  const { data: users } = await supabaseClient
    .from("users")
    .select("id, naam");

  const userMap = {};
  users.forEach(u => userMap[u.id] = u.naam);

  for (let approval of approvals) {
    const { data: tx } = await supabaseClient
      .from("transactions")
      .select("*")
      .eq("id", approval.transaction_id)
      .eq("status", "pending")
      .maybeSingle();

    if (!tx) continue;

    // Show negative amounts as red, swap sender/receiver, color as in Actieve Transacties
    let fromUser = userMap[tx.from_user];
    let toUser = userMap[tx.to_user];
    let amount = tx.amount;
    let amountClass = "tx-amount-badge tx-amount-review";
    if (amount < 0) {
      // Swap sender/receiver for negative
      [fromUser, toUser] = [toUser, fromUser];
      amount = Math.abs(amount);
      amountClass += " tx-amount-penalty";
    } else {
      amountClass += " tx-amount-positive";
    }

    pendingReviewContent.innerHTML += `
      <div class="transaction-widget pending-review-widget">
        <div class="tx-card-top">
          <div class="tx-route">
            <span class="tx-user">${fromUser}</span>
            <span class="tx-arrow">→</span>
            <span class="tx-user">${toUser}</span>
          </div>
          <span class="${amountClass}">${amount.toLocaleString("nl-BE")} ₳</span>
        </div>
        <div class="tx-meta-row">
          <span class="tx-meta-label">Verzocht door: ${userMap[tx.created_by]}</span>
        </div>
        <div class="tx-reason-box">${tx.reason}</div>
        <div class="pending-buttons">
          <button class="approve-btn" onclick="approve('${approval.id}')">Goedkeuren</button>
          <button class="reject-btn" onclick="reject('${approval.id}')">Afkeuren</button>
        </div>
      </div>
    `;
  }
}

async function approve(approvalId) {

  await supabaseClient
    .from("approvals")
    .update({ decision: "approved" })
    .eq("id", approvalId);

  const { data: approval } = await supabaseClient
    .from("approvals")
    .select("transaction_id")
    .eq("id", approvalId)
    .single();

  const transactionId = approval.transaction_id;

  const { data: allApprovals } = await supabaseClient
    .from("approvals")
    .select("decision")
    .eq("transaction_id", transactionId);

  const approvedCount = allApprovals.filter(a => a.decision === "approved").length;
  const rejectedCount = allApprovals.filter(a => a.decision === "rejected").length;

  // 2 approvals → uitvoeren
  if (approvedCount === 2) {

    const { data: tx } = await supabaseClient
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .eq("status", "pending")
      .maybeSingle();

    if (!tx) {
      await loadHome();
      await loadPending();
      await loadHistory();
      updateNotificationBadge();
      return;
    }

    const { data: updatedTx } = await supabaseClient
      .from("transactions")
      .update({ status: "approved" })
      .eq("id", transactionId)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (updatedTx) {
      await executeApprovedTransaction(updatedTx);
      await triggerEmailNotification("transaction_approved", updatedTx.id);
    }
  }

  // 2 rejects → afwijzen
  if (rejectedCount >= 2) {
    const { data: rejectedTx } = await supabaseClient
      .from("transactions")
      .update({ status: "rejected" })
      .eq("id", transactionId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (rejectedTx) {
      await triggerEmailNotification("transaction_rejected", rejectedTx.id);
    }
  }

  await loadHome();
  await loadPending();
  await loadHistory();
  updateNotificationBadge();
}

async function reject(approvalId) {

  await supabaseClient
    .from("approvals")
    .update({ decision: "rejected" })
    .eq("id", approvalId);

  const { data: approval } = await supabaseClient
    .from("approvals")
    .select("transaction_id")
    .eq("id", approvalId)
    .single();

  const { data: allApprovals } = await supabaseClient
    .from("approvals")
    .select("decision")
    .eq("transaction_id", approval.transaction_id);

  const rejectedCount = allApprovals.filter(a => a.decision === "rejected").length;

  if (rejectedCount >= 2) {
    const { data: rejectedTx } = await supabaseClient
      .from("transactions")
      .update({ status: "rejected" })
      .eq("id", approval.transaction_id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (rejectedTx) {
      await triggerEmailNotification("transaction_rejected", rejectedTx.id);
    }
  }

  await loadPending();
  await loadHistory();
  updateNotificationBadge();
}

async function updateNotificationBadge() {
  const { data, error } = await supabaseClient
    .from("approvals")
    .select("id", { count: "exact" })
    .eq("reviewer_id", currentUser.id)
    .eq("decision", "pending");

  if (error) return;

  const count = data.length;
  const badge = document.getElementById("pendingBadge");

  if (count > 0) {
    badge.innerText = count;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

async function updateBankLimitIndicator() {

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { count, error } = await supabaseClient
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("created_by", currentUser.id)
    .eq("type", "bank")
    .gte("created_at", sevenDaysAgo.toISOString());

  if (error) {
    console.error(error);
    return;
  }

  const remaining = 5 - count;

  const element = document.getElementById("bankLimitInfo");

  if (remaining <= 0) {
    element.textContent = "0/5 Acties";
    element.style.color = "var(--danger)";
  } else {
    element.textContent = remaining + "/5 Acties";
    element.style.color = "var(--warning)";
  }
}

loadUsers();
loadHistory();
setInterval(updateCountdownLabels, 60000);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(() => console.log('Service Worker registered'))
    .catch(err => console.log('Service Worker registration failed:', err));
}