# TaskFlow

Ứng dụng web quản lý công việc cá nhân cho sinh viên và người làm việc độc lập: môn học, lịch trình hằng ngày, dự án, bảng Kanban/Scrum.

Đặc tả nằm trong [`docs/`](docs/README.md); quy tắc làm việc trong [`CLAUDE.md`](CLAUDE.md).

## Chạy từ đầu trên Windows (5 lệnh)

**Cần cài trước:** [Node.js ≥ 22.12](https://nodejs.org/), [Docker Desktop](https://www.docker.com/products/docker-desktop/) (đang chạy), Git.

Mở PowerShell trong thư mục dự án:

```powershell
docker compose up -d db      # 1. bật PostgreSQL 17
npm install                  # 2. cài thư viện (tự sinh Prisma client)
npm run env:init             # 3. tạo .env từ .env.example, điền BETTER_AUTH_SECRET ngẫu nhiên
npx prisma migrate dev       # 4. tạo bảng trong DB
npm run dev                  # 5. chạy ở http://localhost:3000
```

Mở http://localhost:3000/register để tạo tài khoản; đăng ký xong sẽ vào trang **Hôm nay**.

> `npm run env:init` không ghi đè `.env` đã có. Lệnh chạy được cả trên macOS/Linux.

## Kiểm tra

```powershell
npm run lint
npm run typecheck
npm run test                      # unit + component + integration (cần DB đang chạy)
npx playwright install chromium   # chỉ lần đầu
npm run test:e2e                  # build production rồi chạy Playwright + axe
```

CI (GitHub Actions, `.github/workflows/ci.yml`) chạy lint, typecheck, test (có PostgreSQL), build trên mỗi pull request; E2E chạy trên `main` và PR có nhãn `e2e`.

## Đăng nhập Google (tùy chọn)

Điền **cả hai** `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` trong `.env` (redirect URI: `http://localhost:3000/api/auth/callback/google`). Thiếu một trong hai thì nút "Tiếp tục với Google" bị ẩn, đăng nhập email vẫn chạy bình thường.

## Lỗi hay gặp trên Windows

| Hiện tượng                                     | Cách xử lý                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `docker compose` báo không kết nối được Docker | Mở Docker Desktop, đợi biểu tượng chuyển xanh rồi chạy lại.                                                            |
| `port 5432 is already allocated`               | Máy đã có PostgreSQL khác. Tắt dịch vụ đó (`services.msc`) hoặc đổi cổng trong `docker-compose.yml` và `DATABASE_URL`. |
| `Invalid environment variables` khi chạy       | Chưa có `.env` hoặc thiếu biến: chạy `npm run env:init`.                                                               |
| `P1001: Can't reach database server`           | DB chưa sẵn sàng: đợi vài giây sau lệnh 1 rồi chạy lại lệnh 4.                                                         |
