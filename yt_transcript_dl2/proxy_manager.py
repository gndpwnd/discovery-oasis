"""
Proxy Manager for rotating and tracking proxies
"""

from typing import List, Optional


class ProxyManager:
    """Manages proxy rotation and tracking"""
    
    def __init__(self, proxies: List[str]):
        self.proxies = proxies
        self.current_proxy = None
        self.current_proxy_index = 0
        self.working_proxy = None
        self.all_failed = False
        
    def _format_proxy(self, proxy) -> Optional[str]:
        """Normalize proxy entries to a proxy URL like http://host:port"""
        if proxy is None:
            return None
        # If already includes scheme, return as-is
        if isinstance(proxy, str) and (proxy.startswith('http://') or 
                                      proxy.startswith('https://') or 
                                      proxy.startswith('socks5://') or 
                                      proxy.startswith('socks4://')):
            return proxy
        host = None
        port = None
        if isinstance(proxy, (list, tuple)):
            if len(proxy) >= 2:
                host, port = proxy[0], proxy[1]
            elif len(proxy) == 1:
                host = proxy[0]
        elif isinstance(proxy, str):
            if ':' in proxy:
                host, port = proxy.split(':', 1)
            else:
                host = proxy
        else:
            # Unsupported type
            return None
        try:
            port = int(port) if port is not None else None
        except Exception:
            port = None
        if port:
            return f"http://{host}:{port}"
        else:
            # Default to common HTTP proxy port if not provided
            return f"http://{host}:8080"
        
    def get_proxy(self, force_next: bool = False) -> Optional[str]:
        """Get current proxy or next one if current failed"""
        # If force_next is True, move to next proxy even if we have a working one
        if force_next and self.working_proxy:
            self.working_proxy = None
            self.current_proxy_index += 1
        
        # If we have a working proxy, keep using it (normalize it)
        if self.working_proxy:
            self.current_proxy = self.working_proxy
            return self._format_proxy(self.current_proxy)
        
        # Otherwise get next proxy from list
        if self.current_proxy_index >= len(self.proxies):
            # We've exhausted all proxies
            self.all_failed = True
            return None
        
        self.current_proxy = self.proxies[self.current_proxy_index]
        return self._format_proxy(self.current_proxy)
    
    def mark_success(self):
        """Mark current proxy as working"""
        self.working_proxy = self.current_proxy
    
    def mark_failed(self):
        """Mark current proxy as failed and move to next"""
        self.working_proxy = None
        self.current_proxy_index += 1
    
    def reset(self):
        """Reset to beginning of proxy list"""
        self.current_proxy_index = 0
        self.working_proxy = None
        self.all_failed = False