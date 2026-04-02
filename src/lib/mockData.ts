export const MOCK_STOCKS = [
  { symbol: "VNM", name: "Vinamilk", rsRating: 96, price: 68500, change: 1.2, changePercent: 1.78, volume: 2340000, sector: "Tiêu dùng" },
  { symbol: "FPT", name: "FPT Corp", rsRating: 94, price: 125000, change: 2.5, changePercent: 2.04, volume: 1890000, sector: "Công nghệ" },
  { symbol: "MWG", name: "Mobile World", rsRating: 91, price: 42300, change: 0.8, changePercent: 1.93, volume: 3120000, sector: "Bán lẻ" },
  { symbol: "TCB", name: "Techcombank", rsRating: 89, price: 31200, change: -0.3, changePercent: -0.95, volume: 5670000, sector: "Ngân hàng" },
  { symbol: "VIC", name: "Vingroup", rsRating: 87, price: 38600, change: 1.4, changePercent: 3.76, volume: 2890000, sector: "Bất động sản" },
  { symbol: "HPG", name: "Hòa Phát", rsRating: 85, price: 24700, change: -0.5, changePercent: -1.98, volume: 8920000, sector: "Thép" },
  { symbol: "MSN", name: "Masan Group", rsRating: 83, price: 58900, change: 0.9, changePercent: 1.55, volume: 1450000, sector: "Tiêu dùng" },
  { symbol: "VHM", name: "Vinhomes", rsRating: 81, price: 31800, change: -0.2, changePercent: -0.62, volume: 4230000, sector: "Bất động sản" },
  { symbol: "CTG", name: "Vietinbank", rsRating: 78, price: 26400, change: 0.4, changePercent: 1.54, volume: 3780000, sector: "Ngân hàng" },
  { symbol: "BID", name: "BIDV", rsRating: 74, price: 43200, change: -0.8, changePercent: -1.82, volume: 2100000, sector: "Ngân hàng" },
  { symbol: "VCB", name: "Vietcombank", rsRating: 72, price: 87600, change: 1.1, changePercent: 1.27, volume: 1670000, sector: "Ngân hàng" },
  { symbol: "SAB", name: "Sabeco", rsRating: 68, price: 56200, change: -1.2, changePercent: -2.09, volume: 890000, sector: "Đồ uống" },
  { symbol: "GAS", name: "PVGas", rsRating: 65, price: 76800, change: 0.6, changePercent: 0.79, volume: 1230000, sector: "Năng lượng" },
  { symbol: "POW", name: "PV Power", rsRating: 61, price: 13500, change: 0.2, changePercent: 1.50, volume: 6780000, sector: "Điện" },
  { symbol: "PLX", name: "Petrolimex", rsRating: 57, price: 38900, change: -0.7, changePercent: -1.77, volume: 1450000, sector: "Năng lượng" },
  { symbol: "STB", name: "Sacombank", rsRating: 53, price: 17800, change: 0.3, changePercent: 1.71, volume: 7890000, sector: "Ngân hàng" },
  { symbol: "HDB", name: "HDBank", rsRating: 49, price: 22400, change: -0.4, changePercent: -1.75, volume: 2340000, sector: "Ngân hàng" },
  { symbol: "EIB", name: "Eximbank", rsRating: 44, price: 16700, change: 0.1, changePercent: 0.60, volume: 3210000, sector: "Ngân hàng" },
] as const;

export const MOCK_NEWS = [
  {
    title: "VN-Index hồi phục mạnh, thanh khoản cải thiện đáng kể",
    summary: "Phiên giao dịch hôm nay chứng kiến sự hồi phục tích cực của VN-Index với lực cầu lan rộng khắp các nhóm ngành. Thanh khoản toàn thị trường đạt trên 18.000 tỷ đồng.",
    category: "Thị trường",
    sentiment: "positive" as const,
    time: "10:30",
  },
  {
    title: "FPT và nhóm công nghệ dẫn dắt đà tăng",
    summary: "Cổ phiếu công nghệ tiếp tục thu hút dòng tiền mạnh trong bối cảnh xu hướng chuyển đổi số toàn cầu. FPT, CMC, VGI đều tăng trên 2%.",
    category: "Nhóm ngành",
    sentiment: "positive" as const,
    time: "10:15",
  },
  {
    title: "Khối ngoại mua ròng 3 phiên liên tiếp",
    summary: "Nhà đầu tư nước ngoài tiếp tục mua ròng với giá trị lên đến 450 tỷ đồng, tập trung vào các cổ phiếu bluechip và ngành ngân hàng.",
    category: "Dòng tiền",
    sentiment: "positive" as const,
    time: "09:45",
  },
  {
    title: "Lãi suất huy động tiếp tục xu hướng tăng nhẹ",
    summary: "Một số ngân hàng thương mại điều chỉnh tăng nhẹ lãi suất huy động, có thể tạo áp lực phân bổ vốn của nhà đầu tư giữa kênh chứng khoán và tiết kiệm.",
    category: "Vĩ mô",
    sentiment: "neutral" as const,
    time: "09:00",
  },
  {
    title: "Báo cáo KQKD Q1/2026: Nhiều doanh nghiệp vượt kế hoạch",
    summary: "Kết quả kinh doanh quý 1/2026 của các doanh nghiệp niêm yết khả quan, đặc biệt nhóm công nghệ và hàng tiêu dùng ghi nhận tăng trưởng lợi nhuận trên 20% YoY.",
    category: "Doanh nghiệp",
    sentiment: "positive" as const,
    time: "08:30",
  },
  {
    title: "Cảnh báo: Nhóm bất động sản còn nhiều áp lực",
    summary: "Mặc dù thanh khoản thị trường bất động sản có dấu hiệu phục hồi nhưng áp lực trái phiếu đáo hạn vẫn là rủi ro ngắn hạn cần theo dõi.",
    category: "Cảnh báo",
    sentiment: "negative" as const,
    time: "08:00",
  },
];

export const MOCK_SIGNALS = [
  { id: "1", stock: "FPT", type: "superstock" as const, condition: "Nền 4 tháng, Vol spike x3 MA20, tất cả EMA trending up, thị trường tốt", createdAt: new Date().toISOString() },
  { id: "2", stock: "MWG", type: "midterm" as const, condition: "Base 3.5 tháng, EMA10 > EMA30, Vol tăng bền vững, hồi test EMA20 thành công", createdAt: new Date(Date.now() - 900000).toISOString() },
  { id: "3", stock: "VNM", type: "midterm" as const, condition: "Tích lũy 3 tháng, Vol > MA20 x2, EMA10 > EMA30, RSI phân kỳ dương", createdAt: new Date(Date.now() - 1800000).toISOString() },
  { id: "4", stock: "TCB", type: "speculative" as const, condition: "RSI 26 bật lên, MACD cắt lên, EMA30 hỗ trợ tốt, Vol tăng đột biến", createdAt: new Date(Date.now() - 2700000).toISOString() },
  { id: "5", stock: "HPG", type: "speculative" as const, condition: "RSI 23 oversold, MACD divergence dương, chạm EMA200, nến búa xuất hiện", createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: "6", stock: "VIC", type: "midterm" as const, condition: "Nền 5 tháng vững chắc, thể hiện sức mạnh tương đối RS cao, Vol xác nhận tích luỹ", createdAt: new Date(Date.now() - 4500000).toISOString() },
];
