import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  FileText,
  Building2,
  Package,
  Layers,
  ArrowRight,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
} from 'lucide-react';
import { Product, Branch, LiquorSubCategory } from '../types';

interface CsvInventoryImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: Branch[];
  existingProducts?: Product[];
  onBatchImport: (products: Omit<Product, 'id' | 'createdAt'>[]) => Promise<number>;
}

export interface ParsedProductDraft extends Omit<Product, 'id' | 'createdAt'> {
  rowNumber: number;
  isValid: boolean;
  validationError?: string;
  isDuplicate?: boolean;
  duplicateSource?: 'catalog' | 'intra_csv';
  duplicateType?: 'barcode' | 'sku' | 'name';
  duplicateReason?: string;
  matchingProductInfo?: string;
}

const SAMPLE_CSV_HEADERS = [
  'Product Name',
  'Stock Category (IPS/LPS)',
  'SubCategory',
  'Brand',
  'Barcode (EAN-13)',
  'Case Barcode',
  'Volume (ml)',
  'ABV (%)',
  'Bottles Per Case',
  'Origin Country',
  'Supplier Name',
  'Import Entry Ref',
  'Excise Stamp Series',
  'Landed Cost (KES)',
  'Wholesale Price (KES)',
  'Retail Price (KES)',
  'Initial Bottles',
];

const SAMPLE_CSV_ROWS: string[] = [];

// Helper to normalize product names for exact duplicate matching
function normalizeText(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export const CsvInventoryImportModal: React.FC<CsvInventoryImportModalProps> = ({
  isOpen,
  onClose,
  branches,
  existingProducts = [],
  onBatchImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetBranchId, setTargetBranchId] = useState<string>(branches[0]?.id || 'br-hq-001');
  const [parsedRows, setParsedRows] = useState<ParsedProductDraft[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importSummary, setImportSummary] = useState<{ count: number; message: string; type?: 'success' | 'warning' | 'error' } | null>(null);
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'unique' | 'duplicates' | 'invalid'>('all');
  const [isTestingDuplicates, setIsTestingDuplicates] = useState(false);

  // Handle sample CSV template download
  const handleDownloadTemplate = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      encodeURIComponent([SAMPLE_CSV_HEADERS.join(','), ...SAMPLE_CSV_ROWS].join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', 'VAAIRO_Liquor_Inventory_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Robust line splitter that handles quotes
  const parseCsvLine = (text: string, delimiter: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  // Comprehensive Duplicate Detection Test
  const evaluateDuplicates = useCallback(
    (rows: ParsedProductDraft[], catalog: Product[]): ParsedProductDraft[] => {
      // 1. Build lookup maps for the existing Firestore / system catalog
      const catalogByBarcode = new Map<string, Product>();
      const catalogByCaseBarcode = new Map<string, Product>();
      const catalogBySku = new Map<string, Product>();
      const catalogByNameAndVol = new Map<string, Product>();

      for (const p of catalog) {
        if (p.status === ('Deleted' as any)) continue;
        if (p.barcode && p.barcode.trim()) {
          catalogByBarcode.set(p.barcode.trim(), p);
        }
        if (p.caseBarcode && p.caseBarcode.trim()) {
          catalogByCaseBarcode.set(p.caseBarcode.trim(), p);
        }
        if (p.sku && p.sku.trim()) {
          catalogBySku.set(p.sku.trim().toUpperCase(), p);
        }
        if (p.name) {
          const normKey = `${normalizeText(p.name)}_${p.volumeMl || 750}`;
          catalogByNameAndVol.set(normKey, p);
        }
      }

      // 2. Track rows within the CSV itself to catch intra-file duplicates
      const seenCsvBarcodes = new Map<string, number>(); // barcode -> rowNumber
      const seenCsvCaseBarcodes = new Map<string, number>();
      const seenCsvSkus = new Map<string, number>(); // sku -> rowNumber
      const seenCsvNames = new Map<string, number>(); // normNameKey -> rowNumber

      return rows.map((row) => {
        if (!row.isValid) {
          return { ...row, isDuplicate: false };
        }

        const skuUpper = row.sku ? row.sku.trim().toUpperCase() : '';
        const barcodeVal = row.barcode ? row.barcode.trim() : '';
        const caseBarcodeVal = row.caseBarcode ? row.caseBarcode.trim() : '';
        const nameVolKey = `${normalizeText(row.name)}_${row.volumeMl || 750}`;

        // A. Check against Existing Database Catalog
        if (barcodeVal && catalogByBarcode.has(barcodeVal)) {
          const match = catalogByBarcode.get(barcodeVal)!;
          return {
            ...row,
            isDuplicate: true,
            duplicateSource: 'catalog',
            duplicateType: 'barcode',
            duplicateReason: `Barcode ${barcodeVal} already registered in database (${match.name} · ${match.sku})`,
            matchingProductInfo: `${match.name} (${match.sku})`,
          };
        }

        if (caseBarcodeVal && catalogByCaseBarcode.has(caseBarcodeVal)) {
          const match = catalogByCaseBarcode.get(caseBarcodeVal)!;
          return {
            ...row,
            isDuplicate: true,
            duplicateSource: 'catalog',
            duplicateType: 'barcode',
            duplicateReason: `Case barcode ${caseBarcodeVal} matches existing product (${match.name})`,
            matchingProductInfo: `${match.name} (${match.sku})`,
          };
        }

        if (skuUpper && catalogBySku.has(skuUpper)) {
          const match = catalogBySku.get(skuUpper)!;
          return {
            ...row,
            isDuplicate: true,
            duplicateSource: 'catalog',
            duplicateType: 'sku',
            duplicateReason: `Auto-SKU "${skuUpper}" already exists in inventory (${match.name})`,
            matchingProductInfo: `${match.name} (${match.sku})`,
          };
        }

        if (catalogByNameAndVol.has(nameVolKey)) {
          const match = catalogByNameAndVol.get(nameVolKey)!;
          return {
            ...row,
            isDuplicate: true,
            duplicateSource: 'catalog',
            duplicateType: 'name',
            duplicateReason: `Product "${row.name}" (${row.volumeMl}ml) already exists in database as ${match.sku}`,
            matchingProductInfo: `${match.name} (${match.sku})`,
          };
        }

        // B. Check against Earlier Rows in the Same CSV (Intra-File Duplication)
        if (barcodeVal && seenCsvBarcodes.has(barcodeVal)) {
          const firstRow = seenCsvBarcodes.get(barcodeVal)!;
          return {
            ...row,
            isDuplicate: true,
            duplicateSource: 'intra_csv',
            duplicateType: 'barcode',
            duplicateReason: `Repeated barcode ${barcodeVal} duplicated inside this CSV (already defined in Row #${firstRow})`,
          };
        }

        if (skuUpper && seenCsvSkus.has(skuUpper)) {
          const firstRow = seenCsvSkus.get(skuUpper)!;
          return {
            ...row,
            isDuplicate: true,
            duplicateSource: 'intra_csv',
            duplicateType: 'sku',
            duplicateReason: `Repeated SKU "${skuUpper}" duplicated inside this CSV (already defined in Row #${firstRow})`,
          };
        }

        if (seenCsvNames.has(nameVolKey)) {
          const firstRow = seenCsvNames.get(nameVolKey)!;
          return {
            ...row,
            isDuplicate: true,
            duplicateSource: 'intra_csv',
            duplicateType: 'name',
            duplicateReason: `Repeated product name & volume duplicated inside this CSV (already defined in Row #${firstRow})`,
          };
        }

        // C. Record this unique row so subsequent duplicate rows are caught
        if (barcodeVal) seenCsvBarcodes.set(barcodeVal, row.rowNumber);
        if (caseBarcodeVal) seenCsvCaseBarcodes.set(caseBarcodeVal, row.rowNumber);
        if (skuUpper) seenCsvSkus.set(skuUpper, row.rowNumber);
        seenCsvNames.set(nameVolKey, row.rowNumber);

        return {
          ...row,
          isDuplicate: false,
        };
      });
    },
    []
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setIsProcessingFile(true);
    setImportSummary(null);
    setActiveFilterTab('all');

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      console.log('CSV Import: Total lines found:', lines.length);

      if (lines.length < 2) {
        setParsedRows([]);
        setIsProcessingFile(false);
        return;
      }

      // Determine delimiter (comma, semicolon, or tab)
      const firstLine = lines[0];
      let delimiter = ',';
      if (firstLine.includes(';') && firstLine.split(';').length > firstLine.split(',').length) {
        delimiter = ';';
      } else if (firstLine.includes('\t') && firstLine.split('\t').length > firstLine.split(',').length) {
        delimiter = '\t';
      }

      const rawHeaders = parseCsvLine(firstLine, delimiter).map((h) =>
        h.toLowerCase().replace(/[^a-z0-9]/g, '')
      );

      // Map header indices
      const findHeaderIdx = (aliases: string[]): number => {
        for (let i = 0; i < rawHeaders.length; i++) {
          const clean = rawHeaders[i];
          if (aliases.some((alias) => clean.includes(alias))) return i;
        }
        return -1;
      };

      const skuIdx = findHeaderIdx(['autosku', 'sku', 'itemcode', 'code', 'productcode', 'id']);
      const nameIdx = findHeaderIdx(['name', 'productname', 'description', 'title', 'item']);
      const categoryIdx = findHeaderIdx(['category', 'stockcategory', 'class', 'stockclass', 'ipslps']);
      const subCatIdx = findHeaderIdx(['subcategory', 'liquortype', 'type']);
      const brandIdx = findHeaderIdx(['brand', 'producer', 'distillery']);
      const barcodeIdx = findHeaderIdx(['barcode', 'upc', 'ean', 'ean13', 'itembarcode']);
      const caseBarcodeIdx = findHeaderIdx(['casebarcode', 'itf14', 'outerbarcode']);
      const volumeIdx = findHeaderIdx(['vol', 'volume', 'ml', 'size']);
      const abvIdx = findHeaderIdx(['abv', 'alcohol', 'percentage', 'proof']);
      const bottlesPerCaseIdx = findHeaderIdx(['bottlespercase', 'packsize', 'casepack', 'pack', 'cs']);
      const originIdx = findHeaderIdx(['origin', 'country', 'countryoforigin']);
      const supplierIdx = findHeaderIdx(['supplier', 'vendor', 'distributor']);
      const importRefIdx = findHeaderIdx(['importentry', 'idf', 'declaration', 'entryref']);
      const exciseSeriesIdx = findHeaderIdx(['excise', 'stamp', 'stampseries']);
      const costIdx = findHeaderIdx(['landedcost', 'cost', 'costprice', 'warehousecost']);
      const wholesaleIdx = findHeaderIdx(['wholesale', 'wholesaleprice', 'wsprice', 'trade']);
      const retailIdx = findHeaderIdx(['retail', 'retailprice', 'consumerprice', 'price', 'rrp']);
      const stockIdx = findHeaderIdx(['totalbottles', 'initialbottles', 'bottles', 'qty', 'stock', 'quantity', 'inventory', 'onhand']);

      const parsed: ParsedProductDraft[] = [];

      for (let r = 1; r < lines.length; r++) {
        const line = lines[r];
        if (!line.trim()) continue;
        const cols = parseCsvLine(line, delimiter);

        const productName = cols[nameIdx !== -1 ? nameIdx : 0] || '';
        if (!productName.trim()) {
          parsed.push({
            sku: `ROW-${r}`,
            barcode: '',
            caseBarcode: '',
            name: `Empty Name (Row ${r})`,
            category: 'IPS',
            subCategory: 'Whisky',
            volumeMl: 750,
            baseRetailPrice: 0,
            totalBottles: 0,
            rowNumber: r,
            isValid: false,
            validationError: 'Product name is required',
          });
          continue;
        }

        const rawCat = cols[categoryIdx] || '';
        const isLps =
          rawCat.toUpperCase().includes('LPS') ||
          rawCat.toLowerCase().includes('local') ||
          (cols[originIdx] || '').toLowerCase().includes('kenya');
        const category = isLps ? 'LPS' : 'IPS';

        let subCat: LiquorSubCategory = 'Whisky';
        const subRaw = (cols[subCatIdx] || '').toLowerCase();
        if (subRaw.includes('gin')) subCat = 'Gin';
        else if (subRaw.includes('vodka')) subCat = 'Vodka';
        else if (subRaw.includes('cognac') || subRaw.includes('brandy')) subCat = 'Cognac & Brandy';
        else if (subRaw.includes('tequila')) subCat = 'Tequila';
        else if (subRaw.includes('rum')) subCat = 'Rum';
        else if (subRaw.includes('beer') || subRaw.includes('cider')) subCat = 'Beer & Cider';
        else if (subRaw.includes('wine') || subRaw.includes('champagne')) subCat = 'Champagne & Wine';
        else if (subRaw.includes('liqueur') || subRaw.includes('cream')) subCat = 'Liqueur & Cream';

        const brand = cols[brandIdx] || productName.split(' ')[0] || 'VAAIRO';

        // Barcode extraction
        let barcodeVal = (cols[barcodeIdx] || '').replace(/[^0-9]/g, '');
        if (!barcodeVal || barcodeVal.length < 8) {
          barcodeVal = '';
        }

        let caseBarcodeVal = (cols[caseBarcodeIdx] || '').replace(/[^0-9]/g, '');
        if (!caseBarcodeVal || caseBarcodeVal.length < 8) {
          caseBarcodeVal = '';
        }

        const vol = Number((cols[volumeIdx] || '750').replace(/[^0-9.]/g, '')) || 750;
        const abvVal = Number((cols[abvIdx] || '40').replace(/[^0-9.]/g, '')) || 40;
        const pack = Number((cols[bottlesPerCaseIdx] || '12').replace(/[^0-9]/g, '')) || 12;
        const origin = cols[originIdx] || (category === 'LPS' ? 'Kenya' : 'Imported');
        const supplier = cols[supplierIdx] || 'Bonded Importer Partner';
        const importRef = cols[importRefIdx] || (category === 'IPS' ? 'KRA-IDF-2026-AUTO' : 'LOCAL-LPS-BATCH');
        const stampSeries = cols[exciseSeriesIdx] || `KRA-EXC-${Date.now().toString().slice(-6)}`;

        const cost = Number((cols[costIdx] || '2500').replace(/[^0-9.]/g, '')) || 2500;
        const wholesale = Number((cols[wholesaleIdx] || String(cost * 1.25)).replace(/[^0-9.]/g, '')) || cost * 1.25;
        const retail = Number((cols[retailIdx] || String(cost * 1.45)).replace(/[^0-9.]/g, '')) || cost * 1.45;
        const stock = Number((cols[stockIdx !== -1 ? stockIdx : 0] || '0').replace(/[^0-9]/g, '')) || 0;

        // Auto-SKU generation or preserve CSV Auto SKU
        const rawSku = skuIdx !== -1 ? (cols[skuIdx] || '').trim() : '';
        const catCode = category === 'IPS' ? 'IPS' : 'LPS';
        const subCode = subCat.slice(0, 3).toUpperCase();
        const brandCode = brand.slice(0, 3).toUpperCase();
        const sku = rawSku || `SKU-${catCode}-${subCode}-${brandCode}-${vol}ML-${Math.floor(100 + Math.random() * 900)}`;

        const branchMap: Record<string, number> = {};
        branches.forEach((b) => {
          branchMap[b.id] = b.id === targetBranchId ? stock : 0;
        });

        parsed.push({
          sku,
          barcode: barcodeVal,
          caseBarcode: caseBarcodeVal,
          name: productName.trim(),
          category,
          subCategory: subCat,
          brand,
          volumeMl: vol,
          abv: abvVal,
          alcoholPercentage: abvVal,
          bottlesPerCase: pack,
          packSize: pack,
          originCountry: origin,
          countryOfOrigin: origin,
          supplierName: supplier,
          importEntryRef: importRef,
          importDeclarationNumber: importRef,
          exciseStampSeries: stampSeries,
          kraExciseStampType: category === 'IPS' ? 'IMPORT_DUTY_STAMP' : 'DIGITAL_EXCISE_STAMP',
          baseLandedCost: cost,
          warehouseCostKes: cost,
          baseWholesalePrice: wholesale,
          wholesalePriceKes: wholesale,
          baseRetailPrice: retail,
          retailPriceKes: retail,
          isOnboarded: true,
          status: 'Active',
          pendingActivationBottles: 0,
          totalBottles: stock,
          branchStockSummary: JSON.stringify(branchMap),
          geoPriceOverrides: JSON.stringify({}),
          rowNumber: r,
          isValid: true,
        });
      }

      // Immediately run the duplicate test against catalog & within CSV
      const testedRows = evaluateDuplicates(parsed, existingProducts);
      setParsedRows(testedRows);
    } catch (err) {
      console.error('CSV Parsing error:', err);
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Re-run Duplicate Test on demand
  const handleManualDuplicateTest = () => {
    if (parsedRows.length === 0) return;
    setIsTestingDuplicates(true);
    setTimeout(() => {
      const retested = evaluateDuplicates(parsedRows, existingProducts);
      setParsedRows(retested);
      setIsTestingDuplicates(false);
    }, 300);
  };

  const validProducts = useMemo(() => parsedRows.filter((r) => r.isValid), [parsedRows]);
  const invalidProducts = useMemo(() => parsedRows.filter((r) => !r.isValid), [parsedRows]);
  const uniqueProducts = useMemo(() => parsedRows.filter((r) => r.isValid && !r.isDuplicate), [parsedRows]);
  const duplicateProducts = useMemo(() => parsedRows.filter((r) => r.isValid && r.isDuplicate), [parsedRows]);

  const catalogDuplicateCount = useMemo(
    () => duplicateProducts.filter((p) => p.duplicateSource === 'catalog').length,
    [duplicateProducts]
  );
  const csvDuplicateCount = useMemo(
    () => duplicateProducts.filter((p) => p.duplicateSource === 'intra_csv').length,
    [duplicateProducts]
  );

  // Rows filtered by active tab
  const displayedRows = useMemo(() => {
    switch (activeFilterTab) {
      case 'unique':
        return uniqueProducts;
      case 'duplicates':
        return duplicateProducts;
      case 'invalid':
        return invalidProducts;
      default:
        return parsedRows;
    }
  }, [activeFilterTab, parsedRows, uniqueProducts, duplicateProducts, invalidProducts]);

  if (!isOpen) return null;

  // Execute Import: STRICTLY excludes all duplicates
  const handleExecuteImport = async () => {
    // Zero-Duplicate Guarantee: Only unique, non-duplicate products are allowed to be saved
    if (uniqueProducts.length === 0) {
      setImportSummary({
        count: 0,
        type: 'error',
        message: 'Upload Blocked: Duplicate test found 0 unique products. All rows are duplicates of existing catalog items or duplicated within the file. No duplicate items were uploaded.',
      });
      return;
    }

    setIsImporting(true);
    setImportProgress(10);

    try {
      const productsToSave = uniqueProducts.map((p) => {
        const {
          rowNumber,
          isValid,
          validationError,
          isDuplicate,
          duplicateSource,
          duplicateType,
          duplicateReason,
          matchingProductInfo,
          ...rest
        } = p;
        const bottleCount = typeof p.totalBottles === 'number' ? p.totalBottles : 0;
        const branchMap: Record<string, number> = {};
        if (targetBranchId && bottleCount > 0) {
          branchMap[targetBranchId] = bottleCount;
        }
        return {
          ...rest,
          isOnboarded: true,
          status: 'Active' as const,
          pendingActivationBottles: 0,
          totalBottles: bottleCount,
          branchStockSummary: JSON.stringify(branchMap),
        };
      });

      setImportProgress(50);
      const importedCount = await onBatchImport(productsToSave);
      setImportProgress(100);

      const targetBranchName = branches.find((b) => b.id === targetBranchId)?.name || 'HQ - Main Branch';
      setImportSummary({
        count: importedCount,
        type: 'success',
        message: `Successfully saved ${importedCount} clean unique products directly into Firestore (erp-db-1) allocated to ${targetBranchName}. ${duplicateProducts.length} duplicate items were automatically skipped and prevented from uploading.`,
      });

      // Clear file after short delay
      setTimeout(() => {
        setSelectedFile(null);
        setParsedRows([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 2500);
    } catch (err) {
      console.error('Batch import failure:', err);
      setImportSummary({
        count: 0,
        type: 'error',
        message: 'Import failed due to a database write error. Please verify network and try again.',
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-0 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-none sm:rounded-3xl border-0 sm:border-2 border-[#0A006E] shadow-2xl max-w-none sm:max-w-4xl w-full h-full sm:h-auto sm:max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-[#0A006E] text-white px-6 py-4 flex items-center justify-between border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-montserrat font-black text-base sm:text-lg text-white">
                  Bulk CSV Inventory Import Engine
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-montserrat font-black bg-[#FFDE00] text-[#0A006E] flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[#0A006E]" />
                  Duplicate Protection Active
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Upload CSV file with automatic pre-upload duplicate testing against {existingProducts.length} master catalog items.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">
          {/* Top Options & Template Download */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Download Template Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#0A006E]">
                  <Download className="w-4 h-4 text-[#0A006E]" />
                  <span className="font-montserrat font-black text-xs uppercase tracking-wider">
                    Need a template?
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Download clean CSV column headers template ready for your real inventory catalog.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="mt-3 w-fit px-4 py-2 bg-white hover:bg-slate-100 border-2 border-[#0A006E] text-[#0A006E] font-montserrat font-black text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Download CSV Template
              </button>
            </div>

            {/* Target Branch Allocation Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#0A006E]">
                  <Building2 className="w-4 h-4 text-[#0A006E]" />
                  <span className="font-montserrat font-black text-xs uppercase tracking-wider">
                    Initial Stock Branch Allocation
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Select which operational depot or branch receives initial bottle stock for unique items.
                </p>
              </div>
              <div className="mt-3">
                <select
                  value={targetBranchId}
                  onChange={(e) => setTargetBranchId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-slate-300 focus:border-[#0A006E] rounded-xl text-xs font-montserrat font-bold text-[#0A006E]"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} · {b.name} {b.isMain ? '(MAIN BRANCH)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* File Upload Drop Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#0A006E]/40 hover:border-[#0A006E] bg-indigo-50/30 hover:bg-indigo-50/60 rounded-3xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="w-12 h-12 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-md">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-montserrat font-black text-sm text-[#0A006E]">
                {selectedFile ? selectedFile.name : 'Click to select CSV file or drag & drop'}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Every line will undergo an instant duplicate test before upload. Duplicates are blocked.
              </p>
            </div>
            {selectedFile && (
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-montserrat font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{(selectedFile.size / 1024).toFixed(1)} KB Loaded</span>
              </div>
            )}
          </div>

          {/* Import Summary Notification */}
          {importSummary && (
            <div
              className={`p-4 rounded-2xl border text-xs font-montserrat font-bold flex items-center gap-3 ${
                importSummary.type === 'error' || importSummary.count === 0
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-800'
              }`}
            >
              {importSummary.type === 'error' || importSummary.count === 0 ? (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              )}
              <div>{importSummary.message}</div>
            </div>
          )}

          {/* DUPLICATE TEST RESULTS PANEL */}
          {parsedRows.length > 0 && (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-2xl border-2 transition-all ${
                  duplicateProducts.length > 0
                    ? 'bg-amber-50/90 border-amber-400 text-amber-950'
                    : 'bg-emerald-50/90 border-emerald-400 text-emerald-950'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3 mb-3 border-amber-200/80">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        duplicateProducts.length > 0
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-emerald-200 text-emerald-900'
                      }`}
                    >
                      {duplicateProducts.length > 0 ? (
                        <ShieldAlert className="w-6 h-6 stroke-[2.4]" />
                      ) : (
                        <ShieldCheck className="w-6 h-6 stroke-[2.4]" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-montserrat font-black text-sm">
                          {duplicateProducts.length > 0
                            ? `Duplicate Test: ${duplicateProducts.length} Duplicate Products Detected`
                            : 'Duplicate Test: PASSED (100% Unique Catalog)'}
                        </h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            duplicateProducts.length > 0
                              ? 'bg-amber-300 text-amber-950'
                              : 'bg-emerald-300 text-emerald-950'
                          }`}
                        >
                          {duplicateProducts.length > 0 ? 'Deduplication Active' : 'Zero Duplicates'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 mt-0.5">
                        {duplicateProducts.length > 0
                          ? `All ${duplicateProducts.length} duplicated items are automatically excluded from the upload payload to protect your database. Only the ${uniqueProducts.length} unique products will be saved.`
                          : `All ${uniqueProducts.length} products were tested against existing inventory and inside this CSV file with 0 collisions.`}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleManualDuplicateTest}
                    disabled={isTestingDuplicates}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-xs font-montserrat font-bold flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 self-end sm:self-auto"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingDuplicates ? 'animate-spin' : ''}`} />
                    <span>Re-Run Test</span>
                  </button>
                </div>

                {/* Duplicate Test Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Total In CSV</span>
                    <span className="font-mono-tabular font-black text-base text-slate-900">{parsedRows.length}</span>
                  </div>
                  <div className="bg-emerald-100/70 p-2.5 rounded-xl border border-emerald-300 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 block">Unique (Will Upload)</span>
                    <span className="font-mono-tabular font-black text-base text-emerald-900">{uniqueProducts.length}</span>
                  </div>
                  <div className="bg-amber-100/70 p-2.5 rounded-xl border border-amber-300 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-amber-800 block">Existing In DB</span>
                    <span className="font-mono-tabular font-black text-base text-amber-900">{catalogDuplicateCount}</span>
                  </div>
                  <div className="bg-amber-100/70 p-2.5 rounded-xl border border-amber-300 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-amber-800 block">Duplicate in CSV</span>
                    <span className="font-mono-tabular font-black text-base text-amber-900">{csvDuplicateCount}</span>
                  </div>
                </div>
              </div>

              {/* View Filter Tabs */}
              <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-200 pb-2">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5" /> View:
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveFilterTab('all')}
                    className={`px-3 py-1 rounded-xl text-xs font-montserrat font-bold cursor-pointer transition ${
                      activeFilterTab === 'all'
                        ? 'bg-[#0A006E] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    All Rows ({parsedRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilterTab('unique')}
                    className={`px-3 py-1 rounded-xl text-xs font-montserrat font-bold cursor-pointer transition ${
                      activeFilterTab === 'unique'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    ✓ Unique to Upload ({uniqueProducts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilterTab('duplicates')}
                    className={`px-3 py-1 rounded-xl text-xs font-montserrat font-bold cursor-pointer transition ${
                      activeFilterTab === 'duplicates'
                        ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                        : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
                    }`}
                  >
                    ⚠️ Duplicates Excluded ({duplicateProducts.length})
                  </button>
                  {invalidProducts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveFilterTab('invalid')}
                      className={`px-3 py-1 rounded-xl text-xs font-montserrat font-bold cursor-pointer transition ${
                        activeFilterTab === 'invalid'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                      }`}
                    >
                      Incomplete ({invalidProducts.length})
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setParsedRows([]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Clear File
                </button>
              </div>

              {/* Parsed Preview Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0A006E] text-[#FFDE00] font-montserrat sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 font-black">#</th>
                      <th className="py-2.5 px-3 font-black">Status / Duplicate Check</th>
                      <th className="py-2.5 px-3 font-black">Product Name & Auto-SKU</th>
                      <th className="py-2.5 px-3 font-black">Barcode (EAN-13)</th>
                      <th className="py-2.5 px-3 font-black text-right">Wholesale KES</th>
                      <th className="py-2.5 px-3 font-black text-right">Retail KES</th>
                      <th className="py-2.5 px-3 font-black text-right">Stock (Btls)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {displayedRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          No items match this filter tab.
                        </td>
                      </tr>
                    ) : (
                      displayedRows.slice(0, 60).map((p, idx) => (
                        <tr
                          key={idx}
                          className={
                            !p.isValid
                              ? 'bg-rose-50/70'
                              : p.isDuplicate
                              ? 'bg-amber-50/70 hover:bg-amber-100/60'
                              : 'hover:bg-slate-50'
                          }
                        >
                          <td className="py-2 px-3 font-mono-tabular text-slate-500">{p.rowNumber}</td>
                          <td className="py-2 px-3">
                            {!p.isValid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                                <X className="w-3 h-3" /> Incomplete
                              </span>
                            ) : p.isDuplicate ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-950">
                                  <AlertTriangle className="w-3 h-3 text-amber-800" /> Duplicate (Excluded)
                                </span>
                                <div className="text-[10px] text-amber-900 font-medium max-w-[200px] leading-tight line-clamp-2">
                                  {p.duplicateReason}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" /> Unique (Ready)
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-900">
                            <div>{p.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono-tabular font-normal">
                              {p.sku} · {p.volumeMl}ml
                            </div>
                            {!p.isValid && (
                              <span className="block text-[10px] text-rose-600 font-normal">
                                {p.validationError}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono-tabular text-slate-700">
                            {p.barcode || '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono-tabular font-semibold">
                            KES {Math.round(p.baseWholesalePrice ?? 0).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right font-mono-tabular font-bold text-[#0A006E]">
                            KES {Math.round(p.baseRetailPrice ?? 0).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right font-mono-tabular font-bold text-emerald-700">
                            {p.totalBottles}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {displayedRows.length > 60 && (
                <p className="text-[11px] text-slate-500 text-right">
                  Showing first 60 rows of {displayedRows.length} in this filter.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-montserrat font-bold text-xs rounded-xl cursor-pointer transition"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {isImporting && (
              <div className="flex items-center gap-2 text-xs font-montserrat font-bold text-[#0A006E]">
                <RefreshCw className="w-4 h-4 animate-spin text-[#0A006E]" />
                <span>Importing Unique SKUs to Firestore ({importProgress}%)...</span>
              </div>
            )}
            <button
              type="button"
              disabled={uniqueProducts.length === 0 || isImporting}
              onClick={handleExecuteImport}
              className="px-6 py-2.5 bg-[#FFDE00] hover:bg-amber-400 disabled:opacity-40 text-[#0A006E] font-montserrat font-black text-xs sm:text-sm rounded-xl cursor-pointer shadow-md transition flex items-center gap-2"
            >
              <Package className="w-4 h-4" />
              <span>
                {uniqueProducts.length > 0
                  ? `Commit ${uniqueProducts.length} Unique Products to Inventory ${
                      duplicateProducts.length > 0 ? `(Skipping ${duplicateProducts.length} Duplicates)` : ''
                    }`
                  : duplicateProducts.length > 0
                  ? 'All Rows Are Duplicates (Upload Blocked)'
                  : 'Commit CSV to Inventory'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
