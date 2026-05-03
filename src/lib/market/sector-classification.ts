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
  "DRI",
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

const FRIENDLY_SECTOR_ALIASES: Record<string, string> = {
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
  logistics: "Cảng biển và vận tải",
  transportation: "Cảng biển và vận tải",
  healthcare: "Y tế và dược phẩm",
  insurance: "Bảo hiểm",
};

function isUnknownSector(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    !normalized ||
    normalized === "-" ||
    normalized === "n/a" ||
    normalized === "na" ||
    normalized === "khac" ||
    normalized === "khác" ||
    normalized === "other" ||
    normalized === "others" ||
    normalized === "misc"
  );
}

export function classifyTickerSector(symbol: string, rawSector?: string | null) {
  const ticker = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const cleanedSector = typeof rawSector === "string" ? rawSector.trim() : "";

  if (cleanedSector && !isUnknownSector(cleanedSector)) {
    return FRIENDLY_SECTOR_ALIASES[cleanedSector.toLowerCase()] ?? cleanedSector;
  }

  return SECTOR_BY_TICKER[ticker] ?? "Chưa phân loại";
}
