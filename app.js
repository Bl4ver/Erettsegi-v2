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
        
        // ÚJ UI Elem: A Tételek szekció dinamikus címe
        this.fileListTitleUI = document.getElementById('fileListTitle');
        
        // Hamburger menü és oldalsáv
        this.hamburgerBtn = document.getElementById('hamburgerMenu');
        this.sidebar = document.querySelector('.resizable-sidebar');
        
        // Állapot (State)
        this.activeSubject = null;
        this.activeCategory = null;
        this.currentFilePath = null;

        // Inicializálások
        this.initTheme();
        this.initSearch();
        this.initHamburger();
        this.loadLocalData();
    }

    // 1. Téma kezelés (Sötét/Világos)
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

    // 2. Hamburger menü kattintás esemény
    initHamburger() {
        this.hamburgerBtn.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                this.sidebar.classList.toggle('open');
            } else {
                this.sidebar.classList.toggle('hidden');
            }
        });
    }

    // 3. Kereső logika (Élő szűrés)
    initSearch() {
        this.searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            
            if (query.length < 2) {
                // Ha törli a keresést, visszatöltjük a normál nézetet
                if (this.activeCategory) {
                    this.renderFileList();
                } else {
                    this.fileGridUI.innerHTML = '';
                    this.fileListTitleUI.textContent = 'Tételek';
                }
                return;
            }

            // Globális keresés a teljes fileSystem-ben
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

    // 4. Adatok betöltése
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
            this.contentView.innerHTML = `
                <div class="welcome-msg" style="color: red;">
                    <h3>Hiba: Nincs data.json fájl!</h3>
                    <p>Futtasd le a <b>generator.py</b> fájlt a mappádban!</p>
                </div>`;
        }
    }

    // MEMÓRIA
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

    // 5. UI: Főtárgyak
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

    // 6. UI: Kategóriák
    renderSubTabs() {
        this.subTabsUI.innerHTML = '';
        this.fileGridUI.innerHTML = ''; 
        this.searchInput.value = ''; 
        this.fileListTitleUI.textContent = 'Tételek'; // Alaphelyzetbe állítjuk a címet
        
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

        if (this.activeCategory) {
            this.renderFileList();
        }
    }

    // 7. UI: Fájl Kártyák listázása
    renderFileList() {
        this.fileGridUI.innerHTML = '';
        
        // JAVÍTÁS: A felirat frissítése a kategória nevére
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

    // Keresési eredmények renderelése
    renderSearchResults(results, query) {
        this.fileGridUI.innerHTML = '';
        
        // Cím módosítása keresés közben
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

    // Kártya HTML generátor
    createFileCard(fileObj, displayName, metaText = null) {
        const isExcel = fileObj.name.endsWith('.xlsx');
        const card = document.createElement('div');
        card.className = 'doc-card';
        
        if (this.currentFilePath === fileObj.path) {
            card.classList.add('active');
        }

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
            document.querySelectorAll('.doc-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            this.currentFilePath = fileObj.path;
            localStorage.setItem('lastOpenedFile', fileObj.path); 
            
            this.loadFileContent(fileObj.path, isExcel);
            
            // Mobilon automatikusan becsukjuk a menüt
            if (window.innerWidth <= 768) {
                this.sidebar.classList.remove('open');
            }
        });

        return card;
    }

    // 8. Fájl letöltése és megjelenítése (Mammoth / SheetJS)
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
        this.contentView.parentElement.scrollTop = 0;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new App();
});