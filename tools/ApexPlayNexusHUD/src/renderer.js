// --- ApexPlay Nexus HUD: Dynamic & Anchored Engine ---
// Optimized for absolute timer reliability and bottom-up roster growth

const socket = new WebSocket('ws://localhost:31982');

let state = {
    players: [],
    teams: { ct: { name: "COUNTER-TERRORISTS" }, t: { name: "TERRORISTS" } },
    map: {},
    round: { phase: "" },
    localTime: 0,
    timerInterval: null
};

socket.onopen = () => console.log('[NEXUS] Pro Core Connected');
socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    parseState(data);
    renderHUD(data.gsi?.player?.steamid);
};

function parseState(data) {
    const gsi = data.gsi || {};
    const add = data.additional || {};

    const previousPhase = state.round.phase;
    state.map = gsi.map || {};
    state.round = gsi.round || { phase: "" };

    // 1. DYNAMIC NAME MAPPING
    state.teams.ct.name = state.map.team_ct?.name || "COUNTER-TERRORISTS";
    state.teams.t.name = state.map.team_t?.name || "TERRORISTS";

    // 2. UNIVERSAL TIMER SYNC
    const countdown = gsi.phase_countdowns || gsi.round?.phase_countdowns;
    if (countdown && countdown.phase_ends_in !== undefined) {
        const serverTime = Math.max(0, Math.ceil(countdown.phase_ends_in));
        if (state.round.phase !== previousPhase || Math.abs(state.localTime - serverTime) > 1.2 || state.localTime === 0) {
            syncTicker(serverTime);
        }
    } 
    else if (state.round.phase !== previousPhase) {
        if (state.round.phase === 'live') syncTicker(115); // Standard 1:55
        if (state.round.phase === 'freezetime') syncTicker(15);
        if (state.round.phase === 'bomb') {
            const bombData = add.lastKnownBombPlantedCountdown || {};
            if (bombData.value) {
                const elapsed = (Date.now() - bombData.unixTimestamp) / 1000;
                syncTicker(Math.max(0, Math.ceil(bombData.value - elapsed)));
            } else {
                syncTicker(40);
            }
        }
        if (state.round.phase === 'over') syncTicker(0);
    }

    // 3. ROSTER MAPPING
    let roster = gsi.allplayers || {};
    if (Object.keys(roster).length === 0 && gsi.player?.steamid) roster[gsi.player.steamid] = gsi.player;

    state.players = Object.entries(roster).map(([steamId, p]) => {
        const slot = add.lastKnownPlayerObserverSlot[steamId] ?? p.observer_slot;
        const damages = add.roundDamages[steamId] || {};
        const totalDamage = Object.values(damages).reduce((a, b) => a + b, 0);
        const adr = state.map.round > 0 ? Math.round(totalDamage / state.map.round) : 0;

        return {
            steamId,
            slot: slot === 0 ? 10 : (slot || 0),
            name: p.name || 'UNKNOWN',
            team: p.team || 'UNASSIGNED',
            hp: p.state?.health ?? 0,
            armor: p.state?.armor ?? 0,
            helmet: p.state?.helmet ?? false,
            money: p.state?.money ?? 0,
            stats: p.match_stats || {},
            weapons: Object.values(p.weapons || {}),
            adr
        };
    }).sort((a, b) => a.slot - b.slot);
}

function syncTicker(seconds) {
    state.localTime = seconds;
    if (state.timerInterval) clearInterval(state.timerInterval);
    updateClockDisplay();
    state.timerInterval = setInterval(() => { 
        if (state.localTime > 0) {
            state.localTime--;
            updateClockDisplay();
        }
    }, 1000);
}

function updateClockDisplay() {
    const mins = Math.floor(state.localTime / 60);
    const secs = state.localTime % 60;
    document.getElementById('clock').innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
}

function renderHUD(currentId) {
    document.getElementById('ct-score').innerText = state.map.team_ct?.score ?? 0;
    document.getElementById('t-score').innerText = state.map.team_t?.score ?? 0;
    document.getElementById('round-num').innerText = (state.map.round ?? 0) + 1;
    document.getElementById('ct-name').innerText = state.teams.ct.name.toUpperCase();
    document.getElementById('t-name').innerText = state.teams.t.name.toUpperCase();

    renderRoster(document.getElementById('ct-players'), state.players.filter(p => p.team?.startsWith("CT")));
    renderRoster(document.getElementById('t-players'), state.players.filter(p => p.team?.startsWith("T")));

    const spec = state.players.find(p => p.steamId === currentId);
    
    // Toggle bomb-active class for the clock box
    const clockBox = document.getElementById('clock-box');
    if (state.round.phase === 'bomb') {
        clockBox.classList.add('bomb-active');
    } else {
        clockBox.classList.remove('bomb-active');
    }

    updateActiveHub(spec);
}

function renderRoster(container, players) {
    container.innerHTML = players.map(p => {
        const mainWep = p.weapons.find(w => ['Rifle','SniperRifle','SMG'].includes(w.type)) || p.weapons.find(w => w.type === 'Pistol') || p.weapons[0];
        const iconName = mainWep ? mainWep.name.replace(/^weapon_/, "") : "";
        const grenades = p.weapons.filter(w => w.type === 'Grenade');
        const armorIcon = p.helmet ? 'armor-helmet.svg' : 'armor.svg';
        
        return `
        <div class="player-row ${p.hp <= 0 ? 'dead' : ''}">
            <!-- Row 1: K/D and Name -->
            <div class="p-row p-top">
                <div class="p-kd">
                    <img src="assets/icons/round-kills.svg" class="stat-icon"> <span>${p.stats.kills}</span>
                    <img src="assets/icons/dead.svg" class="stat-icon"> <span>${p.stats.deaths}</span>
                </div>
                <div class="p-name">${p.name}</div>
            </div>

            <!-- Row 2: Grenades, Money, Slot -->
            <div class="p-row p-mid">
                <div class="p-nades">
                    ${grenades.map(g => `<img src="assets/weapons/${g.name.replace(/^weapon_/, "")}.svg" class="nade-icon">`).join('')}
                </div>
                <div class="p-money-slot">
                    <div class="p-money">$${p.money.toLocaleString()}</div>
                    <div class="p-slot-circle">${p.slot}</div>
                </div>
            </div>

            <!-- Row 3: Weapon and Health Bar Background -->
            <div class="p-row p-bottom team-bg">
                <div class="health-bar" style="width: ${p.hp}%"></div>
                <div class="p-bottom-content">
                    <div class="p-weapon">
                        ${iconName ? `<img src="assets/weapons/${iconName}.svg" class="nexus-icon">` : ''}
                    </div>
                    <div class="p-vital-stats">
                        <img src="assets/icons/${armorIcon}" class="stat-icon"> <span>${p.armor}</span>
                        <img src="assets/icons/health.svg" class="stat-icon"> <span>${p.hp}</span>
                    </div>
                </div>
            </div>
        </div>
    `}).join('');
}

function updateActiveHub(p) {
    const hub = document.getElementById('active-player-hub');
    if (!p || p.hp <= 0) { hub.style.display = 'none'; return; }
    hub.style.display = 'flex';
    document.getElementById('active-name').innerText = p.name.toUpperCase();
    document.getElementById('active-hp').innerText = p.hp;
    document.getElementById('active-stripe').style.background = p.team?.startsWith("CT") ? "var(--ct-color)" : "var(--t-color)";
    
    // Stats
    document.getElementById('active-k').innerText = p.stats.kills ?? 0;
    document.getElementById('active-a').innerText = p.stats.assists ?? 0;
    document.getElementById('active-d').innerText = p.stats.deaths ?? 0;
    document.getElementById('active-adr').innerText = p.adr ?? 0;

    const grenades = p.weapons.filter(w => w.type === 'Grenade');
    document.getElementById('active-nades').innerHTML = grenades.map(g => 
        `<img src="assets/weapons/${g.name.replace(/^weapon_/, "")}.svg" class="nade-icon">`
    ).join('');

    const activeW = p.weapons.find(w => w.state === "active");
    if (activeW) {
        const iconName = activeW.name.replace(/^weapon_/, "");
        document.getElementById('active-weapon-icon').innerHTML = `<img src="assets/weapons/${iconName}.svg" class="nexus-icon">`;
        document.getElementById('active-ammo').innerText = `${activeW.ammo_clip ?? '-'}/${activeW.ammo_reserve ?? '-'}`;
    }
}
