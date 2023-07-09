# live-voting

Quick-n-dirty instructions for getting this working

```
ssh-keygen -t ed25519 -C 'buser.paul@gmail.com'
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
# Add SSH key to "deploy keys" on GitHub
git clone git@github.com:p42ul/live-voting.git
cd live-voting/
cd backend/
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
ip addr
# Add your IP address DNS entry
apt install python3.10-venv entr
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
./install_service.sh
systemctl status live-voting.service
```
