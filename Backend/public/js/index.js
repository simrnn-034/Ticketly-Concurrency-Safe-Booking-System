  let allEvents = [];

  async function loadEvents() {
    try {
      const q = document.getElementById('search-input').value.toLowerCase();
      const data = await api.get('/events');
      allEvents = data.data || [];

      const filtered = q
        ? allEvents.filter(e => e.title.toLowerCase().includes(q) || e.venue?.toLowerCase().includes(q))
        : allEvents;

      document.getElementById('skeleton-grid').style.display = 'none';
      const list = document.getElementById('events-list');
      list.style.display = 'grid';

      if (!filtered.length) {
        list.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1;">
            <div class="empty-icon">🎭</div>
            <h3>No Events Found</h3>
            <p>Check back later for upcoming events</p>
          </div>`;
        return;
      }

      list.innerHTML = filtered.map(e => {
        const minPrice = e.categories?.length
          ? Math.min(...e.categories.map(c => Number(c.price)))
          : 0;
        return `
          <a href="event.html?id=${e.id}" class="card event-card">
            <div class="event-card-header">
              <div class="event-title">${e.title}</div>
              <div class="event-venue">📍 ${e.venue || 'TBA'}</div>
              <div class="event-date">📅 ${formatDate(e.eventDate || e.date_time)} · ${formatTime(e.eventDate || e.date_time)}</div>
            </div>
            <div class="card-footer">
              <div class="event-meta">
                <div class="event-price">From <strong>${formatCurrency(minPrice)}</strong></div>
                <span class="badge badge-green">Available</span>
              </div>
            </div>
          </a>`;
      }).join('');
    } catch (err) {
      document.getElementById('skeleton-grid').style.display = 'none';
      document.getElementById('events-list').style.display = 'grid';
      document.getElementById('events-list').innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <div class="empty-icon">⚠️</div>
          <h3>Could Not Load Events</h3>
          <p>${err.message}</p>
        </div>`;
    }
  }

  function addCategory() {
    const container = document.getElementById('categories-container');
    const div = document.createElement('div');
    div.className = 'category-entry';
    div.style.cssText = 'background:var(--bg3); border:1px solid var(--border); border-radius:6px; padding:1rem; margin-bottom:0.75rem; position:relative;';
    div.innerHTML = `
      <button onclick="this.parentElement.remove()" style="position:absolute;top:0.5rem;right:0.5rem;background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem;">✕</button>
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.75rem;">
        <div class="form-group" style="margin-bottom:0;"><label>Category Name</label><input type="text" class="cat-name" placeholder="General" /></div>
        <div class="form-group" style="margin-bottom:0;"><label>Price (₹)</label><input type="number" class="cat-price" placeholder="500" /></div>
        <div class="form-group" style="margin-bottom:0;"><label>Seats per Row</label><input type="number" class="cat-spr" placeholder="20" /></div>
      </div>
      <div class="form-group" style="margin-top:0.75rem; margin-bottom:0;"><label>Rows (comma separated)</label><input type="text" class="cat-rows" placeholder="D, E, F" /></div>`;
    container.appendChild(div);
  }

  async function submitCreateEvent() {
    const btn = document.getElementById('create-event-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating...';

    try {
      const categories = Array.from(document.querySelectorAll('.category-entry')).map(el => ({
        name: el.querySelector('.cat-name').value,
        price: Number(el.querySelector('.cat-price').value),
        seats_per_row: Number(el.querySelector('.cat-spr').value),
        rows: el.querySelector('.cat-rows').value.split(',').map(r => r.trim()).filter(Boolean)
      }));

      const payload = {
        title: document.getElementById('ce-title').value,
        description: document.getElementById('ce-desc').value,
        venue: document.getElementById('ce-venue').value,
        date_time: document.getElementById('ce-date').value,
        categories
      };

      const data = await api.post('/events', payload);
      toast('Event created! Now publish it.', 'success');
      closeModal('create-event-modal');
      await loadEvents();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Event';
    }
  }

  // show organizer actions if user is organizer
  document.addEventListener('DOMContentLoaded', () => {
    const user = auth.getUser();
    if (user?.role === 'organizer') {
      document.getElementById('organizer-actions').style.display = 'block';
    }
    if (auth.isLoggedIn()) {
      document.getElementById('hero-auth-btn').textContent = 'My Bookings';
      document.getElementById('hero-auth-btn').href = 'bookings.html';
    }
    loadEvents();
  });

  document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadEvents();
  });
