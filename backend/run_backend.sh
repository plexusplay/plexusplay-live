#!/bin/bash
# Note: this script uses `entr` to detect changes to the filesystem
source /root/live-voting/backend/venv/bin/activate
# Restart the backend if a python source file changes
ls /root/live-voting/backend/*.py | entr -n -r python /root/live-voting/backend/backend.py run_secure /etc/letsencrypt/live/voting-socket-big.rumpus.club/fullchain.pem /etc/letsencrypt/live/voting-socket-big.rumpus.club/privkey.pem --port 443 --log INFO
