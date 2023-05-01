source /root/live-voting/backend/venv/bin/activate
python /root/live-voting/backend/backend.py run_secure /etc/letsencrypt/live/voting-socket.rumpus.club/fullchain.pem /etc/letsencrypt/live/voting-socket.rumpus.club/privkey.pem
