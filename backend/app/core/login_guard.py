"""Slows down password guessing on /auth/login.

Failures are counted on three scopes, each inside a rolling window; hitting a
limit locks that scope for LOCK_SECONDS:

  pair  (email + IP)  5 failures - the normal "someone fat-fingered it" case,
                      locked only for that person on that connection
  email (any IP)      20 failures - guessing spread over many addresses
  ip    (any email)   30 failures - one address spraying many accounts

State is in memory (the backend is a single process) so a restart clears it;
that's an acceptable trade for not needing a table. A successful sign-in or a
completed password reset clears that account's counters.
"""
import math
import threading
import time
from collections import defaultdict, deque

WINDOW_SECONDS = 15 * 60
LOCK_SECONDS = 15 * 60
LIMITS = {"pair": 5, "email": 20, "ip": 30}
_PRUNE_ABOVE = 5000


class LoginGuard:
    def __init__(self, clock=time.monotonic):
        self._clock = clock
        self._mutex = threading.Lock()
        self._failures = {scope: defaultdict(deque) for scope in LIMITS}
        self._locked_until = {scope: {} for scope in LIMITS}

    @staticmethod
    def _keys(email: str, ip: str) -> dict:
        return {"pair": (email, ip), "email": email, "ip": ip}

    def retry_after(self, email: str, ip: str) -> int:
        """Seconds until sign-in is allowed again for this attempt (0 = allowed)."""
        now = self._clock()
        remaining = 0.0
        with self._mutex:
            for scope, key in self._keys(email, ip).items():
                until = self._locked_until[scope].get(key)
                if until is None:
                    continue
                if until > now:
                    remaining = max(remaining, until - now)
                else:
                    del self._locked_until[scope][key]
        return math.ceil(remaining)

    def record_failure(self, email: str, ip: str) -> bool:
        """Count a failed attempt. Returns True if it just caused a new lock."""
        now = self._clock()
        newly_locked = False
        with self._mutex:
            for scope, key in self._keys(email, ip).items():
                attempts = self._failures[scope][key]
                while attempts and now - attempts[0] > WINDOW_SECONDS:
                    attempts.popleft()
                attempts.append(now)
                if len(attempts) >= LIMITS[scope] and key not in self._locked_until[scope]:
                    self._locked_until[scope][key] = now + LOCK_SECONDS
                    attempts.clear()
                    newly_locked = True
            self._prune(now)
        return newly_locked

    def record_success(self, email: str, ip: str) -> None:
        with self._mutex:
            self._forget_email(email)

    def clear_email(self, email: str) -> None:
        with self._mutex:
            self._forget_email(email)

    def _forget_email(self, email: str) -> None:
        self._failures["email"].pop(email, None)
        self._locked_until["email"].pop(email, None)
        for scope in ("pair",):
            for key in [k for k in self._failures[scope] if k[0] == email]:
                del self._failures[scope][key]
            for key in [k for k in self._locked_until[scope] if k[0] == email]:
                del self._locked_until[scope][key]

    def _prune(self, now: float) -> None:
        if sum(len(d) for d in self._failures.values()) <= _PRUNE_ABOVE:
            return
        for scope in LIMITS:
            for key in [k for k, q in self._failures[scope].items() if not q or now - q[-1] > WINDOW_SECONDS]:
                del self._failures[scope][key]
            for key in [k for k, until in self._locked_until[scope].items() if until <= now]:
                del self._locked_until[scope][key]


login_guard = LoginGuard()
