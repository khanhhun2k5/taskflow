# 01. Yêu cầu sản phẩm (PRD)

## 1. Vấn đề

Sinh viên thường dùng nhiều công cụ rời rạc: lịch học trên giấy hoặc ảnh chụp, deadline trong nhóm chat, việc nhóm trên Trello, việc cá nhân trong ghi chú điện thoại. Hệ quả là quên deadline, không biết hôm nay cần làm gì trước, và không thấy dự án đang chậm đến đâu.

TaskFlow gom các nguồn đó về **một danh sách việc duy nhất**, rồi cho xem danh sách này theo nhiều cách: theo ngày, theo môn, theo dự án, theo bảng Kanban hoặc Scrum.

## 2. Mục tiêu

| Mã | Mục tiêu | Cách đo |
|---|---|---|
| G1 | Người dùng biết ngay hôm nay phải làm gì | Trang **Hôm nay** tải dưới 1 giây và hiển thị đủ buổi học, việc đến hạn, việc trễ hạn |
| G2 | Không bỏ lỡ deadline | Mọi việc trễ hạn đều hiện nổi bật ở trang Hôm nay và trang môn học |
| G3 | Thấy được tiến độ dự án | Mỗi dự án có phần trăm hoàn thành; dự án Scrum có burndown và velocity |
| G4 | Ghi việc mới nhanh | Tạo một việc chỉ cần gõ tiêu đề và nhấn Enter |

## 3. Người dùng mục tiêu

**P1. Sinh viên đại học.** Học 5–8 môn mỗi kỳ, có lịch học cố định theo tuần, nhiều bài tập và vài đồ án nhóm. Dùng cả máy tính lẫn điện thoại. Cần: lịch học, deadline theo môn, theo dõi điểm thành phần.

**P2. Người làm việc độc lập (freelancer).** Làm 2–4 dự án song song. Cần: bảng Kanban hoặc Scrum cho từng dự án, ước lượng thời gian, theo dõi tiến độ.

Mỗi tài khoản là **một người dùng**. Không có chia sẻ hay cộng tác giữa các tài khoản trong phạm vi hiện tại.

## 4. Phạm vi

### Trong phạm vi

1. Tài khoản: đăng ký, đăng nhập (email + mật khẩu, Google), đăng xuất.
2. Việc (`Task`): tạo, sửa, xóa mềm, khôi phục, việc con, nhãn, độ ưu tiên, hạn chót, ước lượng.
3. Dự án: tạo, sửa, lưu trữ; chọn quy trình Kanban hoặc Scrum.
4. Bảng: cột tùy chỉnh, kéo thả, giới hạn WIP.
5. Kiểu xem: Kanban, Danh sách, Lịch, Scrum (backlog + sprint).
6. Môn học: thông tin môn, lịch học theo tuần, bài tập, điểm thành phần, điểm dự kiến.
7. Lịch trình: trang Hôm nay, xem ngày/tuần/tháng, xếp việc vào khung giờ.
8. Việc lặp lại theo ngày hoặc theo thứ trong tuần.
9. Tiến độ: phần trăm, việc trễ hạn, burndown, velocity.
10. Nhắc hạn trong ứng dụng; xuất lịch ra file `.ics`.
11. Giao diện tiếng Việt (mặc định) và tiếng Anh; sáng/tối; dùng tốt trên điện thoại.

### Ngoài phạm vi

- Cộng tác nhiều người, chia sẻ dự án, giao việc cho người khác.
- Ứng dụng di động bản địa (chỉ có web responsive, có thể cài như PWA).
- AI tự động xếp lịch.
- Thanh toán, gói trả phí.
- Đồng bộ hai chiều với Google Calendar (chỉ xuất `.ics` một chiều).
- Nhập dữ liệu tự động từ cổng đào tạo của trường.

## 5. User story

Định dạng: *Là [vai trò], tôi muốn [hành động] để [lợi ích].* Mỗi story có tiêu chí chấp nhận (AC). Mã giai đoạn ở cột cuối tham chiếu file 10.

### 5.1 Tài khoản

| Mã | Story | Tiêu chí chấp nhận | Giai đoạn |
|---|---|---|---|
| US-01 | Là người dùng mới, tôi muốn đăng ký bằng email để có dữ liệu riêng | Email hợp lệ, mật khẩu ≥ 8 ký tự; đăng ký xong vào thẳng trang Hôm nay; email trùng báo lỗi rõ ràng | P0 |
| US-02 | Là người dùng, tôi muốn đăng nhập bằng Google để khỏi nhớ mật khẩu | Nút "Tiếp tục với Google"; lần đầu tự tạo tài khoản. Tính năng tùy chọn: chỉ bật khi cấu hình đủ `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`; thiếu thì ẩn nút, đăng nhập email vẫn chạy bình thường (file 03 mục 5) | P0 |
| US-03 | Là người dùng, tôi muốn chỉ thấy dữ liệu của mình | Mọi truy vấn lọc theo `userId`; truy cập id của người khác trả 404 | P0 |

### 5.2 Việc và dự án

| Mã | Story | Tiêu chí chấp nhận | Giai đoạn |
|---|---|---|---|
| US-10 | Là người dùng, tôi muốn tạo việc chỉ bằng tiêu đề | Ô nhập nhanh; Enter tạo việc; ô giữ tiêu điểm để nhập việc tiếp theo | MVP-1 |
| US-11 | Là người dùng, tôi muốn thêm chi tiết cho việc (mô tả, hạn, ưu tiên, nhãn, ước lượng) | Hộp thoại chi tiết; lưu tự động hoặc nút Lưu; kiểm tra dữ liệu bằng Zod | MVP-1 |
| US-12 | Là người dùng, tôi muốn chia việc lớn thành việc con | Thêm việc con trong hộp thoại; tối đa 2 cấp; tiến độ cha tự tính | MVP-1 |
| US-13 | Là người dùng, tôi muốn xóa nhầm vẫn khôi phục được | Xóa = xóa mềm; có mục "Thùng rác" khôi phục trong 30 ngày | MVP-1 |
| US-14 | Là freelancer, tôi muốn tạo dự án và chọn Kanban hoặc Scrum | Chọn quy trình khi tạo; tạo sẵn 3 cột mặc định | MVP-1 |
| US-15 | Là người dùng, tôi muốn kéo thả việc giữa các cột | Kéo bằng chuột, cảm ứng và bàn phím; giao diện cập nhật ngay; lỗi server thì hoàn tác | MVP-1 |
| US-16 | Là người dùng, tôi muốn đổi tên, thêm, sắp xếp cột | Mỗi cột chọn nhóm trạng thái (Chưa làm / Đang làm / Xong) | MVP-1 |
| US-17 | Là người dùng, tôi muốn đặt giới hạn WIP cho cột | Vượt giới hạn: cột đổi màu cảnh báo; nếu bật "chặn cứng" thì không cho thả | MVP-1 |
| US-18 | Là người dùng, tôi muốn thấy phần trăm hoàn thành dự án | Thanh tiến độ trên thẻ dự án và trang dự án | MVP-1 |
| US-19 | Là người dùng, tôi muốn xem việc dạng danh sách để lọc và sửa hàng loạt | Lọc theo trạng thái, ưu tiên, nhãn, hạn; chọn nhiều để đổi trạng thái/ưu tiên/xóa | MVP-1 |
| US-20 | Là người dùng, tôi muốn xem việc của dự án trên lịch | Lịch tháng theo hạn chót; kéo sang ngày khác để đổi hạn | MVP-2 |

### 5.3 Môn học và lịch trình

| Mã | Story | Tiêu chí chấp nhận | Giai đoạn |
|---|---|---|---|
| US-30 | Là sinh viên, tôi muốn nhập môn học với màu riêng | Tên, mã, giảng viên, học kỳ, số tín chỉ, màu, ngày bắt đầu/kết thúc kỳ | MVP-2 |
| US-31 | Là sinh viên, tôi muốn nhập lịch học theo tuần | Mỗi buổi: thứ, giờ bắt đầu, giờ kết thúc, phòng; hiển thị trên lịch trong khoảng thời gian của kỳ | MVP-2 |
| US-32 | Là sinh viên, tôi muốn thêm bài tập vào môn | Bài tập là `Task` gắn môn; hiện trong trang môn, trang Hôm nay, lịch | MVP-2 |
| US-33 | Là sinh viên, tôi muốn nhập điểm thành phần và biết điểm dự kiến | Nhập trọng số và điểm; hiện điểm hiện tại và điểm cần đạt ở phần còn lại để đạt mục tiêu | MVP-2 |
| US-34 | Là người dùng, tôi muốn trang Hôm nay gom mọi thứ của ngày | Buổi học, việc đến hạn hôm nay, việc trễ hạn, khung giờ đã xếp | MVP-2 |
| US-35 | Là người dùng, tôi muốn xem lịch ngày/tuần/tháng | Chuyển chế độ xem; màu theo môn | MVP-2 |
| US-36 | Là người dùng, tôi muốn kéo việc vào khung giờ để lên lịch làm | Kéo việc từ danh sách bên cạnh vào lưới giờ; tạo `TimeBlock`; kéo giãn để đổi thời lượng | MVP-2 |

### 5.4 Scrum

| Mã | Story | Tiêu chí chấp nhận | Giai đoạn |
|---|---|---|---|
| US-40 | Là freelancer, tôi muốn có backlog để gom việc chưa xếp | Danh sách việc không thuộc sprint nào, sắp xếp kéo thả theo ưu tiên | MVP-3 |
| US-41 | Là freelancer, tôi muốn lập sprint và chọn việc vào sprint | Sprint có tên, mục tiêu, ngày bắt đầu/kết thúc; tổng điểm hiện khi chọn; so với velocity dự kiến | MVP-3 |
| US-42 | Là freelancer, tôi muốn bắt đầu và kết thúc sprint | Chỉ một sprint đang chạy; khi kết thúc chọn chuyển việc dở về backlog hoặc sprint kế | MVP-3 |
| US-43 | Là freelancer, tôi muốn xem burndown của sprint | Biểu đồ đường lý tưởng và thực tế; cảnh báo khi chậm | MVP-3 |
| US-44 | Là freelancer, tôi muốn biết velocity để lập kế hoạch | Biểu đồ cột velocity các sprint đã xong; trung bình 3 sprint gần nhất | MVP-3 |

### 5.5 Mở rộng

| Mã | Story | Tiêu chí chấp nhận | Giai đoạn |
|---|---|---|---|
| US-50 | Là người dùng, tôi muốn đặt việc lặp lại | Hằng ngày, hằng tuần theo thứ, cách N ngày/tuần; kết thúc theo ngày hoặc số lần | P4 |
| US-51 | Là người dùng, tôi muốn được nhắc trước hạn | Chọn nhắc trước 1 giờ / 1 ngày / tùy chỉnh; hiện trong chuông thông báo; thông báo trình duyệt nếu được cho phép | P4 |
| US-52 | Là người dùng, tôi muốn đưa lịch sang Google Calendar | Xuất `.ics`; có đường dẫn đăng ký (subscribe) bí mật | P4 |
| US-53 | Là người dùng, tôi muốn xuất việc ra CSV | Xuất theo bộ lọc hiện tại | P4 |
| US-54 | Là người dùng, tôi muốn cài ứng dụng lên màn hình điện thoại | PWA có manifest và biểu tượng; mở được khi mất mạng ở chế độ chỉ đọc | P5 |

## 6. Giả định và câu hỏi mở

Giả định (đã chốt, đổi thì cập nhật file này):

- Thang điểm môn học là thang 10; điểm thành phần nhập theo thang bất kỳ rồi quy về thang 10.
- Tuần bắt đầu từ **thứ Hai**.
- Múi giờ mặc định `Asia/Ho_Chi_Minh`; người dùng đổi được trong Cài đặt.

Câu hỏi mở (chưa chặn công việc):

- Có cần quy đổi điểm 10 sang thang 4 và điểm chữ không? Mỗi trường quy đổi khác nhau, nên tạm thời chưa làm.
- Có cần "tuần học" (tuần 1, tuần 2 của kỳ) thay vì ngày tháng không?
