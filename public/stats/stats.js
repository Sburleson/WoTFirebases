window.addEventListener('DOMContentLoaded', init);
  let currentPage = 1;
  const rowsPerPage = 50; // Change this to your desired page size
  let lastData = [];
  
function init() {


  const sortField = document.getElementById('sort-by');
  const searchPlayer = document.getElementById('search-player');
  const searchTank = document.getElementById('search-tank');
  const searchMap = document.getElementById('search-map');
  const sortName = document.getElementById('sort-name');
  const sortMap = document.getElementById('sort-map');
  const sortTank = document.getElementById('sort-tank');

  sortField.addEventListener('change', fetchAndDisplayStats);
  searchPlayer.addEventListener('input', fetchAndDisplayStats);
  searchTank.addEventListener('input', fetchAndDisplayStats);
  searchMap.addEventListener('input', fetchAndDisplayStats);
  sortName.addEventListener('change', fetchAndDisplayStats);
  sortMap.addEventListener('change', fetchAndDisplayStats);
  sortTank.addEventListener('change', fetchAndDisplayStats);

  fetchAndDisplayStats(); // Initial fetch

  setupAutocomplete('search-tank', 'tank');
  setupAutocomplete('search-player', 'player');
  setupAutocomplete('search-map', 'map');
}

function fetchAndDisplayStats() {
  const sortByStat = document.getElementById('sort-by').value;
  const player = document.getElementById('search-player').value.trim();
  const tank = document.getElementById('search-tank').value.trim();
  const map = document.getElementById('search-map').value.trim();
  const sortName = document.getElementById('sort-name').checked;
  const sortMap = document.getElementById('sort-map').checked;
  const sortTank = document.getElementById('sort-tank').checked;

  // Build sort_by param in the order: name, map, tank, stat
  let sortParams = [];
  if (sortName) sortParams.push('name');
  if (sortMap) sortParams.push('map');
  if (sortTank) sortParams.push('tank');
  sortParams.push(sortByStat); // Always add the stat at the end

  let url = `/stats?sort_by=${encodeURIComponent(sortParams.join(','))}`;
  if (player) url += `&name=${encodeURIComponent(player)}`;
  if (tank) url += `&tank=${encodeURIComponent(tank)}`;
  if (map) url += `&map=${encodeURIComponent(map)}`;

  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json();
    })
    .then(data => populateTable(data))
    .catch(error => {
      console.error('Error fetching data:', error);
      document.getElementById('stats-table').innerHTML = '<tr><td colspan="99">Error loading data</td></tr>';
    });
}

function populateTable(data) {
  lastData = data; // Save for pagination
  renderTablePage(1);
}

function renderTablePage(page) {
  currentPage = page;
  const table = document.getElementById('stats-table');
  table.innerHTML = '';

  if (!Array.isArray(lastData) || lastData.length === 0) {
    table.innerHTML = '<tr><td colspan="99">No results found</td></tr>';
    document.getElementById('pagination-controls').innerHTML = '';
    return;
  }

  const keys = Object.keys(lastData[0]).filter(k => k !== 'player_id');
  // Table header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  keys.forEach(key => {
    const th = document.createElement('th');
    th.textContent = key.replace(/_/g, ' ').toUpperCase();
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  // Table body
  const tbody = document.createElement('tbody');
  const start = (currentPage - 1) * rowsPerPage;
  const end = Math.min(start + rowsPerPage, lastData.length);
  for (let i = start; i < end; i++) {
    const row = document.createElement('tr');
    keys.forEach(key => {
      const cell = document.createElement('td');
      cell.textContent = lastData[i][key];
      row.appendChild(cell);
    });
    tbody.appendChild(row);
  }

  // Replace table content
  table.innerHTML = '';
  table.appendChild(thead);
  table.appendChild(tbody);

  // Pagination controls
  renderPaginationControls();
}

function renderPaginationControls() {
  const totalPages = Math.ceil(lastData.length / rowsPerPage);
  const controls = document.getElementById('pagination-controls');
  controls.innerHTML = '';

  if (totalPages <= 1) return;

  const prevBtn = document.createElement('button');
  prevBtn.textContent = 'Previous';
  prevBtn.className = 'btn btn-secondary mx-2';
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => renderTablePage(currentPage - 1);

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next';
  nextBtn.className = 'btn btn-secondary mx-2';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => renderTablePage(currentPage + 1);

  const pageInfo = document.createElement('span');
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  pageInfo.className = 'align-self-center mx-2';

  controls.appendChild(prevBtn);
  controls.appendChild(pageInfo);
  controls.appendChild(nextBtn);
}

function setupAutocomplete(inputId, endpoint) {
  const input = document.getElementById(inputId);
  const dropdown = document.createElement('div');
  dropdown.className = 'autocomplete-dropdown';
  dropdown.style.position = 'absolute';
  dropdown.style.zIndex = 1000;
  dropdown.style.background = 'white';
  dropdown.style.border = '1px solid #ccc';
  dropdown.style.width = input.offsetWidth + 'px';
  dropdown.style.display = 'none';
  input.parentNode.appendChild(dropdown);

  const API_BASE = "/api";


  input.addEventListener('input', function() {
    const val = input.value.trim();
    if (!val) {
      dropdown.style.display = 'none';
      return;
    }
    console.log(`Fetching autocomplete suggestions for: Endpoint:${endpoint} val:${val}`);
    fetch(`${API_BASE}/autocomplete/${endpoint}?q=${encodeURIComponent(val)}`)
      .then(res => res.json())
      .then(suggestions => {
        dropdown.innerHTML = '';
        if (suggestions.length === 0) {
          dropdown.style.display = 'none';
          return;
        }
        suggestions.forEach(s => {
          const item = document.createElement('div');
          item.textContent = s;
          item.className = 'autocomplete-item';
          item.style.cursor = 'pointer';
          item.style.padding = '2px 8px';
          item.style.color = '#333';
          item.addEventListener('mousedown', function(e) {
            e.preventDefault();
            input.value = s;
            dropdown.style.display = 'none';
            fetchAndDisplayStats();
          });
          dropdown.appendChild(item);
        });
        dropdown.style.display = '';
        dropdown.style.width = input.offsetWidth + 'px';
      });
  });

  input.addEventListener('blur', function() {
    setTimeout(() => { dropdown.style.display = 'none'; }, 100);
  });
}
