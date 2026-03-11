  const params = new URLSearchParams(location.search);
  const eventId = params.get('id');

  let event = null;
  let seatMap = {};
  let selectedSeats = [];
  let heldSeatIds = [];
  let currentBookingId = null;
  let categories = [];

  const CATEGORY_COLORS = ['#c9a84c', '#5299e0', '#52c97a', '#e05252', '#9b59b6', '#e67e22'];

  if (!eventId) window.location.href = 'index.html';

  async function init() {
    try {
      const [eventData, seatData] = await Promise.all([
        api.get(`/events/${eventId}`),
        api.get(`/seats/${eventId}/seatmap`)
      ]);

      event = eventData.data;
      seatMap = seatData.data;
      categories = event.categories || [];

      renderPage();
    } catch (err) {
      document.getElementById('page-content').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Event Not Found</h3>
          <p>${err.message}</p>
          <a href="index.html" class="btn btn-outline" style="margin-top:1rem;">Back to Events</a>
        </div>`;
    }
  }

  function renderPage() {
    const user = auth.getUser();
    const isOrganizer = user?.id === event.organizerId;
    const minPrice = categories.length ? Math.min(...categories.map(c => Number(c.price))) : 0;

    document.title = `${event.title} — TicketGuard`;

    document.getElementById('page-content').innerHTML = `
      <!-- EVENT HEADER -->
      <div class="event-detail-header">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
          <div style="flex:1;">
            <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.75rem;">
              <a href="index.html" style="color:var(--muted); text-decoration:none; font-size:0.8rem;">← Back</a>
              ${statusBadge(event.status)}
            </div>
            <h1 class="event-detail-title">${event.title}</h1>
            <div class="event-detail-meta">
              <span>📍 ${event.venue || 'TBA'}</span>
              <span>📅 ${formatDate(event.eventDate || event.date_time)}</span>
              <span>🕐 ${formatTime(event.eventDate || event.date_time)}</span>
              <span>👤 ${event.organizer?.name || 'Organizer'}</span>
            </div>
          </div>
          <div style="display:flex; gap:0.75rem; align-items:center;">
            ${isOrganizer ? `<button class="btn btn-outline" onclick="openOrganizerModal()">⚙ Manage Event</button>` : ''}
          </div>
        </div>
        ${event.description ? `<p style="color:var(--muted); margin-top:1rem; max-width:600px; font-size:0.88rem; line-height:1.7;">${event.description}</p>` : ''}
      </div>

      <!-- CATEGORIES -->
      <div style="margin-bottom:1.5rem;">
        <p style="font-size:0.72rem; color:var(--muted); letter-spacing:1px; text-transform:uppercase; margin-bottom:0.75rem;">Seat Categories</p>
        <div class="categories">
          ${categories.map((cat, i) => `
            <div class="category-pill" style="--cat-color: ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}">
              <div class="category-color" style="background:${CATEGORY_COLORS[i % CATEGORY_COLORS.length]};"></div>
              <span>${cat.categoryName || cat.name}</span>
              <span style="color:var(--gold); font-family:'DM Mono',monospace; font-size:0.75rem;">${formatCurrency(cat.price)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- TWO COLUMN LAYOUT -->
      <div class="two-col">
        <!-- SEAT MAP -->
        <div>
          <p style="font-size:0.72rem; color:var(--muted); letter-spacing:1px; text-transform:uppercase; margin-bottom:1rem;">Select Your Seats</p>
          <div class="seatmap-wrapper" id="seatmap-container">
            <div class="stage">STAGE</div>
            <div id="seat-rows"></div>
            <div class="seatmap-legend">
              <div class="legend-item"><div class="legend-dot" style="background:var(--bg3); border:1px solid #333;"></div> Available</div>
              <div class="legend-item"><div class="legend-dot" style="background:var(--gold);"></div> Selected</div>
              <div class="legend-item"><div class="legend-dot" style="background:rgba(82,153,224,0.3); border:1px solid var(--blue);"></div> Held</div>
              <div class="legend-item"><div class="legend-dot" style="background:#222; opacity:0.4;"></div> Booked</div>
            </div>
          </div>
        </div>

        <!-- BOOKING SUMMARY -->
        <div>
          <div class="booking-summary" id="booking-summary">
            <div class="summary-title">BOOKING SUMMARY</div>
            <div id="selected-seats-list">
              <div class="empty-state" style="padding:2rem 0; text-align:center;">
                <p style="color:var(--muted); font-size:0.82rem;">No seats selected yet.<br>Click on available seats to select.</p>
              </div>
            </div>
            <div id="summary-total-section" style="display:none;">
              <div class="summary-total">
                <span>Total</span>
                <span class="summary-amount" id="summary-total-amount"></span>
              </div>
              <div style="margin-top:1rem; display:flex; flex-direction:column; gap:0.5rem;">
                <button class="btn btn-gold btn-full" id="hold-btn" onclick="proceedToBooking()">
                  Hold Seats & Continue
                </button>
                <button class="btn btn-ghost btn-full btn-sm" onclick="clearSelection()">Clear Selection</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    renderSeatMap();
  }

  function renderSeatMap() {
    const container = document.getElementById('seat-rows');
    if (!container) return;

    const catMap = {};
    categories.forEach((cat, i) => {
      catMap[cat.id] = { ...cat, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] };
    });

    const rows = Object.keys(seatMap).sort();

    container.innerHTML = rows.map(row => {
      const seats = seatMap[row].sort((a, b) => a.seatNumber - b.seatNumber);
      return `
        <div class="seat-row">
          <div class="row-label">${row}</div>
          ${seats.map(seat => {
            const isSelected = selectedSeats.find(s => s.id === seat.id);
            let cls = 'seat ';
            let title = '';
            const cat = catMap[seat.categoryId];
            const color = cat ? cat.color : '#444';
            let style = '';

            if (isSelected) {
              cls += 'seat-selected';
              style = `background:${color}; border-color:${color};`;
            } else if (seat.status === 'booked') {
              cls += 'seat-booked';
            } else if (seat.status === 'held') {
              cls += 'seat-held';
            } else {
              cls += 'seat-available';
              style = `--hover-color:${color};`;
              title = `${row}${seat.seatNumber} · ${cat?.categoryName || ''} · ${formatCurrency(cat?.price || 0)}`;
            }

            const disabled = seat.status === 'booked' || seat.status === 'held';

            return `<button
              class="${cls}"
              style="${style}"
              title="${title}"
              data-id="${seat.id}"
              data-status="${seat.status}"
              data-row="${row}"
              data-num="${seat.seatNumber}"
              data-cat-id="${seat.categoryId}"
              ${disabled ? 'disabled' : ''}
              onclick="toggleSeat(this, '${seat.id}', '${row}', ${seat.seatNumber}, '${seat.categoryId}')">
            </button>`;
          }).join('')}
          <div class="row-label"></div>
        </div>`;
    }).join('');
  }

  function toggleSeat(el, seatId, row, num, catId) {
    if (!auth.isLoggedIn()) {
      toast('Please sign in to select seats', 'error');
      setTimeout(() => window.location.href = 'auth.html', 1000);
      return;
    }

    const cat = categories.find(c => c.id === catId);
    const idx = selectedSeats.findIndex(s => s.id === seatId);

    if (idx === -1) {
      if (selectedSeats.length >= 8) { toast('Maximum 8 seats per booking', 'error'); return; }
      selectedSeats.push({ id: seatId, row, num, catId, price: Number(cat?.price || 0), catName: cat?.categoryName || cat?.name || '' });
    } else {
      selectedSeats.splice(idx, 1);
    }

    updateSummary();
    renderSeatMap();
  }

  function updateSummary() {
    const list = document.getElementById('selected-seats-list');
    const totalSection = document.getElementById('summary-total-section');
    const totalAmount = document.getElementById('summary-total-amount');

    if (!selectedSeats.length) {
      list.innerHTML = `<div class="empty-state" style="padding:2rem 0; text-align:center;"><p style="color:var(--muted); font-size:0.82rem;">No seats selected yet.<br>Click on available seats to select.</p></div>`;
      totalSection.style.display = 'none';
      return;
    }

    const total = selectedSeats.reduce((s, seat) => s + seat.price, 0);

    list.innerHTML = selectedSeats.map(s => `
      <div class="summary-seat">
        <span>Row ${s.row} · Seat ${s.num} <span class="tag">${s.catName}</span></span>
        <span style="font-family:'DM Mono',monospace; font-size:0.82rem; color:var(--gold);">${formatCurrency(s.price)}</span>
      </div>
    `).join('');

    totalSection.style.display = 'block';
    totalAmount.textContent = formatCurrency(total);
  }

  function clearSelection() {
    selectedSeats = [];
    updateSummary();
    renderSeatMap();
  }

  async function proceedToBooking() {
    if (!selectedSeats.length) return;

    const btn = document.getElementById('hold-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Holding seats...';

    try {
      // hold seats
      await api.post(`/seats/${eventId}/hold`, {
        seatIds: selectedSeats.map(s => s.id)
      });

      heldSeatIds = selectedSeats.map(s => s.id);

      // initiate booking
      const data = await api.post('/bookings/initiate', {
        eventId,
        seatIds: heldSeatIds
      });

      currentBookingId = data.data.bookingId;

      // show confirm modal
      const total = selectedSeats.reduce((s, seat) => s + seat.price, 0);
      document.getElementById('modal-seats-list').innerHTML = selectedSeats.map(s => `
        <div class="summary-seat">
          <span>Row ${s.row} · Seat ${s.num} <span class="tag">${s.catName}</span></span>
          <span style="font-family:'DM Mono',monospace; color:var(--gold);">${formatCurrency(s.price)}</span>
        </div>
      `).join('');
      document.getElementById('modal-total').textContent = formatCurrency(total);

      openModal('confirm-modal');
      toast('Seats held for 10 minutes!', 'success');

    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Hold Seats & Continue';
    }
  }

  async function confirmBooking() {
    const btn = document.getElementById('confirm-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Confirming...';

    try {
      await api.post('/bookings/confirm', { bookingId: currentBookingId });
      toast('Booking confirmed! 🎉', 'success');
      closeModal('confirm-modal');
      selectedSeats = [];
      heldSeatIds = [];
      currentBookingId = null;

      // refresh seat map
      const seatData = await api.get(`/seats/${eventId}/seatmap`);
      seatMap = seatData.data;
      renderSeatMap();
      updateSummary();

      setTimeout(() => window.location.href = 'bookings.html', 1500);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Confirm Booking';
    }
  }

  async function openOrganizerModal() {
    const modal = document.getElementById('organizer-modal');
    document.getElementById('org-modal-subtitle').textContent = `Managing: ${event.title}`;

    const actions = document.getElementById('org-actions');
    actions.innerHTML = '';

    if (event.status === 'draft') {
      const btn = document.createElement('button');
      btn.className = 'btn btn-gold btn-full';
      btn.textContent = '🚀 Publish Event';
      btn.onclick = async () => {
        try {
          await api.patch(`/events/${eventId}/publish`);
          toast('Event published!', 'success');
          closeModal('organizer-modal');
          const d = await api.get(`/events/${eventId}`);
          event = d.data;
          renderPage();
        } catch (err) { toast(err.message, 'error'); }
      };
      actions.appendChild(btn);
    }

    if (event.status === 'published') {
      const btn = document.createElement('button');
      btn.className = 'btn btn-danger btn-full';
      btn.textContent = '✕ Cancel Event';
      btn.onclick = async () => {
        if (!confirm('Cancel this event? All bookings will be cancelled.')) return;
        try {
          await api.patch(`/events/${eventId}/cancel`);
          toast('Event cancelled', 'info');
          closeModal('organizer-modal');
          window.location.href = 'index.html';
        } catch (err) { toast(err.message, 'error'); }
      };
      actions.appendChild(btn);
    }

    openModal('organizer-modal');
  }

  init();
