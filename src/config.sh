exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
echo "Hello from user-data!"
yum install -y git socat nc
git clone https://github.com/o8vm/serv-sh.git
git clone https://github.com/o8vm/sample.git
