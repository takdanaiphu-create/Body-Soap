/* ==========================================================================
   Body Scent — shared script (ใช้ร่วมกันทุกหน้า)
   - product.html : โหลดสินค้าจาก products.json + ปุ่มกรอง mood
   - order.html   : เติมฟอร์มจาก URL parameter + ส่งออเดอร์ไป Apps Script
   - admin.html   : ดึง CSV จาก Google Sheets มาแสดงเป็นตาราง
   ========================================================================== */

const PRODUCTS_URL = 'products.json';

const ORDER_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbyTdtySoOm43zp0HmORgi75JCc7O-lpa-sL1OOxIBJDUBJrTYlXY0kjROW8gaeE92g/exec';

const ORDERS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTzR9-fcuPIyZWMeSwwnK6LJ1qrD3DZgD-G_kb7eQonX5UX0LOpC3wXgZ3pG6Ke0mdcWiyYN6KMJPcT/pub?gid=0&single=true&output=csv';

// ปุ่มกรอง mood (นอกจาก "ทั้งหมด") — แก้รายการได้ที่นี่
const MOOD_FILTERS = ['Fresh', 'Sweet', 'Confident', 'Romance'];

/* ---------- Helpers ---------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatPrice(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('th-TH') : String(value);
}

/* ---------- Page router (ตรวจจาก element ที่มีในหน้า) ---------- */

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('product-list')) initProductPage();
  if (document.getElementById('orderForm')) initOrderPage();
  if (document.querySelector('#ordersTable tbody')) initAdminPage();
});

/* ==========================================================================
   1) product.html
   ========================================================================== */

async function initProductPage() {
  const list = document.getElementById('product-list');
  const bar = document.getElementById('filter-bar');

  let products = [];
  try {
    const res = await fetch(PRODUCTS_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    products = await res.json();
  } catch (error) {
    console.error(error);
    list.replaceChildren(el('p', 'text-center', 'ไม่สามารถโหลดรายการสินค้าได้ กรุณาลองใหม่อีกครั้ง'));
    return;
  }

  // mood เริ่มต้นจาก ?mood=xxx (ไม่สนตัวพิมพ์เล็ก/ใหญ่)
  const params = new URLSearchParams(window.location.search);
  let activeMood = (params.get('mood') || 'all').trim().toLowerCase();
  if (activeMood === '') activeMood = 'all';

  function renderFilters() {
    if (!bar) return;
    const options = [{ label: 'ทั้งหมด', value: 'all' }].concat(
      MOOD_FILTERS.map((m) => ({ label: m, value: m.toLowerCase() }))
    );
    bar.replaceChildren(
      ...options.map((opt) => {
        const btn = el('button', 'btn filter-btn', opt.label);
        btn.type = 'button';
        btn.dataset.mood = opt.value;
        const isActive = opt.value === activeMood;
        btn.classList.toggle('btn--accent', isActive);
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
        btn.addEventListener('click', () => {
          activeMood = opt.value;
          renderFilters();
          renderProducts();
        });
        return btn;
      })
    );
  }

  function createCard(product) {
    const itemName = `${product.name} ${product.size}`;
    const orderUrl =
      'order.html?item=' + encodeURIComponent(itemName) +
      '&price=' + encodeURIComponent(product.price);

    const card = el('article', 'product-card');

    const media = el('div', 'product-card__media');
    const img = el('img');
    img.src = product.image;
    img.alt = product.name;
    img.loading = 'lazy';
    media.appendChild(img);

    const body = el('div', 'product-card__body');
    const title = el('h3', 'product-card__title', product.name);
    const mood = el('span', 'mood mood--' + String(product.mood).toLowerCase(), product.mood);
    const meta = el('p', 'product-card__meta', product.size);
    const price = el('div', 'product-card__price', formatPrice(product.price));
    price.appendChild(el('small', null, 'บาท'));
    const buy = el('a', 'btn btn--accent btn--block', 'สั่งซื้อ');
    buy.href = orderUrl;

    body.append(title, mood, meta, price, buy);
    card.append(media, body);
    return card;
  }

  function renderProducts() {
    const filtered = products.filter(
      (p) => activeMood === 'all' || String(p.mood).toLowerCase() === activeMood
    );
    if (filtered.length === 0) {
      list.replaceChildren(el('p', 'text-center', 'ยังไม่มีสินค้าในหมวดนี้'));
      return;
    }
    list.replaceChildren(...filtered.map(createCard));
  }

  renderFilters();
  renderProducts();
}

/* ==========================================================================
   2) order.html
   ========================================================================== */

function initOrderPage() {
  const form = document.getElementById('orderForm');
  const itemsInput = document.getElementById('items');
  const totalInput = document.getElementById('total');

  // เติมฟอร์มอัตโนมัติจาก URL parameter: ทั้งช่อง items และ total
  const params = new URLSearchParams(window.location.search);
  const item = params.get('item');
  const price = params.get('price');
  if (item !== null) itemsInput.value = item;
  if (price !== null) totalInput.value = price;

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const payload = {
      customerName: document.getElementById('customerName').value,
      contact: document.getElementById('contact').value,
      items: document.getElementById('items').value,
      total: document.getElementById('total').value,
      note: document.getElementById('note').value
    };

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    fetch(ORDER_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      if (submitBtn) submitBtn.disabled = false;
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
  });
}

/* ==========================================================================
   3) admin.html
   ========================================================================== */

// Parse CSV เอง: รองรับ field ใน "..." , เครื่องหมาย "" แทน " , และขึ้นบรรทัดใหม่ใน field
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // ตัด BOM

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // ทิ้งแถวว่าง
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

async function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');
  const COLS = 6; // วันเวลา, ชื่อ, เบอร์/Line, รายการ, ยอดรวม, หมายเหตุ

  function showMessage(msg) {
    const tr = el('tr');
    const td = el('td', 'text-center', msg);
    td.colSpan = COLS;
    tr.appendChild(td);
    tbody.replaceChildren(tr);
  }

  showMessage('กำลังโหลดข้อมูล...');

  try {
    const res = await fetch(ORDERS_CSV_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = parseCSV(await res.text());

    rows.shift(); // ตัดแถวหัวตาราง

    if (rows.length === 0) {
      showMessage('ยังไม่มีออเดอร์');
      return;
    }

    // Sheet เพิ่มแถวใหม่ต่อท้ายเสมอ → กลับลำดับให้รายการล่าสุดขึ้นก่อน
    rows.reverse();

    const trs = rows.map((r) => {
      const tr = el('tr');
      for (let i = 0; i < COLS; i++) {
        // textContent ป้องกัน HTML/script ที่ลูกค้าอาจกรอกมาในฟอร์ม
        tr.appendChild(el('td', null, r[i] !== undefined ? r[i] : ''));
      }
      return tr;
    });
    tbody.replaceChildren(...trs);
  } catch (error) {
    console.error(error);
    showMessage('ไม่สามารถโหลดข้อมูลออเดอร์ได้ กรุณาลองใหม่อีกครั้ง');
  }
}
