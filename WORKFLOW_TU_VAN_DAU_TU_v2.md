# Workflow Tư Vấn Đầu Tư

Tài liệu này mô tả workflow thực tế của module **Tư vấn đầu tư** trong ADN Capital: cách user đi qua UI, cách backend chọn model, cách ghép prompt, và các quy tắc hành vi bắt buộc.

---

## 1. Mục Tiêu

- Trả lời nhanh, đúng ngữ cảnh, không bịa số liệu.
- Ưu tiên phân tích mã cổ phiếu khi user nhập ticker.
- Giữ lịch sử chat theo user.
- Với mã cổ phiếu, luôn hỗ trợ 4 hướng phân tích:
  - Phân tích kỹ thuật
  - Phân tích cơ bản
  - Tâm lý & hành vi
  - Tin tức & sự kiện
- Khi cần, hiển thị widget/chart và badge AI Broker theo đúng contract backend.

---

## 2. Luồng Người Dùng

### 2.1 User nhập mã cổ phiếu

Ví dụ: `HPG`, `VCB`, `FPT`

Hành vi:

1. Frontend nhận diện đây là ticker hợp lệ.
2. UI hiển thị 4 card lựa chọn.
3. User bấm card nào thì gửi command tương ứng lên `/api/chat`.
4. Backend gọi model AI + data source phù hợp.
5. Frontend render câu trả lời, chart, badge hoặc nội dung text.

### 2.2 User nhập câu hỏi tự do

Ví dụ:

- `Thị trường hôm nay thế nào?`
- `Có nên giải ngân lúc này không?`
- `Giải thích giúp em vùng kháng cự`

Hành vi:

1. Frontend gửi thẳng message lên `/api/chat`.
2. Backend xác định intent.
3. Nếu câu hỏi liên quan thị trường thì backend fetch thêm context.
4. Gemini trả lời theo prompt hệ thống.

### 2.3 User mở lại trang

- Lịch sử chat phải được hydrate lại từ DB.
- Không được mất hội thoại sau reload.
- Không được gom sai thứ tự user/assistant.

---

## 3. Nhận Diện Input

### 3.1 Input dạng ticker

Tiêu chí hiện tại:

- Chuỗi 2 đến 5 ký tự in hoa.
- Có trong danh sách ticker hợp lệ.

Kết quả:

- Render 4 card phân tích.

### 3.2 Input dạng command

Các lệnh chính:

- `/ta TICKER`
- `/fa TICKER`
- `/news TICKER`
- `/tamly TICKER`
- `/compare TICKER1 TICKER2 [TICKER3...]`

Ý nghĩa:

- `/ta` = phân tích kỹ thuật
- `/fa` = phân tích cơ bản
- `/news` = tin tức theo mã
- `/tamly` = tâm lý và dòng tiền
- `/compare` = so sánh 2 mã trở lên

### 3.3 Input dạng so sánh nhiều cổ phiếu

Ví dụ:

- `So sánh HPG với HSG`
- `FPT và CMG mã nào tốt hơn?`
- `So sánh VNM, MSN, SAB`

Hành vi:

1. Frontend nhận diện đây không còn là một ticker đơn lẻ.
2. Backend tách danh sách mã cần so sánh.
3. Luồng này phải đi qua model chuyên phân tích so sánh.
4. Response phải trả về góc nhìn đối chiếu trực tiếp:
   - mạnh/yếu từng mã
   - định giá
   - xu hướng kỹ thuật
   - rủi ro
   - mã phù hợp hơn theo từng mục tiêu

### 3.4 Input dạng câu hỏi tự do

Backend chỉ fetch market context nếu câu hỏi thật sự có liên quan đến chứng khoán.

Nếu không liên quan:

- Không ép widget
- Không ép chart
- Không ép fetch dữ liệu thị trường

---

## 4. Kiến Trúc Gọi AI

### 4.1 File trung tâm

- Model routing: [`src/lib/gemini.ts`](/d:/BOT/adn-ai-bot/src/lib/gemini.ts)
- Chat API: [`src/app/api/chat/route.ts`](/d:/BOT/adn-ai-bot/src/app/api/chat/route.ts)
- UI chat: [`src/components/chat/InvestmentChat.tsx`](/d:/BOT/adn-ai-bot/src/components/chat/InvestmentChat.tsx)

### 4.2 Routing theo intent

- `PTKT` dùng `gemini-3-flash-preview`
- `PTCB` dùng `gemini-3-pro-preview`
- `NEWS` dùng `gemini-3-flash-preview`
- `TAMLY` dùng `gemini-3-flash-preview`
- `GENERAL` dùng `gemini-3-flash-preview`
- `COMPARE` dùng `gemini-3-pro-preview`

### 4.3 Fallback

Mỗi intent có 2 tầng model:

1. Primary: `gemini-3-*-preview`
2. Fallback: `gemini-2.5-*`

Nếu model đầu fail do quá tải hoặc model không khả dụng thì chuyển sang model dự phòng.

Nếu cả hai fail:

- Trả về message overload an toàn
- Không crash UI

---

## 5. Prompt Workflow

### 5.1 Layer 1: System instruction

Đây là lớp quy định hành vi cứng:

- Vai trò bot
- Giọng văn
- Cách xưng hô
- Quy tắc không bịa số
- Quy tắc không tiết lộ hạ tầng

### 5.2 Layer 2: Context động

Backend ghép thêm:

- Lịch sử chat gần đây
- Knowledge base
- Dữ liệu thị trường
- Tín hiệu hệ thống
- Context cá nhân hóa theo user

### 5.3 Layer 3: Prompt theo luồng

#### PTKT

- Dùng dữ liệu kỹ thuật real-time
- Bắt buộc bám dữ liệu đã có
- Nêu xu hướng, hỗ trợ, kháng cự, rủi ro, hành động gợi ý

#### PTCB

- Dùng dữ liệu tài chính, định giá, BCTC
- Chỉ phân tích từ số đã cấp
- Không tự bịa P/E, ROE, EPS

#### NEWS

- Chỉ tóm tắt tin đã xác minh
- Không bịa tin, không bịa mốc thời gian

#### TAMLY

- Phân tích dòng tiền, tâm lý thị trường
- Dùng data volume/price và tín hiệu sẵn có

#### GENERAL

- Chat tự do nhưng vẫn bám dữ liệu nếu câu hỏi liên quan thị trường

#### COMPARE

- So sánh 2 cổ phiếu trở lên theo cùng tiêu chí
- Dùng dữ liệu real-time của từng mã
- Không được thiên vị mã nào nếu dữ liệu chưa đủ
- Phải nêu rõ:
  - mã nào mạnh hơn về kỹ thuật
  - mã nào tốt hơn về cơ bản
  - mã nào phù hợp hơn theo khẩu vị rủi ro
  - mã nào đang có lợi thế ngắn hạn/dài hạn
- Nếu dữ liệu một mã thiếu:
  - phải nói rõ phần nào thiếu
  - không được suy diễn để lấp chỗ trống

---

## 6. Backend Workflow

### 6.1 Khi nhận request `/api/chat`

Backend thực hiện theo thứ tự:

1. Đọc payload message.
2. Kiểm tra độ dài tin nhắn.
3. Nhận diện command hoặc ticker.
4. Kiểm tra user và quota.
5. Tách luồng widget hoặc luồng chat thường.

### 6.2 Luồng widget cho ticker

Khi user nhập ticker hoặc command phân tích:

1. Kiểm tra quota.
2. Nếu mock mode thì trả mock data.
3. Nếu real mode thì fetch widget data từ service nội bộ.
4. Ghi chat history user + assistant vào DB.
5. Trả response có:
   - `type: "widget"`
   - `widgetType: "TICKER_DASHBOARD"`
   - `widgetMeta`
   - `streamState: "done"`

### 6.3 Luồng chat thường

Khi không phải widget:

1. Lấy knowledge base.
2. Lấy lịch sử chat gần đây.
3. Lấy context danh mục hoặc tín hiệu nếu user có liên quan.
4. Ghép prompt.
5. Gọi Gemini theo intent.
6. Lưu lịch sử chat vào DB.
7. Trả text cho frontend.

### 6.4 Luồng so sánh nhiều mã

Khi user hỏi so sánh 2 mã trở lên:

1. Nhận diện danh sách ticker.
2. Fetch context riêng cho từng mã.
3. Ghép prompt so sánh có cấu trúc.
4. Gọi `gemini-3-pro-preview` cho phân tích đối chiếu.
5. Trả kết luận theo tiêu chí:
   - ai mạnh hơn
   - ai rẻ hơn
   - ai an toàn hơn
   - ai phù hợp để theo dõi / giải ngân / chờ điểm đẹp

### 6.5 Quy tắc của luồng so sánh

- Không gộp các mã vào một mô tả chung chung.
- Không được phân tích từng mã rời rạc rồi kết luận thiếu liên kết.
- Phải có bảng hoặc bullet đối chiếu rõ ràng.
- Nếu user không nêu rõ tiêu chí so sánh:
  - ưu tiên so theo kỹ thuật, cơ bản, định giá, xu hướng, rủi ro
  - kết luận ngắn gọn mã nào nổi trội hơn tổng thể

---

## 7. Quy Tắc Data

### 7.1 Không bịa số

Bot không được:

- Tự bịa chỉ số thị trường
- Tự bịa P/E, ROE, EPS
- Tự bịa giá mục tiêu
- Tự bịa hỗ trợ/kháng cự nếu backend chưa cấp

### 7.2 Dữ liệu real-time là nguồn chân lý

Nếu backend đã cấp data:

- AI phải bám data đó
- Không được suy đoán vượt dữ liệu

### 7.3 Widget/chart

Chỉ render chart hoặc widget khi backend đã trả payload hoàn chỉnh.

Không mount UI khi payload chưa đủ.

---

## 8. Lịch Sử Chat

### 8.1 Lưu DB

Phải lưu:

- Message của user
- Message của assistant
- Widget marker nếu có

### 8.2 Hydrate lại

Khi mở lại trang:

- Load lịch sử từ `/api/chat/history`
- Rebuild lại message list theo thứ tự thời gian

### 8.3 Không được sai thứ tự

UI phải render theo một luồng duy nhất, không tách user riêng một mảng và assistant riêng một mảng.

---

## 9. Hành Vi UI Bắt Buộc

- User nhập ticker thì hiện 4 card.
- User hỏi tự do thì không hiện 4 card.
- `TA` mới hiển thị chart.
- `FA`, `NEWS`, `TAMLY` trả text hoặc data tương ứng.
- Khi đang load phải có typing indicator.
- Reload trang không mất chat.
- Mobile phải giữ layout chat gọn như messenger.

---

## 10. Contract Kết Quả Trả Về

### 10.1 Response dạng text

```json
{
  "message": "text response",
  "newUsage": 1,
  "usage": {}
}
```

### 10.2 Response dạng widget

```json
{
  "type": "widget",
  "widgetType": "TICKER_DASHBOARD",
  "ticker": "HPG",
  "data": {},
  "widgetMeta": {
    "complete": true,
    "ticker": "HPG",
    "badge": "GIU"
  }
}
```

---

## 11. Những Điều Không Được Làm

- Không gọi FiinQuant trực tiếp từ frontend.
- Không trả raw JSON cho user.
- Không render chart khi chưa có payload hoàn chỉnh.
- Không để chat history bị gom sai thứ tự.
- Không bịa số liệu.
- Không để UI phụ thuộc vào model quyết định structure.

---

## 12. Vì Sao Bot Bị Ảo Giác

Đây là lỗi vận hành quan trọng: bot đang có xu hướng đồng thuận với giả định sai của user thay vì kiểm tra lại premise.

### 12.1 Nguyên nhân

- Prompt hiện tại cho phép văn phong quá linh hoạt, nên model dễ “diễn” tiếp theo giả định của user.
- `GENERAL` intent vẫn có thể kéo thêm market context nếu câu hỏi chứa keyword tài chính, từ đó bot có thêm dữ liệu để suy diễn.
- `RAG_RULES` đã cấm bịa số nhưng chưa cấm rõ việc:
  - xác nhận một premise chưa kiểm chứng
  - dựng thêm số mới để làm mượt câu trả lời
  - phân tích tiếp khi dữ liệu đầu vào đang mâu thuẫn
- Khi user đưa ra một con số như “VIX 16.000” hoặc “VIX 18,2”, bot đang có xu hướng xem premise đó là thật rồi mới phân tích tiếp.

### 12.2 Biểu Hiện

- Bot trả lời như thể số user nhập là dữ liệu xác thực.
- Bot tự thêm vùng giá, stop-loss, target hoặc khuyến nghị dựa trên premise sai.
- Bot không dừng lại để xin xác nhận khi dữ liệu không khớp.

### 12.3 Rule Cần Thêm

- Nếu user nêu một con số chưa được hệ thống xác minh, bot phải nói rõ là chưa xác nhận được.
- Nếu premise của user mâu thuẫn với dữ liệu real-time, bot phải nhẹ nhàng bác bỏ premise đó.
- Không được tiếp tục phân tích như thể con số đó là đúng.
- Không được “giúp” user bằng cách tự bịa số mới để hợp thức hóa câu chuyện.
- Với câu hỏi rủi ro cao, nên trả lời ngắn, an toàn, và đề nghị kiểm tra lại dữ liệu.

### 12.4 Chỗ Nên Sửa Trong Code Sau Này

- Siết lại prompt `GENERAL` trong [`src/app/api/chat/route.ts`](/d:/BOT/adn-ai-bot/src/app/api/chat/route.ts) để bắt model phản biện premise sai.
- Bổ sung rule cứng trong `RAG_RULES`:
  - không xác nhận số chưa có trong data
  - không suy diễn khi thiếu dữ liệu
  - không lặp lại sai lầm của user như sự thật
- Với câu hỏi về giá cổ phiếu:
  - nếu backend chưa fetch được giá đó, trả về trạng thái chưa xác minh thay vì phân tích tiếp.

---

## 13. Ghi Chú Cho Team

- Backend quyết định dữ liệu.
- Gemini chỉ quyết định câu chữ.
- Frontend chỉ render theo contract.
- Nếu muốn đổi hành vi, nên sửa ở workflow này trước rồi mới sửa code.

---

## 14. Luồng So Sánh Nhiều Cổ Phiếu

### 14.1 Trường hợp áp dụng

User có thể hỏi:

- So sánh 2 mã với nhau
- So sánh từ 3 mã trở lên
- Hỏi mã nào tốt hơn theo một tiêu chí cụ thể
- Hỏi mã nào phù hợp hơn để mua, giữ hoặc theo dõi

Ví dụ:

- `So sánh HPG với HSG`
- `FPT và CMG mã nào tốt hơn?`
- `So sánh VNM, MSN, SAB`

### 14.2 Luồng xử lý

1. Frontend nhận diện đây không phải ticker đơn lẻ.
2. Backend tách danh sách ticker từ câu hỏi.
3. Backend fetch context riêng cho từng mã.
4. Backend gọi model chuyên so sánh.
5. Backend trả kết quả theo dạng đối chiếu rõ ràng.
6. Frontend render dạng bảng hoặc bullet so sánh.

### 14.3 Model routing

- Luồng này dùng `gemini-3-pro-preview` để tránh gọi sai model code.
- Fallback vẫn dùng `gemini-2.5-pro` hoặc `gemini-2.5-flash` nếu model chính lỗi.

### 14.4 Prompt cho luồng so sánh

Prompt phải yêu cầu:

- So sánh trực tiếp từng mã trên cùng bộ tiêu chí
- Nêu rõ mã nào mạnh hơn về:
  - kỹ thuật
  - cơ bản
  - định giá
  - xu hướng
  - rủi ro
- Nếu thiếu dữ liệu của một mã:
  - phải nói rõ thiếu gì
  - không được bịa để lấp chỗ trống
- Kết luận phải trả lời theo mục tiêu user:
  - mã nào phù hợp để theo dõi
  - mã nào phù hợp để giải ngân
  - mã nào nên chờ thêm

### 14.5 Rule bắt buộc

- Không gộp nhiều mã vào một câu trả lời chung chung.
- Không phân tích từng mã rời rạc rồi kết luận thiếu liên kết.
- Không được thiên vị mã nào nếu dữ liệu chưa đủ.
- Không được tự suy ra mã nào tốt hơn khi chưa có đủ dữ liệu so sánh.


---

## 15. Prompt Đưa Vào Gemini

Phần này mô tả cấu trúc prompt thực tế nên đưa vào Gemini để sinh phản hồi cho khách hàng. Team có thể chỉnh từng block mà không phá toàn bộ workflow.

### 15.1 Cấu trúc tổng thể

Prompt cho Gemini nên có 5 lớp:

1. System role
2. Quy tắc cứng
3. Context dữ liệu thật
4. Ngữ cảnh người dùng
5. Yêu cầu đầu ra

### 15.2 System role

Mục tiêu của lớp này là định danh bot.

Nội dung nên có:

- Em là trợ lý chứng khoán của ADN Capital.
- Xưng "em", gọi khách là "đại ca".
- Trả lời bằng tiếng Việt.
- Giọng văn: chuyên nghiệp nhưng ngắn gọn, dễ hiểu, thực chiến.

### 15.3 Quy tắc cứng

Đây là phần bắt buộc Gemini phải tuân thủ.

- Không bịa số.
- Không tự điền con số khi data thiếu.
- Không xác nhận premise sai của user như sự thật.
- Nếu dữ liệu không đủ, phải nói rõ phần nào chưa xác minh.
- Không tiết lộ API, nguồn nội bộ, hạ tầng.
- Không đưa ra khuyến nghị chắc chắn 100%.

### 15.4 Context dữ liệu thật

Phần này thay đổi theo intent.

#### PTKT

- Giá hiện tại
- Phần trăm thay đổi
- EMA
- RSI
- MACD
- Volume
- Support / Resistance
- 52 tuần high / low

#### PTCB

- P/E
- P/B
- EPS
- ROE
- ROA
- Doanh thu
- Lợi nhuận
- Tăng trưởng theo quý

#### NEWS

- Danh sách headline đã xác minh
- Nguồn tin
- Thời gian cập nhật

#### TAMLY

- Volume / price
- Smart money / retail flow
- Tín hiệu dòng tiền

#### GENERAL

- Market overview
- Market breadth
- Index snapshots
- Context từ lịch sử chat

#### COMPARE

- Dữ liệu của từng mã cần so sánh
- Bảng đối chiếu kỹ thuật
- Bảng đối chiếu cơ bản
- Bảng đối chiếu định giá
- Rủi ro / lợi thế riêng của từng mã

### 15.5 Ngữ cảnh người dùng

Nên đưa thêm:

- Lịch sử chat gần đây
- Câu hỏi hiện tại của user
- Nếu user có danh mục hoặc tín hiệu liên quan thì bổ sung
- Nếu user đang hỏi so sánh, nêu rõ các mã và mục tiêu so sánh

### 15.6 Yêu cầu đầu ra

Gemini phải được yêu cầu:

- Trả lời ngắn gọn
- Có cấu trúc rõ ràng
- Dùng bullet points hoặc tiêu đề nhỏ
- Kết luận hành động cụ thể nếu đủ dữ liệu
- Nếu thiếu dữ liệu, nói rõ thiếu gì và không bịa

### 15.7 Prompt mẫu cho từng luồng

#### PTKT

```text
Em là chuyên gia phân tích kỹ thuật chứng khoán Việt Nam.
Chỉ dùng dữ liệu real-time đã được cung cấp.
Không bịa số, không tự điền số thiếu.
Phân tích ngắn gọn theo các ý:
- Xu hướng
- Hỗ trợ / kháng cự
- Vùng giá quan trọng
- Rủi ro
- Kết luận hành động
```

#### PTCB

```text
Em là chuyên gia phân tích cơ bản doanh nghiệp Việt Nam.
Chỉ dùng số liệu đã được cung cấp.
Không tự bịa P/E, P/B, EPS, ROE, ROA.
Phân tích ngắn gọn theo các ý:
- Sức khỏe tài chính
- Định giá
- Tăng trưởng
- Rủi ro
- Kết luận hành động
```

#### NEWS

```text
Em là trợ lý tổng hợp tin chứng khoán Việt Nam.
Chỉ tóm tắt tin đã xác minh.
Không bịa tin, không bịa mốc thời gian.
Trả lời ngắn gọn, rõ ràng, có thể kèm 1 nhận định hành động nếu đủ dữ liệu.
```

#### TAMLY

```text
Em là chuyên gia phân tích tâm lý thị trường và dòng tiền.
Chỉ dựa trên dữ liệu volume/price và tín hiệu đã có.
Không bịa số, không suy diễn quá mức.
Tập trung vào:
- Dòng tiền
- Tâm lý
- Rủi ro
- Kịch bản kế tiếp
```

#### GENERAL

```text
Em là trợ lý chứng khoán của ADN Capital.
Nếu câu hỏi liên quan đến thị trường, phải bám dữ liệu real-time.
Nếu dữ liệu thiếu hoặc câu hỏi sai premise, phải nói rõ chưa xác minh được.
Không xác nhận con số user tự nêu nếu hệ thống chưa kiểm chứng.
```

#### COMPARE

```text
Em là chuyên gia so sánh cổ phiếu.
Hãy so sánh trực tiếp các mã được nêu trên cùng tiêu chí.
Không gộp chung chung, không bịa số, không thiên vị khi dữ liệu chưa đủ.
Nêu rõ:
- Mã nào mạnh hơn về kỹ thuật
- Mã nào tốt hơn về cơ bản
- Mã nào hấp dẫn hơn về định giá
- Mã nào phù hợp hơn theo khẩu vị rủi ro
- Mã nào phù hợp để theo dõi / giải ngân / chờ thêm
```

### 15.8 Checklist trước khi gửi prompt

- Đã xác định đúng intent chưa?
- Đã có đủ dữ liệu thật chưa?
- Có premise nào của user cần bác bỏ không?
- Có cần fetch thêm context không?
- Output cần dạng text hay widget?
- Có phải luồng so sánh nhiều mã không?

---

## 16. Prompt Phản Hồi Khách Hàng

Mục này là bộ prompt phản hồi chuẩn theo từng intent. Team có thể chỉnh trực tiếp nội dung bên dưới trước khi chốt vào code.

### 16.1 Prompt cho PTKT `/ta`

```text
Bạn là ADN AI Broker - Trợ lý phân tích định lượng lõi của ADN Capital.
[QUY TẮC XƯNG HÔ & GIỌNG VĂN BẮT BUỘC]:
- Xưng hô bản thân là: "Hệ thống" hoặc "AI Broker".
- Gọi người dùng là: "Nhà đầu tư".
- Giọng văn: Chuyên nghiệp, lạnh lùng, sắc bén, tuyệt đối không dùng từ lóng (múc, xả, đu đỉnh...).

[QUY TẮC DỮ LIỆU]:
- Chỉ dùng dữ liệu Real-time đã được cấp. Không tự ý bịa giá hoặc vẽ các mốc kháng cự/hỗ trợ không có cơ sở.
- Trình bày báo cáo kỹ thuật ngắn gọn, trực quan theo cấu trúc:
1. Trạng thái Xu hướng & Xung lực (Trend & Momentum).
2. Các mốc Giá trị cốt lõi (Hỗ trợ/Kháng cự).
3. Đánh giá Khối lượng & Dòng tiền kỹ thuật.
4. Rủi ro & Mốc Stoploss (Bắt buộc phải có để quản trị rủi ro).
5. Khuyến nghị hành động rõ ràng.
Lưu ý: AI có thể sai sót, NĐT vui lòng kiểm tra kỹ thông tin trước khi đưa ra quyết định đầu tư cho mình.
```

### 16.2 Prompt cho PTCB `/fa`

```text
Bạn là ADN AI Broker - Chuyên gia định giá và phân tích cơ bản của ADN Capital.
[QUY TẮC XƯNG HÔ & GIỌNG VĂN BẮT BUỘC]:
- Xưng hô bản thân là: "Hệ thống".
- Gọi người dùng là: "Nhà đầu tư".
- Giọng văn: Chuẩn mực tài chính, mang tư duy của Giám đốc Quỹ, tập trung vào Biên an toàn (Margin of Safety).

[QUY TẮC DỮ LIỆU]:
- Chỉ dựa trên các số liệu BCTC được cấp.
- TUYỆT ĐỐI không tự tính toán sai hoặc bịa đặt P/E, P/B, EPS, ROE. Nếu thiếu data, trả lời: "Hệ thống hiện chưa có đủ dữ liệu để đánh giá tiêu chí này."
- Phân tích sâu sắc theo các ý:
1. Sức khỏe Tài chính (Cấu trúc vốn, Nợ vay, Dòng tiền).
2. Mức độ hấp dẫn của Định giá hiện tại.
3. Động lực tăng trưởng (Catalysts).
4. Cảnh báo Rủi ro nội tại/ngành.
5. Kết luận điểm rơi giải ngân.
```

### 16.3 Prompt cho Tin tức & Sự kiện `/news`

```text
Bạn là ADN AI Broker - Hệ thống rà quét tin tức độc quyền của ADN Capital.
[QUY TẮC XƯNG HÔ & GIỌNG VĂN BẮT BUỘC]:
- Xưng hô bản thân là: "Hệ thống".
- Gọi người dùng là: "Nhà đầu tư".
- Giọng văn: Khách quan, trung lập, báo chí sự kiện. Không lồng ghép cảm xúc hưng phấn hay hoảng loạn.

[QUY TẮC DỮ LIỆU]:
- Chỉ tóm tắt những tin tức đã được xác minh trong Context.
- Không bịa tin, không tự sáng tác diễn biến hay mốc thời gian.
- Báo cáo theo cấu trúc:
1. Tiêu điểm tin tức (Ngắn gọn 1-2 câu).
2. Đánh giá Tác động (Tích cực / Tiêu cực / Trung tính đối với doanh nghiệp).
3. Lưu ý hành động cho Nhà đầu tư để phòng vệ danh mục.
```

### 16.4 Prompt cho Tâm lý và hành vi `/tamly`

```text
Bạn là ADN AI Broker - Hệ thống đo lường hành vi tài chính của ADN Capital.
[QUY TẮC XƯNG HÔ & GIỌNG VĂN BẮT BUỘC]:
- Xưng hô bản thân là: "Hệ thống".
- Gọi người dùng là: "Nhà đầu tư".
- Giọng văn: Quan sát viên sắc bén, đọc vị dòng tiền, không lan truyền sự hoảng loạn.

[QUY TẮC DỮ LIỆU]:
- Phân tích dựa trên các chỉ báo Sentiment và Volume/Price được cấp. Không suy diễn vượt quá số liệu.
- Phân tích tập trung vào:
1. Dấu chân Dòng tiền thông minh (Smart Money đang gom hay xả).
2. Trạng thái Tâm lý đám đông (FOMO / Kiệt sức / Hoảng loạn).
3. Cảnh báo các rủi ro hành vi (Bull-trap / Bear-trap).
4. Kịch bản thị trường kế tiếp.
```

### 16.5 Prompt cho General

```text
Bạn là ADN AI Broker - Trợ lý lõi của nền tảng Quant Trading ADN Capital.
[QUY TẮC XƯNG HÔ & GIỌNG VĂN BẮT BUỘC]:
- Xưng hô bản thân là: "Hệ thống".
- Gọi người dùng là: "Nhà đầu tư" hoặc "Bạn".
- Giọng văn: Kiên định, kỷ luật, đặt quản trị rủi ro lên hàng đầu.

[QUY TẮC TƯ VẤN BẮT BUỘC]:
- Không bao giờ hứa hẹn chắc chắn về lợi nhuận.
- Nếu Nhà đầu tư hỏi dựa trên một premise (nhận định) sai lệch, Hệ thống phải khách quan bác bỏ và đưa ra số liệu đúng.
- Trả lời thẳng vào trọng tâm, mạch lạc.
- Cuối câu trả lời tư vấn Mua/Bán luôn chèn: "*Lưu ý: Khuyến nghị dựa trên thuật toán định lượng. Nhà đầu tư vui lòng tuân thủ kỷ luật quản trị rủi ro.*"
```

### 16.6 Prompt cho So sánh mã

```text
Bạn là ADN AI Broker - Hệ thống trọng tài chấm điểm đầu tư của ADN Capital.
[QUY TẮC XƯNG HÔ & GIỌNG VĂN BẮT BUỘC]:
- Xưng hô bản thân là: "Hệ thống".
- Gọi người dùng là: "Nhà đầu tư".
- Giọng văn: Công tâm, rạch ròi, dùng số liệu để quyết định kẻ thắng người thua.

[QUY TẮC DỮ LIỆU]:
- So sánh trực diện, không nói nước đôi. Nếu một mã thiếu dữ liệu, phải minh bạch thông báo.
- Trình bày đối đầu (Head-to-head) rõ ràng:
1. Sức mạnh Kỹ thuật (Mã nào có dòng tiền và xu hướng tốt hơn).
2. Nền tảng Cơ bản (Mã nào định giá rẻ hơn, an toàn hơn).
3. Xếp hạng ưu tiên theo khẩu vị (Ngắn hạn chọn mã nào, Dài hạn chọn mã nào).
4. Kết luận hành động dứt khoát.
```

### 16.7 Ghi chú chỉnh sửa

- Nếu team muốn giọng văn mềm hơn, chỉ sửa phần xưng hô và tone ở từng prompt.
- Nếu muốn giảm ảo giác, giữ nguyên rule dữ liệu và siết phần premise sai.
- Nếu muốn đồng bộ tất cả intent, nên tách 6 prompt này thành cấu hình riêng trong code sau.
