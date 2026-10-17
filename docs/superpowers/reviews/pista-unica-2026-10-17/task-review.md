# Task review — cf509ad
Reviewer /root/pista_task_review. Spec: needs fix. Quality: needs fix.
Important introduced recovery issue: PistaUnicaLanRound.tsx submit locks sent=true when CONFIRM_CLUES fails; production callback returns void and provider stores error, so await/catch cannot unlock. Need regression for void callback, busy/error transition and retry without remount. Baseline clue/guess behavior existed, review extension introduced here.
No other actionable introduced issues found. Shared cards/pagination, private concealment, accurate awards/legacy fallback and reduced motion reviewed. No suites rerun. Outside diff checks limited to provider callback and local persistence. Physical LAN remains pending.
Controller verified callback source and accepts finding. Implementer fix round1 dispatched, no provider/runtime change authorized.

## Scoped rereview7ad3df5
Approved. LanRound51–54 resets guard on idle failure; tests164+ cover normal/empty retries, repeated identical errors, stale errors, drafts. No introduced issues; no suites rerun.
