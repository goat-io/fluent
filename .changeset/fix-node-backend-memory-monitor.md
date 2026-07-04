---
"@goatlab/node-backend": patch
---

Measure memory monitor heap pressure against the V8 heap size limit instead of the currently allocated heap total to avoid false high-memory alerts.
