/* ==========================================
   GITHUB BEÁLLÍTÁSOK (Ide írd a saját adataidat!)
   ========================================== */
const GITHUB_USER = "Bl4ver"; // pl. "KovacsBela"
const GITHUB_REPO = "Erettsegi-v2";  // pl. "erettsegi-oldal"
const ROOT_FOLDER = "Erettsegi_Adatok";     // A főmappa neve a repón belül

// GitHub API végpont (A 'main' branchet olvassa)
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/git/trees/main?recursive=1`;
const RAW_URL_BASE = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/`;

/* ==========================================
   OOP ALKALMAZÁS LOGIKA
   ========================================== */

class App {
    constructor() {
        this.fileSystem = {}; // Ide építjük fel a mapparendszert
        
        // UI Elemek
        this.mainTabsUI = document.getElementById('mainTabs');
        this.subTabsUI = document.getElementById('subTabs');
        this.fileListUI = document.getElementById('fileList');
        this.contentView = document.getElementById('contentView');
        this.syncStatus = document.getElementById('syncStatus');
        
        // Állapot
        this.activeSubject = null;
        this.activeCategory = null;

        this.initTheme();
        this.fetchGitHubData();
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

    // 2. A MÁGIA: Adatok letöltése GitHubról
    async fetchGitHubData() {
        try {
            const response = await fetch(GITHUB_API_URL);
            if (!response.ok) throw new Error("Nem sikerült elérni a GitHubot.");
            
            const data = await response.json();
            this.buildFileSystem(data.tree);
            
            this.syncStatus.textContent = "✅ Szinkronizálva";
            this.syncStatus.style.color = "green";
            
            this.renderMainTabs();
        } catch (error) {
            console.error(error);
            this.syncStatus.textContent = "❌ Hiba a szinkronizáláskor";
            this.syncStatus.style.color = "red";
            this.contentView.innerHTML = `<h3>Kérlek, állítsd be a GitHub adataidat az app.js-ben!</h3>`;
        }
    }

    // 3. GitHub "lapos" listájából strukturált objektum építése
    buildFileSystem(treeArray) {
        // Csak azokat a fájlokat nézzük, amik a ROOT_FOLDER-ben vannak és docx/xlsx kiterjesztésűek
        const files = treeArray.filter(item => 
            item.path.startsWith(ROOT_FOLDER + "/") && 
            item.type === "blob" &&
            (item.path.endsWith('.docx') || item.path.endsWith('.xlsx'))
        );

        files.forEach(file => {
            // Path feldarabolása: Erettsegi_Adatok / Irodalom / Korszakok / romantika.docx
            const parts = file.path.replace(ROOT_FOLDER + "/", "").split("/");
            if (parts.length >= 3) {
                const subject = parts[0];  // Irodalom
                const category = parts[1]; // Korszakok
                const fileName = parts[2]; // romantika.docx
                
                if (!this.fileSystem[subject]) this.fileSystem[subject] = {};
                if (!this.fileSystem[subject][category]) this.fileSystem[subject][category] = [];
                
                this.fileSystem[subject][category].push({
                    name: fileName,
                    path: file.path
                });
            }
        });
    }

    // 4. UI: Főtárgyak (1. szint) renderelése
    renderMainTabs() {
        this.mainTabsUI.innerHTML = '';
        const subjects = Object.keys(this.fileSystem);
        
        if (subjects.length === 0) return;

        subjects.forEach((subject, index) => {
            const li = document.createElement('li');
            li.innerHTML = `📁 ${subject}`;
            
            if (index === 0) {
                li.classList.add('active');
                this.activeSubject = subject;
            }

            li.addEventListener('click', () => {
                this.mainTabsUI.querySelectorAll('li').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
                this.activeSubject = subject;
                this.renderSubTabs();
            });

            this.mainTabsUI.appendChild(li);
        });

        if (this.activeSubject) this.renderSubTabs();
    }

    // 5. UI: Kategóriák (2. szint) renderelése
    renderSubTabs() {
        this.subTabsUI.innerHTML = '';
        this.fileListUI.innerHTML = ''; // Fájllista ürítése
        
        const categories = Object.keys(this.fileSystem[this.activeSubject] || {});
        if (categories.length === 0) return;

        categories.forEach((category, index) => {
            const li = document.createElement('li');
            li.textContent = category;
            
            if (index === 0) {
                li.classList.add('active');
                this.activeCategory = category;
            }

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

    // 6. UI: Fájlok (3. szint) renderelése
    renderFileList() {
        this.fileListUI.innerHTML = '';
        const files = this.fileSystem[this.activeSubject][this.activeCategory] || [];

        files.forEach(fileObj => {
            const li = document.createElement('li');
            const isExcel = fileObj.name.endsWith('.xlsx');
            li.innerHTML = `${isExcel ? '📊' : '📄'} ${fileObj.name.replace(/\.[^/.]+$/, "")}`; // Kiterjesztés levágása a névről
            
            li.addEventListener('click', () => {
                this.fileListUI.querySelectorAll('li').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
                this.loadFileContent(fileObj.path, isExcel);
            });

            this.fileListUI.appendChild(li);
        });
    }

    // 7. Fájl letöltése és megjelenítése (Mammoth / SheetJS)
    async loadFileContent(repoPath, isExcel) {
        this.contentView.innerHTML = '<div class="welcome-msg"><h3>Fájl letöltése...</h3></div>';
        
        // Nyers fájl URL-je a GitHubon
        const fileUrl = RAW_URL_BASE + repoPath;

        try {
            const response = await fetch(fileUrl);
            if (!response.ok) throw new Error('Fájl nem található.');
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
            })
            .catch(err => this.contentView.innerHTML = "Hiba a Word konvertálásakor.");
    }

    renderExcel(arrayBuffer) {
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const htmlTable = XLSX.utils.sheet_to_html(workbook.Sheets[workbook.SheetNames[0]]);
        this.contentView.innerHTML = `<div class="excel-table-container">${htmlTable.replace('<table', '<table class="excel-table"')}</div>`;
    }
}

// Alkalmazás indítása
document.addEventListener('DOMContentLoaded', () => {
    new App();
});