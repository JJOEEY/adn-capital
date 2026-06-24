import { VNSTOCK_INDUSTRY_BY_TICKER } from "./vnstock-industry-map";

const SECTOR_BY_TICKER: Record<string, string> = {};

function registerSector(sector: string, tickers: string[]) {
  for (const ticker of tickers) {
    SECTOR_BY_TICKER[ticker] = sector;
  }
}

registerSector("Ngân hàng", [
  "ACB",
  "BAB",
  "BID",
  "BVB",
  "CTG",
  "EIB",
  "HDB",
  "KLB",
  "LPB",
  "MBB",
  "MSB",
  "NAB",
  "NVB",
  "OCB",
  "PGB",
  "SGB",
  "SHB",
  "SSB",
  "STB",
  "TCB",
  "TPB",
  "VAB",
  "VBB",
  "VCB",
  "VIB",
  "VPB",
]);

registerSector("Chứng khoán", [
  "AGR",
  "APG",
  "APS",
  "BSI",
  "BVS",
  "CTS",
  "DSC",
  "EVS",
  "FTS",
  "HCM",
  "MBS",
  "ORS",
  "SHS",
  "SSI",
  "TCI",
  "TVB",
  "TVS",
  "VCI",
  "VDS",
  "VFS",
  "VIG",
  "VIX",
  "VND",
  "VSC",
]);

registerSector("Bất động sản", [
  "AGG",
  "BCM",
  "CEO",
  "CRE",
  "D2D",
  "DIG",
  "DRH",
  "DXG",
  "HDC",
  "HDG",
  "IJC",
  "KBC",
  "KDH",
  "LDG",
  "NBB",
  "NLG",
  "NTL",
  "NVL",
  "PDR",
  "SCR",
  "SJS",
  "TCH",
  "VHM",
  "VIC",
  "VPI",
  "VRE",
]);

registerSector("Khu công nghiệp", [
  "BCM",
  "IDC",
  "IDV",
  "ITA",
  "KBC",
  "LHG",
  "NTC",
  "PHR",
  "SIP",
  "SZC",
  "TIP",
  "VGC",
]);

registerSector("Dầu khí", [
  "BSR",
  "GAS",
  "OIL",
  "PET",
  "PLX",
  "POW",
  "PVB",
  "PVC",
  "PVD",
  "PVP",
  "PVS",
  "PVT",
  "PVX",
  "PXS",
  "VTO",
]);

registerSector("Điện và năng lượng", [
  "BCG",
  "BWE",
  "CHP",
  "DRL",
  "GEG",
  "GEX",
  "NT2",
  "PC1",
  "PGV",
  "PPC",
  "QTP",
  "REE",
  "SBA",
  "SJD",
  "TTA",
  "VSH",
]);

registerSector("Thép và vật liệu xây dựng", [
  "BCC",
  "BMP",
  "DHA",
  "HPG",
  "HSG",
  "HT1",
  "KSB",
  "NKG",
  "PLC",
  "SMC",
  "TLH",
  "TVN",
  "VCS",
  "VGC",
  "VGS",
  "VLB",
]);

registerSector("Hóa chất và phân bón", [
  "AAA",
  "BFC",
  "CSV",
  "DCM",
  "DDV",
  "DGC",
  "DPM",
  "DPR",
  "APH",
  "LAS",
  "NFC",
  "PHR",
  "PLC",
  "TRC",
  "VTZ",
]);

registerSector("Cao su và nông nghiệp", [
  "BAF",
  "DBC",
  "DPR",
  "DRI",
  "GVR",
  "HAG",
  "HNG",
  "HSL",
  "LTG",
  "NAF",
  "PAN",
  "PHR",
  "SBT",
  "TAR",
  "TRC",
]);

registerSector("Thủy sản và thực phẩm", [
  "ANV",
  "ASM",
  "BBC",
  "FMC",
  "IDI",
  "KDC",
  "MCH",
  "MML",
  "MPC",
  "MSN",
  "QNS",
  "SAB",
  "SBT",
  "VHC",
  "VNM",
]);

registerSector("Bán lẻ và tiêu dùng", [
  "DGW",
  "FRT",
  "GDT",
  "MWG",
  "PNJ",
  "SAB",
  "VNM",
]);

registerSector("Công nghệ và viễn thông", [
  "CMG",
  "CTR",
  "ELC",
  "FPT",
  "FOX",
  "ICT",
  "VGI",
  "VNZ",
  "VTC",
]);

registerSector("Cảng biển và vận tải", [
  "DVP",
  "GMD",
  "HAH",
  "PHP",
  "SGP",
  "VOS",
  "VSC",
  "VTO",
]);

registerSector("Hàng không và du lịch", [
  "ACV",
  "AST",
  "HVN",
  "NCT",
  "SAS",
  "SCS",
  "VJC",
  "VNG",
]);

registerSector("Y tế và dược phẩm", [
  "DBD",
  "DHG",
  "DHT",
  "IMP",
  "JVC",
  "PME",
  "TNH",
  "TRA",
]);

registerSector("Bảo hiểm", ["ABI", "BIC", "BMI", "BVH", "MIG", "PVI", "PTI", "PRE"]);

registerSector("Dệt may", ["GIL", "MSH", "STK", "TCM", "TNG", "VGT"]);

registerSector("Xây dựng và hạ tầng", [
  "C4G",
  "CC1",
  "CII",
  "CTD",
  "FCN",
  "HBC",
  "HHV",
  "LCG",
  "VCG",
]);

// Chuẩn hoá tên ngành thô (bridge trả tiếng Việt ngắn / English ICB) về nhóm canonical.
// Key đã BỎ DẤU + lowercase (xem sectorKey) nên "Hoá chất" = "Hóa chất", "Thuỷ sản" = "Thủy sản".
const SECTOR_ALIASES: Record<string, string> = {
  // English (caller cũ truyền ICB tiếng Anh)
  banking: "Ngân hàng",
  bank: "Ngân hàng",
  securities: "Chứng khoán",
  brokerage: "Chứng khoán",
  "real estate": "Bất động sản",
  property: "Bất động sản",
  oil: "Dầu khí",
  gas: "Dầu khí",
  energy: "Điện và năng lượng",
  steel: "Thép và vật liệu xây dựng",
  materials: "Thép và vật liệu xây dựng",
  chemical: "Hóa chất và phân bón",
  chemicals: "Hóa chất và phân bón",
  fertilizer: "Hóa chất và phân bón",
  retail: "Bán lẻ và tiêu dùng",
  technology: "Công nghệ và viễn thông",
  telecom: "Công nghệ và viễn thông",
  healthcare: "Y tế và dược phẩm",
  insurance: "Bảo hiểm",
  // Tiếng Việt bridge trả (key bỏ dấu) → gộp các tên lẻ tẻ về 1 nhóm
  "ngan hang": "Ngân hàng",
  "chung khoan": "Chứng khoán",
  "bao hiem": "Bảo hiểm",
  "bat dong san": "Bất động sản",
  kcn: "Khu công nghiệp",
  "khu cong nghiep": "Khu công nghiệp",
  "xay dung": "Xây dựng và hạ tầng",
  "ha tang": "Xây dựng và hạ tầng",
  thep: "Thép và vật liệu xây dựng",
  "vat lieu xd": "Thép và vật liệu xây dựng",
  "vat lieu xay dung": "Thép và vật liệu xây dựng",
  "hoa chat": "Hóa chất và phân bón",
  "phan bon": "Hóa chất và phân bón",
  nhua: "Hóa chất và phân bón",
  "bao bi": "Hóa chất và phân bón",
  "cao su": "Cao su và nông nghiệp",
  "nong nghiep": "Cao su và nông nghiệp",
  "chan nuoi": "Cao su và nông nghiệp",
  duong: "Cao su và nông nghiệp",
  go: "Cao su và nông nghiệp",
  dien: "Điện và năng lượng",
  "nang luong": "Dầu khí",
  "dau khi": "Dầu khí",
  "ban le": "Bán lẻ và tiêu dùng",
  "tieu dung": "Bán lẻ và tiêu dùng",
  "phan phoi": "Bán lẻ và tiêu dùng",
  "do uong": "Bán lẻ và tiêu dùng",
  "thuy san": "Thủy sản và thực phẩm",
  "thuc pham": "Thủy sản và thực phẩm",
  "cong nghe": "Công nghệ và viễn thông",
  "vien thong": "Công nghệ và viễn thông",
  logistics: "Cảng biển và vận tải",
  "cang bien": "Cảng biển và vận tải",
  "van tai bien": "Cảng biển và vận tải",
  "van tai": "Cảng biển và vận tải",
  "hang khong": "Hàng không và du lịch",
  "du lich": "Hàng không và du lịch",
  "duoc pham": "Y tế và dược phẩm",
  "y te": "Y tế và dược phẩm",
  "det may": "Dệt may",
  "da nganh": "Đa ngành",
  "dau tu": "Đa ngành",
  "tai chinh": "Đa ngành",
  // Tên ngành ICB từ vnstock Listing().symbols_by_industries() (key đã bỏ dấu)
  "ban buon": "Bán lẻ và tiêu dùng",
  "cham soc suc khoe": "Y tế và dược phẩm",
  "che bien thuy san": "Thủy sản và thực phẩm",
  "cong nghe va thong tin": "Công nghệ và viễn thông",
  "dich vu luu tru an uong giai tri": "Hàng không và du lịch",
  "dich vu tu van ho tro": "Đa ngành",
  "khai khoang": "Khai khoáng",
  "nong lam ngu": "Cao su và nông nghiệp",
  "sx hang gia dung": "Bán lẻ và tiêu dùng",
  "sx nhua hoa chat": "Hóa chất và phân bón",
  "sx phu tro": "Sản xuất và công nghiệp",
  "sx thiet bi may moc": "Sản xuất và công nghiệp",
  "san pham cao su": "Cao su và nông nghiệp",
  "thiet bi dien": "Điện và năng lượng",
  "thuc pham do uong": "Thủy sản và thực phẩm",
  "tien ich": "Điện và năng lượng",
  "tai chinh khac": "Đa ngành",
  "van tai kho bai": "Cảng biển và vận tải",
};

// Bỏ dấu + lowercase + gộp ký tự lạ thành khoảng trắng → key ổn định cho SECTOR_ALIASES.
function sectorKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isUnknownSector(value: string) {
  const normalized = sectorKey(value);
  return (
    !normalized ||
    normalized === "khac" ||
    normalized === "na" ||
    normalized === "n a" ||
    normalized === "other" ||
    normalized === "others" ||
    normalized === "misc" ||
    normalized === "chua phan loai"
  );
}

// Nhóm ngành hiển thị cho 1 mã.
// Ưu tiên: (1) bảng thủ công đã kiểm SECTOR_BY_TICKER — vì sector bridge HAY SAI/đặt tên lẻ tẻ
// (CSV→"Cao su", DGC→"Hoá chất", GDT→"Du lịch", APH→"Dược phẩm"...); (2) sector bridge chuẩn hoá
// về nhóm canonical qua SECTOR_ALIASES; (3) "Chưa phân loại".
export function classifyTickerSector(symbol: string, rawSector?: string | null) {
  const ticker = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const curated = SECTOR_BY_TICKER[ticker];
  if (curated) return curated;

  // (2) ICB vnstock — nguồn phân ngành CHUẨN, phủ ~696 mã (FiinQuant hay trả "Khác").
  const vnIndustry = VNSTOCK_INDUSTRY_BY_TICKER[ticker];
  if (vnIndustry) {
    const canonical = SECTOR_ALIASES[sectorKey(vnIndustry)];
    if (canonical) return canonical;
  }

  // (3) Sector thô bridge FiinQuant → chuẩn hoá.
  const cleaned = typeof rawSector === "string" ? rawSector.trim() : "";
  if (cleaned && !isUnknownSector(cleaned)) {
    return SECTOR_ALIASES[sectorKey(cleaned)] ?? cleaned;
  }

  return "Chưa phân loại";
}
