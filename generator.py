import os
import json

ROOT_DIR = "Erettsegi_Adatok"
OUTPUT_FILE = "data.json"

file_system = {}

if not os.path.exists(ROOT_DIR):
    print(f"❌ Hiba: Nem találom a '{ROOT_DIR}' mappát!")
    exit()

# Végigmegyünk az 'Erettsegi_Adatok' mappában lévő tantárgyakon (1. szint)
for subject in os.listdir(ROOT_DIR):
    subject_path = os.path.join(ROOT_DIR, subject)
    
    if os.path.isdir(subject_path):
        file_system[subject] = {}
        
        # Az os.walk minden almappát és fájlt megkeres, bármilyen mélyen is vannak
        for current_dir, _, files in os.walk(subject_path):
            for filename in files:
                # Csak a Word és Excel fájlokat gyűjtjük be
                if filename.endswith(('.docx', '.xlsx')):
                    
                    # Kiszámoljuk, hol van a fájl a tantárgyhoz képest
                    relative_path = os.path.relpath(current_dir, subject_path)
                    
                    if relative_path == ".":
                        category = "Általános" # Ha nincs almappa, ide kerül
                    else:
                        # A buborékos menü neve a legelső almappa neve lesz
                        category = relative_path.split(os.sep)[0]
                        
                    if category not in file_system[subject]:
                        file_system[subject][category] = []
                        
                    # Összerakjuk az elérési utat, a Windowsos \ jeleket weben is működő / jelre cserélve
                    full_path = os.path.join(current_dir, filename).replace('\\', '/')
                    
                    file_system[subject][category].append({
                        "name": filename,
                        "path": full_path
                    })

# Adatok kimentése
with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    json.dump(file_system, f, ensure_ascii=False, indent=4)

print(f"✅ Siker! A térkép frissült a '{OUTPUT_FILE}' fájlban.")