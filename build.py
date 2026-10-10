# Bundles src/ + vendor/ into one self-contained index.html (runs offline, works on GitHub Pages).
# Usage: python build.py
import os
here = os.path.dirname(os.path.abspath(__file__))
order = ['util.js', 'sprites.js', 'tex.js', 'world.js', 'sim.js', 'render.js', 'audio.js', 'input.js', 'net.js', 'main.js']
read = lambda *p: open(os.path.join(here, *p), encoding='utf-8').read()
game = '\n'.join(read('src', f) for f in order)
libs = '\n'.join(read('vendor', f) for f in ['qrcode.js', 'jsQR.js', 'peerjs.min.js']).replace('</script>', '<\\/script>')
out = read('src', 'shell.html').replace('<script>/*LIBS*/</script>', '<script>' + libs + '</script>').replace('<script>/*GAME*/</script>', '<script>' + game + '</script>')
open(os.path.join(here, 'index.html'), 'w', encoding='utf-8', newline='\n').write(out)
print('wrote index.html', len(out), 'bytes')
