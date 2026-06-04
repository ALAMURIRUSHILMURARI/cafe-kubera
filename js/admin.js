document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // 1. PROMISE-DRIVEN CUSTOM MODAL
  // ==========================================
  const modalOverlay = document.getElementById('custom-confirm-modal');
  const modalIcon = document.getElementById('modal-icon');
  const modalTitle = document.getElementById('modal-title-text');
  const modalMessage = document.getElementById('modal-message-text');
  const modalConfirmBtn = document.getElementById('modal-confirm-btn');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');

  let modalResolver = null;

  function askConfirmation(title, message, icon = '✦') {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalIcon.textContent = icon;
    
    // Show modal
    modalOverlay.classList.add('active');
    
    return new Promise((resolve) => {
      modalResolver = resolve;
    });
  }

  modalConfirmBtn.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
    if (modalResolver) modalResolver(true);
  });

  modalCancelBtn.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
    if (modalResolver) modalResolver(false);
  });

  // Close modal if clicked outside
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.classList.remove('active');
      if (modalResolver) modalResolver(false);
    }
  });


  // ==========================================
  // 2. REAL-TIME DATA FETCHING & RENDERING
  // ==========================================
  const tableGridMap = document.getElementById('table-grid-map');
  const reservationsFeed = document.getElementById('reservations-list-feed');
  
  const statTotalRes = document.getElementById('stat-total-res');
  const statAvailableTbl = document.getElementById('stat-available-tbl');
  const statReservedTbl = document.getElementById('stat-reserved-tbl');
  const statOccupiedTbl = document.getElementById('stat-occupied-tbl');

  let tablesData = [];
  let reservationsData = [];
  let timers = [];

  // Polling loop
  async function refreshDashboard() {
    try {
      const tablesRes = await fetch('/api/tables');
      tablesData = await tablesRes.json();
      
      const resRes = await fetch('/api/reservations');
      reservationsData = await resRes.json();
      
      clearAllTimers();
      renderStats();
      renderTableMap();
      renderReservationsFeed();
    } catch (err) {
      console.error("Error updating dashboard data:", err);
    }
  }

  function renderStats() {
    statTotalRes.textContent = reservationsData.length;
    
    let availCount = 0;
    let resCount = 0;
    let occCount = 0;
    
    tablesData.forEach(tbl => {
      if (tbl.status === 'available') availCount++;
      else if (tbl.status === 'reserved') resCount++;
      else occCount++; // occupied and blocked-walkin
    });
    
    statAvailableTbl.textContent = availCount;
    statReservedTbl.textContent = resCount;
    statOccupiedTbl.textContent = occCount;
  }

  function renderTableMap() {
    tableGridMap.innerHTML = '';
    
    tablesData.forEach(tbl => {
      const card = document.createElement('div');
      card.classList.add('table-card', tbl.status);
      
      // Header
      const header = document.createElement('div');
      header.classList.add('table-card-header');
      const numLabel = document.createElement('span');
      numLabel.classList.add('table-num');
      numLabel.textContent = `Table ${tbl.id}`; // String ID e.g. A1
      const badge = document.createElement('span');
      badge.classList.add('table-status-badge');
      badge.textContent = `${tbl.status.replace('-', ' ')} (${tbl.capacity} pax)`;
      
      header.appendChild(numLabel);
      header.appendChild(badge);
      card.appendChild(header);
      
      // Details container
      const details = document.createElement('div');
      details.classList.add('table-details');
      
      // Button for actions
      const actionBtn = document.createElement('button');
      actionBtn.classList.add('table-card-btn');
      
      // Populate states
      if (tbl.status === 'available') {
        details.innerHTML = `<p>Table is open. Capable of fitting up to ${tbl.capacity} customers.</p>`;
        actionBtn.textContent = 'Block for Walk-in';
        actionBtn.addEventListener('click', () => blockTableWalkIn(tbl.id));
      } 
      else if (tbl.status === 'reserved') {
        // Find matching reservation
        const activeRes = reservationsData.find(r => r.id === tbl.currentReservationId);
        if (activeRes) {
          details.innerHTML = `
            <p class="table-details-name">${activeRes.name}</p>
            <p>Time: ${activeRes.time}</p>
            <p>Phone: ${activeRes.phone}</p>
          `;
          
          // Add hold timer countdown
          const timerDiv = document.createElement('div');
          timerDiv.classList.add('table-timer');
          details.appendChild(timerDiv);
          
          setupHoldTimer(activeRes, timerDiv);
          
          actionBtn.textContent = 'Customer Reached';
          actionBtn.addEventListener('click', () => markCustomerReached(activeRes.id));
        } else {
          details.innerHTML = '<p>Loading reservation details...</p>';
          actionBtn.textContent = 'Release Table';
          actionBtn.addEventListener('click', () => releaseTable(tbl.id));
        }
      } 
      else if (tbl.status === 'occupied') {
        const activeRes = reservationsData.find(r => r.id === tbl.currentReservationId);
        if (activeRes) {
          details.innerHTML = `
            <p class="table-details-name">${activeRes.name}</p>
            <p>Seated since ${formatTime(activeRes.createdAt)}</p>
          `;
        } else {
          details.innerHTML = '<p>Occupied. Guest details unavailable.</p>';
        }
        actionBtn.textContent = 'Customer Left';
        actionBtn.addEventListener('click', () => releaseTable(tbl.id));
      } 
      else if (tbl.status === 'blocked-walkin') {
        details.innerHTML = '<p>Blocked for offline walk-in guest.</p>';
        actionBtn.textContent = 'Customer Left';
        actionBtn.addEventListener('click', () => releaseTable(tbl.id));
      }
      
      card.appendChild(details);
      card.appendChild(actionBtn);
      tableGridMap.appendChild(card);
    });
  }

  function renderReservationsFeed() {
    reservationsFeed.innerHTML = '';
    
    // Sort reservations - show pending/approved ones first
    const pendingRes = reservationsData.filter(r => r.status === 'pending' || r.status === 'approved');
    
    if (pendingRes.length === 0) {
      reservationsFeed.innerHTML = '<div style="font-size:13px; color:var(--text-sand); text-align:center; padding: 20px;">No pending reservations.</div>';
      return;
    }
    
    pendingRes.forEach(res => {
      const item = document.createElement('div');
      item.classList.add('feed-item');
      
      item.innerHTML = `
        <div class="feed-header">
          <span>Table ${res.table}</span>
          <span>Time: ${res.time}</span>
        </div>
        <div class="feed-name">${res.name}</div>
        <div class="feed-meta">${res.phone} | Date: ${res.date}</div>
      `;
      
      const actions = document.createElement('div');
      actions.classList.add('feed-actions');
      
      const reachedBtn = document.createElement('button');
      reachedBtn.classList.add('feed-btn', 'feed-btn-confirm');
      reachedBtn.textContent = 'Arrived';
      reachedBtn.addEventListener('click', () => markCustomerReached(res.id));
      
      const cancelBtn = document.createElement('button');
      cancelBtn.classList.add('feed-btn', 'feed-btn-cancel');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => cancelReservation(res.id, res.name));
      
      actions.appendChild(reachedBtn);
      actions.appendChild(cancelBtn);
      item.appendChild(actions);
      
      reservationsFeed.appendChild(item);
    });
  }

  // ==========================================
  // 3. ACTION EVENT CONTROLLERS
  // ==========================================
  
  async function blockTableWalkIn(tableId) {
    const confirm = await askConfirmation(
      "Block Table", 
      `Are you sure you want to block Table ${tableId} for an offline walk-in customer? This will prevent online reservations.`,
      '🚪'
    );
    if (!confirm) return;
    
    try {
      const response = await fetch('/api/tables/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: tableId })
      });
      if (response.ok) refreshDashboard();
    } catch (err) {
      console.error(err);
    }
  }

  async function releaseTable(tableId) {
    const confirm = await askConfirmation(
      "Release Table", 
      `Mark guest as left and open Table ${tableId} for new reservations?`,
      '✨'
    );
    if (!confirm) return;
    
    // Check if table is occupied by a reservation, or blocked walk-in
    const table = tablesData.find(t => t.id === tableId);
    
    try {
      // If table has a reservation, mark the reservation as 'left' (unless it is just a walk-in block with a linked upcoming reservation)
      if (table && table.currentReservationId && table.status !== 'blocked-walkin') {
        await fetch('/api/reservations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: table.currentReservationId, status: 'left' })
        });
      } else {
        // Just call table release (for walkins)
        await fetch('/api/tables/release', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: tableId })
        });
      }
      refreshDashboard();
    } catch (err) {
      console.error(err);
    }
  }

  async function markCustomerReached(resId) {
    try {
      const response = await fetch('/api/reservations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: resId, status: 'reached' })
      });
      if (response.ok) refreshDashboard();
    } catch (err) {
      console.error(err);
    }
  }

  async function cancelReservation(resId, name) {
    const confirm = await askConfirmation(
      "Cancel Reservation", 
      `Are you sure you want to cancel the reservation for ${name}?`,
      '⚠️'
    );
    if (!confirm) return;
    
    try {
      const response = await fetch('/api/reservations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: resId, status: 'cancelled' })
      });
      if (response.ok) refreshDashboard();
    } catch (err) {
      console.error(err);
    }
  }


  // ==========================================
  // 4. TIMEOUT & TIME HELPERS
  // ==========================================
  
  function setupHoldTimer(reservation, element) {
    function updateTimer() {
      const now = new Date();
      // Combine Date (YYYY-MM-DD) and Time (HH:MM)
      const resDateTimeStr = `${reservation.date}T${reservation.time}:00`;
      const resTime = new Date(resDateTimeStr);
      const expirationTime = new Date(resTime.getTime() + 20 * 60 * 1000); // 20 minutes hold
      
      const diffMs = expirationTime - now;
      
      if (diffMs <= 0) {
        element.textContent = "Hold window EXPIRED (No-Show)";
        element.style.color = "#E74C3C";
        // Force refresh to trigger backend check immediately
        refreshDashboard();
        return;
      }
      
      const minutes = Math.floor(diffMs / 1000 / 60);
      const seconds = Math.floor((diffMs / 1000) % 60);
      
      if (now < resTime) {
        // Not started yet
        element.textContent = `Starts in ${Math.round((resTime - now)/1000/60)} mins`;
        element.style.color = "var(--accent-gold)";
      } else {
        // Running hold timer
        element.textContent = `Hold expires: ${minutes}m ${seconds}s left`;
        element.style.color = "#E74C3C";
      }
    }
    
    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);
    timers.push(intervalId);
  }

  function clearAllTimers() {
    timers.forEach(t => clearInterval(t));
    timers = [];
  }

  function formatTime(isoStr) {
    if (!isoStr) return "N/A";
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Start polling
  refreshDashboard();
  setInterval(refreshDashboard, 5000); // Poll every 5s

});
