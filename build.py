# Bundles everything into one self-contained index.html (runs offline, works on GitHub Pages).
# Usage:  python build.py            build index.html
#         node tools/check.js         validate content and run the automated tests (do this before pushing)
#         node tools/export_art.js    just refresh the GIFs in docs/art/ (build does this too)
import os, json, glob, sys
here = os.path.dirname(os.path.abspath(__file__))
read = lambda p: open(os.path.join(here, p), encoding='utf-8').read()

def source_files(include_browser=True):
    order = json.load(open(os.path.join(here, 'build_order.json'), encoding='utf-8'))['files']
    seen, out = set(), []
    for entry in order:
        if entry.get('browser') and not include_browser: continue
        paths = sorted(glob.glob(os.path.join(here, entry['path']))) if '*' in entry['path'] else [os.path.join(here, entry['path'])]
        for p in paths:
            rel = os.path.relpath(p, here).replace('\\', '/')
            if rel in seen or rel in entry.get('skip', []): continue
            seen.add(rel); out.append((rel, bool(entry.get('scoped'))))
    return out

def bundle(include_browser=True):
    parts = []
    for rel, scoped in source_files(include_browser):
        code = read(rel)
        parts.append('// ---- ' + rel + ' ----\n' + ('(function () {\n' + code + '\n})();' if scoped else code))
    return '\n'.join(parts)

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--list':
        print(json.dumps([r for r, _ in source_files(False)])); sys.exit(0)
    libs = '\n'.join(read('vendor/' + f) for f in ['qrcode.js', 'jsQR.js', 'peerjs.min.js']).replace('</script>', '<\\/script>')
    shell = read('src/shell.html')
    out = shell.replace('<script>/*LIBS*/</script>', '<script>' + libs + '</script>').replace('<script>/*GAME*/</script>', '<script>' + bundle() + '</script>')
    open(os.path.join(here, 'index.html'), 'w', encoding='utf-8', newline='\n').write(out)
    print('wrote index.html', len(out), 'bytes from', len(source_files()), 'source files')
    # refresh the art gallery in docs/art/ (needs Node; skipped if it isn't installed)
    import shutil, subprocess
    if shutil.which('node'):
        r = subprocess.run(['node', os.path.join(here, 'tools', 'export_art.js')])
        if r.returncode != 0: print('art export failed (the game itself built fine)')
    else:
        print('node not found: skipped the art gallery (docs/art)')
