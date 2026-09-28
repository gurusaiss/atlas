from slowapi import Limiter
from slowapi.util import get_ipaddr

# get_ipaddr respects X-Forwarded-For so rate limiting works correctly behind
# Render's (and any other) reverse proxy, rather than bucketing all clients
# under the proxy's single IP address.
limiter = Limiter(key_func=get_ipaddr)
