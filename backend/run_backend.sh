#!/bin/bash
# Note: this script uses `entr` to detect changes to the filesystem
source /root/live-voting/backend/venv/bin/activate
# Restart the backend if a python source file changes
ls /root/live-voting/backend/*.py | entr -n -r python /root/live-voting/backend/backend.py --port 8080 --log INFO
