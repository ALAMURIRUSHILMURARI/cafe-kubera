/* ==========================================================================
   CAFE KUBERA - INTERACTIVE SCRIPTS
   ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {


  // ==========================================
  // 2. IMMERSIVE MORPHING LIQUID BACKGROUND
  // ==========================================
  const bgCanvas = document.getElementById('liquid-bg');
  const bgCtx = bgCanvas.getContext('2d');
  
  function resizeBg() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeBg);
  resizeBg();
  
  // Blobs representation: Seafoam Teal (mapped to goldish), Terracotta (ruby), Sand (crema)
  const blobs = [
    {
      x: window.innerWidth * 0.2,
      y: window.innerHeight * 0.3,
      r: Math.max(window.innerWidth * 0.25, 250),
      vx: 0.4,
      vy: 0.3,
      color: 'rgba(212, 175, 55, 0.04)', // Golden Crema
      phase: 0,
      phaseSpeed: 0.002
    },
    {
      x: window.innerWidth * 0.8,
      y: window.innerHeight * 0.7,
      r: Math.max(window.innerWidth * 0.28, 280),
      vx: -0.3,
      vy: -0.4,
      color: 'rgba(128, 12, 18, 0.03)', // Crimson Velvet
      phase: Math.PI / 3,
      phaseSpeed: 0.0015
    },
    {
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.5,
      r: Math.max(window.innerWidth * 0.22, 220),
      vx: 0.25,
      vy: -0.25,
      color: 'rgba(250, 246, 240, 0.05)', // Cream Sand
      phase: Math.PI * 2 / 3,
      phaseSpeed: 0.0025
    }
  ];
  
  function animateBlobs() {
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    bgCtx.fillStyle = '#050505';
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    
    blobs.forEach(blob => {
      // Float / boundary-collision
      blob.x += blob.vx;
      blob.y += blob.vy;
      
      if (blob.x - blob.r < 0 || blob.x + blob.r > bgCanvas.width) {
        blob.vx *= -1;
      }
      if (blob.y - blob.r < 0 || blob.y + blob.r > bgCanvas.height) {
        blob.vy *= -1;
      }
      
      // Update animation phase
      blob.phase += blob.phaseSpeed;
      
      // Draw morphing blob using quadratic curves and sine-wave offsets
      bgCtx.beginPath();
      const pointsCount = 8;
      const step = (Math.PI * 2) / pointsCount;
      
      for (let i = 0; i < pointsCount; i++) {
        const angle = i * step;
        // Calculate offset radius using sine wave
        const waveOffset = Math.sin(blob.phase + angle * 2) * 25;
        const currentRadius = blob.r + waveOffset;
        
        const px = blob.x + Math.cos(angle) * currentRadius;
        const py = blob.y + Math.sin(angle) * currentRadius;
        
        if (i === 0) {
          bgCtx.moveTo(px, py);
        } else {
          bgCtx.lineTo(px, py);
        }
      }
      
      bgCtx.closePath();
      bgCtx.fillStyle = blob.color;
      bgCtx.fill();
    });
    
    requestAnimationFrame(animateBlobs);
  }
  animateBlobs();


  // ==========================================
  // 3. DYNAMIC DOUBLE-PAGE FLIPBOOK MENU
  // ==========================================
  const flipPrev = document.getElementById('flip-prev');
  const flipNext = document.getElementById('flip-next');
  const currentSpreadEl = document.getElementById('current-spread');
  const pages = [
    document.getElementById('page-1'),
    document.getElementById('page-2'),
    document.getElementById('page-3'),
    document.getElementById('page-4')
  ];
  
  let currentSpread = 1; // 1: Cover & Page 2, 2: Page 3 & Page 4
  const totalSpreads = 2;
  
  function updateFlipbook() {
    const isMobile = window.innerWidth < 768;
    
    if (isMobile) {
      // Mobile Stack Mode: show pages matching current spread
      pages.forEach((page, index) => {
        page.classList.remove('active', 'flipped-left');
        page.style.transform = 'none';
        
        if (currentSpread === 1) {
          if (index < 2) page.classList.add('active');
        } else {
          if (index >= 2) page.classList.add('active');
        }
      });
    } else {
      // Desktop 3D Spread Mode
      pages.forEach((page, index) => {
        page.classList.remove('active', 'flipped-left');
        
        if (currentSpread === 1) {
          // Spread 1 (Page 1 Cover & Page 2)
          if (index === 0) {
            page.classList.add('active');
            page.style.transform = 'rotateY(0deg)';
          } else if (index === 1) {
            page.classList.add('active');
            page.style.transform = 'rotateY(0deg)';
          } else {
            page.style.transform = 'rotateY(0deg)';
          }
        } else {
          // Spread 2 (Page 3 & Page 4)
          if (index === 0) {
            page.classList.add('flipped-left');
            page.style.transform = 'rotateY(-180deg)';
          } else if (index === 1) {
            page.classList.add('flipped-left');
            page.style.transform = 'rotateY(-180deg)';
          } else if (index === 2) {
            page.classList.add('active');
            page.style.transform = 'rotateY(0deg)';
          } else if (index === 3) {
            page.classList.add('active');
            page.style.transform = 'rotateY(0deg)';
          }
        }
      });
    }
    
    currentSpreadEl.textContent = currentSpread;
    flipPrev.disabled = currentSpread === 1;
    flipNext.disabled = currentSpread === totalSpreads;
  }
  
  flipPrev.addEventListener('click', () => {
    if (currentSpread > 1) {
      currentSpread--;
      updateFlipbook();
    }
  });
  
  flipNext.addEventListener('click', () => {
    if (currentSpread < totalSpreads) {
      currentSpread++;
      updateFlipbook();
    }
  });
  
  window.addEventListener('resize', updateFlipbook);
  updateFlipbook();


  // ==========================================
  // 4. INTERACTIVE FRENCH PRESS COFFEE BREWER
  // ==========================================
  const brewCanvas = document.getElementById('coffee-press-canvas');
  const brewCtx = brewCanvas.getContext('2d');
  
  // Dimensions & scaling
  let canvasWidth = 400;
  let canvasHeight = 400;
  let scale = 1;
  
  function resizeBrewCanvas() {
    const rect = brewCanvas.parentElement.getBoundingClientRect();
    canvasWidth = rect.width;
    canvasHeight = rect.height;
    brewCanvas.width = canvasWidth;
    brewCanvas.height = canvasHeight;
    scale = canvasWidth / 400;
  }
  window.addEventListener('resize', resizeBrewCanvas);
  resizeBrewCanvas();
  
  // State variables
  let targetProgress = 0; // 0 (top) to 1 (bottom) plunger Y travel
  let currentProgress = 0;
  let isDragging = false;
  let dragY = 0;
  
  // UI metrics displays
  const metricPressure = document.getElementById('metric-pressure');
  const metricStage = document.getElementById('metric-stage');
  const metricColorVal = document.getElementById('metric-color');
  
  // Glaze Roasts Setup
  const roasts = {
    crema: { rgb: [212, 175, 55], name: 'Golden Crema' },
    velvet: { rgb: [128, 12, 18], name: 'Crimson Velvet' },
    mist: { rgb: [9, 121, 105], name: 'Emerald Mist' },
    mocha: { rgb: [139, 69, 19], name: 'Royal Mocha' },
    dark: { rgb: [47, 47, 47], name: 'Midnight Dark' }
  };
  
  let currentRoastRGB = [212, 175, 55]; // Golden Crema
  let targetRoastRGB = [212, 175, 55];
  
  const glazeBtns = document.querySelectorAll('.glaze-btn');
  glazeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      glazeBtns.forEach(b => b.classList.remove('active'));
      const activeBtn = e.currentTarget;
      activeBtn.classList.add('active');
      
      const roastKey = activeBtn.getAttribute('data-roast');
      targetRoastRGB = roasts[roastKey].rgb;
    });
  });
  
  // Coffee ground particles swirling below plunger
  class CoffeeGround {
    constructor(cx, cy, beakerW, beakerH) {
      this.cx = cx;
      this.cy = cy;
      this.beakerW = beakerW;
      this.beakerH = beakerH;
      this.reset();
    }
    
    reset() {
      this.x = this.cx + (Math.random() - 0.5) * (this.beakerW - 10) * scale;
      this.y = this.cy + (Math.random() - 0.2) * (this.beakerH / 2) * scale;
      this.r = 1 + Math.random() * 2;
      this.speedX = (Math.random() - 0.5) * 0.8;
      this.speedY = 0.2 + Math.random() * 0.5;
    }
    
    update(plungerY) {
      this.x += this.speedX;
      this.y += this.speedY;
      
      const rightBound = this.cx + (this.beakerW/2 - 5) * scale;
      const leftBound = this.cx - (this.beakerW/2 - 5) * scale;
      const bottomBound = this.cy + (this.beakerH/2 - 10) * scale;
      
      if (this.x > rightBound || this.x < leftBound) this.speedX *= -1;
      
      // If particles get caught above plunger (e.g. initial load or quick slides), push them below it
      if (this.y < plungerY && plungerY < bottomBound) {
        this.y = plungerY + 3 * scale;
        this.speedY = Math.abs(this.speedY) + 0.2;
      }
      
      if (this.y > bottomBound) {
        // Reset just below current plunger
        this.y = plungerY + 5 * scale;
        this.x = this.cx + (Math.random() - 0.5) * (this.beakerW - 15) * scale;
      }
    }
    
    draw(ctx) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * scale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(65, 48, 35, 0.7)';
      ctx.fill();
    }
  }
  
  // Steam / Aroma particles rising out of French Press
  class SteamParticle {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = -0.5 - Math.random() * 0.8;
      this.life = 1.0;
      this.decay = 0.01 + Math.random() * 0.015;
      this.size = 2 + Math.random() * 3;
    }
    
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.life -= this.decay;
    }
    
    draw(ctx, color) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * scale * (1 + (1 - this.life) * 1.5), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${this.life * 0.12})`;
      ctx.fill();
    }
  }
  
  let grounds = [];
  let steam = [];
  
  // Dragging and pressing interactions
  function handleDragStart(y) {
    isDragging = true;
    dragY = y;
    document.body.classList.add('shaping-cursor');
  }
  
  function handleDragMove(y) {
    if (!isDragging) return;
    
    const rect = brewCanvas.getBoundingClientRect();
    const relativeY = y - rect.top;
    
    // Map middle 60% of canvas height to plunger travel
    const startTravel = rect.height * 0.22;
    const endTravel = rect.height * 0.78;
    const travelLen = endTravel - startTravel;
    const progress = Math.min(Math.max((relativeY - startTravel) / travelLen, 0), 1);
    
    targetProgress = progress;
  }
  
  function handleDragEnd() {
    isDragging = false;
    document.body.classList.remove('shaping-cursor');
  }
  
  // Mouse Events
  brewCanvas.addEventListener('mousedown', (e) => {
    handleDragStart(e.clientY);
  });
  
  window.addEventListener('mousemove', (e) => {
    handleDragMove(e.clientY);
  });
  
  window.addEventListener('mouseup', () => {
    handleDragEnd();
  });
  
  // Touch Events
  brewCanvas.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      handleDragStart(e.touches[0].clientY);
    }
  });
  
  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      handleDragMove(e.touches[0].clientY);
    }
  });
  
  window.addEventListener('touchend', () => {
    handleDragEnd();
  });
  
  // Drawing Loop
  function drawBrewSimulator() {
    brewCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // 1. RGB LERP color of the extraction stream
    for (let i = 0; i < 3; i++) {
      currentRoastRGB[i] += (targetRoastRGB[i] - currentRoastRGB[i]) * 0.06;
    }
    
    const activeColorStr = `rgb(${Math.round(currentRoastRGB[0])}, ${Math.round(currentRoastRGB[1])}, ${Math.round(currentRoastRGB[2])})`;
    metricColorVal.textContent = activeColorStr;
    
    // 2. LERP extraction progress
    currentProgress += (targetProgress - currentProgress) * 0.1;
    
    // Update metrics UI
    metricPressure.textContent = `${Math.round(currentProgress * 100)}%`;
    if (currentProgress < 0.15) {
      metricStage.textContent = "Grounds Steeping";
      metricStage.style.color = "var(--text-sand)";
    } else if (currentProgress < 0.85) {
      metricStage.textContent = "Filtering Liquid";
      metricStage.style.color = "var(--accent-gold)";
    } else {
      metricStage.textContent = "Golden Brew Pressed";
      metricStage.style.color = "#FFDF00";
    }
    
    // Center point of canvas
    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;
    const beakerW = 150;
    const beakerH = 250;
    
    // Initialize coffee ground particles
    if (grounds.length === 0) {
      for (let i = 0; i < 75; i++) {
        grounds.push(new CoffeeGround(cx, cy, beakerW, beakerH));
      }
    }
    
    // Beaker coordinate helpers
    const bx = cx - (beakerW / 2) * scale;
    const by = cy - (beakerH / 2) * scale;
    const bw = beakerW * scale;
    const bh = beakerH * scale;
    const bottomY = cy + (beakerH / 2) * scale;
    const startY = cy - (beakerH / 2 - 20) * scale;
    const travelH = (beakerH - 60) * scale;
    
    // Plunger vertical position
    const plungerY = startY + currentProgress * travelH;
    
    // 3. Draw Beaker Liquid Layers
    // Liquid below plunger: Dark, opaque, steeping coffee grounds
    brewCtx.save();
    brewCtx.beginPath();
    brewCtx.rect(bx, plungerY, bw, bottomY - plungerY);
    // Deep rich dark coffee body
    brewCtx.fillStyle = 'rgba(28, 17, 10, 0.95)';
    brewCtx.fill();
    brewCtx.restore();
    
    // Liquid above plunger: Clear filtered coffee liquid. Opaque capacity increases with filter depth.
    brewCtx.save();
    brewCtx.beginPath();
    brewCtx.rect(bx, startY, bw, plungerY - startY);
    const filterAlpha = 0.12 + currentProgress * 0.68;
    brewCtx.fillStyle = `rgba(${currentRoastRGB[0]}, ${currentRoastRGB[1]}, ${currentRoastRGB[2]}, ${filterAlpha})`;
    brewCtx.fill();
    brewCtx.restore();
    
    // 4. Update & Draw Grounds (confined below the plunger filter)
    grounds.forEach(g => {
      g.update(plungerY);
      g.draw(brewCtx);
    });
    
    // 5. Sediment layer at bottom of glass (compacts as filter goes down)
    const maxSedimentH = 35 * scale;
    const minSedimentH = 12 * scale;
    const sedimentH = maxSedimentH - (maxSedimentH - minSedimentH) * currentProgress;
    
    brewCtx.beginPath();
    brewCtx.rect(bx + 1, bottomY - sedimentH, bw - 2, sedimentH);
    brewCtx.fillStyle = 'rgba(38, 24, 15, 0.98)';
    brewCtx.fill();
    
    // 6. Draw Plunger System (Golden Metallic Handle, Shaft, and Filter Disc)
    // Plunger Shaft
    const handleTopY = by - 20 * scale;
    brewCtx.beginPath();
    brewCtx.moveTo(cx, handleTopY);
    brewCtx.lineTo(cx, plungerY);
    brewCtx.strokeStyle = '#D4AF37'; // Golden plunger rod
    brewCtx.lineWidth = 3.5 * scale;
    brewCtx.stroke();
    
    // Plunger Top Knob Handle
    brewCtx.beginPath();
    brewCtx.arc(cx, handleTopY, 12 * scale, 0, Math.PI * 2);
    brewCtx.fillStyle = '#D4AF37';
    brewCtx.fill();
    // Highlight reflection on knob
    brewCtx.beginPath();
    brewCtx.arc(cx - 3 * scale, handleTopY - 3 * scale, 3 * scale, 0, Math.PI * 2);
    brewCtx.fillStyle = '#FAF6F0';
    brewCtx.fill();
    
    // Plunger Mesh Filter Disc
    brewCtx.save();
    brewCtx.beginPath();
    brewCtx.ellipse(cx, plungerY, (beakerW/2 - 2) * scale, 8 * scale, 0, 0, Math.PI * 2);
    brewCtx.fillStyle = 'rgba(212, 175, 55, 0.35)'; // Sieve mesh fill
    brewCtx.strokeStyle = '#D4AF37';
    brewCtx.lineWidth = 2 * scale;
    brewCtx.fill();
    brewCtx.stroke();
    
    // Mesh ring details
    brewCtx.beginPath();
    brewCtx.ellipse(cx, plungerY, (beakerW/2 - 12) * scale, 5 * scale, 0, 0, Math.PI * 2);
    brewCtx.strokeStyle = 'rgba(250, 246, 240, 0.4)';
    brewCtx.setLineDash([4 * scale, 2 * scale]);
    brewCtx.stroke();
    brewCtx.restore();
    
    // 7. Glowing Seal Ring and contact dots around plunger (activated on drag)
    if (isDragging) {
      brewCtx.save();
      brewCtx.beginPath();
      brewCtx.ellipse(cx, plungerY, (beakerW/2) * scale, 8 * scale, 0, 0, Math.PI * 2);
      brewCtx.strokeStyle = '#3AB4B9'; // Electric turquoise highlight
      brewCtx.lineWidth = 2 * scale;
      brewCtx.shadowBlur = 10;
      brewCtx.shadowColor = '#3AB4B9';
      brewCtx.stroke();
      
      // Left and Right contact dots
      brewCtx.beginPath();
      brewCtx.arc(cx - (beakerW/2) * scale, plungerY, 4 * scale, 0, Math.PI * 2);
      brewCtx.arc(cx + (beakerW/2) * scale, plungerY, 4 * scale, 0, Math.PI * 2);
      brewCtx.fillStyle = '#D36B4E'; // Terracotta dust indicator
      brewCtx.shadowColor = '#D36B4E';
      brewCtx.fill();
      brewCtx.restore();
    }
    
    // 8. Draw Beaker Glass Container & Framing
    // Beaker body frame
    brewCtx.beginPath();
    brewCtx.rect(bx, by, bw, bh);
    brewCtx.strokeStyle = 'rgba(250, 246, 240, 0.2)';
    brewCtx.lineWidth = 2.5 * scale;
    brewCtx.stroke();
    
    // Premium beaker metal base and support frames
    brewCtx.beginPath();
    brewCtx.rect(bx - 6 * scale, bottomY - 8 * scale, bw + 12 * scale, 16 * scale);
    brewCtx.fillStyle = '#181512';
    brewCtx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
    brewCtx.lineWidth = 1.5 * scale;
    brewCtx.fill();
    brewCtx.stroke();
    
    // Beaker glass reflections (vertical highlight curves)
    brewCtx.beginPath();
    brewCtx.moveTo(bx + 12 * scale, by + 15 * scale);
    brewCtx.lineTo(bx + 12 * scale, bottomY - 15 * scale);
    brewCtx.strokeStyle = 'rgba(250, 246, 240, 0.08)';
    brewCtx.lineWidth = 3.5 * scale;
    brewCtx.stroke();
    
    // 9. Generate & Draw steam rising from top
    if (isDragging && Math.random() < 0.25) {
      steam.push(new SteamParticle(cx + (Math.random() - 0.5) * 45 * scale, by + 5 * scale));
    }
    
    steam = steam.filter(p => p.life > 0);
    steam.forEach(p => {
      p.update();
      p.draw(brewCtx, currentRoastRGB);
    });
    
    requestAnimationFrame(drawBrewSimulator);
  }
  drawBrewSimulator();


  // ==========================================
  // 5. 3D PARALLAX GLARE CARDS
  // ==========================================
  const cards = document.querySelectorAll('.parallax-card');
  
  cards.forEach(card => {
    const inner = card.querySelector('.card-inner');
    const sheen = card.querySelector('.card-sheen');
    
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left; // cursor relative x
      const y = e.clientY - rect.top;  // cursor relative y
      
      const width = rect.width;
      const height = rect.height;
      
      // Calculate tilt angles based on cursor offset from center
      const tiltX = ((y / height) - 0.5) * -24; // max 12 deg
      const tiltY = ((x / width) - 0.5) * 24;
      
      inner.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.02)`;
      
      // Append radial gradient sheen light reflection
      const pctX = (x / width) * 100;
      const pctY = (y / height) * 100;
      sheen.style.background = `radial-gradient(circle at ${pctX}% ${pctY}%, rgba(255, 255, 255, 0.15) 0%, transparent 60%)`;
    });
    
    card.addEventListener('mouseleave', () => {
      inner.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
      sheen.style.background = 'none';
    });
  });


  // ==========================================
  // 6. LIGHTBOX MODAL & GALLERY ITEMS DETAILS
  // ==========================================
  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxClose = document.getElementById('lightbox-close');
  
  const modalSymbol = document.getElementById('modal-symbol');
  const modalTag = document.getElementById('modal-tag');
  const modalTitle = document.getElementById('modal-title');
  const modalDesc = document.getElementById('modal-desc');
  const modalMetadataLabel = document.getElementById('modal-metadata-label');
  const modalMetadataVal = document.getElementById('modal-metadata-val');
  
  // Specific data for each gallery card
  const galleryDetails = {
    1: {
      symbol: '☕',
      tag: 'Artisan Espresso',
      title: 'Saffron Gold Latte',
      desc: 'Our flagship specialty latte crafted with premium Araku Valley beans, infused with pure organic saffron threads, and finished with a dusting of 24k gold powder. Balanced, sweet, and luxurious.',
      metaLabel: 'Roast Profile',
      metaVal: 'Medium-Light (Chikmagalur / Araku)'
    },
    2: {
      symbol: '🍷',
      tag: 'Signature Tonic',
      title: 'Crimson Cold Brew',
      desc: 'Our single-origin cold brew steeped for 18 hours, layered precisely over crushed organic hibiscus petals and fresh lime extract. Refreshing, floral, with a tangy luxury finish.',
      metaLabel: 'Brew Type',
      metaVal: 'Steeped Cold Extraction'
    },
    3: {
      symbol: '🥐',
      tag: 'Artisan Pastry',
      title: 'Cardamom Croissant',
      desc: 'Twice-baked buttery croissants layered with a rich cardamom almond paste. Warm, flaky, spiced with high-quality green cardamom pods sourced from local estates.',
      metaLabel: 'Pastry Base',
      metaVal: 'French Butter Pastry'
    },
    4: {
      symbol: '🏺',
      tag: 'Luxury Spaces',
      title: 'The Kubera Lounge',
      desc: 'Welcome to the inner sanctuary of Cafe Kubera. Featuring custom velvet furniture, brushed brass accents, and subtle vintage details, this heritage lounge is designed to honor comfort and specialty coffee culture.',
      metaLabel: 'Capacity',
      metaVal: 'Reservations Required (Max 12 seats)'
    }
  };
  
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-gallery-id');
      const details = galleryDetails[id];
      
      if (details) {
        modalSymbol.textContent = details.symbol;
        modalTag.textContent = details.tag;
        modalTitle.textContent = details.title;
        modalDesc.textContent = details.desc;
        modalMetadataLabel.textContent = details.metaLabel;
        modalMetadataVal.textContent = details.metaVal;
        
        lightboxModal.classList.add('active');
      }
    });
  });
  
  lightboxClose.addEventListener('click', () => {
    lightboxModal.classList.remove('active');
  });
  
  lightboxModal.addEventListener('click', (e) => {
    if (e.target === lightboxModal) {
      lightboxModal.classList.remove('active');
    }
  });


  // ==========================================
  // 7. DYNAMIC CALENDAR & RESERVATION ENGINE
  // ==========================================
  const calendarMonthYear = document.getElementById('calendar-month-year');
  const calendarDays = document.getElementById('calendar-days');
  const calPrev = document.getElementById('cal-prev');
  const calNext = document.getElementById('cal-next');
  const selectedDateInput = document.getElementById('selected-date');
  
  let currentDate = new Date();
  let today = new Date();
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    calendarMonthYear.textContent = `${months[month]} ${year}`;
    calendarDays.innerHTML = '';
    
    // First day of current month (0 is Sunday, 1 is Monday...)
    const firstDayIndex = new Date(year, month, 1).getDay();
    
    // Total days in current month
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    // Add empty cell columns for weekdays offset
    for (let i = 0; i < firstDayIndex; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.classList.add('calendar-cell', 'empty');
      calendarDays.appendChild(emptyCell);
    }
    
    // Generate actual day elements
    for (let day = 1; day <= totalDays; day++) {
      const cell = document.createElement('div');
      cell.classList.add('calendar-cell');
      cell.textContent = day;
      
      const thisCellDate = new Date(year, month, day);
      
      // Disable past dates
      // Strip hours to check same-day correctness
      const compareDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      if (thisCellDate < compareDate) {
        cell.classList.add('disabled');
      } else {
        cell.addEventListener('click', () => {
          // Deselect previous
          const prevSelected = calendarDays.querySelector('.selected');
          if (prevSelected) prevSelected.classList.remove('selected');
          
          cell.classList.add('selected');
          selectedDateInput.value = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        });
      }
      
      calendarDays.appendChild(cell);
    }
  }
  
  calPrev.addEventListener('click', () => {
    // Only allow going back if it is not a past month
    const currentLimit = new Date();
    if (currentDate.getFullYear() > currentLimit.getFullYear() || 
        currentDate.getMonth() > currentLimit.getMonth()) {
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderCalendar();
    }
  });
  
  calNext.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });
  
  renderCalendar();

  
  // Time Slots generation and selection
  const timeSlotsContainer = document.getElementById('time-slots');
  const selectedTimeInput = document.getElementById('selected-time');
  
  function generateTimeSlots() {
    if (!timeSlotsContainer) return;
    timeSlotsContainer.innerHTML = '';
    
    // Operating hours: 9:00 AM to 11:00 PM
    // Slots span 9:00 AM to 10:00 PM (varying every 30 mins)
    for (let hour = 9.0; hour <= 22.0; hour += 0.5) {
      const h = Math.floor(hour);
      const m = (hour % 1 === 0) ? '00' : '30';
      
      const ampm = h >= 12 ? 'PM' : 'AM';
      let displayHour = h % 12;
      if (displayHour === 0) displayHour = 12;
      
      const timeStr = `${String(displayHour).padStart(2, '0')}:${m} ${ampm}`;
      
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'time-slot-btn';
      button.setAttribute('data-time', timeStr);
      button.textContent = timeStr;
      
      timeSlotsContainer.appendChild(button);
    }
  }
  
  generateTimeSlots();
  
  if (timeSlotsContainer) {
    timeSlotsContainer.addEventListener('click', (e) => {
      const slot = e.target.closest('.time-slot-btn');
      if (!slot || slot.classList.contains('disabled')) return;
      
      // Deselect other slots
      timeSlotsContainer.querySelectorAll('.time-slot-btn').forEach(s => s.classList.remove('selected'));
      
      // Select this slot
      slot.classList.add('selected');
      selectedTimeInput.value = slot.getAttribute('data-time');
    });
  }
  
  // Form submission and Toast messaging
  const form = document.getElementById('reservation-form');
  const toast = document.getElementById('booking-toast');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('booking-name').value;
    const email = document.getElementById('booking-email').value;
    const phone = document.getElementById('booking-phone').value;
    const guests = parseInt(document.getElementById('booking-guests').value, 10);
    const dateVal = selectedDateInput.value;
    const timeVal = selectedTimeInput.value;
    
    if (!dateVal) {
      alert("Please select a reservation date.");
      return;
    }
    if (!timeVal) {
      alert("Please select a reservation time slot.");
      return;
    }
    
    // Format Time: convert e.g., '03:00 PM' to '15:00'
    let formattedTime = timeVal;
    const timeMatch = timeVal.match(/^(\d{2}):(\d{2})\s*(AM|PM)$/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2];
      const ampm = timeMatch[3].toUpperCase();
      
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      
      formattedTime = `${String(hours).padStart(2, '0')}:${minutes}`;
    }
    
    // Enforce booking window validation (max 24 hours in advance, at least 1 minute prior)
    const [year, month, day] = dateVal.split('-');
    const [hour, min] = formattedTime.split(':');
    const selectedDateTime = new Date(year, month - 1, day, hour, min);
    const now = new Date();
    const minAdvanceTime = new Date(now.getTime() + 1 * 60 * 1000);
    const maxAdvanceTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    if (selectedDateTime < minAdvanceTime) {
      alert("Reservations must be made at least 1 minute in advance.");
      return;
    }
    if (selectedDateTime > maxAdvanceTime) {
      alert("Reservations can only be made up to 24 hours in advance.");
      return;
    }
    
    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          email: email,
          phone: phone,
          guests: guests,
          date: dateVal,
          time: formattedTime
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Success Toast trigger
        toast.querySelector('.toast-message').textContent = `Thank you ${name}! Table ${result.table} is reserved for ${dateVal} at ${timeVal}.`;
        toast.classList.add('show');
        
        // Clear selections & Form
        form.reset();
        if (timeSlotsContainer) {
          timeSlotsContainer.querySelectorAll('.time-slot-btn').forEach(s => s.classList.remove('selected'));
        }
        selectedTimeInput.value = '';
        const prevSel = calendarDays.querySelector('.selected');
        if (prevSel) prevSel.classList.remove('selected');
        selectedDateInput.value = '';
        
        // Hide toast after duration
        setTimeout(() => {
          toast.classList.remove('show');
        }, 4500);
      } else {
        alert(result.error || "Failed to make reservation. No tables might be available at this time.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred during booking. Please try again.");
    }
  });
  
});
