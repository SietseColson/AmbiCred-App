const supabaseUrl = "https://yjurcwctovgkkjszmhfk.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqdXJjd2N0b3Zna2tqc3ptaGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDk4MTYsImV4cCI6MjA4Nzc4NTgxNn0.4C8w531YXWRysRKX8YJkUlYY5YMWkLcteQ6vcP_p6Zo";
window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let selectedUser = null;

async function loadUsers() {
  const { data } = await supabaseClient.from("users").select("*");

  const container = document.getElementById("userButtons");
  container.innerHTML = "";

  data.forEach(user => {
    const btn = document.createElement("button");
    btn.className = "user-button";
    btn.innerText = user.naam;
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
  const { data } = await supabaseClient.from("users").select("*");

  const home = document.getElementById("home");
  home.innerHTML = "";

  data.forEach(user => {
    home.innerHTML += `<div>${user.naam}: ${user.saldo} credits</div>`;
  });
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
    .order("created_at", { ascending: false });

  if (error) {
    console.error("History error:", error);
    return;
  }

  const historyDiv = document.getElementById("history");
  historyDiv.innerHTML = "<h2>Actieve Transacties</h2>";

  if (!transactions || transactions.length === 0) {
    historyDiv.innerHTML += "<p>Momenteel geen actieve transacties.</p>";
    return;
  }

  for (let tx of transactions) {

    // Haal users op
    const { data: fromUser } = await supabaseClient
      .from("users")
      .select("naam")
      .eq("id", tx.from_user)
      .single();

    const { data: toUser } = await supabaseClient
      .from("users")
      .select("naam")
      .eq("id", tx.to_user)
      .single();

    // Haal approvals op
    const { data: approvals } = await supabaseClient
      .from("approvals")
      .select("*")
      .eq("transaction_id", tx.id);

    // Format datum
    const date = tx.created_at
      ? new Date(tx.created_at).toLocaleString()
      : "Onbekende datum";

    // Bouw jury balk
    let juryHTML = `<div class="jury-bar">`;

    for (let approval of approvals) {

      const { data: reviewer } = await supabaseClient
        .from("users")
        .select("naam")
        .eq("id", approval.reviewer_id)
        .single();

      const statusClass =
        approval.decision === "approved"
          ? "jury-approved"
          : approval.decision === "rejected"
          ? "jury-rejected"
          : "jury-pending";

      juryHTML += `
        <div class="jury-box ${statusClass}">
          ${reviewer.naam}
        </div>
      `;
    }

    juryHTML += `</div>`;

    historyDiv.innerHTML += `
      <div class="transaction-widget">
        <div class="tx-line1">
          ${date} — ${fromUser.naam} → ${toUser.naam} — <strong>${tx.amount} credits</strong>
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

  const pending = document.getElementById("pending");
  pending.innerHTML = "<h2>Te Beoordelen Transacties</h2>";

  if (!approvals || approvals.length === 0) {
    pending.innerHTML += "<p>Geen openstaande beoordelingen.</p>";
    return;
  }

  for (let approval of approvals) {

    const { data: tx } = await supabaseClient
      .from("transactions")
      .select("*")
      .eq("id", approval.transaction_id)
      .single();

    pending.innerHTML += `
      <div>
        ${tx.amount} credits <i>${tx.reason}</i>
        <button onclick="approve('${approval.id}')">Approve</button>
        <button onclick="reject('${approval.id}')">Reject</button>
      </div>
    `;
  }
}

async function approve(approvalId) {

  //Update deze approval
  await supabaseClient
    .from("approvals")
    .update({ decision: "approved" })
    .eq("id", approvalId);

  //Haal approval record op
  const { data: approval } = await supabaseClient
    .from("approvals")
    .select("*")
    .eq("id", approvalId)
    .single();

  const transactionId = approval.transaction_id;

  //Check alle approvals van deze transactie
  const { data: allApprovals } = await supabaseClient
    .from("approvals")
    .select("*")
    .eq("transaction_id", transactionId);

  const allApproved = allApprovals.every(a => a.decision === "approved");

  if (allApproved) {

    //Haal transactie op
    const { data: tx } = await supabaseClient
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    //Update transaction status
    await supabaseClient
      .from("transactions")
      .update({ status: "approved" })
      .eq("id", transactionId);

    //Update saldo
    const { data: toUser } = await supabaseClient
      .from("users")
      .select("*")
      .eq("id", tx.to_user)
      .single();

    const { data: fromUser } = await supabaseClient
      .from("users")
      .select("*")
      .eq("id", tx.from_user)
      .single();

    await supabaseClient
      .from("users")
      .update({ saldo: toUser.saldo + tx.amount })
      .eq("id", tx.to_user);

    await supabaseClient
      .from("users")
      .update({ saldo: fromUser.saldo - tx.amount })
      .eq("id", tx.from_user);
  }

  loadHome();
  loadPending();
  loadHistory();
}

async function reject(approvalId) {

  //Haal approval op
  const { data: approval } = await supabaseClient
    .from("approvals")
    .select("*")
    .eq("id", approvalId)
    .single();

  const transactionId = approval.transaction_id;

  //Update deze approval
  await supabaseClient
    .from("approvals")
    .update({ decision: "rejected" })
    .eq("id", approvalId);

  //Zet volledige transactie op rejected
  await supabaseClient
    .from("transactions")
    .update({ status: "rejected" })
    .eq("id", transactionId);

  loadPending();
  loadHistory();
}

loadUsers();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(() => console.log('Service Worker registered'))
    .catch(err => console.log('Service Worker registration failed:', err));
}