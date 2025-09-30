import os
import json
import logging
import requests
from itertools import cycle

# Base dir resolves ${HOME} properly
BASE_DIR = os.path.expandvars(os.path.expanduser("${HOME}/yt_dlo"))
CONFIG_DIR = os.path.join(BASE_DIR, "config")
CONFIG_FILE = os.path.join(CONFIG_DIR, "proxies.json")

def load_proxies():
    if not os.path.exists(CONFIG_FILE):
        logging.error(f"Proxy config file not found: {CONFIG_FILE}")
        return []

    with open(CONFIG_FILE, "r") as f:
        cfg = json.load(f)

    username = cfg.get("username")
    password = cfg.get("password")
    raw_proxies = cfg.get("proxies", [])

    proxies = []
    for ip, port in raw_proxies:
        proxy_url = f"http://{username}:{password}@{ip}:{port}"
        proxies.append({
            "http": proxy_url,
            "https": proxy_url
        })
    return proxies

class ProxyRotator:
    def __init__(self, proxies):
        if not proxies:
            raise RuntimeError("No proxies loaded from config.")
        self._cycle = cycle(proxies)
        self.current = next(self._cycle)

    def get(self):
        return self.current

    def rotate(self):
        self.current = next(self._cycle)
        logging.info(f"Rotated to new proxy: {self.current['http']}")
        return self.current

# Test
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    proxies = load_proxies()
    rotator = ProxyRotator(proxies)

    for i in range(len(proxies) + 2):
        try:
            proxy = rotator.get()
            logging.info(f"Trying proxy: {proxy['http']}")
            r = requests.get("https://httpbin.org/ip", proxies=proxy, timeout=8)
            logging.info(f"Success with {proxy['http']}: {r.json()}")
            break
        except Exception as e:
            logging.error(f"Proxy {proxy['http']} failed: {e}")
            rotator.rotate()
