# Bộ đặc tả hệ thống TaskFlow

Thư mục này chứa toàn bộ đặc tả của ứng dụng. `CLAUDE.md` ở thư mục gốc là bản tóm tắt quy tắc làm việc; các file dưới đây là chi tiết.

## Thứ tự đọc

| # | File | Nội dung | Đọc khi |
|---|---|---|---|
| 01 | [01-product-requirements.md](01-product-requirements.md) | Mục tiêu, người dùng, phạm vi, user story | Bắt đầu dự án, trước mỗi giai đoạn |
| 02 | [02-functional-spec.md](02-functional-spec.md) | Chức năng chi tiết và quy tắc nghiệp vụ (`BR-xx`) | Làm bất kỳ tính năng nào |
| 03 | [03-architecture.md](03-architecture.md) | Công nghệ đã chốt, kiến trúc, cấu trúc thư mục, quyết định thiết kế (`ADR-xx`) | Khởi tạo dự án, thêm thư viện |
| 04 | [04-data-model.md](04-data-model.md) | Lược đồ dữ liệu đầy đủ (Prisma), sơ đồ quan hệ, ràng buộc | Đụng tới `schema.prisma` |
| 05 | [05-api-spec.md](05-api-spec.md) | Danh sách endpoint, đầu vào/đầu ra, mã lỗi | Viết API hoặc gọi API từ giao diện |
| 06 | [06-ui-ux-spec.md](06-ui-ux-spec.md) | Màn hình, điều hướng, thành phần, phím tắt, trạng thái | Làm giao diện |
| 07 | [07-progress-metrics.md](07-progress-metrics.md) | Công thức tiến độ, velocity, burndown, điểm môn học | Làm `features/progress` hoặc trang điểm |
| 08 | [08-non-functional.md](08-non-functional.md) | Hiệu năng, bảo mật, truy cập, múi giờ, đa ngôn ngữ | Mọi lúc (ràng buộc chung) |
| 09 | [09-testing-strategy.md](09-testing-strategy.md) | Chiến lược và danh sách ca kiểm thử (`TC-xx`) | Viết test |
| 10 | [10-roadmap.md](10-roadmap.md) | Các giai đoạn, phạm vi và tiêu chí hoàn thành | Lập kế hoạch, báo cáo tiến độ |
| — | [PROGRESS.md](PROGRESS.md) | Trạng thái hiện tại, việc tiếp theo, câu hỏi còn mở | Đầu mỗi phiên làm việc |

## Quy ước mã định danh

Các file tham chiếu chéo nhau bằng mã:

- `US-xx`: user story (file 01).
- `BR-xx`: quy tắc nghiệp vụ (file 02). Code xử lý một quy tắc nên ghi mã đó trong comment, ví dụ `// BR-21`.
- `ADR-xx`: quyết định kiến trúc (file 03).
- `NFR-xx`: yêu cầu phi chức năng (file 08).
- `TC-xx`: ca kiểm thử (file 09).

## Cách cập nhật

- Khi đổi một quyết định đã chốt, sửa file liên quan **và** ghi lại lý do trong mục ADR của file 03.
- Không xóa mã đã cấp. Quy tắc bị bỏ thì đánh dấu `(đã bỏ)` để giữ lịch sử tham chiếu.
- Khi `schema.prisma` thay đổi đáng kể, cập nhật file 04.
