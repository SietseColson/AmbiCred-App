const supabaseUrl = "https://yjurcwctovgkkjszmhfk.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqdXJjd2N0b3Zna2tqc3ptaGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDk4MTYsImV4cCI6MjA4Nzc4NTgxNn0.4C8w531YXWRysRKX8YJkUlYY5YMWkLcteQ6vcP_p6Zo";
window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let selectedUser = null;

async function loadUsers() {
  const { data } = await supabaseClient.from("users").select("*").order("saldo", { ascending: false });

  const container = document.getElementById("userButtons");
  container.innerHTML = "";

  data.forEach((user, index) => {

    const btn = document.createElement("button");
    btn.className = "leaderboard-button";

    btn.innerHTML = `
      <div class="lb-rank">${index + 1}.</div>
      <div class="lb-name">${user.naam}</div>
      <div class="lb-saldo">${Number(user.saldo).toLocaleString("nl-BE")}</div>
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
  } else {
    alert("Verkeerde pincode");
  }
}

function logout() {
    document.getElementById("appScreen").classList.add("hidden");
    document.getElementById("loginScreen").classList.remove("hidden");
    initApp();
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
  document.getElementById(name).classList.remove("hidden");
}

async function initApp() {
  await loadHome();
  await loadNewTransaction();
  await loadPending();
  if (currentUser) {
    await loadHistory();
  }
}

async function loadHome() {
  const { data } = await supabaseClient.from("users").select("*").order("saldo", { ascending: false });

  const home = document.getElementById("home");
  home.innerHTML = "";

  document.getElementById("userCredits").innerText =
  `${currentUser.saldo.toLocaleString("nl-BE")} cr.`;

  data.forEach((user, index) => {
    const btn = document.createElement("button");
    btn.className = "leaderboard-button";
    btn.innerHTML = `
      <div class="lb-rank">${index + 1}.</div>
      <div class="lb-name">${user.naam}</div>
      <div class="lb-saldo">${Number(user.saldo).toLocaleString("nl-BE")}</div>
    `;
    btn.onclick = () => openCreditPopup(user);
    home.appendChild(btn);
  });
}

let targetUser = null;

function openCreditPopup(user) {
  targetUser = user;
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

const bankUserId = "75f4c572-accb-41b2-baa2-4d86556f1ed2"

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
      created_by: currentUser.id
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

  closePopup();
  alert("Transactie is ingediend en wacht op goedkeuring");
  await loadPending();
  await loadHistory();
}

async function loadNewTransaction() {
  const { data } = await supabaseClient.from("users").select("*");

  const newDiv = document.getElementById("new");
  newDiv.innerHTML = `
    <h2>Verzoek Transactie</h2>
    <select id="toUser"></select>
    <input type="number" id="amount" placeholder="Bedrag">
    <input type="text" id="reason" placeholder="Reden">
    <button onclick="createTransaction()">Verstuur</button>
  `;

  const select = document.getElementById("toUser");

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

async function createTransaction() {
  const toUser = document.getElementById("toUser").value;
  const amount = parseInt(document.getElementById("amount").value);
  const reason = document.getElementById("reason").value;

  if (!amount || !reason) {
    alert("Een of meer velden zijn leeg, bitch.");
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
      created_by: currentUser.id
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
    [currentUser.id, toUser],
    3
  ); 

  //Maak approval records aan
  const approvalRows = reviewers.map(r => ({
    transaction_id: txData.id,
    reviewer_id: r.id,
    decision: "pending"
  }));

  await supabaseClient.from("approvals").insert(approvalRows);

  alert("Transactie verzocht");
  
  // Reset form
  document.getElementById("amount").value = "";
  document.getElementById("reason").value = "";

  loadPending();
  loadHistory();
}

async function loadHistory() {

  const { data: transactions } = await supabaseClient
    .from("transactions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const historyDiv = document.getElementById("history");
  historyDiv.innerHTML = "<h2>Actieve Transacties</h2>";

  if (!transactions || transactions.length === 0) {
    historyDiv.innerHTML += "<p>Momenteel geen actieve transacties.</p>";
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
      ? new Date(tx.created_at).toLocaleString()
      : "Onbekende datum";

    let juryHTML = `<div class="jury-bar">`;

    for (let approval of approvals) {

      const statusClass =
        approval.decision === "approved"
          ? "jury-approved"
          : approval.decision === "rejected"
          ? "jury-rejected"
          : "jury-pending";

      juryHTML += `
        <div class="jury-box ${statusClass}">
          ${userMap[approval.reviewer_id]}
        </div>
      `;
    }

    juryHTML += `</div>`;

    historyDiv.innerHTML += `
      <div class="transaction-widget">
        <div class="tx-line1">
          ${userMap[tx.from_user]} → ${userMap[tx.to_user]}
        </div>

        <div class="tx-line1">
          <strong>${tx.amount.toLocaleString("nl-BE")} cr.</strong>
        </div>
        <div class="tx-line2">
          ${tx.reason}
        </div>
        ${juryHTML}
      </div>
    `;
  }
}

async function loadPending() {

  const { data: approvals } = await supabaseClient
    .from("approvals")
    .select("*")
    .eq("reviewer_id", currentUser.id)
    .eq("decision", "pending");

  const pending = document.getElementById("pendingList");
  pending.innerHTML = "<h2>Te Beoordelen Transacties</h2>";

  if (!approvals || approvals.length === 0) {
    pending.innerHTML += "<p>Geen openstaande beoordelingen.</p>";
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

    pending.innerHTML += `
      <div class="transaction-widget">

        <div class="tx-line1">
          ${userMap[tx.from_user]} → ${userMap[tx.to_user]}
        </div>

        <div class="tx-line1">
          <strong>${tx.amount.toLocaleString("nl-BE")} cr.</strong>
        </div>

        <div class="tx-line2">
          ${tx.reason}
        </div>

        <div class="pending-buttons">
          <button onclick="approve('${approval.id}')">Approve</button>
          <button class="reject" onclick="reject('${approval.id}')">Reject</button>
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

  // 3 approvals → uitvoeren
  if (approvedCount === 2) {

    const { data: tx } = await supabaseClient
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    await supabaseClient
      .from("transactions")
      .update({ status: "approved" })
      .eq("id", transactionId);

    await supabaseClient.rpc("increment_saldo", {
      user_id_input: tx.to_user,
      amount_input: tx.amount
    });

    await supabaseClient.rpc("increment_saldo", {
      user_id_input: tx.from_user,
      amount_input: -tx.amount
    });
  }

  // 2 rejects → afwijzen
  if (rejectedCount >= 2) {
    await supabaseClient
      .from("transactions")
      .update({ status: "rejected" })
      .eq("id", transactionId);
  }

  await loadHome();
  await loadPending();
  await loadHistory();
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
    await supabaseClient
      .from("transactions")
      .update({ status: "rejected" })
      .eq("id", approval.transaction_id);
  }

  await loadPending();
  await loadHistory();
}

loadUsers();
loadHistory();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(() => console.log('Service Worker registered'))
    .catch(err => console.log('Service Worker registration failed:', err));
}