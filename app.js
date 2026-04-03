/* ==========================================
   HELYI ADATBÁZIS OLVASÓ LOGIKA ÉS UI KEZELÉS
   ========================================== */

class App {
    constructor() {
        this.fileSystem = {};
        this.userStatus = JSON.parse(localStorage.getItem('tanulasiAllapot')) || {}; // Kedvencek memóriája

        // UI Elemek
        this.mainTabsUI = document.getElementById('mainTabs');
        this.subTabsUI = document.getElementById('subTabs');
        this.fileGridUI = document.getElementById('fileGrid');
        this.contentView = document.getElementById('contentView');
        this.syncStatus = document.getElementById('syncStatus');
        this.searchInput = document.getElementById('searchInput');
        this.fileListTitleUI = document.getElementById('fileListTitle');

        // Zoom Elemek
        this.zoomLevel = 100;
        this.zoomLevelUI = document.getElementById('zoomLevel');
        this.zoomInBtn = document.getElementById('zoomIn');
        this.zoomOutBtn = document.getElementById('zoomOut');

        // Hamburger menü
        this.hamburgerBtn = document.getElementById('hamburgerMenu');
        this.sidebar = document.querySelector('.resizable-sidebar');

        // Állapot (State)
        this.activeSubject = null;
        this.activeCategory = null;
        this.currentFilePath = null;

        // Inicializálások
        this.initTheme();
        this.initZoom();
        this.initSearch();
        this.initHamburger();
        this.loadLocalData();
    }

    // --- SEGÉDFÜGGVÉNYEK KEDVENCEKHEZ ---
    normalize(str) {
        if (!str) return '';
        let s = str.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return s.replace(/ph/g, 'f').replace(/sz/g, 's').replace(/cz/g, 'c').replace(/th/g, 't').replace(/y/g, 'i').replace(/\s+/g, '');
    }

    saveToLocal() {
        localStorage.setItem('tanulasiAllapot', JSON.stringify(this.userStatus));
    }

    toggleStatus(id, type, event) {
        if (event) event.stopPropagation();
        if (!this.userStatus[id]) this.userStatus[id] = { fontos: false, kesz: false };

        this.userStatus[id][type] = !this.userStatus[id][type];
        this.saveToLocal();

        // UI azonnali frissítése
        const starElem = document.querySelector(`span.star[onclick*="${id}"]`);
        const checkElem = document.querySelector(`span.check[onclick*="${id}"]`);

        if (starElem) starElem.classList.toggle('active', this.userStatus[id].fontos);
        if (checkElem) {
            checkElem.classList.toggle('active', this.userStatus[id].kesz);
            const row = checkElem.closest('tr.data-row');
            if (row) {
                row.style.opacity = this.userStatus[id].kesz ? '0.5' : '1';
                row.style.background = this.userStatus[id].kesz ? 'rgba(0,0,0,0.02)' : '';
            }
        }
        this.applyTableFilters();
    }

    applyTableFilters() {
        const filterFav = document.getElementById('filterFav');
        const filterDone = document.getElementById('filterDone');
        if (!filterFav || !filterDone) return;

        const onlyFav = filterFav.checked;
        const showDone = filterDone.checked;

        document.querySelectorAll('.data-row').forEach(row => {
            const id = row.dataset.id;
            const status = this.userStatus[id] || { fontos: false, kesz: false };
            let isVisible = true;

            if (onlyFav && !status.fontos) isVisible = false;
            if (!showDone && status.kesz) isVisible = false;
            if (row.classList.contains('hidden-by-category')) isVisible = false;

            row.classList.toggle('hidden-row', !isVisible);
        });
    }
    // ------------------------------------

    initTheme() {
        const toggleBtn = document.getElementById('themeToggle');
        let currentTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', currentTheme);
        toggleBtn.addEventListener('click', () => {
            currentTheme = currentTheme === 'light' ? 'dark' : 'light';
            localStorage.setItem('theme', currentTheme);
            document.documentElement.setAttribute('data-theme', currentTheme);
        });
    }

    initZoom() {
        const savedZoom = localStorage.getItem('docZoomLevel');
        if (savedZoom) this.zoomLevel = parseInt(savedZoom, 10);
        this.updateZoomUI();
        this.zoomInBtn.addEventListener('click', () => { if (this.zoomLevel < 250) { this.zoomLevel += 10; this.updateZoomUI(); } });
        this.zoomOutBtn.addEventListener('click', () => { if (this.zoomLevel > 50) { this.zoomLevel -= 10; this.updateZoomUI(); } });
    }

    updateZoomUI() {
        this.zoomLevelUI.textContent = `${this.zoomLevel}%`;
        this.contentView.style.setProperty('--zoom-factor', this.zoomLevel / 100);
        localStorage.setItem('docZoomLevel', this.zoomLevel);
    }

    initHamburger() {
        this.hamburgerBtn.addEventListener('click', () => {
            if (window.innerWidth <= 768) this.sidebar.classList.toggle('open');
            else this.sidebar.classList.toggle('hidden');
        });
    }

    initSearch() {
        this.searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (query.length < 2) {
                if (this.activeCategory) this.renderFileList();
                else { this.fileGridUI.innerHTML = ''; this.fileListTitleUI.textContent = 'Tételek'; }
                return;
            }
            const results = [];
            for (const subj in this.fileSystem) {
                for (const cat in this.fileSystem[subj]) {
                    this.fileSystem[subj][cat].forEach(f => {
                        if (f.name.toLowerCase().includes(query)) results.push({ ...f, subject: subj, category: cat });
                    });
                }
            }
            this.renderSearchResults(results, query);
        });
    }

    async loadLocalData() {
        try {
            const response = await fetch('data.json');
            if (!response.ok) throw new Error();
            this.fileSystem = await response.json();
            this.syncStatus.textContent = "✅ Rendszer kész";
            this.syncStatus.style.color = "var(--text-muted)";
            this.restoreLastOpened();
        } catch (error) {
            this.syncStatus.textContent = "❌ Hiányzó adatok";
            this.syncStatus.style.color = "red";
            this.contentView.innerHTML = `<div class="welcome-msg" style="color: red;"><h3>Hiba: Nincs data.json fájl!</h3></div>`;
        }
    }

    restoreLastOpened() {
        const lastFile = localStorage.getItem('lastOpenedFile');
        if (lastFile) {
            for (const subj in this.fileSystem) {
                for (const cat in this.fileSystem[subj]) {
                    const found = this.fileSystem[subj][cat].find(f => f.path === lastFile);
                    if (found) {
                        this.activeSubject = subj; this.activeCategory = cat; this.currentFilePath = lastFile;
                        this.renderMainTabs(); this.loadFileContent(found.path, found.name.endsWith('.xlsx'));
                        return;
                    }
                }
            }
        }
        this.renderMainTabs();
    }

    renderMainTabs() {
        this.mainTabsUI.innerHTML = '';
        const subjects = Object.keys(this.fileSystem);
        if (subjects.length === 0) return;
        if (!this.activeSubject) this.activeSubject = subjects[0];

        subjects.forEach((subject) => {
            const li = document.createElement('li');
            li.innerHTML = `📁 ${subject}`;
            if (subject === this.activeSubject) li.classList.add('active');
            li.addEventListener('click', () => {
                this.mainTabsUI.querySelectorAll('li').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
                this.activeSubject = subject; this.activeCategory = null;
                this.renderSubTabs();
            });
            this.mainTabsUI.appendChild(li);
        });
        this.renderSubTabs();
    }

    renderSubTabs() {
        this.subTabsUI.innerHTML = ''; this.fileGridUI.innerHTML = '';
        this.searchInput.value = ''; this.fileListTitleUI.textContent = 'Tételek';

        const categories = Object.keys(this.fileSystem[this.activeSubject] || {});
        if (categories.length === 0) return;

        categories.forEach((category) => {
            const li = document.createElement('li');
            li.textContent = category;
            if (category === this.activeCategory) li.classList.add('active');
            li.addEventListener('click', () => {
                this.subTabsUI.querySelectorAll('li').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
                this.activeCategory = category;
                this.renderFileList();
            });
            this.subTabsUI.appendChild(li);
        });

        if (this.activeCategory) this.renderFileList();
    }

    renderFileList() {
        this.fileGridUI.innerHTML = '';
        if (this.activeCategory) this.fileListTitleUI.textContent = this.activeCategory;
        const files = this.fileSystem[this.activeSubject][this.activeCategory] || [];
        files.forEach(fileObj => {
            const cleanName = fileObj.name.replace(/\.[^/.]+$/, "");
            this.fileGridUI.appendChild(this.createFileCard(fileObj, cleanName));
        });
    }

    renderSearchResults(results, query) {
        this.fileGridUI.innerHTML = ''; this.fileListTitleUI.textContent = 'Keresési eredmények';
        if (results.length === 0) {
            this.fileGridUI.innerHTML = `<div style="color: var(--text-muted);">Nincs a "${query}" kifejezésnek megfelelő tétel.</div>`;
            return;
        }
        const grid = document.createElement('div'); grid.className = 'file-grid';
        results.forEach(fileObj => {
            const cleanName = fileObj.name.replace(/\.[^/.]+$/, "");
            grid.appendChild(this.createFileCard(fileObj, cleanName, `${fileObj.subject} > ${fileObj.category}`));
        });
        this.fileGridUI.appendChild(grid);
        this.subTabsUI.querySelectorAll('li').forEach(el => el.classList.remove('active'));
    }

    createFileCard(fileObj, displayName, metaText = null) {
        const isExcel = fileObj.name.endsWith('.xlsx');
        const card = document.createElement('div'); card.className = 'doc-card';
        if (this.currentFilePath === fileObj.path) card.classList.add('active');

        const metaHtml = metaText ? `<div class="doc-card-meta">${metaText}</div>` : '';
        card.innerHTML = `<div class="doc-card-icon">${isExcel ? '📊' : '📄'}</div>
            <div class="doc-card-info"><div class="doc-card-title" title="${displayName}">${displayName}</div>${metaHtml}</div>`;

        card.addEventListener('click', () => {
            if (fileObj.subject && fileObj.category) {
                this.activeSubject = fileObj.subject; this.activeCategory = fileObj.category; this.searchInput.value = '';
                this.currentFilePath = fileObj.path; localStorage.setItem('lastOpenedFile', fileObj.path);
                this.renderMainTabs(); this.loadFileContent(fileObj.path, isExcel);
                if (window.innerWidth <= 768) this.sidebar.classList.remove('open');
                return;
            }
            document.querySelectorAll('.doc-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            this.currentFilePath = fileObj.path; localStorage.setItem('lastOpenedFile', fileObj.path);
            this.loadFileContent(fileObj.path, isExcel);
            if (window.innerWidth <= 768) this.sidebar.classList.remove('open');
        });
        return card;
    }

    appendNavigation() {
        if (!this.activeSubject || !this.activeCategory || !this.currentFilePath) return;
        const files = this.fileSystem[this.activeSubject][this.activeCategory] || [];
        const currentIndex = files.findIndex(f => f.path === this.currentFilePath);
        if (currentIndex === -1) return;

        const navDiv = document.createElement('div'); navDiv.className = 'doc-navigation';
        const prevFile = currentIndex > 0 ? files[currentIndex - 1] : null;
        const nextFile = currentIndex < files.length - 1 ? files[currentIndex + 1] : null;

        if (prevFile) {
            const btn = document.createElement('button'); btn.className = 'btn-nav btn-prev';
            btn.innerHTML = `⬅ Előző tétel<br><span>${prevFile.name.replace(/\.[^/.]+$/, "")}</span>`;
            btn.addEventListener('click', () => this.switchFile(prevFile)); navDiv.appendChild(btn);
        } else { const e = document.createElement('div'); e.style.flex = "1"; e.style.margin = "0 0.5rem"; navDiv.appendChild(e); }

        if (nextFile) {
            const btn = document.createElement('button'); btn.className = 'btn-nav btn-next';
            btn.innerHTML = `Következő tétel ➡<br><span>${nextFile.name.replace(/\.[^/.]+$/, "")}</span>`;
            btn.addEventListener('click', () => this.switchFile(nextFile)); navDiv.appendChild(btn);
        } else { const e = document.createElement('div'); e.style.flex = "1"; e.style.margin = "0 0.5rem"; navDiv.appendChild(e); }

        this.contentView.appendChild(navDiv);
    }

    switchFile(fileObj) {
        this.currentFilePath = fileObj.path; localStorage.setItem('lastOpenedFile', fileObj.path);
        this.renderFileList();
        this.loadFileContent(fileObj.path, fileObj.name.endsWith('.xlsx'));
        if (window.innerWidth <= 768) this.sidebar.classList.remove('open');
    }

    async loadFileContent(localPath, isExcel) {
        this.contentView.innerHTML = '<div class="welcome-msg"><h3>Tétel betöltése...</h3></div>';

        // --- ÚJ LÉPÉS: Lap szélességének dinamikus állítása ---
        if (isExcel) {
            this.contentView.classList.add('table-mode'); // Széles nézet a táblázatoknak
        } else {
            this.contentView.classList.remove('table-mode'); // Normál nézet a szövegeknek
        }

        try {
            const response = await fetch(localPath);
            if (!response.ok) throw new Error('A fájl nem található a gépen.');
            const arrayBuffer = await response.arrayBuffer();
            if (isExcel) this.renderExcel(arrayBuffer);
            else this.renderDocx(arrayBuffer);
        } catch (error) {
            this.contentView.innerHTML = `<h3 style="color:red;">Hiba a betöltéskor</h3><p>${error.message}</p>`;
        }
    }

    renderDocx(arrayBuffer) {
        mammoth.convertToHtml({ arrayBuffer: arrayBuffer }).then(result => {
            this.contentView.innerHTML = `<div class="doc-content">${result.value}</div>`;
            this.appendNavigation(); setTimeout(() => this.contentView.parentElement.scrollTop = 0, 10);
        }).catch(err => { this.contentView.innerHTML = "Hiba a Word konvertálásakor."; });
    }

    // --- 1. ÚJ LOGIKA: ADATOK BEMEMÓRIÁZÁSA ---
    renderExcel(arrayBuffer) {
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Nyers adatok kinyerése
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" });

        if (rawData.length < 2) {
            this.contentView.innerHTML = "<p>Üres vagy érvénytelen táblázat.</p>";
            return;
        }

        const headers = rawData[0].map(h => String(h).trim());

        let currentDefaultCategory = "Egyéb";
        const parsedRows = [];
        const defaultOrder = []; // Emlékezni fog az eredeti "9. osztályos", stb. sorrendre

        for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i];
            if (row.join("").trim() === "") continue;

            const firstColValue = String(row[0] || "").trim();
            const isCategory = row.slice(1).every(val => {
                const v = String(val).trim();
                return v === "" || v === "-";
            });

            if (firstColValue !== "" && isCategory) {
                currentDefaultCategory = firstColValue;
                if (!defaultOrder.includes(currentDefaultCategory)) defaultOrder.push(currentDefaultCategory);
                continue;
            }

            if (!defaultOrder.includes(currentDefaultCategory)) defaultOrder.push(currentDefaultCategory);

            // Eltesszük az adatot strukturáltan
            parsedRows.push({
                defaultCategory: currentDefaultCategory,
                rawData: row
            });
        }

        // Kimentjük a globális állapotba
        this.currentTable = {
            headers: headers,
            rows: parsedRows,
            defaultOrder: defaultOrder
        };

        // Alapértelmezett nézet kirajzolása
        this.renderGroupedTable("default");
    }

    // --- GYAKORLÁS LOGIKA ---
    startPractice() {
        if (!this.currentTable) return;
        document.getElementById('quizModal').style.display = 'flex';
        this.generateQuestion();
    }

    closePractice() {
        document.getElementById('quizModal').style.display = 'none';
    }

    // Segédfüggvény a műfajok/korszakok tisztításához (ugyanaz, amit a csoportosításnál használsz)
    cleanValue(val) {
        let s = String(val || "").trim();
        if (s.includes(';')) s = s.split(';')[0];
        if (s.includes('/')) s = s.split('/')[0];
        s = s.replace(/\(.*?\)/g, '').trim();
        if (s.length > 0) s = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

        // Műfaj összevonás (bordal -> dal, stb.)
        const mapping = {
            "Allegórikus vers": "Dal", "Allegorikus vers": "Dal", "Bordal": "Dal",
            "Helyzetdal": "Dal", "Életkép": "Dal", "Programvers": "Ars poetica"
        };
        return mapping[s] || s;
    }

    generateQuestion() {
        document.getElementById('quizNextBtn').style.display = 'none';
        
        const headers = this.currentTable.headers;
        const rows = this.currentTable.rows;
        
        const validIndices = headers.map((h, i) => {
            const low = h.toLowerCase();
            if (low.includes('műfaj') || low.includes('korszak') || low.includes('szerző') || low.includes('műnem')) return i;
            return -1;
        }).filter(i => i !== -1);

        const colIndex = validIndices[Math.floor(Math.random() * validIndices.length)];
        const headerName = headers[colIndex];
        
        const allValues = rows.map(r => this.cleanValue(r.rawData[colIndex])).filter(v => v !== "" && v !== "Nincs megadva" && v !== "Egyéb");
        const uniqueValues = [...new Set(allValues)];
        const targetValue = uniqueValues[Math.floor(Math.random() * uniqueValues.length)];

        // Kigyűjtjük a helyes és a rossz sorokat is
        const correctRows = rows.filter(r => this.cleanValue(r.rawData[colIndex]) === targetValue);
        const correctRow = correctRows[Math.floor(Math.random() * correctRows.length)];
        const correctAnswer = String(correctRow.rawData[1] || correctRow.rawData[0]);

        const wrongRows = rows.filter(r => this.cleanValue(r.rawData[colIndex]) !== targetValue);
        const shuffledWrongs = wrongRows.sort(() => 0.5 - Math.random()).slice(0, 3);
        
        // Ez a lista tartalmazza az összes gombhoz tartozó TELJES soradatot
        const quizOptionsData = [correctRow, ...shuffledWrongs].sort(() => 0.5 - Math.random());

        document.getElementById('quizCategory').innerText = headerName + ":";
        document.getElementById('quizTarget').innerText = targetValue;
        document.getElementById('quizFeedback').innerText = "";
        
        const optionsDiv = document.getElementById('quizOptions');
        optionsDiv.innerHTML = "";
        
        quizOptionsData.forEach(rowObj => {
            const optText = String(rowObj.rawData[1] || rowObj.rawData[0]);
            const btn = document.createElement('button');
            btn.className = 'quiz-opt-btn';
            btn.innerText = optText;
            // Átadjuk az összes opció adatát a kiértékeléshez
            btn.onclick = () => this.checkAnswer(btn, optText, correctAnswer, headerName, targetValue, quizOptionsData, colIndex);
            optionsDiv.appendChild(btn);
        });
    }

    checkAnswer(btn, selected, correct, headerName, targetValue, allOptions, colIndex) {
        const buttons = document.querySelectorAll('.quiz-opt-btn');
        buttons.forEach(b => b.disabled = true);

        const feedbackDiv = document.getElementById('quizFeedback');
        
        // 1. Fő magyarázat összeállítása
        let html = selected === correct 
            ? `<div style="color: #10B981; margin-bottom: 15px; font-size: 1.1rem;">🎉 Helyes válasz!</div>`
            : `<div style="color: #EF4444; margin-bottom: 15px; font-size: 1.1rem;">❌ Sajnos nem jó...</div>`;

        html += `<div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid var(--border);">
                    A helyes válasz a(z) <strong>"${correct}"</strong>, mivel ennek a tételnek a <strong>${headerName}</strong> mezője: <strong>${targetValue}</strong>.
                 </div>`;

        // 2. Részletes lista az összes gombról
        html += `<div style="text-align: left; font-size: 0.85rem;">
                    <div style="font-weight: bold; margin-bottom: 8px; color: var(--text-muted);">Az opciók elemzése:</div>`;
        
        allOptions.forEach(rowObj => {
            const title = String(rowObj.rawData[1] || rowObj.rawData[0]);
            const val = this.cleanValue(rowObj.rawData[colIndex]);
            const isCorrect = (title === correct);
            
            html += `<div class="quiz-explanation-item ${isCorrect ? 'correct-border' : 'wrong-border'}">
                        <strong>${title}</strong><br>
                        <span style="color: var(--text-muted);">${headerName}:</span> ${val}
                     </div>`;
        });
        
        html += `</div>`;

        feedbackDiv.innerHTML = html;

        if (selected === correct) btn.classList.add('correct');
        else {
            btn.classList.add('wrong');
            buttons.forEach(b => { if(b.innerText === correct) b.classList.add('correct'); });
        }

        document.getElementById('quizNextBtn').style.display = 'flex';
    }

    // --- 2. ÚJ LOGIKA: DINAMIKUS CSOPORTOSÍTÁS ÉS HTML KIRAJZOLÁS ---
    renderGroupedTable(groupByColIndex) {
        if (!this.currentTable) return;

        const headers = this.currentTable.headers;
        const rows = this.currentTable.rows;
        const groups = {};

        // Adatok szétválogatása a kért szempont szerint
        rows.forEach(rowObj => {
            let groupName = "";

            if (groupByColIndex === "default") {
                groupName = rowObj.defaultCategory;
            } else {
                let cellVal = String(rowObj.rawData[groupByColIndex] || "").trim();
                if (cellVal === "" || cellVal === "-") cellVal = "Nincs megadva";

                // Ha több műfaj van (pl. "Regény; Novella"), az elsőt vesszük fő csoportnak
                if (cellVal.includes(';')) {
                    cellVal = cellVal.split(';')[0].trim();
                }
                groupName = cellVal;
            }

            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(rowObj);
        });

        // Csoportok sorbarendezése
        let groupNames = Object.keys(groups);
        if (groupByColIndex === "default") {
            // Eredeti sorrend (pl. 9. osztály, 10. osztály)
            groupNames.sort((a, b) => this.currentTable.defaultOrder.indexOf(a) - this.currentTable.defaultOrder.indexOf(b));
        } else {
            // ABC sorrend (pl. Műfajoknál: Dráma, Epika, Líra)
            groupNames.sort((a, b) => a.localeCompare(b));
        }

        // Legördülő menü (Select) felépítése a fejlécekből
        let groupOptionsHTML = `<option value="default" ${groupByColIndex === 'default' ? 'selected' : ''}>Alapértelmezett (Szekciók)</option>`;
        headers.forEach((h, idx) => {
            // Hosszú szöveges oszlopokra ne lehessen csoportosítani
            if (h.length < 25 && !h.toLowerCase().includes('tartalom') && !h.toLowerCase().includes('részlet')) {
                groupOptionsHTML += `<option value="${idx}" ${String(groupByColIndex) === String(idx) ? 'selected' : ''}>${h}</option>`;
            }
        });

        // Fejléc és Szűrők generálása
        let html = `
            <div class="filters-container" style="align-items: center;">
                <label><input type="checkbox" id="filterFav" onchange="window.appInstance.applyTableFilters()"> ⭐ Csak kedvencek</label>
                <label><input type="checkbox" id="filterDone" checked onchange="window.appInstance.applyTableFilters()"> ✅ Készek mutatása</label>
                
                <button onclick="window.appInstance.startPractice()" class="btn-practice" style="margin-left: 15px;">
                    🎯 Gyakorlás
                </button>

                <div style="margin-left: auto; display: flex; align-items: center; gap: 0.5rem; background: var(--accent-light); padding: 0.4rem 0.8rem; border-radius: 8px; border: 1px solid var(--accent);">
                    <span style="font-weight: bold; color: var(--accent);">📂 Csoportosítás:</span>
                    <select onchange="window.appInstance.renderGroupedTable(this.value)" style="padding: 0.3rem; border-radius: 5px; border: 1px solid var(--border); background: var(--content-bg); color: var(--text-main); font-weight: 600; cursor: pointer; outline: none;">
                        ${groupOptionsHTML}
                    </select>
                </div>
            </div>

            <div class="table-responsive">
            <table><thead><tr>
            <th style="width: 85px; text-align: center;">Állapot</th>
        `;
        headers.forEach(h => html += `<th>${h}</th>`);
        html += `</tr></thead><tbody>`;

        let currentCatId = 0;

        // Adatsorok legenerálása csoportonként
        groupNames.forEach(groupName => {
            currentCatId++;

            // Kategória (Csoport) sor nyomtatása
            html += `<tr class="category-row" onclick="toggleCategoryRow(this, 'cat-${currentCatId}')">
                <td colspan="${headers.length + 1}">▼ ${groupName}</td>
            </tr>`;

            groups[groupName].forEach(rowObj => {
                const row = rowObj.rawData;

                // --- KEDVENCEK JAVÍTOTT AZONOSÍTÓJA ---
                const rowDataForId = row.slice(0, 3).join("");
                const rowId = this.normalize(this.currentFilePath + rowDataForId).substring(0, 150);

                if (!this.userStatus[rowId]) {
                    this.userStatus[rowId] = { fontos: false, kesz: false };
                }
                const status = this.userStatus[rowId];

                const catClass = `cat-${currentCatId}`;
                const rowStyle = status.kesz ? 'opacity: 0.5; background: rgba(0,0,0,0.02);' : '';

                html += `<tr class="data-row ${catClass}" data-id="${rowId}" style="${rowStyle}">`;

                html += `<td class="status-cell">
                    <span onclick="window.appInstance.toggleStatus('${rowId}', 'fontos', event)" class="star ${status.fontos ? 'active' : ''}">★</span>
                    <span onclick="window.appInstance.toggleStatus('${rowId}', 'kesz', event)" class="check ${status.kesz ? 'active' : ''}">✔</span>
                </td>`;

                headers.forEach((header, colIdx) => {
                    let cellValue = String(row[colIdx] !== undefined ? row[colIdx] : "").trim();
                    let contentHTML = cellValue;
                    let lowerHeader = header.toLowerCase();
                    let tdClass = "";

                    if (cellValue === "" || cellValue === "-") {
                        contentHTML = `<span style="color: var(--text-muted);">&mdash;</span>`;
                    } else if (lowerHeader.includes('korszak')) {
                        contentHTML = `<span class="bubble-kor">${cellValue}</span>`;
                    } else if (lowerHeader.includes('műfaj')) {
                        contentHTML = cellValue.split(';').map(tag => `<span class="tag-mufaj">${tag.trim()}</span>`).join(' ');
                    } else if (cellValue.length > 50 || lowerHeader.includes('tartalom') || lowerHeader.includes('részlet')) {
                        contentHTML = cellValue.replace(/\n/g, '<br>');
                        tdClass = 'class="wrap-text"';
                    }

                    html += `<td ${tdClass}>${contentHTML}</td>`;
                });
                html += `</tr>`;
            });
        });

        html += `</tbody></table></div>`;
        this.contentView.innerHTML = html;
        this.appendNavigation();
        this.applyTableFilters();
    }
}

// ==========================================
// GLOBÁLIS FÜGGVÉNYEK (HTML Onclick eseményekhez)
// ==========================================
window.toggleCategoryRow = function (rowElement, catGroupId) {
    rowElement.classList.toggle('collapsed');
    const isCollapsed = rowElement.classList.contains('collapsed');

    rowElement.closest('table').querySelectorAll(`.${catGroupId}`).forEach(r => {
        if (isCollapsed) r.classList.add('hidden-by-category');
        else r.classList.remove('hidden-by-category');
    });
    // Újraértékeljük a szűrőket (hogy ne mutasson rejtett kategóriában lévő kedvencet)
    window.appInstance.applyTableFilters();
}

// App indítása és globális hozzáférés biztosítása
document.addEventListener('DOMContentLoaded', () => {
    window.appInstance = new App();
});