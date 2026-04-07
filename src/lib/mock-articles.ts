/**
 * Mock Data — 20 bài báo giả lập tiếng Việt về chứng khoán VN.
 * Dùng để test layout trước khi kết nối DB thật.
 */

export interface MockArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  aiSummary: string;
  authorName: string;
  sourceUrl: string | null;
  imageUrl: string;
  status: string;
  tags: string[];
  sentiment: "Tích cực" | "Tiêu cực" | "Trung tính";
  categorySlug: string;
  categoryName: string;
  publishedAt: string;
  createdAt: string;
}

export const mockCategories = [
  { id: "cat-1", name: "Thị trường", slug: "thi-truong", sortOrder: 1 },
  { id: "cat-2", name: "Vĩ mô", slug: "vi-mo", sortOrder: 2 },
  { id: "cat-3", name: "Doanh nghiệp", slug: "doanh-nghiep", sortOrder: 3 },
  { id: "cat-4", name: "Quốc tế", slug: "quoc-te", sortOrder: 4 },
  { id: "cat-5", name: "Chính sách", slug: "chinh-sach", sortOrder: 5 },
  { id: "cat-6", name: "Ngân hàng", slug: "ngan-hang", sortOrder: 6 },
  { id: "cat-7", name: "Bất động sản", slug: "bat-dong-san", sortOrder: 7 },
  { id: "cat-8", name: "Crypto", slug: "crypto", sortOrder: 8 },
  { id: "cat-9", name: "Chứng khoán", slug: "chung-khoan", sortOrder: 9 },
];

export const mockArticles: MockArticle[] = [
  {
    id: "art-1",
    title: "Nhà đầu tư ồ ạt mở tài khoản, khối ngoại lập kỷ lục trong tháng VN-Index mất hơn 200 điểm",
    slug: "nha-dau-tu-o-at-mo-tai-khoan-khoi-ngoai-lap-ky-luc",
    excerpt: "Tháng 3 ghi nhận số lượng tài khoản chứng khoán tăng đột biến đến từ cả nhà đầu tư trong nước và nước ngoài.",
    content: `<p><strong>Tháng 3 ghi nhận số lượng tài khoản chứng khoán tăng đột biến đến từ cả nhà đầu tư trong nước và nước ngoài.</strong></p>
<p>Theo số liệu từ Trung tâm lưu ký Chứng khoán Việt Nam (VSD), số lượng tài khoản của nhà đầu tư trong nước đã tăng thêm gần 346.000 tài khoản trong tháng 3/2026. Con số này cao hơn 150.000 tài khoản so với tháng liền trước. Đây là số lượng tài khoản tăng thêm nhiều nhất trong gần 4 năm kể từ giai đoạn tháng 5-6/2022.</p>
<p>Tài khoản mở mới chủ yếu đến từ nhà đầu tư cá nhân trong khi tổ chức chỉ tăng thêm 123 tài khoản. Tính từ đầu năm 2026, nhà đầu tư cá nhân trong nước đã mở thêm hơn 750.000 tài khoản mới, nâng tổng số tài khoản lên trên 10,2 triệu.</p>
<p>Đáng chú ý, khối ngoại cũng mở thêm gần 5.800 tài khoản trong tháng 3, mức cao nhất từ trước đến nay. Động thái này diễn ra trong bối cảnh VN-Index giảm hơn 200 điểm, cho thấy nhà đầu tư nước ngoài đang tận dụng cơ hội "mua đáy" khi định giá thị trường trở nên hấp dẫn.</p>
<p>Các chuyên gia nhận định, việc mở tài khoản tăng mạnh phản ánh kỳ vọng lạc quan của nhà đầu tư về triển vọng thị trường trong trung và dài hạn, bất chấp những biến động ngắn hạn.</p>`,
    aiSummary: "Tháng 3/2026: +346K tài khoản CK mới (cao nhất 4 năm), khối ngoại mở kỷ lục 5.800 TK dù VN-Index giảm >200 điểm. Nhà đầu tư tận dụng cơ hội mua đáy.",
    authorName: "ADN Capital",
    sourceUrl: "https://cafef.vn/nha-dau-tu-o-at-mo-tai-khoan",
    imageUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=450&fit=crop",
    status: "PUBLISHED",
    tags: ["Tin tức", "Thị trường"],
    sentiment: "Tích cực",
    categorySlug: "thi-truong",
    categoryName: "Thị trường",
    publishedAt: "2026-04-07T21:44:00Z",
    createdAt: "2026-04-07T21:00:00Z",
  },
  {
    id: "art-2",
    title: "Cổ phiếu giảm, dầu tăng vì căng thẳng Mỹ - Iran",
    slug: "co-phieu-giam-dau-tang-vi-cang-thang-my-iran",
    excerpt: "Thị trường chứng khoán giảm điểm, giá dầu tăng mạnh do lo ngại xung đột Trung Đông leo thang trước thời hạ...",
    content: `<p><strong>Thị trường chứng khoán giảm điểm, giá dầu tăng mạnh do lo ngại xung đột Trung Đông leo thang.</strong></p>
<p>Phiên giao dịch ngày 7/4, thị trường chứng khoán toàn cầu chịu áp lực giảm khi căng thẳng giữa Mỹ và Iran tiếp tục leo thang. S&P 500 giảm 1,2%, Dow Jones mất gần 400 điểm trong khi Nasdaq trượt 1,5%.</p>
<p>Giá dầu Brent tăng vọt lên 89 USD/thùng, mức cao nhất trong 6 tháng. Giá dầu WTI cũng vượt mốc 85 USD/thùng. Các nhà phân tích cảnh báo nếu tình hình tiếp tục xấu đi, giá dầu có thể chạm mốc 100 USD/thùng.</p>
<p>Vàng tiếp tục là kênh trú ẩn an toàn, tăng 0,8% lên 2.380 USD/ounce.</p>`,
    aiSummary: "Căng thẳng Mỹ-Iran đẩy giá dầu Brent lên 89 USD (cao nhất 6 tháng), S&P 500 -1.2%, vàng +0.8%. Rủi ro dầu chạm 100 USD nếu leo thang.",
    authorName: "ADN Capital",
    sourceUrl: "https://bloomberg.com",
    imageUrl: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&h=450&fit=crop",
    status: "PUBLISHED",
    tags: ["Quốc tế", "Dầu mỏ"],
    sentiment: "Tiêu cực",
    categorySlug: "quoc-te",
    categoryName: "Quốc tế",
    publishedAt: "2026-04-07T20:30:00Z",
    createdAt: "2026-04-07T20:00:00Z",
  },
  {
    id: "art-3",
    title: "Goolsbee: Chiến tranh Iran gây khó cho Fed",
    slug: "goolsbee-chien-tranh-iran-gay-kho-cho-fed",
    excerpt: "Thành viên Fed Goolsbee cảnh báo một cuộc chiến tranh Iran có thể gây ra cú sốc 'đình trệ lạm phát' (stagflation)...",
    content: `<p><strong>Thành viên Fed Goolsbee cảnh báo về rủi ro stagflation từ xung đột Iran.</strong></p>
<p>Chủ tịch Fed Chicago Austan Goolsbee phát biểu rằng một cuộc xung đột leo thang với Iran sẽ tạo ra thách thức lớn cho Fed trong việc cân bằng giữa kiểm soát lạm phát và hỗ trợ tăng trưởng kinh tế.</p>
<p>"Nếu giá dầu tăng đột biến do chiến tranh, chúng ta có thể đối mặt với tình trạng stagflation - lạm phát cao kết hợp suy thoái kinh tế. Đây là kịch bản khó khăn nhất cho chính sách tiền tệ," ông Goolsbee nói.</p>
<p>Thị trường hiện đang định giá Fed sẽ giữ nguyên lãi suất trong cuộc họp tháng 5, thay vì kỳ vọng giảm 25 điểm cơ bản như trước đó.</p>`,
    aiSummary: "Fed Goolsbee: Xung đột Iran có thể gây stagflation, Fed khó giảm lãi suất. Thị trường giờ kỳ vọng Fed giữ nguyên lãi suất tháng 5 thay vì cắt giảm.",
    authorName: "ADN Capital",
    sourceUrl: "https://investing.com",
    imageUrl: "https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?w=800&h=450&fit=crop",
    status: "PUBLISHED",
    tags: ["Vĩ mô", "Fed"],
    sentiment: "Tiêu cực",
    categorySlug: "vi-mo",
    categoryName: "Vĩ mô",
    publishedAt: "2026-04-07T19:00:00Z",
    createdAt: "2026-04-07T18:30:00Z",
  },
  {
    id: "art-4",
    title: "Wall Street: Hồi phục nhẹ trước hạn chót Iran",
    slug: "wall-street-hoi-phuc-nhe-truoc-han-chot-iran",
    excerpt: "Thị trường chứng khoán Mỹ hồi phục nhẹ cuối phiên khi nhà đầu tư chờ đợi quyết định về thỏa thuận hạt nhân...",
    content: `<p><strong>Thị trường Mỹ hồi phục nhẹ cuối phiên giao dịch.</strong></p>
<p>Sau cú giảm mạnh đầu phiên, thị trường chứng khoán Mỹ đã hồi phục phần nào trong nửa cuối. S&P 500 thu hẹp đà giảm xuống chỉ còn -0,4%, Dow Jones giảm 150 điểm.</p>
<p>Phiên hồi phục được hỗ trợ bởi tin đồn về khả năng đạt được thỏa thuận ngoại giao giữa hai bên. Tuy nhiên, giới phân tích cảnh báo đây có thể chỉ là "dead cat bounce" và nhà đầu tư cần thận trọng.</p>
<p>Nhóm cổ phiếu công nghệ dẫn dắt đà hồi phục với NVIDIA tăng 2,1%, Apple tăng 0,8% và Microsoft tăng 0,5%.</p>`,
    aiSummary: "Wall Street hồi phục nhẹ cuối phiên: S&P 500 thu hẹp đà giảm còn -0.4%. Tech dẫn dắt (NVIDIA +2.1%). Cảnh báo có thể là dead cat bounce.",
    authorName: "ADN Capital",
    sourceUrl: "https://titanlabs.news",
    imageUrl: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&h=450&fit=crop",
    status: "PUBLISHED",
    tags: ["Quốc tế", "Chứng khoán"],
    sentiment: "Trung tính",
    categorySlug: "quoc-te",
    categoryName: "Quốc tế",
    publishedAt: "2026-04-07T18:00:00Z",
    createdAt: "2026-04-07T17:30:00Z",
  },
  {
    id: "art-5",
    title: "Giá dầu thực tế chạm đỉnh kỷ lục do căng thẳng Iran",
    slug: "gia-dau-thuc-te-cham-dinh-ky-luc-do-cang-thang-iran",
    excerpt: "Giá dầu thế giới tiến gần mốc kỷ lục khi Mỹ gia tăng trừng phạt Iran, phản ánh sự khan hiếm nguồn cung do xuất...",
    content: `<p><strong>Giá dầu thực tế chạm mức kỷ lục do căng thẳng địa chính trị.</strong></p>
<p>Giá dầu Brent đã chạm mốc 91 USD/thùng trong phiên sáng ngày 7/4, mức cao nhất kể từ tháng 10/2025. Khi điều chỉnh theo lạm phát, đây gần như là mức giá thực tế cao nhất lịch sử.</p>
<p>Nguyên nhân chính đến từ lệnh trừng phạt mới của Mỹ nhắm vào xuất khẩu dầu Iran, cắt giảm khoảng 1,5 triệu thùng/ngày ra khỏi thị trường toàn cầu.</p>
<p>OPEC+ cho biết sẽ không tăng sản lượng bù đắp, khiến lo ngại về thiếu hụt nguồn cung càng trầm trọng hơn.</p>`,
    aiSummary: "Dầu Brent chạm 91 USD/thùng (cao nhất từ 10/2025). Mỹ trừng phạt cắt 1.5M thùng/ngày Iran, OPEC+ không bù. Giá thực tế gần đỉnh lịch sử.",
    authorName: "ADN Capital",
    sourceUrl: "https://bloomberg.com",
    imageUrl: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=800&h=450&fit=crop",
    status: "PUBLISHED",
    tags: ["Quốc tế", "Dầu mỏ"],
    sentiment: "Tiêu cực",
    categorySlug: "quoc-te",
    categoryName: "Quốc tế",
    publishedAt: "2026-04-07T16:00:00Z",
    createdAt: "2026-04-07T15:30:00Z",
  },
  {
    id: "art-6",
    title: "Trump đe dọa Iran giữa căng thẳng eo biển Hormuz",
    slug: "trump-de-doa-iran-giua-cang-thang-eo-bien-hormuz",
    excerpt: "Tổng thống Trump cảnh báo Iran về những hậu quả nghiêm trọng trong trường hợp khóa mới lại eo biển Hormuz...",
    content: `<p><strong>Căng thẳng Mỹ-Iran leo thang xung quanh eo biển Hormuz.</strong></p>
<p>Tổng thống Mỹ Donald Trump tuyên bố sẽ "không khoanh tay đứng nhìn" nếu Iran cản trở giao thông hàng hải qua eo biển Hormuz - tuyến vận chuyển chiếm 20% sản lượng dầu toàn cầu.</p>
<p>Iran đáp trả bằng tuyên bố sẽ "phong tỏa hoàn toàn" eo biển nếu bị tấn công quân sự. Hải quân Mỹ đã điều thêm nhóm tàu sân bay USS Abraham Lincoln đến vùng Vịnh Ba Tư.</p>
<p>Các nhà phân tích cho rằng nếu eo biển thực sự bị phong tỏa, giá dầu có thể tăng lên 120-150 USD/thùng, gây sốc đối với kinh tế toàn cầu.</p>`,
    aiSummary: "Trump đe dọa Iran nếu phong tỏa Hormuz (20% dầu toàn cầu). Iran tuyên bố sẽ đóng eo biển nếu bị tấn công. Kịch bản xấu: dầu 120-150 USD.",
    authorName: "ADN Capital",
    sourceUrl: "https://bloomberg.com",
    imageUrl: "https://images.unsplash.com/photo-1529399261278-4dbe4987c4e2?w=800&h=450&fit=crop",
    status: "PUBLISHED",
    tags: ["Quốc tế", "Địa chính trị"],
    sentiment: "Tiêu cực",
    categorySlug: "quoc-te",
    categoryName: "Quốc tế",
    publishedAt: "2026-04-07T15:00:00Z",
    createdAt: "2026-04-07T14:30:00Z",
  },
  {
    id: "art-7",
    title: "Cáp treo Fansipan Sa Pa lãi sau thuế gần 29 tỷ đồng",
    slug: "cap-treo-fansipan-sa-pa-lai-sau-thue-gan-29-ty",
    excerpt: "Công ty Dịch vụ du lịch cáp treo Fansipan Sa Pa báo lãi sau thuế xấp xỉ 29 tỷ đồng năm 2025, tăng trưởng hơn...",
    content: `<p><strong>Dịch vụ cáp treo Fansipan Sa Pa ghi nhận kết quả kinh doanh tích cực năm 2025.</strong></p>
<p>Công ty TNHH Dịch vụ Du lịch Cáp treo Fansipan Sa Pa báo cáo doanh thu thuần đạt 320 tỷ đồng, tăng 18% so với cùng kỳ. Lợi nhuận sau thuế đạt 29 tỷ đồng, tăng gần gấp đôi.</p>
<p>Động lực tăng trưởng đến từ lượng khách du lịch quốc tế đổ về Sa Pa tăng 40% sau khi Việt Nam mở rộng chính sách miễn visa. Đặc biệt, doanh thu từ vé cáp treo đêm (mở thêm từ Q3/2025) đã đóng góp 15% tổng doanh thu.</p>`,
    aiSummary: "Cáp treo Fansipan Sa Pa: DT 320 tỷ (+18%), LNST 29 tỷ (x2). Khách quốc tế +40% nhờ miễn visa. Dịch vụ cáp treo đêm đóng góp 15% doanh thu.",
    authorName: "ADN Capital",
    sourceUrl: "https://vnexpress.net",
    imageUrl: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800&h=450&fit=crop",
    status: "PUBLISHED",
    tags: ["Doanh nghiệp"],
    sentiment: "Tích cực",
    categorySlug: "doanh-nghiep",
    categoryName: "Doanh nghiệp",
    publishedAt: "2026-04-07T14:00:00Z",
    createdAt: "2026-04-07T13:30:00Z",
  },
  {
    id: "art-8",
    title: "Khảo sát niềm tin kinh doanh 6 tháng đầu năm 2026",
    slug: "khao-sat-niem-tin-kinh-doanh-6-thang-dau-nam-2026",
    excerpt: "Ban IV và VnExpress khảo sát tình hình kinh doanh đầu năm 2026 nhằm tổng hợp ý kiến doanh nghiệp, góp phần...",
    content: `<p><strong>Kết quả khảo sát niềm tin kinh doanh nửa đầu năm 2026.</strong></p>
<p>Khảo sát được thực hiện bởi Ban IV (Hội đồng Tư vấn cải cách thủ tục hành chính) phối hợp cùng VnExpress, với sự tham gia của hơn 10.000 doanh nghiệp trên cả nước.</p>
<p>Kết quả cho thấy 62% doanh nghiệp đánh giá tích cực về triển vọng kinh doanh trong năm 2026, tăng từ mức 48% của cùng kỳ năm ngoái. Trong đó, ngành công nghệ thông tin và tài chính - ngân hàng có tỷ lệ lạc quan cao nhất.</p>
<p>Tuy nhiên, 35% doanh nghiệp vẫn lo ngại về chi phí đầu vào tăng cao, đặc biệt là giá nhiên liệu và nguyên vật liệu.</p>`,
    aiSummary: "Khảo sát 10.000 DN: 62% lạc quan về 2026 (vs 48% cùng kỳ). IT và tài chính lạc quan nhất. Lo ngại: chi phí đầu vào tăng (35% DN).",
    authorName: "ADN Capital",
    sourceUrl: "https://vnexpress.net",
    imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop",
    status: "PUBLISHED",
    tags: ["Vĩ mô", "Kinh tế"],
    sentiment: "Trung tính",
    categorySlug: "vi-mo",
    categoryName: "Vĩ mô",
    publishedAt: "2026-04-07T12:00:00Z",
    createdAt: "2026-04-07T11:30:00Z",
  },
  {
    id: "art-9",
    title: "MBS: Lợi nhuận quý I đạt 292 tỷ đồng, tăng 8%",
    slug: "mbs-loi-nhuan-quy-i-dat-292-ty-dong-tang-8",
    excerpt: "CTCP Chứng khoán MB (MBS) là CTCK đầu tiên công bố BCTC quý I/2026 với lợi nhuận sau thuế đạt gần 292 tỷ...",
    content: `<p><strong>MBS công bố kết quả kinh doanh quý I/2026 khả quan.</strong></p>
<p>Công ty Cổ phần Chứng khoán MB (MBS) là công ty chứng khoán đầu tiên công bố báo cáo tài chính quý I/2026. Theo đó, doanh thu hoạt động đạt 1.120 tỷ đồng, tăng 12% so với cùng kỳ.</p>
<p>Lợi nhuận sau thuế đạt 292 tỷ đồng, tăng 8% YoY. Mảng môi giới và cho vay ký quỹ tiếp tục là hai trụ cột chính, đóng góp lần lượt 45% và 30% tổng doanh thu.</p>
<p>Đáng chú ý, mảng tự doanh ghi nhận lỗ 15 tỷ đồng do biến động thị trường mạnh trong tháng 3. Tuy nhiên, mảng IB (ngân hàng đầu tư) tăng trưởng ấn tượng 45% nhờ loạt thương vụ IPO thành công.</p>`,
    aiSummary: "MBS Q1/2026: DT 1.120 tỷ (+12%), LNST 292 tỷ (+8%). Môi giới & margin dẫn dắt. Tự doanh lỗ 15 tỷ do biến động T3, IB tăng 45%.",
    authorName: "ADN Capital",
    sourceUrl: "https://vietnambiz.vn",
    imageUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=450&fit=crop",
    status: "PUBLISHED",
    tags: ["Doanh nghiệp", "Chứng khoán"],
    sentiment: "Tích cực",
    categorySlug: "doanh-nghiep",
    categoryName: "Doanh nghiệp",
    publishedAt: "2026-04-07T10:00:00Z",
    createdAt: "2026-04-07T09:30:00Z",
  },
  {
    id: "art-10",
    title: "Dragon Capital: Dòng tiền lớn đã vào cổ phiếu VN",
    slug: "dragon-capital-dong-tien-lon-da-vao-co-phieu-vn",
    excerpt: "Dragon Capital nhận định dòng tiền đổ vào lớn đang giai đoạn vào cổ phiếu Việt Nam, không chờ nâng hạng, do định...",
    content: `<p><strong>Dragon Capital: Cơ hội "vàng" cho cổ phiếu Việt Nam.</strong></p>
<p>Ông Dominic Scriven, Chủ tịch Dragon Capital, chia sẻ tại hội nghị nhà đầu tư rằng dòng tiền ngoại lớn đã bắt đầu chảy vào cổ phiếu Việt Nam từ đầu năm 2026, không chờ đợi nâng hạng MSCI.</p>
<p>"Với P/E forward chỉ 10x, thị trường Việt Nam là một trong những nơi rẻ nhất châu Á. Các quỹ đầu tư dài hạn đã bắt đầu tích lũy từ Q1," ông Dominic cho biết.</p>
<p>Dragon Capital dự báo VN-Index sẽ đạt 1.450-1.500 điểm vào cuối năm 2026, tương đương upside 25-30% từ mức hiện tại. Các ngành được ưa thích gồm ngân hàng, bất động sản khu công nghiệp, và công nghệ.</p>`,
    aiSummary: "Dragon Capital: Dòng tiền ngoại đã vào VN (PE 10x, rẻ nhất châu Á). Target VN-Index 1.450-1.500 (+25-30%). Ưa thích: ngân hàng, BĐS KCN, tech.",
    authorName: "ADN Capital",
    sourceUrl: "https://vietnambiz.vn",
    imageUrl: "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=800&h=450&fit=crop",
    status: "PUBLISHED",
    tags: ["Thị trường", "Khối ngoại"],
    sentiment: "Tích cực",
    categorySlug: "thi-truong",
    categoryName: "Thị trường",
    publishedAt: "2026-04-07T09:00:00Z",
    createdAt: "2026-04-07T08:30:00Z",
  },
  {
    id: "art-11",
    title: "Khối ngoại tiếp tục bán ròng 800 tỷ, xả mạnh 3 cổ phiếu ngân hàng",
    slug: "khoi-ngoai-ban-rong-800-ty-xa-manh-3-co-phieu-ngan-hang",
    excerpt: "Phiên 7/4: Khối ngoại tiếp tục bán ròng mạnh trên sàn HoSE, tập trung bán 3 mã ngân hàng lớn.",
    content: `<p><strong>Khối ngoại tiếp tục xả hàng mạnh trên thị trường chứng khoán Việt Nam.</strong></p>
<p>Kết thúc phiên giao dịch ngày 7/4, khối ngoại bán ròng 800 tỷ đồng trên sàn HoSE. Đây là phiên bán ròng thứ 15 liên tiếp, nâng tổng giá trị bán ròng từ đầu tháng 4 lên gần 3.200 tỷ đồng.</p>
<p>Ba cổ phiếu ngân hàng bị bán mạnh nhất gồm: VCB (-220 tỷ), CTG (-180 tỷ), và BID (-150 tỷ). Đáng chú ý, HPG và FPT cũng bị bán ròng lần lượt 120 tỷ và 95 tỷ đồng.</p>
<p>Ở chiều ngược lại, khối ngoại mua ròng nhẹ một số mã midcap như PNJ (+25 tỷ), REE (+20 tỷ).</p>`,
    aiSummary: "Phiên 7/4: Ngoại bán ròng 800 tỷ (phiên thứ 15). Bán mạnh: VCB -220 tỷ, CTG -180 tỷ, BID -150 tỷ. Tổng bán ròng T4: ~3.200 tỷ.",
    authorName: "ADN Capital",
    sourceUrl: null,
    imageUrl: "https://images.unsplash.com/photo-1535320903710-d993d3d77d29?w=800&h=450&fit=crop",
    status: "PUBLISHED",
    tags: ["Thị trường", "Khối ngoại"],
    sentiment: "Tiêu cực",
    categorySlug: "thi-truong",
    categoryName: "Thị trường",
    publishedAt: "2026-04-07T08:00:00Z",
    createdAt: "2026-04-07T07:30:00Z",
  },
  {
    id: "art-12",
    title: "Một thế lực âm thầm 'gom hàng' khi chứng khoán rơi về vùng giá thấp",
    slug: "mot-the-luc-am-tham-gom-hang-khi-chung-khoan-roi-ve-vung-gia-thap",
    excerpt: "Trong khi nhà đầu tư cá nhân bán tháo, một nhóm tổ chức đã âm thầm tích lũy lượng lớn cổ phiếu giá rẻ.",
    content: `<p><strong>Tổ chức nội địa âm thầm "gom hàng" khi thị trường giảm sâu.</strong></p>
<p>Dữ liệu giao dịch cho thấy trong giai đoạn VN-Index giảm từ 1.320 xuống 1.150 điểm (tháng 2-3/2026), nhóm tự doanh và quỹ đầu tư nội địa đã mua ròng gần 12.000 tỷ đồng.</p>
<p>Các mã được gom nhiều nhất bao gồm: TCB, VPB, MBB (nhóm ngân hàng), VHM, NVL (bất động sản), và FPT (công nghệ). Đáng chú ý, khối lượng giao dịch thỏa thuận (block trade) tăng đột biến 3 lần trong tháng 3.</p>
<p>Giới phân tích nhận định đây là dấu hiệu của "smart money" - dòng tiền thông minh chờ đợi cơ hội mua vào khi thị trường hoảng loạn.</p>`,
    aiSummary: "Smart money gom 12.000 tỷ trong T2-3 khi VNI giảm từ 1.320→1.150. Mua mạnh: TCB, VPB, MBB, VHM, FPT. Block trade tăng 3x.",
    authorName: "ADN Capital",
    sourceUrl: null,
    imageUrl: "https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=800&h=450&fit=crop",
    status: "PUBLISHED",
    tags: ["Thị trường", "Phân tích"],
    sentiment: "Tích cực",
    categorySlug: "thi-truong",
    categoryName: "Thị trường",
    publishedAt: "2026-04-07T07:00:00Z",
    createdAt: "2026-04-07T06:30:00Z",
  },
  {
    id: "art-13",
    title: "VN-Index giảm sốc 35 điểm, thanh khoản cạn kiệt",
    slug: "vn-index-giam-soc-35-diem-thanh-khoan-can-kiet",
    excerpt: "Cổ phiếu VIX nổi sóng kịch trần trong ngày thị trường cạn thanh khoản, VN-Index mất 35 điểm.",
    content: `<p><strong>VN-Index trải qua phiên giao dịch tồi tệ nhất tháng 4/2026.</strong></p>
<p>Phiên giao dịch 7/4, VN-Index giảm sốc 35 điểm (-2,9%) xuống 1.160 điểm, mức thấp nhất trong 18 tháng. Thanh khoản sụt giảm nghiêm trọng, chỉ đạt 11.200 tỷ đồng - thấp hơn 40% so với bình quân 20 phiên.</p>
<p>Hơn 400 mã giảm giá, trong đó 65 mã giảm sàn. Nhóm cổ phiếu VN30 toàn bộ đỏ lửa, dẫn đầu là VCB (-4,2%), VIC (-3,8%), GAS (-3,5%).</p>
<p>Đáng chú ý, cổ phiếu VIX (Chứng khoán VIX) ngược dòng tăng trần 7% do nhà đầu tư kỳ vọng công ty hưởng lợi từ sóng mở tài khoản mới.</p>`,
    aiSummary: "VN-Index -35 điểm (-2.9%) xuống 1.160, thấp nhất 18 tháng. Thanh khoản 11.200 tỷ (-40%). 65 mã sàn. VIX ngược dòng +7% trần.",
    authorName: "ADN Capital",
    sourceUrl: null,
    imageUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=450&fit=crop",
    status: "PUBLISHED",
    tags: ["Thị trường"],
    sentiment: "Tiêu cực",
    categorySlug: "thi-truong",
    categoryName: "Thị trường",
    publishedAt: "2026-04-07T06:00:00Z",
    createdAt: "2026-04-07T05:30:00Z",
  },
  {
    id: "art-14",
    title: "NHNN giữ nguyên lãi suất điều hành, hỗ trợ doanh nghiệp",
    slug: "nhnn-giu-nguyen-lai-suat-dieu-hanh-ho-tro-doanh-nghiep",
    excerpt: "Ngân hàng Nhà nước quyết định giữ nguyên mức lãi suất tái cấp vốn ở 4,5%, tiếp tục hỗ trợ nền kinh tế.",
    content: `<p><strong>NHNN giữ nguyên lãi suất, ưu tiên ổn định kinh tế vĩ mô.</strong></p>
<p>Ngân hàng Nhà nước Việt Nam (NHNN) quyết định giữ nguyên lãi suất tái cấp vốn ở 4,5%/năm và lãi suất tái chiết khấu ở 3%/năm trong phiên họp tháng 4/2026.</p>
<p>Phó Thống đốc Đào Minh Tú cho biết quyết định nhằm cân bằng giữa hỗ trợ tăng trưởng kinh tế và kiểm soát rủi ro lạm phát khi giá dầu thế giới tăng cao.</p>
<p>NHNN cũng yêu cầu các ngân hàng thương mại tiếp tục giảm lãi suất cho vay đối với 5 lĩnh vực ưu tiên, đặc biệt là doanh nghiệp vừa và nhỏ.</p>`,
    aiSummary: "NHNN giữ lãi suất tái cấp vốn 4.5%, tái chiết khấu 3%. Mục tiêu: cân bằng tăng trưởng vs lạm phát (dầu tăng). Yêu cầu NHTM giảm lãi vay 5 lĩnh vực.",
    authorName: "ADN Capital",
    sourceUrl: null,
    imageUrl: "https://images.unsplash.com/photo-1501167786227-4cba60f6d58f?w=800&h=450&fit=crop",
    status: "PUBLISHED",
    tags: ["Chính sách", "Ngân hàng"],
    sentiment: "Trung tính",
    categorySlug: "chinh-sach",
    categoryName: "Chính sách",
    publishedAt: "2026-04-06T15:00:00Z",
    createdAt: "2026-04-06T14:30:00Z",
  },
  {
    id: "art-15",
    title: "VinHomes: Doanh số bán hàng Q1 tăng 150%, đặt kỳ vọng lớn 2026",
    slug: "vinhomes-doanh-so-ban-hang-q1-tang-150-phan-tram",
    excerpt: "VinHomes ghi nhận doanh số bán hàng kỷ lục trong quý I/2026, tăng 150% YoY nhờ các dự án mới ra mắt.",
    content: `<p><strong>VinHomes tiếp tục thống trị thị trường bất động sản.</strong></p>
<p>CTCP Vinhomes (VHM) công bố doanh số bán hàng quý I/2026 đạt khoảng 45.000 tỷ đồng, tăng 150% so với cùng kỳ năm ngoái. Đây là mức doanh số cao nhất lịch sử một quý của VinHomes.</p>
<p>Các dự án chủ lực đóng góp gồm: Vinhomes Global Gate (Hà Nội) chiếm 40% doanh số, Vinhomes Grand Park giai đoạn 3 (TP.HCM) chiếm 25%, và Vinhomes Ocean Park 3 (Hải Phòng) chiếm 20%.</p>
<p>Ban lãnh đạo đặt target doanh thu cả năm 2026 đạt 120.000 tỷ đồng, biên lợi nhuận mục tiêu 35%.</p>`,
    aiSummary: "VHM Q1/2026: Doanh số 45.000 tỷ (+150%, kỷ lục). Dẫn dắt: Global Gate 40%, Grand Park P3 25%. Target cả năm: 120.000 tỷ, margin 35%.",
    authorName: "ADN Capital",
    sourceUrl: null,
    imageUrl: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=450&fit=crop",
    status: "PUBLISHED",
    tags: ["Doanh nghiệp", "Bất động sản"],
    sentiment: "Tích cực",
    categorySlug: "bat-dong-san",
    categoryName: "Bất động sản",
    publishedAt: "2026-04-06T12:00:00Z",
    createdAt: "2026-04-06T11:30:00Z",
  },
  {
    id: "art-16",
    title: "FPT đạt doanh thu 1 tỷ USD từ AI và chuyển đổi số",
    slug: "fpt-dat-doanh-thu-1-ty-usd-tu-ai-va-chuyen-doi-so",
    excerpt: "Tập đoàn FPT đạt cột mốc doanh thu 1 tỷ USD từ các dịch vụ AI và chuyển đổi số trong Q1/2026.",
    content: `<p><strong>FPT cán mốc lịch sử doanh thu AI.</strong></p>
<p>Tập đoàn FPT thông báo doanh thu lũy kế từ dịch vụ AI và chuyển đổi số đã vượt mốc 1 tỷ USD, cột mốc quan trọng trong lộ trình "1 triệu kỹ sư AI" vào năm 2030.</p>
<p>Riêng quý I/2026, mảng AI đóng góp 280 triệu USD doanh thu, tăng 85% YoY. Thị trường Nhật Bản và Mỹ chiếm 70% doanh thu AI của FPT.</p>
<p>CEO Nguyễn Văn Khoa cho biết FPT đang đàm phán 3 hợp đồng AI trị giá trên 100 triệu USD mỗi cái, dự kiến ký kết trong H1/2026.</p>`,
    aiSummary: "FPT: DT AI/DT số cán mốc 1 tỷ USD. Q1/2026: AI đóng góp 280M USD (+85%). Nhật + Mỹ = 70%. Đang đàm phán 3 deal >100M USD.",
    authorName: "ADN Capital",
    sourceUrl: null,
    imageUrl: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=450&fit=crop",
    status: "PUBLISHED",
    tags: ["Doanh nghiệp", "Công nghệ"],
    sentiment: "Tích cực",
    categorySlug: "doanh-nghiep",
    categoryName: "Doanh nghiệp",
    publishedAt: "2026-04-06T10:00:00Z",
    createdAt: "2026-04-06T09:30:00Z",
  },
  {
    id: "art-17",
    title: "Bitcoin vượt 90.000 USD giữa bất ổn địa chính trị",
    slug: "bitcoin-vuot-90000-usd-giua-bat-on-dia-chinh-tri",
    excerpt: "Bitcoin tiếp tục đà tăng vượt 90.000 USD khi nhà đầu tư tìm kiếm tài sản trú ẩn ngoài vàng.",
    content: `<p><strong>Bitcoin lập đỉnh mới 90.000 USD.</strong></p>
<p>Bitcoin đã vượt mốc 90.000 USD trong phiên giao dịch ngày 7/4, đánh dấu mức giá cao nhất lịch sử. Tổng vốn hóa thị trường crypto đạt 3,8 nghìn tỷ USD.</p>
<p>Xu hướng tăng được hỗ trợ bởi: (1) Căng thẳng Mỹ-Iran đẩy nhà đầu tư tìm tài sản trú ẩn, (2) Dòng tiền vào các ETF Bitcoin spot tiếp tục mạnh, với 500 triệu USD vào ngày 7/4, (3) Kỳ vọng halving tiếp theo vào 2028 đẩy FOMO.</p>
<p>Ethereum cũng tăng 5% lên 4.200 USD. Solana tăng 8% lên 280 USD.</p>`,
    aiSummary: "Bitcoin vượt 90.000 USD (ATH), vốn hóa crypto 3.8T USD. Hỗ trợ: căng thẳng Iran, ETF inflow 500M/ngày, kỳ vọng halving 2028. ETH 4.200, SOL 280.",
    authorName: "ADN Capital",
    sourceUrl: null,
    imageUrl: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&h=450&fit=crop",
    status: "PUBLISHED",
    tags: ["Crypto", "Bitcoin"],
    sentiment: "Tích cực",
    categorySlug: "crypto",
    categoryName: "Crypto",
    publishedAt: "2026-04-07T22:00:00Z",
    createdAt: "2026-04-07T21:30:00Z",
  },
  {
    id: "art-18",
    title: "Ngân hàng VPBank: Lãi ròng quý I tăng 35%, NIM mở rộng",
    slug: "vpbank-lai-rong-quy-i-tang-35-nim-mo-rong",
    excerpt: "VPBank ghi nhận lợi nhuận ròng quý I/2026 tăng 35% so với cùng kỳ, biên lãi thuần NIM cải thiện đáng kể.",
    content: `<p><strong>VPBank tiếp tục tăng trưởng mạnh trong Q1/2026.</strong></p>
<p>Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank, mã: VPB) báo lãi trước thuế Q1/2026 đạt 5.800 tỷ đồng, tăng 35% YoY. Lãi ròng riêng lẻ đạt 4.600 tỷ đồng.</p>
<p>NIM (biên lãi thuần) tăng lên 4,2% từ 3,8% cùng kỳ nhờ cơ cấu tín dụng tập trung vào phân khúc bán lẻ margin cao. Tỷ lệ nợ xấu (NPL) giảm xuống 2,1% từ 2,8% cuối năm 2025.</p>
<p>FE Credit (công ty tài chính tiêu dùng) ghi nhận lãi trở lại sau 2 năm lỗ, đóng góp 200 tỷ đồng vào kết quả hợp nhất.</p>`,
    aiSummary: "VPB Q1/2026: LTT 5.800 tỷ (+35%), NIM 4.2% (vs 3.8%). NPL giảm 2.1% (vs 2.8%). FE Credit hòa vốn +200 tỷ sau 2 năm lỗ.",
    authorName: "ADN Capital",
    sourceUrl: null,
    imageUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&h=450&fit=crop",
    status: "PUBLISHED",
    tags: ["Doanh nghiệp", "Ngân hàng"],
    sentiment: "Tích cực",
    categorySlug: "ngan-hang",
    categoryName: "Ngân hàng",
    publishedAt: "2026-04-06T08:00:00Z",
    createdAt: "2026-04-06T07:30:00Z",
  },
  {
    id: "art-19",
    title: "Phiên giao dịch thảm hoạ: Margin call đẩy VN-Index giảm 4 phiên liên tiếp",
    slug: "phien-giao-dich-tham-hoa-margin-call-day-vn-index-giam-4-phien-lien-tiep",
    excerpt: "Lệnh margin call hàng loạt khiến VN-Index rung lắc mạnh, giảm phiên thứ 4 liên tiếp xuống vùng 1.150 điểm.",
    content: `<p><strong>Áp lực margin call bao trùm thị trường.</strong></p>
<p>VN-Index giảm phiên thứ 4 liên tiếp, đáng lo ngại hơn là biên độ giảm ngày càng mở rộng. Phiên 7/4 ghi nhận số lệnh force sell (margin call) tăng gấp 5 lần bình quân theo ước tính của các CTCK.</p>
<p>Tỷ lệ margin/vốn hóa hiện ở mức 3,8% – cao nhất trong 2 năm. Nhiều nhà đầu tư cá nhân dùng đòn bẩy 1:2, 1:3 đang rơi vào vùng nguy hiểm khi NAV tài khoản giảm dưới ngưỡng duy trì.</p>
<p>Các CTCK lớn như SSI, VNDirect, HSC đã nâng tỷ lệ ký quỹ ban đầu từ 50% lên 60% cho một số nhóm cổ phiếu, gây thêm áp lực bán.</p>`,
    aiSummary: "Margin call tăng 5x bình quân, VNI giảm phiên thứ 4. Tỷ lệ margin/VCSH 3.8% (cao nhất 2 năm). SSI, VND, HSC nâng ký quỹ 50→60%.",
    authorName: "ADN Capital",
    sourceUrl: null,
    imageUrl: "https://images.unsplash.com/photo-1543286386-713bdd548da4?w=800&h=450&fit=crop",
    status: "PUBLISHED",
    tags: ["Thị trường", "Margin"],
    sentiment: "Tiêu cực",
    categorySlug: "thi-truong",
    categoryName: "Thị trường",
    publishedAt: "2026-04-06T06:00:00Z",
    createdAt: "2026-04-06T05:30:00Z",
  },
  {
    id: "art-20",
    title: "Tín hiệu tích cực từ đàm phán nâng hạng MSCI Emerging Markets",
    slug: "tin-hieu-tich-cuc-tu-dam-phan-nang-hang-msci-emerging-markets",
    excerpt: "Việt Nam có thêm tiến triển trong lộ trình nâng hạng MSCI Emerging Markets với 2 tiêu chí đã đạt chuẩn.",
    content: `<p><strong>Nâng hạng MSCI: 2/3 tiêu chí đã đạt.</strong></p>
<p>Theo thông tin từ Ủy ban Chứng khoán Nhà nước, Việt Nam đã hoàn thành 2 trong 3 tiêu chí để được MSCI nâng hạng lên Emerging Markets: (1) Quy mô và thanh khoản thị trường, (2) Ổn định kinh tế vĩ mô.</p>
<p>Tiêu chí còn lại liên quan đến cơ chế pre-funding (thanh toán trước khi giao dịch) đang được Bộ Tài chính nghiên cứu thay đổi, dự kiến hoàn thành trong H2/2026.</p>
<p>Nếu được nâng hạng vào tháng 6/2027, ước tính khoảng 1,5-2 tỷ USD vốn ngoại sẽ chảy vào thị trường chứng khoán Việt Nam từ các quỹ passive.</p>`,
    aiSummary: "Nâng hạng MSCI: VN đạt 2/3 tiêu chí. Còn lại: pre-funding, dự kiến xong H2/2026. Nếu nâng hạng 6/2027: +1.5-2 tỷ USD từ quỹ passive.",
    authorName: "ADN Capital",
    sourceUrl: null,
    imageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&h=450&fit=crop",
    status: "PUBLISHED",
    tags: ["Chính sách", "MSCI"],
    sentiment: "Tích cực",
    categorySlug: "chinh-sach",
    categoryName: "Chính sách",
    publishedAt: "2026-04-05T10:00:00Z",
    createdAt: "2026-04-05T09:30:00Z",
  },
];

/** Hàm tiện ích: lọc bài theo category slug */
export function getArticlesByCategory(slug: string | null): MockArticle[] {
  if (!slug || slug === "tat-ca") return mockArticles;
  return mockArticles.filter((a) => a.categorySlug === slug);
}

/** Hàm tiện ích: tìm bài theo slug */
export function getArticleBySlug(slug: string): MockArticle | undefined {
  return mockArticles.find((a) => a.slug === slug);
}

/** Hàm tiện ích: lấy bài liên quan (cùng category, khác bài hiện tại) */
export function getRelatedArticles(articleId: string, categorySlug: string, limit = 5): MockArticle[] {
  return mockArticles
    .filter((a) => a.id !== articleId && a.categorySlug === categorySlug)
    .slice(0, limit);
}
