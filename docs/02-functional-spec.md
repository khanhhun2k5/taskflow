# 02. Đặc tả chức năng và quy tắc nghiệp vụ

File này mô tả hệ thống **làm gì** và **theo quy tắc nào**. Cách lưu dữ liệu nằm ở file 04; cách gọi API nằm ở file 05.

## 1. Khái niệm trung tâm: `Task`

Mọi thứ cần làm đều là một `Task`: bài tập, việc trong ngày, hạng mục dự án, mốc dự án. Các khái niệm khác chỉ là cách **nhóm** hoặc **hiển thị** `Task`.

Một `Task` có thể:

- không thuộc gì cả (việc lẻ, nằm ở **Hộp thư** – Inbox);
- thuộc một **dự án** (`projectId`);
- gắn với một **môn học** (`courseId`);
- vừa thuộc dự án vừa gắn môn (ví dụ đồ án môn học quản lý bằng một dự án).

### 1.1 Trạng thái

Mỗi việc có một **nhóm trạng thái** (`statusCategory`) gồm ba giá trị: `TODO` (chưa làm), `IN_PROGRESS` (đang làm), `DONE` (xong). Mọi phép tính tiến độ chỉ dựa trên nhóm trạng thái này.

Trên bảng, người dùng đặt tên cột tùy ý ("Chờ review", "Đang test"...). Mỗi cột gắn với một nhóm trạng thái.

| Mã | Quy tắc |
|---|---|
| BR-01 | Khi một việc được đặt vào một cột, `Task.statusCategory` được gán bằng `Column.statusCategory` của cột đó, trong cùng một giao dịch DB. |
| BR-02 | Việc không nằm trên bảng nào (việc lẻ) đổi trạng thái trực tiếp bằng ô đánh dấu. Áp dụng cho mọi việc có `columnId = null` (việc lẻ, việc con). Việc đang nằm trên bảng chỉ đổi trạng thái bằng cách chuyển cột; đổi trực tiếp → `422 TASK_ON_BOARD` (ADR-03). |
| BR-03 | Khi `statusCategory` chuyển sang `DONE`, gán `completedAt = now()`. Khi rời khỏi `DONE`, gán `completedAt = null`. |
| BR-04 | Việc có `dueAt` đã qua và `statusCategory ≠ DONE` là **trễ hạn**. Với hạn cả ngày (`dueAllDay = true`), việc chỉ trễ hạn khi `now` ≥ 00:00 của **ngày lịch kế tiếp** theo múi giờ người dùng (cộng một ngày lịch trong múi giờ đó, không cộng 24 giờ; xem NFR-32). |

### 1.2 Việc con

| Mã | Quy tắc |
|---|---|
| BR-05 | Tối đa **2 cấp**: việc cha → việc con. Việc con không có việc con. |
| BR-06 | Việc con luôn cùng `projectId` và `courseId` với việc cha. Đổi dự án của việc cha thì việc con đổi theo. |
| BR-07 | Việc con **không** xuất hiện thành thẻ riêng trên bảng Kanban; chúng hiện dưới dạng danh sách đánh dấu trong thẻ cha ("2/5 việc con"). Việc con có trạng thái riêng (theo BR-02). |
| BR-08 | Việc cha có việc con thì tiến độ của nó tính từ việc con (xem file 07). Việc cha **không** tự động chuyển sang `DONE` khi việc con xong hết; hệ thống chỉ gợi ý. |

### 1.3 Xóa

| Mã | Quy tắc |
|---|---|
| BR-09 | Xóa việc, dự án, môn học là **xóa mềm** (`deletedAt`). Bản ghi xóa mềm bị loại khỏi mọi truy vấn và mọi phép tính. |
| BR-10 | Xóa việc cha thì xóa mềm luôn việc con. Khôi phục việc cha thì khôi phục việc con bị xóa cùng lúc. **Cách xác định "cùng lúc"** (chốt MVP-1b): khi xóa, cha và các con chưa xóa nhận **cùng một** giá trị `deletedAt` trong một giao dịch; khôi phục cha chỉ khôi phục các con có `deletedAt` bằng đúng giá trị đó. Việc con bị xóa riêng trước đó giữ nguyên trong thùng rác. Khôi phục việc con khi việc cha (hoặc dự án) vẫn đang bị xóa → `422 PARENT_DELETED`. |
| BR-11 | Xóa dự án thì xóa mềm toàn bộ việc, cột, sprint của dự án (cột ẩn theo dự án, không có `deletedAt` riêng; việc dùng chung một `deletedAt` với dự án như BR-10, khôi phục dự án chỉ khôi phục các việc đó). Xóa môn học **không** xóa việc; việc chỉ bỏ liên kết môn (`courseId = null`) — tránh mất dữ liệu ngoài ý muốn. |
| BR-12 | Thùng rác giữ 30 ngày. Sau đó xóa vĩnh viễn bằng tác vụ dọn dẹp (giai đoạn P4; trước đó giữ mãi). |

### 1.4 Thứ tự

| Mã | Quy tắc |
|---|---|
| BR-13 | Thứ tự việc trong cột, trong backlog, và thứ tự cột dùng **khóa sắp xếp dạng chuỗi** (fractional index, ADR-05). Chèn giữa hai việc chỉ cập nhật đúng một bản ghi. |

## 2. Dự án và bảng

### 2.1 Dự án

Thuộc tính: tên, mô tả, màu, ngày bắt đầu, ngày kết thúc (tùy chọn), quy trình (`KANBAN` hoặc `SCRUM`), đơn vị ước lượng (`POINTS` hoặc `HOURS`), trạng thái (`ACTIVE`, `ARCHIVED`).

| Mã | Quy tắc |
|---|---|
| BR-20 | Tạo dự án thì tạo kèm một bảng với 3 cột mặc định: "Cần làm" (`TODO`), "Đang làm" (`IN_PROGRESS`), "Xong" (`DONE`). Tên cột lấy theo `User.locale` từ `messages/*.json` (`Board.defaultColumns`; en: "To do", "In progress", "Done"). |
| BR-21 | Quy trình đổi được sau khi tạo. Đổi từ `SCRUM` sang `KANBAN` thì ẩn backlog/sprint nhưng giữ dữ liệu; đổi lại thì hiện lại. |
| BR-22 | Dự án `ARCHIVED` chỉ đọc; không hiện ở trang Hôm nay. Mọi thao tác ghi vào dự án (việc, cột, bảng, sửa dự án) → `422 PROJECT_ARCHIVED`; riêng `PATCH /projects/:id` có `status: "ACTIVE"` vẫn được để bỏ lưu trữ. Xóa và khôi phục dự án vẫn được. |

### 2.2 Bảng của môn học

| Mã | Quy tắc |
|---|---|
| BR-23 | Mỗi môn học cũng có một bảng riêng (3 cột mặc định), để xem bài tập dạng Kanban. Môn học không có Scrum. |
| BR-24 | Việc có cả `projectId` và `courseId` nằm trên bảng của **dự án**. Bảng môn học chỉ chứa việc có `courseId` và **không** có `projectId`; việc của dự án gắn môn chỉ hiện ở danh sách/lịch của môn. |

### 2.3 Cột

| Mã | Quy tắc |
|---|---|
| BR-25 | Một bảng phải luôn có ít nhất một cột `TODO` và một cột `DONE`. Hệ thống chặn xóa hoặc đổi nhóm trạng thái nếu vi phạm. |
| BR-26 | Xóa cột còn việc: người dùng phải chọn cột đích để chuyển việc sang. Việc chuyển nhận trạng thái theo BR-01. |
| BR-27 | Việc mới tạo trên bảng mà không chỉ định cột thì vào cột `TODO` đầu tiên (theo thứ tự). |

### 2.4 Giới hạn WIP

WIP (Work In Progress) là số việc tối đa được phép nằm trong một cột cùng lúc. Mục đích: tránh làm dở quá nhiều việc.

| Mã | Quy tắc |
|---|---|
| BR-28 | `wipLimit` để trống nghĩa là không giới hạn. Số việc tính cho WIP là số **việc cha** chưa xóa trong cột. |
| BR-29 | Mặc định chế độ **cảnh báo**: vẫn cho thả, cột hiện viền đỏ và nhãn "4/3". |
| BR-30 | Nếu cột bật `wipStrict`, API từ chối thao tác làm số việc vượt giới hạn (lỗi `WIP_LIMIT_EXCEEDED`). Kéo trong nội bộ cùng cột luôn được phép. |

## 3. Kiểu xem

Cùng một tập việc, người dùng chuyển kiểu xem bằng tab. Kiểu xem được nhớ theo từng dự án (lưu ở trình duyệt).

| Kiểu | Áp dụng cho | Thao tác chính | Quy tắc riêng |
|---|---|---|---|
| Kanban | Dự án, môn học | Kéo thả giữa cột, sắp xếp trong cột | BR-28…30 |
| Danh sách | Dự án, môn học, Hộp thư, toàn bộ | Lọc, sắp xếp, sửa hàng loạt | BR-31 |
| Lịch | Dự án, môn học, toàn bộ | Kéo để đổi hạn | BR-32 |
| Scrum | Chỉ dự án `SCRUM` | Backlog, lập sprint, bảng sprint | Mục 4 |

| Mã | Quy tắc |
|---|---|
| BR-31 | Sửa hàng loạt hỗ trợ: đổi trạng thái (chọn cột), ưu tiên, nhãn, hạn, xóa. Tối đa 200 việc mỗi lần. |
| BR-32 | Kiểu Lịch xếp việc theo `dueAt`. Việc có `startAt` và `dueAt` khác ngày hiện thành dải kéo dài. Việc không có hạn không hiện trên lịch. Kéo sang ngày khác giữ nguyên giờ, chỉ đổi ngày. |

## 4. Scrum

**Sprint** là một khoảng thời gian cố định (thường 1–2 tuần) mà người làm cam kết hoàn thành một nhóm việc. **Backlog** là danh sách việc chưa xếp vào sprint nào. **Story point** là đơn vị ước lượng độ lớn tương đối của việc.

**Định nghĩa "việc ở backlog".** Một việc ở backlog khi thỏa **tất cả**:

- dự án của nó có `workflow = SCRUM`;
- `sprintId = null`;
- `parentId = null` (việc con đi theo việc cha, BR-42);
- `statusCategory ≠ DONE`;
- `deletedAt = null`.

Việc trong backlog **vẫn có `columnId`** (thường là cột `TODO` theo BR-27) và vẫn tuân theo BR-01. Backlog chỉ là một cách lọc, không phải một vị trí lưu riêng; thứ tự trong backlog dùng `backlogOrder`.

### 4.1 Vòng đời sprint

```
PLANNED ──bắt đầu──▶ ACTIVE ──kết thúc──▶ COMPLETED
```

| Mã | Quy tắc |
|---|---|
| BR-40 | Mỗi dự án có **tối đa một** sprint `ACTIVE`. Bắt đầu sprint khi đã có sprint đang chạy thì lỗi `SPRINT_ALREADY_ACTIVE`. |
| BR-41 | Việc chỉ được đưa vào sprint khi có `estimate` (≥ 0). Thiếu ước lượng thì lỗi `ESTIMATE_REQUIRED`. Ước lượng 0 hợp lệ (việc rất nhỏ). |
| BR-42 | Việc con đi theo việc cha: không đưa riêng việc con vào sprint. Điểm của việc cha có việc con = tổng điểm việc con nếu có; nếu không thì dùng điểm việc cha. |
| BR-43 | Bắt đầu sprint: chốt **phạm vi cam kết** $S$ = tổng điểm các việc trong sprint tại thời điểm đó; lưu vào `Sprint.committedPoints`. |
| BR-44 | Thêm/bớt việc khi sprint đang chạy được phép, nhưng ghi vào nhật ký (`ActivityLog`) để burndown hiện thay đổi phạm vi. |
| BR-45 | Kết thúc sprint: việc `DONE` giữ `sprintId` (để tính velocity). Việc chưa `DONE` chuyển về backlog (`sprintId = null`) hoặc sang sprint `PLANNED` được chọn, theo lựa chọn của người dùng. |
| BR-46 | Sprint `COMPLETED` không mở lại được. Lưu ảnh chụp burndown cuối cùng (`Sprint.burndownSnapshot`) và `velocity`. |
| BR-47 | Dự án Scrum không có bảng riêng cho sprint; tab Kanban dùng chung các cột của dự án với bộ chọn phạm vi: **"Sprint hiện tại"** (mặc định) chỉ hiện việc thuộc sprint `ACTIVE`; **"Tất cả"** hiện mọi việc chưa xóa của dự án, kể cả việc ở backlog (việc con vẫn hiện trong thẻ cha theo BR-07). Không có sprint `ACTIVE` thì "Sprint hiện tại" hiện trạng thái trống kèm liên kết tới trang Backlog. |

### 4.2 Lập kế hoạch sprint

Màn hình lập kế hoạch hiện hai cột: backlog (trái) và sprint đang lập (phải). Thanh trên cùng hiện tổng điểm đã chọn so với velocity dự kiến $\bar v$ (file 07). Vượt quá $\bar v$ thì hiện cảnh báo vàng, không chặn.

## 5. Môn học

### 5.1 Thông tin môn

Tên, mã môn, giảng viên, email giảng viên, học kỳ (chuỗi tự do, ví dụ "HK1 2026–2027"), số tín chỉ, màu, ngày bắt đầu kỳ, ngày kết thúc kỳ, ghi chú, điểm mục tiêu.

### 5.2 Lịch học

| Mã | Quy tắc |
|---|---|
| BR-50 | Một buổi học (`ClassSession`) lặp mỗi tuần vào một thứ, từ ngày bắt đầu đến ngày kết thúc kỳ của môn. |
| BR-51 | Buổi học chỉ được **sinh ra khi hiển thị** (không lưu từng buổi). Hàm thuần `expandClassSessions(sessions, from, to, tz)` trả về danh sách buổi cụ thể. |
| BR-52 | Nghỉ học một buổi: lưu ngoại lệ `ClassSessionException` (ngày + hủy, hoặc đổi giờ/phòng). |
| BR-53 | Giờ học lưu dạng giờ địa phương (`"07:00"`) kèm múi giờ của người dùng; đổi sang UTC khi sinh buổi cụ thể. Giờ học không trôi theo giờ mùa hè. |

### 5.3 Điểm

| Mã | Quy tắc |
|---|---|
| BR-54 | Mỗi điểm thành phần có tên, trọng số (%), điểm đạt (có thể trống), điểm tối đa (mặc định 10). |
| BR-55 | Tổng trọng số khác 100% thì hiện cảnh báo, vẫn cho lưu. Công thức điểm dự kiến ở file 07. |
| BR-56 | Thành phần chưa có điểm được coi là "còn lại"; dùng để tính điểm cần đạt. |

## 6. Lịch trình hằng ngày

### 6.1 Trang Hôm nay

Thứ tự các khối:

1. **Trễ hạn**: việc trễ hạn (BR-04), sắp theo hạn tăng dần.
2. **Lịch hôm nay**: buổi học và khung giờ (`TimeBlock`) theo thời gian.
3. **Đến hạn hôm nay**: việc có hạn trong ngày, chưa xong.
4. **Sắp đến hạn**: việc có hạn trong 7 ngày tới.
5. **Ô tạo việc nhanh**: việc tạo ở đây vào Hộp thư, hạn mặc định là hôm nay (bỏ được).

Việc của dự án `ARCHIVED` và việc đã xóa không hiện (BR-22, BR-09).

### 6.2 Khung giờ

**Khung giờ** (`TimeBlock`) là một đoạn thời gian người dùng dành để làm việc, ví dụ "14:00–16:00 làm báo cáo".

| Mã | Quy tắc |
|---|---|
| BR-60 | Khung giờ có thể gắn một `Task` hoặc chỉ có tiêu đề (ví dụ "Đi gym"). |
| BR-61 | Kéo việc vào lưới giờ tạo khung giờ dài bằng ước lượng giờ của việc nếu đơn vị là giờ; nếu không thì mặc định 60 phút. Bước lưới 15 phút. |
| BR-62 | Khung giờ chồng lên buổi học hoặc khung giờ khác thì vẫn cho phép, nhưng hiển thị cạnh nhau và có dấu cảnh báo. |
| BR-63 | Một việc có thể có nhiều khung giờ (làm nhiều buổi). Hoàn thành việc không xóa khung giờ. |

### 6.3 Việc lặp lại (giai đoạn P4)

| Mã | Quy tắc |
|---|---|
| BR-70 | Việc lặp được định nghĩa bằng một **chuỗi lặp** (`RecurringSeries`) gồm mẫu (tiêu đề, mô tả, dự án, môn, nhãn, ước lượng) và **quy tắc lặp**. |
| BR-71 | Quy tắc lặp là tập con của RRULE: `FREQ=DAILY|WEEKLY`, `INTERVAL`, `BYDAY` (chỉ với WEEKLY), và một trong `UNTIL` hoặc `COUNT`. Quy tắc khác bị từ chối. |
| BR-72 | Không tạo trước hàng loạt. Mỗi lần xuất hiện được tạo thành `Task` thật khi: (a) người dùng mở một khung nhìn chứa ngày đó và ngày đó ≤ hôm nay + 7 ngày; hoặc (b) lần trước được hoàn thành. |
| BR-73 | Tạo lần xuất hiện phải **idempotent** (gọi nhiều lần cũng chỉ tạo một bản ghi): ràng buộc duy nhất `(seriesId, occurrenceDate)`. |
| BR-74 | Sửa một lần xuất hiện chỉ ảnh hưởng lần đó. Sửa chuỗi chỉ ảnh hưởng các lần **chưa tạo**. Xóa một lần xuất hiện ghi ngoại lệ để không tạo lại. |

## 7. Nhãn, ưu tiên, tìm kiếm

| Mã | Quy tắc |
|---|---|
| BR-80 | Ưu tiên có 4 mức: `URGENT`, `HIGH`, `MEDIUM`, `LOW`; mặc định `MEDIUM`. |
| BR-81 | Nhãn thuộc người dùng, dùng chung giữa mọi dự án. Tên nhãn duy nhất (không phân biệt hoa thường) trong một tài khoản; trùng → `409 LABEL_EXISTS`. |
| BR-82 | Tìm kiếm theo tiêu đề và mô tả, không phân biệt hoa thường và **không phân biệt dấu** ("bao cao" tìm ra "Báo cáo"). `GET /tasks?q=` (MVP-1) chỉ tìm **tiêu đề** bằng `f_unaccent(lower(title)) LIKE`, khớp chỉ mục `task_title_trgm`; ký tự `%` `_` trong `q` là ký tự thường. Tìm cả mô tả thuộc `/search` (MVP-2). |

## 8. Nhắc hạn (giai đoạn P4)

| Mã | Quy tắc |
|---|---|
| BR-90 | Mỗi việc có tối đa 3 lời nhắc, mỗi lời nhắc là một khoảng trước hạn (ví dụ 60 phút, 1 ngày). |
| BR-91 | Lời nhắc đến giờ tạo thông báo trong ứng dụng; nếu người dùng đã cho phép, gửi thêm thông báo trình duyệt (Web Push). |
| BR-92 | Việc đã `DONE` hoặc bị xóa thì hủy các lời nhắc chưa gửi. Đổi hạn thì tính lại thời điểm nhắc. |

## 9. Nhật ký hoạt động

| Mã | Quy tắc |
|---|---|
| BR-95 | Ghi `ActivityLog` cho: tạo việc, đổi trạng thái, đổi ước lượng, thêm/bớt việc khỏi sprint, đổi hạn, xóa/khôi phục. |
| BR-96 | Nhật ký là dữ liệu chỉ thêm (append-only), không sửa. Dùng để vẽ burndown (file 07) và hiện lịch sử trong hộp thoại việc. |
