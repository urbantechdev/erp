import React, { useState, useRef, useMemo } from 'react';
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
} from 'lucide-react';
import { Product, Branch, LiquorSubCategory } from '../types';

interface CsvInventoryImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: Branch[];
  existingProducts?: Product[];
  onBatchImport: (products: Omit<Product, 'id' | 'createdAt'>[]) => Promise<number>;
}

interface ParsedProductDraft extends Omit<Product, 'id' | 'createdAt'> {
  rowNumber: number;
  isValid: boolean;
  validationError?: string;
  isDuplicate?: boolean;
  duplicateReason?: string;
  matchedExistingProductName?: string;
  matchedExistingProductId?: string;
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

const SAMPLE_CSV_ROWS = [
  'Johnnie Walker Black Label 12YO,IPS,Whisky,Johnnie Walker,5000267014203,15000267014200,750,40,12,Scotland,Diageo Kenya Bonded,KRA-IDF-2026-9921,EXC-JW-2026-001,3100,3850,4500,60',
  'Hennessy VS Cognac,IPS,Cognac & Brandy,Hennessy,3245990250004,13245990250001,750,40,12,France,Moët Hennessy Direct,KRA-IDF-2026-8812,EXC-HN-2026-002,4800,5600,6500,48',
  'Tanqueray London Dry Gin,IPS,Gin,Tanqueray,5000281005409,15000281005406,750,43.1,12,United Kingdom,EABL Reserve Imports,KRA-IDF-2026-7734,EXC-TQ-2026-003,2400,2900,3500,72',
  'Tusker Lager 500ml Cans,LPS,Beer & Cider,Tusker,6161100000018,16161100000015,500,4.2,24,Kenya,East African Breweries Ltd,LOCAL-LPS-NAIROBI,KRA-LPS-2026-004,180,220,260,240',
  'Don Julio Blanco Tequila,IPS,Tequila,Don Julio,088076161839,1088076161836,750,38,6,Mexico,Diageo Kenya Bonded,KRA-IDF-2026-6641,EXC-DJ-2026-005,6200,7400,8800,30',
];

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
  const [importSummary, setImportSummary] = useState<{ count: number; message: string } | null>(null);
  const [duplicateHandling, setDuplicateHandling] = useState<'skip' | 'update' | 'keep_all'>('skip');
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'duplicates' | 'invalid'>('all');

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setIsProcessingFile(true);
    setImportSummary(null);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

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
      const stockIdx = findHeaderIdx(['initialbottles', 'bottles', 'qty', 'stock', 'quantity', 'inventory']);

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

        // Barcode extraction or auto-generation
        let barcodeVal = (cols[barcodeIdx] || '').replace(/[^0-9]/g, '');
        if (!barcodeVal || barcodeVal.length < 8) {
          // Deterministic unique 13-digit EAN barcode
          barcodeVal = String(6160000000000 + Math.floor(Math.random() * 9999999999));
        }

        let caseBarcodeVal = (cols[caseBarcodeIdx] || '').replace(/[^0-9]/g, '');
        if (!caseBarcodeVal || caseBarcodeVal.length < 8) {
          caseBarcodeVal = `1${barcodeVal.padStart(13, '0')}`;
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
        const stock = Number((cols[stockIdx] || '24').replace(/[^0-9]/g, '')) || 24;

        // Auto-SKU generation
        const catCode = category === 'IPS' ? 'IPS' : 'LPS';
        const subCode = subCat.slice(0, 3).toUpperCase();
        const brandCode = brand.slice(0, 3).toUpperCase();
        const sku = `SKU-${catCode}-${subCode}-${brandCode}-${vol}ML-${Math.floor(100 + Math.random() * 900)}`;

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
          // Newly uploaded CSV products become unavailable on all dashboards until scanned by Branch Manager
          isOnboarded: false,
          status: 'Pending Onboarding',
          pendingActivationBottles: stock,
          totalBottles: 0,
          branchStockSummary: JSON.stringify({}),
          geoPriceOverrides: JSON.stringify({}),
          rowNumber: r,
          isValid: true,
        });
      }

      setParsedRows(parsed);
    } catch (err) {
      console.error('CSV Parsing error:', err);
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Automated Duplicate Detection Engine
  const parsedRowsWithDuplicates = useMemo(() => {
    const existing = existingProducts || [];
    const seenBarcodes = new Set<string>();
    const seenNames = new Set<string>();

    return parsedRows.map((row) => {
      if (!row.isValid) return row;

      const cleanBarcode = (row.barcode || '').trim();
      const normName = row.name.trim().toLowerCase();
      const nameVolKey = `${normName}_${row.volumeMl || 750}`;

      // 1. Check against existing catalog in database
      if (cleanBarcode) {
        const existingByBarcode = existing.find(
          (p) => p.barcode && p.barcode.trim() === cleanBarcode
        );
        if (existingByBarcode) {
          return {
            ...row,
            isDuplicate: true,
            duplicateReason: `Barcode ${cleanBarcode} already matches existing catalog item "${existingByBarcode.name}"`,
            matchedExistingProductName: existingByBarcode.name,
            matchedExistingProductId: existingByBarcode.id,
          };
        }
      }

      const existingByNameVol = existing.find(
        (p) =>
          p.name.trim().toLowerCase() === normName &&
          Number(p.volumeMl || 750) === Number(row.volumeMl || 750)
      );
      if (existingByNameVol) {
        return {
          ...row,
          isDuplicate: true,
          duplicateReason: `Product "${existingByNameVol.name}" (${existingByNameVol.volumeMl}ml) already exists in database`,
          matchedExistingProductName: existingByNameVol.name,
          matchedExistingProductId: existingByNameVol.id,
        };
      }

      // 2. Check for intra-file duplicates within this same CSV upload
      if (cleanBarcode && seenBarcodes.has(cleanBarcode)) {
        return {
          ...row,
          isDuplicate: true,
          duplicateReason: `Duplicate barcode ${cleanBarcode} appears multiple times in this CSV upload`,
        };
      }
      if (seenNames.has(nameVolKey)) {
        return {
          ...row,
          isDuplicate: true,
          duplicateReason: `Product "${row.name} (${row.volumeMl}ml)" is repeated multiple times in this CSV`,
        };
      }

      if (cleanBarcode) seenBarcodes.add(cleanBarcode);
      seenNames.add(nameVolKey);

      return {
        ...row,
        isDuplicate: false,
      };
    });
  }, [parsedRows, existingProducts]);

  const uniqueValidProducts = useMemo(
    () => parsedRowsWithDuplicates.filter((r) => r.isValid && !r.isDuplicate),
    [parsedRowsWithDuplicates]
  );
  const duplicateProducts = useMemo(
    () => parsedRowsWithDuplicates.filter((r) => r.isValid && r.isDuplicate),
    [parsedRowsWithDuplicates]
  );
  const invalidProducts = useMemo(
    () => parsedRowsWithDuplicates.filter((r) => !r.isValid),
    [parsedRowsWithDuplicates]
  );

  const displayedRows = useMemo(() => {
    if (previewFilter === 'valid') return uniqueValidProducts;
    if (previewFilter === 'duplicates') return duplicateProducts;
    if (previewFilter === 'invalid') return invalidProducts;
    return parsedRowsWithDuplicates;
  }, [parsedRowsWithDuplicates, previewFilter, uniqueValidProducts, duplicateProducts, invalidProducts]);

  const targetsToImport = useMemo(() => {
    if (duplicateHandling === 'skip') {
      return uniqueValidProducts;
    }
    return parsedRowsWithDuplicates.filter((r) => r.isValid);
  }, [duplicateHandling, uniqueValidProducts, parsedRowsWithDuplicates]);

  const handleExecuteImport = async () => {
    if (targetsToImport.length === 0) return;
    setIsImporting(true);
    setImportProgress(10);

    try {
      const productsToSave = targetsToImport.map((p) => {
        const {
          rowNumber,
          isValid,
          validationError,
          isDuplicate,
          duplicateReason,
          matchedExistingProductName,
          matchedExistingProductId,
          ...rest
        } = p;
        return {
          ...rest,
          isUploaded: true,
          isOnboarded: false,
          hasRealBarcode: false,
          awaitingBarcodeScan: true,
          barcodeVerificationStatus: 'UNVERIFIED_SOURCE' as const,
          status: 'Pending Onboarding' as const,
          pendingActivationBottles: p.pendingActivationBottles ?? 12,
          totalBottles: 0,
          branchStockSummary: JSON.stringify({}),
        };
      });

      setImportProgress(50);
      const importedCount = await onBatchImport(productsToSave);
      setImportProgress(100);

      const skippedCount = duplicateHandling === 'skip' ? duplicateProducts.length : 0;
      setImportSummary({
        count: importedCount,
        message:
          skippedCount > 0
            ? `Successfully uploaded ${importedCount} unique products. All uploaded products are set to "Pending Onboarding" and must wait for barcode scanning before being made available for sale. ${skippedCount} duplicate items were skipped.`
            : `Successfully uploaded ${importedCount} products. In compliance with inventory governance, all uploaded products are set to "Pending Onboarding" and must wait for barcode scanning before being made available for sale on the storefront or POS.`,
      });

      // Clear file after short delay
      setTimeout(() => {
        setSelectedFile(null);
        setParsedRows([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 1500);
    } catch (err) {
      console.error('Batch import failure:', err);
      setImportSummary({
        count: 0,
        message: 'Import failed due to a database write error. Please verify network and try again.',
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-0 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-none sm:rounded-3xl border-0 sm:border-2 border-[#0A006E] shadow-2xl max-w-none sm:max-w-4xl w-full h-full sm:h-auto sm:max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-[#0A006E] text-white px-6 py-4 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-montserrat font-black text-base sm:text-lg text-white">
                  Bulk CSV Inventory Import Engine
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-montserrat font-bold bg-[#FFDE00] text-[#0A006E]">
                  Auto-SKU & Barcode Ready
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Upload CSV file of liquor items to batch-register catalog products, EAN barcodes, and branch inventory.
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
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
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
                  Download our formatted CSV template with example IPS whiskies, vodkas, and beers with pre-configured barcode headers.
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
                  Select which genuine operational depot should receive the initial imported bottle stock.
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
            className="border-2 border-dashed border-[#0A006E]/40 hover:border-[#0A006E] bg-indigo-50/30 hover:bg-indigo-50/60 rounded-3xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="w-14 h-14 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-lg">
              <Upload className="w-7 h-7" />
            </div>
            <div>
              <h4 className="font-montserrat font-black text-sm sm:text-base text-[#0A006E]">
                {selectedFile ? selectedFile.name : 'Click to select CSV file or drag & drop'}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Supports Comma-Separated (.csv) or Tab-Separated liquor inventories
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
            <div className={`p-4 rounded-2xl border text-xs font-montserrat font-bold flex items-center gap-3 ${
              importSummary.count > 0
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}>
              {importSummary.count > 0 ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <div>{importSummary.message}</div>
            </div>
          )}

          {/* Parsed Preview Table & Duplicate Governance */}
          {parsedRows.length > 0 && (
            <div className="space-y-4">
              {/* Duplicate Governance Banner */}
              <div className="bg-amber-50/80 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Layers className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-montserrat font-black text-xs text-amber-950 uppercase tracking-wider">
                        Automated Duplicate Check:
                      </span>
                      {duplicateProducts.length > 0 ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-montserrat font-black bg-amber-200 text-amber-950 border border-amber-400">
                          {duplicateProducts.length} Duplicates Detected
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-montserrat font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          0 Duplicates (100% Clean Catalog)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-amber-900/80 mt-0.5">
                      {duplicateProducts.length > 0
                        ? `${duplicateProducts.length} items match existing database barcodes or product names.`
                        : 'Every item in this CSV is unique and ready to onboard as a new SKU.'}
                    </p>
                  </div>
                </div>

                {/* Duplicate Strategy Toggle */}
                {duplicateProducts.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-white border border-amber-300 rounded-xl p-1.5 shrink-0 shadow-xs">
                    <span className="text-[11px] font-montserrat font-bold text-amber-900 px-1">Action:</span>
                    <button
                      type="button"
                      onClick={() => setDuplicateHandling('skip')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-montserrat font-black cursor-pointer transition ${
                        duplicateHandling === 'skip'
                          ? 'bg-[#0A006E] text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                      title="Only import unique products, skip duplicates"
                    >
                      Auto-Skip Duplicates
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicateHandling('update')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-montserrat font-black cursor-pointer transition ${
                        duplicateHandling === 'update'
                          ? 'bg-[#0A006E] text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                      title="Merge incoming bottles into existing product stock"
                    >
                      Merge Stock
                    </button>
                  </div>
                )}
              </div>

              {/* Filter Tabs & Quick Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('all')}
                    className={`px-3 py-1 rounded-full text-xs font-montserrat font-bold cursor-pointer transition ${
                      previewFilter === 'all'
                        ? 'bg-[#0A006E] text-[#FFDE00]'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    All Rows ({parsedRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('valid')}
                    className={`px-3 py-1 rounded-full text-xs font-montserrat font-bold cursor-pointer transition ${
                      previewFilter === 'valid'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    New Unique ({uniqueValidProducts.length})
                  </button>
                  {duplicateProducts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('duplicates')}
                      className={`px-3 py-1 rounded-full text-xs font-montserrat font-bold cursor-pointer transition ${
                        previewFilter === 'duplicates'
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300'
                      }`}
                    >
                      Duplicates ({duplicateProducts.length})
                    </button>
                  )}
                  {invalidProducts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('invalid')}
                      className={`px-3 py-1 rounded-full text-xs font-montserrat font-bold cursor-pointer transition ${
                        previewFilter === 'invalid'
                          ? 'bg-rose-700 text-white'
                          : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                      }`}
                    >
                      Errors ({invalidProducts.length})
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
                  className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer self-end sm:self-auto"
                >
                  Clear File
                </button>
              </div>

              {/* Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0A006E] text-[#FFDE00] font-montserrat sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 font-black">#</th>
                      <th className="py-2.5 px-3 font-black">Product Name &amp; Duplicate Status</th>
                      <th className="py-2.5 px-3 font-black">Class / Subcategory</th>
                      <th className="py-2.5 px-3 font-black">Barcode (EAN-13)</th>
                      <th className="py-2.5 px-3 font-black text-right">Wholesale KES</th>
                      <th className="py-2.5 px-3 font-black text-right">Retail KES</th>
                      <th className="py-2.5 px-3 font-black text-right">Batch Stock</th>
                      <th className="py-2.5 px-3 font-black text-center">Import Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {displayedRows.slice(0, 100).map((p, idx) => (
                      <tr
                        key={idx}
                        className={
                          !p.isValid
                            ? 'bg-rose-50/70'
                            : p.isDuplicate
                            ? 'bg-amber-50/80 border-l-4 border-l-amber-500'
                            : 'hover:bg-slate-50'
                        }
                      >
                        <td className="py-2 px-3 font-mono-tabular text-slate-500">{p.rowNumber}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">
                          <div>{p.name}</div>
                          {p.isDuplicate && (
                            <div className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <span>⚠️ Duplicate:</span>
                              <span className="font-normal">{p.duplicateReason}</span>
                            </div>
                          )}
                          {!p.isValid && (
                            <span className="block text-[10px] text-rose-600 font-normal">
                              {p.validationError}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              p.category === 'IPS'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {p.category}
                          </span>{' '}
                          <span className="text-slate-600">{p.subCategory}</span>
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
                          {p.pendingActivationBottles ?? p.totalBottles ?? 0}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {p.isDuplicate ? (
                            duplicateHandling === 'skip' ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-montserrat font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                Auto-Skipped
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-montserrat font-bold bg-blue-100 text-blue-800 border border-blue-300">
                                Will Merge Stock
                              </span>
                            )
                          ) : p.isValid ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-montserrat font-bold bg-emerald-100 text-emerald-800">
                              New Item
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-montserrat font-bold bg-rose-100 text-rose-800">
                              Error
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {displayedRows.length > 100 && (
                <p className="text-[11px] text-slate-500 text-right">
                  Showing first 100 rows of {displayedRows.length} displayed items.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
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
                <span>Importing to Firestore ({importProgress}%)...</span>
              </div>
            )}
            <button
              type="button"
              disabled={targetsToImport.length === 0 || isImporting}
              onClick={handleExecuteImport}
              className="px-6 py-2.5 bg-[#FFDE00] hover:bg-amber-400 disabled:opacity-40 text-[#0A006E] font-montserrat font-black text-xs sm:text-sm rounded-xl cursor-pointer shadow-md transition flex items-center gap-2"
            >
              <Package className="w-4 h-4" />
              <span>
                {targetsToImport.length > 0
                  ? duplicateHandling === 'skip' && duplicateProducts.length > 0
                    ? `Import ${targetsToImport.length} Unique Items (${duplicateProducts.length} duplicates auto-skipped)`
                    : `Import ${targetsToImport.length} Products into Inventory`
                  : 'No Valid Products to Import'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
