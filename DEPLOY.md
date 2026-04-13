# DEPLOY GUIDE — ADN AI BOT

> AI đọc file này TRƯỚC KHI làm bất cứ thứ gì liên quan đến deploy.
> Không được tự bịa quy trình. Làm đúng theo hướng dẫn dưới đây.

## Setup thực tế

| Thành phần | Công nghệ | Lệnh restart |
|---|---|---|
| Bridge (Python) | Docker container `adn-fiinquant` | Xem bên dưới |
| Frontend | Systemd `adn-nextjs.service` | `systemctl restart adn-nextjs` |

## ⚠️ Quy tắc quan trọng nhất

**Bridge chạy từ Docker image cũ — code KHÔNG mount từ host.**
- `scp` file lên host **KHÔNG CÓ TÁC DỤNG**
- Muốn update Bridge phải dùng `docker cp` vào container
- Không được rebuild image trừ khi có thay đổi dependencies (requirements.txt)

## Quy trình deploy Bridge (Python)

Khi có thay đổi file `.py`:

```bash
# Bước 1: Copy file vào container (KHÔNG phải scp lên host)
docker cp /home/adncapital/app/fiinquant-bridge/main.py adn-fiinquant:/app/main.py

# Bước 2: Restart uvicorn bên trong container
docker exec adn-fiinquant pkill -f uvicorn || true
docker exec -d adn-fiinquant uvicorn main:app --host 0.0.0.0 --port 8000

# Bước 3: Verify
docker ps | grep adn-fiinquant
```

## Quy trình deploy Frontend (Next.js)

```bash
# Bước 1: Pull code
cd /home/adncapital/app/nextjs && git pull

# Bước 2: Build
npm run build

# Bước 3: Restart
systemctl restart adn-nextjs
```

## Dùng script nhanh

```bash
bash deploy.sh bridge      # chỉ deploy Bridge
bash deploy.sh frontend    # chỉ deploy Frontend  
bash deploy.sh all         # deploy cả hai
```

## Khi nào cần rebuild Docker image?

CHỈ rebuild khi thay đổi:
- `requirements.txt`
- `Dockerfile`
- Dependencies mới

Lệnh rebuild:
```bash
docker build -t adn-capital-fiinquant .
docker stop adn-fiinquant
docker rm adn-fiinquant
docker run -d --name adn-fiinquant adn-capital-fiinquant
```

## Checklist trước khi deploy

- [ ] Code đã test local chưa?
- [ ] Chỉ thay đổi `.py` thôi? → dùng `docker cp`
- [ ] Có thay đổi dependencies? → mới rebuild image
- [ ] Sau deploy: kiểm tra `docker ps` và `systemctl status adn-nextjs`
