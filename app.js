/* ==========================================
   HELYI ADATBÁZIS OLVASÓ LOGIKA ÉS UI KEZELÉS
   ========================================== */

class App {
    constructor() {
        this.fileSystem = {}; 
        
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

        // Hamburger menü és oldalsáv
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

    // 1. Téma kezelés
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

    // 2. Zoom kezelés
    initZoom() {
        const savedZoom = localStorage.getItem('docZoomLevel');
        if (savedZoom) this.zoomLevel = parseInt(savedZoom, 10);
        this.updateZoomUI();

        this.zoomInBtn.addEventListener('click', () => {
            if (this.zoomLevel < 250) {
                this.zoomLevel += 10;
                this.updateZoomUI();
            }
        });

        this.zoomOutBtn.addEventListener('click', () => {
            if (this.zoomLevel > 50) {
                this.zoomLevel -= 10;
                this.updateZoomUI();
            }
        });
    }

    updateZoomUI() {
        this.zoomLevelUI.textContent = `${this.zoomLevel}%`;
        this.contentView.style.setProperty('--zoom-factor', this.zoomLevel / 100);
        localStorage.setItem('docZoomLevel', this.zoomLevel);
    }

    // 3. Hamburger menü
    initHamburger() {
        this.hamburgerBtn.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                this.sidebar.classList.toggle('open');
            } else {
                this.sidebar.classList.toggle('hidden');
            }
        });
    }

    // 4. Kereső logika
    initSearch() {
        this.searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            
            if (query.length < 2) {
                if (this.activeCategory) {
                    this.renderFileList();
                } else {
                    this.fileGridUI.innerHTML = '';
                    this.fileListTitleUI.textContent = 'Tételek';
                }
                return;
            }

            const results = [];
            for (const subj in this.fileSystem) {
                for (const cat in this.fileSystem[subj]) {
                    this.fileSystem[subj][cat].forEach(fileObj => {
                        if (fileObj.name.toLowerCase().includes(query)) {
                            results.push({ ...fileObj, subject: subj, category: cat });
                        }
                    });
                }
            }
            this.renderSearchResults(results, query);
        });
    }

    // 5. Adatok betöltése
    async loadLocalData() {
        try {
            const response = await fetch('data.json');
            if (!response.ok) throw new Error("Nem találom a data.json fájlt.");
            
            this.fileSystem = await response.json();
            this.syncStatus.textContent = "✅ Rendszer kész";
            this.syncStatus.style.color = "var(--text-muted)";
            
            this.restoreLastOpened(); 
            
        } catch (error) {
            console.error(error);
            this.syncStatus.textContent = "❌ Hiányzó adatok";
            this.syncStatus.style.color = "red";
            this.contentView.innerHTML = `<div class="welcome-msg" style="color: red;"><h3>Hiba: Nincs data.json fájl!</h3></div>`;
        }
    }

    // 6. Memória visszatöltés
    restoreLastOpened() {
        const lastFile = localStorage.getItem('lastOpenedFile');
        if (lastFile) {
            for (const subj in this.fileSystem) {
                for (const cat in this.fileSystem[subj]) {
                    const found = this.fileSystem[subj][cat].find(f => f.path === lastFile);
                    if (found) {
                        this.activeSubject = subj;
                        this.activeCategory = cat;
                        this.currentFilePath = lastFile;
                        this.renderMainTabs();
                        this.loadFileContent(found.path, found.name.endsWith('.xlsx'));
                        return;
                    }
                }
            }
        }
        this.renderMainTabs();
    }

    // 7. UI: Főtárgyak
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
                this.activeSubject = subject;
                this.activeCategory = null; 
                this.renderSubTabs();
            });
            this.mainTabsUI.appendChild(li);
        });
        this.renderSubTabs();
    }

    // 8. UI: Kategóriák
    renderSubTabs() {
        this.subTabsUI.innerHTML = '';
        this.fileGridUI.innerHTML = ''; 
        this.searchInput.value = ''; 
        this.fileListTitleUI.textContent = 'Tételek'; 
        
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

    // 9. UI: Fájlok listázása
    renderFileList() {
        this.fileGridUI.innerHTML = '';
        if (this.activeCategory) {
            this.fileListTitleUI.textContent = this.activeCategory;
        }

        const files = this.fileSystem[this.activeSubject][this.activeCategory] || [];
        files.forEach(fileObj => {
            const cleanName = fileObj.name.replace(/\.[^/.]+$/, "");
            const card = this.createFileCard(fileObj, cleanName);
            this.fileGridUI.appendChild(card);
        });
    }

    // Keresési eredmények
    renderSearchResults(results, query) {
        this.fileGridUI.innerHTML = '';
        this.fileListTitleUI.textContent = 'Keresési eredmények';
        
        if (results.length === 0) {
            this.fileGridUI.innerHTML = `<div style="color: var(--text-muted);">Nincs a "${query}" kifejezésnek megfelelő tétel.</div>`;
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'file-grid';

        results.forEach(fileObj => {
            const cleanName = fileObj.name.replace(/\.[^/.]+$/, "");
            const metaInfo = `${fileObj.subject} > ${fileObj.category}`; 
            const card = this.createFileCard(fileObj, cleanName, metaInfo);
            grid.appendChild(card);
        });

        this.fileGridUI.appendChild(grid);
        this.subTabsUI.querySelectorAll('li').forEach(el => el.classList.remove('active'));
    }

    // Kártya készítő
    createFileCard(fileObj, displayName, metaText = null) {
        const isExcel = fileObj.name.endsWith('.xlsx');
        const card = document.createElement('div');
        card.className = 'doc-card';
        
        if (this.currentFilePath === fileObj.path) card.classList.add('active');

        const icon = isExcel ? '📊' : '📄';
        const metaHtml = metaText ? `<div class="doc-card-meta">${metaText}</div>` : '';

        card.innerHTML = `
            <div class="doc-card-icon">${icon}</div>
            <div class="doc-card-info">
                <div class="doc-card-title" title="${displayName}">${displayName}</div>
                ${metaHtml}
            </div>
        `;

        card.addEventListener('click', () => {
            // JAVÍTÁS: Ha a keresőből jöttünk, frissítjük az állapotot, hogy ne fagyjon be a menü!
            if (fileObj.subject && fileObj.category) {
                this.activeSubject = fileObj.subject;
                this.activeCategory = fileObj.category;
                this.searchInput.value = ''; // Kereső ürítése
                this.currentFilePath = fileObj.path;
                localStorage.setItem('lastOpenedFile', fileObj.path); 
                
                this.renderMainTabs(); // Mindent újra-renderel, így a menü helyreáll
                this.loadFileContent(fileObj.path, isExcel);
                if (window.innerWidth <= 768) this.sidebar.classList.remove('open');
                return;
            }

            // Normál kattintás
            document.querySelectorAll('.doc-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            this.currentFilePath = fileObj.path;
            localStorage.setItem('lastOpenedFile', fileObj.path); 
            
            this.loadFileContent(fileObj.path, isExcel);
            
            if (window.innerWidth <= 768) {
                this.sidebar.classList.remove('open');
            }
        });

        return card;
    }

    // ÚJ: Lapozó (Prev/Next) funkció
    appendNavigation() {
        if (!this.activeSubject || !this.activeCategory || !this.currentFilePath) return;
        
        const files = this.fileSystem[this.activeSubject][this.activeCategory] || [];
        const currentIndex = files.findIndex(f => f.path === this.currentFilePath);
        
        if (currentIndex === -1) return;

        const navDiv = document.createElement('div');
        navDiv.className = 'doc-navigation';

        const prevFile = currentIndex > 0 ? files[currentIndex - 1] : null;
        const nextFile = currentIndex < files.length - 1 ? files[currentIndex + 1] : null;

        if (prevFile) {
            const btn = document.createElement('button');
            btn.className = 'btn-nav btn-prev';
            btn.innerHTML = `⬅ Előző tétel<br><span>${prevFile.name.replace(/\.[^/.]+$/, "")}</span>`;
            btn.addEventListener('click', () => this.switchFile(prevFile));
            navDiv.appendChild(btn);
        } else {
            const empty = document.createElement('div');
            empty.style.flex = "1"; empty.style.margin = "0 0.5rem";
            navDiv.appendChild(empty);
        }

        if (nextFile) {
            const btn = document.createElement('button');
            btn.className = 'btn-nav btn-next';
            btn.innerHTML = `Következő tétel ➡<br><span>${nextFile.name.replace(/\.[^/.]+$/, "")}</span>`;
            btn.addEventListener('click', () => this.switchFile(nextFile));
            navDiv.appendChild(btn);
        } else {
            const empty = document.createElement('div');
            empty.style.flex = "1"; empty.style.margin = "0 0.5rem";
            navDiv.appendChild(empty);
        }

        this.contentView.appendChild(navDiv);
    }

    // Segédfüggvény a gombos lapozáshoz
    switchFile(fileObj) {
        this.currentFilePath = fileObj.path;
        localStorage.setItem('lastOpenedFile', fileObj.path);
        
        this.renderFileList(); // Frissíti a kék keretet a bal oldali menüben
        
        const isExcel = fileObj.name.endsWith('.xlsx');
        this.loadFileContent(fileObj.path, isExcel);
        
        if (window.innerWidth <= 768) this.sidebar.classList.remove('open');
    }

    // 10. Fájl letöltése és megjelenítése
    async loadFileContent(localPath, isExcel) {
        this.contentView.innerHTML = '<div class="welcome-msg"><h3>Tétel betöltése...</h3></div>';
        try {
            const response = await fetch(localPath);
            if (!response.ok) throw new Error('A fájl nem található a gépen.');
            const arrayBuffer = await response.arrayBuffer();

            if (isExcel) {
                this.renderExcel(arrayBuffer);
            } else {
                this.renderDocx(arrayBuffer);
            }
        } catch (error) {
            this.contentView.innerHTML = `<h3 style="color:red;">Hiba a betöltéskor</h3><p>${error.message}</p>`;
        }
    }

    renderDocx(arrayBuffer) {
        mammoth.convertToHtml({ arrayBuffer: arrayBuffer })
            .then(result => {
                this.contentView.innerHTML = `<div class="doc-content">${result.value}</div>`;
                this.appendNavigation(); // <--- Gombok hozzáadása
                setTimeout(() => this.contentView.parentElement.scrollTop = 0, 10);
            })
            .catch(err => {
                console.error(err);
                this.contentView.innerHTML = "Hiba a Word konvertálásakor.";
            });
    }

    renderExcel(arrayBuffer) {
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const htmlTable = XLSX.utils.sheet_to_html(workbook.Sheets[workbook.SheetNames[0]]);
        this.contentView.innerHTML = `<div class="excel-table-container">${htmlTable.replace('<table', '<table class="excel-table"')}</div>`;
        this.appendNavigation(); // <--- Gombok hozzáadása
        this.contentView.parentElement.scrollTop = 0;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new App();
});