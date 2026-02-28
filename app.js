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
  loadHome();
  loadNewTransaction();
  loadPending();
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

async function createTransaction() {
  const toUser = document.getElementById("toUser").value;
  const amount = parseInt(document.getElementById("amount").value);
  const reason = document.getElementById("reason").value;

  await supabaseClient.from("transactions").insert([{
    from_user: currentUser.id,
    to_user: toUser,
    amount: amount,
    reason: reason,
    status: "pending",
    created_by: currentUser.id
  }]);

  alert("Transactie Verzocht");
  loadPending();
}

async function loadPending() {
  const { data } = await supabaseClient
    .from("transactions")
    .select("*")
    .eq("status", "pending");

  const pending = document.getElementById("pending");
  pending.innerHTML = "<h2>Transacties In Behandeling</h2>";

  data.forEach(tx => {
    pending.innerHTML += `
      <div>
        ${tx.amount} credits <i>${tx.reason}</i>
        <button onclick="approve('${tx.id}')">Approve</button>
        <button onclick="reject('${tx.id}')">Reject</button>
      </div>
    `;
  });
}

async function approve(id) {
  const { data } = await supabaseClient.from("transactions").select("*").eq("id", id).single();

  await supabaseClient.from("transactions").update({ status: "approved" }).eq("id", id);

  const { data: toUser } = await supabaseClient.from("users").select("*").eq("id", data.to_user).single();
  const { data: fromUser } = await supabaseClient.from("users").select("*").eq("id", data.from_user).single();

  await supabaseClient.from("users").update({ saldo: toUser.saldo + data.amount }).eq("id", data.to_user);
  await supabaseClient.from("users").update({ saldo: fromUser.saldo - data.amount }).eq("id", data.from_user);

  loadHome();
  loadPending();
}

async function reject(id) {
  await supabaseClient.from("transactions").update({ status: "rejected" }).eq("id", id);
  loadPending();
}

loadUsers();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(() => console.log('Service Worker registered'))
    .catch(err => console.log('Service Worker registration failed:', err));
}