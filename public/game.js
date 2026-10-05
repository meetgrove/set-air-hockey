/**
 * SET ARENA // 1V1 AIR HOCKEY ENGINE
 * Real-time Physics, WebSocket Multiplayer, Local 2-Player, AI Bot, Web Audio FX & Haptics
 */

// ==========================================
// 1. SOUND & HAPTIC ENGINE
// ==========================================
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  hitPaddle(speedRatio = 0.5) {
    if (!this.enabled) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    const startFreq = 180 + speedRatio * 320;
    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);

    // Haptic kick on mobile
    if (navigator.vibrate) {
      navigator.vibrate(Math.min(35, Math.floor(15 + speedRatio * 20)));
    }
  }

  hitWall() {
    if (!this.enabled) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  goal() {
    if (!this.enabled) return;
    this.init();
    // Subwoofer boom
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.45);

    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.45);

    // Victory chime
    setTimeout(() => {
      if (!this.enabled) return;
      const chime = this.ctx.createOscillator();
      const cGain = this.ctx.createGain();
      chime.type = 'sine';
      chime.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
      chime.frequency.setValueAtTime(880, this.ctx.currentTime + 0.12); // A5
      cGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      cGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
      chime.connect(cGain);
      cGain.connect(this.ctx.destination);
      chime.start();
      chime.stop(this.ctx.currentTime + 0.4);
    }, 100);

    if (navigator.vibrate) {
      navigator.vibrate([60, 40, 100]);
    }
  }

  whistle() {
    if (!this.enabled) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, this.ctx.currentTime); // B5
    osc.frequency.setValueAtTime(1318.51, this.ctx.currentTime + 0.08); // E6
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }
}

// ==========================================
// 2. PARTICLE SPARK SYSTEM
// ==========================================
class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  emit(x, y, color = '#FF2E3B', count = 12, speed = 6) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const vel = (Math.random() * 0.7 + 0.3) * speed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * vel,
        vy: Math.sin(angle) * vel,
        size: Math.random() * 3 + 1.5,
        alpha: 1,
        color,
        decay: Math.random() * 0.04 + 0.02
      });
    }
  }

  updateAndDraw(ctx) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// ==========================================
// 3. MAIN GAME CONTROLLER
// ==========================================
const Game = {
  // Virtual Table Size (normalized aspect ratio ~1:1.8)
  V_WIDTH: 500,
  V_HEIGHT: 900,
  GOAL_WIDTH: 200,

  canvas: null,
  ctx: null,
  scale: 1,
  audio: new SoundFX(),
  particles: new ParticleSystem(),

  // Game State
  mode: 'lobby', // 'qr' | 'local' | 'bot'
  isHost: true,
  role: 'p1', // 'p1' (top / red) or 'p2' (bottom / blue)
  p1Name: 'Oyuncu 1',
  p2Name: 'Oyuncu 2',
  score: [0, 0],
  maxScore: 5,
  isPaused: false,
  isGameOver: false,

  // Table Entities
  puck: {
    x: 250,
    y: 450,
    vx: 0,
    vy: 0,
    r: 22,
    trail: []
  },

  p1Paddle: {
    x: 250,
    y: 140,
    prevX: 250,
    prevY: 140,
    vx: 0,
    vy: 0,
    r: 36,
    color: '#FF2E3B',
    glow: 'rgba(255, 46, 59, 0.6)'
  },

  p2Paddle: {
    x: 250,
    y: 760,
    prevX: 250,
    prevY: 760,
    vx: 0,
    vy: 0,
    r: 36,
    color: '#00E5FF',
    glow: 'rgba(0, 229, 255, 0.6)'
  },

  // Multi-Touch tracking for Local 2-Player mode
  activePointers: new Map(),

  // Networking
  ws: null,
  roomCode: null,
  serverInfo: null,

  init() {
    this.canvas = document.getElementById('air-hockey-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.bindDOM();
    this.bindControls();
    this.fetchServerInfo();

    // Start render loop
    requestAnimationFrame((t) => this.loop(t));

    // Lucide Icons
    if (window.lucide) window.lucide.createIcons();

    // Check if URL has ?room=XXXX (Direct QR Join)
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      this.switchScreen('screen-room');
      document.getElementById('manual-code-input').value = roomParam.toUpperCase();
      this.connectWebSocket(() => {
        this.joinRoom(roomParam.toUpperCase());
      });
    }
  },

  async fetchServerInfo() {
    try {
      const res = await fetch('/api/info');
      this.serverInfo = await res.json();
    } catch (e) {
      console.warn('Sunucu bilgisi alınamadı:', e);
      this.serverInfo = { localIp: window.location.hostname, port: window.location.port || 3000 };
    }
  },

  resizeCanvas() {
    const wrapper = document.getElementById('canvas-wrapper');
    if (!wrapper) return;

    const maxW = wrapper.clientWidth;
    const maxH = wrapper.clientHeight;

    const aspect = this.V_WIDTH / this.V_HEIGHT;
    let w = maxW;
    let h = w / aspect;

    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    this.scale = (w * dpr) / this.V_WIDTH;
  },

  switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
    if (window.lucide) window.lucide.createIcons();
  },

  // ==========================================
  // DOM & BUTTON HANDLERS
  // ==========================================
  bindDOM() {
    // Sound Toggle in Lobby
    const btnSound = document.getElementById('btn-sound-toggle');
    if (btnSound) {
      btnSound.addEventListener('click', () => {
        this.audio.enabled = !this.audio.enabled;
        btnSound.innerHTML = this.audio.enabled 
          ? '<i data-lucide="volume-2" class="w-5 h-5"></i>' 
          : '<i data-lucide="volume-x" class="w-5 h-5 text-red-500"></i>';
        if (window.lucide) window.lucide.createIcons();
      });
    }

    // Lobby Mode 1: QR ile 2 Telefon
    document.getElementById('btn-mode-qr').addEventListener('click', () => {
      this.mode = 'qr';
      this.p1Name = document.getElementById('player-name').value.trim() || 'Oyuncu 1';
      this.switchScreen('screen-room');
      this.connectWebSocket(() => {
        this.createRoom();
      });
    });

    // Lobby Mode 2: Aynı Ekranda 1v1
    document.getElementById('btn-mode-local').addEventListener('click', () => {
      this.mode = 'local';
      this.p1Name = 'Kırmızı (Üst)';
      this.p2Name = 'Mavi (Alt)';
      this.startMatch();
    });

    // Lobby Mode 3: Bot Antrenman
    document.getElementById('btn-mode-bot').addEventListener('click', () => {
      this.mode = 'bot';
      this.p1Name = 'Yapay Zeka';
      this.p2Name = document.getElementById('player-name').value.trim() || 'Oyuncu';
      this.startMatch();
    });

    // Room Back Button
    document.getElementById('btn-room-back').addEventListener('click', () => {
      if (this.ws) this.ws.close();
      this.switchScreen('screen-lobby');
    });

    // Join with Manual Code
    document.getElementById('btn-join-code').addEventListener('click', () => {
      const code = document.getElementById('manual-code-input').value.trim().toUpperCase();
      if (!code) return alert('Lütfen geçerli bir 4 haneli oda kodu girin!');
      this.p2Name = document.getElementById('player-name').value.trim() || 'Oyuncu 2';
      this.connectWebSocket(() => {
        this.joinRoom(code);
      });
    });

    // Copy Link Button
    document.getElementById('btn-copy-link').addEventListener('click', () => {
      const link = this.getShareUrl();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(link);
        alert('Oda bağlantısı panoya kopyalandı! Arkadaşına gönder:\n' + link);
      }
    });

    // Exit Game Button
    document.getElementById('btn-game-exit').addEventListener('click', () => {
      if (confirm('Maçtan çıkmak istediğinize emin misiniz?')) {
        if (this.ws) this.ws.close();
        this.switchScreen('screen-lobby');
      }
    });

    // Rematch Buttons
    document.getElementById('btn-rematch').addEventListener('click', () => {
      document.getElementById('modal-winner').classList.add('opacity-0', 'pointer-events-none');
      if (this.mode === 'qr') {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'rematch_accept' }));
        }
      } else {
        this.resetGame();
      }
    });

    document.getElementById('btn-back-lobby').addEventListener('click', () => {
      document.getElementById('modal-winner').classList.add('opacity-0', 'pointer-events-none');
      if (this.ws) this.ws.close();
      this.switchScreen('screen-lobby');
    });

    // Lead / Raffle Submission Button
    const btnSubmitLead = document.getElementById('btn-submit-lead');
    if (btnSubmitLead) {
      btnSubmitLead.addEventListener('click', async () => {
        const dept = document.getElementById('lead-dept').value.trim();
        const contact = document.getElementById('lead-contact').value.trim();
        const winner = this.score[0] > this.score[1] ? this.p1Name : this.p2Name;

        if (!contact) {
          alert('Lütfen çekiliş için iletişim bilgini (Instagram veya Telefon) gir!');
          return;
        }

        btnSubmitLead.disabled = true;
        btnSubmitLead.textContent = 'Kaydediliyor...';

        try {
          const res = await fetch('/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: winner || 'Oyuncu',
              department: dept || '-',
              grade: '-',
              contact: contact,
              winner: true,
              score: `${this.score[0]} - ${this.score[1]}`,
              role: 'Katılımcı'
            })
          });

          const data = await res.json();
          if (data.success) {
            document.getElementById('lead-form-box').classList.add('hidden');
            const successBox = document.getElementById('lead-success-box');
            successBox.classList.remove('hidden');
            document.getElementById('lead-ticket-id').textContent = `BİLET: #${data.leadId || 'SET-OK'}`;
            if (window.lucide) window.lucide.createIcons();
          } else {
            alert('Kayıt oluşturulamadı: ' + (data.error || 'Bilinmeyen hata'));
            btnSubmitLead.disabled = false;
            btnSubmitLead.textContent = 'Çekilişe Kaydol';
          }
        } catch (err) {
          console.error('Lead error:', err);
          alert('Bağlantı hatası oluştu, lütfen tekrar deneyin.');
          btnSubmitLead.disabled = false;
          btnSubmitLead.textContent = 'Çekilişe Kaydol';
        }
      });
    }
  },

  getShareUrl() {
    const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseHost = this.serverInfo?.tunnelUrl 
      || (!isLocalHost ? window.location.origin : `http://${this.serverInfo?.localIp || window.location.hostname}:${this.serverInfo?.port || 3000}`);
    return `${baseHost}?room=${this.roomCode || ''}`;
  },

  // ==========================================
  // WEBSOCKET MULTIPLAYER LOGIC
  // ==========================================
  connectWebSocket(onOpenCallback) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (onOpenCallback) onOpenCallback();
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('⚡ WebSocket Sunucusuna Bağlanıldı!');
      if (onOpenCallback) onOpenCallback();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleNetworkMessage(msg);
      } catch (e) {
        console.error('WS Parse Hatası:', e);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket bağlantısı kapandı.');
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket Hatası:', err);
    };
  },

  createRoom() {
    this.isHost = true;
    this.role = 'p1';
    this.ws.send(JSON.stringify({
      type: 'create_room',
      name: this.p1Name
    }));
  },

  joinRoom(code) {
    this.isHost = false;
    this.role = 'p2';
    this.roomCode = code;
    this.ws.send(JSON.stringify({
      type: 'join_room',
      roomCode: code,
      name: this.p2Name
    }));
  },

  handleNetworkMessage(msg) {
    if (msg.type === 'room_created') {
      this.roomCode = msg.roomCode;
      document.getElementById('room-code-display').textContent = `SET-${this.roomCode}`;

      // Render Dynamic QR Code
      const qrBox = document.getElementById('qrcode-box');
      qrBox.innerHTML = '';
      const shareUrl = this.getShareUrl();

      new QRCode(qrBox, {
        text: shareUrl,
        width: 170,
        height: 170,
        colorDark: '#07080B',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    }

    else if (msg.type === 'player_joined') {
      this.p2Name = msg.opponentName || 'Oyuncu 2';
      this.startMatch();
    }

    else if (msg.type === 'room_joined') {
      this.p1Name = msg.opponentName || 'Oyuncu 1';
      this.startMatch();
    }

    else if (msg.type === 'opponent_paddle') {
      // Sync opponent paddle position
      const targetPaddle = this.role === 'p1' ? this.p2Paddle : this.p1Paddle;
      targetPaddle.x = msg.x;
      targetPaddle.y = msg.y;
      targetPaddle.vx = msg.vx;
      targetPaddle.vy = msg.vy;
    }

    else if (msg.type === 'puck_sync' && !this.isHost) {
      // Guest syncs puck from Host
      this.puck.x = msg.x;
      this.puck.y = msg.y;
      this.puck.vx = msg.vx;
      this.puck.vy = msg.vy;
    }

    else if (msg.type === 'goal_event') {
      this.handleGoalScored(msg.scorer, msg.s1, msg.s2, false);
    }

    else if (msg.type === 'rematch_start') {
      document.getElementById('modal-winner').classList.add('opacity-0', 'pointer-events-none');
      this.resetGame();
    }

    else if (msg.type === 'opponent_left') {
      alert(msg.message || 'Rakip oyundan ayrıldı!');
      this.switchScreen('screen-lobby');
    }

    else if (msg.type === 'error') {
      alert(msg.message);
    }
  },

  // ==========================================
  // CONTROLS & TOUCH HANDLING
  // ==========================================
  bindControls() {
    const canvas = this.canvas;

    const getCanvasPos = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left) / (rect.width / this.V_WIDTH);
      const y = (clientY - rect.top) / (rect.height / this.V_HEIGHT);
      return { x, y };
    };

    // Pointer Events (Touch & Mouse unified)
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      const pos = getCanvasPos(e.clientX, e.clientY);
      this.activePointers.set(e.pointerId, pos);
      this.handlePointerMove(e.pointerId, pos.x, pos.y);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this.activePointers.has(e.pointerId)) return;
      const pos = getCanvasPos(e.clientX, e.clientY);
      this.activePointers.set(e.pointerId, pos);
      this.handlePointerMove(e.pointerId, pos.x, pos.y);
    });

    const pointerEnd = (e) => {
      this.activePointers.delete(e.pointerId);
    };

    canvas.addEventListener('pointerup', pointerEnd);
    canvas.addEventListener('pointercancel', pointerEnd);
  },

  handlePointerMove(pointerId, x, y) {
    if (this.isPaused || this.isGameOver) return;

    if (this.mode === 'qr') {
      // If Host (P1 / Red): Controls Top Paddle
      if (this.role === 'p1') {
        this.p1Paddle.x = Math.max(this.p1Paddle.r + 15, Math.min(this.V_WIDTH - this.p1Paddle.r - 15, x));
        this.p1Paddle.y = Math.max(this.p1Paddle.r + 15, Math.min(this.V_HEIGHT / 2 - this.p1Paddle.r - 10, y));

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'paddle_move',
            x: this.p1Paddle.x,
            y: this.p1Paddle.y,
            vx: this.p1Paddle.vx,
            vy: this.p1Paddle.vy
          }));
        }
      }
      // If Guest (P2 / Blue): Controls Bottom Paddle
      else {
        this.p2Paddle.x = Math.max(this.p2Paddle.r + 15, Math.min(this.V_WIDTH - this.p2Paddle.r - 15, x));
        this.p2Paddle.y = Math.max(this.V_HEIGHT / 2 + this.p2Paddle.r + 10, Math.min(this.V_HEIGHT - this.p2Paddle.r - 15, y));

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'paddle_move',
            x: this.p2Paddle.x,
            y: this.p2Paddle.y,
            vx: this.p2Paddle.vx,
            vy: this.p2Paddle.vy
          }));
        }
      }
    }

    else if (this.mode === 'local') {
      // Multi-Touch on same device: Top half controls P1, Bottom half controls P2
      if (y < this.V_HEIGHT / 2) {
        this.p1Paddle.x = Math.max(this.p1Paddle.r + 15, Math.min(this.V_WIDTH - this.p1Paddle.r - 15, x));
        this.p1Paddle.y = Math.max(this.p1Paddle.r + 15, Math.min(this.V_HEIGHT / 2 - this.p1Paddle.r - 10, y));
      } else {
        this.p2Paddle.x = Math.max(this.p2Paddle.r + 15, Math.min(this.V_WIDTH - this.p2Paddle.r - 15, x));
        this.p2Paddle.y = Math.max(this.V_HEIGHT / 2 + this.p2Paddle.r + 10, Math.min(this.V_HEIGHT - this.p2Paddle.r - 15, y));
      }
    }

    else if (this.mode === 'bot') {
      // Player controls Bottom Paddle (P2)
      this.p2Paddle.x = Math.max(this.p2Paddle.r + 15, Math.min(this.V_WIDTH - this.p2Paddle.r - 15, x));
      this.p2Paddle.y = Math.max(this.V_HEIGHT / 2 + this.p2Paddle.r + 10, Math.min(this.V_HEIGHT - this.p2Paddle.r - 15, y));
    }
  },

  // ==========================================
  // MATCH LIFECYCLE
  // ==========================================
  startMatch() {
    this.switchScreen('screen-game');
    this.resizeCanvas();
    this.updateHUD();

    this.audio.whistle();
    this.resetGame();
  },

  resetGame() {
    this.score = [0, 0];
    this.isGameOver = false;
    this.isPaused = false;
    this.updateHUD();
    this.resetPuck(0);
  },

  resetPuck(direction = 0) {
    this.puck.x = this.V_WIDTH / 2;
    this.puck.y = this.V_HEIGHT / 2;
    this.puck.trail = [];

    // Initial serve velocity towards goal
    const speed = 4;
    const angle = (Math.random() - 0.5) * 0.8;
    const dirY = direction === 0 ? (Math.random() > 0.5 ? 1 : -1) : direction;

    this.puck.vx = Math.sin(angle) * speed;
    this.puck.vy = Math.cos(angle) * speed * dirY;

    // Reset paddles
    this.p1Paddle.x = this.V_WIDTH / 2;
    this.p1Paddle.y = 140;
    this.p2Paddle.x = this.V_WIDTH / 2;
    this.p2Paddle.y = this.V_HEIGHT - 140;
  },

  updateHUD() {
    document.getElementById('hud-p1-name').textContent = this.p1Name.toUpperCase();
    document.getElementById('hud-p2-name').textContent = this.p2Name.toUpperCase();
    document.getElementById('score-p1').textContent = this.score[0];
    document.getElementById('score-p2').textContent = this.score[1];
  },

  handleGoalScored(scorer, s1, s2, isAuthoritative = true) {
    this.score = [s1, s2];
    this.updateHUD();
    this.audio.goal();

    // Trigger visual blast
    const banner = document.getElementById('goal-banner');
    const scorerTxt = document.getElementById('goal-scorer-txt');
    const scorerName = scorer === 'p1' ? this.p1Name : this.p2Name;
    scorerTxt.textContent = `${scorerName.toUpperCase()} SAYI KAZANDI!`;

    banner.classList.add('show');
    document.getElementById('canvas-wrapper').classList.add('shake');

    // Particle blast at goal location
    const goalY = scorer === 'p1' ? this.V_HEIGHT - 10 : 10;
    this.particles.emit(this.V_WIDTH / 2, goalY, scorer === 'p1' ? '#FF2E3B' : '#00E5FF', 35, 10);

    this.isPaused = true;

    // Check Win Condition
    if (this.score[0] >= this.maxScore || this.score[1] >= this.maxScore) {
      setTimeout(() => {
        banner.classList.remove('show');
        document.getElementById('canvas-wrapper').classList.remove('shake');
        this.triggerGameOver();
      }, 1200);
      return;
    }

    setTimeout(() => {
      banner.classList.remove('show');
      document.getElementById('canvas-wrapper').classList.remove('shake');
      this.isPaused = false;
      this.resetPuck(scorer === 'p1' ? -1 : 1);
    }, 1400);

    // Broadcast if host
    if (isAuthoritative && this.mode === 'qr' && this.isHost && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'goal_scored',
        scorer,
        s1: this.score[0],
        s2: this.score[1]
      }));
    }
  },

  triggerGameOver() {
    this.isGameOver = true;
    const winner = this.score[0] > this.score[1] ? this.p1Name : this.p2Name;
    const loser = this.score[0] > this.score[1] ? this.p2Name : this.p1Name;
    const color = this.score[0] > this.score[1] ? '#FF2E3B' : '#00E5FF';

    document.getElementById('winner-name-txt').textContent = `${winner.toUpperCase()} KAZANDI!`;
    document.getElementById('winner-name-txt').style.color = color;
    document.getElementById('winner-score-txt').textContent = `SKOR: ${this.score[0]} - ${this.score[1]}`;

    // Reset raffle form display for new winners
    const formBox = document.getElementById('lead-form-box');
    const successBox = document.getElementById('lead-success-box');
    const btnSubmitLead = document.getElementById('btn-submit-lead');
    if (formBox) formBox.classList.remove('hidden');
    if (successBox) successBox.classList.add('hidden');
    if (btnSubmitLead) {
      btnSubmitLead.disabled = false;
      btnSubmitLead.textContent = 'Çekilişe Kaydol';
    }

    document.getElementById('modal-winner').classList.remove('opacity-0', 'pointer-events-none');
    this.particles.emit(this.V_WIDTH / 2, this.V_HEIGHT / 2, color, 60, 14);

    // If local or bot game, report match to scoreboard API
    if (this.mode === 'local' || this.mode === 'bot') {
      fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p1: this.p1Name,
          p2: this.p2Name,
          s1: this.score[0],
          s2: this.score[1],
          winner: winner,
          loser: loser,
          mode: this.mode
        })
      }).catch(e => console.warn('Match sync error:', e));
    }
  },

  // ==========================================
  // PHYSICS & UPDATE LOOP
  // ==========================================
  updatePhysics() {
    if (this.isPaused || this.isGameOver) return;

    // Calculate paddle velocities
    this.p1Paddle.vx = this.p1Paddle.x - this.p1Paddle.prevX;
    this.p1Paddle.vy = this.p1Paddle.y - this.p1Paddle.prevY;
    this.p1Paddle.prevX = this.p1Paddle.x;
    this.p1Paddle.prevY = this.p1Paddle.y;

    this.p2Paddle.vx = this.p2Paddle.x - this.p2Paddle.prevX;
    this.p2Paddle.vy = this.p2Paddle.y - this.p2Paddle.prevY;
    this.p2Paddle.prevX = this.p2Paddle.x;
    this.p2Paddle.prevY = this.p2Paddle.y;

    // AI Bot Behavior (if in bot mode)
    if (this.mode === 'bot') {
      this.updateBot();
    }

    // Only Host (or offline modes) runs authoritative puck physics
    if (this.mode !== 'qr' || this.isHost) {
      const puck = this.puck;

      // Air cushion friction
      puck.vx *= 0.994;
      puck.vy *= 0.994;

      // Position update
      puck.x += puck.vx;
      puck.y += puck.vy;

      // Speed cap
      const currentSpeed = Math.hypot(puck.vx, puck.vy);
      const maxSpeed = 24;
      if (currentSpeed > maxSpeed) {
        puck.vx = (puck.vx / currentSpeed) * maxSpeed;
        puck.vy = (puck.vy / currentSpeed) * maxSpeed;
      }

      // Record motion trail
      puck.trail.unshift({ x: puck.x, y: puck.y });
      if (puck.trail.length > 7) puck.trail.pop();

      // Side Walls Collision (Left & Right)
      const railMargin = 15;
      if (puck.x - puck.r < railMargin) {
        puck.x = railMargin + puck.r;
        puck.vx = -puck.vx * 0.92;
        this.audio.hitWall();
        this.particles.emit(puck.x, puck.y, '#ffffff', 6, 4);
      } else if (puck.x + puck.r > this.V_WIDTH - railMargin) {
        puck.x = this.V_WIDTH - railMargin - puck.r;
        puck.vx = -puck.vx * 0.92;
        this.audio.hitWall();
        this.particles.emit(puck.x, puck.y, '#ffffff', 6, 4);
      }

      // Goal Checks (Top Goal & Bottom Goal)
      const goalLeft = (this.V_WIDTH - this.GOAL_WIDTH) / 2;
      const goalRight = (this.V_WIDTH + this.GOAL_WIDTH) / 2;

      // Top Wall / Goal
      if (puck.y - puck.r < railMargin) {
        if (puck.x > goalLeft && puck.x < goalRight) {
          // Player 2 Scores!
          this.handleGoalScored('p2', this.score[0], this.score[1] + 1, true);
          return;
        } else {
          puck.y = railMargin + puck.r;
          puck.vy = -puck.vy * 0.92;
          this.audio.hitWall();
          this.particles.emit(puck.x, puck.y, '#ffffff', 6, 4);
        }
      }

      // Bottom Wall / Goal
      if (puck.y + puck.r > this.V_HEIGHT - railMargin) {
        if (puck.x > goalLeft && puck.x < goalRight) {
          // Player 1 Scores!
          this.handleGoalScored('p1', this.score[0] + 1, this.score[1], true);
          return;
        } else {
          puck.y = this.V_HEIGHT - railMargin - puck.r;
          puck.vy = -puck.vy * 0.92;
          this.audio.hitWall();
          this.particles.emit(puck.x, puck.y, '#ffffff', 6, 4);
        }
      }

      // Paddle Collisions
      this.checkPaddleCollision(this.p1Paddle, puck);
      this.checkPaddleCollision(this.p2Paddle, puck);

      // Broadcast puck state to Guest if Host
      if (this.mode === 'qr' && this.isHost && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'puck_sync',
          x: puck.x,
          y: puck.y,
          vx: puck.vx,
          vy: puck.vy
        }));
      }
    }
  },

  checkPaddleCollision(paddle, puck) {
    const dx = puck.x - paddle.x;
    const dy = puck.y - paddle.y;
    const dist = Math.hypot(dx, dy);
    const minDist = paddle.r + puck.r;

    if (dist < minDist && dist > 0) {
      // Separate bodies so they don't stick
      const overlap = minDist - dist;
      const nx = dx / dist;
      const ny = dy / dist;

      puck.x += nx * overlap;
      puck.y += ny * overlap;

      // Elastic impulse + momentum transfer from paddle swing
      const normalVel = puck.vx * nx + puck.vy * ny;
      if (normalVel < 0) {
        const restitution = 1.08;
        const impulse = -(1 + restitution) * normalVel;

        puck.vx += nx * impulse + paddle.vx * 0.65;
        puck.vy += ny * impulse + paddle.vy * 0.65;

        // Ensure minimum lively exit velocity
        const speed = Math.hypot(puck.vx, puck.vy);
        if (speed < 7) {
          puck.vx = (puck.vx / (speed || 1)) * 7;
          puck.vy = (puck.vy / (speed || 1)) * 7;
        }

        const speedRatio = Math.min(speed / 20, 1);
        this.audio.hitPaddle(speedRatio);
        this.particles.emit(puck.x, puck.y, paddle.color, 14, 7);
      }
    }
  },

  // AI Bot logic for Top Paddle (P1)
  updateBot() {
    const bot = this.p1Paddle;
    const puck = this.puck;
    const homeX = this.V_WIDTH / 2;
    const homeY = 140;

    let targetX = homeX;
    let targetY = homeY;

    // If puck is in bot's half or approaching
    if (puck.y < this.V_HEIGHT * 0.65) {
      targetX = puck.x + (Math.random() - 0.5) * 12;
      targetY = Math.min(this.V_HEIGHT / 2 - bot.r - 20, puck.y - 10);

      // Strike forward if puck is close
      if (puck.y < this.V_HEIGHT * 0.45 && Math.abs(puck.x - bot.x) < 50) {
        targetY = puck.y;
      }
    }

    // Smooth movement with human reaction interpolation
    const ease = 0.12;
    bot.x += (targetX - bot.x) * ease;
    bot.y += (targetY - bot.y) * ease;

    // Boundaries
    bot.x = Math.max(bot.r + 15, Math.min(this.V_WIDTH - bot.r - 15, bot.x));
    bot.y = Math.max(bot.r + 15, Math.min(this.V_HEIGHT / 2 - bot.r - 10, bot.y));
  },

  // ==========================================
  // RENDERING ENGINE
  // ==========================================
  render() {
    const ctx = this.ctx;
    const W = this.V_WIDTH;
    const H = this.V_HEIGHT;

    ctx.save();
    ctx.scale(this.scale, this.scale);

    // Clear Canvas
    ctx.clearRect(0, 0, W, H);

    // 1. Table Background & Grid Lines
    this.renderTable(ctx, W, H);

    // 2. Motion Trail behind Puck
    this.renderPuckTrail(ctx);

    // 3. Puck
    this.renderPuck(ctx);

    // 4. Paddles
    this.renderPaddle(ctx, this.p1Paddle);
    this.renderPaddle(ctx, this.p2Paddle);

    // 5. Particles
    this.particles.updateAndDraw(ctx);

    ctx.restore();
  },

  renderTable(ctx, W, H) {
    const rail = 15;
    const goalW = this.GOAL_WIDTH;
    const goalLeft = (W - goalW) / 2;
    const goalRight = (W + goalW) / 2;

    // Table Border Glow
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 4;
    ctx.strokeRect(rail, rail, W - rail * 2, H - rail * 2);

    // Center Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rail, H / 2);
    ctx.lineTo(W - rail, H / 2);
    ctx.stroke();

    // Center Circle & SET Arena emblem
    ctx.strokeStyle = 'rgba(255, 46, 59, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 75, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.font = 'bold 22px "Bebas Neue", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SET ARENA', W / 2, H / 2);

    // Goals (Top & Bottom Cutouts with glowing goal neon)
    // Top Goal (Red side)
    ctx.fillStyle = 'rgba(255, 46, 59, 0.25)';
    ctx.fillRect(goalLeft, 0, goalW, rail + 6);
    ctx.strokeStyle = '#FF2E3B';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(goalLeft, rail);
    ctx.lineTo(goalLeft, 0);
    ctx.moveTo(goalRight, rail);
    ctx.lineTo(goalRight, 0);
    ctx.stroke();

    // Bottom Goal (Blue side)
    ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
    ctx.fillRect(goalLeft, H - rail - 6, goalW, rail + 6);
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(goalLeft, H - rail);
    ctx.lineTo(goalLeft, H);
    ctx.moveTo(goalRight, H - rail);
    ctx.lineTo(goalRight, H);
    ctx.stroke();
  },

  renderPuckTrail(ctx) {
    const trail = this.puck.trail;
    for (let i = 0; i < trail.length; i++) {
      const alpha = (1 - i / trail.length) * 0.35;
      const size = this.puck.r * (1 - i / trail.length * 0.4);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#FF2E3B';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(trail[i].x, trail[i].y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },

  renderPuck(ctx) {
    const p = this.puck;
    ctx.save();

    // Outer glow
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();

    // Inner sports ring
    ctx.strokeStyle = '#E30613';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r - 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  },

  renderPaddle(ctx, paddle) {
    ctx.save();

    // Outer neon glow
    ctx.shadowColor = paddle.color;
    ctx.shadowBlur = 20;

    // Main Mallet Body
    ctx.fillStyle = paddle.color;
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, paddle.r, 0, Math.PI * 2);
    ctx.fill();

    // Inner Metallic Knob / Handle
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#10131A';
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, paddle.r * 0.58, 0, Math.PI * 2);
    ctx.fill();

    // Center Grip Ring
    ctx.strokeStyle = paddle.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, paddle.r * 0.3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  },

  loop(timestamp) {
    this.updatePhysics();
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }
};

// Bootstrap on DOM Ready
window.addEventListener('DOMContentLoaded', () => {
  Game.init();
});
