#!/usr/bin/env python3
"""Local-only preview server for the Bracketly redesign.

Serves this folder on http://127.0.0.1:8765/ but answers /config.js with an
empty config, so the app runs in "This device only" (localStorage) mode and
never talks to the live Supabase backend, even though config.js exists here.

Usage:  python3 tools/serve-preview.py [port]
"""
import http.server, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STUB = b"/* preview: live backend disabled */ window.BK_CONFIG = {};\n"

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)
    def do_GET(self):
        if self.path.split('?')[0].rstrip('/').endswith('config.js'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(STUB)))
            self.end_headers(); self.wfile.write(STUB); return
        # never expose dotfiles or the git folder
        if '/.' in self.path:
            self.send_error(404); return
        return super().do_GET()
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    http.server.ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
