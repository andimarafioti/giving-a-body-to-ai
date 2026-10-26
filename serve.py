"""Serve the deck on http://localhost:8765, telling the browser to revalidate every file.

python's plain http.server sends no Cache-Control, so browsers keep scripts and slides by guesswork and
a reload can run stale code. With no-cache they ask each time; unchanged files (the GLBs) come back as
304 Not Modified, so nothing big is downloaded twice.

    uv run --no-project python serve.py [port]
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
handler = partial(Handler, directory=str(Path(__file__).parent))
print(f"http://localhost:{port}/index.html")
ThreadingHTTPServer(("", port), handler).serve_forever()
