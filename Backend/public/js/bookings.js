  let allBookings = [];
  let currentFilter = 'all';

  async function loadBookings() {
    if (!requireAuth()) return;

    try {
      const data = await api.get('/bookings/me');
      allBookings = data.data || [];
      renderBookings();
    } catch (err) {
      document.getElementById('bookings-container').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Could Not Load Bookings</h3>
          <p>${err.message}</p>
        </div>`;
    }
  }

  function filterBookings(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderBookings();
  }

  function renderBookings() {
    const container = document.getElementById('bookings-container');

    const filtered = currentFilter === 'all'
      ? allBookings
      : allBookings.filter(b => b.status === currentFilter);

    if (!filtered.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎫</div>
          <h3>No ${currentFilter === 'all' ? '' : currentFilter} Bookings</h3>
          <p>${currentFilter === 'all' ? "You haven't booked any tickets yet." : `No ${currentFilter} bookings found.`}</p>
          <a href="index.html" class="btn btn-gold" style="margin-top:1.5rem;">Browse Events</a>
        </div>`;
      return;
    }

    container.innerHTML = filtered.map(booking => {
      const seats = booking.seats || booking.bookingSeats || [];
      const seatLabels = seats.slice(0, 3).map(s => {
        const seat = s.seat || s;
        return `${seat.rowLabel || ''}${seat.seatNumber || ''}`;
      }).join(', ');
      const moreSeats = seats.length > 3 ? ` +${seats.length - 3} more` : '';

      return `
        <div class="booking-item">
          <div class="booking-item-header">
            <div style="flex:1;">
              <div class="booking-event-title">${booking.event?.title || 'Event'}</div>
              <div class="booking-meta">
                📅 ${formatDate(booking.event?.eventDate || booking.event?.date_time || '')}
                · 📍 ${booking.event?.venue || 'TBA'}
              </div>
              <div style="margin-top:0.5rem; display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                ${statusBadge(booking.status)}
                ${statusBadge(booking.paymentStatus)}
                <span class="tag">ID: ${booking.id.slice(0, 8)}...</span>
              </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.5rem; align-items:flex-end;">
              <span class="booking-amount">${formatCurrency(booking.totalAmount)}</span>
              <button class="btn btn-outline btn-sm" onclick="viewBookingDetail('${booking.id}')">View Details</button>
              ${booking.status === 'confirmed' ? `
                <button class="btn btn-danger btn-sm" onclick="initCancelBooking('${booking.id}')">Cancel</button>
              ` : ''}
            </div>
          </div>
          <div class="booking-item-footer">
            <div class="booking-seats-info">
              🪑 Seats: ${seatLabels}${moreSeats}
            </div>
            <div style="font-size:0.75rem; color:var(--muted);">
              Booked ${formatDate(booking.createdAt)}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  async function viewBookingDetail(bookingId) {
    try {
      const data = await api.get(`/bookings/${bookingId}`);
      const b = data.data;
      const seats = b.seats || b.bookingSeats || [];

      document.getElementById('booking-detail-content').innerHTML = `
        <div style="margin-bottom:1.5rem;">
          <div style="font-family:'Bebas Neue',sans-serif; font-size:1.3rem; letter-spacing:1px; margin-bottom:0.25rem;">${b.event?.title}</div>
          <div style="font-size:0.82rem; color:var(--muted);">
            📅 ${formatDate(b.event?.eventDate || b.event?.date_time)} · 📍 ${b.event?.venue || 'TBA'}
          </div>
          <div style="margin-top:0.5rem; display:flex; gap:0.5rem;">
            ${statusBadge(b.status)}
            ${statusBadge(b.paymentStatus)}
          </div>
        </div>

        <div class="divider"></div>

        <p style="font-size:0.72rem; color:var(--muted); letter-spacing:1px; text-transform:uppercase; margin-bottom:0.75rem;">Seats</p>
        ${seats.map(s => {
          const seat = s.seat || s;
          return `
            <div class="summary-seat">
              <span>Row ${seat.rowLabel || ''} · Seat ${seat.seatNumber || ''} 
                <span class="tag">${seat.category?.categoryName || seat.category?.name || ''}</span>
              </span>
              <span style="font-family:'DM Mono',monospace; color:var(--gold);">${formatCurrency(s.pricePaid)}</span>
            </div>`;
        }).join('')}

        <div class="divider"></div>

        <div class="summary-total">
          <span>Total Paid</span>
          <span class="summary-amount">${formatCurrency(b.totalAmount)}</span>
        </div>

        <div style="margin-top:1rem; padding:0.75rem; background:var(--bg3); border-radius:4px;">
          <div style="font-size:0.72rem; color:var(--muted); margin-bottom:0.25rem; letter-spacing:1px; text-transform:uppercase;">Booking Reference</div>
          <div style="font-family:'DM Mono',monospace; font-size:0.82rem; color:var(--gold);">${b.id}</div>
        </div>

        ${b.status === 'confirmed' ? `
          <button class="btn btn-danger btn-full" style="margin-top:1rem;" onclick="closeModal('booking-detail-modal'); initCancelBooking('${b.id}')">Cancel Booking</button>
        ` : ''}
      `;

      openModal('booking-detail-modal');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function initCancelBooking(bookingId) {
    const btn = document.getElementById('cancel-confirm-btn');
    btn.onclick = () => cancelBooking(bookingId);
    openModal('cancel-modal');
  }

  async function cancelBooking(bookingId) {
    const btn = document.getElementById('cancel-confirm-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Cancelling...';

    try {
      await api.delete(`/bookings/${bookingId}`);
      toast('Booking cancelled. Refund will be processed shortly.', 'success');
      closeModal('cancel-modal');
      await loadBookings();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Yes, Cancel Booking';
    }
  }

  loadBookings();
