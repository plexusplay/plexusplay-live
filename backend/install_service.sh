#!/bin/bash
sudo cp live-voting.service /etc/systemd/system/live-voting.service
sudo chmod 664 /etc/systemd/system/live-voting.service
sudo systemctl daemon-reload
sudo systemctl enable --now live-voting.service
