import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        proxy_headers=True,
        forwarded_allow_ips="*",
        reload=False,
        # A client (Cloudflare edge, or the SSR handshake fetch) that hangs up
        # mid-request used to leave the socket half-open until the OS default
        # keep-alive kicked in — during that window the DB connection it held
        # stayed checked out of the pool. Shorter keep-alive means a dropped
        # connection is reclaimed in seconds, not minutes.
        timeout_keep_alive=15,
        # Bound how long a single request can run before Uvicorn gives up on
        # it, so one wedged handler can't hold a pooled DB connection forever.
        timeout_graceful_shutdown=10,
    )
