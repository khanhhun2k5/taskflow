# 07. Công thức tiến độ, burndown, velocity và điểm môn học

Mọi công thức trong file này được cài đặt thành **hàm thuần** trong `src/features/progress/domain/` (và `src/features/courses/domain/grades.ts` cho điểm). Mỗi công thức có ví dụ số; ví dụ đó phải xuất hiện nguyên văn trong test (file 09).

## 1. Tập việc được tính

Trước khi tính, cần xác định **việc nào được đếm**. Vấn đề nằm ở việc con: nếu đếm cả việc cha lẫn việc con thì một khối công việc bị đếm hai lần.

**Quy ước:** chỉ đếm các **đơn vị công việc lá** (leaf) — việc không có việc con, cùng với chính các việc con. Việc cha có việc con bị thay thế bằng các việc con của nó.

Ví dụ: dự án có việc A (không có việc con), việc B có 3 việc con B1, B2, B3. Tập được đếm là $\{A, B1, B2, B3\}$, tức 4 đơn vị, không phải 2 hay 5.

Ngoài ra loại bỏ: việc đã xóa mềm (BR-09), và mốc dự án (`isMilestone`), vì mốc là một thời điểm chứ không phải khối lượng công việc.

Gọi tập này là $L$, số phần tử là $N = |L|$. Một việc $i$ "xong" khi `statusCategory = DONE`. Gọi $D \subseteq L$ là tập việc xong, $N_{\text{done}} = |D|$.

## 2. Tiến độ theo số việc

$$
P = \begin{cases}
\dfrac{N_{\text{done}}}{N} \times 100\% & \text{nếu } N > 0 \\[2mm]
0 & \text{nếu } N = 0
\end{cases}
$$

Ý nghĩa: tỷ lệ số việc đã xong. Công thức coi mọi việc nặng như nhau.

**Ví dụ.** $L = \{A, B1, B2, B3\}$, đã xong A và B1. Khi đó $N_{\text{done}} = 2$, $N = 4$, nên $P = 2/4 = 50\%$.

## 3. Tiến độ có trọng số

Khi việc có **ước lượng** $e_i$ (story point hoặc giờ), việc lớn nên đóng góp nhiều hơn việc nhỏ:

$$
P_w = \frac{\sum_{i \in D} e_i}{\sum_{i \in L} e_i} \times 100\%
$$

Tử số là tổng ước lượng của việc đã xong; mẫu số là tổng ước lượng của mọi việc được đếm.

**Quy tắc với dữ liệu thiếu:**

- Việc không có ước lượng được tính $e_i = 1$.
- Mẫu số bằng 0 (ví dụ mọi việc đều ước lượng 0) thì $P_w = 0$.
- Chỉ **hiển thị** $P_w$ khi ít nhất một nửa số việc trong $L$ có ước lượng. Nếu không, hiển thị $P$ kèm gợi ý "Thêm ước lượng để xem tiến độ chính xác hơn". Lý do: khi phần lớn việc chưa ước lượng, giá trị mặc định 1 chi phối kết quả và $P_w$ không còn ý nghĩa.

**Ví dụ 1 (ước lượng đủ).** Ba việc ước lượng 2, 3, 5 điểm. Chỉ việc 5 điểm đã xong.

- $P = 1/3 \approx 33\%$.
- $P_w = 5/(2+3+5) = 5/10 = 50\%$.

Kết quả khác nhau vì việc đã xong là việc lớn nhất. $P_w$ phản ánh khối lượng còn lại tốt hơn.

**Ví dụ 2 (thiếu ước lượng).** Bốn việc: 3 điểm (xong), 5 điểm, không ước lượng (xong), không ước lượng.

- Hai trong bốn việc có ước lượng, đủ điều kiện hiển thị $P_w$.
- $P_w = (3 + 1)/(3 + 5 + 1 + 1) = 4/10 = 40\%$.

**Hiển thị:** làm tròn đến số nguyên gần nhất, nửa làm tròn lên (33,5% → 34%). Tính toán bên trong giữ nguyên số thực; chỉ làm tròn khi hiển thị.

## 4. Tiến độ của việc cha và môn học

**Việc cha** có việc con: áp dụng mục 2 và 3 với $L$ là tập việc con của nó. Hiển thị "2/5" (số việc) trên thẻ. Việc cha không tự chuyển sang xong (BR-08).

**Môn học:** áp dụng mục 2 với $L$ là các việc gắn môn đó (cả việc của dự án gắn môn), có hạn nằm trong khoảng `termStart`–`termEnd` hoặc không có hạn. Môn học dùng $P$ (theo số việc) vì bài tập ít khi có ước lượng.

## 5. Velocity

**Velocity** của một sprint là tổng điểm các việc đã xong trong sprint đó, chốt tại thời điểm kết thúc sprint:

$$
v_j = \sum_{i \,\in\, \text{sprint } j,\ i \in D} e_i
$$

Ở đây $e_i$ lấy theo quy tắc BR-42 (việc cha dùng tổng điểm việc con). Việc chưa xong bị chuyển đi khi kết thúc sprint (BR-45), nên không có trong tổng.

**Velocity dự kiến** cho sprint kế tiếp là trung bình của $k$ sprint đã hoàn thành gần nhất:

$$
\bar{v} = \frac{1}{k} \sum_{j=1}^{k} v_j, \qquad k = \min(3,\ \text{số sprint đã hoàn thành})
$$

Nếu chưa có sprint nào hoàn thành ($k = 0$), $\bar v$ không xác định; giao diện hiện "Chưa đủ dữ liệu" và không cảnh báo khi lập kế hoạch.

**Ví dụ.** Bốn sprint đã xong với velocity 18, 21, 15, 24 (theo thứ tự thời gian). Ba sprint gần nhất là 21, 15, 24, nên

$$
\bar v = \frac{21 + 15 + 24}{3} = \frac{60}{3} = 20.
$$

Nếu chỉ có hai sprint đã xong (18, 21): $k = 2$, $\bar v = 39/2 = 19{,}5$.

## 6. Burndown

**Burndown** là biểu đồ cho biết mỗi ngày trong sprint còn lại bao nhiêu điểm chưa làm, so với một đường "lý tưởng" giảm đều.

### 6.1 Ký hiệu

- Sprint kéo dài $T$ ngày, tính cả ngày đầu và ngày cuối. Sprint từ thứ Hai 02/11 đến thứ Sáu 06/11 có $T = 5$.
- $t = 0$ là thời điểm bắt đầu sprint; $t = 1, \dots, T$ là **cuối** mỗi ngày (23:59:59 theo múi giờ người dùng).
- $S$ là **điểm cam kết** chốt lúc bắt đầu (BR-43).

### 6.2 Đường lý tưởng

$$
R_{\text{ideal}}(t) = S\left(1 - \frac{t}{T}\right), \qquad t = 0, 1, \dots, T
$$

Đường này giảm đều $S/T$ điểm mỗi ngày, từ $S$ về 0. Nó dựa trên $S$ đã chốt nên **không đổi** khi phạm vi thay đổi giữa sprint.

### 6.3 Đường thực tế

$R(t)$ là tổng điểm của các việc **đang thuộc sprint** và **chưa xong** vào cuối ngày $t$. Đường phạm vi $\text{Scope}(t)$ là tổng điểm của mọi việc đang thuộc sprint vào cuối ngày $t$ (xong hay chưa).

Cả hai được dựng lại bằng cách duyệt nhật ký (ADR-10): bắt đầu từ trạng thái lúc $t = 0$, áp dụng lần lượt các sự kiện theo thời gian:

| Sự kiện | Ảnh hưởng đến $R$ | Ảnh hưởng đến Scope |
|---|---|---|
| `STATUS_CHANGED` sang `DONE` | $-e_i$ | không đổi |
| `STATUS_CHANGED` rời `DONE` | $+e_i$ | không đổi |
| `ADDED_TO_SPRINT` | $+e_i$ nếu việc chưa xong | $+e_i$ |
| `REMOVED_FROM_SPRINT` | $-e_i$ nếu việc chưa xong | $-e_i$ |
| `ESTIMATE_CHANGED` từ $a$ sang $b$ | $+(b - a)$ nếu việc chưa xong | $+(b - a)$ |
| `DELETED` | như `REMOVED_FROM_SPRINT` | như `REMOVED_FROM_SPRINT` |

Ngày trong tương lai (sau hôm nay) không có $R(t)$; biểu đồ chỉ vẽ tới hôm nay.

### 6.4 Diễn giải

- $R(t) > R_{\text{ideal}}(t)$: **chậm** so với kế hoạch → hiện cảnh báo.
- $R(t) \le R_{\text{ideal}}(t)$: đúng hoặc nhanh hơn kế hoạch.
- Scope tăng: có việc được thêm giữa sprint; đường thực tế có thể đi lên dù vẫn đang làm.

### 6.5 Ví dụ

$T = 5$, $S = 20$. Đường lý tưởng: $20,\ 16,\ 12,\ 8,\ 4,\ 0$ (giảm $20/5 = 4$ điểm/ngày).

| $t$ | Sự kiện trong ngày | $R(t)$ | Scope | $R_{\text{ideal}}(t)$ | Đánh giá |
|---|---|---|---|---|---|
| 0 | Bắt đầu | 20 | 20 | 20 | — |
| 1 | Xong việc 3 điểm | 17 | 20 | 16 | Chậm |
| 2 | Xong việc 5 điểm; thêm việc 4 điểm | 16 | 24 | 12 | Chậm |
| 3 | Xong việc 8 điểm | 8 | 24 | 8 | Đúng kế hoạch |
| 4 | Không có gì | 8 | 24 | 4 | Chậm |
| 5 | Xong việc 4 điểm | 4 | 24 | 0 | Còn dư 4 điểm |

Kiểm tra ngày 2: $R(1) = 17$; xong 5 điểm → 12; thêm việc 4 điểm chưa xong → 16. Scope: $20 + 4 = 24$.

Kết thúc sprint ở đây: velocity $v = 3 + 5 + 8 + 4 = 20$ điểm; việc còn 4 điểm chuyển về backlog hoặc sprint kế.

## 7. Điểm môn học

### 7.1 Ký hiệu

Môn có các thành phần điểm $i = 1, \dots, n$. Mỗi thành phần có:

- trọng số $w_i$, viết dưới dạng tỷ lệ (10% → $w_i = 0{,}1$);
- điểm đạt $s_i$ và điểm tối đa $m_i$.

Điểm quy về thang 10:

$$
g_i = 10 \cdot \frac{s_i}{m_i}
$$

Gọi $G$ là tập thành phần **đã có điểm**, $R$ là tập **chưa có điểm** (BR-56). Giả thiết $\sum_{i=1}^{n} w_i = 1$ (tổng 100%); nếu không thỏa, hệ thống vẫn tính nhưng cảnh báo (BR-55).

### 7.2 Ba con số hiển thị

**(a) Điểm đã tích lũy** — phần điểm tổng kết đã chắc chắn có:

$$
A = \sum_{i \in G} w_i \, g_i
$$

**(b) Điểm hiện tại** — trung bình có trọng số chỉ trên phần đã có điểm. Đây là "nếu giữ phong độ như hiện tại thì được bao nhiêu":

$$
\bar g = \frac{A}{\sum_{i \in G} w_i} \qquad (\text{không xác định nếu } G = \varnothing)
$$

**(c) Điểm cần đạt** ở phần còn lại để tổng kết đạt mục tiêu $T^*$ (`targetScore`). Điểm tổng kết bằng $A + \sum_{i \in R} w_i g_i$. Nếu phần còn lại đạt trung bình $x$ thì tổng kết là $A + x \sum_{i\in R} w_i$. Đặt bằng $T^*$ rồi giải theo $x$:

$$
A + x \sum_{i \in R} w_i = T^* \quad\Longrightarrow\quad x = \frac{T^* - A}{\sum_{i \in R} w_i}
$$

Diễn giải $x$:

| Điều kiện | Ý nghĩa | Hiển thị |
|---|---|---|
| $x \le 0$ | Đã chắc chắn đạt mục tiêu | "Bạn đã đạt mục tiêu" |
| $0 < x \le 10$ | Có thể đạt | "Cần trung bình $x$ ở phần còn lại" |
| $x > 10$ | Không thể đạt dù được 10 | "Không thể đạt $T^*$; tối đa có thể đạt $A + 10\sum_{i\in R} w_i$" |
| $R = \varnothing$ | Đã đủ điểm | Hiện điểm tổng kết $A$ |

### 7.3 Ví dụ

Mục tiêu $T^* = 8$.

| Thành phần | $w_i$ | $s_i / m_i$ | $g_i$ |
|---|---|---|---|
| Chuyên cần | 0,1 | 9 / 10 | 9 |
| Giữa kỳ | 0,3 | 14 / 20 | 7 |
| Cuối kỳ | 0,6 | — | — |

- Điểm tích lũy: $A = 0{,}1 \cdot 9 + 0{,}3 \cdot 7 = 0{,}9 + 2{,}1 = 3{,}0$.
- Điểm hiện tại: $\bar g = 3{,}0 / 0{,}4 = 7{,}5$.
- Điểm cần đạt: $x = (8 - 3{,}0)/0{,}6 = 5/0{,}6 \approx 8{,}33$.

Kiểm tra lại: nếu cuối kỳ được $8{,}33$ thì tổng kết $= 3{,}0 + 0{,}6 \cdot 8{,}33 \approx 3{,}0 + 5{,}0 = 8{,}0$. Đúng mục tiêu.

### 7.4 Làm tròn

Tính bằng số thực đầy đủ; hiển thị 2 chữ số thập phân. Không áp dụng quy tắc làm tròn của trường (mỗi trường khác nhau) — đây là câu hỏi mở ở file 01.

## 8. Chữ ký hàm

```ts
// src/features/progress/domain/progress.ts
export type ProgressItem = {
  id: string;
  parentId: string | null;
  statusCategory: "TODO" | "IN_PROGRESS" | "DONE";
  estimate: number | null;
  isMilestone: boolean;
  deleted: boolean;
};
export function leafItems(items: ProgressItem[]): ProgressItem[];
export function countProgress(items: ProgressItem[]): { done: number; total: number; percent: number };
export function weightedProgress(items: ProgressItem[]): { done: number; total: number; percent: number; reliable: boolean };

// src/features/progress/domain/velocity.ts
export function sprintVelocity(tasks: ProgressItem[]): number;
export function expectedVelocity(completedVelocities: number[], k?: number): number | null; // mảng theo thời gian, cũ → mới

// src/features/progress/domain/burndown.ts
export type BurndownEvent = { at: Date; type: ActivityType; taskId: string; from?: unknown; to?: unknown };
export type BurndownDay = { date: string; ideal: number; remaining: number | null; scope: number | null };
export function computeBurndown(input: {
  startState: { taskId: string; estimate: number; done: boolean }[];
  committed: number;
  startDate: string; endDate: string;   // "YYYY-MM-DD", ngày cuối tính cả
  events: BurndownEvent[];
  timezone: string;
  now: Date;
}): BurndownDay[];

// src/features/courses/domain/grades.ts
export type GradeInput = { weight: number; score: number | null; maxScore: number }; // weight theo %
export function computeGrades(components: GradeInput[], target: number | null): {
  accumulated: number;               // A
  current: number | null;            // ḡ
  needed: number | null;             // x
  status: "ACHIEVED" | "POSSIBLE" | "IMPOSSIBLE" | "FINAL" | "NO_TARGET";
  maxPossible: number;
  weightSum: number;                 // để cảnh báo BR-55
};
```
