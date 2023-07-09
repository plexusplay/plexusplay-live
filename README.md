# live-voting

Quick-n-dirty instructions for getting this working

```
ssh-keygen -t ed25519 -C 'buser.paul@gmail.com'
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
git clone git@github.com:p42ul/live-voting.git
ls
cd live-voting/
ls
cd backend/
ls
cat install_service.sh
cat run_backend.sh
./install_service.sh
cat live-voting.service
pwd
cat run_backend.sh
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
ip addr
systemctl status live-voting.service
ls
certbot certonly --standalone
ls
systemctl start live-voting
systemctl status live-voting.service
journalctl -u live-voting.service
pgrep nginx
systemctl status live-voting.service
systemctl restart live-voting.service
systemctl status live-voting.service
ls
./run_backend.sh
python -m venv venv
sudo apt-get install python3
python3 -m venv venv
apt update
python3 -m venv venv
apt install python3.10-venv
python3 -m venv venv
./run_backend.sh
apt install entr
history
```
