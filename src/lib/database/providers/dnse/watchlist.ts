import { fetchDnseInstruments, type DnseInstrument } from "@/lib/providers/dnse/market-data";
import { DNSE_DEFAULT_EOD_SYMBOLS, DNSE_INDEX_SYMBOLS, normalizeDnseSymbol } from "./eod-map";

export const DNSE_DEFAULT_WATCHLIST_LIMIT = 500;

const RADAR_WATCHLIST_500_FALLBACK_TEXT = `
VCB BID CTG TCB MBB VPB ACB STB HDB TPB VIB EIB LPB SSB SHB MSB OCB NVB BAB BVB
KLB PGB NAB VAB ABB FPT CMG CTR VGI FOX CMT ELC ITD SGT SAM VTC VTP HPG HSG NKG
VGS TVN SMC TLH VIS POM GDA VNM MSN SAB BHN KDC PAN QNS SBT LSS MCH VHC ANV IDI
FMC MPC DBC BAF HAG HNG VIC VHM VRE NVL KDH PDR DXG DIG CEO NLG KBC SZC BCM IDC
SIP VGC ITA LHG GVR PHR DPR TRC D2D NTL SCR HDC IJC HDG CII CTD HBC FCN HHV VCG
C4G LCG PC1 REE GEX POW NT2 PPC QTP BCG SSI VND VCI HCM FTS MBS BSI CTS SHS VIX
ORS APS AGR TVS DSC PSI VDS APG BVS IVS WSS GAS PLX PVD PVS PVB PVC BSR OIL PVT
PVP PVO PGC MWG FRT PNJ DGW PET PSD HAX SVC TMT VEA CTF HTM TCH GMD HAH VSC VOS
VTO VIP VNL DVP PHP SGP TCL CDN VJC HVN ACV SAS SGN NCT AST SCS DGC DCM DPM CSV
LAS DDV BFC LTG TSC IMP DHG DBD TRA DCL PME OPC DVN AMV VSH CHP SJD SBA TCI GEE
TAL A32 AAA AAH AAM AAS AAT ABC ABI ABR ABS ABT ABW ACC ACE ACG ACL ACM ACS ADC
ADG ADP ADS AFX AG1 AGF AGG AGM AGP AGX AIC AIG ALC ALT ALV AMC AME AMP AMS ANT
APC APF APH API APL APP APT ARM ART ASG ASM ASP ATA ATG ATS AVC AVG BAL BAX BBH
BBM BBS BBT BCA BCB BCC BCE BCF BCP BCR BCV BDG BDT BDW BED BEL BGE BGW BHA BHC
BHG BHH BHI BHK BHP BIC BIG BIO BKC BKG BLF BLI BLN BLT BMC BMD BMF BMG BMI BMJ
BMK BMP BMS BMV BNA BNW BOT BPC BQB BQP BRC BRR BRS BSA BSD BSG BSH BSL BSP BSQ
BT1 BT6 BTB BTD BTG BTH BTN BTP BTS BTT BTU BTV BTW BVG BVH BVL BVN BWA BWE BWS
BXH C21 C22 C32 C47 C69 C92 CAD CAG CAN CAP CAR CAT CBI CBS CC1 CCA CCC CCI CCL
CCM CCP CCR CCS CCT CCV CDC CDG CDO CDP CDR CEN CET CFM CFV CGV CH5 CHC CHS CI5
CIA CID CIG CIP CJC CK8 CKA CKD CKG CKV CLC CLH CLI CLL CLM CLW CLX CMC CMD CMF
CMI CMK CMM CMN CMP CMS CMV CMW CMX CNA CNC CNG CNN CNT COM CPA CPC CPH CPI CQN
CQT CRC CRE CRV CSC CSI CSM CST CT3 CT6 CTB CTI CTP CTT CTW CTX CVN CVT CX8 CYC
D11 DAC DAD DAE DAG DAH DAN DAS DAT DBM DBT DC1 DC2 DC4 DCF DCG DCH DCR DCS DCT
DCV DDB DDG DDH DDM DDN DFC DFF DGT DHA DHB DHC DHD DHM DHN DHP DHT DIC DID DIH
DKC DKG DL1 DLD DLG DLR DLT DM7 DMC DMN DMS DNA DNC DND DNE DNH DNL DNM DNN DNT
`;

export const RADAR_WATCHLIST_500_FALLBACK = RADAR_WATCHLIST_500_FALLBACK_TEXT.trim().split(/\s+/);

function isStockWatchlistSymbol(symbol: string) {
  if (!symbol || DNSE_INDEX_SYMBOLS.has(symbol)) return false;
  if (symbol.startsWith("VN30F") || /F\d+M$/.test(symbol)) return false;
  return /^[A-Z0-9]{3,8}$/.test(symbol);
}

function isStockInstrument(item: DnseInstrument) {
  const symbol = normalizeDnseSymbol(item.symbol);
  if (!isStockWatchlistSymbol(symbol)) return false;

  const marker = `${item.marketId ?? ""} ${item.securityGroupId ?? ""} ${item.symbolType ?? ""}`.toUpperCase();
  if (marker.includes("FUTURE") || marker.includes("DERIVATIVE") || marker.includes("CW")) return false;
  return true;
}

export function normalizeDnseWatchlistSymbols(symbols: readonly string[], limit = DNSE_DEFAULT_WATCHLIST_LIMIT) {
  return Array.from(new Set(symbols.map(normalizeDnseSymbol).filter(isStockWatchlistSymbol))).slice(0, limit);
}

export async function loadDnseWatchlistSymbols(options?: {
  symbols?: readonly string[];
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(options?.limit ?? DNSE_DEFAULT_WATCHLIST_LIMIT, DNSE_DEFAULT_WATCHLIST_LIMIT));
  if (options?.symbols?.length) return normalizeDnseWatchlistSymbols(options.symbols, limit);

  const symbols: string[] = [];
  const perPage = Math.min(Math.max(limit, 100), 500);

  for (let page = 1; page <= 5 && symbols.length < limit; page += 1) {
    const instruments = await fetchDnseInstruments({ limit: perPage, page }).catch(() => []);
    if (instruments.length === 0) break;
    symbols.push(...instruments.filter(isStockInstrument).map((item) => normalizeDnseSymbol(item.symbol)));
  }

  return normalizeDnseWatchlistSymbols([...symbols, ...RADAR_WATCHLIST_500_FALLBACK, ...DNSE_DEFAULT_EOD_SYMBOLS], limit);
}
