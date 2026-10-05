const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');

const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');

// Ensure data files exist
if (!fs.existsSync(LEADS_FILE)) fs.writeFileSync(LEADS_FILE, '[]', 'utf8');
if (!fs.existsSync(MATCHES_FILE)) fs.writeFileSync(MATCHES_FILE, '[]', 'utf8');

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Kayıt hatası:', e);
  }
}

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

// Find local Wi-Fi / Ethernet IPv4 address
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// HTTP Server
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = parsedUrl.pathname;

  // Root routing
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/stand') pathname = '/stand.html';

  // API 1: Get Server Info (Local IP, Port, Tunnel URL)
  if (pathname === '/api/info') {
    let tunnelUrl = null;
    const tunnelFile = path.join(__dirname, 'tunnel_url.txt');
    if (fs.existsSync(tunnelFile)) {
      try {
        tunnelUrl = fs.readFileSync(tunnelFile, 'utf8').trim();
      } catch (e) {}
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      localIp: getLocalIp(),
      port: PORT,
      tunnelUrl: tunnelUrl,
      time: Date.now()
    }));
  }

  // API 2: Get Scoreboard & Leaderboard
  if (pathname === '/api/scoreboard') {
    const matches = loadJSON(MATCHES_FILE);
    const leads = loadJSON(LEADS_FILE);

    // Calculate player stats
    const stats = {};
    matches.forEach(m => {
      if (m.winner) {
        stats[m.winner] = stats[m.winner] || { name: m.winner, wins: 0, matches: 0, goals: 0 };
        stats[m.winner].wins += 1;
      }
      if (m.p1) {
        stats[m.p1] = stats[m.p1] || { name: m.p1, wins: 0, matches: 0, goals: 0 };
        stats[m.p1].matches += 1;
        stats[m.p1].goals += (m.s1 || 0);
      }
      if (m.p2) {
        stats[m.p2] = stats[m.p2] || { name: m.p2, wins: 0, matches: 0, goals: 0 };
        stats[m.p2].matches += 1;
        stats[m.p2].goals += (m.s2 || 0);
      }
    });

    const leaderboard = Object.values(stats)
      .sort((a, b) => b.wins - a.wins || b.goals - a.goals)
      .slice(0, 10);

    const recentMatches = matches.slice(-8).reverse();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      leaderboard,
      recentMatches,
      totalMatches: matches.length,
      totalLeads: leads.length,
      activeRooms: rooms.size
    }));
  }

  // API 3: Save Lead (Winner or Participant Registration)
  if (pathname === '/api/leads' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const lead = JSON.parse(body);
        if (!lead.name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'İsim gerekli' }));
        }

        const leads = loadJSON(LEADS_FILE);
        const newLead = {
          id: 'SET-' + (leads.length + 101),
          name: lead.name,
          department: lead.department || '-',
          grade: lead.grade || '-',
          contact: lead.contact || '-', // phone or instagram
          role: lead.role || 'Oyuncu',
          winner: lead.winner || false,
          score: lead.score || '-',
          createdAt: new Date().toISOString()
        };

        leads.push(newLead);
        saveJSON(LEADS_FILE, leads);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, leadId: newLead.id }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Geçersiz veri' }));
      }
    });
    return;
  }

  // API 3.5: Save Match from Client (for Local / Bot / Fallback)
  if (pathname === '/api/matches' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const m = JSON.parse(body);
        if (!m.p1 || !m.p2) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Eksik veri' }));
        }

        const matches = loadJSON(MATCHES_FILE);
        const newMatch = {
          id: Date.now(),
          p1: m.p1,
          p2: m.p2,
          s1: Number(m.s1) || 0,
          s2: Number(m.s2) || 0,
          winner: m.winner || (m.s1 > m.s2 ? m.p1 : m.p2),
          loser: m.loser || (m.s1 > m.s2 ? m.p2 : m.p1),
          mode: m.mode || 'local',
          createdAt: new Date().toISOString()
        };

        matches.push(newMatch);
        saveJSON(MATCHES_FILE, matches);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, match: newMatch }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Geçersiz veri' }));
      }
    });
    return;
  }

  // API 4: Get All Leads
  if (pathname === '/api/leads' && req.method === 'GET') {
    const leads = loadJSON(LEADS_FILE);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(leads));
  }

  // API 5: Download Leads as CSV (for Excel / Google Sheets)
  if (pathname === '/api/leads/csv') {
    const leads = loadJSON(LEADS_FILE);
    let csv = 'ID;İsim Soyisim;Bölüm;Sınıf;İletişim/Instagram;Kazanan;Skor;Tarih\n';
    leads.forEach(l => {
      csv += `${l.id};"${l.name}";"${l.department}";"${l.grade}";"${l.contact}";${l.winner ? 'EVET' : 'HAYIR'};"${l.score}";"${l.createdAt}"\n`;
    });

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="SET_Stand_Katilimci_Listesi.csv"'
    });
    return res.end('\uFEFF' + csv); // UTF-8 BOM for Excel
  }

  // Static File Serving
  const filePath = path.join(PUBLIC_DIR, pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Dosya Bulunamadı');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Sunucu Hatası: ' + err.code);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });
      res.end(content);
    }
  });
});

// WebSocket Server
const wss = new WebSocket.Server({ server });

// Rooms State
// Room ID -> { id, hostWs, guestWs, spectators: Set(), score: [0, 0], status: 'waiting' | 'playing' | 'finished', p1, p2, createdAt }
const rooms = new Map();

function generateRoomCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

wss.on('connection', (ws) => {
  ws.roomCode = null;
  ws.playerRole = null; // 'p1' | 'p2' | 'spectator'

  ws.on('message', (messageStr) => {
    try {
      const data = JSON.parse(messageStr);
      handleClientMessage(ws, data);
    } catch (e) {
      console.error('Geçersiz WS mesajı:', e);
    }
  });

  ws.on('close', () => {
    handleDisconnect(ws);
  });
});

function handleClientMessage(ws, data) {
  const type = data.type;

  if (type === 'create_room') {
    let code = generateRoomCode();
    while (rooms.has(code)) {
      code = generateRoomCode();
    }

    const room = {
      id: code,
      hostWs: ws,
      guestWs: null,
      spectators: new Set(),
      hostName: data.name || 'Oyuncu 1',
      guestName: null,
      status: 'waiting',
      score: [0, 0],
      createdAt: Date.now()
    };

    rooms.set(code, room);
    ws.roomCode = code;
    ws.playerRole = 'p1';

    ws.send(JSON.stringify({
      type: 'room_created',
      roomCode: code,
      role: 'p1'
    }));
    console.log(`[ODA OLUŞTURULDU] Kod: ${code} (${room.hostName})`);
  }

  else if (type === 'join_room') {
    const code = (data.roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) {
      return ws.send(JSON.stringify({
        type: 'error',
        message: 'Oda bulunamadı! Kodu kontrol edin.'
      }));
    }

    if (room.guestWs && room.guestWs.readyState === WebSocket.OPEN) {
      return ws.send(JSON.stringify({
        type: 'error',
        message: 'Bu oda şu an dolu! Başka bir odaya katılın veya yeni oda açın.'
      }));
    }

    room.guestWs = ws;
    room.guestName = data.name || 'Oyuncu 2';
    room.status = 'playing';
    room.score = [0, 0];

    ws.roomCode = code;
    ws.playerRole = 'p2';

    // Notify guest
    ws.send(JSON.stringify({
      type: 'room_joined',
      roomCode: code,
      role: 'p2',
      opponentName: room.hostName
    }));

    // Notify host
    if (room.hostWs && room.hostWs.readyState === WebSocket.OPEN) {
      room.hostWs.send(JSON.stringify({
        type: 'player_joined',
        opponentName: room.guestName
      }));
    }

    // Notify spectators
    broadcastToSpectators(room, {
      type: 'spectator_game_start',
      p1: room.hostName,
      p2: room.guestName,
      score: [0, 0]
    });

    console.log(`[OYUN BAŞLADI] Oda: ${code} (${room.hostName} vs ${room.guestName})`);
  }

  // Spectator Join (For booth TV / Stand screen)
  else if (type === 'spectate_room') {
    let code = (data.roomCode || '').toUpperCase().trim();
    
    // If no specific room code, join the most recently active playing room
    if (!code || !rooms.has(code)) {
      for (const [rCode, r] of rooms.entries()) {
        if (r.status === 'playing') {
          code = rCode;
          break;
        }
      }
    }

    const room = rooms.get(code);
    ws.playerRole = 'spectator';
    ws.roomCode = code;

    if (room) {
      room.spectators.add(ws);
      ws.send(JSON.stringify({
        type: 'spectator_joined',
        roomCode: code,
        p1: room.hostName,
        p2: room.guestName,
        score: room.score,
        status: room.status
      }));
    } else {
      ws.send(JSON.stringify({
        type: 'spectator_waiting',
        message: 'Şu an aktif bir maç bekleniyor...'
      }));
    }
  }

  // Real-time paddle sync
  else if (type === 'paddle_move') {
    const room = rooms.get(ws.roomCode);
    if (!room) return;

    const opponent = ws.playerRole === 'p1' ? room.guestWs : room.hostWs;
    if (opponent && opponent.readyState === WebSocket.OPEN) {
      opponent.send(JSON.stringify({
        type: 'opponent_paddle',
        x: data.x,
        y: data.y,
        vx: data.vx || 0,
        vy: data.vy || 0
      }));
    }

    // Relay to spectators for TV broadcast
    broadcastToSpectators(room, {
      type: 'spectator_paddle',
      role: ws.playerRole,
      x: data.x,
      y: data.y
    });
  }

  // Puck sync & bounce events from either player
  else if (type === 'puck_sync') {
    const room = rooms.get(ws.roomCode);
    if (!room) return;

    const opponent = ws.playerRole === 'p1' ? room.guestWs : room.hostWs;
    if (opponent && opponent.readyState === WebSocket.OPEN) {
      opponent.send(JSON.stringify({
        type: 'puck_sync',
        x: data.x,
        y: data.y,
        vx: data.vx,
        vy: data.vy,
        bounce: !!data.bounce
      }));
    }

    // Relay puck to spectators
    broadcastToSpectators(room, {
      type: 'spectator_puck',
      x: data.x,
      y: data.y,
      vx: data.vx,
      vy: data.vy
    });
  }

  else if (type === 'goal_scored') {
    const room = rooms.get(ws.roomCode);
    if (!room) return;

    room.score = [data.s1, data.s2];

    const payload = JSON.stringify({
      type: 'goal_event',
      scorer: data.scorer, // 'p1' or 'p2'
      s1: data.s1,
      s2: data.s2
    });

    if (room.hostWs && room.hostWs.readyState === WebSocket.OPEN) room.hostWs.send(payload);
    if (room.guestWs && room.guestWs.readyState === WebSocket.OPEN) room.guestWs.send(payload);
    broadcastToSpectators(room, payload);

    // If game ended, record to matches history!
    if (data.s1 >= 5 || data.s2 >= 5) {
      const winnerName = data.s1 > data.s2 ? room.hostName : room.guestName;
      const loserName = data.s1 > data.s2 ? room.guestName : room.hostName;

      const matches = loadJSON(MATCHES_FILE);
      matches.push({
        id: Date.now(),
        p1: room.hostName,
        p2: room.guestName,
        s1: data.s1,
        s2: data.s2,
        winner: winnerName,
        loser: loserName,
        timestamp: new Date().toISOString()
      });
      saveJSON(MATCHES_FILE, matches);
      console.log(`[MAÇ KAYDEDİLDİ] ${winnerName} kazandı (${data.s1} - ${data.s2})`);
    }
  }

  else if (type === 'rematch_request') {
    const room = rooms.get(ws.roomCode);
    if (!room) return;

    const opponent = ws.playerRole === 'p1' ? room.guestWs : room.hostWs;
    if (opponent && opponent.readyState === WebSocket.OPEN) {
      opponent.send(JSON.stringify({ type: 'rematch_requested' }));
    }
  }

  else if (type === 'rematch_accept') {
    const room = rooms.get(ws.roomCode);
    if (!room) return;

    room.score = [0, 0];
    room.status = 'playing';

    const payload = JSON.stringify({ type: 'rematch_start' });
    if (room.hostWs && room.hostWs.readyState === WebSocket.OPEN) room.hostWs.send(payload);
    if (room.guestWs && room.guestWs.readyState === WebSocket.OPEN) room.guestWs.send(payload);
    broadcastToSpectators(room, payload);
  }
}

function broadcastToSpectators(room, dataObj) {
  if (!room || !room.spectators) return;
  const msg = typeof dataObj === 'string' ? dataObj : JSON.stringify(dataObj);
  room.spectators.forEach(specWs => {
    if (specWs.readyState === WebSocket.OPEN) {
      specWs.send(msg);
    }
  });
}

function handleDisconnect(ws) {
  if (!ws.roomCode) return;
  const room = rooms.get(ws.roomCode);
  if (!room) return;

  if (ws.playerRole === 'spectator') {
    room.spectators.delete(ws);
    return;
  }

  const opponent = ws.playerRole === 'p1' ? room.guestWs : room.hostWs;
  if (opponent && opponent.readyState === WebSocket.OPEN) {
    opponent.send(JSON.stringify({
      type: 'opponent_left',
      message: 'Rakip oyundan ayrıldı!'
    }));
  }

  if (ws.playerRole === 'p1') {
    rooms.delete(ws.roomCode);
    console.log(`[ODA KAPANDI] Kod: ${ws.roomCode}`);
  } else {
    room.guestWs = null;
    room.status = 'waiting';
  }
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log('='.repeat(65));
  console.log('⚡ SET ARENA // 1V1 AIR HOCKEY MULTIPLAYER OYUN SUNUCUSU');
  console.log('='.repeat(65));
  console.log(`👉 Bilgisayarda Oyna:        http://localhost:${PORT}`);
  console.log(`👉 Canlı Stant / TV Ekranı:  http://localhost:${PORT}/stand.html`);
  console.log(`👉 Katılımcı Listesi (Admin): http://localhost:${PORT}/api/leads`);
  console.log(`👉 Telefondan Aç (Wi-Fi):    http://${localIp}:${PORT}`);
  console.log('='.repeat(65));
});
