let currentUser = null;
let currentTeam = null;

// Data structures
let matches = JSON.parse(localStorage.getItem('matches') || '[]');
let playerStats = JSON.parse(localStorage.getItem('playerStats') || '{}'); // {playerId: {avg, 180s, checkout...}}

function $(id) { return document.getElementById(id); }

// === PAGE SYSTEM ===
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  $(pageId)?.classList.remove('hidden');

  if (pageId === 'home') updateStats();
  if (pageId === 'rankings') showRankings();
  if (pageId === 'score-match') prepareMatchScoring();
  if (pageId === 'team') loadTeamDashboard();
  if (pageId === 'players') listPlayers();
}

// === AUTH & UI ===
function registerPlayer() {
  const name = $('player-name').value.trim();
  const email = $('player-email').value.trim();
  const nickname = $('player-nickname').value.trim() || name.split(' ')[0];

  if (!name || !email) return alert("Name and email required!");

  currentUser = { id: Date.now().toString(), name, email, nickname };
  localStorage.setItem('currentUser', JSON.stringify(currentUser));

  const players = JSON.parse(localStorage.getItem('players') || '[]');
  if (!players.find(p => p.id === currentUser.id)) {
    players.push(currentUser);
    localStorage.setItem('players', JSON.stringify(players));
  }

  updateUI();
  alert(`Welcome ${nickname}!`);
  showPage('team');
}

function updateUI() {
  if (currentUser) {
    $('user-info').innerHTML = `Logged in: <strong>${currentUser.nickname || currentUser.name}</strong>`;
    $('login-btn').classList.add('hidden');
    $('team-btn').classList.remove('hidden');
    $('players-btn').classList.remove('hidden');
    $('rankings-btn').classList.remove('hidden');
    $('score-btn').classList.remove('hidden');
  }
}

function updateStats() {
  const players = JSON.parse(localStorage.getItem('players') || '[]');
  const teams = JSON.parse(localStorage.getItem('teams') || '[]');
  $('total-players').textContent = players.length;
  $('total-teams').textContent = teams.length;
  $('total-matches').textContent = matches.length;
}

// === TEAM SYSTEM (unchanged + improved) ===
function createOrUpdateTeam() {
  const teamName = $('team-name').value.trim();
  const venue = $('home-venue').value.trim();
  if (!teamName) return alert("Team name required!");

  let teams = JSON.parse(localStorage.getItem('teams') || '[]');
  let team = teams.find(t => t.captainId === currentUser.id);

  if (!team) {
    team = {
      id: Date.now().toString(),
      name: teamName,
      venue,
      captainId: currentUser.id,
      members: [currentUser.id],
      inviteCode: Math.random().toString(36).substring(2, 10),
      points: 0, won: 0, lost: 0, drawn: 0
    };
    teams.push(team);
  } else {
    team.name = teamName;
    team.venue = venue;
  }

  localStorage.setItem('teams', JSON.stringify(teams));
  loadTeamDashboard();
}

function loadTeamDashboard() {
  if (!currentUser) return showPage('login');

  const teams = JSON.parse(localStorage.getItem('teams') || '[]');
  const team = teams.find(t => t.members.includes(currentUser.id));

  if (!team) {
    $('team-title').textContent = "Create Your Team";
    $('team-form').classList.remove('hidden');
    $('team-dashboard').classList.add('hidden');
    return;
  }

  currentTeam = team;
  $('team-form').classList.add('hidden');
  $('team-dashboard').classList.remove('hidden');
  $('current-team-name').textContent = team.name;
  $('team-venue').textContent = team.venue || "Not set";
  $('member-count').textContent = team.members.length;

  const list = $('member-list');
  list.innerHTML = '';
  const allPlayers = JSON.parse(localStorage.getItem('players') || '[]');
  team.members.forEach(pid => {
    const p = allPlayers.find(x => x.id === pid);
    if (p) {
      const li = document.createElement('li');
      li.innerHTML = `${p.nickname || p.name} ${pid === currentUser.id ? '(Captain)' : ''}`;
      list.appendChild(li);
    }
  });

  const url = location.href.split('?')[0] + '?join=' + team.inviteCode;
  $('invite-link').value = url;

  if (team.members.length < 4) {
    alert(`Need ${4 - team.members.length} more players (minimum 4)`);
  }
}

// === INVITE LINK ===
const urlParams = new URLSearchParams(location.search);
const joinCode = urlParams.get('join');
if (joinCode && !currentUser) {
  alert("Please register/login first, then come back to this link to join the team!");
}

// === MATCH SCORING PAGE ===
function prepareMatchScoring() {
  if (!currentUser) return showPage('login');

  const teams = JSON.parse(localStorage.getItem('teams') || '[]');
  const select = $('opponent-select');
  select.innerHTML = '<option value="">Select opponent team</option>';
  teams
    .filter(t => t.id !== currentTeam?.id && t.members.length >= 4)
    .forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name + ` (${t.members.length} players)`;
      select.appendChild(opt);
    });

  $('match-legs').value = 5;
  resetScoreInputs();
}

function resetScoreInputs() {
  $('home-score').value = 501;
  $('away-score').value = 501;
  $('dart1').value = ''; $('dart2').value = ''; $('dart3').value = '';
  $('leg-winner').textContent = '';
}

function throwDarts() {
  const d1 = parseInt($('dart1').value) || 0;
  const d2 = parseInt($('dart2').value) || 0;
  const d3 = parseInt($('dart3').value) || 0;
  const total = d1 + d2 + d3;

  if (total > 180) return alert("Max 180 per visit!");

  let currentScore = parseInt($('home-score').value);
  if (currentScore - total < 0 || (currentScore - total === 1)) {
    alert("Bust!");
  } else if (currentScore - total === 0) {
    $('home-score').value = 0;
    $('leg-winner').textContent = currentTeam.name + " wins the leg!";
    endLeg(true);
  } else {
    $('home-score').value = currentScore - total;
  }

  // Record stats
  if (total === 180) {
    updatePlayerStat(currentUser.id, '180s', 1);
  }
  updatePlayerStat(currentUser.id, 'dartsThrown', 3);
  updatePlayerStat(currentUser.id, 'totalScore', total);

  $('dart1').value = ''; $('dart2').value = ''; $('dart3').value = '';
}

function opponentThrow() {
  const score = Math.floor(Math.random() * 120) + 20; // AI opponent
  let current = parseInt($('away-score').value);
  if (current - score <= 0) {
    $('away-score').value = 0;
    $('leg-winner').textContent = "Opponent wins the leg!";
    endLeg(false);
  } else {
    $('away-score').value = current - score;
  }
}

function endLeg(homeWon) {
  setTimeout(() => {
    alert(homeWon ? "Leg won!" : "Leg lost!");
    resetScoreInputs();
  }, 500);
}

function submitMatchResult() {
  const opponentId = $('opponent-select').value;
  if (!opponentId) return alert("Select opponent");

  const legsToWin = Math.ceil($('match-legs').value / 2);
  const homeLegs = prompt(`How many legs did ${currentTeam.name} win? (Best of ${$('match-legs').value})`, legsToWin);
  const awayLegs = prompt(`How many legs did opponent win?`, legsToWin - 1);

  if (parseInt(homeLegs) + parseInt(awayLegs) !== parseInt($('match-legs').value)) {
    return alert("Legs don't add up!");
  }

  const match = {
    id: Date.now().toString(),
    homeTeamId: currentTeam.id,
    awayTeamId: opponentId,
    homeLegs: parseInt(homeLegs),
    awayLegs: parseInt(awayLegs),
    date: new Date().toISOString(),
    submittedBy: currentUser.id
  };

  matches.push(match);
  localStorage.setItem('matches', JSON.stringify(matches));

  // Update team points
  let teams = JSON.parse(localStorage.getItem('teams') || '[]');
  const home = teams.find(t => t.id === currentTeam.id);
  const away = teams.find(t => t.id === opponentId);

  if (homeLegs > awayLegs) {
    home.points = (home.points || 0) + 2;
    home.won = (home.won || 0) + 1;
    away.lost = (away.lost || 0) + 1;
  } else if (awayLegs > homeLegs) {
    away.points = (away.points || 0) + 2;
    away.won = (away.won || 0) + 1;
    home.lost = (home.lost || 0) + 1;
  } else {
    home.points = (home.points || 0) + 1;
    away.points = (away.points || 0) + 1;
    home.drawn = (home.drawn || 0) + 1;
    away.drawn = (away.drawn || 0) + 1;
  }

  localStorage.setItem('teams', JSON.stringify(teams));
  alert("Match result saved! Rankings updated.");
  showPage('rankings');
}

// === RANKINGS PAGE ===
function showRankings() {
  const teams = JSON.parse(localStorage.getItem('teams') || '[]');
  const sorted = teams
    .filter(t => t.members?.length >= 4)
    .map(t => ({
      name: t.name,
      played: (t.won || 0) + (t.lost || 0) + (t.drawn || 0),
      won: t.won || 0,
      drawn: t.drawn || 0,
      lost: t.lost || 0,
      points: t.points || 0
    }))
    .sort((a, b) => b.points - a.points || b.won - a.won);

  const tbody = $('team-rankings');
  tbody.innerHTML = sorted.map((t, i) => `
    <tr style="background:${i < 3 ? '#fff8e1' : ''}">
      <td>${i + 1}</td>
      <td><strong>${t.name}</strong></td>
      <td>${t.played}</td>
      <td>${t.won}</td>
      <td>${t.drawn}</td>
      <td>${t.lost}</td>
      <td><strong>${t.points}</strong></td>
    </tr>
  `).join('');
}

// === PLAYER STATS HELPER ===
function updatePlayerStat(playerId, field, value) {
  if (!playerStats[playerId]) playerStats[playerId] = { dartsThrown: 0, totalScore: 0, '180s': 0 };
  playerStats[playerId][field] = (playerStats[playerId][field] || 0) + value;
  playerStats[playerId].average = (playerStats[playerId].totalScore / playerStats[playerId].dartsThrown * 3).toFixed(2);
  localStorage.setItem('playerStats', JSON.stringify(playerStats));
}

// === INITIALIZE ===
const saved = localStorage.getItem('currentUser');
if (saved) {
  currentUser = JSON.parse(saved);
  updateUI();
}

if (joinCode && currentUser) {
  const teams = JSON.parse(localStorage.getItem('teams') || '[]');
  const team = teams.find(t => t.inviteCode === joinCode);
  if (team && !team.members.includes(currentUser.id)) {
    if (team.members.length >= 12) {
      alert("Team is full!");
    } else {
      team.members.push(currentUser.id);
      localStorage.setItem('teams', JSON.stringify(teams));
      alert(`You have joined ${team.name}!`);
      location.href = location.href.split('?')[0];
    }
  }
}

updateStats();
showPage('home');