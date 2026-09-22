#!/usr/bin/env python3
"""
Test Suite rápida para validação de dados (JSONs) e integridade de imports.
Roda em menos de 0.1s e garante que nenhum mod quebrou o jogo.
"""

import json
import glob
import os
import sys

def test_jsons():
    print("--> 1. Validando arquivos JSON em assets/...")
    files = glob.glob("assets/**/*.json", recursive=True)
    assert len(files) >= 5, f"Esperado pelo menos 5 arquivos JSON, encontrados: {len(files)}"
    for f in sorted(files):
        with open(f, "r", encoding="utf-8") as fp:
            data = json.load(fp)
        
        # Validação específica por tipo
        if "weapons.json" in f:
            weps = data.get("weapons", {})
            for wId, wData in weps.items():
                assert "damageBody" in wData and wData["damageBody"] > 0, f"Arma {wId} sem dano de corpo"
                assert "magSize" in wData and wData["magSize"] > 0, f"Arma {wId} sem magSize"
                assert "fireInterval" in wData and wData["fireInterval"] > 0, f"Arma {wId} sem fireInterval"
            print(f"    [OK] {f} ({len(weps)} armas validadas)")

        elif "maps" in f:
            assert "size" in data, f"Mapa {f} sem size"
            assert "staticGeometry" in data and len(data["staticGeometry"]) > 0, f"Mapa {f} sem geometria"
            assert "playerSpawns" in data and len(data["playerSpawns"]) > 0, f"Mapa {f} sem spawns de jogador"
            print(f"    [OK] {f} ({len(data['staticGeometry'])} blocos estáticos)")

        elif "audio.json" in f:
            sounds = data.get("sounds", {})
            assert len(sounds) >= 10, f"AudioBank incompleto em {f}"
            print(f"    [OK] {f} ({len(sounds)} sons sintetizados)")

        else:
            print(f"    [OK] {f}")

def test_imports():
    print("\n--> 2. Validando integridade de imports ES Modules...")
    all_files = []
    for root, _, files in os.walk("src"):
        for f in files:
            if f.endswith(".js"):
                all_files.append(os.path.normpath(os.path.join(root, f)))

    broken = []
    for fpath in all_files:
        with open(fpath, "r", encoding="utf-8") as fp:
            for line_no, line in enumerate(fp, 1):
                line = line.strip()
                if line.startswith("import ") and " from " in line:
                    parts = line.split(" from ")
                    imp_str = parts[1].strip(";").strip("'").strip('"')
                    if imp_str.startswith("."):
                        target = os.path.normpath(os.path.join(os.path.dirname(fpath), imp_str))
                        if not os.path.exists(target):
                            broken.append(f"{fpath}:{line_no} -> {imp_str}")

    assert len(broken) == 0, f"Imports quebrados encontrados:\n" + "\n".join(broken)
    print(f"    [OK] Todos os {len(all_files)} módulos ES6 têm imports válidos!")

if __name__ == "__main__":
    try:
        test_jsons()
        test_imports()
        print("\n========================================")
        print("  SUCESSO: TODOS OS TESTES PASSARAM!  ")
        print("========================================")
        sys.exit(0)
    except AssertionError as e:
        print(f"\n[FALHA DE TESTE]: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERRO INESPERADO]: {e}")
        sys.exit(1)
