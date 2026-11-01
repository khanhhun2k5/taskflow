# 08. Yêu cầu phi chức năng

Yêu cầu phi chức năng mô tả hệ thống phải **tốt đến mức nào** (nhanh, an toàn, dễ dùng), thay vì phải **làm gì**.

## 1. Hiệu năng

Đo trên máy tầm trung, mạng 4G, dữ liệu 1 người dùng có 20 dự án, 10 môn, 2.000 việc.

| Mã | Yêu cầu | Cách kiểm |
|---|---|---|
| NFR-01 | Trang Hôm nay: Largest Contentful Paint ≤ 1,5 giây | Lighthouse trên bản build production |
| NFR-02 | API đọc (`GET`) p95 ≤ 200 ms; API ghi p95 ≤ 300 ms (đo tại server, không tính mạng) | Ghi thời gian xử lý trong log, kiểm tra khi có dữ liệu mẫu lớn |
| NFR-03 | Bảng Kanban 500 việc: kéo thả vẫn mượt (≥ 50 khung hình/giây) | Thử thủ công + Performance panel |
| NFR-04 | Kéo thả phản hồi trên giao diện ≤ 100 ms (trước khi server trả lời) | Cập nhật lạc quan |
| NFR-05 | Mọi truy vấn danh sách có chỉ mục phù hợp; không có truy vấn N+1 | Bật log truy vấn Prisma khi dev; rà soát khi review |
| NFR-06 | Bundle JS của trang đầu ≤ 250 KB (đã nén) | `next build` báo cáo kích thước |

## 2. Bảo mật

| Mã | Yêu cầu |
|---|---|
| NFR-10 | Mọi truy vấn tầng dịch vụ đều lọc theo `userId` của phiên. Không hàm dịch vụ nào nhận `userId` từ dữ liệu client gửi lên. |
| NFR-11 | Giới hạn tần suất, vượt → `429 RATE_LIMITED`. **(a) Từ P0:** route xác thực `/api/auth/*` dùng rate limit có sẵn của Better Auth, bộ đếm lưu trong DB (bảng `RateLimit`, file 04); đăng nhập 10 lần/phút/IP. `rateLimit.enabled: true` đặt tường minh (Better Auth mặc định chỉ bật ở production), nên dev cũng bị giới hạn. **IP lấy từ header `x-forwarded-for`** (`advanced.ipAddress.ipAddressHeaders`): Vercel và đa số reverse proxy ghi đè header này bằng IP thật của client. Better Auth 1.7 chỉ tin header có **một** giá trị; chuỗi nhiều IP (`client, proxy`) bị coi là không xác định → mọi request dùng chung một bucket và có cảnh báo trong log. Chạy sau proxy khác Vercel thì khai báo `advanced.ipAddress.trustedProxies`. IPv6 được gộp theo dải /64 (mặc định), nên khi dev trên localhost (`::1`) mọi request chung một bucket. **(b) Từ P5:** API ghi `/api/v1/*` 120 lần/phút/người dùng. |
| NFR-12 | Mật khẩu băm bằng thuật toán mặc định của Better Auth (scrypt). Không ghi mật khẩu, token, cookie vào log. |
| NFR-13 | Cookie phiên `HttpOnly`, `Secure` (production), `SameSite=Lax`. Better Auth kiểm tra nguồn gốc (origin) cho yêu cầu ghi. |
| NFR-14 | Mô tả việc là Markdown: hiển thị bằng `react-markdown` với cấu hình mặc định (bỏ qua HTML thô); **cấm** `rehype-raw` hoặc bất kỳ plugin nào cho phép HTML thô, chống XSS. |
| NFR-15 | Không commit bí mật. `.env` trong `.gitignore`; chỉ có `.env.example`. |
| NFR-16 | Token lịch `.ics` là chuỗi ngẫu nhiên ≥ 32 byte, lưu dạng băm, tạo lại được (vô hiệu token cũ). |
| NFR-17 | Header bảo mật: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. |
| NFR-18 | Thông báo lỗi trả cho client không chứa stack trace hay câu SQL. |

## 3. Khả năng truy cập

Mục tiêu: đạt WCAG 2.2 mức AA (bộ tiêu chuẩn quốc tế về khả năng truy cập web).

| Mã | Yêu cầu |
|---|---|
| NFR-20 | Mọi thao tác chính làm được hoàn toàn bằng bàn phím, kể cả kéo thả (dùng `KeyboardSensor` của dnd-kit). |
| NFR-21 | Mọi phần tử tương tác có nhãn cho trình đọc màn hình; thông báo kéo thả bằng vùng `aria-live`. |
| NFR-22 | Tương phản chữ ≥ 4,5:1; thành phần đồ họa ≥ 3:1 ở cả chế độ sáng và tối. |
| NFR-23 | Không truyền đạt thông tin chỉ bằng màu (ưu tiên, trễ hạn luôn có thêm biểu tượng hoặc chữ). |
| NFR-24 | Vùng chạm trên điện thoại ≥ 44×44 px. |
| NFR-25 | Tôn trọng `prefers-reduced-motion`: tắt hiệu ứng chuyển động khi người dùng yêu cầu. |

## 4. Ngày giờ và múi giờ

Đây là nguồn lỗi phổ biến nhất của ứng dụng lịch, nên quy tắc được viết rõ.

| Mã | Yêu cầu |
|---|---|
| NFR-30 | DB lưu mọi thời điểm ở UTC. Ngày thuần (`@db.Date`) chỉ dùng cho khái niệm "ngày" không có giờ: ngày kỳ học, ngày sprint, ngày lặp. |
| NFR-31 | "Hôm nay", "cuối ngày", "đầu tuần" luôn tính theo `User.timezone`, không theo múi giờ của server. Dùng `@date-fns/tz`. |
| NFR-32 | Hạn cả ngày (`dueAllDay = true`) lưu `dueAt` = 00:00 ngày đó theo múi giờ người dùng, quy ra UTC. Việc **trễ hạn** khi `now` ≥ 00:00 của **ngày lịch kế tiếp** theo múi giờ người dùng (BR-04). Tính bằng `addDays` trên ngày trong múi giờ (`@date-fns/tz`), **không** cộng 24 giờ: ngày đổi giờ mùa hè dài 23 hoặc 25 giờ (TC-64). |
| NFR-33 | Không so sánh ngày bằng chuỗi; không dùng `new Date("2026-11-03")` (bị hiểu là UTC). Dùng hàm trong `src/lib/dates.ts`. |
| NFR-34 | Hàm thuần không gọi `new Date()` bên trong; nhận `now` qua tham số (ADR-08). |
| NFR-35 | Tuần bắt đầu theo `User.weekStartsOn` (mặc định thứ Hai). |

## 5. Đa ngôn ngữ

| Mã | Yêu cầu |
|---|---|
| NFR-40 | Mọi chuỗi hiển thị nằm trong `messages/vi.json` và `messages/en.json`. Thiếu khóa ở một ngôn ngữ thì test CI báo lỗi. |
| NFR-41 | Định dạng ngày, số, số nhiều dùng `Intl` qua next-intl theo `User.locale`. |
| NFR-42 | Mã nguồn (tên biến, hàm, file, comment kỹ thuật) viết bằng tiếng Anh. |

## 6. Tin cậy và dữ liệu

| Mã | Yêu cầu |
|---|---|
| NFR-50 | Thao tác nhiều bước (chuyển việc + ghi nhật ký; kết thúc sprint; sửa hàng loạt) chạy trong **một giao dịch** DB. |
| NFR-51 | Cập nhật lạc quan: lỗi server thì hoàn tác giao diện và hiện thông báo có nút "Thử lại". |
| NFR-52 | Hai tab cùng sửa một việc: lần ghi sau thắng, nhưng client làm mới dữ liệu khi tab được lấy lại tiêu điểm (TanStack Query `refetchOnWindowFocus`). |
| NFR-53 | Sao lưu DB hằng ngày, giữ 7 ngày (dùng tính năng của nhà cung cấp PostgreSQL). |
| NFR-54 | Migration chỉ tiến (không sửa migration đã áp dụng). Không chạy `migrate reset` trên DB có dữ liệu thật. |

## 7. Khả năng bảo trì

| Mã | Yêu cầu |
|---|---|
| NFR-60 | TypeScript `strict`, cấm `any` (luật ESLint `@typescript-eslint/no-explicit-any: error`). |
| NFR-61 | Hàm thuần trong `features/*/domain` có độ phủ test dòng ≥ 90%. |
| NFR-62 | Component ≤ 150 dòng; vượt thì tách. |
| NFR-63 | Ghi log có cấu trúc (JSON) ở server: thời điểm, đường dẫn, mã trạng thái, thời gian xử lý, `userId` (không ghi dữ liệu cá nhân khác). |

## 8. Tương thích

| Mã | Yêu cầu |
|---|---|
| NFR-70 | Hỗ trợ 2 phiên bản mới nhất của Chrome, Edge, Firefox, Safari (macOS và iOS). |
| NFR-71 | Bố cục dùng được từ chiều rộng 360 px. |
